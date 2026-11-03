import * as vscode from "vscode";

import { dueHint } from "../highlighting/hints";
import { formatAge, ageInDays } from "../tree/query";
import type { BlameInfo, TodoMatch } from "../types";

export interface CardContext {
  today: string;
  nowSeconds: number;
  staleAfterDays: number;
  blame?: BlameInfo;
  isNew?: boolean;
  isUncommitted?: boolean;
  pinned?: boolean;
  /** Adds command links (pin, snooze, priority, remove). */
  actions?: boolean;
}

export const CARD_COMMANDS = [
  "todoforge.pin",
  "todoforge.unpin",
  "todoforge.snooze",
  "todoforge.setDueDate",
  "todoforge.setPriority",
  "todoforge.removeTodo",
  "todoforge.revealInTree",
  "todoforge.mute",
];

const commandLink = (title: string, command: string, args: unknown[]): string => {
  return `[${title}](command:${command}?${encodeURIComponent(JSON.stringify(args))})`;
};

/** Escapes Markdown and theme-icon syntax in user text. */
const escape = (value: string): string => value.replace(/([\\`*_[\]<>|])/g, "\\$1").replace(/\$\(/g, "\\$(");

const relativeDue = (match: TodoMatch, today: string): string | undefined => {
  const hint = dueHint(match, today);
  if (!hint || !match.meta?.due) {
    return undefined;
  }
  if (hint.tone === "overdue") {
    return vscode.l10n.t("{0} (overdue by {1} days)", match.meta.due, -hint.days);
  }
  if (hint.tone === "today") {
    return vscode.l10n.t("{0} (today)", match.meta.due);
  }
  return vscode.l10n.t("{0} (in {1} days)", match.meta.due, hint.days);
};

const priorityLabel = (priority: string): string => {
  if (priority === "high") {
    return vscode.l10n.t("High");
  }
  if (priority === "medium") {
    return vscode.l10n.t("Medium");
  }
  return vscode.l10n.t("Low");
};

/** The rich card shown in editor hovers and tree tooltips. */
export const todoCard = (match: TodoMatch, context: CardContext): vscode.MarkdownString => {
  const markdown = new vscode.MarkdownString(undefined, true);
  markdown.supportThemeIcons = true;
  if (context.actions) {
    markdown.isTrusted = { enabledCommands: CARD_COMMANDS };
  }
  const text = match.text || match.raw.trim();
  markdown.appendMarkdown(`**${escape(match.tag)}** ${escape(text)}\n\n`);
  const rows: string[] = [];
  if (match.meta?.owner) {
    rows.push(`$(person) ${vscode.l10n.t("Owner")}: **${escape(match.meta.owner)}**`);
  }
  const due = relativeDue(match, context.today);
  if (due) {
    const icon = dueHint(match, context.today)?.tone === "overdue" ? "$(warning)" : "$(calendar)";
    rows.push(`${icon} ${vscode.l10n.t("Due")}: ${escape(due)}`);
  }
  if (match.meta?.priority) {
    rows.push(`$(flame) ${vscode.l10n.t("Priority")}: ${priorityLabel(match.meta.priority)}`);
  }
  if (match.meta && match.meta.labels.length > 0) {
    rows.push(`$(tag) ${match.meta.labels.map((label) => `\`#${label}\``).join(" ")}`);
  }
  if (match.subTag) {
    rows.push(`$(link) ${escape(match.subTag)}`);
  }
  const blame = context.blame;
  if (blame && !blame.uncommitted) {
    const age = ageInDays(blame, context.nowSeconds) ?? 0;
    const stale = age >= context.staleAfterDays ? ` · ${vscode.l10n.t("stale")}` : "";
    rows.push(
      `$(git-commit) ${escape(blame.author)} · ${formatAge(age)}${stale} · \`${blame.sha.slice(0, 7)}\` ${escape(blame.summary.slice(0, 80))}`,
    );
  } else if (context.isUncommitted || blame?.uncommitted) {
    rows.push(`$(diff-added) ${vscode.l10n.t("Not committed yet")}`);
  } else if (context.isNew) {
    rows.push(`$(git-branch) ${vscode.l10n.t("Added on this branch")}`);
  }
  if (match.kind === "code") {
    rows.push(`$(info) ${vscode.l10n.t(".NET code pattern")}`);
  }
  rows.push(`$(file) \`${escape(match.relativePath)}:${match.line + 1}\``);
  markdown.appendMarkdown(rows.join("  \n"));
  if (context.actions && match.kind === "tag") {
    const id = match.id;
    const links = [
      context.pinned
        ? commandLink(`$(pinned) ${vscode.l10n.t("Unpin")}`, "todoforge.unpin", [id])
        : commandLink(`$(pin) ${vscode.l10n.t("Pin")}`, "todoforge.pin", [id]),
      commandLink(`$(clock) ${vscode.l10n.t("Snooze 1 week")}`, "todoforge.snooze", [id, 7]),
      commandLink(`$(calendar) ${vscode.l10n.t("Due date")}`, "todoforge.setDueDate", [id]),
      commandLink(`$(flame) ${vscode.l10n.t("Priority")}`, "todoforge.setPriority", [id]),
      commandLink(`$(list-tree) ${vscode.l10n.t("Show in tree")}`, "todoforge.revealInTree", [id]),
    ];
    markdown.appendMarkdown(`\n\n---\n\n${links.join(" &nbsp; ")}`);
  }
  return markdown;
};
