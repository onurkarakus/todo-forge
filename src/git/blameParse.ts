import type { BlameInfo } from "../types";

const UNCOMMITTED = /^0{40}$/;

/**
 * Parses `git blame --line-porcelain` output. Keys are 1-based line numbers
 * in the blamed version of the file.
 */
export const parseBlame = (output: string): Map<number, BlameInfo> => {
  const result = new Map<number, BlameInfo>();
  let finalLine = 0;
  let info: Partial<BlameInfo> & { sha?: string } = {};
  for (const line of output.split("\n")) {
    if (line.startsWith("\t")) {
      if (info.sha && finalLine > 0) {
        const uncommitted = UNCOMMITTED.test(info.sha);
        result.set(finalLine, {
          sha: info.sha,
          author: uncommitted ? "" : info.author ?? "",
          email: uncommitted ? "" : info.email ?? "",
          time: info.time ?? 0,
          summary: uncommitted ? "" : info.summary ?? "",
          uncommitted,
        });
      }
      info = {};
      finalLine = 0;
      continue;
    }
    const header = /^([0-9a-f]{40}) \d+ (\d+)/.exec(line);
    if (header && !info.sha) {
      info.sha = header[1];
      finalLine = Number(header[2]);
      continue;
    }
    if (line.startsWith("author ")) {
      info.author = line.slice(7);
    } else if (line.startsWith("author-mail ")) {
      info.email = line.slice(12).replace(/^<|>$/g, "");
    } else if (line.startsWith("author-time ")) {
      info.time = Number(line.slice(12));
    } else if (line.startsWith("summary ")) {
      info.summary = line.slice(8);
    }
  }
  return result;
};

/** Collapses sorted line numbers into `-L a,b` ranges so one blame call covers many TODOs. */
export const lineRanges = (lines: readonly number[]): [number, number][] => {
  const sorted = [...new Set(lines)].sort((left, right) => left - right);
  const ranges: [number, number][] = [];
  for (const line of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && line === last[1] + 1) {
      last[1] = line;
    } else {
      ranges.push([line, line]);
    }
  }
  return ranges;
};
