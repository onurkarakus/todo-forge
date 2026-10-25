import type { TodoMatch, TrackedTask } from "../types";
import type { ViewNode } from "./grouping";
import { tasksToMarkdown } from "../tasks/markdownExport";

const walk = (node: ViewNode, depth: number, lines: string[]): void => {
  if (node.kind === "empty") {
    lines.push("No TODOs found.");
    return;
  }
  if (node.kind === "match" && node.match) {
    const match = node.match;
    const box = match.kind === "markdown" ? (match.markdownChecked ? "x" : " ") : " ";
    lines.push(
      `${"  ".repeat(depth)}- [${box}] ${match.relativePath}:${match.line + 1} ${node.label}`,
    );
    return;
  }
  const suffix = node.count > 0 ? ` (${node.count})` : "";
  const heading = depth === 0 ? `# ${node.label}${suffix}` : `${"#".repeat(Math.min(depth + 1, 6))} ${node.label}${suffix}`;
  lines.push(heading, "");
  for (const child of node.children) {
    walk(child, depth + 1, lines);
  }
};

export const treeToMarkdown = (root: ViewNode, tasks: readonly TrackedTask[]): string => {
  const lines: string[] = [];
  walk(root, 0, lines);
  if (tasks.length > 0) {
    lines.push("", tasksToMarkdown(tasks));
  }
  return `${lines.join("\n").trim()}\n`;
};

export const treeToJson = (
  matches: readonly TodoMatch[],
  tasks: readonly TrackedTask[],
): string => {
  return `${JSON.stringify({ matches, tasks }, null, 2)}\n`;
};
