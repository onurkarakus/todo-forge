export type ScanMode = "workspace" | "openFiles" | "currentFile" | "workspaceAndOpen";

export type GroupBy = "file" | "tag" | "subtag" | "owner" | "flat";

export type SortBy = "location" | "age" | "due" | "priority";

export type HighlightStyle = "tag" | "text" | "comment" | "line";

/** `tag` is a comment tag, `markdown` a checklist item, `code` a .NET code pattern. */
export type MatchKind = "tag" | "markdown" | "code";

export type Priority = "high" | "medium" | "low";

export type StatusBarFormat = "compact" | "perTag";

export type RulerLane = "off" | "right" | "center" | "left" | "full";

export type FontStyleName = "normal" | "italic" | "bold" | "underline";

export type ProblemsScope = "openFiles" | "workspace";

export type BlameMode = "onDemand" | "off";

export interface TagStyle {
  foreground?: string;
  background?: string;
  icon?: string;
  ruler?: RulerLane;
  fontStyle?: FontStyleName;
  /** Highlight in the editor but do not list this tag in the tree. */
  hideFromTree?: boolean;
  /** 0–1, applied to the highlight colors. */
  opacity?: number;
  /** A CSS color, or `true` to use the tag foreground as a 1px border. */
  border?: string | boolean;
}

/** A Better Comments-style marker drawn only in the editor, not in the tree. */
export interface CommentMarker {
  tag: string;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}

export interface TagGroup {
  name: string;
  tags: string[];
}

/** Metadata written inline: `TODO(owner, 2026-12-01, !high, #tag): text`. */
export interface TodoMeta {
  owner?: string;
  due?: string;
  priority?: Priority;
  labels: string[];
}

export interface TodoMatch {
  id: string;
  uri: string;
  workspaceFolder?: string;
  relativePath: string;
  line: number;
  column: number;
  endColumn: number;
  leadColumn: number;
  lineLength: number;
  tag: string;
  subTag?: string;
  text: string;
  raw: string;
  kind: MatchKind;
  markdownChecked?: boolean;
  meta?: TodoMeta;
}

export interface BlameInfo {
  sha: string;
  author: string;
  email: string;
  /** Unix seconds. */
  time: number;
  summary: string;
  uncommitted: boolean;
}

export interface PinnedTodo {
  id: string;
  uri: string;
  tag: string;
  text: string;
  line: number;
  relativePath: string;
}

export interface TodoForgeSettings {
  tags: string[];
  strictTags: string[];
  tagGroups: TagGroup[];
  caseSensitive: boolean;
  subTagRegex: string;
  labelFormat: string;
  regexCustom: string;
  multiline: boolean;
  multilineMaxLines: number;
  dotnetPatterns: boolean;
  scanMode: ScanMode;
  includeGlobs: string[];
  excludeGlobs: string[];
  useGitignore: boolean;
  useVsCodeExcludes: boolean;
  maxFileSizeKb: number;
  debounceMs: number;
  autoRefreshIntervalSec: number;
  refreshOnGitHeadChange: boolean;
  highlightingEnabled: boolean;
  highlightStyle: HighlightStyle;
  inlineHints: boolean;
  tagStyles: Record<string, TagStyle>;
  groupBy: GroupBy;
  sortBy: SortBy;
  showActivityBadge: boolean;
  markdownEnabled: boolean;
  markdownGroupSeparately: boolean;
  codelensEnabled: boolean;
  statusbarEnabled: boolean;
  statusbarFormat: StatusBarFormat;
  problemsEnabled: boolean;
  problemsScope: ProblemsScope;
  problemsSeverity: Record<string, string>;
  owner: string;
  staleAfterDays: number;
  gitEnabled: boolean;
  gitBaseBranch: string;
  blameMode: BlameMode;
  aiEnabled: boolean;
  chatTools: boolean;
  migrateFromTodoTree: boolean;
  ticketUrl: string;
  commentMarkersEnabled: boolean;
  commentMarkers: CommentMarker[];
  commentMarkersMultiline: boolean;
  highlightGutterIcons: boolean;
  highlightOpacity: number;
  highlightBorder: boolean;
  autoReveal: boolean;
}

export interface SourceLocation {
  uri: string;
  relativePath: string;
  workspaceFolder?: string;
}
