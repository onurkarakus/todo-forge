import * as vscode from "vscode";

import type { TodoMatch } from "../types";

/** Optional CodeLens above each TODO (off by default): Pin and Snooze. */
export const createCodeLensProvider = (
  matchesFor: (uri: string) => readonly TodoMatch[],
  isPinned: (match: TodoMatch) => boolean,
  onDidChangeCodeLenses: vscode.Event<void>,
): vscode.CodeLensProvider => {
  return {
    onDidChangeCodeLenses,
    provideCodeLenses: (document: vscode.TextDocument): vscode.CodeLens[] => {
      const lenses: vscode.CodeLens[] = [];
      for (const match of matchesFor(document.uri.toString())) {
        if (match.kind !== "tag") {
          continue;
        }
        const range = new vscode.Range(match.line, match.column, match.line, match.endColumn);
        const pinned = isPinned(match);
        lenses.push(
          new vscode.CodeLens(range, {
            title: pinned ? `$(pinned) ${vscode.l10n.t("Unpin")}` : `$(pin) ${vscode.l10n.t("Pin")}`,
            command: pinned ? "todoforge.unpin" : "todoforge.pin",
            arguments: [match.id],
          }),
          new vscode.CodeLens(range, {
            title: `$(clock) ${vscode.l10n.t("Snooze 1 week")}`,
            command: "todoforge.snooze",
            arguments: [match.id, 7],
          }),
        );
      }
      return lenses;
    },
  };
};
