import type { LineChange } from "../scanning/lineShift";

/** 1-based line numbers from `git diff`, or "all" for untracked files. */
export type LineSet = Set<number> | "all";

/**
 * Maps a set of changed lines computed from the file on disk onto the live,
 * unsaved buffer. `batches` are the content changes of each
 * `onDidChangeTextDocument` event since the disk snapshot, oldest first. Each
 * batch is relative to the document before that event, like the VS Code API.
 *
 * Lines inside an edit are dropped from their old position; the lines the
 * edit produced are marked changed (they differ from the saved file).
 */
export const mapLineSet = (
  set: LineSet | undefined,
  batches: readonly (readonly LineChange[])[],
): LineSet | undefined => {
  if (set === "all" || batches.length === 0) {
    return set;
  }
  let current = new Set(set ?? []);
  for (const batch of batches) {
    const ordered = [...batch].sort((left, right) => right.startLine - left.startLine);
    for (const change of ordered) {
      const delta = change.newLineCount - (change.endLine - change.startLine);
      const next = new Set<number>();
      for (const line1 of current) {
        const line0 = line1 - 1;
        if (line0 < change.startLine) {
          next.add(line1);
        } else if (line0 >= change.endLine) {
          next.add(line1 + delta);
        }
      }
      for (let offset = 0; offset < change.newLineCount; offset += 1) {
        next.add(change.startLine + offset + 1);
      }
      current = next;
    }
  }
  return current;
};

/**
 * Unsaved edit log per document. Entries up to the last save are on disk;
 * `snapshot()` before a git refresh and `settle()` after it drop the ones git
 * has now seen.
 */
export interface EditLog {
  record: (uri: string, batch: readonly LineChange[]) => void;
  saved: (uri: string) => void;
  /** The buffer matches the file on disk again (undo to saved, revert, close). */
  clean: (uri: string) => void;
  pending: (uri: string) => readonly (readonly LineChange[])[];
  snapshot: () => Map<string, number>;
  settle: (snapshot: Map<string, number>) => void;
  version: (uri: string) => number;
}

interface Entry {
  seq: number;
  batch: readonly LineChange[];
}

export const createEditLog = (): EditLog => {
  let seq = 0;
  const entries = new Map<string, Entry[]>();
  /** Highest seq written to disk per document. */
  const savedAt = new Map<string, number>();
  /** Highest seq already reflected in the current change sets. */
  const seenAt = new Map<string, number>();

  const live = (uri: string): Entry[] => {
    const seen = seenAt.get(uri) ?? 0;
    return (entries.get(uri) ?? []).filter((entry) => entry.seq > seen);
  };

  return {
    record: (uri, batch) => {
      if (batch.length === 0) {
        return;
      }
      seq += 1;
      const list = entries.get(uri) ?? [];
      list.push({ seq, batch });
      entries.set(uri, list);
    },
    saved: (uri) => {
      savedAt.set(uri, seq);
    },
    clean: (uri) => {
      // Edits after the last save were undone; drop them.
      const saved = savedAt.get(uri) ?? 0;
      const list = (entries.get(uri) ?? []).filter((entry) => entry.seq <= saved);
      entries.set(uri, list);
    },
    pending: (uri) => live(uri).map((entry) => entry.batch),
    snapshot: () => new Map(savedAt),
    settle: (snapshot) => {
      for (const [uri, saved] of snapshot) {
        seenAt.set(uri, Math.max(seenAt.get(uri) ?? 0, saved));
        const list = (entries.get(uri) ?? []).filter((entry) => entry.seq > saved);
        if (list.length === 0) {
          entries.delete(uri);
        } else {
          entries.set(uri, list);
        }
      }
    },
    version: (uri) => {
      const list = live(uri);
      return list.length === 0 ? 0 : (list[list.length - 1] as Entry).seq;
    },
  };
};
