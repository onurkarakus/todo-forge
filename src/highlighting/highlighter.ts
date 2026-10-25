import * as vscode from "vscode";

import type { IndexStore } from "../scanning/indexStore";
import type { TodoForgeSettings } from "../types";
import { VISIBLE_RANGE_PADDING } from "../config/defaults";
import { splitDecorationRanges } from "./rangePlan";
import { createTagDecorations, disposeDecorations, type TagDecorations } from "./decorationFactory";

export interface Highlighter {
  refresh: () => void;
  paint: () => void;
  dispose: () => void;
}

const toRange = (line: number, start: number, end: number, document: vscode.TextDocument): vscode.Range => {
  const safeLine = Math.min(line, Math.max(document.lineCount - 1, 0));
  const max = document.lineCount === 0 ? 0 : document.lineAt(safeLine).text.length;
  return new vscode.Range(safeLine, Math.min(start, max), safeLine, Math.min(Math.max(end, start), max));
};

export const createHighlighter = (
  index: IndexStore,
  getSettings: () => TodoForgeSettings,
): Highlighter => {
  let types = new Map<string, TagDecorations>();
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
    for (const match of index.getAll()) {
      tags.add(match.tag);
    }
    for (const tag of tags) {
      types.set(tag, createTagDecorations(tag, settings));
    }
  };

  const paint = (editor: vscode.TextEditor): void => {
    const settings = getSettings();
    const uri = editor.document.uri.toString();
    if (!settings.highlightingEnabled) {
      for (const entry of types.values()) {
        editor.setDecorations(entry.inline, []);
        if (entry.ruler) {
          editor.setDecorations(entry.ruler, []);
        }
      }
      return;
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
    const planned = splitDecorationRanges(
      index.getFile(uri),
      settings.highlightStyle,
      Math.max(0, start - VISIBLE_RANGE_PADDING),
      end + VISIBLE_RANGE_PADDING,
    );
    for (const [tag, entry] of types) {
      const inline = (planned.inline.get(tag) ?? []).map((span) =>
        toRange(span.line, span.start, span.end, editor.document),
      );
      const ruler = (planned.ruler.get(tag) ?? []).map((span) =>
        toRange(span.line, span.start, span.end, editor.document),
      );
      editor.setDecorations(entry.inline, inline);
      if (entry.ruler) {
        editor.setDecorations(entry.ruler, ruler);
      }
    }
  };

  const paintAll = (): void => {
    for (const editor of vscode.window.visibleTextEditors) {
      paint(editor);
    }
  };

  const refresh = (): void => {
    paintAll();
  };

  subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => paintAll()),
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => paint(event.textEditor)),
  );

  return {
    refresh: (): void => {
      rebuildTypes();
      paintAll();
    },
    paint: refresh,
    dispose: (): void => {
      disposeDecorations(types.values());
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    },
  };
};
