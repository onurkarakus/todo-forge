import * as vscode from "vscode";

import type { TodoMatch } from "../types";

const CONSENT_KEY = "todoforge.ai.consent";
const CONTEXT_LINES = 40;

/**
 * Opt-in AI help through the VS Code Language Model API. Off by default
 * (`todoforge.ai.enabled`). TodoForge sends nothing itself: the request goes
 * to the chat model the user already has in VS Code (for example Copilot),
 * after a one-time consent prompt. Disabled in untrusted workspaces.
 */
export const aiAvailable = (): boolean => {
  const lm = (vscode as { lm?: { selectChatModels?: unknown } }).lm;
  return typeof lm?.selectChatModels === "function";
};

const consent = async (context: vscode.ExtensionContext): Promise<boolean> => {
  if (context.globalState.get<boolean>(CONSENT_KEY) === true) {
    return true;
  }
  const allow = vscode.l10n.t("Allow");
  const choice = await vscode.window.showWarningMessage(
    vscode.l10n.t("Send this TODO to a language model?"),
    {
      modal: true,
      detail: vscode.l10n.t(
        "TodoForge will send the TODO text and up to {0} surrounding lines of code to the chat model you pick in VS Code (for example GitHub Copilot). That model's own terms apply. TodoForge stores nothing and makes no network request itself.",
        CONTEXT_LINES * 2,
      ),
    },
    allow,
  );
  if (choice !== allow) {
    return false;
  }
  await context.globalState.update(CONSENT_KEY, true);
  return true;
};

const surrounding = (document: vscode.TextDocument, line: number): string => {
  const start = Math.max(0, line - CONTEXT_LINES);
  const end = Math.min(document.lineCount - 1, line + CONTEXT_LINES);
  const lines: string[] = [];
  for (let index = start; index <= end; index += 1) {
    lines.push(`${index + 1}${index === line ? ">" : " "} ${document.lineAt(index).text}`);
  }
  return lines.join("\n");
};

export const explainTodo = async (context: vscode.ExtensionContext, match: TodoMatch): Promise<void> => {
  if (!vscode.workspace.isTrusted) {
    void vscode.window.showInformationMessage(vscode.l10n.t("AI help is off in untrusted workspaces."));
    return;
  }
  if (!aiAvailable()) {
    void vscode.window.showInformationMessage(vscode.l10n.t("This VS Code has no Language Model API."));
    return;
  }
  if (!(await consent(context))) {
    return;
  }
  const models = await vscode.lm.selectChatModels();
  if (models.length === 0) {
    void vscode.window.showInformationMessage(
      vscode.l10n.t("No chat model is available. Install and sign in to a chat extension such as GitHub Copilot."),
    );
    return;
  }
  let model = models[0] as vscode.LanguageModelChat;
  if (models.length > 1) {
    const picked = await vscode.window.showQuickPick(
      models.map((item) => ({ label: item.name, description: item.vendor, model: item })),
      { placeHolder: vscode.l10n.t("Choose a chat model") },
    );
    if (!picked) {
      return;
    }
    model = picked.model;
  }
  const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(match.uri));
  const prompt = [
    "You are helping a developer resolve a TODO comment in their code.",
    `File: ${match.relativePath}, line ${match.line + 1}, language: ${document.languageId}.`,
    `TODO: ${match.tag}: ${match.text}`,
    "",
    "Code around it (the TODO line is marked with >):",
    "```",
    surrounding(document, match.line),
    "```",
    "",
    "Reply in Markdown with: 1) what the TODO asks for, in one or two sentences; 2) a short step-by-step plan; 3) a code sketch if it helps; 4) risks or open questions. Be concise.",
  ].join("\n");
  const output = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: `# ${match.tag}: ${match.text}\n\n_${match.relativePath}:${match.line + 1} · ${model.name}_\n\n`,
  });
  const editor = await vscode.window.showTextDocument(output, { viewColumn: vscode.ViewColumn.Beside, preview: true });
  const source = new vscode.CancellationTokenSource();
  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: vscode.l10n.t("Asking {0}…", model.name), cancellable: true },
      async (_progress, token) => {
        token.onCancellationRequested(() => source.cancel());
        const response = await model.sendRequest([vscode.LanguageModelChatMessage.User(prompt)], {}, source.token);
        for await (const chunk of response.text) {
          const end = editor.document.lineAt(editor.document.lineCount - 1).range.end;
          await editor.edit((builder) => builder.insert(end, chunk), { undoStopBefore: false, undoStopAfter: false });
        }
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(vscode.l10n.t("The language model request failed: {0}", message));
  } finally {
    source.dispose();
  }
};
