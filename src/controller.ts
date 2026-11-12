import * as vscode from "vscode";

import { createCodeLensProvider } from "./codelens/todoCodeLens";
import { cycleMatch } from "./commands/navigation";
import { DEFAULT_LABEL_FORMAT } from "./config/defaults";
import { updateSetting, userHasConfiguredTodoForge } from "./config/settings";
import { createEngine } from "./core/engine";
import { createStateStore, type SavedView } from "./core/state";
import { aiAvailable, explainTodo } from "./features/ai";
import { registerChatTools } from "./features/chatTools";
import { setCheckboxLine } from "./features/checkbox";
import { registerCodeActions } from "./features/codeActions";
import { registerCompletion } from "./features/completion";
import { createProblems } from "./features/diagnostics";
import { applyMetadata, insertTodo, pickDueDate, pickPriority, removeTodo, snooze } from "./features/editing";
import { registerHover } from "./features/hover";
import { importSettings, todoTreePatch } from "./features/importSettings";
import { createInsightsPanel } from "./features/insightsPanel";
import type { Services } from "./features/services";
import { createStatusBar, summarize } from "./features/statusBar";
import type { CardContext } from "./features/todoCard";
import { createGitContext } from "./git/gitContext";
import { hideFromTree } from "./highlighting/palette";
import { competingCommentHighlighter, createHighlighter } from "./highlighting/highlighter";
import { logError, logInfo } from "./logger";
import { fingerprint, isPinned, pinFromMatch, reorderPins, resolvePin } from "./pins/pins";
import { todayIso } from "./syntax/metadata";
import { ChangesProvider } from "./tree/changesProvider";
import { isTreeElement, type TreeElement } from "./tree/elements";
import { treeToJson, treeToMarkdown } from "./tree/exportTree";
import { findFileNodeId, groupMatches, type ViewNode } from "./tree/grouping";
import { filterByQuery, queryNeedsBlame, sortMatches, type QueryContext } from "./tree/query";
import { TodoTreeProvider, type PinEntry, type TreeDecorators } from "./tree/todoTreeProvider";
import type { GroupBy, ScanMode, SortBy, TodoMatch } from "./types";
import { errorMessage } from "./utils/errors";
import { folderGlob } from "./utils/paths";
import { ticketsOf } from "./utils/tickets";

const MIGRATION_KEY = "todoforge.migrationPrompted";

const BUILTIN_VIEWS = (): SavedView[] => [
  { name: vscode.l10n.t("My TODOs"), query: "is:mine" },
  { name: vscode.l10n.t("Overdue"), query: "is:overdue", sortBy: "due" },
  { name: vscode.l10n.t("Due dates"), query: "is:due", sortBy: "due" },
  { name: vscode.l10n.t("New on this branch"), query: "is:new" },
  { name: vscode.l10n.t("Stale"), query: "is:stale", sortBy: "age" },
  { name: vscode.l10n.t("FIXME and BUG"), query: "tag:FIXME,BUG" },
  { name: vscode.l10n.t(".NET code markers"), query: "is:code" },
];

const setContext = (key: string, value: unknown): void => {
  void vscode.commands.executeCommand("setContext", key, value);
};

/** Read-only handle used by the integration tests. Not a public API. */
export interface TodoForgeTestApi {
  all: () => readonly TodoMatch[];
  visible: () => readonly TodoMatch[];
  changes: () => { uncommitted: number; branch: number };
  pins: () => number;
  /** Applies a filter query without saving it and returns the visible count. */
  query: (query: string) => number;
  scanned: () => boolean;
  refresh: () => Promise<void>;
}

export const createController = (
  context: vscode.ExtensionContext,
): { dispose: () => void; api: TodoForgeTestApi } => {
  const gitAllowed = (): boolean => vscode.workspace.isTrusted;
  const engine = createEngine(gitAllowed);
  const state = createStateStore(context);
  const git = createGitContext(() => engine.settings, gitAllowed);
  const provider = new TodoTreeProvider();
  const changes = new ChangesProvider();
  const treeView = vscode.window.createTreeView("todoforge.tree", {
    treeDataProvider: provider,
    dragAndDropController: provider,
    showCollapseAll: false,
  });
  const changesView = vscode.window.createTreeView("todoforge.changes", {
    treeDataProvider: changes,
    showCollapseAll: true,
  });
  const statusBar = createStatusBar();
  const lensEmitter = new vscode.EventEmitter<void>();
  const disposables: vscode.Disposable[] = [treeView, changesView, lensEmitter, statusBar];
  let root: ViewNode | undefined;
  let visible: TodoMatch[] = [];
  let scanned = false;
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  let lensSubscription: vscode.Disposable | undefined;
  let decorationKey = "";
  let blameRequested = false;
  let cursorOnTodo = false;
  let lastChanges = { uncommitted: 0, branch: 0 };
  let currentFileOnly = false;
  let revealTimer: ReturnType<typeof setTimeout> | undefined;
  let loggedMarkerYield = false;

  // ---- derived views -------------------------------------------------------

  const listed = (match: TodoMatch): boolean => {
    return !hideFromTree(match.kind === "markdown" ? "MARKDOWN" : match.tag, engine.settings.tagStyles);
  };

  const unmuted = (): TodoMatch[] => {
    const all = engine.index.getAll().filter(listed);
    return state.muted.size === 0 ? all : all.filter((match) => !state.isMuted(match));
  };

  const matchesFor = (uri: string): readonly TodoMatch[] => {
    const matches = engine.index.getFile(uri);
    return state.muted.size === 0 ? matches : matches.filter((match) => !state.isMuted(match));
  };

  const queryContext = (): QueryContext => {
    const owner = engine.settings.owner.replace(/^@/, "");
    return {
      today: todayIso(),
      staleAfterDays: engine.settings.staleAfterDays,
      nowSeconds: Date.now() / 1000,
      me: {
        names: owner && !git.state.me.names.includes(owner) ? [owner, ...git.state.me.names] : git.state.me.names,
        emails: git.state.me.emails,
      },
      blameOf: git.blameOf,
      isNew: git.isNew,
    };
  };

  const effectiveQuery = (): string => [state.query, state.mine ? "is:mine" : ""].join(" ").trim();

  const ticketUrlOf = (match: TodoMatch): string | undefined => {
    return ticketsOf(match, engine.settings.ticketUrl).find((ticket) => ticket.url)?.url;
  };

  const card = (match: TodoMatch, actions = false): CardContext => ({
    today: todayIso(),
    nowSeconds: Date.now() / 1000,
    staleAfterDays: engine.settings.staleAfterDays,
    blame: git.blameOf(match),
    isNew: git.isNew(match),
    isUncommitted: git.isUncommitted(match),
    pinned: isPinned(state.pins, match),
    actions,
    ticketUrl: engine.settings.ticketUrl,
  });

  const decorators: TreeDecorators = {
    card: (match) => card(match),
    isPinned: (match) => isPinned(state.pins, match),
    ticketUrl: ticketUrlOf,
  };

  const services: Services = {
    engine,
    state,
    git,
    matchesFor,
    card,
    isPinned: (match) => isPinned(state.pins, match),
  };

  const highlighter = createHighlighter(matchesFor, () => engine.index.countsByTag().keys(), () => engine.settings);
  const problems = createProblems(services);
  disposables.push(highlighter, problems);

  const labelFormat = (): string => {
    const settings = engine.settings;
    if (settings.labelFormat !== DEFAULT_LABEL_FORMAT) {
      return settings.labelFormat;
    }
    return settings.groupBy === "tag" ? "${text}" : DEFAULT_LABEL_FORMAT;
  };

  const pinEntries = (): PinEntry[] => {
    return state.pins.map((pin) => ({ pin, match: resolvePin(pin, matchesFor(pin.uri)) }));
  };

  const ensureBlameIfNeeded = (): void => {
    const needs = queryNeedsBlame(effectiveQuery()) || engine.settings.sortBy === "age";
    if (!needs || blameRequested || !git.available || engine.settings.blameMode === "off") {
      return;
    }
    blameRequested = true;
    void vscode.window
      .withProgress({ location: { viewId: "todoforge.tree" } }, () => git.ensureBlame(unmuted()))
      .then(
        () => {
          blameRequested = false;
        },
        (error: unknown) => {
          blameRequested = false;
          logError("Blame failed", error);
        },
      );
  };

  const publishNow = (): void => {
    if (publishTimer) {
      clearTimeout(publishTimer);
    }
    publishTimer = undefined;
    const settings = engine.settings;
    const ctx = queryContext();
    const base = unmuted();
    const activeUri = vscode.window.activeTextEditor?.document.uri.toString();
    const treeBase = currentFileOnly ? (activeUri ? base.filter((match) => match.uri === activeUri) : []) : base;
    visible = sortMatches(filterByQuery(treeBase, effectiveQuery(), ctx), settings.sortBy, ctx);
    root = groupMatches(visible, {
      groupBy: settings.groupBy,
      labelFormat: labelFormat(),
      tagGroups: settings.tagGroups,
      tagOrder: settings.tags,
      markdownSeparate: settings.markdownGroupSeparately,
      workspaceFolders: (vscode.workspace.workspaceFolders ?? []).map((folder) => ({
        path: folder.uri.fsPath,
        name: folder.name,
      })),
      keepOrder: settings.sortBy !== "location",
      markdownLabel: vscode.l10n.t("Markdown checklists"),
      noOwnerLabel: vscode.l10n.t("(no owner)"),
    });
    provider.setState(root, pinEntries(), settings, decorators);
    const filtered = effectiveQuery().length > 0;
    treeView.badge =
      settings.showActivityBadge && base.length > 0
        ? { value: filtered || currentFileOnly ? visible.length : base.length, tooltip: vscode.l10n.t("{0} TODOs", base.length) }
        : undefined;
    if (filtered && currentFileOnly) {
      treeView.message = vscode.l10n.t("Current file, filter: {0} — {1} of {2}", effectiveQuery(), visible.length, treeBase.length);
    } else if (filtered) {
      treeView.message = vscode.l10n.t("Filter: {0} — {1} of {2}", effectiveQuery(), visible.length, base.length);
    } else if (currentFileOnly) {
      treeView.message = vscode.l10n.t("Current file — {0} TODOs", visible.length);
    } else {
      treeView.message = undefined;
    }
    treeView.description = currentFileOnly
      ? vscode.l10n.t("Current file")
      : settings.scanMode === "workspace"
        ? undefined
        : scanModeLabel(settings.scanMode);

    const uncommitted = base.filter((match) => git.isUncommitted(match));
    const branch = base.filter((match) => !git.isUncommitted(match) && git.isOnBranch(match));
    const baseRef = branch[0] ? git.baseRefOf(branch[0]) : base[0] ? git.baseRefOf(base[0]) : undefined;
    changes.setState({ uncommitted, branch, baseRef }, settings, decorators);
    lastChanges = { uncommitted: uncommitted.length, branch: branch.length };
    // No badge here: VS Code adds view badges together on the activity bar icon.
    changesView.description = changes.total > 0 ? vscode.l10n.t("{0} new", changes.total) : undefined;

    const active = vscode.window.activeTextEditor?.document.uri;
    statusBar.update(
      summarize(base, active?.toString(), ctx.today),
      settings.statusbarFormat,
      engine.scanning,
      settings.statusbarEnabled,
    );
    setContext("todoforge.filtered", filtered);
    setContext("todoforge.currentFile", currentFileOnly);
    setContext("todoforge.mine", state.mine);
    setContext("todoforge.hasPins", state.pins.length > 0);
    setContext("todoforge.hasMuted", state.muted.size > 0);
    setContext("todoforge.scanned", scanned);
    setContext("todoforge.gitAvailable", git.available);
    setContext("todoforge.groupBy", settings.groupBy);
    setContext("todoforge.sortBy", settings.sortBy);
    setContext("todoforge.aiAvailable", aiAvailable() && vscode.workspace.isTrusted);
    problems.update();
    lensEmitter.fire();
    insights.update();
    ensureBlameIfNeeded();
    scheduleReveal();
  };

  const schedulePublish = (delay = 60): void => {
    if (publishTimer) {
      return;
    }
    publishTimer = setTimeout(publishNow, delay);
  };

  const repaint = (): void => {
    const settings = engine.settings;
    const key = JSON.stringify([
      settings.highlightingEnabled,
      settings.highlightStyle,
      settings.tagStyles,
      settings.tags,
      settings.highlightGutterIcons,
      settings.highlightOpacity,
      settings.highlightBorder,
      settings.commentMarkersEnabled,
      settings.commentMarkers,
      settings.commentMarkersMultiline,
      [...engine.index.countsByTag().keys()].sort(),
    ]);
    const competing = competingCommentHighlighter();
    if (competing && settings.commentMarkersEnabled && !loggedMarkerYield) {
      loggedMarkerYield = true;
      logInfo(
        `Comment markers are off because ${competing} is installed. Set todoforge.commentMarkers.enabled to true if you want TodoForge to draw them instead.`,
      );
    }
    if (key !== decorationKey) {
      decorationKey = key;
      highlighter.refresh();
    } else {
      highlighter.paint();
    }
  };

  // ---- helpers -------------------------------------------------------------

  const openMatch = async (match: TodoMatch): Promise<void> => {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(match.uri));
    const editor = await vscode.window.showTextDocument(document, { preserveFocus: false });
    const line = Math.min(match.line, document.lineCount - 1);
    const position = new vscode.Position(line, match.column);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  };

  const openMatchById = async (id: string): Promise<void> => {
    const match = engine.findMatch(id);
    if (!match) {
      void vscode.window.showInformationMessage(vscode.l10n.t("TodoForge could not find that TODO. It may have changed."));
      return;
    }
    await openMatch(match);
  };

  const insights = createInsightsPanel(services, () => visible, openMatchById);
  disposables.push(insights);

  /** Resolves a command argument: a match id, a tree element, or the TODO under the cursor. */
  const matchFromArg = (arg: unknown): TodoMatch | undefined => {
    if (typeof arg === "string") {
      return engine.findMatch(arg);
    }
    if (isTreeElement(arg)) {
      if (arg.type === "view") {
        return arg.node.match;
      }
      if (arg.type === "pin") {
        return arg.match;
      }
      return undefined;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    const position = editor.selection.active;
    const onLine = matchesFor(editor.document.uri.toString()).filter((match) => match.line === position.line);
    return onLine.find((match) => position.character >= match.column && position.character <= match.endColumn) ?? onLine[0];
  };

  const requireMatch = (arg: unknown, editable = false): TodoMatch | undefined => {
    const match = matchFromArg(arg);
    if (!match) {
      void vscode.window.showInformationMessage(vscode.l10n.t("Put the cursor on a TODO or pick one in the TodoForge view."));
      return undefined;
    }
    if (editable && match.kind !== "tag") {
      void vscode.window.showInformationMessage(vscode.l10n.t("Only comment TODOs can carry an owner, due date or priority."));
      return undefined;
    }
    return match;
  };

  const scanModeLabel = (mode: ScanMode): string => {
    switch (mode) {
      case "openFiles":
        return vscode.l10n.t("Open files");
      case "currentFile":
        return vscode.l10n.t("Current file");
      case "workspaceAndOpen":
        return vscode.l10n.t("Workspace + open files");
      default:
        return vscode.l10n.t("Workspace");
    }
  };

  const gitOwner = (): string | undefined => {
    return engine.settings.owner.replace(/^@/, "") || git.state.me.names[0]?.split(/\s+/)[0]?.toLowerCase();
  };

  const saveExport = async (contents: string, extension: "md" | "json"): Promise<void> => {
    const uri = await vscode.window.showSaveDialog({
      filters: extension === "json" ? { JSON: ["json"] } : { Markdown: ["md"] },
      saveLabel: vscode.l10n.t("Export"),
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(contents, "utf8"));
    }
  };

  const setMarkdownChecked = async (match: TodoMatch, checked: boolean): Promise<void> => {
    const uri = vscode.Uri.parse(match.uri);
    const document = await vscode.workspace.openTextDocument(uri);
    if (match.line >= document.lineCount) {
      return;
    }
    const line = document.lineAt(match.line);
    const next = setCheckboxLine(line.text, checked);
    if (!next) {
      void vscode.window.showWarningMessage(vscode.l10n.t("TodoForge could not update that checklist item."));
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, line.range, next);
    await vscode.workspace.applyEdit(edit);
  };

  const pin = async (match: TodoMatch): Promise<void> => {
    if (isPinned(state.pins, match)) {
      return;
    }
    await state.setPins([...state.pins, pinFromMatch(match)]);
  };

  const unpin = async (arg: unknown): Promise<void> => {
    if (isTreeElement(arg) && arg.type === "pin") {
      await state.setPins(state.pins.filter((item) => item.id !== arg.pin.id));
      return;
    }
    const match = matchFromArg(arg);
    if (!match) {
      return;
    }
    const key = fingerprint(match);
    await state.setPins(state.pins.filter((item) => fingerprint(item) !== key));
  };


  const scheduleReveal = (): void => {
    if (revealTimer) {
      clearTimeout(revealTimer);
    }
    revealTimer = setTimeout(() => {
      revealTimer = undefined;
      void revealActiveFile(false);
    }, 150);
  };

  const revealActiveFile = async (focus: boolean): Promise<boolean> => {
    if (!engine.settings.autoReveal && !focus) {
      return false;
    }
    if (!focus && (currentFileOnly || !treeView.visible)) {
      return false;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== "file" || !root) {
      return false;
    }
    const id = findFileNodeId(root, editor.document.uri.toString());
    const element = id ? provider.findElement(id) : undefined;
    if (!element) {
      return false;
    }
    await treeView.reveal(element, { select: true, focus, expand: true });
    return true;
  };

  const expandAll = async (): Promise<void> => {
    const walk = async (element?: TreeElement): Promise<void> => {
      const children = provider.getChildren(element);
      for (const child of children) {
        const item = provider.getTreeItem(child);
        if (item.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
          await treeView.reveal(child, { expand: true, focus: false, select: false });
          await walk(child);
        }
      }
    };
    await vscode.window.withProgress({ location: { viewId: "todoforge.tree" } }, () => walk());
  };

  // ---- live filter ---------------------------------------------------------

  const liveFilter = (): void => {
    const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { token?: string }>();
    const previous = state.query;
    let accepted = false;
    quickPick.title = vscode.l10n.t("Filter TODOs");
    quickPick.placeholder = vscode.l10n.t("Type to filter. Try tag:FIXME  @name  #label  path:src  is:mine  is:overdue  -word");
    quickPick.value = previous;
    const tagItems = [...engine.index.countsByTag().entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ label: `$(tag) tag:${tag}`, description: String(count), token: `tag:${tag}`, alwaysShow: true }));
    quickPick.items = [
      { label: `$(person) is:mine`, description: vscode.l10n.t("yours, by inline owner or git blame"), token: "is:mine", alwaysShow: true },
      { label: `$(warning) is:overdue`, description: vscode.l10n.t("due date has passed"), token: "is:overdue", alwaysShow: true },
      { label: `$(calendar) is:due`, description: vscode.l10n.t("has a due date"), token: "is:due", alwaysShow: true },
      { label: `$(git-branch) is:new`, description: vscode.l10n.t("added on this branch or not committed"), token: "is:new", alwaysShow: true },
      { label: `$(history) is:stale`, description: vscode.l10n.t("older than {0} days", engine.settings.staleAfterDays), token: "is:stale", alwaysShow: true },
      ...tagItems,
    ];
    quickPick.matchOnDescription = false;
    quickPick.onDidChangeValue((value) => {
      state.setQuery(value, false);
      schedulePublish(40);
    });
    quickPick.onDidAccept(() => {
      const item = quickPick.selectedItems[0];
      if (item?.token) {
        const value = `${quickPick.value.trim()} ${item.token}`.trim();
        quickPick.value = `${value} `;
        state.setQuery(value, false);
        schedulePublish(0);
        quickPick.selectedItems = [];
        quickPick.activeItems = [];
        return;
      }
      accepted = true;
      state.setQuery(quickPick.value.trim(), true);
      quickPick.hide();
    });
    quickPick.onDidHide(() => {
      if (!accepted) {
        // Escape keeps what was typed so the filter stays live; use Clear Filter to reset.
        state.setQuery(quickPick.value.trim(), true);
      }
      quickPick.dispose();
      schedulePublish(0);
    });
    quickPick.show();
    void previous;
  };

  // ---- commands ------------------------------------------------------------

  const register = (command: string, handler: (...args: unknown[]) => unknown): void => {
    disposables.push(
      vscode.commands.registerCommand(command, async (...args: unknown[]) => {
        try {
          return await handler(...args);
        } catch (error) {
          logError(`${command} failed`, error);
          void vscode.window.showErrorMessage(vscode.l10n.t("TodoForge: {0}", errorMessage(error)));
          return undefined;
        }
      }),
    );
  };

  register("todoforge.refresh", async () => {
    await engine.refresh();
    await git.refreshChanges();
  });
  register("todoforge.filter", () => liveFilter());
  register("todoforge.clearFilter", async () => {
    state.setQuery("", true);
    await state.setMine(false);
    schedulePublish(0);
  });
  register("todoforge.showMine", () => state.setMine(true));
  register("todoforge.showAll", () => state.setMine(false));
  register("todoforge.openSettings", () => vscode.commands.executeCommand("workbench.action.openSettings", "@ext:onurkarakus.todoforge"));
  register("todoforge.openWalkthrough", () =>
    vscode.commands.executeCommand("workbench.action.openWalkthrough", "onurkarakus.todoforge#todoforge.start", false),
  );
  register("todoforge.setScanMode", async () => {
    const modes: ScanMode[] = ["workspace", "openFiles", "currentFile", "workspaceAndOpen"];
    const picked = await vscode.window.showQuickPick(
      modes.map((mode) => ({ label: scanModeLabel(mode), mode, picked: mode === engine.settings.scanMode })),
      { placeHolder: vscode.l10n.t("Scan mode") },
    );
    if (picked) {
      await updateSetting("scanning.mode", picked.mode);
    }
  });
  register("todoforge.setGroupBy", async () => {
    const options: { label: string; mode: GroupBy }[] = [
      { label: `$(tag) ${vscode.l10n.t("Tag")}`, mode: "tag" },
      { label: `$(file) ${vscode.l10n.t("File")}`, mode: "file" },
      { label: `$(person) ${vscode.l10n.t("Owner")}`, mode: "owner" },
      { label: `$(link) ${vscode.l10n.t("Label or sub-tag")}`, mode: "subtag" },
      { label: `$(list-flat) ${vscode.l10n.t("Flat list")}`, mode: "flat" },
    ];
    const picked = await vscode.window.showQuickPick(
      options.map((option) => ({ ...option, description: option.mode === engine.settings.groupBy ? "✓" : undefined })),
      { placeHolder: vscode.l10n.t("Group TODOs by") },
    );
    if (picked) {
      await updateSetting("tree.groupBy", picked.mode);
    }
  });
  register("todoforge.setSortBy", async () => {
    const options: { label: string; mode: SortBy; detail?: string }[] = [
      { label: `$(list-ordered) ${vscode.l10n.t("Location")}`, mode: "location" },
      { label: `$(flame) ${vscode.l10n.t("Priority")}`, mode: "priority" },
      { label: `$(calendar) ${vscode.l10n.t("Due date")}`, mode: "due" },
      { label: `$(history) ${vscode.l10n.t("Age, oldest first")}`, mode: "age", detail: vscode.l10n.t("Reads local git blame for files with TODOs.") },
    ];
    const picked = await vscode.window.showQuickPick(
      options.map((option) => ({ ...option, description: option.mode === engine.settings.sortBy ? "✓" : undefined })),
      { placeHolder: vscode.l10n.t("Sort TODOs by") },
    );
    if (picked) {
      await updateSetting("tree.sortBy", picked.mode);
    }
  });
  register("todoforge.openMatch", (id: unknown) => (typeof id === "string" ? openMatchById(id) : undefined));
  const move = async (direction: 1 | -1): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const next = cycleMatch(
      matchesFor(editor.document.uri.toString()),
      editor.selection.active.line,
      editor.selection.active.character,
      direction,
    );
    if (!next) {
      vscode.window.setStatusBarMessage(vscode.l10n.t("No TODOs in this file"), 2000);
      return;
    }
    await openMatch(next);
  };
  register("todoforge.goToNext", () => move(1));
  register("todoforge.goToPrevious", () => move(-1));
  register("todoforge.revealFile", async () => {
    const found = await revealActiveFile(true);
    if (!found) {
      void vscode.window.showInformationMessage(vscode.l10n.t("This file has no TODOs in the current view."));
    }
  });
  register("todoforge.expandAll", () => expandAll());
  register("todoforge.collapseAll", () => vscode.commands.executeCommand("workbench.actions.treeView.todoforge.tree.collapseAll"));
  register("todoforge.showCurrentFile", () => {
    currentFileOnly = true;
    schedulePublish(0);
  });
  register("todoforge.showAllFiles", () => {
    currentFileOnly = false;
    schedulePublish(0);
  });
  register("todoforge.toggleCurrentFile", () => {
    currentFileOnly = !currentFileOnly;
    schedulePublish(0);
  });
  register("todoforge.revealInTree", async (arg: unknown) => {
    const match = requireMatch(arg);
    const element = match ? provider.findMatchElement(match.id) : undefined;
    if (element) {
      await treeView.reveal(element, { select: true, focus: true, expand: true });
    }
  });
  const pickFrom = async (matches: readonly TodoMatch[], placeHolder: string): Promise<void> => {
    const picked = await vscode.window.showQuickPick(
      matches.map((match) => ({
        label: `${match.tag}: ${match.text || match.raw.trim()}`,
        description: `${match.relativePath}:${match.line + 1}`,
        detail: match.meta?.due ? `${vscode.l10n.t("Due")}: ${match.meta.due}` : undefined,
        match,
      })),
      { placeHolder, matchOnDescription: true },
    );
    if (picked) {
      await openMatch(picked.match);
    }
  };
  register("todoforge.quickPick", () => pickFrom(visible, vscode.l10n.t("Jump to a TODO")));
  register("todoforge.statusBarClick", () => {
    const uri = vscode.window.activeTextEditor?.document.uri.toString();
    const inFile = uri ? matchesFor(uri) : [];
    return inFile.length > 0
      ? pickFrom(inFile, vscode.l10n.t("TODOs in this file"))
      : vscode.commands.executeCommand("todoforge.tree.focus");
  });
  register("todoforge.copy", async (arg: unknown) => {
    const match = requireMatch(arg);
    if (match) {
      await vscode.env.clipboard.writeText(`${match.relativePath}:${match.line + 1} ${match.raw.trim()}`);
    }
  });
  register("todoforge.revealInExplorer", (arg: unknown) => {
    if (isTreeElement(arg) && arg.type === "view" && arg.node.kind === "file" && arg.node.resourcePath) {
      return vscode.commands.executeCommand("revealInExplorer", vscode.Uri.parse(arg.node.resourcePath));
    }
    const match = matchFromArg(arg);
    return match ? vscode.commands.executeCommand("revealInExplorer", vscode.Uri.parse(match.uri)) : undefined;
  });
  register("todoforge.hideFolder", async (arg: unknown) => {
    if (!isTreeElement(arg) || arg.type !== "view" || arg.node.kind !== "folder" || !arg.node.resourcePath) {
      return;
    }
    const hide = vscode.l10n.t("Hide");
    const choice = await vscode.window.showWarningMessage(
      vscode.l10n.t("Hide {0} from TodoForge scans?", arg.node.resourcePath),
      { modal: true, detail: vscode.l10n.t("Adds {0} to todoforge.scanning.excludeGlobs in your user settings.", folderGlob(arg.node.resourcePath)) },
      hide,
    );
    if (choice === hide) {
      await updateSetting("scanning.excludeGlobs", [...engine.settings.excludeGlobs, folderGlob(arg.node.resourcePath)]);
    }
  });
  register("todoforge.toggleMarkdown", async (arg: unknown) => {
    const match = requireMatch(arg);
    if (match?.kind === "markdown") {
      await setMarkdownChecked(match, !match.markdownChecked);
    }
  });
  register("todoforge.pin", async (arg: unknown) => {
    const match = requireMatch(arg);
    if (match) {
      await pin(match);
    }
  });
  register("todoforge.unpin", (arg: unknown) => unpin(arg));
  register("todoforge.clearMissingPins", async () => {
    await state.setPins(state.pins.filter((item) => resolvePin(item, matchesFor(item.uri)) !== undefined));
  });
  register("todoforge.mute", async (arg: unknown) => {
    const match = requireMatch(arg);
    if (!match) {
      return;
    }
    await state.mute(match);
    const undo = vscode.l10n.t("Undo");
    const choice = await vscode.window.showInformationMessage(
      vscode.l10n.t("Muted \"{0}\" in this workspace.", `${match.tag}: ${match.text}`.slice(0, 80)),
      undo,
    );
    if (choice === undo) {
      await state.unmute([fingerprint(match)]);
    }
  });
  register("todoforge.manageMuted", async () => {
    const keys = [...state.muted];
    if (keys.length === 0) {
      void vscode.window.showInformationMessage(vscode.l10n.t("No muted TODOs in this workspace."));
      return;
    }
    const picked = await vscode.window.showQuickPick(
      keys.map((key) => {
        const [uri = "", tag = "", text = ""] = key.split("|");
        return { label: `${tag}: ${text}`, description: vscode.workspace.asRelativePath(vscode.Uri.parse(uri)), key };
      }),
      { canPickMany: true, placeHolder: vscode.l10n.t("Choose TODOs to unmute") },
    );
    if (picked && picked.length > 0) {
      await state.unmute(picked.map((item) => item.key));
    }
  });
  register("todoforge.snooze", async (arg: unknown, days: unknown) => {
    const match = requireMatch(arg, true);
    if (!match) {
      return;
    }
    let amount = typeof days === "number" ? days : undefined;
    if (amount === undefined) {
      const picked = await vscode.window.showQuickPick(
        [
          { label: vscode.l10n.t("1 day"), days: 1 },
          { label: vscode.l10n.t("1 week"), days: 7 },
          { label: vscode.l10n.t("1 month"), days: 30 },
        ],
        { placeHolder: vscode.l10n.t("Snooze by") },
      );
      amount = picked?.days;
    }
    if (amount !== undefined) {
      await snooze(match, amount);
    }
  });
  register("todoforge.setDueDate", async (arg: unknown) => {
    const match = requireMatch(arg, true);
    if (!match) {
      return;
    }
    const due = await pickDueDate(match.meta?.due);
    if (due !== undefined) {
      await applyMetadata(match, { due });
    }
  });
  register("todoforge.setPriority", async (arg: unknown) => {
    const match = requireMatch(arg, true);
    if (!match) {
      return;
    }
    const priority = await pickPriority(match.meta?.priority);
    if (priority !== undefined) {
      await applyMetadata(match, { priority });
    }
  });
  register("todoforge.assignToMe", async (arg: unknown) => {
    const match = requireMatch(arg, true);
    if (!match) {
      return;
    }
    let owner = gitOwner();
    if (!owner) {
      owner = (await vscode.window.showInputBox({ prompt: vscode.l10n.t("Your name for TODO owners (saved as todoforge.syntax.owner)") }))?.trim();
      if (!owner) {
        return;
      }
      await updateSetting("syntax.owner", owner);
    }
    await applyMetadata(match, { owner });
  });
  register("todoforge.removeTodo", async (arg: unknown) => {
    const match = requireMatch(arg);
    if (match) {
      await removeTodo(match);
    }
  });
  register("todoforge.addTodo", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showInformationMessage(vscode.l10n.t("Open a file to add a TODO."));
      return;
    }
    await insertTodo(editor, engine.settings.tags[0] ?? "TODO", gitOwner());
  });
  register("todoforge.saveView", async () => {
    const query = effectiveQuery();
    const name = await vscode.window.showInputBox({
      prompt: vscode.l10n.t("Name for this view"),
      value: query,
      validateInput: (value) => (value.trim() ? undefined : vscode.l10n.t("Enter a name.")),
    });
    if (!name) {
      return;
    }
    const view: SavedView = { name: name.trim(), query, groupBy: engine.settings.groupBy, sortBy: engine.settings.sortBy };
    await state.setSavedViews([...state.savedViews.filter((item) => item.name !== view.name), view]);
  });
  register("todoforge.openView", async () => {
    const own = state.savedViews.map((view) => ({ label: `$(bookmark) ${view.name}`, description: view.query, view, own: true }));
    const builtin = BUILTIN_VIEWS().map((view) => ({ label: `$(filter) ${view.name}`, description: view.query, view, own: false }));
    const picked = await vscode.window.showQuickPick(
      [
        ...own,
        ...(own.length > 0 ? [{ label: "", kind: vscode.QuickPickItemKind.Separator } as never] : []),
        ...builtin,
      ],
      { placeHolder: vscode.l10n.t("Open a saved view") },
    );
    if (!picked) {
      return;
    }
    await state.setMine(false);
    state.setQuery(picked.view.query, true);
    if (picked.view.groupBy && picked.view.groupBy !== engine.settings.groupBy) {
      await updateSetting("tree.groupBy", picked.view.groupBy);
    }
    if (picked.view.sortBy && picked.view.sortBy !== engine.settings.sortBy) {
      await updateSetting("tree.sortBy", picked.view.sortBy);
    }
    schedulePublish(0);
  });
  register("todoforge.deleteView", async () => {
    const picked = await vscode.window.showQuickPick(
      state.savedViews.map((view) => ({ label: view.name, description: view.query })),
      { canPickMany: true, placeHolder: vscode.l10n.t("Delete saved views") },
    );
    if (picked && picked.length > 0) {
      const names = new Set(picked.map((item) => item.label));
      await state.setSavedViews(state.savedViews.filter((view) => !names.has(view.name)));
    }
  });
  register("todoforge.showInsights", () => insights.show());
  register("todoforge.importSettings", () => importSettings(engine.settings.tags));
  register("todoforge.exportMarkdown", () => (root ? saveExport(treeToMarkdown(root), "md") : undefined));
  register("todoforge.copyView", async () => {
    if (!root) {
      return;
    }
    await vscode.env.clipboard.writeText(treeToMarkdown(root));
    void vscode.window.showInformationMessage(vscode.l10n.t("Copied {0} TODOs as a Markdown checklist.", visible.length));
  });
  register("todoforge.openTicket", async (arg: unknown) => {
    let url: string | undefined;
    if (typeof arg === "string" && /^https?:\/\//i.test(arg)) {
      url = arg;
    } else {
      const match = matchFromArg(arg);
      url = match ? ticketUrlOf(match) : undefined;
    }
    if (!url) {
      void vscode.window.showInformationMessage(
        vscode.l10n.t("This TODO has no ticket link. Set todoforge.general.ticketUrl, for example https://github.com/org/repo/issues/${token} or https://jira.example.com/browse/${token}."),
      );
      return;
    }
    await vscode.env.openExternal(vscode.Uri.parse(url));
  });
  register("todoforge.exportJson", () => saveExport(treeToJson(visible), "json"));
  register("todoforge.ai.explain", async (arg: unknown) => {
    if (!engine.settings.aiEnabled) {
      const open = vscode.l10n.t("Open Setting");
      const choice = await vscode.window.showInformationMessage(
        vscode.l10n.t("AI help is off. Turn on todoforge.ai.enabled to use it."),
        open,
      );
      if (choice === open) {
        await vscode.commands.executeCommand("workbench.action.openSettings", "todoforge.ai.enabled");
      }
      return;
    }
    const match = requireMatch(arg);
    if (match) {
      await explainTodo(context, match);
    }
  });
  register("todoforge.refreshChanges", () => git.refreshChanges());

  provider.setDropHandler((request) => {
    void (async () => {
      if (request.kind === "match") {
        const match = engine.findMatch(request.draggedId);
        if (match) {
          await pin(match);
        }
        return;
      }
      const targetId = request.target?.type === "pin" ? request.target.pin.id : undefined;
      await state.setPins(reorderPins(state.pins, request.draggedId, targetId));
    })();
  });

  // ---- events --------------------------------------------------------------

  const syncCodeLens = (): void => {
    lensSubscription?.dispose();
    lensSubscription = engine.settings.codelensEnabled
      ? vscode.languages.registerCodeLensProvider(
          { scheme: "file" },
          createCodeLensProvider(matchesFor, (match) => isPinned(state.pins, match), lensEmitter.event),
        )
      : undefined;
  };

  disposables.push(
    registerHover(services),
    registerCodeActions(services),
    registerCompletion(services, gitOwner),
    engine.onDidUpdate(() => {
      if (!engine.scanning && engine.stats.lastScanAt) {
        scanned = true;
      }
      repaint();
      schedulePublish();
    }),
    engine.onDidChangeSettings(() => {
      syncCodeLens();
      void git.refreshChanges();
      schedulePublish(0);
    }),
    state.onDidChange(() => {
      repaint();
      schedulePublish(0);
    }),
    git.onDidChange(() => schedulePublish()),
    treeView.onDidChangeCheckboxState((event) => {
      void (async () => {
        for (const [element, checkbox] of event.items) {
          const match = element.type === "view" ? element.node.match : element.type === "pin" ? element.match : undefined;
          if (match?.kind === "markdown") {
            await setMarkdownChecked(match, checkbox === vscode.TreeItemCheckboxState.Checked);
          }
        }
      })();
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (currentFileOnly) {
        schedulePublish(0);
      } else {
        schedulePublish();
        scheduleReveal();
      }
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      const line = event.selections[0]?.active.line;
      const onTodo =
        line !== undefined && matchesFor(event.textEditor.document.uri.toString()).some((match) => match.line === line);
      if (onTodo !== cursorOnTodo) {
        cursorOnTodo = onTodo;
        setContext("todoforge.cursorOnTodo", onTodo);
      }
    }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      void git.refreshChanges();
      schedulePublish(0);
    }),
  );

  const offerMigration = async (): Promise<void> => {
    if (!engine.settings.migrateFromTodoTree || context.globalState.get(MIGRATION_KEY) === true) {
      return;
    }
    if (userHasConfiguredTodoForge()) {
      await context.globalState.update(MIGRATION_KEY, true);
      return;
    }
    const patch = todoTreePatch();
    if (Object.keys(patch.values).length === 0) {
      return;
    }
    const copy = vscode.l10n.t("Import");
    const later = vscode.l10n.t("Not Now");
    const choice = await vscode.window.showInformationMessage(
      vscode.l10n.t("TodoForge found your Todo Tree settings. Import tags and excludes?"),
      copy,
      later,
    );
    await context.globalState.update(MIGRATION_KEY, true);
    if (choice === copy) {
      await vscode.commands.executeCommand("todoforge.importSettings");
    }
  };

  disposables.push(
    ...registerChatTools({
      matches: unmuted,
      settings: () => engine.settings,
      git,
      context: () => {
        const base = unmuted()[0];
        return {
          ...queryContext(),
          isUncommitted: git.isUncommitted,
          isOnBranch: git.isOnBranch,
          isPinned: (match) => isPinned(state.pins, match),
          baseRef: base ? git.baseRefOf(base) : undefined,
        };
      },
    }),
  );

  syncCodeLens();
  engine.start();
  void git.refreshChanges();
  setContext("todoforge.scanned", false);
  const migrationTimer = setTimeout(() => {
    offerMigration().catch((error: unknown) => logError("Migration prompt failed", error));
  }, 3000);
  logInfo(`TodoForge started (trusted: ${vscode.workspace.isTrusted})`);

  const api: TodoForgeTestApi = {
    all: () => engine.index.getAll(),
    visible: () => {
      publishNow();
      return visible;
    },
    changes: () => {
      publishNow();
      return { uncommitted: lastChanges.uncommitted, branch: lastChanges.branch };
    },
    pins: () => state.pins.length,
    query: (query) => {
      state.setQuery(query, false);
      publishNow();
      return visible.length;
    },
    scanned: () => scanned,
    refresh: async () => {
      await engine.refresh();
      await git.refreshChanges();
      publishNow();
    },
  };

  return {
    api,
    dispose: (): void => {
      clearTimeout(migrationTimer);
      if (publishTimer) {
        clearTimeout(publishTimer);
      }
      if (revealTimer) {
        clearTimeout(revealTimer);
      }
      lensSubscription?.dispose();
      for (const disposable of disposables) {
        disposable.dispose();
      }
      git.dispose();
      state.dispose();
      engine.dispose();
    },
  };
};

export type { TreeElement };
