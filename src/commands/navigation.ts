import type { TodoMatch } from "../types";

const compare = (left: TodoMatch, right: TodoMatch): number => {
  return left.line - right.line || left.column - right.column;
};

export const cycleMatch = (
  matches: readonly TodoMatch[],
  line: number,
  character: number,
  direction: 1 | -1,
): TodoMatch | undefined => {
  if (matches.length === 0) {
    return undefined;
  }
  const sorted = [...matches].sort(compare);
  if (direction > 0) {
    return (
      sorted.find(
        (match) => match.line > line || (match.line === line && match.column > character),
      ) ?? sorted[0]
    );
  }
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const match = sorted[index];
    if (!match) {
      continue;
    }
    if (match.line < line || (match.line === line && match.column < character)) {
      return match;
    }
  }
  return sorted[sorted.length - 1];
};

export const formatStatusText = (
  counts: ReadonlyMap<string, number>,
  format: "perTag" | "total",
  scanning: boolean,
): string => {
  if (scanning) {
    return "TodoForge: Scanning…";
  }
  const entries = [...counts.entries()].filter(([, count]) => count > 0);
  entries.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (format === "total" || entries.length === 0) {
    return `TODOs: ${total}`;
  }
  return entries.map(([tag, count]) => `${tag}:${count}`).join(" ");
};
