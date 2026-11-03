import * as vscode from "vscode";

import type { StatusBarFormat } from "../types";
import { statusText, type StatusSummary } from "./statusText";

export { summarize } from "./statusText";

export interface StatusBar {
  update: (summary: StatusSummary, format: StatusBarFormat, scanning: boolean, enabled: boolean) => void;
  dispose: () => void;
}

export const createStatusBar = (): StatusBar => {
  const item = vscode.window.createStatusBarItem("todoforge.status", vscode.StatusBarAlignment.Left, 50);
  item.name = "TodoForge";
  item.command = "todoforge.statusBarClick";
  return {
    update: (summary, format, scanning, enabled): void => {
      if (!enabled) {
        item.hide();
        return;
      }
      item.text = statusText(summary, format, scanning);
      const tooltip = new vscode.MarkdownString(undefined, true);
      tooltip.supportThemeIcons = true;
      tooltip.appendMarkdown(`**TodoForge**\n\n`);
      if (summary.hasFile) {
        tooltip.appendMarkdown(`${vscode.l10n.t("This file: {0}", summary.fileCount)}  \n`);
      }
      tooltip.appendMarkdown(`${vscode.l10n.t("Workspace: {0}", summary.total)}  \n`);
      if (summary.overdue > 0) {
        tooltip.appendMarkdown(`$(warning) ${vscode.l10n.t("Overdue: {0}", summary.overdue)}  \n`);
      }
      if (summary.byTag.length > 0) {
        tooltip.appendMarkdown(`\n${summary.byTag.map(([tag, count]) => `\`${tag}\` ${count}`).join(" · ")}\n`);
      }
      tooltip.appendMarkdown(`\n${vscode.l10n.t("Click to jump to a TODO in this file.")}`);
      item.tooltip = tooltip;
      item.accessibilityInformation = {
        label: vscode.l10n.t("TodoForge: {0} TODOs in this file, {1} in the workspace", summary.fileCount, summary.total),
      };
      item.backgroundColor = undefined;
      item.show();
    },
    dispose: (): void => item.dispose(),
  };
};
