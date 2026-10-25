import type { TrackedTask } from "../types";
import { sortTasks } from "./model";

export const tasksToMarkdown = (tasks: readonly TrackedTask[]): string => {
  const lines = ["# My Tasks", ""];
  for (const task of sortTasks(tasks)) {
    const box = task.done ? "x" : " ";
    const due = task.dueDate ? ` (due ${task.dueDate})` : "";
    lines.push(`- [${box}] ${task.title}${due} — ${task.priority}`);
    if (task.note.trim()) {
      lines.push("", task.note.trim(), "");
    }
    const subtasks = [...task.subtasks].sort((left, right) => left.order - right.order);
    for (const subtask of subtasks) {
      lines.push(`  - [${subtask.done ? "x" : " "}] ${subtask.title}`);
    }
    for (const source of task.sources) {
      lines.push(`  - source: ${source.uri}:${source.line + 1} ${source.tag}`);
    }
  }
  if (tasks.length === 0) {
    lines.push("No tracked tasks.");
  }
  return lines.join("\n");
};
