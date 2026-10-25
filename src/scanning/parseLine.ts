import type { SourceLocation, TodoMatch } from "../types";
import { matchId } from "../utils/id";
import {
  canonicalTag,
  compileMatcher,
  isCommentContext,
  type CompiledMatcher,
} from "../utils/regexBuilder";
import { extractSubTag } from "../utils/subTag";

export interface ParseOptions {
  tags: readonly string[];
  caseSensitive: boolean;
  customRegex: string;
  subTagRegex: string;
  markdownEnabled: boolean;
  multiline: boolean;
  multilineMaxLines: number;
}

const MARKDOWN_LINE =
  /^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s*(.*)$/;

const CONTINUATION =
  /^\s*(?:\*|\/\/|\/\*|#|--|')\s?/;

export const compileParseOptions = (
  options: ParseOptions,
): { matcher: CompiledMatcher; options: ParseOptions } => {
  return {
    matcher: compileMatcher(options.tags, options.caseSensitive, options.customRegex),
    options,
  };
};

const markdownMatch = (
  line: string,
  lineNumber: number,
  location: SourceLocation,
): TodoMatch | undefined => {
  const found = MARKDOWN_LINE.exec(line);
  if (!found) {
    return undefined;
  }
  const indent = found[1] ?? "";
  const mark = found[2] ?? " ";
  const text = (found[3] ?? "").trim();
  const column = line.indexOf("[");
  return {
    id: matchId(location.uri, lineNumber, column, "markdown", "MARKDOWN"),
    uri: location.uri,
    workspaceFolder: location.workspaceFolder,
    relativePath: location.relativePath,
    line: lineNumber,
    column,
    endColumn: column + 3,
    leadColumn: indent.length,
    lineLength: line.length,
    tag: "MARKDOWN",
    text,
    raw: line,
    kind: "markdown",
    markdownChecked: mark.toLowerCase() === "x",
  };
};

const tagFromMatch = (
  line: string,
  lineNumber: number,
  index: number,
  rawTag: string,
  location: SourceLocation,
  options: ParseOptions,
): TodoMatch => {
  const tag = canonicalTag(rawTag, options.tags, options.caseSensitive);
  const after = line.slice(index + rawTag.length);
  const extracted = extractSubTag(after, options.subTagRegex);
  const prefix = line.slice(0, index);
  const leadMatch = /(?:\/\/\/?|\/\*|<!--|--|#|;|%|@\*|\(\*|'|\*)\s*$/.exec(prefix);
  const leadColumn = leadMatch ? index - leadMatch[0].length : index;
  return {
    id: matchId(location.uri, lineNumber, index, "tag", tag),
    uri: location.uri,
    workspaceFolder: location.workspaceFolder,
    relativePath: location.relativePath,
    line: lineNumber,
    column: index,
    endColumn: index + rawTag.length,
    leadColumn: Math.max(0, leadColumn),
    lineLength: line.length,
    tag,
    subTag: extracted.subTag,
    text: extracted.text.replace(/\s*(?:\*\/|\*@|-->)\s*$/g, "").trim(),
    raw: line,
    kind: "tag",
  };
};

export const parseLine = (
  line: string,
  lineNumber: number,
  location: SourceLocation,
  matcher: CompiledMatcher,
  options: ParseOptions,
): TodoMatch[] => {
  if (options.markdownEnabled) {
    const checklist = markdownMatch(line, lineNumber, location);
    if (checklist) {
      return [checklist];
    }
  }

  const flags = options.caseSensitive ? "g" : "gi";
  const regex = new RegExp(matcher.regex.source, flags);
  const matches: TodoMatch[] = [];
  for (const found of line.matchAll(regex)) {
    const full = found[0] ?? "";
    const grouped = found.groups?.tag;
    const rawTag = grouped ?? full;
    const fullIndex = found.index ?? -1;
    if (fullIndex < 0 || rawTag.length === 0) {
      continue;
    }
    const relative = grouped ? full.indexOf(grouped) : 0;
    const index = fullIndex + Math.max(0, relative);
    if (!matcher.custom && !isCommentContext(line.slice(0, index))) {
      continue;
    }
    matches.push(tagFromMatch(line, lineNumber, index, rawTag, location, options));
  }
  return matches;
};

export const isContinuationLine = (line: string): boolean => {
  if (line.trim().length === 0) {
    return false;
  }
  return CONTINUATION.test(line);
};

export const extendMultiline = (
  match: TodoMatch,
  following: readonly string[],
  maxLines: number,
): TodoMatch => {
  const extra: string[] = [];
  const limit = Math.min(maxLines, following.length);
  for (let index = 0; index < limit; index += 1) {
    const line = following[index] ?? "";
    if (!isContinuationLine(line)) {
      break;
    }
    if (MARKDOWN_LINE.test(line)) {
      break;
    }
    extra.push(line.trim().replace(/^(?:\*|\/\/|\/\*|#|--|')\s?/, "").replace(/\*\/\s*$/, ""));
    if (line.includes("*/")) {
      break;
    }
  }
  if (extra.length === 0) {
    return match;
  }
  const text = [match.text, ...extra.map((line) => line.trim())].filter((line) => line.length > 0).join(" ");
  return { ...match, text };
};

export const parseLines = (
  lines: readonly string[],
  startLine: number,
  location: SourceLocation,
  matcher: CompiledMatcher,
  options: ParseOptions,
): TodoMatch[] => {
  const matches: TodoMatch[] = [];
  for (let offset = 0; offset < lines.length; offset += 1) {
    const line = lines[offset] ?? "";
    const parsed = parseLine(line, startLine + offset, location, matcher, options);
    if (!options.multiline) {
      matches.push(...parsed);
      continue;
    }
    const following = lines.slice(offset + 1, offset + 1 + options.multilineMaxLines);
    matches.push(...parsed.map((match) => extendMultiline(match, following, options.multilineMaxLines)));
  }
  return matches;
};
