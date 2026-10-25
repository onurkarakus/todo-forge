import * as vscode from "vscode";

import { formatStatusText } from "./commands/navigation";
import type { TodoForgeSettings } from "./types";

export interface StatusBar {
  update: (counts: ReadonlyMap<string, number>, scanning: boolean, settings: TodoForgeSettings) => void;
  dispose: () => void;
}

export const createStatusBar = (): StatusBar => {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = "todoforge.tree.focus";
  item.name = "TodoForge";
  return {
    update: (counts, scanning, settings): void => {
      if (!settings.statusbarEnabled) {
        item.hide();
        return;
      }
      item.text = formatStatusText(counts, settings.statusbarFormat, scanning);
      item.tooltip = "Show TodoForge";
      item.show();
    },
    dispose: (): void => {
      item.dispose();
    },
  };
};
