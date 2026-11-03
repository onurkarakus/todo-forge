import * as vscode from "vscode";

import { codiconFor } from "../highlighting/icons";
import { dueHint } from "../highlighting/hints";
import { styleForTag } from "../highlighting/palette";
import { themeColorId } from "../highlighting/decorationFactory";
import { todoCard, type CardContext } from "../features/todoCard";
import type { PinnedTodo, TodoForgeSettings, TodoMatch } from "../types";
import { elementId, type TreeElement } from "./elements";
import { indexNodes, type ViewNode } from "./grouping";
import { ageInDays, formatAge } from "./query";

export const MIME_PIN = "application/vnd.todoforge.pin";
export const MIME_MATCH = "application/vnd.todoforge.match";

export interface TreeDecorators {
  card: (match: TodoMatch) => CardContext;
  isPinned: (match: TodoMatch) => boolean;
}

export interface PinEntry {
  pin: PinnedTodo;
  match?: TodoMatch;
}

export interface DropRequest {
  kind: "pin" | "match";
  draggedId: string;
  target: TreeElement | undefined;
}

export const matchIcon = (match: TodoMatch, settings: TodoForgeSettings, today: string): vscode.ThemeIcon => {
  const style = styleForTag(match.kind === "markdown" ? "MARKDOWN" : match.tag, settings.tags, settings.tagStyles);
  if (dueHint(match, today)?.tone === "overdue") {
    return new vscode.ThemeIcon("warning", new vscode.ThemeColor("todoforge.overdueForeground"));
  }
  const color = style.themeKey ? new vscode.ThemeColor(themeColorId(style.themeKey, "Foreground")) : undefined;
  return new vscode.ThemeIcon(codiconFor(style.icon), color);
};

/** Short description: location (unless grouped by file), due hint and age. */
export const matchDescription = (
  match: TodoMatch,
  options: { showLocation: boolean; card: CardContext },
): string => {
  const parts: string[] = [];
  if (options.showLocation) {
    parts.push(`${match.relativePath.split("/").pop() ?? match.relativePath}:${match.line + 1}`);
  }
  const due = dueHint(match, options.card.today);
  if (due) {
    parts.push(
      due.tone === "overdue"
        ? vscode.l10n.t("overdue {0}d", -due.days)
        : due.tone === "today"
          ? vscode.l10n.t("due today")
          : vscode.l10n.t("due in {0}d", due.days),
    );
  }
  if (match.meta?.owner) {
    parts.push(`@${match.meta.owner}`);
  }
  const age = ageInDays(options.card.blame, options.card.nowSeconds);
  if (age !== undefined) {
    parts.push(formatAge(age));
  } else if (options.card.isNew) {
    parts.push(vscode.l10n.t("new"));
  }
  return parts.join(" · ");
};

export class TodoTreeProvider
  implements vscode.TreeDataProvider<TreeElement>, vscode.TreeDragAndDropController<TreeElement>
{
  readonly dropMimeTypes = [MIME_PIN, MIME_MATCH];
  readonly dragMimeTypes = [MIME_PIN, MIME_MATCH];
  private readonly change = new vscode.EventEmitter<TreeElement | undefined>();
  readonly onDidChangeTreeData = this.change.event;
  private root: ViewNode | undefined;
  private nodes = new Map<string, ViewNode>();
  private pins: PinEntry[] = [];
  private settings: TodoForgeSettings | undefined;
  private decorators: TreeDecorators | undefined;
  private onDropRequest: (request: DropRequest) => void = () => undefined;

  setDropHandler(handler: (request: DropRequest) => void): void {
    this.onDropRequest = handler;
  }

  setState(root: ViewNode, pins: readonly PinEntry[], settings: TodoForgeSettings, decorators: TreeDecorators): void {
    this.root = root;
    this.nodes = indexNodes(root);
    this.pins = [...pins];
    this.settings = settings;
    this.decorators = decorators;
    this.change.fire(undefined);
  }

  get rootNode(): ViewNode | undefined {
    return this.root;
  }

  getParent(element: TreeElement): TreeElement | undefined {
    if (element.type === "view") {
      const parentId = element.node.parentId;
      if (!parentId || parentId === this.root?.id) {
        return undefined;
      }
      const parent = this.nodes.get(parentId);
      return parent ? { type: "view", node: parent } : undefined;
    }
    if (element.type === "pin") {
      return { type: "pins-root", count: this.pins.length };
    }
    return undefined;
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      const roots: TreeElement[] = [];
      const hasMatches = (this.root?.children.length ?? 0) > 0;
      if (this.pins.length > 0) {
        roots.push({ type: "pins-root", count: this.pins.length });
      }
      if (hasMatches && this.root) {
        roots.push(...this.root.children.map((node): TreeElement => ({ type: "view", node })));
      }
      return roots;
    }
    if (element.type === "view") {
      return element.node.children.map((node) => ({ type: "view", node }));
    }
    if (element.type === "pins-root") {
      return this.pins.map((entry) => ({ type: "pin", pin: entry.pin, match: entry.match }));
    }
    return [];
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    const item = new vscode.TreeItem(this.label(element), this.collapsible(element));
    item.id = elementId(element);
    item.contextValue = this.contextValue(element);
    const match = element.type === "view" ? element.node.match : element.type === "pin" ? element.match : undefined;
    const settings = this.settings;
    if (match && settings && this.decorators) {
      const card = this.decorators.card(match);
      item.command = { command: "todoforge.openMatch", title: vscode.l10n.t("Open TODO"), arguments: [match.id] };
      item.description = matchDescription(match, {
        showLocation: element.type === "pin" || settings.groupBy !== "file",
        card,
      });
      item.iconPath = element.type === "pin" ? new vscode.ThemeIcon("pinned") : matchIcon(match, settings, card.today);
      item.tooltip = todoCard(match, card);
      item.checkboxState =
        match.kind === "markdown"
          ? match.markdownChecked
            ? vscode.TreeItemCheckboxState.Checked
            : vscode.TreeItemCheckboxState.Unchecked
          : undefined;
      item.accessibilityInformation = { label: `${match.tag} ${match.text}, ${match.relativePath} line ${match.line + 1}` };
    }
    if (element.type === "pin" && !element.match) {
      item.iconPath = new vscode.ThemeIcon("pinned-dirty");
      item.description = vscode.l10n.t("moved or removed");
      item.tooltip = vscode.l10n.t("This pinned TODO was not found in {0}. It may have been resolved.", element.pin.relativePath);
    }
    if (element.type === "pins-root") {
      item.iconPath = new vscode.ThemeIcon("pinned");
    }
    if (element.type === "view") {
      const node = element.node;
      if (node.kind === "workspace") {
        item.iconPath = new vscode.ThemeIcon("root-folder");
      } else if (node.kind === "folder") {
        item.iconPath = vscode.ThemeIcon.Folder;
        if (node.workspaceFolder && node.resourcePath) {
          item.resourceUri = vscode.Uri.joinPath(vscode.Uri.file(node.workspaceFolder), node.resourcePath);
        }
      } else if (node.kind === "file" && node.resourcePath) {
        item.iconPath = vscode.ThemeIcon.File;
        item.resourceUri = vscode.Uri.parse(node.resourcePath);
      } else if (node.kind === "group" && settings) {
        const tag = node.children[0]?.match?.tag ?? node.label;
        if (node.id.startsWith("tag:")) {
          const style = styleForTag(tag, settings.tags, settings.tagStyles);
          item.iconPath = new vscode.ThemeIcon(
            codiconFor(style.icon),
            style.themeKey ? new vscode.ThemeColor(themeColorId(style.themeKey, "Foreground")) : undefined,
          );
        } else if (node.id.startsWith("owner:")) {
          item.iconPath = new vscode.ThemeIcon("person");
        } else if (node.id === "group:markdown") {
          item.iconPath = new vscode.ThemeIcon("markdown");
        } else {
          item.iconPath = new vscode.ThemeIcon("tag");
        }
      }
    }
    return item;
  }

  handleDrag(source: readonly TreeElement[], dataTransfer: vscode.DataTransfer): void {
    const element = source[0];
    if (element?.type === "pin") {
      dataTransfer.set(MIME_PIN, new vscode.DataTransferItem(element.pin.id));
    }
    if (element?.type === "view" && element.node.match) {
      dataTransfer.set(MIME_MATCH, new vscode.DataTransferItem(element.node.match.id));
    }
  }

  async handleDrop(target: TreeElement | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const pinItem = dataTransfer.get(MIME_PIN);
    if (pinItem) {
      this.onDropRequest({ kind: "pin", draggedId: await pinItem.asString(), target });
      return;
    }
    const matchItem = dataTransfer.get(MIME_MATCH);
    if (matchItem && (target?.type === "pins-root" || target?.type === "pin")) {
      this.onDropRequest({ kind: "match", draggedId: await matchItem.asString(), target });
    }
  }

  findElement(id: string): TreeElement | undefined {
    const node = this.nodes.get(id);
    return node ? { type: "view", node } : undefined;
  }

  findMatchElement(matchId: string): TreeElement | undefined {
    for (const node of this.nodes.values()) {
      if (node.match?.id === matchId) {
        return { type: "view", node };
      }
    }
    return undefined;
  }

  private label(element: TreeElement): string | vscode.TreeItemLabel {
    if (element.type === "pins-root") {
      return vscode.l10n.t("Pinned ({0})", element.count);
    }
    if (element.type === "pin") {
      const match = element.match;
      return match ? `${match.tag}: ${match.text || match.raw.trim()}` : `${element.pin.tag}: ${element.pin.text}`;
    }
    const node = element.node;
    if (node.kind === "match" || node.kind === "empty") {
      return node.label;
    }
    return `${node.label} (${node.count})`;
  }

  private collapsible(element: TreeElement): vscode.TreeItemCollapsibleState {
    if (element.type === "pin") {
      return vscode.TreeItemCollapsibleState.None;
    }
    if (element.type === "pins-root") {
      return vscode.TreeItemCollapsibleState.Expanded;
    }
    const node = element.node;
    if (node.kind === "match" || node.kind === "empty") {
      return vscode.TreeItemCollapsibleState.None;
    }
    if (node.kind === "workspace") {
      return vscode.TreeItemCollapsibleState.Expanded;
    }
    // Small trees open fully; large ones start with top-level groups collapsed.
    const total = this.root?.count ?? 0;
    if (total <= 40 || (node.kind === "group" && !node.parentId?.startsWith("tag-group") && total <= 200)) {
      return vscode.TreeItemCollapsibleState.Expanded;
    }
    return vscode.TreeItemCollapsibleState.Collapsed;
  }

  private contextValue(element: TreeElement): string {
    if (element.type === "pins-root") {
      return "pins-root";
    }
    if (element.type === "pin") {
      return element.match ? "pin" : "pin-missing";
    }
    const node = element.node;
    if (node.match) {
      const pinned = this.decorators?.isPinned(node.match) ? "-pinned" : "";
      return node.match.kind === "markdown" ? `markdown${pinned}` : node.match.kind === "code" ? `code${pinned}` : `match${pinned}`;
    }
    return node.kind;
  }
}
