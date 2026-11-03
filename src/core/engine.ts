import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";

import { DOCUMENT_CHUNK_LINES, FULL_SCAN_PATH_THRESHOLD, LIVE_EDIT_DEBOUNCE_MS } from "../config/defaults";
import { readSettings } from "../config/settings";
import { createGitRunner, ignoredPaths } from "../git/gitService";
import { logError, logInfo } from "../logger";
import { enabledExcludeGlobs, mergeExcludes } from "../scanning/excludes";
import { createIndex, type IndexStore } from "../scanning/indexStore";
import { accumulateWindows, applyLineChanges, changeFromEdit, type LineWindow } from "../scanning/lineShift";
import type { ParseOptions } from "../scanning/parseLine";
import { createPathFilter, type PathFilter } from "../scanning/pathFilter";
import { resolveRgPath } from "../scanning/rgPath";
import { scanLineSlice, scanRoots, type ScanRoot } from "../scanning/scanner";
import type { SourceLocation, TodoForgeSettings, TodoMatch } from "../types";
import { coalescePaths, type PathCoalescer } from "../utils/debounce";
import { errorMessage } from "../utils/errors";
import { relativePosix, toPosixPath } from "../utils/paths";

export interface ScanStats {
  lastScanMs: number;
  lastScanAt?: Date;
  files: number;
}

export interface Engine {
  readonly index: IndexStore;
  readonly settings: TodoForgeSettings;
  readonly scanning: boolean;
  readonly stats: ScanStats;
  refresh: () => Promise<void>;
  findMatch: (id: string) => TodoMatch | undefined;
  /** Fires after the index or settings change, coalesced to one event per tick. */
  onDidUpdate: vscode.Event<void>;
  onDidChangeSettings: vscode.Event<TodoForgeSettings>;
  start: () => void;
  dispose: () => void;
}

let cachedRgPath: string | undefined;

const rgBinary = (): string => {
  cachedRgPath ??= resolveRgPath();
  return cachedRgPath;
};

export const parseOptionsOf = (settings: TodoForgeSettings): ParseOptions => {
  return {
    tags: settings.tags,
    strictTags: settings.strictTags,
    caseSensitive: settings.caseSensitive,
    customRegex: settings.regexCustom,
    subTagRegex: settings.subTagRegex,
    markdownEnabled: settings.markdownEnabled,
    multiline: settings.multiline,
    multilineMaxLines: settings.multilineMaxLines,
    dotnetPatterns: settings.dotnetPatterns,
  };
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

const toUri = (absolute: string): string => vscode.Uri.file(absolute).toString();

const rootsForFiles = (files: readonly string[]): ScanRoot[] => {
  const buckets = new Map<string, string[]>();
  for (const file of files) {
    const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file))?.uri.fsPath ?? path.dirname(file);
    const list = buckets.get(folder) ?? [];
    list.push(file);
    buckets.set(folder, list);
  }
  return [...buckets.entries()].map(([folder, grouped]) => ({ folder, files: grouped, toUri }));
};

const buildRoots = (settings: TodoForgeSettings): ScanRoot[] => {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (settings.scanMode === "currentFile") {
    const document = vscode.window.activeTextEditor?.document;
    if (!document || document.uri.scheme !== "file") {
      return [];
    }
    return rootsForFiles([document.uri.fsPath]);
  }
  if (settings.scanMode === "openFiles" || folders.length === 0) {
    return rootsForFiles(openFilePaths());
  }
  const roots: ScanRoot[] = folders.map((folder) => ({ folder: folder.uri.fsPath, toUri }));
  if (settings.scanMode === "workspaceAndOpen") {
    const outside = openFilePaths().filter((file) => !vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file)));
    roots.push(...rootsForFiles(outside));
  }
  return roots;
};

export const locationFor = (document: vscode.TextDocument): SourceLocation => {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  return {
    uri: document.uri.toString(),
    relativePath: folder ? relativePosix(folder.uri.fsPath, document.uri.fsPath) : toPosixPath(document.uri.fsPath),
    workspaceFolder: folder?.uri.fsPath,
  };
};

const SCAN_SECTIONS = [
  "todoforge.general",
  "todoforge.regex",
  "todoforge.dotnet",
  "todoforge.scanning",
  "todoforge.markdown.enabled",
  "files.exclude",
  "search.exclude",
];

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export const createEngine = (gitAllowed: () => boolean): Engine => {
  const index = createIndex();
  const updateEmitter = new vscode.EventEmitter<void>();
  const settingsEmitter = new vscode.EventEmitter<TodoForgeSettings>();
  const git = createGitRunner();
  let settings = readSettings().settings;
  let pathFilter: PathFilter = createPathFilter(excludesOf(settings), settings.includeGlobs);
  let scanning = false;
  let generation = 0;
  let scanAbort: AbortController | undefined;
  let coalescer: PathCoalescer | undefined;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let fullScanTimer: ReturnType<typeof setTimeout> | undefined;
  let updateQueued = false;
  let headWatchers: vscode.Disposable[] = [];
  const editTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const pendingWindows = new Map<string, LineWindow>();
  const stats: ScanStats = { lastScanMs: 0, files: 0 };
  const disposables: vscode.Disposable[] = [updateEmitter, settingsEmitter];

  const fireUpdate = (): void => {
    if (updateQueued) {
      return;
    }
    updateQueued = true;
    setImmediate(() => {
      updateQueued = false;
      updateEmitter.fire();
    });
  };

  const inScope = (uri: vscode.Uri): boolean => {
    if (uri.scheme !== "file") {
      return false;
    }
    if (settings.scanMode === "currentFile") {
      return vscode.window.activeTextEditor?.document.uri.toString() === uri.toString();
    }
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) {
      return settings.scanMode !== "workspace" || (vscode.workspace.workspaceFolders ?? []).length === 0;
    }
    return pathFilter.accepts(relativePosix(folder.uri.fsPath, uri.fsPath));
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
      await tick();
    }
    index.setFile(document.uri.toString(), matches);
  };

  const overlayDirty = async (): Promise<void> => {
    for (const document of vscode.workspace.textDocuments) {
      if (document.isDirty && inScope(document.uri)) {
        await scanDocument(document);
      }
    }
  };

  const runFullScan = async (): Promise<void> => {
    scanAbort?.abort();
    const abort = new AbortController();
    scanAbort = abort;
    const gen = ++generation;
    const read = readSettings();
    settings = read.settings;
    pathFilter = createPathFilter(excludesOf(settings), settings.includeGlobs);
    for (const problem of read.errors) {
      logError(problem);
    }
    scanning = true;
    fireUpdate();
    const started = performance.now();
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
        void vscode.window.showWarningMessage(vscode.l10n.t("TodoForge: {0}", output.errors[0] ?? ""));
      }
      stats.lastScanMs = Math.round(performance.now() - started);
      stats.lastScanAt = new Date();
      stats.files = new Set(output.matches.map((match) => match.uri)).size;
      logInfo(`Scan finished in ${stats.lastScanMs}ms with ${index.total()} matches in ${stats.files} files`);
    } catch (error) {
      logError("Scan failed", error);
      void vscode.window.showErrorMessage(vscode.l10n.t("TodoForge scan failed: {0}", errorMessage(error)));
    } finally {
      if (gen === generation) {
        scanning = false;
        fireUpdate();
      }
    }
  };

  /** Full scans report progress only inside the TodoForge view, never as a notification. */
  const refresh = (): Promise<void> => {
    return Promise.resolve(
      vscode.window.withProgress({ location: { viewId: "todoforge.tree" } }, () => runFullScan()),
    );
  };

  /** Drops gitignored and excluded paths before ripgrep sees them; rg searches explicit paths even when ignored. */
  const acceptedPaths = async (files: readonly string[]): Promise<string[]> => {
    const accepted = files.filter((file) => inScope(vscode.Uri.file(file)));
    if (!settings.useGitignore || !gitAllowed() || accepted.length === 0) {
      return accepted;
    }
    const byFolder = new Map<string, string[]>();
    for (const file of accepted) {
      const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file))?.uri.fsPath;
      if (!folder) {
        continue;
      }
      const list = byFolder.get(folder) ?? [];
      list.push(relativePosix(folder, file));
      byFolder.set(folder, list);
    }
    const ignored = new Set<string>();
    for (const [folder, relative] of byFolder) {
      for (const entry of await ignoredPaths(git, folder, relative)) {
        ignored.add(path.join(folder, ...entry.split("/")));
      }
    }
    return accepted.filter((file) => !ignored.has(file));
  };

  const incremental = async (paths: string[]): Promise<void> => {
    if (paths.length >= FULL_SCAN_PATH_THRESHOLD) {
      await refresh();
      return;
    }
    const present: string[] = [];
    for (const file of paths) {
      try {
        const stat = await fs.stat(file);
        if (stat.isFile()) {
          present.push(file);
        }
      } catch {
        index.removeFile(toUri(file));
      }
    }
    const accepted = await acceptedPaths(present);
    for (const file of present) {
      if (!accepted.includes(file)) {
        index.removeFile(toUri(file));
      }
    }
    if (accepted.length === 0) {
      fireUpdate();
      return;
    }
    const output = await scanRoots({
      rgPath: rgBinary(),
      roots: rootsForFiles(accepted),
      options: parseOptionsOf(settings),
      useGitignore: settings.useGitignore,
      maxFileSizeKb: settings.maxFileSizeKb,
      excludeGlobs: excludesOf(settings),
      includeGlobs: settings.includeGlobs,
      signal: new AbortController().signal,
    });
    if (output.cancelled) {
      return;
    }
    for (const file of accepted) {
      const uri = toUri(file);
      const open = vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri);
      if (open?.isDirty) {
        continue;
      }
      index.setFile(uri, output.matches.filter((match) => match.uri === uri));
    }
    if (output.errors.length > 0) {
      logError(output.errors.join("\n"));
    }
    fireUpdate();
  };

  const scheduleFullScan = (): void => {
    if (fullScanTimer) {
      clearTimeout(fullScanTimer);
    }
    fullScanTimer = setTimeout(() => {
      void refresh();
    }, Math.max(settings.debounceMs, 500));
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
    for (const watcher of headWatchers) {
      watcher.dispose();
    }
    headWatchers = [];
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const head = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, ".git/HEAD"));
      headWatchers.push(
        head,
        head.onDidChange(() => {
          if (settings.refreshOnGitHeadChange) {
            scheduleFullScan();
          }
        }),
        head.onDidCreate(() => {
          if (settings.refreshOnGitHeadChange) {
            scheduleFullScan();
          }
        }),
      );
    }
  };

  const onFileEvent = (uri: vscode.Uri): void => {
    // Build output (bin, obj, node_modules) and .git churn stop here, before any I/O.
    if (!inScope(uri) || settings.scanMode === "currentFile" || settings.scanMode === "openFiles") {
      return;
    }
    coalescer?.push(uri.fsPath);
  };

  const fileWatcher = vscode.workspace.createFileSystemWatcher("**/*");
  disposables.push(
    fileWatcher,
    fileWatcher.onDidCreate(onFileEvent),
    fileWatcher.onDidChange(onFileEvent),
    fileWatcher.onDidDelete((uri) => {
      if (uri.scheme !== "file") {
        return;
      }
      const prefix = uri.toString();
      let removed = false;
      for (const match of index.getAll()) {
        if (match.uri === prefix || match.uri.startsWith(`${prefix}/`)) {
          index.removeFile(match.uri);
          removed = true;
        }
      }
      if (removed) {
        fireUpdate();
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const document = event.document;
      if (event.contentChanges.length === 0 || !inScope(document.uri)) {
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
          fireUpdate();
        }, Math.min(LIVE_EDIT_DEBOUNCE_MS, 150)),
      );
      fireUpdate();
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      // A closed dirty buffer reverts to what is on disk.
      if (document.isDirty && inScope(document.uri) && settings.scanMode !== "openFiles") {
        coalescer?.push(document.uri.fsPath);
      }
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
      pathFilter = createPathFilter(excludesOf(settings), settings.includeGlobs);
      settingsEmitter.fire(settings);
      // View settings (grouping, colors, status bar, git) repaint without a rescan.
      const rescan =
        SCAN_SECTIONS.some((section) => event.affectsConfiguration(section));
      if (rescan) {
        bindWatchers();
        void refresh();
      } else {
        fireUpdate();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      bindWatchers();
      void refresh();
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (settings.scanMode === "currentFile") {
        void refresh();
      }
    }),
    vscode.window.tabGroups.onDidChangeTabs((event) => {
      if (
        (settings.scanMode === "openFiles" || settings.scanMode === "workspaceAndOpen") &&
        (event.opened.length > 0 || event.closed.length > 0)
      ) {
        scheduleFullScan();
      }
    }),
  );

  let startup: ReturnType<typeof setTimeout> | undefined;

  return {
    index,
    get settings() {
      return settings;
    },
    get scanning() {
      return scanning;
    },
    stats,
    refresh,
    findMatch: (id) => index.getAll().find((match) => match.id === id),
    onDidUpdate: updateEmitter.event,
    onDidChangeSettings: settingsEmitter.event,
    start: () => {
      bindWatchers();
      startup = setTimeout(() => {
        void refresh();
      }, 0);
    },
    dispose: () => {
      if (startup) {
        clearTimeout(startup);
      }
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
      for (const watcher of headWatchers) {
        watcher.dispose();
      }
      for (const disposable of disposables) {
        disposable.dispose();
      }
    },
  };
};
