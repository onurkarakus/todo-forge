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
}

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

  for (const root of request.roots) {
    if (request.signal.aborted) {
      return { matches: [], cancelled: true, errors };
    }
    const result = await runRipgrep({
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
    if (result.cancelled) {
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
