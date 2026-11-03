import * as vscode from "vscode";

import type { TodoForgeSettings, TodoMatch } from "../types";
import { matchDescription, matchIcon, type TreeDecorators } from "./todoTreeProvider";
import { todoCard } from "../features/todoCard";

export type ChangesElement =
  | { type: "section"; id: "uncommitted" | "branch"; label: string; matches: TodoMatch[]; detail?: string }
  | { type: "file"; section: string; uri: string; label: string; matches: TodoMatch[] }
  | { type: "match"; section: string; match: TodoMatch };

export interface ChangesState {
  uncommitted: TodoMatch[];
  branch: TodoMatch[];
  baseRef?: string;
}

const byFile = (section: string, matches: readonly TodoMatch[]): ChangesElement[] => {
  const files = new Map<string, TodoMatch[]>();
  for (const match of matches) {
    const list = files.get(match.uri) ?? [];
    list.push(match);
    files.set(match.uri, list);
  }
  return [...files.entries()]
    .map(([uri, list]): ChangesElement => ({
      type: "file",
      section,
      uri,
      label: list[0]?.relativePath ?? uri,
      matches: list.sort((left, right) => left.line - right.line),
    }))
    .sort((left, right) => (left.type === "file" && right.type === "file" ? left.label.localeCompare(right.label) : 0));
};

/**
 * TODOs you are adding: uncommitted lines and lines added on this branch
 * since it left the base branch. Computed from local git only.
 */
export class ChangesProvider implements vscode.TreeDataProvider<ChangesElement> {
  private readonly change = new vscode.EventEmitter<ChangesElement | undefined>();
  readonly onDidChangeTreeData = this.change.event;
  private state: ChangesState = { uncommitted: [], branch: [] };
  private settings: TodoForgeSettings | undefined;
  private decorators: TreeDecorators | undefined;

  setState(state: ChangesState, settings: TodoForgeSettings, decorators: TreeDecorators): void {
    this.state = state;
    this.settings = settings;
    this.decorators = decorators;
    this.change.fire(undefined);
  }

  get total(): number {
    return this.state.uncommitted.length + this.state.branch.length;
  }

  getChildren(element?: ChangesElement): ChangesElement[] {
    if (!element) {
      const sections: ChangesElement[] = [];
      if (this.state.uncommitted.length > 0) {
        sections.push({ type: "section", id: "uncommitted", label: vscode.l10n.t("Uncommitted"), matches: this.state.uncommitted });
      }
      if (this.state.branch.length > 0) {
        sections.push({
          type: "section",
          id: "branch",
          label: vscode.l10n.t("This branch"),
          detail: this.state.baseRef ? vscode.l10n.t("since {0}", this.state.baseRef) : undefined,
          matches: this.state.branch,
        });
      }
      return sections;
    }
    if (element.type === "section") {
      return byFile(element.id, element.matches);
    }
    if (element.type === "file") {
      return element.matches.map((match) => ({ type: "match", section: element.section, match }));
    }
    return [];
  }

  getTreeItem(element: ChangesElement): vscode.TreeItem {
    if (element.type === "section") {
      const item = new vscode.TreeItem(`${element.label} (${element.matches.length})`, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `changes:${element.id}`;
      item.description = element.detail;
      item.iconPath = new vscode.ThemeIcon(element.id === "uncommitted" ? "diff-added" : "git-branch");
      item.contextValue = "changes-section";
      return item;
    }
    if (element.type === "file") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `changes:${element.section}:${element.uri}`;
      item.resourceUri = vscode.Uri.parse(element.uri);
      item.iconPath = vscode.ThemeIcon.File;
      item.description = String(element.matches.length);
      return item;
    }
    const match = element.match;
    const item = new vscode.TreeItem(`${match.tag}: ${match.text || match.raw.trim()}`, vscode.TreeItemCollapsibleState.None);
    item.id = `changes:${element.section}:${match.id}`;
    item.command = { command: "todoforge.openMatch", title: vscode.l10n.t("Open TODO"), arguments: [match.id] };
    item.contextValue = match.kind === "tag" ? "match" : match.kind;
    if (this.settings && this.decorators) {
      const card = this.decorators.card(match);
      item.iconPath = matchIcon(match, this.settings, card.today);
      item.description = matchDescription(match, { showLocation: false, card: { ...card, isNew: false } });
      item.tooltip = todoCard(match, card);
    }
    return item;
  }
}
