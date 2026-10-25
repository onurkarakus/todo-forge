import * as vscode from "vscode";

import type { TodoForgeSettings } from "../types";
import { settingsFromValues } from "./defaults";

export const SETTING_KEYS = [
  "general.tags",
  "general.tagGroups",
  "general.caseSensitive",
  "general.subTagRegex",
  "general.labelFormat",
  "regex.custom",
  "regex.multiline",
  "regex.multilineMaxLines",
  "scanning.mode",
  "scanning.includeGlobs",
  "scanning.excludeGlobs",
  "scanning.useGitignore",
  "scanning.useVsCodeExcludes",
  "scanning.maxFileSizeKb",
  "scanning.debounceMs",
  "scanning.autoRefreshIntervalSec",
  "scanning.refreshOnGitHeadChange",
  "highlighting.enabled",
  "highlighting.style",
  "highlighting.tags",
  "tree.groupBy",
  "tree.showActivityBadge",
  "tasks.enabled",
  "tasks.storage",
  "tasks.updateSourceOnDone",
  "markdown.enabled",
  "markdown.groupSeparately",
  "codelens.enabled",
  "statusbar.enabled",
  "statusbar.format",
  "migrateFromTodoTree",
] as const;

export const readSettings = (): { settings: TodoForgeSettings; errors: string[] } => {
  const config = vscode.workspace.getConfiguration("todoforge");
  const values: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    values[key] = config.get(key);
  }
  return settingsFromValues(values);
};

export const userHasConfiguredTodoForge = (): boolean => {
  const config = vscode.workspace.getConfiguration("todoforge");
  return SETTING_KEYS.some((key) => {
    const inspected = config.inspect(key);
    return (
      inspected?.globalValue !== undefined ||
      inspected?.workspaceValue !== undefined ||
      inspected?.workspaceFolderValue !== undefined
    );
  });
};

export const updateSetting = async (key: string, value: unknown): Promise<void> => {
  const target = vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  await vscode.workspace.getConfiguration("todoforge").update(key, value, target);
};

export const configurationTarget = (): vscode.ConfigurationTarget => {
  return vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
};
