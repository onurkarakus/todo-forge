import * as vscode from "vscode";

import { syntaxFor } from "../syntax/languages";
import { addDays, isIsoDate, resolveRelativeDate, rewriteMetadata, todayIso, type MetaPatch } from "../syntax/metadata";
import { buildTodoLine, planRemoval } from "../syntax/removal";
import type { Priority, TodoMatch } from "../types";

const documentFor = async (match: TodoMatch): Promise<vscode.TextDocument> => {
  return vscode.workspace.openTextDocument(vscode.Uri.parse(match.uri));
};

/** The edit that rewrites inline metadata, or undefined if the line changed since the scan. */
export const metadataEdit = (
  document: vscode.TextDocument,
  match: TodoMatch,
  patch: MetaPatch,
): vscode.TextEdit | undefined => {
  if (match.line >= document.lineCount) {
    return undefined;
  }
  const line = document.lineAt(match.line);
  const next = rewriteMetadata(line.text, match.column, match.tag, patch);
  if (next === undefined || next === line.text) {
    return undefined;
  }
  return vscode.TextEdit.replace(line.range, next);
};

/** Edits that write every relative due date (`+7d`, `friday`) in `matches` as an ISO date. One edit per line. */
export const relativeDateEdits = (
  document: vscode.TextDocument,
  matches: readonly TodoMatch[],
  today: string,
): vscode.TextEdit[] => {
  const edits: vscode.TextEdit[] = [];
  const lines = new Set<number>();
  for (const match of matches) {
    const relative = match.meta?.relativeDue;
    const due = relative && !match.meta?.due ? resolveRelativeDate(relative, today) : undefined;
    if (!due || lines.has(match.line)) {
      continue;
    }
    const edit = metadataEdit(document, match, { due });
    if (edit) {
      lines.add(match.line);
      edits.push(edit);
    }
  }
  return edits;
};

/**
 * Applies one metadata patch to many TODOs as a single undoable edit.
 * Two TODOs on the same line get only the first change. Returns the number changed.
 */
export const applyMetadataToAll = async (
  matches: readonly TodoMatch[],
  patchFor: (match: TodoMatch) => MetaPatch | undefined,
): Promise<number> => {
  const workspaceEdit = new vscode.WorkspaceEdit();
  let changed = 0;
  let attempted = 0;
  const byUri = new Map<string, TodoMatch[]>();
  for (const match of matches) {
    const list = byUri.get(match.uri) ?? [];
    list.push(match);
    byUri.set(match.uri, list);
  }
  for (const [uri, list] of byUri) {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
    const lines = new Set<number>();
    const edits: vscode.TextEdit[] = [];
    for (const match of list) {
      const patch = patchFor(match);
      if (!patch || lines.has(match.line)) {
        continue;
      }
      attempted += 1;
      const edit = metadataEdit(document, match, patch);
      if (edit) {
        lines.add(match.line);
        edits.push(edit);
      }
    }
    if (edits.length > 0) {
      workspaceEdit.set(document.uri, edits);
      changed += edits.length;
    }
  }
  if (changed === 0) {
    if (attempted === 0) {
      return 0;
    }
    void vscode.window.showWarningMessage(
      vscode.l10n.t("TodoForge could not find that TODO where it was. Refresh and try again."),
    );
    return 0;
  }
  return (await vscode.workspace.applyEdit(workspaceEdit)) ? changed : 0;
};

export const removalEdit = (document: vscode.TextDocument, match: TodoMatch): vscode.TextEdit | undefined => {
  if (match.line >= document.lineCount) {
    return undefined;
  }
  const line = document.lineAt(match.line);
  if (match.kind === "markdown") {
    return vscode.TextEdit.delete(line.rangeIncludingLineBreak);
  }
  if (line.text.slice(match.column, match.column + match.tag.length) !== match.tag) {
    return undefined;
  }
  const plan = planRemoval(line.text, match.column, syntaxFor(document.uri.fsPath));
  if (!plan) {
    return undefined;
  }
  if (plan.kind === "line") {
    return vscode.TextEdit.delete(line.rangeIncludingLineBreak);
  }
  return vscode.TextEdit.replace(new vscode.Range(match.line, plan.start, match.line, plan.end), plan.replacement);
};

const applyEdit = async (uri: vscode.Uri, edit: vscode.TextEdit | undefined): Promise<boolean> => {
  if (!edit) {
    void vscode.window.showWarningMessage(
      vscode.l10n.t("TodoForge could not find that TODO where it was. Refresh and try again."),
    );
    return false;
  }
  const workspaceEdit = new vscode.WorkspaceEdit();
  workspaceEdit.set(uri, [edit]);
  return vscode.workspace.applyEdit(workspaceEdit);
};

export const applyMetadata = async (match: TodoMatch, patch: MetaPatch): Promise<boolean> => {
  const document = await documentFor(match);
  return applyEdit(document.uri, metadataEdit(document, match, patch));
};

export const removeTodo = async (match: TodoMatch): Promise<boolean> => {
  const document = await documentFor(match);
  return applyEdit(document.uri, removalEdit(document, match));
};

export const pickDueDate = async (current?: string): Promise<string | null | undefined> => {
  const today = todayIso();
  type DueItem = vscode.QuickPickItem & { value?: string | null; custom?: boolean };
  const items: DueItem[] = [
    { label: vscode.l10n.t("Tomorrow"), description: addDays(today, 1), value: addDays(today, 1) },
    { label: vscode.l10n.t("In 3 days"), description: addDays(today, 3), value: addDays(today, 3) },
    { label: vscode.l10n.t("Next week"), description: addDays(today, 7), value: addDays(today, 7) },
    { label: vscode.l10n.t("In 2 weeks"), description: addDays(today, 14), value: addDays(today, 14) },
    { label: vscode.l10n.t("Next month"), description: addDays(today, 30), value: addDays(today, 30) },
    { label: vscode.l10n.t("Pick a date…"), custom: true },
  ];
  if (current) {
    items.push({ label: vscode.l10n.t("Clear due date"), description: current, value: null });
  }
  const picked = await vscode.window.showQuickPick(items, { placeHolder: vscode.l10n.t("Due date") });
  if (!picked) {
    return undefined;
  }
  if (!picked.custom) {
    return picked.value;
  }
  const typed = await vscode.window.showInputBox({
    prompt: vscode.l10n.t("Due date (YYYY-MM-DD)"),
    value: current ?? addDays(today, 7),
    validateInput: (value) => (isIsoDate(value.trim()) ? undefined : vscode.l10n.t("Use the format YYYY-MM-DD.")),
  });
  return typed?.trim();
};

export const pickPriority = async (current?: Priority): Promise<Priority | null | undefined> => {
  type PriorityItem = vscode.QuickPickItem & { value: Priority | null };
  const items: PriorityItem[] = [
    { label: `$(flame) ${vscode.l10n.t("High")}`, description: "!high", value: "high" },
    { label: `$(dash) ${vscode.l10n.t("Medium")}`, description: "!medium", value: "medium" },
    { label: `$(arrow-down) ${vscode.l10n.t("Low")}`, description: "!low", value: "low" },
  ];
  if (current) {
    items.push({ label: `$(close) ${vscode.l10n.t("Clear priority")}`, value: null });
  }
  const picked = await vscode.window.showQuickPick(items, { placeHolder: vscode.l10n.t("Priority") });
  return picked ? picked.value : undefined;
};

/** Inserts a TODO comment above the cursor line as a snippet. */
export const insertTodo = async (
  editor: vscode.TextEditor,
  tag: string,
  owner: string | undefined,
): Promise<void> => {
  const document = editor.document;
  const lineNumber = editor.selection.active.line;
  const line = document.lineAt(lineNumber);
  const indent = line.text.slice(0, line.firstNonWhitespaceCharacterIndex);
  const syntax = syntaxFor(document.uri.fsPath) ?? (document.languageId === "markdown" ? undefined : undefined);
  const ownerPart = owner ? `\${1:${owner.replace(/[$}\\]/g, "")}}` : "${1:owner}";
  const body = `${tag}(${ownerPart}, \${2:${addDays(todayIso(), 7)}}): \${0}`;
  const snippetText =
    document.languageId === "markdown" ? `${indent}- [ ] \${0}` : buildTodoLine(indent, syntax, body).replace(/\$(?!\{|0)/g, "\\$");
  const empty = line.text.trim().length === 0;
  const position = new vscode.Position(lineNumber, 0);
  await editor.insertSnippet(
    new vscode.SnippetString(empty ? snippetText : `${snippetText}\n`),
    empty ? line.range : position,
  );
};
