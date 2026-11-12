import * as vscode from "vscode";

import type { TodoForgeSettings } from "../types";
import { settingsFromValues } from "./defaults";

export const SETTING_KEYS = [
  "general.tags",
  "general.strictTags",
  "general.tagGroups",
  "general.caseSensitive",
  "general.subTagRegex",
  "general.ticketUrl",
  "general.labelFormat",
  "regex.custom",
  "regex.multiline",
  "regex.multilineMaxLines",
  "dotnet.codePatterns",
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
  "highlighting.inlineHints",
  "highlighting.tags",
  "highlighting.gutterIcons",
  "highlighting.opacity",
  "highlighting.border",
  "commentMarkers.enabled",
  "commentMarkers.tags",
  "commentMarkers.multiline",
  "tree.groupBy",
  "tree.sortBy",
  "tree.showActivityBadge",
  "tree.autoReveal",
  "markdown.enabled",
  "markdown.groupSeparately",
  "codelens.enabled",
  "statusbar.enabled",
  "statusbar.format",
  "problems.enabled",
  "problems.scope",
  "problems.severity",
  "syntax.owner",
  "stale.afterDays",
  "git.enabled",
  "git.baseBranch",
  "git.blame",
  "ai.enabled",
  "ai.chatTools",
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

/** View preferences (group, sort, scan mode) are personal, so they go to user settings. */
export const updateSetting = async (
  key: string,
  value: unknown,
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global,
): Promise<void> => {
  await vscode.workspace.getConfiguration("todoforge").update(key, value, target);
};

/** Reads only values a user set for `section.key`, never extension defaults. */
export const userValue = (section: string, key: string): unknown => {
  const inspected = vscode.workspace.getConfiguration(section).inspect(key);
  return inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
};
