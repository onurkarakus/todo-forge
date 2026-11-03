import type { Engine } from "../core/engine";
import type { StateStore } from "../core/state";
import type { GitContext } from "../git/gitContext";
import type { TodoMatch } from "../types";
import type { CardContext } from "./todoCard";

/** Shared handles passed to editor features. */
export interface Services {
  engine: Engine;
  state: StateStore;
  git: GitContext;
  /** Matches in a file, without muted ones. */
  matchesFor: (uri: string) => readonly TodoMatch[];
  card: (match: TodoMatch, actions?: boolean) => CardContext;
  isPinned: (match: TodoMatch) => boolean;
}
