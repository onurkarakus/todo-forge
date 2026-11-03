import type { Priority, TodoMeta } from "../types";

/**
 * Inline TODO metadata: `TODO(owner, 2026-12-01, !high, #label): text`.
 * Every part is optional and the order is free. The parser never throws.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const PRIORITY_ALIASES: Record<string, Priority> = {
  high: "high",
  h: "high",
  "1": "high",
  p1: "high",
  medium: "medium",
  med: "medium",
  m: "medium",
  "2": "medium",
  p2: "medium",
  low: "low",
  l: "low",
  "3": "low",
  p3: "low",
};

export const isIsoDate = (value: string): boolean => {
  if (!DATE.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

export const parsePriority = (token: string): Priority | undefined => {
  const cleaned = token.trim().replace(/^!/, "").toLowerCase();
  return PRIORITY_ALIASES[cleaned];
};

export interface MetaParse {
  meta?: TodoMeta;
  /** Characters consumed after the tag, including the parentheses. */
  length: number;
}

/** Parses `(...)` right after a tag. `after` is the text that follows the tag. */
export const parseMetadata = (after: string): MetaParse => {
  const found = /^\(([^()]{0,200})\)/.exec(after);
  if (!found) {
    return { length: 0 };
  }
  const meta: TodoMeta = { labels: [] };
  for (const part of (found[1] ?? "").split(",")) {
    const token = part.trim();
    if (!token) {
      continue;
    }
    if (isIsoDate(token)) {
      meta.due ??= token;
      continue;
    }
    if (token.startsWith("!")) {
      const priority = parsePriority(token);
      if (priority) {
        meta.priority ??= priority;
        continue;
      }
    }
    if (token.startsWith("#") && token.length > 1) {
      meta.labels.push(token.slice(1));
      continue;
    }
    if (!meta.owner) {
      meta.owner = token.replace(/^@/, "");
      continue;
    }
    meta.labels.push(token);
  }
  return { meta, length: found[0].length };
};

export const serializeMetadata = (meta: TodoMeta): string => {
  const parts: string[] = [];
  if (meta.owner) {
    parts.push(meta.owner);
  }
  if (meta.due) {
    parts.push(meta.due);
  }
  if (meta.priority) {
    parts.push(`!${meta.priority}`);
  }
  for (const label of meta.labels) {
    parts.push(`#${label}`);
  }
  return parts.length > 0 ? `(${parts.join(", ")})` : "";
};

export interface MetaPatch {
  owner?: string | null;
  due?: string | null;
  priority?: Priority | null;
}

const applyPatch = (meta: TodoMeta, patch: MetaPatch): TodoMeta => {
  const next: TodoMeta = { ...meta, labels: [...meta.labels] };
  if (patch.owner !== undefined) {
    next.owner = patch.owner ?? undefined;
  }
  if (patch.due !== undefined) {
    next.due = patch.due ?? undefined;
  }
  if (patch.priority !== undefined) {
    next.priority = patch.priority ?? undefined;
  }
  return next;
};

/**
 * Rewrites the metadata of the tag that starts at `column` on `line`.
 * Returns undefined when the tag is no longer at that column, so a stale
 * match never edits the wrong word.
 */
export const rewriteMetadata = (
  line: string,
  column: number,
  tag: string,
  patch: MetaPatch,
): string | undefined => {
  const slice = line.slice(column, column + tag.length);
  if (slice.toLowerCase() !== tag.toLowerCase()) {
    return undefined;
  }
  const end = column + tag.length;
  const after = line.slice(end);
  if (/^\w/.test(after)) {
    return undefined;
  }
  const parsed = parseMetadata(after);
  const meta = applyPatch(parsed.meta ?? { labels: [] }, patch);
  const rest = after.slice(parsed.length);
  const serialized = serializeMetadata(meta);
  const needsColon = serialized.length > 0 && parsed.length === 0 && /^\s+\S/.test(rest);
  return `${line.slice(0, end)}${serialized}${needsColon ? ":" : ""}${rest}`;
};

const toIso = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const todayIso = (now: Date = new Date()): string => toIso(now);

export const addDays = (iso: string, days: number): string => {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return toIso(date);
};

/** Snoozing moves the due date forward from today or from the current due date, whichever is later. */
export const snoozeDate = (currentDue: string | undefined, days: number, today: string): string => {
  const base = currentDue && isIsoDate(currentDue) && currentDue > today ? currentDue : today;
  return addDays(base, days);
};

/** Whole days from `today` to `due`; negative when overdue. */
export const daysUntil = (due: string, today: string): number => {
  const toUtc = (iso: string): number => {
    const [year, month, day] = iso.split("-").map((part) => Number(part));
    return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  };
  return Math.round((toUtc(due) - toUtc(today)) / 86_400_000);
};

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
