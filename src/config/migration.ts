import { ensureTagGroup } from "../utils/regexBuilder";

/** Only values the user set. Built-in Todo Tree defaults are never copied. */
export interface TodoTreeSnapshot {
  tags?: unknown;
  tagGroups?: unknown;
  excludeGlobs?: unknown;
  includeGlobs?: unknown;
  regex?: unknown;
  caseSensitive?: unknown;
  customHighlight?: unknown;
}

export interface MigrationPatch {
  values: Record<string, unknown>;
  ignored: string[];
}

const stringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return undefined;
  }
  return value;
};

const tagGroupsOf = (value: unknown): { name: string; tags: string[] }[] | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is { name: string; tags: string[] } =>
        Boolean(entry) && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string",
    );
  }
  // Todo Tree stores tag groups as { "Group name": ["TAG", ...] }.
  return Object.entries(value as Record<string, unknown>)
    .map(([name, tags]) => ({ name, tags: stringArray(tags) ?? [] }))
    .filter((group) => group.tags.length > 0);
};

export const mapTodoTreeSettings = (input: TodoTreeSnapshot): MigrationPatch => {
  const values: Record<string, unknown> = {};
  const ignored: string[] = [];
  const tags = stringArray(input.tags);
  if (tags && tags.length > 0) {
    values["general.tags"] = tags;
  }
  const groups = tagGroupsOf(input.tagGroups);
  if (groups && groups.length > 0) {
    values["general.tagGroups"] = groups;
  }
  const excludeGlobs = stringArray(input.excludeGlobs);
  if (excludeGlobs) {
    values["scanning.excludeGlobs"] = excludeGlobs;
  }
  const includeGlobs = stringArray(input.includeGlobs);
  if (includeGlobs) {
    values["scanning.includeGlobs"] = includeGlobs;
  }
  if (typeof input.regex === "string" && input.regex.trim().length > 0) {
    values["regex.custom"] = ensureTagGroup(input.regex);
  }
  if (typeof input.caseSensitive === "boolean") {
    values["general.caseSensitive"] = input.caseSensitive;
  }
  if (input.customHighlight && typeof input.customHighlight === "object") {
    values["highlighting.tags"] = input.customHighlight;
  }
  ignored.push(
    "todo-tree.regex.regexMatches",
    "todo-tree.general.statusBar",
    "todo-tree.tree.*",
    "todo-tree.highlights.defaultHighlight",
  );
  return { values, ignored };
};
