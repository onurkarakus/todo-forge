import * as vscode from "vscode";

import { dueHint } from "../highlighting/hints";
import { todayIso } from "../syntax/metadata";
import type { TodoMatch } from "../types";
import type { Services } from "./services";

const severityOf = (name: string | undefined): vscode.DiagnosticSeverity => {
  switch (name) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    case "hint":
      return vscode.DiagnosticSeverity.Hint;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
};

export interface ProblemsPublisher {
  update: () => void;
  dispose: () => void;
}

/** Optional Problems panel entries. Off by default; overdue TODOs become warnings. */
export const createProblems = (services: Services): ProblemsPublisher => {
  const collection = vscode.languages.createDiagnosticCollection("todoforge");
  const toDiagnostic = (match: TodoMatch, today: string): vscode.Diagnostic => {
    const settings = services.engine.settings;
    let severity = severityOf(settings.problemsSeverity[match.tag]);
    let message = `${match.tag}: ${match.text || match.raw.trim()}`;
    const due = dueHint(match, today);
    if (due?.tone === "overdue") {
      severity = Math.min(severity, vscode.DiagnosticSeverity.Warning);
      message = `${message} (${vscode.l10n.t("overdue {0}d", -due.days)})`;
    }
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(match.line, match.column, match.line, match.endColumn),
      message,
      severity,
    );
    diagnostic.source = "TodoForge";
    diagnostic.code = match.tag;
    return diagnostic;
  };

  const update = (): void => {
    const settings = services.engine.settings;
    collection.clear();
    if (!settings.problemsEnabled) {
      return;
    }
    const today = todayIso();
    const uris =
      settings.problemsScope === "workspace"
        ? new Set(services.engine.index.getAll().map((match) => match.uri))
        : new Set(
            vscode.window.tabGroups.all.flatMap((group) =>
              group.tabs
                .map((tab) => (tab.input instanceof vscode.TabInputText ? tab.input.uri.toString() : undefined))
                .filter((uri): uri is string => uri !== undefined),
            ),
          );
    for (const uri of uris) {
      const matches = services.matchesFor(uri).filter((match) => match.kind !== "markdown");
      if (matches.length > 0) {
        collection.set(
          vscode.Uri.parse(uri),
          matches.map((match) => toDiagnostic(match, today)),
        );
      }
    }
  };

  const tabs = vscode.window.tabGroups.onDidChangeTabs(() => {
    if (services.engine.settings.problemsEnabled && services.engine.settings.problemsScope === "openFiles") {
      update();
    }
  });

  return {
    update,
    dispose: () => {
      tabs.dispose();
      collection.dispose();
    },
  };
};
