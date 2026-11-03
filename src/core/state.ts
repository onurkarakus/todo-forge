import * as vscode from "vscode";

import { fingerprint } from "../pins/pins";
import type { GroupBy, PinnedTodo, SortBy, TodoMatch } from "../types";

export interface SavedView {
  name: string;
  query: string;
  groupBy?: GroupBy;
  sortBy?: SortBy;
}

const PINS_KEY = "todoforge.pins";
const MUTED_KEY = "todoforge.muted";
const VIEWS_KEY = "todoforge.savedViews";
const QUERY_KEY = "todoforge.query";
const MINE_KEY = "todoforge.mine";

/**
 * Personal state. Pins, mutes and the current filter belong to this workspace
 * (workspaceState); saved views follow the user (globalState). Nothing is
 * written into the repository.
 */
export interface StateStore {
  readonly pins: readonly PinnedTodo[];
  readonly muted: ReadonlySet<string>;
  readonly savedViews: readonly SavedView[];
  readonly query: string;
  readonly mine: boolean;
  setPins: (pins: readonly PinnedTodo[]) => Promise<void>;
  mute: (match: TodoMatch) => Promise<void>;
  unmute: (keys: readonly string[]) => Promise<void>;
  isMuted: (match: TodoMatch) => boolean;
  setSavedViews: (views: readonly SavedView[]) => Promise<void>;
  setQuery: (query: string, persist?: boolean) => void;
  setMine: (mine: boolean) => Promise<void>;
  onDidChange: vscode.Event<void>;
  dispose: () => void;
}

export const createStateStore = (context: vscode.ExtensionContext): StateStore => {
  const emitter = new vscode.EventEmitter<void>();
  let pins = context.workspaceState.get<PinnedTodo[]>(PINS_KEY, []);
  let muted = new Set(context.workspaceState.get<string[]>(MUTED_KEY, []));
  let savedViews = context.globalState.get<SavedView[]>(VIEWS_KEY, []);
  let query = context.workspaceState.get<string>(QUERY_KEY, "");
  let mine = context.workspaceState.get<boolean>(MINE_KEY, false);

  return {
    get pins() {
      return pins;
    },
    get muted() {
      return muted;
    },
    get savedViews() {
      return savedViews;
    },
    get query() {
      return query;
    },
    get mine() {
      return mine;
    },
    setPins: async (next) => {
      pins = [...next];
      emitter.fire();
      await context.workspaceState.update(PINS_KEY, pins);
    },
    mute: async (match) => {
      muted = new Set(muted).add(fingerprint(match));
      emitter.fire();
      await context.workspaceState.update(MUTED_KEY, [...muted]);
    },
    unmute: async (keys) => {
      const next = new Set(muted);
      for (const key of keys) {
        next.delete(key);
      }
      muted = next;
      emitter.fire();
      await context.workspaceState.update(MUTED_KEY, [...muted]);
    },
    isMuted: (match) => muted.size > 0 && muted.has(fingerprint(match)),
    setSavedViews: async (views) => {
      savedViews = [...views];
      emitter.fire();
      await context.globalState.update(VIEWS_KEY, savedViews);
    },
    setQuery: (next, persist = true) => {
      query = next;
      emitter.fire();
      if (persist) {
        void context.workspaceState.update(QUERY_KEY, query);
      }
    },
    setMine: async (next) => {
      mine = next;
      emitter.fire();
      await context.workspaceState.update(MINE_KEY, mine);
    },
    onDidChange: emitter.event,
    dispose: () => emitter.dispose(),
  };
};
