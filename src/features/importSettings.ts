import * as vscode from "vscode";

import {
  mapBetterCommentsTags,
  mergeTags,
  parseRiderDotSettings,
  parseVisualStudioSettings,
  RIDER_DEFAULT_TAGS,
  VISUAL_STUDIO_DEFAULT_TAGS,
} from "../config/importers";
import { mapTodoTreeSettings, type MigrationPatch, type TodoTreeSnapshot } from "../config/migration";
import { updateSetting, userValue } from "../config/settings";
import { logInfo } from "../logger";

const snapshotFrom = (section: string): TodoTreeSnapshot => ({
  tags: userValue(section, "general.tags"),
  tagGroups: userValue(section, "general.tagGroups"),
  excludeGlobs: userValue(section, "filtering.excludeGlobs"),
  includeGlobs: userValue(section, "filtering.includeGlobs"),
  regex: userValue(section, "regex.regex"),
  caseSensitive: userValue(section, "regex.regexCaseSensitive"),
  customHighlight: userValue(section, "highlights.customHighlight"),
  subTagClickUrl: userValue(section, "tree.subTagClickUrl"),
});

const firstDefined = (preferred: unknown, fallback: unknown): unknown => {
  return preferred !== undefined ? preferred : fallback;
};

/** Reads only Todo Tree values the user changed; Todo Tree defaults are never copied. */
export const todoTreePatch = (): MigrationPatch => {
  return mapTodoTreeSettings(snapshotFrom("todo-tree"));
};

/** Better Todo Tree (`better-todo-tree.*`), with a fallback to leftover `todo-tree.*` keys. */
export const betterTodoTreePatch = (): MigrationPatch => {
  const current = snapshotFrom("better-todo-tree");
  const legacy = snapshotFrom("todo-tree");
  return mapTodoTreeSettings({
    tags: firstDefined(current.tags, legacy.tags),
    tagGroups: firstDefined(current.tagGroups, legacy.tagGroups),
    excludeGlobs: firstDefined(current.excludeGlobs, legacy.excludeGlobs),
    includeGlobs: firstDefined(current.includeGlobs, legacy.includeGlobs),
    regex: firstDefined(current.regex, legacy.regex),
    caseSensitive: firstDefined(current.caseSensitive, legacy.caseSensitive),
    customHighlight: firstDefined(current.customHighlight, legacy.customHighlight),
    subTagClickUrl: firstDefined(current.subTagClickUrl, legacy.subTagClickUrl),
  });
};

const firstUserArray = (candidates: readonly [string, string][]): unknown => {
  for (const [section, key] of candidates) {
    const value = userValue(section, key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
};

export const betterCommentsPatch = (todoTags: readonly string[], preferred: "better-comments" | "better-comments-next" = "better-comments"): MigrationPatch => {
  const tags = firstUserArray(
    preferred === "better-comments-next"
      ? [
          ["better-comments-next", "tags"],
          ["betterCommentsNext", "tags"],
          ["better-comments", "tags"],
        ]
      : [
          ["better-comments", "tags"],
          ["better-comments-next", "tags"],
          ["betterCommentsNext", "tags"],
        ],
  );
  const mapped = mapBetterCommentsTags(tags, todoTags);
  const values: Record<string, unknown> = {};
  if (mapped.markers.length > 0) {
    values["commentMarkers.tags"] = mapped.markers;
    values["commentMarkers.enabled"] = true;
  }
  return { values, ignored: mapped.ignored };
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
    { id: "betterTodoTree", label: "$(list-tree) Better Todo Tree", description: vscode.l10n.t("from your current VS Code settings") },
    { id: "betterComments", label: "$(comment) Better Comments", description: vscode.l10n.t("from your current VS Code settings") },
    { id: "betterCommentsNext", label: "$(comment) Better Comments Next", description: vscode.l10n.t("from your current VS Code settings") },
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
  if (picked.id === "betterTodoTree") {
    const patch = betterTodoTreePatch();
    await confirmAndWrite("Better Todo Tree", patch.values, patch.ignored);
    return;
  }
  if (picked.id === "betterComments" || picked.id === "betterCommentsNext") {
    const source = picked.id === "betterComments" ? "Better Comments" : "Better Comments Next";
    const patch = betterCommentsPatch(currentTags, picked.id === "betterCommentsNext" ? "better-comments-next" : "better-comments");
    await confirmAndWrite(source, patch.values, patch.ignored);
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
