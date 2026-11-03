import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "mocha";

import { lineRanges, parseBlame } from "./blameParse";
import { parseAddedLines } from "./diffParse";
import { blameLines, changeSets, createGitRunner, ignoredPaths, lineIsIn, resolveBaseRef, userIdentity } from "./gitService";

describe("git parsers", () => {
  it("reads added lines from a zero-context diff", () => {
    const diff = [
      "diff --git a/src/A.cs b/src/A.cs",
      "--- a/src/A.cs",
      "+++ b/src/A.cs",
      "@@ -3,0 +4,2 @@",
      "+// TODO: one",
      "+// TODO: two",
      "@@ -10 +12 @@",
      "-old",
      "+new",
      "diff --git a/gone.cs b/gone.cs",
      "--- a/gone.cs",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      '+++ "b/sp ace.cs"',
      "@@ -0,0 +1 @@",
    ].join("\n");
    const added = parseAddedLines(diff);
    assert.deepEqual([...(added.get("src/A.cs") ?? [])], [4, 5, 12]);
    assert.equal(added.has("gone.cs"), false);
    assert.deepEqual([...(added.get("sp ace.cs") ?? [])], [1]);
  });

  it("reads line-porcelain blame", () => {
    const sha = "1".repeat(40);
    const output = [
      `${sha} 1 7 1`,
      "author Onur",
      "author-mail <onur@x.dev>",
      "author-time 1700000000",
      "summary Add cache",
      "filename A.cs",
      "\t// TODO: cache",
      `${"0".repeat(40)} 8 8 1`,
      "author Not Committed Yet",
      "author-mail <not.committed.yet>",
      "author-time 1800000000",
      "summary Version of A.cs from A.cs",
      "\t// TODO: new",
    ].join("\n");
    const blame = parseBlame(output);
    assert.equal(blame.get(7)?.author, "Onur");
    assert.equal(blame.get(7)?.email, "onur@x.dev");
    assert.equal(blame.get(7)?.uncommitted, false);
    assert.equal(blame.get(8)?.uncommitted, true);
    assert.equal(blame.get(8)?.author, "");
  });

  it("collapses line ranges", () => {
    assert.deepEqual(lineRanges([5, 1, 2, 3, 9, 5]), [
      [1, 3],
      [5, 5],
      [9, 9],
    ]);
    assert.equal(lineIsIn("all", 3), true);
    assert.equal(lineIsIn(new Set([2]), 3), false);
    assert.equal(lineIsIn(undefined, 3), false);
  });
});

describe("gitService on a temporary repository", () => {
  const runner = createGitRunner();
  let repo = "";
  const git = (...args: string[]): string =>
    execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_DATE: "2025-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2025-01-01T00:00:00Z" },
    });

  before(() => {
    repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "todoforge-git-")));
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Test User");
    git("config", "user.email", "test@example.com");
    git("config", "commit.gpgsign", "false");
    fs.writeFileSync(path.join(repo, "A.cs"), "class A {\n  // TODO: old\n}\n");
    fs.writeFileSync(path.join(repo, ".gitignore"), "bin/\n");
    git("add", ".");
    git("commit", "-q", "-m", "base");
    git("checkout", "-q", "-b", "feature");
    fs.writeFileSync(path.join(repo, "A.cs"), "class A {\n  // TODO: old\n  // FIXME: branch\n}\n");
    git("commit", "-q", "-am", "branch work");
    fs.writeFileSync(path.join(repo, "A.cs"), "class A {\n  // TODO: old\n  // FIXME: branch\n  // HACK: local\n}\n");
    fs.writeFileSync(path.join(repo, "New.cs"), "// TODO: untracked\n");
  });

  after(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("finds the base branch and identity", async () => {
    assert.equal(await resolveBaseRef(runner, repo, ""), "main");
    assert.equal(await resolveBaseRef(runner, repo, "does-not-exist"), "main");
    assert.deepEqual(await userIdentity(runner, repo), { name: "Test User", email: "test@example.com" });
  });

  it("splits uncommitted and branch lines", async () => {
    const sets = await changeSets(runner, repo, "");
    assert.ok(sets);
    const file = path.join(repo, "A.cs");
    assert.deepEqual([...((sets?.uncommitted.get(file) as Set<number>) ?? [])], [4]);
    assert.equal(sets?.uncommitted.get(path.join(repo, "New.cs")), "all");
    assert.ok(lineIsIn(sets?.branch.get(file), 3));
    assert.ok(!lineIsIn(sets?.branch.get(file), 2));
    assert.equal(sets?.onBaseBranch, false);
    assert.equal(sets?.baseRef, "main");
  });

  it("returns nothing outside a repository", async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "todoforge-nogit-"));
    try {
      assert.equal(await changeSets(runner, outside, ""), undefined);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("blames only the requested lines, including dirty buffers", async () => {
    const file = path.join(repo, "A.cs");
    const blame = await blameLines(runner, file, [2, 3]);
    assert.equal(blame.get(2)?.author, "Test User");
    assert.equal(blame.get(2)?.summary, "base");
    assert.equal(blame.get(3)?.summary, "branch work");
    assert.equal(blame.has(1), false);
    const dirty = await blameLines(runner, file, [1, 2], "// TODO: typed\nclass A {\n");
    assert.equal(dirty.get(1)?.uncommitted, true);
  });

  it("reports gitignored paths", async () => {
    const ignored = await ignoredPaths(runner, repo, ["bin/Debug/A.cs", "A.cs"]);
    assert.deepEqual([...ignored], ["bin/Debug/A.cs"]);
  });
});
