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

export const mapTodoTreeSettings = (input: TodoTreeSnapshot): MigrationPatch => {
  const values: Record<string, unknown> = {};
  const ignored: string[] = [];
  const tags = stringArray(input.tags);
  if (tags && tags.length > 0) {
    values["general.tags"] = tags;
  }
  if (Array.isArray(input.tagGroups)) {
    values["general.tagGroups"] = input.tagGroups;
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
    values["regex.custom"] = input.regex;
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
