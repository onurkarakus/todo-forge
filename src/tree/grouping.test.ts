import assert from "node:assert/strict";
import { describe, it } from "mocha";

import type { TodoMatch } from "../types";
import { findFileNodeId, groupMatches, indexNodes, type GroupOptions } from "./grouping";
import { formatMatchLabel } from "./label";

const match = (overrides: Partial<TodoMatch>): TodoMatch => {
  return {
    id: overrides.id ?? "1",
    uri: overrides.uri ?? "file:///w/src/Program.cs",
    workspaceFolder: overrides.workspaceFolder,
    relativePath: overrides.relativePath ?? "src/Program.cs",
    line: overrides.line ?? 0,
    column: 0,
    endColumn: 4,
    leadColumn: 0,
    lineLength: 10,
    tag: overrides.tag ?? "TODO",
    subTag: overrides.subTag,
    text: overrides.text ?? "work",
    raw: overrides.raw ?? "// TODO: work",
    kind: overrides.kind ?? "tag",
    markdownChecked: overrides.markdownChecked,
    meta: overrides.meta,
  };
};

const options = (overrides: Partial<GroupOptions> = {}): GroupOptions => ({
  groupBy: "tag",
  labelFormat: "${tag}: ${text}",
  tagGroups: [],
  markdownSeparate: true,
  workspaceFolders: [{ path: "/w", name: "w" }],
  ...overrides,
});

describe("grouping", () => {
  const matches = [
    match({ id: "a", tag: "TODO", text: "one", line: 1 }),
    match({ id: "b", tag: "FIXME", text: "two", line: 2, relativePath: "src/Other.cs", uri: "file:///w/src/Other.cs" }),
    match({
      id: "c",
      kind: "markdown",
      tag: "MARKDOWN",
      text: "docs",
      relativePath: "notes/readme.md",
      uri: "file:///w/notes/readme.md",
    }),
  ];

  it("groups by tag and keeps markdown separate", () => {
    const root = groupMatches(matches, options({ markdownLabel: "Checklists" }));
    const labels = root.children.map((child) => child.label);
    assert.deepEqual(labels, ["FIXME", "TODO", "Checklists"]);
    assert.equal(root.count, 3);
  });

  it("orders tag groups by the configured tag list, unknown tags last", () => {
    const extra = [...matches, match({ id: "d", tag: "Obsolete", text: "old", line: 3 }), match({ id: "e", tag: "BUG", text: "bug", line: 4 })];
    const root = groupMatches(extra, options({ tagOrder: ["TODO", "FIXME", "BUG"], markdownLabel: "Checklists" }));
    assert.deepEqual(
      root.children.map((child) => child.label),
      ["TODO", "FIXME", "BUG", "Obsolete", "Checklists"],
    );
  });

  it("groups by file path and compacts single-child folders", () => {
    const deep = [
      match({ id: "x", relativePath: "src/app/api/A.ts", uri: "file:///w/src/app/api/A.ts" }),
      match({ id: "y", relativePath: "src/app/api/B.ts", uri: "file:///w/src/app/api/B.ts" }),
    ];
    const root = groupMatches(deep, options({ groupBy: "file" }));
    assert.equal(root.children.length, 1);
    assert.equal(root.children[0]?.label, "src/app/api");
    assert.equal(root.children[0]?.children.length, 2);
    assert.ok(findFileNodeId(root, "file:///w/src/app/api/B.ts"));
  });

  it("keeps equal relative paths in different workspace folders apart", () => {
    const multi = [
      match({ id: "1", workspaceFolder: "/a", uri: "file:///a/src/X.cs", relativePath: "src/X.cs" }),
      match({ id: "2", workspaceFolder: "/b", uri: "file:///b/src/X.cs", relativePath: "src/X.cs" }),
    ];
    const root = groupMatches(
      multi,
      options({
        groupBy: "file",
        workspaceFolders: [
          { path: "/a", name: "api" },
          { path: "/b", name: "web" },
        ],
      }),
    );
    assert.deepEqual(
      root.children.map((child) => [child.kind, child.label, child.count]),
      [
        ["workspace", "api", 1],
        ["workspace", "web", 1],
      ],
    );
    const ids = [...indexNodes(root).keys()];
    assert.equal(new Set(ids).size, ids.length, "node ids must be unique");
  });

  it("groups by owner", () => {
    const owned = [
      match({ id: "1", meta: { owner: "onur", labels: [] } }),
      match({ id: "2", meta: { owner: "ayse", labels: [] } }),
      match({ id: "3" }),
    ];
    const root = groupMatches(owned, options({ groupBy: "owner", noOwnerLabel: "(none)" }));
    assert.deepEqual(
      root.children.map((child) => child.label),
      ["(none)", "ayse", "onur"],
    );
  });

  it("keeps caller order when asked", () => {
    const sorted = [match({ id: "2", line: 9 }), match({ id: "1", line: 1 })];
    const root = groupMatches(sorted, options({ groupBy: "flat", keepOrder: true }));
    assert.deepEqual(
      root.children.map((child) => child.match?.id),
      ["2", "1"],
    );
  });

  it("formats labels", () => {
    assert.equal(formatMatchLabel("${file}:${line} ${text}", matches[0]!), "Program.cs:2 one");
  });

  it("nests tag groups", () => {
    const root = groupMatches(matches.slice(0, 2), options({ tagGroups: [{ name: "Open", tags: ["TODO", "FIXME"] }] }));
    assert.equal(root.children[0]?.label, "Open");
    assert.equal(root.children[0]?.children.length, 2);
  });

  it("returns an empty root when nothing matches", () => {
    const root = groupMatches([], options());
    assert.equal(root.children.length, 0);
    assert.equal(root.count, 0);
  });
});
