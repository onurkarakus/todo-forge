import * as vscode from "vscode";

import {
  mergeTags,
  parseRiderDotSettings,
  parseVisualStudioSettings,
  RIDER_DEFAULT_TAGS,
  VISUAL_STUDIO_DEFAULT_TAGS,
} from "../config/importers";
import { mapTodoTreeSettings, type MigrationPatch } from "../config/migration";
import { updateSetting, userValue } from "../config/settings";
import { logInfo } from "../logger";

/** Reads only Todo Tree values the user changed; Todo Tree defaults are never copied. */
export const todoTreePatch = (): MigrationPatch => {
  return mapTodoTreeSettings({
    tags: userValue("todo-tree", "general.tags"),
    tagGroups: userValue("todo-tree", "general.tagGroups"),
    excludeGlobs: userValue("todo-tree", "filtering.excludeGlobs"),
    includeGlobs: userValue("todo-tree", "filtering.includeGlobs"),
    regex: userValue("todo-tree", "regex.regex"),
    caseSensitive: userValue("todo-tree", "regex.regexCaseSensitive"),
    customHighlight: userValue("todo-tree", "highlights.customHighlight"),
  });
};

const describe = (values: Record<string, unknown>): string => {
  return Object.entries(values)
    .map(([key, value]) => `todoforge.${key} = ${JSON.stringify(value)}`)
    .join("\n");
};

const confirmAndWrite = async (source: string, values: Record<string, unknown>, ignored: string[] = []): Promise<boolean> => {
  if (Object.keys(values).length === 0) {
    void vscode.window.showInformationMessage(vscode.l10n.t("{0}: nothing to import.", source));
    return false;
  }
  const apply = vscode.l10n.t("Import");
  const choice = await vscode.window.showInformationMessage(
    vscode.l10n.t("Import settings from {0}?", source),
    { modal: true, detail: `${describe(values)}\n\n${vscode.l10n.t("Written to your user settings.")}` },
    apply,
  );
  if (choice !== apply) {
    return false;
  }
  for (const [key, value] of Object.entries(values)) {
    await updateSetting(key, value);
  }
  logInfo(`Imported settings from ${source}. Not mapped: ${ignored.join(", ") || "none"}`);
  void vscode.window.showInformationMessage(vscode.l10n.t("Imported {0} settings from {1}.", Object.keys(values).length, source));
  return true;
};

const pickFile = async (label: string, extensions: string[]): Promise<string | undefined> => {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: label,
    filters: { [label]: extensions, [vscode.l10n.t("All files")]: ["*"] },
  });
  const uri = picked?.[0];
  if (!uri) {
    return undefined;
  }
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString("utf8");
};

/** One command for all importers: Todo Tree, JetBrains Rider/ReSharper and Visual Studio. */
export const importSettings = async (currentTags: readonly string[]): Promise<void> => {
  type Source = vscode.QuickPickItem & { id: string };
  const items: Source[] = [
    { id: "todoTree", label: "$(list-tree) Todo Tree", description: vscode.l10n.t("from your current VS Code settings") },
    { id: "rider", label: "$(file) JetBrains Rider / ReSharper", description: vscode.l10n.t("from a .DotSettings file") },
    { id: "vs", label: "$(file) Visual Studio", description: vscode.l10n.t("from a .vssettings export") },
    { id: "vsDefaults", label: "$(add) Visual Studio defaults", description: VISUAL_STUDIO_DEFAULT_TAGS.join(", ") },
    { id: "riderDefaults", label: "$(add) Rider defaults", description: RIDER_DEFAULT_TAGS.join(", ") },
  ];
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: vscode.l10n.t("Import TODO settings from…"),
  });
  if (!picked) {
    return;
  }
  if (picked.id === "todoTree") {
    const patch = todoTreePatch();
    await confirmAndWrite("Todo Tree", patch.values, patch.ignored);
    return;
  }
  if (picked.id === "vsDefaults" || picked.id === "riderDefaults") {
    const extra = picked.id === "vsDefaults" ? VISUAL_STUDIO_DEFAULT_TAGS : RIDER_DEFAULT_TAGS;
    await confirmAndWrite(picked.label.replace(/^\$\([^)]*\)\s*/, ""), { "general.tags": mergeTags(currentTags, extra) });
    return;
  }
  const rider = picked.id === "rider";
  const text = await pickFile(rider ? "DotSettings" : "vssettings", rider ? ["DotSettings"] : ["vssettings", "xml"]);
  if (text === undefined) {
    return;
  }
  const tags = rider ? parseRiderDotSettings(text) : parseVisualStudioSettings(text);
  if (tags.length === 0) {
    void vscode.window.showWarningMessage(vscode.l10n.t("No TODO tokens were found in that file."));
    return;
  }
  await confirmAndWrite(rider ? "Rider" : "Visual Studio", { "general.tags": mergeTags(currentTags, tags) });
};
