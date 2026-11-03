import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import type { BlameInfo } from "../types";
import { toPosixPath } from "../utils/paths";
import { lineRanges, parseBlame } from "./blameParse";
import { parseAddedLines } from "./diffParse";

/**
 * Local, read-only git queries. Nothing here touches the network: there is no
 * fetch, pull, or remote call. Options that can run repository-configured
 * programs (external diff, textconv, fsmonitor) are turned off.
 */

const SAFE_CONFIG = [
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.quotePath=false",
  "-c",
  "color.ui=false",
];

const TIMEOUT_MS = 15_000;
const MAX_BUFFER = 64 * 1024 * 1024;

export interface GitRunner {
  run: (cwd: string, args: readonly string[], input?: string) => Promise<string>;
}

export const createGitRunner = (gitPath = "git"): GitRunner => {
  return {
    run: (cwd, args, input) => {
      return new Promise((resolve, reject) => {
        const child = execFile(
          gitPath,
          [...SAFE_CONFIG, ...args],
          {
            cwd,
            timeout: TIMEOUT_MS,
            maxBuffer: MAX_BUFFER,
            windowsHide: true,
            env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
          },
          (error, stdout) => {
            if (error) {
              reject(error);
              return;
            }
            resolve(stdout);
          },
        );
        if (input !== undefined) {
          child.stdin?.end(input);
        }
      });
    },
  };
};

export interface RepoInfo {
  root: string;
  head?: string;
  branch?: string;
}

export interface ChangeSets {
  repoRoot: string;
  /** Absolute file path to 1-based line numbers added since HEAD (staged, unstaged or untracked). */
  uncommitted: Map<string, Set<number> | "all">;
  /** Absolute file path to 1-based line numbers added since the merge base with the base branch. */
  branch: Map<string, Set<number> | "all">;
  baseRef?: string;
  onBaseBranch: boolean;
}

const tryRun = async (runner: GitRunner, cwd: string, args: readonly string[]): Promise<string | undefined> => {
  try {
    return await runner.run(cwd, args);
  } catch {
    return undefined;
  }
};

export const repoInfo = async (runner: GitRunner, folder: string): Promise<RepoInfo | undefined> => {
  const root = (await tryRun(runner, folder, ["rev-parse", "--show-toplevel"]))?.trim();
  if (!root) {
    return undefined;
  }
  const head = (await tryRun(runner, folder, ["rev-parse", "--verify", "--quiet", "HEAD"]))?.trim() || undefined;
  const branch = (await tryRun(runner, folder, ["symbolic-ref", "--quiet", "--short", "HEAD"]))?.trim() || undefined;
  return { root: path.resolve(root), head, branch };
};

export const userIdentity = async (
  runner: GitRunner,
  folder: string,
): Promise<{ name?: string; email?: string }> => {
  const name = (await tryRun(runner, folder, ["config", "user.name"]))?.trim() || undefined;
  const email = (await tryRun(runner, folder, ["config", "user.email"]))?.trim() || undefined;
  return { name, email };
};

const CANDIDATE_BASES = ["main", "master", "develop", "trunk", "origin/main", "origin/master", "origin/develop"];

export const resolveBaseRef = async (
  runner: GitRunner,
  folder: string,
  configured: string,
): Promise<string | undefined> => {
  const verify = async (ref: string): Promise<boolean> => {
    const sha = await tryRun(runner, folder, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return Boolean(sha?.trim());
  };
  // A configured branch wins when it exists; otherwise fall back to detection.
  if (configured.trim() && (await verify(configured.trim()))) {
    return configured.trim();
  }
  const originHead = (await tryRun(runner, folder, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]))?.trim();
  const candidates = originHead ? [originHead.replace(/^origin\//, ""), originHead, ...CANDIDATE_BASES] : CANDIDATE_BASES;
  for (const candidate of candidates) {
    if (await verify(candidate)) {
      return candidate;
    }
  }
  return undefined;
};

const toAbsolute = (root: string, relative: Map<string, Set<number>>): Map<string, Set<number> | "all"> => {
  const result = new Map<string, Set<number> | "all">();
  for (const [file, lines] of relative) {
    result.set(path.join(root, ...file.split("/")), lines);
  }
  return result;
};

/**
 * Lines added in the working tree compared with HEAD and with the merge base
 * of the base branch. Untracked files count as fully added.
 */
export const changeSets = async (
  runner: GitRunner,
  folder: string,
  baseBranch: string,
): Promise<ChangeSets | undefined> => {
  const info = await repoInfo(runner, folder);
  if (!info) {
    return undefined;
  }
  const diffArgs = ["diff", "--no-color", "--no-ext-diff", "--no-textconv", "--unified=0", "--no-renames"];
  const uncommitted = new Map<string, Set<number> | "all">();
  if (info.head) {
    const diff = await tryRun(runner, info.root, [...diffArgs, "HEAD", "--"]);
    for (const [file, lines] of toAbsolute(info.root, parseAddedLines(diff ?? ""))) {
      uncommitted.set(file, lines);
    }
  }
  const untracked = await tryRun(runner, info.root, ["ls-files", "--others", "--exclude-standard", "-z"]);
  for (const file of (untracked ?? "").split("\0").filter((entry) => entry.length > 0)) {
    uncommitted.set(path.join(info.root, ...file.split("/")), "all");
  }
  if (!info.head) {
    // No commits yet: every tracked file is new as well.
    const tracked = await tryRun(runner, info.root, ["ls-files", "-z"]);
    for (const file of (tracked ?? "").split("\0").filter((entry) => entry.length > 0)) {
      uncommitted.set(path.join(info.root, ...file.split("/")), "all");
    }
  }

  const branch = new Map<string, Set<number> | "all">(uncommitted);
  const baseRef = info.head ? await resolveBaseRef(runner, info.root, baseBranch) : undefined;
  let onBaseBranch = false;
  if (baseRef && info.head) {
    const mergeBase = (await tryRun(runner, info.root, ["merge-base", "HEAD", baseRef]))?.trim();
    const baseSha = (await tryRun(runner, info.root, ["rev-parse", `${baseRef}^{commit}`]))?.trim();
    onBaseBranch = Boolean(mergeBase && mergeBase === info.head && baseSha === info.head);
    if (mergeBase) {
      const diff = await tryRun(runner, info.root, [...diffArgs, mergeBase, "--"]);
      for (const [file, lines] of toAbsolute(info.root, parseAddedLines(diff ?? ""))) {
        if (branch.get(file) !== "all") {
          branch.set(file, lines);
        }
      }
    }
  }
  return { repoRoot: info.root, uncommitted, branch, baseRef, onBaseBranch };
};

export const lineIsIn = (set: Set<number> | "all" | undefined, line1: number): boolean => {
  if (!set) {
    return false;
  }
  return set === "all" || set.has(line1);
};

/**
 * Blames only the requested lines. `contents` lets a dirty editor buffer be
 * blamed so line numbers match what the user sees.
 */
export const blameLines = async (
  runner: GitRunner,
  file: string,
  lines1: readonly number[],
  contents?: string,
): Promise<Map<number, BlameInfo>> => {
  if (lines1.length === 0) {
    return new Map();
  }
  const ranges = lineRanges(lines1).slice(0, 400);
  const args = ["blame", "--line-porcelain", "--no-textconv"];
  for (const [start, end] of ranges) {
    args.push("-L", `${start},${end}`);
  }
  if (contents !== undefined) {
    args.push("--contents", "-");
  }
  args.push("--", path.basename(file));
  try {
    const output = await runner.run(path.dirname(file), args, contents);
    return parseBlame(output);
  } catch {
    return new Map();
  }
};

export const fileStamp = async (file: string): Promise<string | undefined> => {
  try {
    const stat = await fs.stat(file);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return undefined;
  }
};

/** Returns the subset of relative paths that git ignores. */
export const ignoredPaths = async (
  runner: GitRunner,
  folder: string,
  relativePaths: readonly string[],
): Promise<Set<string>> => {
  if (relativePaths.length === 0) {
    return new Set();
  }
  return new Promise((resolve) => {
    const child = spawn("git", [...SAFE_CONFIG, "check-ignore", "--stdin"], {
      cwd: folder,
      windowsHide: true,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    child.on("error", () => resolve(new Set()));
    child.on("close", () => {
      resolve(new Set(output.split(/\r?\n/).map((line) => toPosixPath(line.trim())).filter((line) => line.length > 0)));
    });
    child.stdin.end(`${relativePaths.join("\n")}\n`);
  });
};
