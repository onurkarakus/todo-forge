import assert from "node:assert/strict";

import { changeFromEdit } from "../scanning/lineShift";
import { createEditLog, mapLineSet } from "./lineMap";

// Helpers in VS Code terms: 0-based range lines and the inserted text.
const insertLines = (at0: number, count: number) => changeFromEdit(at0, at0, "x\n".repeat(count));
const deleteLines = (from0: number, to0Exclusive: number) => changeFromEdit(from0, to0Exclusive, "");
const typeOnLine = (line0: number) => changeFromEdit(line0, line0, "abc");

describe("mapLineSet", () => {
  it("returns the disk set unchanged without edits, and keeps untracked files whole", () => {
    const set = new Set([3, 10]);
    assert.equal(mapLineSet(set, []), set);
    assert.equal(mapLineSet("all", [[insertLines(0, 5)]]), "all");
  });

  it("shifts changed lines below an insertion and marks the new lines", () => {
    // Line 10 (1-based) is a new TODO on disk; three lines are inserted above it.
    const mapped = mapLineSet(new Set([10]), [[insertLines(2, 3)]]) as Set<number>;
    assert.ok(mapped.has(13), "the TODO moved from 10 to 13");
    assert.ok(!mapped.has(10));
    // The inserted lines (0-based 2..4 => 1-based 3..5) differ from disk; line 6 is the split line.
    for (const line of [3, 4, 5]) {
      assert.ok(mapped.has(line));
    }
  });

  it("shifts lines up after a deletion and drops deleted ones", () => {
    const mapped = mapLineSet(new Set([4, 20]), [[deleteLines(2, 6)]]) as Set<number>;
    assert.ok(!mapped.has(20));
    assert.ok(mapped.has(16), "line 20 moved up by four");
    assert.ok(!mapped.has(4), "line 4 was deleted");
  });

  it("marks a line edited in place and starts from an empty set for clean files", () => {
    const mapped = mapLineSet(undefined, [[typeOnLine(7)]]) as Set<number>;
    assert.deepEqual([...mapped], [8]);
  });

  it("applies batches in order and changes inside one batch from the bottom up", () => {
    const mapped = mapLineSet(new Set([10, 30]), [
      [insertLines(0, 1), insertLines(20, 2)],
      [deleteLines(0, 1)],
    ]) as Set<number>;
    // First batch: 10 -> 11, 30 -> 33. Second batch removes the first line: 10, 32.
    assert.ok(mapped.has(10));
    assert.ok(mapped.has(32));
  });
});

describe("edit log", () => {
  it("keeps unsaved edits until git has seen the save", () => {
    const log = createEditLog();
    const uri = "file:///a.cs";
    log.record(uri, [insertLines(0, 2)]);
    assert.equal(log.pending(uri).length, 1);
    log.saved(uri);
    // Change sets still describe the old disk content until the refresh finishes.
    assert.equal(log.pending(uri).length, 1);
    const snapshot = log.snapshot();
    log.record(uri, [insertLines(5, 1)]); // typed while git runs: not on disk
    log.settle(snapshot);
    assert.equal(log.pending(uri).length, 1);
    assert.notEqual(log.version(uri), 0);
  });

  it("drops edits that were undone back to the saved file", () => {
    const log = createEditLog();
    const uri = "file:///b.ts";
    log.record(uri, [typeOnLine(1)]);
    log.record(uri, [typeOnLine(1)]);
    log.clean(uri);
    assert.equal(log.pending(uri).length, 0);
    assert.equal(log.version(uri), 0);
  });

  it("ignores empty batches", () => {
    const log = createEditLog();
    log.record("file:///c.ts", []);
    assert.equal(log.version("file:///c.ts"), 0);
  });
});
