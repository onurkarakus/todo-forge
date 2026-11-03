import { commentContextAt } from "./commentContext";
import type { CommentSyntax } from "./languages";

export type Removal =
  | { kind: "line" }
  | { kind: "range"; start: number; end: number; replacement: string };

/**
 * How to remove the TODO at `column`:
 * - a line holding only the comment is deleted;
 * - a trailing comment after code is cut back to the code;
 * - a block comment closed on the same line keeps the code after it.
 * Returns undefined when the tag is not inside a comment.
 */
export const planRemoval = (line: string, column: number, syntax: CommentSyntax | undefined): Removal | undefined => {
  const context = commentContextAt(line, column, syntax);
  if (!context.inComment) {
    return undefined;
  }
  const start = context.commentStart;
  let end = line.length;
  if (context.blockClose) {
    const close = line.indexOf(context.blockClose, column);
    if (close >= 0) {
      end = close + context.blockClose.length;
    }
  }
  const before = line.slice(0, start);
  const after = line.slice(end);
  if (before.trim().length === 0 && after.trim().length === 0) {
    return { kind: "line" };
  }
  const trimmedStart = before.trimEnd().length;
  if (after.trim().length === 0) {
    return { kind: "range", start: trimmedStart, end: line.length, replacement: "" };
  }
  const separator = before.trim().length > 0 && !/^\s/.test(after) ? " " : "";
  return {
    kind: "range",
    start: before.trim().length === 0 ? start : trimmedStart,
    end: before.trim().length === 0 ? end + (after.length - after.trimStart().length) : end,
    replacement: separator,
  };
};

/** Builds a new TODO comment line for the given syntax and indentation. */
export const buildTodoLine = (
  indent: string,
  syntax: Pick<CommentSyntax, "insert" | "insertClose"> | undefined,
  body: string,
): string => {
  const open = syntax?.insert ?? "//";
  const close = syntax?.insertClose ?? "";
  return `${indent}${open} ${body}${close}`;
};
