import * as vscode from "vscode";

import { VISIBLE_RANGE_PADDING } from "../config/defaults";
import { todayIso } from "../syntax/metadata";
import type { TodoForgeSettings, TodoMatch } from "../types";
import { createTagDecorations, disposeDecorations, type TagDecorations } from "./decorationFactory";
import { dueHint, hintText, type HintStrings } from "./hints";
import { splitDecorationRanges } from "./rangePlan";

export interface Highlighter {
  /** Rebuilds decoration types (tags or styles changed) and repaints. */
  refresh: () => void;
  /** Repaints visible editors with the current matches. */
  paint: () => void;
  dispose: () => void;
}

const toRange = (line: number, start: number, end: number, document: vscode.TextDocument): vscode.Range => {
  const safeLine = Math.min(line, Math.max(document.lineCount - 1, 0));
  const max = document.lineCount === 0 ? 0 : document.lineAt(safeLine).text.length;
  return new vscode.Range(safeLine, Math.min(start, max), safeLine, Math.min(Math.max(end, start), max));
};

export const hintStrings = (): HintStrings => ({
  overdue: (days) => vscode.l10n.t("overdue {0}d", days),
  today: vscode.l10n.t("due today"),
  dueIn: (days) => vscode.l10n.t("due in {0}d", days),
  priority: (priority) => `!${priority}`,
});

export const createHighlighter = (
  matchesFor: (uri: string) => readonly TodoMatch[],
  allTags: () => Iterable<string>,
  getSettings: () => TodoForgeSettings,
): Highlighter => {
  let types = new Map<string, TagDecorations>();
  const hintTypes = {
    normal: vscode.window.createTextEditorDecorationType({
      after: { color: new vscode.ThemeColor("todoforge.hintForeground"), margin: "0 0 0 1.5em", fontStyle: "italic" },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    }),
    overdue: vscode.window.createTextEditorDecorationType({
      after: { color: new vscode.ThemeColor("todoforge.overdueForeground"), margin: "0 0 0 1.5em", fontStyle: "italic" },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    }),
    soon: vscode.window.createTextEditorDecorationType({
      after: { color: new vscode.ThemeColor("todoforge.dueSoonForeground"), margin: "0 0 0 1.5em", fontStyle: "italic" },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    }),
  };
  const subscriptions: vscode.Disposable[] = [];

  const rebuildTypes = (): void => {
    disposeDecorations(types.values());
    types = new Map();
    const settings = getSettings();
    if (!settings.highlightingEnabled) {
      return;
    }
    const tags = new Set<string>(settings.tags);
    tags.add("MARKDOWN");
    for (const tag of allTags()) {
      tags.add(tag);
    }
    for (const tag of tags) {
      types.set(tag, createTagDecorations(tag, settings));
    }
  };

  const clear = (editor: vscode.TextEditor): void => {
    for (const entry of types.values()) {
      editor.setDecorations(entry.inline, []);
      if (entry.ruler) {
        editor.setDecorations(entry.ruler, []);
      }
    }
    for (const type of Object.values(hintTypes)) {
      editor.setDecorations(type, []);
    }
  };

  const paintEditor = (editor: vscode.TextEditor): void => {
    const settings = getSettings();
    if (!settings.highlightingEnabled) {
      clear(editor);
      return;
    }
    const matches = matchesFor(editor.document.uri.toString());
    const missing = matches.filter((match) => !types.has(match.tag));
    if (missing.length > 0) {
      for (const match of missing) {
        if (!types.has(match.tag)) {
          types.set(match.tag, createTagDecorations(match.tag, settings));
        }
      }
    }
    let start = 0;
    let end = Math.min(editor.document.lineCount, 200);
    if (editor.visibleRanges.length > 0) {
      start = Number.POSITIVE_INFINITY;
      end = 0;
      for (const range of editor.visibleRanges) {
        start = Math.min(start, range.start.line);
        end = Math.max(end, range.end.line);
      }
    }
    const from = Math.max(0, start - VISIBLE_RANGE_PADDING);
    const to = end + VISIBLE_RANGE_PADDING;
    const planned = splitDecorationRanges(matches, settings.highlightStyle, from, to);
    for (const [tag, entry] of types) {
      editor.setDecorations(
        entry.inline,
        (planned.inline.get(tag) ?? []).map((span) => toRange(span.line, span.start, span.end, editor.document)),
      );
      if (entry.ruler) {
        editor.setDecorations(
          entry.ruler,
          (planned.ruler.get(tag) ?? []).map((span) => toRange(span.line, span.start, span.end, editor.document)),
        );
      }
    }
    const hints: Record<keyof typeof hintTypes, vscode.DecorationOptions[]> = { normal: [], overdue: [], soon: [] };
    if (settings.inlineHints) {
      const today = todayIso();
      const strings = hintStrings();
      for (const match of matches) {
        if (match.line < from || match.line > to || !match.meta) {
          continue;
        }
        const text = hintText(match, today, strings);
        if (!text) {
          continue;
        }
        const tone = dueHint(match, today)?.tone;
        const bucket = tone === "overdue" ? "overdue" : tone === "today" || tone === "soon" ? "soon" : "normal";
        const line = Math.min(match.line, editor.document.lineCount - 1);
        const eol = editor.document.lineAt(line).text.length;
        hints[bucket].push({
          range: new vscode.Range(line, eol, line, eol),
          renderOptions: { after: { contentText: text } },
        });
      }
    }
    for (const [bucket, type] of Object.entries(hintTypes) as [keyof typeof hintTypes, vscode.TextEditorDecorationType][]) {
      editor.setDecorations(type, hints[bucket]);
    }
  };

  const paintAll = (): void => {
    for (const editor of vscode.window.visibleTextEditors) {
      paintEditor(editor);
    }
  };

  subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => paintAll()),
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => paintEditor(event.textEditor)),
  );

  return {
    refresh: (): void => {
      rebuildTypes();
      paintAll();
    },
    paint: paintAll,
    dispose: (): void => {
      disposeDecorations(types.values());
      for (const type of Object.values(hintTypes)) {
        type.dispose();
      }
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    },
  };
};
