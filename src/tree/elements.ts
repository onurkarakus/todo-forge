import type { Subtask, TrackedTask } from "../types";
import type { ViewNode } from "./grouping";

export type TreeElement =
  | { type: "view"; node: ViewNode }
  | { type: "tasks-root"; count: number }
  | { type: "task"; task: TrackedTask }
  | { type: "subtask"; taskId: string; subtask: Subtask }
  | { type: "tasks-empty" };

export const elementId = (element: TreeElement): string => {
  if (element.type === "view") {
    return element.node.id;
  }
  if (element.type === "tasks-root") {
    return "root:tasks";
  }
  if (element.type === "task") {
    return `task:${element.task.id}`;
  }
  if (element.type === "subtask") {
    return `subtask:${element.taskId}:${element.subtask.id}`;
  }
  return "tasks:empty";
};
