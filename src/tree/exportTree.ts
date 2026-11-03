import type { TodoMatch } from "../types";
import type { ViewNode } from "./grouping";

const walk = (node: ViewNode, depth: number, lines: string[]): void => {
  if (node.kind === "match" && node.match) {
    const match = node.match;
    const box = match.kind === "markdown" && match.markdownChecked ? "x" : " ";
    lines.push(`${"  ".repeat(Math.max(0, depth - 1))}- [${box}] ${node.label} (${match.relativePath}:${match.line + 1})`);
    return;
  }
  if (depth > 0) {
    lines.push("", `${"#".repeat(Math.min(depth + 1, 6))} ${node.label} (${node.count})`, "");
  }
  for (const child of node.children) {
    walk(child, node.kind === "match" ? depth : depth + 1, lines);
  }
};

/** Markdown of the current view, for pasting into notes. Written only where the user saves it. */
export const treeToMarkdown = (root: ViewNode, title = "TODOs"): string => {
  const lines: string[] = [`# ${title} (${root.count})`];
  if (root.children.length === 0) {
    lines.push("", "No TODOs found.");
  }
  for (const child of root.children) {
    walk(child, 1, lines);
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
};

export const treeToJson = (matches: readonly TodoMatch[]): string => {
  const rows = matches.map((match) => ({
    tag: match.tag,
    text: match.text,
    file: match.relativePath,
    line: match.line + 1,
    column: match.column + 1,
    kind: match.kind,
    ...(match.meta?.owner ? { owner: match.meta.owner } : {}),
    ...(match.meta?.due ? { due: match.meta.due } : {}),
    ...(match.meta?.priority ? { priority: match.meta.priority } : {}),
    ...(match.meta && match.meta.labels.length > 0 ? { labels: match.meta.labels } : {}),
    ...(match.subTag ? { subTag: match.subTag } : {}),
  }));
  return `${JSON.stringify(rows, null, 2)}\n`;
};
