import * as vscode from "vscode";

import { commentContextAt } from "../syntax/commentContext";
import { syntaxFor } from "../syntax/languages";
import { addDays, todayIso } from "../syntax/metadata";
import type { Services } from "./services";

const snippetSafe = (value: string): string => value.replace(/[$}\\]/g, "");

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
  });
};
