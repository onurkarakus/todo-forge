import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { TodoMatch } from "../types";

/**
 * The last scan result, saved in the extension's workspace storage so the
 * tree can show it right after a reload while a fresh scan runs. Only TODO
 * metadata that is already in the index is stored; nothing leaves the machine.
 */

/** Bump when the file layout or the TodoMatch shape changes. */
export const INDEX_CACHE_VERSION = 1;
export const INDEX_CACHE_FILE = `index-v${INDEX_CACHE_VERSION}.json`;
/** Larger indexes are not cached; a reload then waits for the scan as before. */
export const MAX_CACHED_MATCHES = 20_000;
export const MAX_CACHE_BYTES = 8 * 1024 * 1024;

interface IndexCacheFile {
  version: number;
  key: string;
  savedAt: number;
  matches: readonly TodoMatch[];
}

/** A stable hash of everything that changes what a scan finds (settings, folders, extension version). */
export const indexCacheKey = (parts: unknown): string => {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
};

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isMatch = (value: unknown): value is TodoMatch => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const match = value as Record<string, unknown>;
  return (
    isString(match.id) &&
    isString(match.uri) &&
    isString(match.relativePath) &&
    isString(match.tag) &&
    isString(match.text) &&
    isString(match.raw) &&
    isNumber(match.line) &&
    isNumber(match.column) &&
    isNumber(match.endColumn) &&
    isNumber(match.leadColumn) &&
    isNumber(match.lineLength) &&
    (match.kind === "tag" || match.kind === "markdown" || match.kind === "code")
  );
};

/** Parses a cache file. Returns undefined for another version, another key or any malformed entry. */
export const parseIndexCache = (text: string, key: string): TodoMatch[] | undefined => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const file = data as Partial<IndexCacheFile>;
  if (file.version !== INDEX_CACHE_VERSION || file.key !== key || !Array.isArray(file.matches)) {
    return undefined;
  }
  if (file.matches.length > MAX_CACHED_MATCHES || !file.matches.every(isMatch)) {
    return undefined;
  }
  return file.matches;
};

export const serializeIndexCache = (key: string, matches: readonly TodoMatch[], now = Date.now()): string | undefined => {
  if (matches.length > MAX_CACHED_MATCHES) {
    return undefined;
  }
  const text = JSON.stringify({ version: INDEX_CACHE_VERSION, key, savedAt: now, matches } satisfies IndexCacheFile);
  return Buffer.byteLength(text, "utf8") > MAX_CACHE_BYTES ? undefined : text;
};

export const readIndexCache = async (file: string, key: string): Promise<TodoMatch[] | undefined> => {
  try {
    const stat = await fs.stat(file);
    if (stat.size > MAX_CACHE_BYTES) {
      return undefined;
    }
    return parseIndexCache(await fs.readFile(file, "utf8"), key);
  } catch {
    return undefined;
  }
};

/** Writes atomically (temp file + rename). Too large an index removes the old file instead. */
export const writeIndexCache = async (file: string, key: string, matches: readonly TodoMatch[]): Promise<boolean> => {
  const text = serializeIndexCache(key, matches);
  if (text === undefined) {
    await fs.rm(file, { force: true });
    return false;
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, text, "utf8");
  await fs.rename(temp, file);
  return true;
};
