import assert from "node:assert/strict";
import { describe, it } from "mocha";

import type { TodoMatch } from "../types";
import { cycleMatch } from "./navigation";
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
    meta: { owner: "onur", due: "2026-12-01", labels: [] },
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
    assert.equal(cycleMatch([], 0, 0, 1), undefined);
  });

  it("exports the view as Markdown and JSON", () => {
    const root = groupMatches([match(1, 0)], {
      groupBy: "tag",
      labelFormat: "${text}",
      tagGroups: [],
      markdownSeparate: true,
      workspaceFolders: [],
    });
    const markdown = treeToMarkdown(root);
    assert.match(markdown, /^# TODOs \(1\)/);
    assert.match(markdown, /## TODO \(1\)/);
    assert.match(markdown, /- \[ \] item 1 \(src\/A\.cs:2\)/);
    const json = JSON.parse(treeToJson([match(1, 0)])) as Record<string, unknown>[];
    assert.deepEqual(json[0], {
      tag: "TODO",
      text: "item 1",
      file: "src/A.cs",
      line: 2,
      column: 1,
      kind: "tag",
      owner: "onur",
      due: "2026-12-01",
    });
  });
});
