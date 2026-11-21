import path from "node:path";

import type { TodoMatch } from "../types";
import { relativePosix } from "../utils/paths";
import { buildRgPattern } from "../utils/regexBuilder";
import { compileParseOptions, extendMultiline, parseLine, parseLines, type ParseOptions } from "./parseLine";
import { runRipgrep } from "./ripgrep";

export interface ScanRoot {
  folder: string;
  files?: readonly string[];
  toUri: (absolutePath: string) => string;
}

export interface ScanRequest {
  rgPath: string;
  roots: readonly ScanRoot[];
  options: ParseOptions;
  useGitignore: boolean;
  maxFileSizeKb: number;
  excludeGlobs: readonly string[];
  includeGlobs: readonly string[];
  signal: AbortSignal;
  onBatch?: (count: number) => void;
  /** How many ripgrep processes run at once across roots. Default {@link SCAN_CONCURRENCY}. */
  concurrency?: number;
}

/** Multi-root workspaces scan this many folders at a time. */
export const SCAN_CONCURRENCY = 3;

/** Runs `task` for every item with at most `limit` running at once; results keep the input order. */
export const mapLimit = async <T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()));
  return results;
};

export interface ScanOutput {
  matches: TodoMatch[];
  cancelled: boolean;
  errors: string[];
}

const yieldThread = (): Promise<void> => {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
};

export const scanRoots = async (request: ScanRequest): Promise<ScanOutput> => {
  const compiled = compileParseOptions(request.options);
  const matches: TodoMatch[] = [];
  const errors: string[] = [];
  if (compiled.matcher.error) {
    errors.push(compiled.matcher.error);
  }
  const pattern = buildRgPattern(
    request.options.tags,
    request.options.markdownEnabled,
    request.options.dotnetPatterns === true,
  );
  let seen = 0;

  // ripgrep runs for several roots at once; parsing stays in root order so results are stable.
  const results = await mapLimit(request.roots, request.concurrency ?? SCAN_CONCURRENCY, (root) => {
    if (request.signal.aborted) {
      return Promise.resolve(undefined);
    }
    return runRipgrep({
      rgPath: request.rgPath,
      cwd: root.folder,
      pattern,
      caseSensitive: request.options.caseSensitive,
      useGitignore: request.useGitignore,
      maxFileSizeKb: request.maxFileSizeKb,
      excludeGlobs: request.excludeGlobs,
      includeGlobs: request.includeGlobs,
      afterContext: request.options.multiline ? request.options.multilineMaxLines : 0,
      files: root.files,
      signal: request.signal,
    });
  });

  for (const [rootIndex, root] of request.roots.entries()) {
    const result = results[rootIndex];
    if (request.signal.aborted || !result || result.cancelled) {
      return { matches: [], cancelled: true, errors };
    }
    if (result.error) {
      errors.push(result.error);
    }
    for (const hit of result.hits) {
      const location = {
        uri: root.toUri(hit.path),
        relativePath: relativePosix(root.folder, hit.path),
        workspaceFolder: root.folder,
      };
      const parsed = parseLine(
        hit.lineText,
        hit.lineNumber - 1,
        location,
        compiled.matcher,
        request.options,
      );
      const next = request.options.multiline
        ? parsed.map((match) => extendMultiline(match, hit.contextAfter, request.options.multilineMaxLines))
        : parsed;
      matches.push(...next);
      seen += 1;
      if (seen % 500 === 0) {
        request.onBatch?.(matches.length);
        await yieldThread();
      }
    }
  }

  return { matches, cancelled: false, errors };
};

export const scanText = (
  text: string,
  location: { uri: string; relativePath: string; workspaceFolder?: string },
  options: ParseOptions,
): TodoMatch[] => {
  const compiled = compileParseOptions(options);
  return parseLines(text.split(/\r?\n/), 0, location, compiled.matcher, options);
};

export const scanLineSlice = (
  lines: readonly string[],
  startLine: number,
  location: { uri: string; relativePath: string; workspaceFolder?: string },
  options: ParseOptions,
): TodoMatch[] => {
  const compiled = compileParseOptions(options);
  return parseLines(lines, startLine, location, compiled.matcher, options);
};

export const fileOutsideRoot = (folder: string, file: string): boolean => {
  const relative = path.relative(folder, file);
  return relative.startsWith("..") || path.isAbsolute(relative);
};
