import assert from "node:assert/strict";
import { describe, it } from "mocha";

import type { TodoMatch } from "../types";
import { filterMatches } from "./filter";
import { groupMatches } from "./grouping";
import { formatMatchLabel } from "./label";

const match = (overrides: Partial<TodoMatch>): TodoMatch => {
  return {
    id: overrides.id ?? "1",
    uri: overrides.uri ?? "file:///src/Program.cs",
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
  };
};

describe("grouping", () => {
  const matches = [
    match({ id: "a", tag: "TODO", text: "one", line: 1 }),
    match({ id: "b", tag: "FIXME", text: "two", line: 2, relativePath: "src/Other.cs", uri: "file:///src/Other.cs" }),
    match({
      id: "c",
      kind: "markdown",
      tag: "MARKDOWN",
      text: "docs",
      relativePath: "notes/readme.md",
      uri: "file:///notes/readme.md",
    }),
  ];

  it("groups by tag and keeps markdown separate", () => {
    const root = groupMatches(matches, "tag", "${tag}: ${text}", [], true);
    const labels = root.children.map((child) => child.label);
    assert.ok(labels.includes("FIXME"));
    assert.ok(labels.includes("TODO"));
    assert.ok(labels.includes("Markdown Checklists"));
    assert.equal(root.count, 3);
  });

  it("groups by file path", () => {
    const root = groupMatches(matches.slice(0, 2), "file", "${tag}: ${text}", [], false);
    const src = root.children.find((child) => child.label === "src");
    assert.ok(src);
    assert.equal(src?.children.length, 2);
  });

  it("filters and formats labels", () => {
    const filtered = filterMatches(matches, "other");
    assert.equal(filtered.length, 1);
    assert.equal(formatMatchLabel("${file}:${line} ${text}", matches[0]!), "Program.cs:2 one");
    const root = groupMatches(filtered, "flat", "${tag}: ${text}", [], false);
    assert.equal(root.count, 1);
  });

  it("nests tag groups", () => {
    const root = groupMatches(matches.slice(0, 2), "tag", "${tag}: ${text}", [
      { name: "Open", tags: ["TODO", "FIXME"] },
    ], false);
    assert.equal(root.children[0]?.label, "Open");
    assert.equal(root.children[0]?.children.length, 2);
  });
});
