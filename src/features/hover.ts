import * as vscode from "vscode";

import type { Services } from "./services";
import { todoCard } from "./todoCard";

/** Hover card over a TODO with metadata, blame and one-click actions. */
export const registerHover = (services: Services): vscode.Disposable => {
  return vscode.languages.registerHoverProvider(
    [{ scheme: "file" }, { scheme: "untitled" }],
    {
      provideHover: async (document, position) => {
        const match = services
          .matchesFor(document.uri.toString())
          .find(
            (item) =>
              item.line === position.line && position.character >= item.column && position.character <= item.endColumn,
          );
        if (!match) {
          return undefined;
        }
        if (services.git.available && services.engine.settings.blameMode !== "off") {
          await Promise.race([
            services.git.blameOne(match),
            new Promise((resolve) => setTimeout(resolve, 600)),
          ]);
        }
        return new vscode.Hover(
          todoCard(match, services.card(match, true)),
          new vscode.Range(match.line, match.column, match.line, match.endColumn),
        );
      },
    },
  );
};
