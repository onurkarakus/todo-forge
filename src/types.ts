export type ScanMode = "workspace" | "openFiles" | "currentFile" | "workspaceAndOpen";

export type GroupBy = "file" | "tag" | "subtag" | "flat";

export type HighlightStyle = "tag" | "comment" | "line";

export type MatchKind = "tag" | "markdown";

export type TaskPriority = "high" | "medium" | "low";

export type TaskStorage = "workspaceState" | "workspaceFile";

export type StatusBarFormat = "perTag" | "total";

export type RulerLane = "off" | "right" | "center" | "left" | "full";

export type FontStyleName = "normal" | "italic" | "bold" | "underline";

export interface TagStyle {
  foreground?: string;
  background?: string;
  icon?: string;
  ruler?: RulerLane;
  fontStyle?: FontStyleName;
}

export interface TagGroup {
  name: string;
  tags: string[];
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
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  order: number;
}

export interface TaskSource {
  uri: string;
  line: number;
  tag: string;
  text: string;
}

export interface TrackedTask {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate?: string;
  note: string;
  done: boolean;
  order: number;
  subtasks: Subtask[];
  sources: TaskSource[];
}

export interface TodoForgeSettings {
  tags: string[];
  tagGroups: TagGroup[];
  caseSensitive: boolean;
  subTagRegex: string;
  labelFormat: string;
  regexCustom: string;
  multiline: boolean;
  multilineMaxLines: number;
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
  tagStyles: Record<string, TagStyle>;
  groupBy: GroupBy;
  showActivityBadge: boolean;
  tasksEnabled: boolean;
  tasksStorage: TaskStorage;
  updateSourceOnDone: boolean;
  markdownEnabled: boolean;
  markdownGroupSeparately: boolean;
  codelensEnabled: boolean;
  statusbarEnabled: boolean;
  statusbarFormat: StatusBarFormat;
  migrateFromTodoTree: boolean;
}

export interface SourceLocation {
  uri: string;
  relativePath: string;
  workspaceFolder?: string;
}
