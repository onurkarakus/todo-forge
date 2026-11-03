import type { PinnedTodo, TodoMatch } from "../types";
import { createId } from "../utils/id";

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim().toLowerCase();

/** Identity of a TODO that survives line moves: file, tag and text. */
export const fingerprint = (match: Pick<TodoMatch, "uri" | "tag" | "text">): string => {
  return `${match.uri}|${match.tag}|${normalizeText(match.text)}`;
};

export const pinFromMatch = (match: TodoMatch): PinnedTodo => {
  return {
    id: createId(),
    uri: match.uri,
    tag: match.tag,
    text: match.text,
    line: match.line,
    relativePath: match.relativePath,
  };
};

/**
 * Finds the current match for a pin: same file, tag and text, nearest to the
 * line where it was pinned. Falls back to the same tag on the same line when
 * only the text was edited.
 */
export const resolvePin = (pin: PinnedTodo, fileMatches: readonly TodoMatch[]): TodoMatch | undefined => {
  const wanted = fingerprint(pin);
  const candidates = fileMatches.filter((match) => fingerprint(match) === wanted);
  if (candidates.length > 0) {
    return [...candidates].sort((left, right) => Math.abs(left.line - pin.line) - Math.abs(right.line - pin.line))[0];
  }
  return fileMatches.find((match) => match.line === pin.line && match.tag === pin.tag);
};

export const isPinned = (pins: readonly PinnedTodo[], match: TodoMatch): boolean => {
  const key = fingerprint(match);
  return pins.some((pin) => fingerprint(pin) === key);
};

export const reorderPins = (pins: readonly PinnedTodo[], draggedId: string, targetId: string | undefined): PinnedTodo[] => {
  const next = [...pins];
  const from = next.findIndex((pin) => pin.id === draggedId);
  if (from < 0) {
    return next;
  }
  const [dragged] = next.splice(from, 1);
  if (!dragged) {
    return [...pins];
  }
  const to = targetId ? next.findIndex((pin) => pin.id === targetId) : -1;
  next.splice(to < 0 ? next.length : to, 0, dragged);
  return next;
};
