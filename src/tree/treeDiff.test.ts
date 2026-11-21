import assert from "node:assert/strict";
import { describe, it } from "mocha";

import type { TodoMatch } from "../types";
import { groupMatches, type ViewNode } from "./grouping";
import { changedNodeIds, signTree } from "./treeDiff";

const match = (file: string, line: number, text: string): TodoMatch => ({
  id: `file:///w/${file}#${line}`,
  uri: `file:///w/${file}`,
  workspaceFolder: "/w",
  relativePath: file,
  line,
  column: 3,
  endColumn: 7,
  leadColumn: 0,
  lineLength: 20,
  tag: "TODO",
  text,
  raw: `// TODO: ${text}`,
  kind: "tag",
});

const tree = (matches: TodoMatch[]): ViewNode =>
  groupMatches(matches, {
    groupBy: "file",
    labelFormat: "${tag}: ${text}",
    tagGroups: [],
    markdownSeparate: false,
    workspaceFolders: [{ path: "/w", name: "w" }],
  });

const content = (node: ViewNode): string => `${node.label}|${node.count}|${node.match?.line ?? ""}|${node.match?.text ?? ""}`;

const plan = (before: TodoMatch[], after: TodoMatch[]): string[] | "all" => {
  const previousRoot = tree(before);
  const nextRoot = tree(after);
  return changedNodeIds(signTree(previousRoot, content), signTree(nextRoot, content), nextRoot);
};

describe("changedNodeIds", () => {
  const base = [match("src/a.ts", 1, "one"), match("src/a.ts", 5, "two"), match("src/b.ts", 2, "three")];

  it("refreshes nothing when the tree is unchanged", () => {
    assert.deepEqual(plan(base, [...base]), []);
  });

  it("refreshes only the changed TODO when its text changes", () => {
    const next = [base[0]!, { ...base[1]!, text: "two!" }, base[2]!];
    const ids = plan(base, next);
    assert.ok(Array.isArray(ids));
    assert.equal(ids.length, 1);
    assert.ok(ids[0]?.includes("src/a.ts#5"));
  });

  it("refreshes the parent when a TODO is added, not the whole tree", () => {
    const next = [...base, match("src/b.ts", 9, "four")];
    const ids = plan(base, next);
    assert.ok(Array.isArray(ids));
    // The b.ts file node (count and children changed). The folder count changed too.
    assert.ok(ids.length >= 1 && ids.length <= 2, JSON.stringify(ids));
  });

  it("refreshes everything without a previous tree or when the top level changes", () => {
    const root = tree(base);
    assert.equal(changedNodeIds(undefined, signTree(root, content), root), "all");
    assert.equal(plan(base, [match("lib/x.ts", 1, "x")]), "all");
  });

  it("falls back to a full refresh over the limit", () => {
    const many = Array.from({ length: 20 }, (_, index) => match("src/a.ts", index, `t${index}`));
    const edited = many.map((item) => ({ ...item, text: `${item.text}!` }));
    const previousRoot = tree(many);
    const nextRoot = tree(edited);
    assert.equal(changedNodeIds(signTree(previousRoot, content), signTree(nextRoot, content), nextRoot, 5), "all");
  });
});
