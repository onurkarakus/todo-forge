import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";

import { resolveRgPath } from "./scanning/rgPath";

import { cycleMatch } from "./commands/navigation";
import { mapTodoTreeSettings } from "./config/migration";
import {
  DEFAULT_LABEL_FORMAT,
  DOCUMENT_CHUNK_LINES,
  FULL_SCAN_PATH_THRESHOLD,
} from "./config/defaults";
import { readSettings, updateSetting, userHasConfiguredTodoForge } from "./config/settings";
import { createCodeLensProvider } from "./codelens/todoCodeLens";
import { createHighlighter } from "./highlighting/highlighter";
import { logError, logInfo } from "./logger";
import { enabledExcludeGlobs, mergeExcludes } from "./scanning/excludes";
import { createIndex } from "./scanning/indexStore";
import { accumulateWindows, applyLineChanges, changeFromEdit, type LineWindow } from "./scanning/lineShift";
import { scanLineSlice, scanRoots, type ScanRoot } from "./scanning/scanner";
import type { ParseOptions } from "./scanning/parseLine";
import { createStatusBar } from "./statusbar";
import { openTaskEditor } from "./tasks/editorPanel";
import { readTaskFile, taskFilePath, writeTaskFile } from "./tasks/fileStore";
import { tasksToMarkdown } from "./tasks/markdownExport";
import {
  applyDraft,
  reorderSubtasks,
  reorderTasks,
  findTaskForMatch,
  taskFromMatch,
  toggleSubtask,
} from "./tasks/model";
import { replaceTagOnLine, setCheckboxLine } from "./tasks/sourceEdit";
import { treeToJson, treeToMarkdown } from "./tree/exportTree";
import type { TreeElement } from "./tree/elements";
import { filterMatches } from "./tree/filter";
import { findFileNodeId, groupMatches, type ViewNode } from "./tree/grouping";
import { MIME_MATCH, TodoTreeProvider } from "./tree/todoTreeProvider";
import type { TodoForgeSettings, TodoMatch, TrackedTask } from "./types";
import { coalescePaths, type PathCoalescer } from "./utils/debounce";
import { errorMessage } from "./utils/errors";
import { folderGlob, relativePosix } from "./utils/paths";

const TASK_STATE_KEY = "todoforge.tasks";
const MIGRATION_KEY = "todoforge.migrationPrompted";

let cachedRgPath: string | undefined;

const rgBinary = (): string => {
  cachedRgPath ??= resolveRgPath();
  return cachedRgPath;
};

const parseOptionsOf = (settings: TodoForgeSettings): ParseOptions => {
  return {
    tags: settings.tags,
    caseSensitive: settings.caseSensitive,
    customRegex: settings.regexCustom,
    subTagRegex: settings.subTagRegex,
    markdownEnabled: settings.markdownEnabled,
    multiline: settings.multiline,
    multilineMaxLines: settings.multilineMaxLines,
  };
};

const labelFormatOf = (settings: TodoForgeSettings): string => {
  if (settings.labelFormat !== DEFAULT_LABEL_FORMAT) {
    return settings.labelFormat;
  }
  return settings.groupBy === "file" ? DEFAULT_LABEL_FORMAT : "${file}:${line} ${text}";
};

const excludesOf = (settings: TodoForgeSettings): string[] => {
  if (!settings.useVsCodeExcludes) {
    return [...settings.excludeGlobs];
  }
  return mergeExcludes(
    settings.excludeGlobs,
    enabledExcludeGlobs(vscode.workspace.getConfiguration("files").get("exclude")),
    enabledExcludeGlobs(vscode.workspace.getConfiguration("search").get("exclude")),
  );
};

const openFilePaths = (): string[] => {
  const files = new Set<string>();
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputText && tab.input.uri.scheme === "file") {
        files.add(tab.input.uri.fsPath);
      }
    }
  }
  return [...files];
};

const rootsForFiles = (files: readonly string[]): ScanRoot[] => {
  const buckets = new Map<string, string[]>();
  for (const file of files) {
    const folder =
      vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file))?.uri.fsPath ?? path.dirname(file);
    const list = buckets.get(folder) ?? [];
    list.push(file);
    buckets.set(folder, list);
  }
  return [...buckets.entries()].map(([folder, grouped]) => ({
    folder,
    files: grouped,
    toUri: (absolute) => vscode.Uri.file(absolute).toString(),
  }));
};

const buildRoots = (settings: TodoForgeSettings): ScanRoot[] => {
  const toUri = (absolute: string): string => vscode.Uri.file(absolute).toString();
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (settings.scanMode === "currentFile") {
    const document = vscode.window.activeTextEditor?.document;
    if (!document || document.uri.scheme !== "file") {
      return [];
    }
    const folder =
      vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath ?? path.dirname(document.uri.fsPath);
    return [{ folder, files: [document.uri.fsPath], toUri }];
  }
  if (settings.scanMode === "openFiles" || folders.length === 0) {
    return rootsForFiles(openFilePaths());
  }
  return folders.map((folder) => ({ folder: folder.uri.fsPath, toUri }));
};

const locationFor = (
  document: vscode.TextDocument,
): { uri: string; relativePath: string; workspaceFolder?: string } => {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  return {
    uri: document.uri.toString(),
    relativePath: folder
      ? relativePosix(folder.uri.fsPath, document.uri.fsPath)
      : document.uri.fsPath,
    workspaceFolder: folder?.uri.fsPath,
  };
};

const isTreeElement = (value: unknown): value is TreeElement => {
  return Boolean(value) && typeof value === "object" && "type" in (value as object);
};

export const createController = (context: vscode.ExtensionContext): { dispose: () => void } => {
  const index = createIndex();
  const provider = new TodoTreeProvider();
  const highlighter = createHighlighter(index, () => settings);
  const statusBar = createStatusBar();
  const treeView = vscode.window.createTreeView("todoforge.tree", {
    treeDataProvider: provider,
    dragAndDropController: provider,
    showCollapseAll: true,
  });
  let settings = readSettings().settings;
  let tasks: TrackedTask[] = [];
  let filterQuery = "";
  let foundRoot: ViewNode | undefined;
  let scanning = false;
  let generation = 0;
  let scanAbort: AbortController | undefined;
  let decorationKey = "";
  let coalescer: PathCoalescer | undefined;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let fullScanTimer: ReturnType<typeof setTimeout> | undefined;
  const editTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const pendingWindows = new Map<string, LineWindow>();
  const lensEmitter = new vscode.EventEmitter<void>();
  let lensSubscription: vscode.Disposable | undefined;
  const disposables: vscode.Disposable[] = [treeView, lensEmitter, highlighter, statusBar];

  const findMatch = (id: string): TodoMatch | undefined => {
    return index.getAll().find((match) => match.id === id);
  };

  const publish = (): void => {
    const visible = filterMatches(index.getAll(), filterQuery);
    foundRoot = groupMatches(
      visible,
      settings.groupBy,
      labelFormatOf(settings),
      settings.tagGroups,
      settings.markdownGroupSeparately,
    );
    provider.setState(foundRoot, tasks, settings);
    statusBar.update(index.countsByTag(), scanning, settings);
    treeView.badge = settings.showActivityBadge
      ? { value: index.total(), tooltip: `${index.total()} TODOs` }
      : undefined;
    treeView.message = filterQuery ? `Filter: ${filterQuery}` : "";
    const key = `${settings.highlightingEnabled}:${settings.highlightStyle}:${[...index.countsByTag().keys()].sort().join("|")}`;
    if (key !== decorationKey) {
      decorationKey = key;
      highlighter.refresh();
    } else {
      highlighter.paint();
    }
    lensEmitter.fire();
  };

  const scanDocument = async (document: vscode.TextDocument): Promise<void> => {
    const matches: TodoMatch[] = [];
    const location = locationFor(document);
    const options = parseOptionsOf(settings);
    for (let start = 0; start < document.lineCount; start += DOCUMENT_CHUNK_LINES) {
      const end = Math.min(document.lineCount, start + DOCUMENT_CHUNK_LINES);
      const lines: string[] = [];
      for (let line = start; line < end; line += 1) {
        lines.push(document.lineAt(line).text);
      }
      matches.push(...scanLineSlice(lines, start, location, options));
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
    }
    index.setFile(document.uri.toString(), matches);
  };

  const overlayDirty = async (): Promise<void> => {
    for (const document of vscode.workspace.textDocuments) {
      if (document.uri.scheme !== "file" || !document.isDirty) {
        continue;
      }
      if (settings.scanMode === "currentFile") {
        const active = vscode.window.activeTextEditor?.document.uri.toString();
        if (document.uri.toString() !== active) {
          continue;
        }
      }
      await scanDocument(document);
    }
  };

  const refresh = async (): Promise<void> => {
    scanAbort?.abort();
    const abort = new AbortController();
    scanAbort = abort;
    const gen = ++generation;
    const read = readSettings();
    settings = read.settings;
    for (const problem of read.errors) {
      logError(problem);
    }
    scanning = true;
    publish();
    const started = Date.now();
    try {
      const output = await scanRoots({
        rgPath: rgBinary(),
        roots: buildRoots(settings),
        options: parseOptionsOf(settings),
        useGitignore: settings.useGitignore,
        maxFileSizeKb: settings.maxFileSizeKb,
        excludeGlobs: excludesOf(settings),
        includeGlobs: settings.includeGlobs,
        signal: abort.signal,
      });
      if (gen !== generation || abort.signal.aborted || output.cancelled) {
        return;
      }
      index.replaceAll(output.matches);
      await overlayDirty();
      if (output.errors.length > 0) {
        logError(output.errors.join("\n"));
        void vscode.window.showErrorMessage(`TodoForge: ${output.errors[0]}`);
      }
      logInfo(`Scan finished in ${Date.now() - started}ms with ${index.total()} matches`);
    } catch (error) {
      logError("Scan failed", error);
      void vscode.window.showErrorMessage(`TodoForge scan failed: ${errorMessage(error)}`);
    } finally {
      if (gen === generation) {
        scanning = false;
        publish();
      }
    }
  };

  const incremental = async (paths: string[]): Promise<void> => {
    if (paths.length >= FULL_SCAN_PATH_THRESHOLD) {
      await refresh();
      return;
    }
    const present: string[] = [];
    for (const file of paths) {
      try {
        await fs.access(file);
        present.push(file);
      } catch {
        index.removeFile(vscode.Uri.file(file).toString());
      }
    }
    if (present.length === 0) {
      publish();
      return;
    }
    const abort = new AbortController();
    const output = await scanRoots({
      rgPath: rgBinary(),
      roots: rootsForFiles(present),
      options: parseOptionsOf(settings),
      useGitignore: settings.useGitignore,
      maxFileSizeKb: settings.maxFileSizeKb,
      excludeGlobs: excludesOf(settings),
      includeGlobs: settings.includeGlobs,
      signal: abort.signal,
    });
    if (output.cancelled) {
      return;
    }
    for (const file of present) {
      const uri = vscode.Uri.file(file).toString();
      index.setFile(
        uri,
        output.matches.filter((match) => match.uri === uri),
      );
    }
    if (output.errors.length > 0) {
      logError(output.errors.join("\n"));
    }
    publish();
  };

  const scheduleFullScan = (): void => {
    if (fullScanTimer) {
      clearTimeout(fullScanTimer);
    }
    fullScanTimer = setTimeout(() => {
      void refresh();
    }, settings.debounceMs);
  };

  const loadTasks = async (): Promise<void> => {
    if (settings.tasksStorage === "workspaceFile") {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) {
        tasks = context.workspaceState.get<TrackedTask[]>(TASK_STATE_KEY, []);
        return;
      }
      const loaded = await readTaskFile(taskFilePath(folder));
      if (loaded.error) {
        logError(loaded.error);
        void vscode.window.showErrorMessage(`TodoForge could not read tasks: ${loaded.error}`);
        return;
      }
      tasks = loaded.tasks;
      return;
    }
    tasks = context.workspaceState.get<TrackedTask[]>(TASK_STATE_KEY, []);
  };

  const saveTasks = async (): Promise<void> => {
    if (settings.tasksStorage === "workspaceFile") {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) {
        await context.workspaceState.update(TASK_STATE_KEY, tasks);
        return;
      }
      try {
        await writeTaskFile(taskFilePath(folder), tasks);
      } catch (error) {
        logError("Could not write task file", error);
        void vscode.window.showErrorMessage(`TodoForge could not save tasks: ${errorMessage(error)}`);
      }
      return;
    }
    await context.workspaceState.update(TASK_STATE_KEY, tasks);
  };

  const openMatch = async (match: TodoMatch): Promise<void> => {
    const uri = match.uri.startsWith("file:") ? vscode.Uri.parse(match.uri) : vscode.Uri.file(match.uri);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    const position = new vscode.Position(match.line, match.column);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  };

  const openMatchById = async (id: string): Promise<void> => {
    const match = findMatch(id);
    if (!match) {
      void vscode.window.showInformationMessage("TodoForge could not find that TODO.");
      return;
    }
    await openMatch(match);
  };

  const trackMatch = async (match: TodoMatch): Promise<void> => {
    if (!settings.tasksEnabled) {
      void vscode.window.showInformationMessage("TodoForge tasks are disabled.");
      return;
    }
    if (findTaskForMatch(tasks, match)) {
      void vscode.window.showInformationMessage("This TODO is already tracked.");
      return;
    }
    tasks = [...tasks, taskFromMatch(match, tasks.length)];
    await saveTasks();
    publish();
  };

  const setMarkdown = async (match: TodoMatch, checked: boolean): Promise<void> => {
    const uri = vscode.Uri.parse(match.uri);
    const document = await vscode.workspace.openTextDocument(uri);
    if (match.line >= document.lineCount) {
      void vscode.window.showErrorMessage("TodoForge could not find that checklist line.");
      return;
    }
    const line = document.lineAt(match.line);
    const next = setCheckboxLine(line.text, checked);
    if (!next || !line.text.includes("[")) {
      void vscode.window.showErrorMessage("TodoForge could not update that checklist.");
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, line.range, next);
    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      void vscode.window.showErrorMessage("TodoForge could not update that checklist.");
    }
  };

  const markSourceDone = async (task: TrackedTask): Promise<void> => {
    const source = task.sources[0];
    if (!source) {
      return;
    }
    const uri = vscode.Uri.parse(source.uri);
    let document: vscode.TextDocument;
    try {
      document = await vscode.workspace.openTextDocument(uri);
    } catch (error) {
      logError("Could not open task source", error);
      return;
    }
    if (source.line >= document.lineCount) {
      void vscode.window.showWarningMessage("TodoForge left the source comment unchanged.");
      return;
    }
    const line = document.lineAt(source.line);
    const replaced = replaceTagOnLine(line.text, source.tag, 0);
    if (!replaced) {
      void vscode.window.showWarningMessage("TodoForge left the source comment unchanged.");
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, line.range, replaced);
    await vscode.workspace.applyEdit(edit);
  };

  const setTaskDone = async (id: string, done: boolean): Promise<void> => {
    const current = tasks.find((task) => task.id === id);
    tasks = tasks.map((task) => (task.id === id ? { ...task, done } : task));
    await saveTasks();
    publish();
    if (done && settings.updateSourceOnDone && current) {
      await markSourceDone({ ...current, done: true });
    }
  };

  const bindWatchers = (): void => {
    coalescer?.dispose();
    coalescer = coalescePaths(
      (paths) => {
        void incremental(paths);
      },
      settings.debounceMs,
      FULL_SCAN_PATH_THRESHOLD,
    );
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = undefined;
    }
    if (settings.autoRefreshIntervalSec > 0) {
      refreshTimer = setInterval(() => {
        void refresh();
      }, settings.autoRefreshIntervalSec * 1000);
    }
  };

  const syncCodeLens = (): void => {
    lensSubscription?.dispose();
    lensSubscription = undefined;
    if (!settings.codelensEnabled) {
      return;
    }
    lensSubscription = vscode.languages.registerCodeLensProvider(
      { scheme: "file" },
      createCodeLensProvider(index, () => settings, lensEmitter.event),
    );
  };

  const register = (command: string, handler: (...args: unknown[]) => unknown): void => {
    disposables.push(vscode.commands.registerCommand(command, handler));
  };

  register("todoforge.refresh", () => refresh());
  register("todoforge.filter", async () => {
    const value = await vscode.window.showInputBox({ prompt: "Filter TODOs", value: filterQuery });
    if (value === undefined) {
      return;
    }
    filterQuery = value;
    publish();
  });
  register("todoforge.clearFilter", () => {
    filterQuery = "";
    publish();
  });
  register("todoforge.openSettings", () =>
    vscode.commands.executeCommand("workbench.action.openSettings", "todoforge"),
  );
  register("todoforge.setScanMode", async () => {
    const picked = await vscode.window.showQuickPick(
      [
        { label: "Workspace", mode: "workspace" },
        { label: "Open Files", mode: "openFiles" },
        { label: "Current File", mode: "currentFile" },
        { label: "Workspace + Open Files", mode: "workspaceAndOpen" },
      ],
      { placeHolder: "Scan mode" },
    );
    if (!picked) {
      return;
    }
    await updateSetting("scanning.mode", picked.mode);
  });
  register("todoforge.setGroupBy", async () => {
    const picked = await vscode.window.showQuickPick(
      [
        { label: "Tag", mode: "tag" },
        { label: "File", mode: "file" },
        { label: "Sub-tag", mode: "subtag" },
        { label: "Flat", mode: "flat" },
      ],
      { placeHolder: "Group TODOs by" },
    );
    if (!picked) {
      return;
    }
    await updateSetting("tree.groupBy", picked.mode);
  });
  register("todoforge.openMatch", (id: unknown) => {
    if (typeof id === "string") {
      return openMatchById(id);
    }
    return undefined;
  });
  register("todoforge.goToNext", () => move(1));
  register("todoforge.goToPrevious", () => move(-1));
  register("todoforge.revealFile", async () => {
    const uri = vscode.window.activeTextEditor?.document.uri.toString();
    if (!uri || !foundRoot) {
      return;
    }
    const id = findFileNodeId(foundRoot, uri);
    if (!id) {
      void vscode.window.showInformationMessage("This file has no TODOs in the current filter.");
      return;
    }
    const element = provider.findElement(id);
    if (element) {
      await treeView.reveal(element, { select: true, focus: true, expand: true });
    }
  });
  register("todoforge.quickPick", async () => {
    const picked = await vscode.window.showQuickPick(
      index.getAll().map((match) => ({
        label: `${match.tag}: ${match.text || match.raw.trim()}`,
        description: `${match.relativePath}:${match.line + 1}`,
        match,
      })),
      { placeHolder: "Jump to a TODO" },
    );
    if (picked) {
      await openMatch(picked.match);
    }
  });
  register("todoforge.copy", async (arg: unknown) => {
    const text = copyText(arg);
    if (!text) {
      void vscode.window.showInformationMessage("TodoForge has nothing to copy.");
      return;
    }
    await vscode.env.clipboard.writeText(text);
  });
  register("todoforge.revealInExplorer", (arg: unknown) => {
    const uri = uriFromArg(arg);
    if (!uri) {
      return;
    }
    return vscode.commands.executeCommand("revealInExplorer", uri);
  });
  register("todoforge.hideFolder", async (arg: unknown) => {
    if (!isTreeElement(arg) || arg.type !== "view" || arg.node.kind !== "folder" || !arg.node.resourcePath) {
      void vscode.window.showInformationMessage("Choose a folder in the TodoForge tree.");
      return;
    }
    const choice = await vscode.window.showWarningMessage(
      `Hide ${arg.node.resourcePath} from TodoForge scans?`,
      { modal: true },
      "Hide",
    );
    if (choice !== "Hide") {
      return;
    }
    await updateSetting("scanning.excludeGlobs", [...settings.excludeGlobs, folderGlob(arg.node.resourcePath)]);
  });
  register("todoforge.trackAsTask", async (arg: unknown) => {
    const match = matchFromArg(arg);
    if (!match) {
      void vscode.window.showInformationMessage("Choose a TODO to track.");
      return;
    }
    await trackMatch(match);
  });
  register("todoforge.toggleMarkdown", async (arg: unknown) => {
    const match = matchFromArg(arg);
    if (!match || match.kind !== "markdown") {
      return;
    }
    await setMarkdown(match, !match.markdownChecked);
  });
  register("todoforge.editTask", async (arg: unknown) => {
    const task = taskFromArg(arg);
    if (!task) {
      return;
    }
    const draft = await openTaskEditor(task);
    if (!draft) {
      return;
    }
    const applied = applyDraft(task, draft);
    if (!applied.task) {
      void vscode.window.showErrorMessage(applied.error ?? "TodoForge could not save the task.");
      return;
    }
    tasks = tasks.map((item) => (item.id === task.id ? applied.task ?? item : item));
    await saveTasks();
    publish();
  });
  register("todoforge.toggleTaskDone", async (arg: unknown) => {
    if (!isTreeElement(arg)) {
      return;
    }
    if (arg.type === "task") {
      await setTaskDone(arg.task.id, !arg.task.done);
    }
    if (arg.type === "subtask") {
      tasks = toggleSubtask(tasks, arg.taskId, arg.subtask.id);
      await saveTasks();
      publish();
    }
  });
  register("todoforge.exportTasks", () => saveExport(tasksToMarkdown(tasks), "md"));
  register("todoforge.exportMarkdown", () => {
    if (!foundRoot) {
      return undefined;
    }
    return saveExport(treeToMarkdown(foundRoot, tasks), "md");
  });
  register("todoforge.exportJson", () => saveExport(treeToJson(filterMatches(index.getAll(), filterQuery), tasks), "json"));

  const move = async (direction: 1 | -1): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const matches = index.getFile(editor.document.uri.toString());
    const next = cycleMatch(matches, editor.selection.active.line, editor.selection.active.character, direction);
    if (!next) {
      void vscode.window.showInformationMessage("No TODOs in this file.");
      return;
    }
    await openMatch(next);
  };

  const matchFromArg = (arg: unknown): TodoMatch | undefined => {
    if (typeof arg === "string") {
      return findMatch(arg);
    }
    if (isTreeElement(arg) && arg.type === "view") {
      return arg.node.match;
    }
    return undefined;
  };

  const taskFromArg = (arg: unknown): TrackedTask | undefined => {
    if (isTreeElement(arg) && arg.type === "task") {
      return tasks.find((task) => task.id === arg.task.id) ?? arg.task;
    }
    return undefined;
  };

  const copyText = (arg: unknown): string | undefined => {
    const match = matchFromArg(arg);
    if (match) {
      return match.raw.trim();
    }
    const task = taskFromArg(arg);
    return task?.title;
  };

  const uriFromArg = (arg: unknown): vscode.Uri | undefined => {
    const match = matchFromArg(arg);
    if (match) {
      return vscode.Uri.parse(match.uri);
    }
    if (isTreeElement(arg) && arg.type === "view" && arg.node.kind === "file" && arg.node.resourcePath) {
      return vscode.Uri.parse(arg.node.resourcePath);
    }
    if (isTreeElement(arg) && arg.type === "view" && arg.node.kind === "folder" && arg.node.resourcePath) {
      const folder = vscode.workspace.workspaceFolders?.[0];
      return folder ? vscode.Uri.joinPath(folder.uri, arg.node.resourcePath) : undefined;
    }
    return undefined;
  };

  const saveExport = async (contents: string, extension: string): Promise<void> => {
    const uri = await vscode.window.showSaveDialog({
      filters: extension === "json" ? { JSON: ["json"] } : { Markdown: ["md"] },
    });
    if (!uri) {
      return;
    }
    await vscode.workspace.fs.writeFile(uri, Buffer.from(contents, "utf8"));
  };

  provider.setDropHandler((request) => {
    void (async () => {
      if (request.mime === MIME_MATCH) {
        const match = findMatch(request.draggedId);
        if (match) {
          await trackMatch(match);
        }
        return;
      }
      if (request.parentId) {
        const targetId = request.target?.type === "subtask" ? request.target.subtask.id : undefined;
        tasks = reorderSubtasks(tasks, request.parentId, request.draggedId, targetId);
      } else {
        const targetId = request.target?.type === "task" ? request.target.task.id : undefined;
        tasks = reorderTasks(tasks, request.draggedId, targetId);
      }
      await saveTasks();
      publish();
    })();
  });

  disposables.push(
    treeView.onDidChangeCheckboxState((event) => {
      void (async () => {
        for (const [element, state] of event.items) {
          const checked = state === vscode.TreeItemCheckboxState.Checked;
          if (element.type === "view" && element.node.match?.kind === "markdown") {
            await setMarkdown(element.node.match, checked);
          } else if (element.type === "task") {
            await setTaskDone(element.task.id, checked);
          } else if (element.type === "subtask") {
            tasks = tasks.map((task) =>
              task.id === element.taskId
                ? {
                    ...task,
                    subtasks: task.subtasks.map((subtask) =>
                      subtask.id === element.subtask.id ? { ...subtask, done: checked } : subtask,
                    ),
                  }
                : task,
            );
            await saveTasks();
            publish();
          }
        }
      })();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const document = event.document;
      if (document.uri.scheme !== "file" || event.contentChanges.length === 0) {
        return;
      }
      const uri = document.uri.toString();
      const changes = event.contentChanges.map((change) =>
        changeFromEdit(change.range.start.line, change.range.end.line, change.text),
      );
      index.setFile(uri, applyLineChanges(index.getFile(uri), changes));
      const window = accumulateWindows(pendingWindows.get(uri), changes, 5, document.lineCount);
      if (window) {
        pendingWindows.set(uri, window);
      }
      const existing = editTimers.get(uri);
      if (existing) {
        clearTimeout(existing);
      }
      editTimers.set(
        uri,
        setTimeout(() => {
          const slice = pendingWindows.get(uri);
          pendingWindows.delete(uri);
          editTimers.delete(uri);
          if (!slice) {
            return;
          }
          const lines: string[] = [];
          for (let line = slice.start; line < slice.end && line < document.lineCount; line += 1) {
            lines.push(document.lineAt(line).text);
          }
          index.mergeWindow(
            uri,
            slice.start,
            slice.end,
            scanLineSlice(lines, slice.start, locationFor(document), parseOptionsOf(settings)),
          );
          publish();
        }, 150),
      );
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        !event.affectsConfiguration("todoforge") &&
        !event.affectsConfiguration("files.exclude") &&
        !event.affectsConfiguration("search.exclude")
      ) {
        return;
      }
      settings = readSettings().settings;
      bindWatchers();
      syncCodeLens();
      void loadTasks().then(() => refresh());
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (settings.scanMode === "currentFile") {
        void refresh();
      } else {
        highlighter.paint();
      }
    }),
  );

  const fileWatcher = vscode.workspace.createFileSystemWatcher("**/*");
  disposables.push(
    fileWatcher,
    fileWatcher.onDidCreate((uri) => {
      if (uri.scheme === "file") {
        coalescer?.push(uri.fsPath);
      }
    }),
    fileWatcher.onDidChange((uri) => {
      if (uri.scheme === "file") {
        coalescer?.push(uri.fsPath);
      }
    }),
    fileWatcher.onDidDelete((uri) => {
      if (uri.scheme === "file") {
        index.removeFile(uri.toString());
        publish();
      }
    }),
  );

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const head = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, ".git/HEAD"));
    disposables.push(
      head,
      head.onDidChange(() => {
        if (settings.refreshOnGitHeadChange) {
          scheduleFullScan();
        }
      }),
    );
  }

  bindWatchers();
  syncCodeLens();
  const startup = setTimeout(() => {
    void (async () => {
      try {
        await loadTasks();
        await offerMigration();
        await refresh();
      } catch (error) {
        logError("Startup scan failed", error);
        void vscode.window.showErrorMessage(`TodoForge failed to start: ${errorMessage(error)}`);
      }
    })();
  }, 0);

  const offerMigration = async (): Promise<void> => {
    if (!settings.migrateFromTodoTree || context.globalState.get(MIGRATION_KEY) === true) {
      return;
    }
    if (userHasConfiguredTodoForge()) {
      await context.globalState.update(MIGRATION_KEY, true);
      return;
    }
    const todo = vscode.workspace.getConfiguration("todo-tree");
    const patch = mapTodoTreeSettings({
      tags: todo.get("general.tags"),
      tagGroups: todo.get("general.tagGroups"),
      excludeGlobs: todo.get("filtering.excludeGlobs"),
      includeGlobs: todo.get("filtering.includeGlobs"),
      regex: todo.get("regex.regex"),
      caseSensitive: todo.get("regex.regexCaseSensitive"),
      customHighlight: todo.get("highlights.customHighlight"),
    });
    if (Object.keys(patch.values).length === 0) {
      return;
    }
    const choice = await vscode.window.showInformationMessage(
      "TodoForge can copy supported settings from Todo Tree.",
      "Copy Settings",
      "Not Now",
    );
    await context.globalState.update(MIGRATION_KEY, true);
    if (choice !== "Copy Settings") {
      logInfo(`Skipped Todo Tree keys: ${patch.ignored.join(", ")}`);
      return;
    }
    for (const [key, value] of Object.entries(patch.values)) {
      await updateSetting(key, value);
    }
    logInfo(`Copied Todo Tree settings. Ignored: ${patch.ignored.join(", ")}`);
  };

  return {
    dispose: (): void => {
      clearTimeout(startup);
      if (fullScanTimer) {
        clearTimeout(fullScanTimer);
      }
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
      for (const timer of editTimers.values()) {
        clearTimeout(timer);
      }
      coalescer?.dispose();
      scanAbort?.abort();
      lensSubscription?.dispose();
      for (const disposable of disposables) {
        disposable.dispose();
      }
    },
  };
};
