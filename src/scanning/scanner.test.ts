import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "mocha";

import { resolveRgPath } from "./rgPath";

import { DEFAULT_EXCLUDE_GLOBS, DEFAULT_SUBTAG_REGEX, DEFAULT_TAGS } from "../config/defaults";
import type { ParseOptions } from "./parseLine";
import { scanRoots } from "./scanner";

const options = (): ParseOptions => {
  return {
    tags: DEFAULT_TAGS,
    caseSensitive: false,
    customRegex: "",
    subTagRegex: DEFAULT_SUBTAG_REGEX,
    markdownEnabled: true,
    multiline: false,
    multilineMaxLines: 3,
  };
};

const fixture = path.join(__dirname, "..", "..", "test", "fixtures");
const rgPath = resolveRgPath();

describe("ripgrep scan", () => {
  it("finds the binary", () => {
    assert.equal(typeof rgPath, "string");
    assert.ok(rgPath.endsWith(`${path.sep}rg`));
  });

  it("scans the sample workspace and skips .NET output", async () => {
    const output = await scanRoots({
      rgPath,
      roots: [
        {
          folder: path.join(fixture, "sample"),
          toUri: (file) => file,
        },
      ],
      options: options(),
      useGitignore: false,
      maxFileSizeKb: 1024,
      excludeGlobs: DEFAULT_EXCLUDE_GLOBS,
      includeGlobs: [],
      signal: new AbortController().signal,
    });
    const paths = output.matches.map((match) => match.relativePath.replaceAll("\\", "/"));
    assert.equal(output.cancelled, false);
    assert.ok(paths.includes("src/Program.cs"));
    assert.ok(paths.includes("notes/readme.md"));
    assert.ok(paths.includes("py/app.py"));
    assert.ok(paths.includes("vb/Module.vb"));
    assert.ok(paths.includes("razor/View.cshtml"));
    for (const skipped of [
      "src/bin/Generated.cs",
      "src/obj/Debug/Cache.cs",
      "src/Form.designer.cs",
      "src/Generated.g.cs",
      "node_modules/pkg/index.ts",
    ]) {
      assert.equal(paths.includes(skipped), false, skipped);
    }
    const program = output.matches.filter((match) => match.relativePath.endsWith("Program.cs"));
    const texts = program.map((match) => match.text);
    assert.ok(texts.includes("implement caching"));
    assert.equal(
      program.some((match) => match.raw.includes("TODO: nope")),
      false,
    );
  });

  it("scans each root of a multi-root workspace", async () => {
    const output = await scanRoots({
      rgPath,
      roots: ["root-a", "root-b"].map((name) => ({
        folder: path.join(fixture, name),
        toUri: (file) => file,
      })),
      options: options(),
      useGitignore: false,
      maxFileSizeKb: 1024,
      excludeGlobs: [],
      includeGlobs: [],
      signal: new AbortController().signal,
    });
    const tags = output.matches.map((match) => match.tag).sort();
    assert.deepEqual(tags, ["FIXME", "TODO"]);
  });

  it("honors gitignore inside a git repository", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "todoforge-git-"));
    await fs.mkdir(path.join(directory, "secret"), { recursive: true });
    await fs.writeFile(path.join(directory, ".gitignore"), "secret/\n");
    await fs.writeFile(path.join(directory, "Keep.cs"), "// TODO: keep\n");
    await fs.writeFile(path.join(directory, "secret", "Hidden.cs"), "// TODO: secret\n");
    const git = spawnSync("git", ["init"], { cwd: directory, encoding: "utf8" });
    assert.equal(git.status, 0, git.stderr);
    const started = performance.now();
    const output = await scanRoots({
      rgPath,
      roots: [{ folder: directory, toUri: (file) => file }],
      options: options(),
      useGitignore: true,
      maxFileSizeKb: 1024,
      excludeGlobs: [],
      includeGlobs: [],
      signal: new AbortController().signal,
    });
    const elapsed = performance.now() - started;
    assert.ok(output.matches.some((match) => match.text === "keep"));
    assert.equal(
      output.matches.some((match) => match.relativePath.includes("secret")),
      false,
    );
    assert.ok(elapsed < 1000, `incremental-sized scan took ${elapsed}ms`);
  });

  it("returns no matches when the scan is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const output = await scanRoots({
      rgPath,
      roots: [{ folder: path.join(fixture, "sample"), toUri: (file) => file }],
      options: options(),
      useGitignore: false,
      maxFileSizeKb: 1024,
      excludeGlobs: DEFAULT_EXCLUDE_GLOBS,
      includeGlobs: [],
      signal: controller.signal,
    });
    assert.equal(output.cancelled, true);
    assert.deepEqual(output.matches, []);
  });
});
