import type { SourceLocation, TodoMatch } from "../types";
import { commentContextAt, legacyCommentContext } from "../syntax/commentContext";
import { isDotnetFile, syntaxFor } from "../syntax/languages";
import { parseMetadata } from "../syntax/metadata";
import { matchId } from "../utils/id";
import { canonicalTag, compileMatcher, type CompiledMatcher } from "../utils/regexBuilder";
import { extractSubTag } from "../utils/subTag";

export interface ParseOptions {
  tags: readonly string[];
  /** Tags that only count when followed by `:` or `(`, such as NOTE. */
  strictTags?: readonly string[];
  caseSensitive: boolean;
  customRegex: string;
  subTagRegex: string;
  markdownEnabled: boolean;
  multiline: boolean;
  multilineMaxLines: number;
  dotnetPatterns?: boolean;
}

const MARKDOWN_LINE = /^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s*(.*)$/;

const CONTINUATION = /^\s*(?:\*|\/\/|\/\*|#|--|')\s?/;

const MARKDOWN_EXTENSIONS = /\.(?:md|markdown|mdx|txt|rst|org)$/i;

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

const cleanText = (value: string): string => {
  return value.replace(/\s*(?:\*\/\}?|\*@|-->|\*\)|-\}|#>)\s*$/g, "").trim();
};

const tagFromMatch = (
  line: string,
  lineNumber: number,
  index: number,
  rawTag: string,
  leadColumn: number,
  location: SourceLocation,
  options: ParseOptions,
): TodoMatch => {
  const tag = canonicalTag(rawTag, options.tags, options.caseSensitive);
  const after = line.slice(index + rawTag.length);
  const meta = parseMetadata(after);
  const extracted = extractSubTag(after.slice(meta.length), options.subTagRegex);
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
    text: cleanText(extracted.text),
    raw: line,
    kind: "tag",
    meta: meta.meta,
  };
};

const codeMatch = (
  line: string,
  lineNumber: number,
  column: number,
  length: number,
  tag: string,
  text: string,
  location: SourceLocation,
): TodoMatch => {
  return {
    id: matchId(location.uri, lineNumber, column, "code", tag),
    uri: location.uri,
    workspaceFolder: location.workspaceFolder,
    relativePath: location.relativePath,
    line: lineNumber,
    column,
    endColumn: column + length,
    leadColumn: column,
    lineLength: line.length,
    tag,
    text,
    raw: line,
    kind: "code",
  };
};

const stringArgument = (rest: string): string | undefined => {
  const found = /^\s*\(\s*@?\$?"((?:[^"\\]|\\.)*)"/.exec(rest);
  return found?.[1];
};

/** True only when a comment token opens before `index`; a blank prefix is code here. */
const inRealComment = (line: string, index: number, syntax: ReturnType<typeof syntaxFor>): boolean => {
  const context = commentContextAt(line, index, syntax);
  return context.inComment && context.token !== undefined;
};

/** .NET patterns that mark unfinished work in code rather than in a comment. */
export const dotnetMatches = (
  line: string,
  lineNumber: number,
  location: SourceLocation,
): TodoMatch[] => {
  const syntax = syntaxFor(location.relativePath);
  const found: TodoMatch[] = [];
  const notImplemented = /\bNotImplementedException\b/.exec(line);
  if (notImplemented && /\b(?:throw|Throw|raise)\b/.test(line.slice(0, notImplemented.index))) {
    if (!inRealComment(line, notImplemented.index, syntax)) {
      const message = stringArgument(line.slice(notImplemented.index + notImplemented[0].length));
      found.push(
        codeMatch(line, lineNumber, notImplemented.index, notImplemented[0].length, "NotImplemented", message ?? "Not implemented", location),
      );
    }
  }
  const obsolete = /[[<]\s*(?:System\.)?Obsolete(?:Attribute)?\b/.exec(line);
  if (obsolete) {
    if (!inRealComment(line, obsolete.index, syntax)) {
      const nameStart = line.indexOf("Obsolete", obsolete.index);
      const message = stringArgument(line.slice(nameStart + "Obsolete".length).replace(/^Attribute/, ""));
      found.push(codeMatch(line, lineNumber, nameStart, "Obsolete".length, "Obsolete", message ?? "Obsolete", location));
    }
  }
  const warning = /^(\s*)#warning\b\s*(.*)$/.exec(line);
  if (warning) {
    const column = (warning[1] ?? "").length;
    found.push(codeMatch(line, lineNumber, column, "#warning".length, "Warning", (warning[2] ?? "").trim(), location));
  }
  return found;
};

const isExplicit = (line: string, end: number): boolean => {
  return /^(?:\([^)]*\))?\s*:|^\(/.test(line.slice(end));
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

  const syntax = syntaxFor(location.relativePath);
  const plainText = MARKDOWN_EXTENSIONS.test(location.relativePath);
  const strict = new Set((options.strictTags ?? []).map((tag) => tag.toLowerCase()));
  const regex = new RegExp(matcher.regex.source, matcher.regex.flags.includes("g") ? matcher.regex.flags : `${matcher.regex.flags}g`);
  const matches: TodoMatch[] = [];
  for (const found of line.matchAll(regex)) {
    const full = found[0] ?? "";
    const fullIndex = found.index ?? -1;
    if (fullIndex < 0 || full.length === 0) {
      continue;
    }
    let rawTag = found.groups?.tag;
    let index: number;
    if (rawTag !== undefined) {
      index = fullIndex + Math.max(0, full.indexOf(rawTag));
    } else {
      const inner = matcher.tagFinder.exec(full);
      if (!inner) {
        continue;
      }
      rawTag = inner[0];
      index = fullIndex + inner.index;
    }
    if (rawTag.length === 0) {
      continue;
    }
    const tag = canonicalTag(rawTag, options.tags, options.caseSensitive);
    const explicit = isExplicit(line, index + rawTag.length);
    if (strict.has(tag.toLowerCase()) && !explicit) {
      continue;
    }
    if (matcher.custom) {
      const lead = legacyCommentContext(line, index);
      matches.push(tagFromMatch(line, lineNumber, index, rawTag, lead.inComment ? lead.commentStart : index, location, options));
      continue;
    }
    const context = plainText
      ? { inComment: true, commentStart: /\S/.exec(line)?.index ?? 0, direct: /^\s*$/.test(line.slice(0, index)) }
      : commentContextAt(line, index, syntax);
    if (!context.inComment) {
      continue;
    }
    if (!context.direct) {
      // Mid-comment tags ("// fix this TODO later") need the exact tag case or a colon.
      const exactCase = rawTag === tag && rawTag === rawTag.toUpperCase();
      if (!explicit && !exactCase) {
        continue;
      }
      if (plainText && !explicit) {
        continue;
      }
    }
    matches.push(tagFromMatch(line, lineNumber, index, rawTag, context.commentStart, location, options));
  }

  if (options.dotnetPatterns && isDotnetFile(location.relativePath)) {
    const code = dotnetMatches(line, lineNumber, location).filter(
      (candidate) => !(candidate.tag === "Warning" && matches.length > 0),
    );
    matches.push(...code);
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
  if (match.kind !== "tag") {
    return match;
  }
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
