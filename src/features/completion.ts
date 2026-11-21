import * as vscode from "vscode";

import { commentContextAt } from "../syntax/commentContext";
import { syntaxFor } from "../syntax/languages";
import { addDays, isRelativeDate, RELATIVE_KEYWORDS, resolveRelativeDate, todayIso } from "../syntax/metadata";
import type { TodoForgeSettings } from "../types";
import { escapeRegex } from "../utils/regexBuilder";
import type { Services } from "./services";

const snippetSafe = (value: string): string => value.replace(/[$}\\]/g, "");

const relativeCandidates = (token: string): string[] => {
  const lower = token.toLowerCase();
  if (lower === "") {
    return ["tomorrow", "+1w", "+2w", "+1m", ...RELATIVE_KEYWORDS.slice(2)];
  }
  if (lower === "+") {
    return ["+1d", "+3d", "+1w", "+2w", "+1m"];
  }
  if (/^\+\d{1,3}$/.test(lower)) {
    return [`${lower}d`, `${lower}w`, `${lower}m`];
  }
  if (isRelativeDate(lower)) {
    return [lower];
  }
  return lower.length >= 2 ? RELATIVE_KEYWORDS.filter((keyword) => keyword.startsWith(lower)) : [];
};

/**
 * Inside `TAG(...)`, a relative due date (`+7d`, `+2w`, `+1m`, `tomorrow`,
 * `friday`) completes to the ISO date it means today, so the comment stays stable.
 */
const relativeDateItems = (
  position: vscode.Position,
  prefixText: string,
  settings: TodoForgeSettings,
): vscode.CompletionItem[] | undefined => {
  if (settings.tags.length === 0) {
    return undefined;
  }
  const tags = settings.tags.map(escapeRegex).join("|");
  const open = new RegExp(`(?:^|[^\\w])(?:${tags})\\([^()]*$`, settings.caseSensitive ? "" : "i");
  if (!open.test(prefixText)) {
    return undefined;
  }
  const token = /([+\w]*)$/.exec(prefixText)?.[1] ?? "";
  const candidates = relativeCandidates(token);
  if (candidates.length === 0) {
    return undefined;
  }
  const today = todayIso();
  const range = new vscode.Range(position.line, position.character - token.length, position.line, position.character);
  return candidates.flatMap((candidate, index) => {
    const iso = resolveRelativeDate(candidate, today);
    if (!iso) {
      return [];
    }
    const item = new vscode.CompletionItem({ label: candidate, description: iso }, vscode.CompletionItemKind.Value);
    item.insertText = iso;
    item.filterText = candidate;
    item.range = range;
    item.sortText = `0${String(index).padStart(2, "0")}`;
    item.detail = vscode.l10n.t("TodoForge: due date {0}", iso);
    return [item];
  });
};

/**
 * Inside a comment, typing the start of a tag offers `TODO: ` and
 * `TODO(owner, date): ` snippets. On an empty line, `todo` offers a whole
 * comment in the file's syntax.
 */
export const registerCompletion = (services: Services, owner: () => string | undefined): vscode.Disposable => {
  return vscode.languages.registerCompletionItemProvider([{ scheme: "file" }, { scheme: "untitled" }], {
    provideCompletionItems: (document, position) => {
      const line = document.lineAt(position.line).text;
      const prefixText = line.slice(0, position.character);
      const relative = relativeDateItems(position, prefixText, services.engine.settings);
      if (relative) {
        return relative;
      }
      const word = /([A-Za-z]+)$/.exec(prefixText)?.[1] ?? "";
      if (word.length < 2 || document.languageId === "markdown" || document.languageId === "plaintext") {
        return undefined;
      }
      const settings = services.engine.settings;
      const tags = settings.tags.filter((tag) => tag.toLowerCase().startsWith(word.toLowerCase()));
      if (tags.length === 0) {
        return undefined;
      }
      const start = position.character - word.length;
      const range = new vscode.Range(position.line, start, position.line, position.character);
      const syntax = syntaxFor(document.uri.fsPath);
      const context = commentContextAt(line, start, syntax);
      const me = snippetSafe(owner() ?? "") || "owner";
      const due = addDays(todayIso(), 7);
      const items: vscode.CompletionItem[] = [];
      const onlyWord = prefixText.trim() === word;
      for (const [index, tag] of tags.entries()) {
        if (context.inComment && !onlyWord) {
          const plain = new vscode.CompletionItem(`${tag}:`, vscode.CompletionItemKind.Keyword);
          plain.insertText = new vscode.SnippetString(`${tag}: $0`);
          plain.range = range;
          plain.sortText = `0${index}a`;
          plain.detail = "TodoForge";
          const rich = new vscode.CompletionItem(`${tag}(owner, date)`, vscode.CompletionItemKind.Snippet);
          rich.insertText = new vscode.SnippetString(`${tag}(\${1:${me}}, \${2:${due}}): $0`);
          rich.range = range;
          rich.sortText = `0${index}b`;
          rich.detail = vscode.l10n.t("TodoForge: TODO with owner and due date");
          rich.documentation = new vscode.MarkdownString(
            vscode.l10n.t("Adds an owner and a due date. Add `!high` for priority and `#label` for labels."),
          );
          items.push(plain, rich);
        } else if (onlyWord && syntax) {
          const open = syntax.insert;
          const close = syntax.insertClose ?? "";
          const item = new vscode.CompletionItem(`${open} ${tag}`, vscode.CompletionItemKind.Snippet);
          item.filterText = tag.toLowerCase();
          item.insertText = new vscode.SnippetString(`${open} ${tag}(\${1:${me}}, \${2:${due}}): $0${close}`);
          item.range = range;
          item.sortText = `z${index}`;
          item.detail = vscode.l10n.t("TodoForge: insert a {0} comment", tag);
          items.push(item);
        }
      }
      return items;
    },
  }, "+");
};
