import { randomBytes } from "node:crypto";
import * as vscode from "vscode";

import { buildInsights } from "../insights/model";
import { renderInsightsHtml, type InsightsStrings } from "../insights/render";
import { todayIso } from "../syntax/metadata";
import { formatAge } from "../tree/query";
import type { TodoMatch } from "../types";
import type { Services } from "./services";

const strings = (): InsightsStrings => ({
  title: vscode.l10n.t("TodoForge Insights"),
  total: vscode.l10n.t("TODOs"),
  files: vscode.l10n.t("Files"),
  overdue: vscode.l10n.t("Overdue"),
  stale: vscode.l10n.t("Stale"),
  newOnBranch: vscode.l10n.t("New on this branch"),
  byTag: vscode.l10n.t("By tag"),
  byFolder: vscode.l10n.t("By folder"),
  byOwner: vscode.l10n.t("By owner"),
  ages: vscode.l10n.t("Age (from git blame)"),
  agesUnavailable: vscode.l10n.t("Age needs a local git repository. Blame is read on your machine only."),
  overdueList: vscode.l10n.t("Overdue"),
  oldestList: vscode.l10n.t("Oldest TODOs"),
  empty: vscode.l10n.t("No TODOs in this workspace."),
  privacy: vscode.l10n.t("Computed locally from your workspace and local git. Nothing leaves this machine."),
});

const ageLabels = (): string[] => [
  vscode.l10n.t("< 1 week"),
  vscode.l10n.t("< 1 month"),
  vscode.l10n.t("< 3 months"),
  vscode.l10n.t("< 6 months"),
  vscode.l10n.t("< 1 year"),
  vscode.l10n.t("1 year +"),
];

/** A local dashboard: counts by tag, folder and owner, age histogram, overdue and oldest TODOs. */
export const createInsightsPanel = (
  services: Services,
  visibleMatches: () => readonly TodoMatch[],
  openMatch: (id: string) => Promise<void>,
): { show: () => Promise<void>; update: () => void; dispose: () => void } => {
  let panel: vscode.WebviewPanel | undefined;
  let rendering = false;

  const render = (): void => {
    if (!panel) {
      return;
    }
    const settings = services.engine.settings;
    const matches = visibleMatches();
    const data = buildInsights({
      matches,
      today: todayIso(),
      nowSeconds: Date.now() / 1000,
      staleAfterDays: settings.staleAfterDays,
      blameOf: services.git.blameOf,
      isNew: services.git.isNew,
      ageLabels: ageLabels(),
      formatAge,
      markdownLabel: vscode.l10n.t("Checklist"),
    });
    const nonce = randomBytes(16).toString("base64");
    panel.webview.html = renderInsightsHtml(data, strings(), { nonce, cspSource: panel.webview.cspSource });
  };

  const show = async (): Promise<void> => {
    if (panel) {
      panel.reveal();
    } else {
      panel = vscode.window.createWebviewPanel("todoforge.insights", vscode.l10n.t("TodoForge Insights"), vscode.ViewColumn.Active, {
        enableScripts: true,
        localResourceRoots: [],
        retainContextWhenHidden: false,
      });
      panel.webview.onDidReceiveMessage((message: unknown) => {
        if (message && typeof message === "object" && (message as { type?: string }).type === "open") {
          const id = (message as { id?: unknown }).id;
          if (typeof id === "string") {
            void openMatch(id);
          }
        }
      });
      panel.onDidDispose(() => {
        panel = undefined;
      });
    }
    render();
    if (rendering || !services.git.available || services.engine.settings.blameMode === "off") {
      return;
    }
    rendering = true;
    try {
      await vscode.window.withProgress(
        { location: { viewId: "todoforge.tree" }, title: vscode.l10n.t("Reading git blame…") },
        () => services.git.ensureBlame(visibleMatches()),
      );
      render();
    } finally {
      rendering = false;
    }
  };

  return {
    show,
    update: () => {
      if (panel?.visible) {
        render();
      }
    },
    dispose: () => panel?.dispose(),
  };
};
