import assert from "node:assert/strict";
import { describe, it } from "mocha";

import type { TodoMatch } from "../types";
import { accumulateWindows, applyLineChanges, changeFromEdit, windowForChanges } from "./lineShift";
import { createIndex } from "./indexStore";

const match = (line: number, tag = "TODO"): TodoMatch => {
  return {
    id: `tag:file:${line}:0:${tag}`,
    uri: "file:///src/A.cs",
    relativePath: "src/A.cs",
    line,
    column: 3,
    endColumn: 7,
    leadColumn: 0,
    lineLength: 20,
    tag,
    text: "item",
    raw: "// TODO: item",
    kind: "tag",
  };
};

describe("index and line shifts", () => {
  it("replaces one file without dropping the other", () => {
    const index = createIndex();
    const other = { ...match(1, "FIXME"), uri: "file:///src/B.cs", relativePath: "src/B.cs" };
    index.replaceAll([match(1), other]);
    index.setFile("file:///src/A.cs", [match(4)]);
    assert.equal(index.getFile("file:///src/A.cs")[0]?.line, 4);
    assert.equal(index.getFile("file:///src/B.cs").length, 1);
    index.removeFile("file:///src/B.cs");
    assert.equal(index.total(), 1);
  });

  it("shifts lines under an insertion and rescans only the window", () => {
    const original = [match(1), match(10), match(8000)];
    const change = changeFromEdit(10, 10, "\n");
    const shifted = applyLineChanges(original, [change]);
    assert.deepEqual(
      shifted.map((item) => item.line),
      [1, 8001],
    );
    const window = windowForChanges([change], 2, 10000);
    assert.ok(window);
    assert.ok((window?.end ?? 0) - (window?.start ?? 0) < 20);
    const index = createIndex();
    index.setFile("file:///src/A.cs", shifted);
    index.mergeWindow("file:///src/A.cs", window?.start ?? 0, window?.end ?? 0, [match(11)]);
    const lines = index.getFile("file:///src/A.cs").map((item) => item.line);
    assert.deepEqual(lines, [1, 11, 8001]);
  });

  it("keeps a second edit window small on a long document", () => {
    const first = changeFromEdit(100, 100, "a");
    const second = changeFromEdit(104, 104, "b\nc");
    const window = accumulateWindows(windowForChanges([first], 2, 10000), [second], 2, 10000);
    assert.ok(window);
    assert.ok((window?.end ?? 0) - (window?.start ?? 0) < 20);
    assert.ok((window?.start ?? 0) >= 90);
  });
});
