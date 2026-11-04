import * as vscode from "vscode";

import type { GitContext } from "../git/gitContext";
import { logError, logInfo } from "../logger";
import { queryNeedsBlame } from "../tree/query";
import {
  buildToolQuery,
  clampLimit,
  findTodo,
  refOf,
  renderRecords,
  selectTodos,
  toRecord,
  TOOL_NAMES,
  type GetTodoInput,
  type ListChangesInput,
  type ListTodosInput,
  type ToolContext,
} from "../tools/todoTools";
import type { TodoForgeSettings, TodoMatch } from "../types";

/*
 * Language Model tools for Copilot Chat and other chat agents.
 *
 * - Read-only. They return TODO data TodoForge already indexed in this
 *   window: tag, comment text, path, line, inline metadata and git blame.
 *   Never surrounding code, never anything from the network.
 * - They run only when the user chats and the chat model decides to call
 *   them; VS Code shows each call in the chat.
 * - Off in untrusted workspaces and when `todoforge.ai.chatTools` is false
 *   (also enforced by the `when` clause in package.json).
 * - The tool API arrived in VS Code 1.95. TodoForge supports 1.90, so the API
 *   is feature-detected and these local types describe the part we use.
 */

interface ToolResultCtor {
  new (content: unknown[]): unknown;
}
interface TextPartCtor {
  new (value: string): unknown;
}
interface ToolInvocation<T> {
  input: T;
}
interface Tool<T> {
  invoke: (options: ToolInvocation<T>, token: vscode.CancellationToken) => Promise<unknown>;
  prepareInvocation?: (options: ToolInvocation<T>) => { invocationMessage?: string };
}
interface LmToolsApi {
  registerTool: <T>(name: string, tool: Tool<T>) => vscode.Disposable;
}

export interface ChatToolDeps {
  matches: () => readonly TodoMatch[];
  context: () => ToolContext;
  settings: () => TodoForgeSettings;
  git: GitContext;
}

export const chatToolsSupported = (): boolean => {
  const lm = (vscode as unknown as { lm?: Partial<LmToolsApi> }).lm;
  const api = vscode as unknown as { LanguageModelToolResult?: unknown; LanguageModelTextPart?: unknown };
  return typeof lm?.registerTool === "function" && typeof api.LanguageModelToolResult === "function" && typeof api.LanguageModelTextPart === "function";
};

const blocked = (deps: ChatToolDeps): string | undefined => {
  if (!vscode.workspace.isTrusted) {
    return vscode.l10n.t("TodoForge chat tools are off in Restricted Mode. Trust this workspace to use them.");
  }
  if (!deps.settings().chatTools) {
    return vscode.l10n.t("TodoForge chat tools are turned off (todoforge.ai.chatTools).");
  }
  return undefined;
};

export const registerChatTools = (deps: ChatToolDeps): vscode.Disposable[] => {
  if (!chatToolsSupported()) {
    logInfo("Chat tools: this VS Code has no Language Model tool API; skipped.");
    return [];
  }
  const lm = (vscode as unknown as { lm: LmToolsApi }).lm;
  const api = vscode as unknown as { LanguageModelToolResult: ToolResultCtor; LanguageModelTextPart: TextPartCtor };
  const result = (text: string): unknown => new api.LanguageModelToolResult([new api.LanguageModelTextPart(text)]);

  const guarded = <T>(name: string, run: (input: T, token: vscode.CancellationToken) => Promise<string>): Tool<T> => ({
    invoke: async (options, token) => {
      const reason = blocked(deps);
      if (reason) {
        return result(reason);
      }
      try {
        return result(await run(options.input ?? ({} as T), token));
      } catch (error) {
        logError(`Chat tool ${name} failed`, error);
        return result(vscode.l10n.t("TodoForge could not read TODOs: {0}", error instanceof Error ? error.message : String(error)));
      }
    },
    prepareInvocation: () => ({ invocationMessage: vscode.l10n.t("Reading TODOs from TodoForge") }),
  });

  const withBlame = async (matches: readonly TodoMatch[], token: vscode.CancellationToken): Promise<void> => {
    await deps.git.ensureBlame(matches, token);
  };

  const listTodos = guarded<ListTodosInput>(TOOL_NAMES.list, async (input, token) => {
    const all = deps.matches();
    const query = buildToolQuery(input);
    if (queryNeedsBlame(query) || input.sortBy === "age") {
      await withBlame(all, token);
    }
    const context = deps.context();
    const { items, total } = selectTodos(all, input, context);
    await withBlame(items, token);
    const records = items.map((match) => toRecord(match, deps.context()));
    const summary =
      total === 0
        ? `No TODOs match${query ? ` "${query}"` : ""} (${all.length} TODOs in the workspace).`
        : `${total} of ${all.length} TODOs match${query ? ` "${query}"` : ""}. Today is ${context.today}.`;
    return renderRecords(summary, records, total);
  });

  const listChanges = guarded<ListChangesInput>(TOOL_NAMES.changes, async (input, token) => {
    if (!deps.git.available) {
      return "No git repository with change information in this workspace, or git is turned off (todoforge.git.enabled).";
    }
    const context = deps.context();
    const scope = input.scope ?? "all";
    const all = deps.matches();
    const uncommitted = scope === "branch" ? [] : all.filter((match) => context.isUncommitted(match));
    const branch = scope === "uncommitted" ? [] : all.filter((match) => !context.isUncommitted(match) && context.isOnBranch(match));
    const items = [...uncommitted, ...branch].slice(0, clampLimit(input.limit, 100));
    await withBlame(items, token);
    const base = context.baseRef ? ` Base branch: ${context.baseRef}.` : "";
    const summary = `${uncommitted.length} uncommitted and ${branch.length} branch TODOs.${base}`;
    return renderRecords(summary, items.map((match) => toRecord(match, deps.context())), uncommitted.length + branch.length);
  });

  const getTodo = guarded<GetTodoInput>(TOOL_NAMES.get, async (input) => {
    const match = findTodo(deps.matches(), input);
    if (!match) {
      return `No TODO found for ${JSON.stringify(input)}. Use ${TOOL_NAMES.list} to find refs.`;
    }
    const blame = await deps.git.blameOne(match);
    const record = { ...toRecord(match, deps.context(), blame), text: match.text || match.raw.trim(), raw: match.raw.trim() };
    const commit = blame && !blame.uncommitted ? { commit: blame.sha.slice(0, 8), commitSummary: blame.summary, date: new Date(blame.time * 1000).toISOString().slice(0, 10) } : {};
    return [`TODO ${refOf(match)}`, "```json", JSON.stringify({ ...record, ...commit }, null, 2), "```"].join("\n");
  });

  const disposables = [
    lm.registerTool(TOOL_NAMES.list, listTodos),
    lm.registerTool(TOOL_NAMES.changes, listChanges),
    lm.registerTool(TOOL_NAMES.get, getTodo),
  ];
  logInfo("Chat tools registered.");
  return disposables;
};
