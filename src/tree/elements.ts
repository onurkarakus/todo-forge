import type { PinnedTodo, TodoMatch } from "../types";
import type { ViewNode } from "./grouping";

export type TreeElement =
  | { type: "view"; node: ViewNode }
  | { type: "pins-root"; count: number }
  | { type: "pin"; pin: PinnedTodo; match?: TodoMatch };

export const elementId = (element: TreeElement): string => {
  if (element.type === "view") {
    return element.node.id;
  }
  if (element.type === "pins-root") {
    return "root:pins";
  }
  return `pin:${element.pin.id}`;
};

export const isTreeElement = (value: unknown): value is TreeElement => {
  return Boolean(value) && typeof value === "object" && "type" in (value as object);
};
