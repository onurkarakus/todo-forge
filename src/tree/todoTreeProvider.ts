import * as vscode from "vscode";

import type { TodoMatch, TrackedTask } from "../types";
import { sortTasks } from "../tasks/model";
import { codiconFor } from "../highlighting/icons";
import { paletteIndex, styleForTag } from "../highlighting/palette";
import type { TodoForgeSettings } from "../types";
import { elementId, type TreeElement } from "./elements";
import { indexNodes, type ViewNode } from "./grouping";

export const MIME_TASK = "application/vnd.todoforge.task";
export const MIME_MATCH = "application/vnd.todoforge.match";

export interface DropRequest {
  mime: typeof MIME_TASK | typeof MIME_MATCH;
  draggedId: string;
  parentId?: string;
  target: TreeElement | undefined;
}

export class TodoTreeProvider
  implements vscode.TreeDataProvider<TreeElement>, vscode.TreeDragAndDropController<TreeElement>
{
  readonly dropMimeTypes = [MIME_TASK, MIME_MATCH];
  readonly dragMimeTypes = [MIME_TASK, MIME_MATCH];
  private readonly change = new vscode.EventEmitter<TreeElement | undefined>();
  readonly onDidChangeTreeData = this.change.event;
  private found: ViewNode | undefined;
  private nodes = new Map<string, ViewNode>();
  private tasks: TrackedTask[] = [];
  private settings: TodoForgeSettings | undefined;
  private onDropRequest: (request: DropRequest) => void = () => undefined;

  setDropHandler(handler: (request: DropRequest) => void): void {
    this.onDropRequest = handler;
  }

  setState(found: ViewNode, tasks: readonly TrackedTask[], settings: TodoForgeSettings): void {
    this.found = found;
    this.nodes = indexNodes(found);
    this.tasks = sortTasks(tasks);
    this.settings = settings;
    this.change.fire(undefined);
  }

  getParent(element: TreeElement): TreeElement | undefined {
    if (element.type === "view") {
      const parentId = element.node.parentId;
      if (!parentId) {
        return undefined;
      }
      const parent = this.nodes.get(parentId);
      return parent ? { type: "view", node: parent } : undefined;
    }
    if (element.type === "task" || element.type === "tasks-empty") {
      return { type: "tasks-root", count: this.tasks.length };
    }
    if (element.type === "subtask") {
      const task = this.tasks.find((item) => item.id === element.taskId);
      return task ? { type: "task", task } : { type: "tasks-root", count: this.tasks.length };
    }
    return undefined;
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      const roots: TreeElement[] = [];
      if (this.found) {
        roots.push({ type: "view", node: this.found });
      }
      if (this.settings?.tasksEnabled) {
        roots.push({ type: "tasks-root", count: this.tasks.length });
      }
      return roots;
    }
    if (element.type === "view") {
      return element.node.children.map((node) => ({ type: "view", node }));
    }
    if (element.type === "tasks-root") {
      if (this.tasks.length === 0) {
        return [{ type: "tasks-empty" }];
      }
      return this.tasks.map((task) => ({ type: "task", task }));
    }
    if (element.type === "task") {
      return [...element.task.subtasks]
        .sort((left, right) => left.order - right.order)
        .map((subtask) => ({ type: "subtask", taskId: element.task.id, subtask }));
    }
    return [];
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    const item = new vscode.TreeItem(this.label(element), this.collapsible(element));
    item.id = elementId(element);
    item.contextValue = this.contextValue(element);
    const match = this.matchOf(element);
    if (match) {
      item.command = {
        command: "todoforge.openMatch",
        title: "Open TODO",
        arguments: [match.id],
      };
      item.description = `${match.relativePath}:${match.line + 1}`;
      item.iconPath = new vscode.ThemeIcon(this.iconFor(match.tag));
      item.checkboxState = match.kind === "markdown"
        ? match.markdownChecked
          ? vscode.TreeItemCheckboxState.Checked
          : vscode.TreeItemCheckboxState.Unchecked
        : undefined;
    }
    if (element.type === "task") {
      item.description = this.taskDescription(element.task);
      item.iconPath = new vscode.ThemeIcon(element.task.done ? "pass" : "circle-outline");
      item.checkboxState = element.task.done
        ? vscode.TreeItemCheckboxState.Checked
        : vscode.TreeItemCheckboxState.Unchecked;
    }
    if (element.type === "subtask") {
      item.iconPath = new vscode.ThemeIcon("indent");
      item.checkboxState = element.subtask.done
        ? vscode.TreeItemCheckboxState.Checked
        : vscode.TreeItemCheckboxState.Unchecked;
    }
    if (element.type === "tasks-root") {
      item.iconPath = new vscode.ThemeIcon("pin");
    }
    if (element.type === "view" && element.node.kind === "root") {
      item.iconPath = new vscode.ThemeIcon("search");
    }
    if (element.type === "view" && (element.node.kind === "folder" || element.node.kind === "file")) {
      item.iconPath = new vscode.ThemeIcon(element.node.kind === "file" ? "file" : "folder");
      item.resourceUri = element.node.kind === "file" && element.node.resourcePath
        ? vscode.Uri.parse(element.node.resourcePath)
        : undefined;
    }
    return item;
  }

  handleDrag(source: readonly TreeElement[], dataTransfer: vscode.DataTransfer): void {
    const element = source[0];
    if (!element) {
      return;
    }
    if (element.type === "task") {
      dataTransfer.set(MIME_TASK, new vscode.DataTransferItem(JSON.stringify({ id: element.task.id })));
    }
    if (element.type === "subtask") {
      dataTransfer.set(
        MIME_TASK,
        new vscode.DataTransferItem(JSON.stringify({ id: element.subtask.id, parentId: element.taskId })),
      );
    }
    if (element.type === "view" && element.node.match) {
      dataTransfer.set(MIME_MATCH, new vscode.DataTransferItem(element.node.match.id));
    }
  }

  async handleDrop(target: TreeElement | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const taskItem = dataTransfer.get(MIME_TASK);
    if (taskItem) {
      const raw = JSON.parse(await taskItem.asString()) as { id?: string; parentId?: string };
      if (raw.id) {
        this.onDropRequest({ mime: MIME_TASK, draggedId: raw.id, parentId: raw.parentId, target });
      }
      return;
    }
    const matchItem = dataTransfer.get(MIME_MATCH);
    if (matchItem) {
      this.onDropRequest({
        mime: MIME_MATCH,
        draggedId: await matchItem.asString(),
        target,
      });
    }
  }

  findElement(id: string): TreeElement | undefined {
    const node = this.nodes.get(id);
    if (node) {
      return { type: "view", node };
    }
    return undefined;
  }

  private label(element: TreeElement): string {
    if (element.type === "tasks-root") {
      return `My Tasks (${element.count})`;
    }
    if (element.type === "tasks-empty") {
      return "No tracked tasks";
    }
    if (element.type === "task") {
      return element.task.title;
    }
    if (element.type === "subtask") {
      return element.subtask.title;
    }
    const node = element.node;
    if (node.kind === "match" || node.kind === "empty" || node.count === 0) {
      return node.label;
    }
    return `${node.label} (${node.count})`;
  }

  private collapsible(element: TreeElement): vscode.TreeItemCollapsibleState {
    if (element.type === "tasks-empty" || element.type === "subtask") {
      return vscode.TreeItemCollapsibleState.None;
    }
    if (element.type === "view" && (element.node.kind === "match" || element.node.kind === "empty")) {
      return vscode.TreeItemCollapsibleState.None;
    }
    if (element.type === "task" && element.task.subtasks.length === 0) {
      return vscode.TreeItemCollapsibleState.None;
    }
    if (element.type === "tasks-root" || (element.type === "view" && element.node.kind === "root")) {
      return vscode.TreeItemCollapsibleState.Expanded;
    }
    return vscode.TreeItemCollapsibleState.Collapsed;
  }

  private contextValue(element: TreeElement): string {
    if (element.type === "view") {
      if (element.node.match?.kind === "markdown") {
        return "markdown";
      }
      if (element.node.kind === "match") {
        return "match";
      }
      return element.node.kind;
    }
    if (element.type === "tasks-root") {
      return "tasks-root";
    }
    return element.type === "task" ? "task" : element.type === "subtask" ? "subtask" : "empty";
  }

  private matchOf(element: TreeElement): TodoMatch | undefined {
    return element.type === "view" ? element.node.match : undefined;
  }

  private iconFor(tag: string): string {
    const settings = this.settings;
    if (!settings) {
      return "circle-filled";
    }
    return codiconFor(styleForTag(tag, paletteIndex(tag, settings.tags), settings.tagStyles).icon);
  }

  private taskDescription(task: TrackedTask): string {
    const due = task.dueDate ? ` due ${task.dueDate}` : "";
    return `${task.priority}${due}`;
  }
}
