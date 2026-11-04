import * as vscode from "vscode";

import { logInfo } from "../logger";
import { changeFromEdit } from "../scanning/lineShift";
import type { BlameInfo, TodoForgeSettings, TodoMatch } from "../types";
import {
  blameLines,
  changeSets,
  createGitRunner,
  fileStamp,
  lineIsIn,
  userIdentity,
  type ChangeSets,
} from "./gitService";
import { createEditLog, mapLineSet, type LineSet } from "./lineMap";

export interface GitState {
  /** Folder path to change sets; missing when the folder is not a repository. */
  changes: Map<string, ChangeSets>;
  me: { names: string[]; emails: string[] };
}

export interface GitContext {
  readonly available: boolean;
  readonly state: GitState;
  isUncommitted: (match: TodoMatch) => boolean;
  isOnBranch: (match: TodoMatch) => boolean;
  isNew: (match: TodoMatch) => boolean;
  baseRefOf: (match: TodoMatch) => string | undefined;
  blameOf: (match: TodoMatch) => BlameInfo | undefined;
  /** Blames the lines of these matches that are not cached yet. */
  ensureBlame: (matches: readonly TodoMatch[], token?: vscode.CancellationToken) => Promise<void>;
  blameOne: (match: TodoMatch) => Promise<BlameInfo | undefined>;
  refreshChanges: () => Promise<void>;
  onDidChange: vscode.Event<void>;
  dispose: () => void;
}

interface FileBlame {
  stamp: string;
  lines: Map<number, BlameInfo>;
}

const CONCURRENCY = 4;

/**
 * Local git only: diff, blame, config and merge-base. Never fetch, pull or
 * talk to a remote. Disabled in untrusted workspaces.
 */
export const createGitContext = (
  getSettings: () => TodoForgeSettings,
  allowed: () => boolean,
): GitContext => {
  const runner = createGitRunner();
  const emitter = new vscode.EventEmitter<void>();
  const blames = new Map<string, FileBlame>();
  let state: GitState = { changes: new Map(), me: { names: [], emails: [] } };
  let available = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshing: Promise<void> | undefined;

  const enabled = (): boolean => allowed() && getSettings().gitEnabled;

  const changesFor = (match: TodoMatch): ChangeSets | undefined => {
    return match.workspaceFolder ? state.changes.get(match.workspaceFolder) : undefined;
  };

  const filePath = (match: TodoMatch): string => vscode.Uri.parse(match.uri).fsPath;

  // git diff reads the files on disk. While a buffer has unsaved edits, the
  // TODO lines come from the live buffer, so the diff's line numbers are
  // shifted through the edits made since the last save.
  const edits = createEditLog();
  let generation = 0;
  const mapped = new Map<string, { key: string; uncommitted?: LineSet; branch?: LineSet }>();

  const liveSets = (match: TodoMatch, sets: ChangeSets): { uncommitted?: LineSet; branch?: LineSet } => {
    const file = filePath(match);
    const version = edits.version(match.uri);
    if (version === 0) {
      return { uncommitted: sets.uncommitted.get(file), branch: sets.branch.get(file) };
    }
    const key = `${generation}:${version}`;
    const cached = mapped.get(match.uri);
    if (cached?.key === key) {
      return cached;
    }
    const pending = edits.pending(match.uri);
    const result = {
      key,
      uncommitted: mapLineSet(sets.uncommitted.get(file), pending),
      branch: mapLineSet(sets.branch.get(file), pending),
    };
    mapped.set(match.uri, result);
    return result;
  };

  const refreshChanges = async (): Promise<void> => {
    if (!enabled()) {
      state = { changes: new Map(), me: { names: [], emails: [] } };
      available = false;
      emitter.fire();
      return;
    }
    const started = performance.now();
    const snapshot = edits.snapshot();
    const changes = new Map<string, ChangeSets>();
    const names = new Set<string>();
    const emails = new Set<string>();
    const owner = getSettings().owner;
    if (owner) {
      names.add(owner.replace(/^@/, ""));
    }
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      if (folder.uri.scheme !== "file") {
        continue;
      }
      const sets = await changeSets(runner, folder.uri.fsPath, getSettings().gitBaseBranch);
      if (!sets) {
        continue;
      }
      changes.set(folder.uri.fsPath, sets);
      const identity = await userIdentity(runner, folder.uri.fsPath);
      if (identity.name) {
        names.add(identity.name);
      }
      if (identity.email) {
        emails.add(identity.email);
      }
    }
    available = changes.size > 0;
    state = { changes, me: { names: [...names], emails: [...emails] } };
    edits.settle(snapshot);
    generation += 1;
    mapped.clear();
    logInfo(`Git changes read in ${Math.round(performance.now() - started)}ms`);
    emitter.fire();
  };

  const scheduleRefresh = (): void => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      refreshing = refreshChanges().finally(() => {
        refreshing = undefined;
      });
    }, 800);
  };

  const ensureBlame = async (matches: readonly TodoMatch[], token?: vscode.CancellationToken): Promise<void> => {
    if (!enabled() || getSettings().blameMode === "off") {
      return;
    }
    if (refreshing) {
      await refreshing;
    }
    const byFile = new Map<string, TodoMatch[]>();
    for (const match of matches) {
      if (!changesFor(match) || match.uri.startsWith("untitled:")) {
        continue;
      }
      const list = byFile.get(match.uri) ?? [];
      list.push(match);
      byFile.set(match.uri, list);
    }
    const jobs = [...byFile.entries()];
    let changed = false;
    const worker = async (): Promise<void> => {
      for (let job = jobs.shift(); job; job = jobs.shift()) {
        if (token?.isCancellationRequested) {
          return;
        }
        const [uri, list] = job;
        const file = filePath(list[0] as TodoMatch);
        const document = vscode.workspace.textDocuments.find((item) => item.uri.toString() === uri);
        const stamp = document?.isDirty ? `dirty:${document.version}` : await fileStamp(file);
        if (!stamp) {
          continue;
        }
        const cached = blames.get(uri);
        const wanted = list.map((match) => match.line + 1);
        if (cached && cached.stamp === stamp && wanted.every((line) => cached.lines.has(line))) {
          continue;
        }
        const missing = cached && cached.stamp === stamp ? wanted.filter((line) => !cached.lines.has(line)) : wanted;
        const result = await blameLines(runner, file, missing, document?.isDirty ? document.getText() : undefined);
        const lines = cached && cached.stamp === stamp ? cached.lines : new Map<number, BlameInfo>();
        for (const [line, info] of result) {
          lines.set(line, info);
        }
        blames.set(uri, { stamp, lines });
        changed = true;
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    if (changed) {
      emitter.fire();
    }
  };

  const disposables: vscode.Disposable[] = [
    emitter,
    vscode.workspace.onDidSaveTextDocument((document) => {
      edits.saved(document.uri.toString());
      scheduleRefresh();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const document = event.document;
      if (document.uri.scheme !== "file") {
        return;
      }
      const uri = document.uri.toString();
      if (event.contentChanges.length > 0) {
        edits.record(
          uri,
          event.contentChanges.map((change) => changeFromEdit(change.range.start.line, change.range.end.line, change.text)),
        );
        return;
      }
      // No content changes: only the dirty flag flipped. When the buffer is
      // clean again without a save (undo to the saved text, revert), drop the
      // unsaved edits. After a save, clean() keeps everything up to the save,
      // so the order of this event and onDidSaveTextDocument does not matter.
      if (!document.isDirty) {
        setTimeout(() => {
          if (!document.isDirty) {
            edits.clean(uri);
          }
        }, 100);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      // Closing a dirty buffer without saving reverts to the file on disk.
      edits.clean(document.uri.toString());
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => scheduleRefresh()),
  ];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, ".git/{HEAD,index,refs/heads/**}"),
    );
    disposables.push(watcher, watcher.onDidChange(scheduleRefresh), watcher.onDidCreate(scheduleRefresh));
  }

  return {
    get available() {
      return available;
    },
    get state() {
      return state;
    },
    isUncommitted: (match) => {
      const sets = changesFor(match);
      return sets ? lineIsIn(liveSets(match, sets).uncommitted, match.line + 1) : false;
    },
    isOnBranch: (match) => {
      const sets = changesFor(match);
      if (!sets || sets.onBaseBranch) {
        return false;
      }
      return lineIsIn(liveSets(match, sets).branch, match.line + 1);
    },
    isNew: (match) => {
      const sets = changesFor(match);
      if (!sets) {
        return false;
      }
      const live = liveSets(match, sets);
      return lineIsIn(live.uncommitted, match.line + 1) || (!sets.onBaseBranch && lineIsIn(live.branch, match.line + 1));
    },
    baseRefOf: (match) => changesFor(match)?.baseRef,
    blameOf: (match) => {
      const cached = blames.get(match.uri);
      if (!cached) {
        return undefined;
      }
      const document = vscode.workspace.textDocuments.find((item) => item.uri.toString() === match.uri);
      if (document?.isDirty && cached.stamp !== `dirty:${document.version}`) {
        return undefined;
      }
      return cached.lines.get(match.line + 1);
    },
    ensureBlame,
    blameOne: async (match) => {
      await ensureBlame([match]);
      const cached = blames.get(match.uri);
      return cached?.lines.get(match.line + 1);
    },
    refreshChanges: () => {
      refreshing = refreshChanges().finally(() => {
        refreshing = undefined;
      });
      return refreshing;
    },
    onDidChange: emitter.event,
    dispose: () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      for (const disposable of disposables) {
        disposable.dispose();
      }
    },
  };
};
