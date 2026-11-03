import * as vscode from "vscode";

import { snoozeDate, todayIso } from "../syntax/metadata";
import type { TodoMatch } from "../types";
import { metadataEdit, removalEdit } from "./editing";
import type { Services } from "./services";

const quickFix = vscode.CodeActionKind.QuickFix.append("todoforge");

/** Quick fixes on a TODO line: snooze, set due date or priority, remove, pin, mute. */
export const registerCodeActions = (services: Services): vscode.Disposable => {
  const provider: vscode.CodeActionProvider = {
    provideCodeActions: (document, range) => {
      const matches = services
        .matchesFor(document.uri.toString())
        .filter((match) => match.line >= range.start.line && match.line <= range.end.line);
      const actions: vscode.CodeAction[] = [];
      for (const match of matches.slice(0, 3)) {
        actions.push(...actionsFor(document, match, services));
      }
      return actions;
    },
  };
  return vscode.languages.registerCodeActionsProvider([{ scheme: "file" }, { scheme: "untitled" }], provider, {
    providedCodeActionKinds: [quickFix],
  });
};

const withEdit = (
  title: string,
  document: vscode.TextDocument,
  edit: vscode.TextEdit | undefined,
): vscode.CodeAction | undefined => {
  if (!edit) {
    return undefined;
  }
  const action = new vscode.CodeAction(title, quickFix);
  action.edit = new vscode.WorkspaceEdit();
  action.edit.set(document.uri, [edit]);
  return action;
};

const withCommand = (title: string, command: string, args: unknown[]): vscode.CodeAction => {
  const action = new vscode.CodeAction(title, quickFix);
  action.command = { command, title, arguments: args };
  return action;
};

const actionsFor = (document: vscode.TextDocument, match: TodoMatch, services: Services): vscode.CodeAction[] => {
  const actions: (vscode.CodeAction | undefined)[] = [];
  const label = `${match.tag}`;
  if (match.kind === "tag") {
    const today = todayIso();
    for (const [days, title] of [
      [1, vscode.l10n.t("Snooze {0} by 1 day", label)],
      [7, vscode.l10n.t("Snooze {0} by 1 week", label)],
      [30, vscode.l10n.t("Snooze {0} by 1 month", label)],
    ] as const) {
      actions.push(withEdit(title, document, metadataEdit(document, match, { due: snoozeDate(match.meta?.due, days, today) })));
    }
    actions.push(withCommand(vscode.l10n.t("Set due date for {0}…", label), "todoforge.setDueDate", [match.id]));
    actions.push(withCommand(vscode.l10n.t("Set priority for {0}…", label), "todoforge.setPriority", [match.id]));
    if (!match.meta?.owner) {
      actions.push(withCommand(vscode.l10n.t("Assign {0} to me", label), "todoforge.assignToMe", [match.id]));
    }
  }
  if (match.kind !== "code") {
    const remove = withEdit(vscode.l10n.t("Remove {0} comment", label), document, removalEdit(document, match));
    actions.push(remove);
  }
  actions.push(
    services.isPinned(match)
      ? withCommand(vscode.l10n.t("Unpin {0}", label), "todoforge.unpin", [match.id])
      : withCommand(vscode.l10n.t("Pin {0} in TodoForge", label), "todoforge.pin", [match.id]),
  );
  actions.push(withCommand(vscode.l10n.t("Mute {0} in this workspace", label), "todoforge.mute", [match.id]));
  return actions.filter((action): action is vscode.CodeAction => action !== undefined);
};
