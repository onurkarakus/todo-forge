import fs from "node:fs/promises";
import path from "node:path";

import { DEFAULT_EXCLUDE_GLOBS, DEFAULT_STRICT_TAGS, DEFAULT_SUBTAG_REGEX, DEFAULT_TAGS } from "../src/config/defaults";
import { createPathFilter } from "../src/scanning/pathFilter";
import { groupMatches } from "../src/tree/grouping";
import { filterByQuery } from "../src/tree/query";
import { resolveRgPath } from "../src/scanning/rgPath";
import { readIndexCache, writeIndexCache } from "../src/scanning/indexCache";
import { scanRoots } from "../src/scanning/scanner";
import { changedNodeIds, signTree } from "../src/tree/treeDiff";
import type { TodoMatch } from "../src/types";

const rgPath = resolveRgPath();

const root = path.resolve("test/fixtures/perf-generated");
const fileCount = 20000;
const perDirectory = 100;

const writeFixture = async (): Promise<void> => {
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(path.join(root, "bin"), { recursive: true });
  await fs.mkdir(path.join(root, "obj"), { recursive: true });
  await fs.writeFile(path.join(root, "bin", "Noise.cs"), "// TODO: skip bin\n");
  await fs.writeFile(path.join(root, "obj", "Noise.cs"), "// TODO: skip obj\n");
  const lines: string[] = [];
  for (let line = 0; line < 10000; line += 1) {
    lines.push(line === 5000 ? "// TODO: in the middle" : `var n${line} = ${line};`);
  }
  await fs.writeFile(path.join(root, "Large.cs"), lines.join("\n"));
  const directories = fileCount / perDirectory;
  for (let directory = 0; directory < directories; directory += 1) {
    const folder = path.join(root, "src", `d${directory}`);
    await fs.mkdir(folder, { recursive: true });
    await Promise.all(
      Array.from({ length: perDirectory }, (_, index) => {
        const body = index % 17 === 0 ? "// TODO: item\n" : "class Item {}\n";
        return fs.writeFile(path.join(folder, `F${index}.cs`), body);
      }),
    );
  }
};

// Four workspace folders of 5,000 files each, for the multi-root measurement.
const multiRoots = ["r0", "r1", "r2", "r3"].map((name) => path.join(root, "multi", name));

const writeMultiRoot = async (): Promise<void> => {
  for (const folder of multiRoots) {
    for (let directory = 0; directory < 50; directory += 1) {
      const target = path.join(folder, `d${directory}`);
      await fs.mkdir(target, { recursive: true });
      await Promise.all(
        Array.from({ length: perDirectory }, (_, index) =>
          fs.writeFile(path.join(target, `F${index}.cs`), index % 17 === 0 ? "// TODO: item\n" : "class Item {}\n"),
        ),
      );
    }
  }
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const options = {
  tags: DEFAULT_TAGS,
  strictTags: DEFAULT_STRICT_TAGS,
  dotnetPatterns: true,
  caseSensitive: true,
  customRegex: "",
  subTagRegex: DEFAULT_SUBTAG_REGEX,
  markdownEnabled: true,
  multiline: false,
  multilineMaxLines: 3,
};

const main = async (): Promise<void> => {
  console.log(`Writing ${fileCount} files...`);
  const writeStarted = performance.now();
  await writeFixture();
  console.log(`Fixture ready in ${Math.round(performance.now() - writeStarted)}ms`);

  const scanStarted = performance.now();
  const output = await scanRoots({
    rgPath,
    roots: [{ folder: root, toUri: (file) => file }],
    options,
    useGitignore: false,
    maxFileSizeKb: 1024,
    excludeGlobs: DEFAULT_EXCLUDE_GLOBS,
    includeGlobs: [],
    signal: new AbortController().signal,
  });
  const fullMs = performance.now() - scanStarted;
  console.log(`Full scan: ${Math.round(fullMs)}ms, matches: ${output.matches.length}, errors: ${output.errors.length}`);

  const target = path.join(root, "src", "d0", "F0.cs");
  await fs.writeFile(target, "// TODO: changed once\n");
  const incrementalStarted = performance.now();
  const incremental = await scanRoots({
    rgPath,
    roots: [{ folder: root, files: [target], toUri: (file) => file }],
    options,
    useGitignore: false,
    maxFileSizeKb: 1024,
    excludeGlobs: DEFAULT_EXCLUDE_GLOBS,
    includeGlobs: [],
    signal: new AbortController().signal,
  });
  const incrementalMs = performance.now() - incrementalStarted;
  console.log(`Incremental file: ${Math.round(incrementalMs)}ms, matches: ${incremental.matches.length}`);
  const filter = createPathFilter(DEFAULT_EXCLUDE_GLOBS, []);
  const filterStarted = performance.now();
  let accepted = 0;
  for (let index = 0; index < 100000; index += 1) {
    if (filter.accepts(index % 2 === 0 ? `src/d${index % 200}/obj/Debug/F${index}.cs` : `src/d${index % 200}/F${index}.cs`)) {
      accepted += 1;
    }
  }
  console.log(`Watcher path filter: 100000 paths in ${Math.round(performance.now() - filterStarted)}ms (${accepted} kept)`);

  const groupStarted = performance.now();
  const grouped = groupMatches(output.matches, {
    groupBy: "file",
    labelFormat: "${tag}: ${text}",
    tagGroups: [],
    markdownSeparate: true,
    workspaceFolders: [{ path: root, name: "perf" }],
  });
  const filtered = filterByQuery(output.matches, "tag:TODO item -middle", {
    today: "2026-11-03",
    staleAfterDays: 180,
    nowSeconds: Date.now() / 1000,
    me: { names: [], emails: [] },
    blameOf: () => undefined,
    isNew: () => false,
  });
  console.log(`Group by file + filter ${output.matches.length} matches: ${Math.round(performance.now() - groupStarted)}ms (${grouped.count} grouped, ${filtered.length} filtered)`);

  // Saved index: write and read back the scan result.
  const cacheFile = path.join(root, ".cache", "index-v1.json");
  const writeStarted2 = performance.now();
  await writeIndexCache(cacheFile, "perf", output.matches);
  const cacheWriteMs = performance.now() - writeStarted2;
  const readStarted = performance.now();
  const restored = await readIndexCache(cacheFile, "perf");
  const cacheReadMs = performance.now() - readStarted;
  const size = (await fs.stat(cacheFile)).size;
  console.log(`Saved index ${output.matches.length} matches (${Math.round(size / 1024)} KB): write ${Math.round(cacheWriteMs)}ms, read ${Math.round(cacheReadMs)}ms (${restored?.length ?? 0} restored)`);
  const big: TodoMatch[] = Array.from({ length: 20000 }, (_, index) => ({
    ...(output.matches[index % output.matches.length] as TodoMatch),
    id: `big-${index}`,
    line: index,
  }));
  const bigWrite = performance.now();
  await writeIndexCache(cacheFile, "perf", big);
  const bigWriteMs = performance.now() - bigWrite;
  const bigRead = performance.now();
  const bigRestored = await readIndexCache(cacheFile, "perf");
  const bigReadMs = performance.now() - bigRead;
  const bigSize = (await fs.stat(cacheFile)).size;
  console.log(`Saved index 20000 matches (${Math.round(bigSize / 1024)} KB): write ${Math.round(bigWriteMs)}ms, read ${Math.round(bigReadMs)}ms (${bigRestored?.length ?? 0} restored)`);

  // Tree refresh plan after one TODO's text changes.
  const content = (node: { label: string; count: number }): string => `${node.label}|${node.count}`;
  const edited = output.matches.map((match, index) => (index === 10 ? { ...match, text: `${match.text}!` } : match));
  const groupOptions = {
    groupBy: "file" as const,
    labelFormat: "${tag}: ${text}",
    tagGroups: [],
    markdownSeparate: true,
    workspaceFolders: [{ path: root, name: "perf" }],
  };
  const previousTree = groupMatches(output.matches, groupOptions);
  const previousSignatures = signTree(previousTree, content);
  const diffStarted = performance.now();
  const nextTree = groupMatches(edited, groupOptions);
  const plan = changedNodeIds(previousSignatures, signTree(nextTree, content), nextTree);
  console.log(`Tree refresh plan, ${output.matches.length} matches, one edited: ${Math.round(performance.now() - diffStarted)}ms (${plan === "all" ? "full" : `${plan.length} item(s)`})`);

  // Multi-root: four folders scanned one at a time vs. three at once.
  await writeMultiRoot();
  const multi = async (concurrency: number): Promise<{ ms: number; matches: number }> => {
    const started = performance.now();
    const result = await scanRoots({
      rgPath,
      roots: multiRoots.map((folder) => ({ folder, toUri: (file: string) => file })),
      options,
      useGitignore: false,
      maxFileSizeKb: 1024,
      excludeGlobs: DEFAULT_EXCLUDE_GLOBS,
      includeGlobs: [],
      signal: new AbortController().signal,
      concurrency,
    });
    return { ms: performance.now() - started, matches: result.matches.length };
  };
  await multi(3);
  const sequential: number[] = [];
  const parallel: number[] = [];
  let multiMatches = 0;
  for (let run = 0; run < 5; run += 1) {
    sequential.push((await multi(1)).ms);
    const result = await multi(3);
    parallel.push(result.ms);
    multiMatches = result.matches;
  }
  console.log(`Multi-root 4 x 5000 files (${multiMatches} matches), median of 5: one at a time ${Math.round(median(sequential))}ms, three at once ${Math.round(median(parallel))}ms`);

  console.log(`Targets: full < 30000ms (${fullMs < 30000 ? "met" : "missed"}), incremental < 200ms (${incrementalMs < 200 ? "met" : "missed"})`);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
