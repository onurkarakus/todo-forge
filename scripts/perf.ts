import fs from "node:fs/promises";
import path from "node:path";

import { DEFAULT_EXCLUDE_GLOBS, DEFAULT_SUBTAG_REGEX, DEFAULT_TAGS } from "../src/config/defaults";
import { resolveRgPath } from "../src/scanning/rgPath";
import { scanRoots } from "../src/scanning/scanner";

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

const options = {
  tags: DEFAULT_TAGS,
  caseSensitive: false,
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
  console.log(`Targets: full < 30000ms (${fullMs < 30000 ? "met" : "missed"}), incremental < 200ms (${incrementalMs < 200 ? "met" : "missed"})`);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
