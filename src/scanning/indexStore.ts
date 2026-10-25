import type { TodoMatch } from "../types";

export interface IndexStore {
  version: number;
  replaceAll: (matches: readonly TodoMatch[]) => void;
  setFile: (uri: string, matches: readonly TodoMatch[]) => void;
  removeFile: (uri: string) => void;
  mergeWindow: (
    uri: string,
    startLine: number,
    endLine: number,
    matches: readonly TodoMatch[],
  ) => void;
  replaceFileMatches: (uri: string, matches: readonly TodoMatch[]) => void;
  getFile: (uri: string) => readonly TodoMatch[];
  getAll: () => readonly TodoMatch[];
  countsByTag: () => ReadonlyMap<string, number>;
  total: () => number;
}

export const createIndex = (): IndexStore => {
  let version = 0;
  const files = new Map<string, TodoMatch[]>();

  const bump = (): void => {
    version += 1;
  };

  const store: IndexStore = {
    get version() {
      return version;
    },
    replaceAll: (matches: readonly TodoMatch[]): void => {
      files.clear();
      for (const match of matches) {
        const list = files.get(match.uri) ?? [];
        list.push(match);
        files.set(match.uri, list);
      }
      bump();
    },
    setFile: (uri: string, matches: readonly TodoMatch[]): void => {
      if (matches.length === 0) {
        files.delete(uri);
      } else {
        files.set(uri, [...matches]);
      }
      bump();
    },
    removeFile: (uri: string): void => {
      if (!files.delete(uri)) {
        return;
      }
      bump();
    },
    mergeWindow: (uri, startLine, endLine, matches): void => {
      const kept = (files.get(uri) ?? []).filter(
        (match) => match.line < startLine || match.line >= endLine,
      );
      const next = [...kept, ...matches].sort((left, right) => left.line - right.line || left.column - right.column);
      if (next.length === 0) {
        files.delete(uri);
      } else {
        files.set(uri, next);
      }
      bump();
    },
    replaceFileMatches: (uri, matches): void => {
      store.setFile(uri, matches);
    },
    getFile: (uri: string): readonly TodoMatch[] => {
      return files.get(uri) ?? [];
    },
    getAll: (): TodoMatch[] => {
      const all: TodoMatch[] = [];
      for (const list of files.values()) {
        all.push(...list);
      }
      all.sort((left, right) => {
        if (left.relativePath !== right.relativePath) {
          return left.relativePath.localeCompare(right.relativePath);
        }
        return left.line - right.line || left.column - right.column;
      });
      return all;
    },
    countsByTag: (): Map<string, number> => {
      const counts = new Map<string, number>();
      for (const list of files.values()) {
        for (const match of list) {
          counts.set(match.tag, (counts.get(match.tag) ?? 0) + 1);
        }
      }
      return counts;
    },
    total: (): number => {
      let count = 0;
      for (const list of files.values()) {
        count += list.length;
      }
      return count;
    },
  };

  return store;
};
