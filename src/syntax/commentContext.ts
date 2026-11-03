import type { CommentSyntax } from "./languages";

export interface CommentContext {
  /** The tag sits inside a comment (or a line that can only be comment text). */
  inComment: boolean;
  /** Column where the comment token starts, or the first non-blank column. */
  commentStart: number;
  /** Comment token that opened the comment, when one was found on this line. */
  token?: string;
  /** Closing token for a block comment opened on this line. */
  blockClose?: string;
  /** Nothing but comment punctuation sits between the comment token and the tag. */
  direct: boolean;
}

const LEGACY_LEAD = /(?:\/\/\/?|\/\*|<!--|--|#|;|%|@\*|\(\*|(?:^|\s)'|(?:^|\s)\*)\s*$/;

const PUNCTUATION_ONLY = /^[\s/*!#<>\-;%'@{}()]*$/;

const findStringEnd = (line: string, start: number, quote: string): number => {
  for (let index = start + 1; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === quote) {
      return index;
    }
  }
  return -1;
};

const firstNonBlank = (line: string): number => {
  const found = /\S/.exec(line);
  return found ? found.index : 0;
};

/**
 * Fallback for files with an unknown language: the tag must follow a common
 * comment token directly, as in Todo Tree.
 */
export const legacyCommentContext = (line: string, index: number): CommentContext => {
  const prefix = line.slice(0, index);
  if (/^\s*$/.test(prefix)) {
    return { inComment: true, commentStart: firstNonBlank(line), direct: true };
  }
  if (/["`]$/.test(prefix)) {
    return { inComment: false, commentStart: index, direct: false };
  }
  const lead = LEGACY_LEAD.exec(prefix);
  if (!lead) {
    return { inComment: false, commentStart: index, direct: false };
  }
  const start = lead.index + (lead[0].length - lead[0].trimStart().length);
  return { inComment: true, commentStart: start, token: lead[0].trim(), direct: true };
};

/**
 * Walks the line up to `index`, skipping string literals, and reports whether
 * `index` falls inside a comment. A quote with no closing partner on the same
 * line is treated as an apostrophe, so prose such as "don't" does not hide a
 * later comment.
 */
export const commentContextAt = (
  line: string,
  index: number,
  syntax: CommentSyntax | undefined,
): CommentContext => {
  if (!syntax) {
    return legacyCommentContext(line, index);
  }
  const trimmed = line.trimStart();
  const hasCBlock = syntax.block.some(([open]) => open === "/*" || open === "{/*");
  if (hasCBlock && trimmed.startsWith("*") && !trimmed.startsWith("*/")) {
    // Continuation line of a /* ... */ block such as " * TODO: ...".
    const start = firstNonBlank(line);
    if (start < index) {
      const between = line.slice(start + 1, index);
      return { inComment: true, commentStart: start, token: "*", direct: PUNCTUATION_ONLY.test(between) };
    }
  }

  let position = 0;
  let blockClose: string | undefined;
  let commentStart = -1;
  let token: string | undefined;
  outer: while (position < index) {
    if (blockClose) {
      if (line.startsWith(blockClose, position)) {
        position += blockClose.length;
        blockClose = undefined;
        commentStart = -1;
        token = undefined;
        continue;
      }
      position += 1;
      continue;
    }
    for (const lead of syntax.line) {
      if (line.startsWith(lead, position)) {
        const between = line.slice(position + lead.length, index);
        return { inComment: true, commentStart: position, token: lead, direct: PUNCTUATION_ONLY.test(between) };
      }
    }
    for (const [open, close] of syntax.block) {
      if (line.startsWith(open, position)) {
        blockClose = close;
        commentStart = position;
        token = open;
        position += open.length;
        continue outer;
      }
    }
    const char = line[position] ?? "";
    if (syntax.strings.includes(char)) {
      const end = findStringEnd(line, position, char);
      if (end >= index) {
        return { inComment: false, commentStart: index, direct: false };
      }
      if (end > position) {
        position = end + 1;
        continue;
      }
    }
    position += 1;
  }

  if (blockClose && commentStart >= 0) {
    const between = line.slice(commentStart + (token?.length ?? 0), index);
    return { inComment: true, commentStart, token, blockClose, direct: PUNCTUATION_ONLY.test(between) };
  }
  if (/^\s*$/.test(line.slice(0, index))) {
    // Nothing before the tag: inside a multi-line comment or a plain text file.
    return { inComment: true, commentStart: firstNonBlank(line), direct: true };
  }
  return { inComment: false, commentStart: index, direct: false };
};
