import type { HighlightStyle, TodoMatch } from "../types";

export interface PlainRange {
  line: number;
  start: number;
  end: number;
}

export const highlightSpan = (match: TodoMatch, style: HighlightStyle): PlainRange => {
  if (style === "line") {
    return { line: match.line, start: 0, end: Math.max(match.lineLength, match.endColumn) };
  }
  if (style === "comment") {
    return {
      line: match.line,
      start: match.leadColumn,
      end: Math.max(match.lineLength, match.endColumn),
    };
  }
  return { line: match.line, start: match.column, end: match.endColumn };
};

export const splitDecorationRanges = (
  matches: readonly TodoMatch[],
  style: HighlightStyle,
  visibleStart: number,
  visibleEnd: number,
): { inline: Map<string, PlainRange[]>; ruler: Map<string, PlainRange[]> } => {
  const inline = new Map<string, PlainRange[]>();
  const ruler = new Map<string, PlainRange[]>();
  for (const match of matches) {
    const span = highlightSpan(match, style);
    const rulerList = ruler.get(match.tag) ?? [];
    rulerList.push(span);
    ruler.set(match.tag, rulerList);
    if (match.line >= visibleStart && match.line <= visibleEnd) {
      const inlineList = inline.get(match.tag) ?? [];
      inlineList.push(span);
      inline.set(match.tag, inlineList);
    }
  }
  return { inline, ruler };
};
