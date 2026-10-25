import type {
  FontStyleName,
  GroupBy,
  HighlightStyle,
  RulerLane,
  ScanMode,
  StatusBarFormat,
  TagGroup,
  TagStyle,
  TaskStorage,
  TodoForgeSettings,
} from "../types";

export const DEFAULT_TAGS: readonly string[] = [
  "TODO",
  "FIXME",
  "HACK",
  "BUG",
  "NOTE",
  "XXX",
  "REVIEW",
  "OPTIMIZE",
];

export const DEFAULT_EXCLUDE_GLOBS: readonly string[] = [
  "**/bin/**",
  "**/obj/**",
  "**/.vs/**",
  "**/packages/**",
  "**/node_modules/**",
  "**/*.g.cs",
  "**/*.designer.cs",
];

export const DEFAULT_SUBTAG_REGEX = "(?:#(\\d+)|@([\\w-]+))";

export const DEFAULT_LABEL_FORMAT = "${tag}: ${text}";

export const FULL_SCAN_PATH_THRESHOLD = 200;

export const VISIBLE_RANGE_PADDING = 200;

export const DOCUMENT_CHUNK_LINES = 1000;

export const defaultSettings = (): TodoForgeSettings => {
  return {
    tags: [...DEFAULT_TAGS],
    tagGroups: [],
    caseSensitive: false,
    subTagRegex: DEFAULT_SUBTAG_REGEX,
    labelFormat: DEFAULT_LABEL_FORMAT,
    regexCustom: "",
    multiline: false,
    multilineMaxLines: 3,
    scanMode: "workspace",
    includeGlobs: [],
    excludeGlobs: [...DEFAULT_EXCLUDE_GLOBS],
    useGitignore: true,
    useVsCodeExcludes: true,
    maxFileSizeKb: 1024,
    debounceMs: 400,
    autoRefreshIntervalSec: 0,
    refreshOnGitHeadChange: true,
    highlightingEnabled: true,
    highlightStyle: "tag",
    tagStyles: {},
    groupBy: "tag",
    showActivityBadge: true,
    tasksEnabled: true,
    tasksStorage: "workspaceState",
    updateSourceOnDone: false,
    markdownEnabled: true,
    markdownGroupSeparately: true,
    codelensEnabled: false,
    statusbarEnabled: true,
    statusbarFormat: "perTag",
    migrateFromTodoTree: true,
  };
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
};

const readTagGroups = (value: unknown): TagGroup[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const groups: TagGroup[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== "string" || !isStringArray(record.tags)) {
      continue;
    }
    groups.push({ name: record.name, tags: record.tags.filter((tag) => tag.length > 0) });
  }
  return groups;
};

const readTagStyles = (value: unknown): Record<string, TagStyle> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const styles: Record<string, TagStyle> = {};
  for (const [tag, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const record = raw as Record<string, unknown>;
    const style: TagStyle = {};
    if (typeof record.foreground === "string") {
      style.foreground = record.foreground;
    }
    if (typeof record.background === "string") {
      style.background = record.background;
    }
    if (typeof record.icon === "string") {
      style.icon = record.icon;
    }
    const ruler = oneOf<RulerLane>(
      record.ruler,
      ["off", "right", "center", "left", "full"],
      "right",
    );
    if (typeof record.ruler === "string") {
      style.ruler = ruler;
    }
    const fontStyle = oneOf<FontStyleName>(
      record.fontStyle,
      ["normal", "italic", "bold", "underline"],
      "normal",
    );
    if (typeof record.fontStyle === "string") {
      style.fontStyle = fontStyle;
    }
    styles[tag] = style;
  }
  return styles;
};

export const settingsFromValues = (
  values: Record<string, unknown>,
): { settings: TodoForgeSettings; errors: string[] } => {
  const defaults = defaultSettings();
  const errors: string[] = [];
  const tags = isStringArray(values["general.tags"])
    ? values["general.tags"].map((tag) => tag.trim()).filter((tag) => tag.length > 0)
    : defaults.tags;
  if (tags.length === 0) {
    errors.push("todoforge.general.tags is empty. Built-in tags are in use.");
  }

  const maxLines = values["regex.multilineMaxLines"];
  const multilineMaxLines =
    typeof maxLines === "number" && maxLines >= 1 && maxLines <= 10
      ? Math.floor(maxLines)
      : defaults.multilineMaxLines;

  const maxFile = values["scanning.maxFileSizeKb"];
  const debounce = values["scanning.debounceMs"];
  const interval = values["scanning.autoRefreshIntervalSec"];

  const settings: TodoForgeSettings = {
    tags: tags.length > 0 ? tags : defaults.tags,
    tagGroups: readTagGroups(values["general.tagGroups"]),
    caseSensitive: values["general.caseSensitive"] === true,
    subTagRegex:
      typeof values["general.subTagRegex"] === "string"
        ? values["general.subTagRegex"]
        : defaults.subTagRegex,
    labelFormat:
      typeof values["general.labelFormat"] === "string" && values["general.labelFormat"].length > 0
        ? values["general.labelFormat"]
        : defaults.labelFormat,
    regexCustom: typeof values["regex.custom"] === "string" ? values["regex.custom"] : "",
    multiline: values["regex.multiline"] === true,
    multilineMaxLines,
    scanMode: oneOf<ScanMode>(
      values["scanning.mode"],
      ["workspace", "openFiles", "currentFile", "workspaceAndOpen"],
      defaults.scanMode,
    ),
    includeGlobs: isStringArray(values["scanning.includeGlobs"])
      ? values["scanning.includeGlobs"]
      : [],
    excludeGlobs: isStringArray(values["scanning.excludeGlobs"])
      ? values["scanning.excludeGlobs"]
      : defaults.excludeGlobs,
    useGitignore: values["scanning.useGitignore"] !== false,
    useVsCodeExcludes: values["scanning.useVsCodeExcludes"] !== false,
    maxFileSizeKb:
      typeof maxFile === "number" && maxFile >= 1 ? Math.floor(maxFile) : defaults.maxFileSizeKb,
    debounceMs:
      typeof debounce === "number" && debounce >= 50 ? Math.floor(debounce) : defaults.debounceMs,
    autoRefreshIntervalSec:
      typeof interval === "number" && interval >= 0
        ? Math.floor(interval)
        : defaults.autoRefreshIntervalSec,
    refreshOnGitHeadChange: values["scanning.refreshOnGitHeadChange"] !== false,
    highlightingEnabled: values["highlighting.enabled"] !== false,
    highlightStyle: oneOf<HighlightStyle>(
      values["highlighting.style"],
      ["tag", "comment", "line"],
      defaults.highlightStyle,
    ),
    tagStyles: readTagStyles(values["highlighting.tags"]),
    groupBy: oneOf<GroupBy>(
      values["tree.groupBy"],
      ["file", "tag", "subtag", "flat"],
      defaults.groupBy,
    ),
    showActivityBadge: values["tree.showActivityBadge"] !== false,
    tasksEnabled: values["tasks.enabled"] !== false,
    tasksStorage: oneOf<TaskStorage>(
      values["tasks.storage"],
      ["workspaceState", "workspaceFile"],
      defaults.tasksStorage,
    ),
    updateSourceOnDone: values["tasks.updateSourceOnDone"] === true,
    markdownEnabled: values["markdown.enabled"] !== false,
    markdownGroupSeparately: values["markdown.groupSeparately"] !== false,
    codelensEnabled: values["codelens.enabled"] === true,
    statusbarEnabled: values["statusbar.enabled"] !== false,
    statusbarFormat: oneOf<StatusBarFormat>(
      values["statusbar.format"],
      ["perTag", "total"],
      defaults.statusbarFormat,
    ),
    migrateFromTodoTree: values["migrateFromTodoTree"] !== false,
  };

  return { settings, errors };
};
