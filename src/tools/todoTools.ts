/**
 * Pure logic behind the TodoForge chat tools (Language Model tools). The
 * tools are read-only: they return TODO data that TodoForge already has in
 * memory. No file contents beyond the TODO line, no network.
 */
import { daysUntil } from "../syntax/metadata";
import { filterByQuery, formatAge, sortMatches, type QueryContext } from "../tree/query";
import type { BlameInfo, Priority, SortBy, TodoMatch } from "../types";

export const TOOL_NAMES = {
  list: "todoforge_listTodos",
  changes: "todoforge_listChanges",
  get: "todoforge_getTodo",
} as const;

export const LIMITS = {
  defaultItems: 50,
  maxItems: 200,
  textChars: 200,
  /** Keeps a single tool result well inside a chat model's context. */
  totalChars: 24000,
} as const;

export type ToolStatus = "overdue" | "due" | "dueSoon" | "stale" | "mine" | "new" | "uncommitted" | "branch";

export interface ListTodosInput {
  query?: string;
  file?: string;
  tags?: string[];
  owner?: string;
  label?: string;
  status?: ToolStatus[];
  priority?: Priority[];
  text?: string;
  sortBy?: SortBy;
  limit?: number;
}

export interface ListChangesInput {
  scope?: "uncommitted" | "branch" | "all";
  limit?: number;
}

export interface GetTodoInput {
  ref?: string;
  file?: string;
  line?: number;
}

export interface ToolContext extends QueryContext {
  isUncommitted: (match: TodoMatch) => boolean;
  isOnBranch: (match: TodoMatch) => boolean;
  isPinned: (match: TodoMatch) => boolean;
  baseRef?: string;
}

export interface TodoRecord {
  ref: string;
  tag: string;
  text: string;
  file: string;
  line: number;
  owner?: string;
  due?: string;
  dueIn?: number;
  priority?: Priority;
  labels?: string[];
  subTag?: string;
  kind?: "code" | "markdown";
  checked?: boolean;
  author?: string;
  age?: string;
  change?: "uncommitted" | "branch";
  pinned?: boolean;
}

const clean = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/** Quotes a value for the query language when it has spaces. */
const term = (key: string, value: string): string => (/\s/.test(value) ? `${key}:"${value.replace(/"/g, "")}"` : `${key}:${value}`);

export const clampLimit = (limit: unknown, fallback: number = LIMITS.defaultItems): number => {
  const value = typeof limit === "number" && Number.isFinite(limit) ? Math.floor(limit) : fallback;
  return Math.max(1, Math.min(LIMITS.maxItems, value));
};

/** Turns structured tool input into the TodoForge filter query language. */
export const buildToolQuery = (input: ListTodosInput): string => {
  const parts: string[] = [];
  const raw = clean(input.query);
  if (raw) {
    parts.push(raw);
  }
  const file = clean(input.file);
  if (file) {
    parts.push(term("path", file.replace(/\\/g, "/")));
  }
  const tags = (input.tags ?? []).map((tag) => clean(tag)).filter((tag): tag is string => Boolean(tag));
  if (tags.length > 0) {
    parts.push(`tag:${tags.join(",")}`);
  }
  const owner = clean(input.owner);
  if (owner) {
    parts.push(term("owner", owner.replace(/^@/, "")));
  }
  const label = clean(input.label);
  if (label) {
    parts.push(term("label", label.replace(/^#/, "")));
  }
  for (const status of input.status ?? []) {
    if (["overdue", "due", "stale", "mine", "new"].includes(status)) {
      parts.push(`is:${status}`);
    }
  }
  const text = clean(input.text);
  if (text) {
    parts.push(...text.split(/\s+/));
  }
  return parts.join(" ");
};

const shorten = (value: string, max: number): string => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

export const refOf = (match: TodoMatch): string => `${match.relativePath}:${match.line + 1}`;

export const toRecord = (match: TodoMatch, context: ToolContext, blame?: BlameInfo): TodoRecord => {
  const record: TodoRecord = {
    ref: refOf(match),
    tag: match.kind === "markdown" ? "CHECKLIST" : match.tag,
    text: shorten(match.text || match.raw.trim(), LIMITS.textChars),
    file: match.relativePath,
    line: match.line + 1,
  };
  const meta = match.meta;
  if (meta?.owner) {
    record.owner = meta.owner;
  }
  if (meta?.due) {
    record.due = meta.due;
    record.dueIn = daysUntil(meta.due, context.today);
  }
  if (meta?.priority) {
    record.priority = meta.priority;
  }
  if (meta && meta.labels.length > 0) {
    record.labels = meta.labels;
  }
  if (match.subTag) {
    record.subTag = match.subTag;
  }
  if (match.kind !== "tag") {
    record.kind = match.kind === "markdown" ? "markdown" : "code";
  }
  if (match.kind === "markdown") {
    record.checked = match.markdownChecked === true;
  }
  const info = blame ?? context.blameOf(match);
  if (info && !info.uncommitted) {
    record.author = info.author;
    record.age = formatAge(Math.max(0, Math.floor((context.nowSeconds - info.time) / 86400)));
  }
  if (context.isUncommitted(match)) {
    record.change = "uncommitted";
  } else if (context.isOnBranch(match)) {
    record.change = "branch";
  }
  if (context.isPinned(match)) {
    record.pinned = true;
  }
  return record;
};

/** Filters, sorts and limits. Statuses the query language lacks are applied here. */
export const selectTodos = (
  matches: readonly TodoMatch[],
  input: ListTodosInput,
  context: ToolContext,
): { items: TodoMatch[]; total: number; query: string } => {
  const query = buildToolQuery(input);
  let selected = filterByQuery(matches, query, context);
  const statuses = new Set(input.status ?? []);
  if (statuses.has("dueSoon")) {
    selected = selected.filter((match) => {
      const days = match.meta?.due ? daysUntil(match.meta.due, context.today) : undefined;
      return days !== undefined && days >= 0 && days <= 7;
    });
  }
  if (statuses.has("uncommitted")) {
    selected = selected.filter((match) => context.isUncommitted(match));
  }
  if (statuses.has("branch")) {
    selected = selected.filter((match) => !context.isUncommitted(match) && context.isOnBranch(match));
  }
  const priorities = new Set(input.priority ?? []);
  if (priorities.size > 0) {
    selected = selected.filter((match) => match.meta?.priority !== undefined && priorities.has(match.meta.priority));
  }
  const sortBy = input.sortBy ?? (statuses.has("overdue") || statuses.has("due") || statuses.has("dueSoon") ? "due" : "location");
  const sorted = sortMatches(selected, sortBy, context);
  const limit = clampLimit(input.limit);
  return { items: sorted.slice(0, limit), total: sorted.length, query };
};

/** Finds one TODO by `path:line`, or by file and line. Nearest line within 3 wins. */
export const findTodo = (matches: readonly TodoMatch[], input: GetTodoInput): TodoMatch | undefined => {
  let file = clean(input.file)?.replace(/\\/g, "/");
  let line = typeof input.line === "number" ? Math.floor(input.line) : undefined;
  const ref = clean(input.ref);
  if (ref) {
    const parsed = /^(.*):(\d+)$/.exec(ref.replace(/\\/g, "/"));
    if (parsed) {
      file = parsed[1];
      line = Number(parsed[2]);
    } else {
      file = ref;
    }
  }
  if (!file) {
    return undefined;
  }
  const wanted = file.replace(/^\.\//, "");
  const inFile = matches.filter(
    (match) => match.relativePath === wanted || match.relativePath.endsWith(`/${wanted}`) || match.uri.endsWith(`/${wanted}`),
  );
  if (inFile.length === 0) {
    return undefined;
  }
  if (line === undefined) {
    return inFile.length === 1 ? inFile[0] : undefined;
  }
  const target = line - 1;
  let best: TodoMatch | undefined;
  for (const match of inFile) {
    const distance = Math.abs(match.line - target);
    if (distance <= 3 && (!best || distance < Math.abs(best.line - target))) {
      best = match;
    }
  }
  return best;
};

/**
 * Renders a result as a short summary line plus JSON, trimmed to
 * `LIMITS.totalChars`. Models read JSON reliably; the summary helps them
 * answer without parsing.
 */
export const renderRecords = (summary: string, records: readonly TodoRecord[], total: number): string => {
  const kept: TodoRecord[] = [];
  let size = summary.length + 64;
  for (const record of records) {
    const piece = JSON.stringify(record).length + 2;
    if (size + piece > LIMITS.totalChars) {
      break;
    }
    kept.push(record);
    size += piece;
  }
  const notes: string[] = [];
  if (kept.length < total) {
    notes.push(`Showing ${kept.length} of ${total}. Narrow the filter (file, tags, status) or raise limit (max ${LIMITS.maxItems}) to see more.`);
  }
  return [summary, ...notes, "```json", JSON.stringify(kept, null, 0).replace(/\},\{/g, "},\n{"), "```"].join("\n");
};
