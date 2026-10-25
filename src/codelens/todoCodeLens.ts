import * as vscode from "vscode";

import type { IndexStore } from "../scanning/indexStore";
import type { TodoForgeSettings } from "../types";

export const createCodeLensProvider = (
  index: IndexStore,
  getSettings: () => TodoForgeSettings,
  onDidChangeCodeLenses: vscode.Event<void>,
): vscode.CodeLensProvider => {
  return {
    onDidChangeCodeLenses,
    provideCodeLenses: (document: vscode.TextDocument): vscode.CodeLens[] => {
      if (!getSettings().codelensEnabled) {
        return [];
      }
      const lenses: vscode.CodeLens[] = [];
      for (const match of index.getFile(document.uri.toString())) {
        if (match.kind !== "tag") {
          continue;
        }
        const range = new vscode.Range(match.line, match.column, match.line, match.endColumn);
        lenses.push(
          new vscode.CodeLens(range, {
            title: "Track as Task",
            command: "todoforge.trackAsTask",
            arguments: [match.id],
          }),
          new vscode.CodeLens(range, {
            title: "Copy",
            command: "todoforge.copy",
            arguments: [match.id],
          }),
        );
      }
      return lenses;
    },
  };
};
