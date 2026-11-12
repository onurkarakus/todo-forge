import type {
  BlameMode,
  CommentMarker,
  FontStyleName,
  GroupBy,
  HighlightStyle,
  ProblemsScope,
  RulerLane,
  ScanMode,
  SortBy,
  StatusBarFormat,
  TagGroup,
  TagStyle,
  TodoForgeSettings,
} from "../types";

export const DEFAULT_TAGS: readonly string[] = [
  "TODO",
  "FIXME",
  "HACK",
  "BUG",
  "XXX",
  "UNDONE",
  "NOTE",
  "REVIEW",
  "OPTIMIZE",
];

/** Words common in ordinary prose; they only count with a colon or parentheses. */
export const DEFAULT_STRICT_TAGS: readonly string[] = ["NOTE", "BUG", "REVIEW", "OPTIMIZE"];

/** Tags produced by the .NET code patterns. */
export const DOTNET_TAGS: readonly string[] = ["NotImplemented", "Obsolete", "Warning"];

export const DEFAULT_EXCLUDE_GLOBS: readonly string[] = [
  "**/bin/**",
  "**/obj/**",
  "**/.vs/**",
  "**/node_modules/**",
  "**/packages/*.*.*/**",
  "**/*.g.cs",
  "**/*.g.i.cs",
  "**/*.designer.cs",
  "**/*.min.*",
];

export const DEFAULT_SUBTAG_REGEX = "(?:#(\\d+)|@([\\w-]+))";

export const DEFAULT_LABEL_FORMAT = "${tag}: ${text}";

/** Better Comments-style markers. They decorate the editor only, never the tree. */
export const DEFAULT_COMMENT_MARKERS: readonly CommentMarker[] = [
  { tag: "!", bold: true },
  { tag: "?" },
  { tag: "*" },
  { tag: "//", strikethrough: true },
];


export const FULL_SCAN_PATH_THRESHOLD = 200;

export const VISIBLE_RANGE_PADDING = 200;

export const DOCUMENT_CHUNK_LINES = 1000;

export const LIVE_EDIT_DEBOUNCE_MS = 300;

export const DEFAULT_PROBLEMS_SEVERITY: Readonly<Record<string, string>> = {
  FIXME: "warning",
  BUG: "warning",
  XXX: "warning",
  NotImplemented: "warning",
};

export const defaultSettings = (): TodoForgeSettings => {
  return {
    tags: [...DEFAULT_TAGS],
    strictTags: [...DEFAULT_STRICT_TAGS],
    tagGroups: [],
    caseSensitive: true,
    subTagRegex: DEFAULT_SUBTAG_REGEX,
    labelFormat: DEFAULT_LABEL_FORMAT,
    regexCustom: "",
    multiline: false,
    multilineMaxLines: 3,
    dotnetPatterns: true,
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
    inlineHints: true,
    tagStyles: {},
    groupBy: "tag",
    sortBy: "location",
    showActivityBadge: true,
    markdownEnabled: true,
    markdownGroupSeparately: true,
    codelensEnabled: false,
    statusbarEnabled: true,
    statusbarFormat: "compact",
    problemsEnabled: false,
    problemsScope: "openFiles",
    problemsSeverity: { ...DEFAULT_PROBLEMS_SEVERITY },
    owner: "",
    staleAfterDays: 180,
    gitEnabled: true,
    gitBaseBranch: "",
    blameMode: "onDemand",
    aiEnabled: false,
    chatTools: false,
    migrateFromTodoTree: true,
    ticketUrl: "",
    commentMarkersEnabled: true,
    commentMarkers: DEFAULT_COMMENT_MARKERS.map((marker) => ({ ...marker })),
    commentMarkersMultiline: true,
    highlightGutterIcons: true,
    highlightOpacity: 1,
    highlightBorder: false,
    autoReveal: true,
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
    if (typeof record.ruler === "string") {
      style.ruler = oneOf<RulerLane>(record.ruler, ["off", "right", "center", "left", "full"], "right");
    }
    if (typeof record.fontStyle === "string") {
      style.fontStyle = oneOf<FontStyleName>(record.fontStyle, ["normal", "italic", "bold", "underline"], "normal");
    }
    if (record.hideFromTree === true) {
      style.hideFromTree = true;
    }
    if (typeof record.opacity === "number" && Number.isFinite(record.opacity)) {
      style.opacity = Math.min(1, Math.max(0, record.opacity));
    }
    if (typeof record.border === "string") {
      style.border = record.border;
    } else if (record.border === true || record.border === false) {
      style.border = record.border;
    }
    styles[tag] = style;
  }
  return styles;
};

const readSeverity = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_PROBLEMS_SEVERITY };
  }
  const result: Record<string, string> = {};
  for (const [tag, severity] of Object.entries(value as Record<string, unknown>)) {
    if (typeof severity === "string" && ["error", "warning", "information", "hint"].includes(severity)) {
      result[tag] = severity;
    }
  }
  return result;
};

const positiveInt = (value: unknown, min: number, fallback: number): number => {
  return typeof value === "number" && Number.isFinite(value) && value >= min ? Math.floor(value) : fallback;
};


const readOpacity = (value: unknown, fallback: number): number => {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
};

const readCommentMarkers = (value: unknown, fallback: CommentMarker[]): CommentMarker[] => {
  if (!Array.isArray(value)) {
    return fallback.map((marker) => ({ ...marker }));
  }
  const markers: CommentMarker[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.tag !== "string" || record.tag.length === 0) {
      continue;
    }
    const marker: CommentMarker = { tag: record.tag };
    if (typeof record.color === "string") {
      marker.color = record.color;
    }
    if (typeof record.backgroundColor === "string") {
      marker.backgroundColor = record.backgroundColor;
    }
    if (typeof record.bold === "boolean") {
      marker.bold = record.bold;
    }
    if (typeof record.italic === "boolean") {
      marker.italic = record.italic;
    }
    if (typeof record.strikethrough === "boolean") {
      marker.strikethrough = record.strikethrough;
    }
    if (typeof record.underline === "boolean") {
      marker.underline = record.underline;
    }
    markers.push(marker);
  }
  return markers;
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

  const settings: TodoForgeSettings = {
    tags: tags.length > 0 ? tags : defaults.tags,
    strictTags: isStringArray(values["general.strictTags"]) ? values["general.strictTags"] : defaults.strictTags,
    tagGroups: readTagGroups(values["general.tagGroups"]),
    caseSensitive: values["general.caseSensitive"] !== false,
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
    dotnetPatterns: values["dotnet.codePatterns"] !== false,
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
    maxFileSizeKb: positiveInt(values["scanning.maxFileSizeKb"], 1, defaults.maxFileSizeKb),
    debounceMs: positiveInt(values["scanning.debounceMs"], 50, defaults.debounceMs),
    autoRefreshIntervalSec: positiveInt(values["scanning.autoRefreshIntervalSec"], 0, defaults.autoRefreshIntervalSec),
    refreshOnGitHeadChange: values["scanning.refreshOnGitHeadChange"] !== false,
    highlightingEnabled: values["highlighting.enabled"] !== false,
    highlightStyle: oneOf<HighlightStyle>(
      values["highlighting.style"],
      ["tag", "text", "comment", "line"],
      defaults.highlightStyle,
    ),
    inlineHints: values["highlighting.inlineHints"] !== false,
    tagStyles: readTagStyles(values["highlighting.tags"]),
    highlightGutterIcons: values["highlighting.gutterIcons"] !== false,
    highlightOpacity: readOpacity(values["highlighting.opacity"], defaults.highlightOpacity),
    highlightBorder: values["highlighting.border"] === true,
    groupBy: oneOf<GroupBy>(values["tree.groupBy"], ["file", "tag", "subtag", "owner", "flat"], defaults.groupBy),
    sortBy: oneOf<SortBy>(values["tree.sortBy"], ["location", "age", "due", "priority"], defaults.sortBy),
    showActivityBadge: values["tree.showActivityBadge"] !== false,
    markdownEnabled: values["markdown.enabled"] !== false,
    markdownGroupSeparately: values["markdown.groupSeparately"] !== false,
    codelensEnabled: values["codelens.enabled"] === true,
    statusbarEnabled: values["statusbar.enabled"] !== false,
    statusbarFormat: oneOf<StatusBarFormat>(values["statusbar.format"], ["compact", "perTag"], defaults.statusbarFormat),
    problemsEnabled: values["problems.enabled"] === true,
    problemsScope: oneOf<ProblemsScope>(values["problems.scope"], ["openFiles", "workspace"], defaults.problemsScope),
    problemsSeverity: values["problems.severity"] === undefined ? defaults.problemsSeverity : readSeverity(values["problems.severity"]),
    owner: typeof values["syntax.owner"] === "string" ? values["syntax.owner"].trim() : "",
    staleAfterDays: positiveInt(values["stale.afterDays"], 1, defaults.staleAfterDays),
    gitEnabled: values["git.enabled"] !== false,
    gitBaseBranch: typeof values["git.baseBranch"] === "string" ? values["git.baseBranch"] : "",
    blameMode: oneOf<BlameMode>(values["git.blame"], ["onDemand", "off"], defaults.blameMode),
    aiEnabled: values["ai.enabled"] === true,
    chatTools: values["ai.chatTools"] === true,
    migrateFromTodoTree: values["migrateFromTodoTree"] !== false,
    ticketUrl: typeof values["general.ticketUrl"] === "string" ? values["general.ticketUrl"] : "",
    commentMarkersEnabled: values["commentMarkers.enabled"] !== false,
    commentMarkers: readCommentMarkers(values["commentMarkers.tags"], defaults.commentMarkers),
    commentMarkersMultiline: values["commentMarkers.multiline"] !== false,
    autoReveal: values["tree.autoReveal"] !== false,
  };

  return { settings, errors };
};
