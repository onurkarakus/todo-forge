import * as vscode from "vscode";

import { codiconFor } from "../highlighting/icons";
import { dueHint } from "../highlighting/hints";
import { styleForTag } from "../highlighting/palette";
import { themeColorId } from "../highlighting/decorationFactory";
import { todoCard, type CardContext } from "../features/todoCard";
import type { PinnedTodo, TodoForgeSettings, TodoMatch } from "../types";
import { elementId, type PinElement, type PinsRootElement, type TreeElement, type ViewElement } from "./elements";
import { indexNodes, type ViewNode } from "./grouping";
import { ageInDays, formatAge } from "./query";
import { changedNodeIds, signTree, type NodeSignature } from "./treeDiff";

export const MIME_PIN = "application/vnd.todoforge.pin";
export const MIME_MATCH = "application/vnd.todoforge.match";

export interface TreeDecorators {
  card: (match: TodoMatch) => CardContext;
  isPinned: (match: TodoMatch) => boolean;
  ticketUrl?: (match: TodoMatch) => string | undefined;
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

/** Everything about a TODO that its tree item shows: label parts, icon, description and tooltip. */
const matchSignature = (match: TodoMatch, decorators: TreeDecorators): string => {
  const card = decorators.card(match);
  return JSON.stringify([
    match.tag,
    match.text,
    match.raw,
    match.line,
    match.column,
    match.relativePath,
    match.kind,
    match.markdownChecked,
    match.meta,
    card.today,
    card.isNew,
    card.isUncommitted,
    card.pinned,
    card.blame?.sha,
    card.blame?.author,
    card.blame?.time,
    ageInDays(card.blame, card.nowSeconds),
    decorators.ticketUrl?.(match),
  ]);
};

/** Expanded/collapsed defaults depend on the total; a change of bucket repaints everything. */
const sizeBucket = (total: number): number => (total <= 40 ? 0 : total <= 200 ? 1 : 2);

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
  // VS Code tracks tree elements by object identity, so each id keeps one element
  // object whose node is swapped in place. Firing that object refreshes just that item.
  private readonly viewElements = new Map<string, ViewElement>();
  private readonly pinElements = new Map<string, PinElement>();
  private readonly pinsRoot: PinsRootElement = { type: "pins-root", count: 0 };
  private signatures: Map<string, NodeSignature> | undefined;
  private settingsKey = "";
  private pinsKey = "";
  /** Number of refresh events and how many were partial; read by tests. */
  readonly refreshStats = { full: 0, partial: 0, skipped: 0 };

  setDropHandler(handler: (request: DropRequest) => void): void {
    this.onDropRequest = handler;
  }

  setState(root: ViewNode, pins: readonly PinEntry[], settings: TodoForgeSettings, decorators: TreeDecorators): void {
    const contentOf = (node: ViewNode): string =>
      node.match
        ? `${node.label}|${matchSignature(node.match, decorators)}`
        : `${node.kind}|${node.label}|${node.count}|${node.resourcePath ?? ""}|${node.children[0]?.match?.tag ?? ""}`;
    const signatures = signTree(root, contentOf);
    const settingsKey = JSON.stringify(settings);
    const pinsKey = pins
      .map((entry) => `${entry.pin.id}|${entry.match ? matchSignature(entry.match, decorators) : "-"}`)
      .join("\n");
    const full =
      settingsKey !== this.settingsKey ||
      sizeBucket(root.count) !== sizeBucket(this.root?.count ?? 0) ||
      (pins.length > 0) !== (this.pins.length > 0);
    const plan = full ? "all" : changedNodeIds(this.signatures, signatures, root);
    const pinsChanged = pinsKey !== this.pinsKey;

    this.root = root;
    this.nodes = indexNodes(root);
    this.pins = [...pins];
    this.settings = settings;
    this.decorators = decorators;
    this.signatures = signatures;
    this.settingsKey = settingsKey;
    this.pinsKey = pinsKey;
    this.syncElements();

    if (plan === "all") {
      this.refreshStats.full += 1;
      this.change.fire(undefined);
      return;
    }
    const elements: TreeElement[] = plan
      .map((id) => this.viewElements.get(id))
      .filter((element): element is ViewElement => element !== undefined);
    if (pinsChanged) {
      elements.push(this.pinsRoot);
    }
    if (elements.length === 0) {
      this.refreshStats.skipped += 1;
      return;
    }
    this.refreshStats.partial += 1;
    // The typings accept one element; VS Code also takes an array.
    (this.change as vscode.EventEmitter<TreeElement | TreeElement[] | undefined>).fire(elements);
  }

  private syncElements(): void {
    for (const [id, element] of this.viewElements) {
      const node = this.nodes.get(id);
      if (node) {
        element.node = node;
      } else {
        this.viewElements.delete(id);
      }
    }
    this.pinsRoot.count = this.pins.length;
    const pinIds = new Set<string>();
    for (const entry of this.pins) {
      pinIds.add(entry.pin.id);
      const element = this.pinElements.get(entry.pin.id);
      if (element) {
        element.pin = entry.pin;
        element.match = entry.match;
      }
    }
    for (const id of this.pinElements.keys()) {
      if (!pinIds.has(id)) {
        this.pinElements.delete(id);
      }
    }
  }

  private viewElement(node: ViewNode): ViewElement {
    const existing = this.viewElements.get(node.id);
    if (existing) {
      existing.node = node;
      return existing;
    }
    const element: ViewElement = { type: "view", node };
    this.viewElements.set(node.id, element);
    return element;
  }

  private pinElement(entry: PinEntry): PinElement {
    const existing = this.pinElements.get(entry.pin.id);
    if (existing) {
      existing.pin = entry.pin;
      existing.match = entry.match;
      return existing;
    }
    const element: PinElement = { type: "pin", pin: entry.pin, match: entry.match };
    this.pinElements.set(entry.pin.id, element);
    return element;
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
      return parent ? this.viewElement(parent) : undefined;
    }
    if (element.type === "pin") {
      return this.pinsRoot;
    }
    return undefined;
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      const roots: TreeElement[] = [];
      const hasMatches = (this.root?.children.length ?? 0) > 0;
      if (this.pins.length > 0) {
        roots.push(this.pinsRoot);
      }
      if (hasMatches && this.root) {
        roots.push(...this.root.children.map((node) => this.viewElement(node)));
      }
      return roots;
    }
    if (element.type === "view") {
      return element.node.children.map((node) => this.viewElement(node));
    }
    if (element.type === "pins-root") {
      return this.pins.map((entry) => this.pinElement(entry));
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
    return node ? this.viewElement(node) : undefined;
  }

  findMatchElement(matchId: string): TreeElement | undefined {
    for (const node of this.nodes.values()) {
      if (node.match?.id === matchId) {
        return this.viewElement(node);
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
      if (!element.match) {
        return "pin-missing";
      }
      return this.decorators?.ticketUrl?.(element.match) ? "pin-ticket" : "pin";
    }
    const node = element.node;
    if (node.match) {
      const pinned = this.decorators?.isPinned(node.match) ? "-pinned" : "";
      const ticket = this.decorators?.ticketUrl?.(node.match) ? "-ticket" : "";
      return node.match.kind === "markdown" ? `markdown${pinned}${ticket}` : node.match.kind === "code" ? `code${pinned}${ticket}` : `match${pinned}${ticket}`;
    }
    return node.kind;
  }
}
