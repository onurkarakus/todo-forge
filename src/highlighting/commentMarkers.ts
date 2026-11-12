import { DEFAULT_COMMENT_MARKERS } from "../config/defaults";
import { commentContextAt } from "../syntax/commentContext";
import type { CommentSyntax } from "../syntax/languages";
import type { CommentMarker } from "../types";

export { DEFAULT_COMMENT_MARKERS };

export interface MarkerSpan {
  line: number;
  start: number;
  end: number;
  marker: CommentMarker;
}

/** Theme color keys for the built-in markers (`todoforge.<key>Foreground`). */
export const BUILTIN_MARKER_KEYS: Readonly<Record<string, string>> = {
  "!": "commentAlert",
  "?": "commentQuestion",
  "*": "commentHighlight",
  "//": "commentStrikethrough",
};

const firstNonBlank = (line: string): number => {
  const found = /\S/.exec(line);
  return found ? found.index : 0;
};

const skipSpace = (line: string, index: number): number => {
  let position = index;
  while (position < line.length && (line[position] === " " || line[position] === "\t")) {
    position += 1;
  }
  return position;
};

export const lineStartsWithTag = (text: string, tags: readonly string[], caseSensitive: boolean): boolean => {
  const trimmed = text.trimStart();
  const ordered = [...tags].sort((left, right) => right.length - left.length);
  for (const tag of ordered) {
    if (!tag) {
      continue;
    }
    const matches = caseSensitive ? trimmed.startsWith(tag) : trimmed.toLowerCase().startsWith(tag.toLowerCase());
    if (!matches) {
      continue;
    }
    const next = trimmed.slice(tag.length);
    if (next.length === 0 || /^\s|^:|^\(/.test(next)) {
      return true;
    }
  }
  return false;
};

const matchMarker = (text: string, markers: readonly CommentMarker[]): { marker: CommentMarker; length: number } | undefined => {
  const ordered = [...markers].filter((marker) => marker.tag.length > 0).sort((left, right) => right.tag.length - left.tag.length);
  for (const marker of ordered) {
    if (text.startsWith(marker.tag)) {
      return { marker, length: marker.tag.length };
    }
  }
  return undefined;
};

const openTokens = (syntax: CommentSyntax | undefined): string[] => {
  const tokens = syntax
    ? [...syntax.line, ...syntax.block.map(([open]) => open)]
    : ["//", "/*", "#", "--", ";", "%", "<!--", "(*", "{-", "<#", "@*"];
  return [...new Set(tokens)].sort((left, right) => right.length - left.length);
};

const closeAfter = (line: string, from: number, syntax: CommentSyntax | undefined, token?: string): { end: number; closed: boolean } => {
  const closes: string[] = [];
  if (syntax) {
    for (const [open, close] of syntax.block) {
      if (!token || token === open) {
        closes.push(close);
      }
    }
  } else {
    closes.push("*/", "-->", "*)", "-}", "#>", "*@");
  }
  let end = line.length;
  let closed = false;
  for (const close of closes) {
    const index = line.indexOf(close, from);
    if (index >= 0 && index < end) {
      end = index;
      closed = true;
    }
  }
  return { end, closed };
};

export interface LineMarkerHit {
  start: number;
  end: number;
  marker: CommentMarker;
  closed: boolean;
  inBlock: boolean;
}

/**
 * Finds a Better Comments-style marker after a comment token on this line.
 * Skips the marker when a real TODO/FIXME tag follows it, so those stay in
 * the tree and use the TODO highlight.
 */
export const findMarkerOnLine = (
  line: string,
  syntax: CommentSyntax | undefined,
  markers: readonly CommentMarker[],
  todoTags: readonly string[],
  caseSensitive: boolean,
): LineMarkerHit | undefined => {
  if (markers.length === 0) {
    return undefined;
  }
  const tokens = openTokens(syntax);
  let position = 0;
  while (position < line.length) {
    let token: string | undefined;
    if (syntax?.block.some(([open]) => open === "/*" || open === "{/*")) {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("*") && !trimmed.startsWith("*/") && firstNonBlank(line) === position) {
        token = "*";
      }
    }
    if (!token) {
      for (const candidate of tokens) {
        if (line.startsWith(candidate, position)) {
          token = candidate;
          break;
        }
      }
    }
    if (!token) {
      position += 1;
      continue;
    }
    const afterToken = position + token.length;
    const context = commentContextAt(line, Math.min(afterToken, line.length), syntax);
    if (!context.inComment) {
      position += token.length;
      continue;
    }
    const start = skipSpace(line, afterToken);
    const found = matchMarker(line.slice(start), markers);
    if (!found) {
      position += token.length;
      continue;
    }
    if (lineStartsWithTag(line.slice(start + found.length), todoTags, caseSensitive)) {
      return undefined;
    }
    const inBlock = token === "*" || Boolean(syntax?.block.some(([open]) => open === token));
    const close = closeAfter(line, start + found.length, syntax, token === "*" ? undefined : token);
    return {
      start,
      end: Math.max(close.end, start + found.length),
      marker: found.marker,
      closed: close.closed || !inBlock,
      inBlock,
    };
  }
  return undefined;
};

const continuationStart = (line: string, syntax: CommentSyntax | undefined): number => {
  const start = firstNonBlank(line);
  const slice = line.slice(start);
  if (syntax?.block.some(([open]) => open === "/*" || open === "{/*") && slice.startsWith("*") && !slice.startsWith("*/")) {
    return skipSpace(line, start + 1);
  }
  return start;
};

/** Collects marker spans in `from`..`to`. When multiline is on, a block comment keeps its marker on later lines. */
export const collectCommentMarkers = (
  lines: readonly string[],
  from: number,
  to: number,
  syntax: CommentSyntax | undefined,
  markers: readonly CommentMarker[],
  options: { multiline: boolean; todoTags: readonly string[]; caseSensitive: boolean },
): MarkerSpan[] => {
  if (markers.length === 0) {
    return [];
  }
  const last = Math.min(to, lines.length - 1);
  const lookback = options.multiline ? Math.max(0, from - 80) : from;
  const result: MarkerSpan[] = [];
  let inherited: CommentMarker | undefined;
  for (let lineNumber = lookback; lineNumber <= last; lineNumber += 1) {
    const line = lines[lineNumber] ?? "";
    const hit = findMarkerOnLine(line, syntax, markers, options.todoTags, options.caseSensitive);
    if (hit) {
      if (lineNumber >= from) {
        result.push({ line: lineNumber, start: hit.start, end: hit.end, marker: hit.marker });
      }
      inherited = options.multiline && hit.inBlock && !hit.closed ? hit.marker : undefined;
      continue;
    }
    if (!inherited || !options.multiline) {
      inherited = undefined;
      continue;
    }
    const probe = Math.min(Math.max(continuationStart(line, syntax), firstNonBlank(line)), Math.max(line.length - 1, 0));
    const context = commentContextAt(line, probe, syntax);
    if (!context.inComment) {
      inherited = undefined;
      continue;
    }
    const start = continuationStart(line, syntax);
    const close = closeAfter(line, start, syntax);
    if (lineNumber >= from && start < close.end) {
      result.push({ line: lineNumber, start, end: close.end, marker: inherited });
    }
    if (close.closed) {
      inherited = undefined;
    }
  }
  return result;
};
