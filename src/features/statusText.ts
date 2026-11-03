import { dueHint } from "../highlighting/hints";
import type { StatusBarFormat, TodoMatch } from "../types";

export interface StatusSummary {
  fileCount: number;
  total: number;
  overdue: number;
  byTag: [string, number][];
  hasFile: boolean;
}

export const summarize = (
  all: readonly TodoMatch[],
  fileUri: string | undefined,
  today: string,
): StatusSummary => {
  const counts = new Map<string, number>();
  let fileCount = 0;
  let overdue = 0;
  for (const match of all) {
    counts.set(match.tag, (counts.get(match.tag) ?? 0) + 1);
    if (fileUri && match.uri === fileUri) {
      fileCount += 1;
    }
    if (match.meta?.due && dueHint(match, today)?.tone === "overdue") {
      overdue += 1;
    }
  }
  const byTag = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  return { fileCount, total: all.length, overdue, byTag, hasFile: fileUri !== undefined };
};

/** Status bar text. `compact`: file/total plus overdue; `perTag`: top tags. */
export const statusText = (summary: StatusSummary, format: StatusBarFormat, scanning: boolean): string => {
  const icon = scanning ? "$(sync~spin)" : "$(checklist)";
  const overdue = summary.overdue > 0 ? ` $(warning) ${summary.overdue}` : "";
  if (format === "perTag" && summary.byTag.length > 0) {
    return `${icon} ${summary.byTag
      .slice(0, 4)
      .map(([tag, count]) => `${tag} ${count}`)
      .join("  ")}${overdue}`;
  }
  const count = summary.hasFile && summary.fileCount > 0 ? `${summary.fileCount}/${summary.total}` : String(summary.total);
  return `${icon} ${count}${overdue}`;
};
