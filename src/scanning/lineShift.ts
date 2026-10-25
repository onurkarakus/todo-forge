import type { TodoMatch } from "../types";
import { matchId } from "../utils/id";

export interface LineChange {
  startLine: number;
  endLine: number;
  newLineCount: number;
}

export const changeFromEdit = (
  startLine: number,
  endLine: number,
  insertedText: string,
): LineChange => {
  const newLineCount = insertedText.split("\n").length;
  return { startLine, endLine: endLine + 1, newLineCount };
};

const withLine = (match: TodoMatch, line: number): TodoMatch => {
  return {
    ...match,
    line,
    id: matchId(match.uri, line, match.column, match.kind, match.tag),
  };
};

export const applyLineChanges = (
  matches: readonly TodoMatch[],
  changes: readonly LineChange[],
): TodoMatch[] => {
  const ordered = [...changes].sort((left, right) => right.startLine - left.startLine);
  let current = [...matches];
  for (const change of ordered) {
    const delta = change.newLineCount - (change.endLine - change.startLine);
    current = current
      .filter((match) => match.line < change.startLine || match.line >= change.endLine)
      .map((match) => (match.line >= change.endLine ? withLine(match, match.line + delta) : match));
  }
  return current;
};

export interface LineWindow {
  start: number;
  end: number;
}

const deltaOf = (change: LineChange): number => {
  return change.newLineCount - (change.endLine - change.startLine);
};

export const shiftWindow = (window: LineWindow, change: LineChange): LineWindow => {
  const delta = deltaOf(change);
  if (window.end <= change.startLine) {
    return window;
  }
  if (window.start >= change.endLine) {
    return { start: window.start + delta, end: window.end + delta };
  }
  return {
    start: Math.min(window.start, change.startLine),
    end: Math.max(window.end + delta, change.startLine + change.newLineCount),
  };
};

export const accumulateWindows = (
  existing: LineWindow | undefined,
  changes: readonly LineChange[],
  padding: number,
  lineCount: number,
): LineWindow | undefined => {
  let window = existing;
  const ordered = [...changes].sort((left, right) => right.startLine - left.startLine);
  for (const change of ordered) {
    if (window) {
      window = shiftWindow(window, change);
    }
    const created: LineWindow = {
      start: Math.max(0, change.startLine - padding),
      end: change.startLine + change.newLineCount + padding,
    };
    window = window
      ? { start: Math.min(window.start, created.start), end: Math.max(window.end, created.end) }
      : created;
  }
  if (!window) {
    return undefined;
  }
  return {
    start: Math.max(0, window.start),
    end: Math.min(lineCount, Math.max(window.start + 1, window.end)),
  };
};

export const windowForChanges = (
  changes: readonly LineChange[],
  padding: number,
  lineCount: number,
): LineWindow | undefined => {
  return accumulateWindows(undefined, changes, padding, lineCount);
};
