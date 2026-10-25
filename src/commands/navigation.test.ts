import assert from "node:assert/strict";
import { describe, it } from "mocha";

import type { TodoMatch } from "../types";
import { cycleMatch, formatStatusText } from "./navigation";
import { treeToJson, treeToMarkdown } from "../tree/exportTree";
import { groupMatches } from "../tree/grouping";

const match = (line: number, column: number): TodoMatch => {
  return {
    id: `${line}`,
    uri: "file:///src/A.cs",
    relativePath: "src/A.cs",
    line,
    column,
    endColumn: column + 4,
    leadColumn: 0,
    lineLength: 20,
    tag: "TODO",
    text: `item ${line}`,
    raw: "// TODO",
    kind: "tag",
  };
};

describe("navigation and export", () => {
  it("cycles next and previous", () => {
    const matches = [match(2, 0), match(5, 0), match(9, 0)];
    assert.equal(cycleMatch(matches, 0, 0, 1)?.line, 2);
    assert.equal(cycleMatch(matches, 5, 0, 1)?.line, 9);
    assert.equal(cycleMatch(matches, 9, 0, 1)?.line, 2);
    assert.equal(cycleMatch(matches, 5, 0, -1)?.line, 2);
    assert.equal(cycleMatch(matches, 0, 0, -1)?.line, 9);
  });

  it("formats the status bar and export", () => {
    assert.equal(formatStatusText(new Map([["TODO", 2], ["FIXME", 1]]), "perTag", false), "TODO:2 FIXME:1");
    assert.equal(formatStatusText(new Map([["TODO", 2]]), "total", true), "TodoForge: Scanning…");
    const root = groupMatches([match(1, 0)], "flat", "${tag}: ${text}", [], false);
    const markdown = treeToMarkdown(root, []);
    assert.match(markdown, /Found in Code/);
    assert.match(markdown, /src\/A\.cs:2/);
    const json = treeToJson([match(1, 0)], []);
    assert.match(json, /"tag": "TODO"/);
  });
});
