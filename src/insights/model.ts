import { daysUntil } from "../syntax/metadata";
import { ageInDays } from "../tree/query";
import type { BlameInfo, TodoMatch } from "../types";

export interface InsightItem {
  id: string;
  label: string;
  where: string;
  detail: string;
}

export interface InsightsData {
  total: number;
  files: number;
  overdueCount: number;
  staleCount: number;
  newCount: number;
  byTag: [string, number][];
  byFolder: [string, number][];
  byOwner: [string, number][];
  /** Undefined when no blame data is available (git off or not a repository). */
  ages?: { label: string; count: number }[];
  overdue: InsightItem[];
  oldest: InsightItem[];
  blamed: number;
}

export interface InsightsInput {
  matches: readonly TodoMatch[];
  today: string;
  nowSeconds: number;
  staleAfterDays: number;
  blameOf: (match: TodoMatch) => BlameInfo | undefined;
  isNew: (match: TodoMatch) => boolean;
  ageLabels: readonly string[];
  formatAge: (days: number) => string;
  /** Label for Markdown checklist items instead of their internal tag. */
  markdownLabel?: string;
}

const AGE_LIMITS = [7, 30, 90, 180, 365, Number.POSITIVE_INFINITY];

const top = (counts: Map<string, number>, limit: number): [string, number][] => {
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, limit);
};

const bump = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

const folderOf = (relativePath: string): string => {
  const parts = relativePath.split("/");
  parts.pop();
  return parts.slice(0, 2).join("/") || ".";
};

export const buildInsights = (input: InsightsInput): InsightsData => {
  const byTag = new Map<string, number>();
  const byFolder = new Map<string, number>();
  const byOwner = new Map<string, number>();
  const files = new Set<string>();
  const ageCounts = AGE_LIMITS.map(() => 0);
  const overdue: (InsightItem & { days: number })[] = [];
  const aged: (InsightItem & { age: number })[] = [];
  let staleCount = 0;
  let newCount = 0;
  let blamed = 0;
  for (const match of input.matches) {
    const tag = match.kind === "markdown" ? (input.markdownLabel ?? "Checklist") : match.tag;
    bump(byTag, tag);
    bump(byFolder, folderOf(match.relativePath));
    files.add(match.uri);
    const blame = input.blameOf(match);
    const owner = match.meta?.owner ?? (blame && !blame.uncommitted ? blame.author : undefined);
    if (owner) {
      bump(byOwner, owner);
    }
    if (input.isNew(match)) {
      newCount += 1;
    }
    const label = `${tag}: ${match.text || match.raw.trim()}`.slice(0, 140);
    const where = `${match.relativePath}:${match.line + 1}`;
    if (match.meta?.due) {
      const days = daysUntil(match.meta.due, input.today);
      if (days < 0) {
        overdue.push({ id: match.id, label, where, detail: match.meta.due, days });
      }
    }
    const age = ageInDays(blame, input.nowSeconds);
    if (age !== undefined) {
      blamed += 1;
      const bucket = AGE_LIMITS.findIndex((limit) => age < limit);
      ageCounts[bucket] = (ageCounts[bucket] ?? 0) + 1;
      if (age >= input.staleAfterDays) {
        staleCount += 1;
      }
      aged.push({ id: match.id, label, where, detail: input.formatAge(age), age });
    }
  }
  overdue.sort((left, right) => left.days - right.days);
  aged.sort((left, right) => right.age - left.age);
  return {
    total: input.matches.length,
    files: files.size,
    overdueCount: overdue.length,
    staleCount,
    newCount,
    byTag: top(byTag, 12),
    byFolder: top(byFolder, 10),
    byOwner: top(byOwner, 8),
    ages: blamed > 0 ? AGE_LIMITS.map((_, index) => ({ label: input.ageLabels[index] ?? "", count: ageCounts[index] ?? 0 })) : undefined,
    overdue: overdue.slice(0, 10).map(({ id, label, where, detail }) => ({ id, label, where, detail })),
    oldest: aged.slice(0, 10).map(({ id, label, where, detail }) => ({ id, label, where, detail })),
    blamed,
  };
};
