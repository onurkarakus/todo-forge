import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { addMonths, isRelativeDate, parseMetadata, resolveRelativeDate, rewriteMetadata } from "./metadata";

// 2026-11-21 is a Saturday.
const TODAY = "2026-11-21";

describe("relative due dates", () => {
  it("recognizes offsets, keywords and weekday names", () => {
    for (const token of ["+7d", "+2w", "+1m", "+10D", "today", "Tomorrow", "friday", "MONDAY"]) {
      assert.equal(isRelativeDate(token), true, token);
    }
    for (const token of ["7d", "+d", "+1y", "fri", "onur", "2026-12-01", "+1000d"]) {
      assert.equal(isRelativeDate(token), false, token);
    }
  });

  it("resolves offsets", () => {
    assert.equal(resolveRelativeDate("+7d", TODAY), "2026-11-28");
    assert.equal(resolveRelativeDate("+2w", TODAY), "2026-12-05");
    assert.equal(resolveRelativeDate("+1m", TODAY), "2026-12-21");
    assert.equal(resolveRelativeDate("+0d", TODAY), TODAY);
    assert.equal(resolveRelativeDate("today", TODAY), TODAY);
    assert.equal(resolveRelativeDate("tomorrow", TODAY), "2026-11-22");
    assert.equal(resolveRelativeDate("someday", TODAY), undefined);
  });

  it("resolves weekday names to the next such day, never today", () => {
    assert.equal(resolveRelativeDate("friday", TODAY), "2026-11-27");
    assert.equal(resolveRelativeDate("Sunday", TODAY), "2026-11-22");
    assert.equal(resolveRelativeDate("saturday", TODAY), "2026-11-28");
    assert.equal(resolveRelativeDate("monday", TODAY), "2026-11-23");
  });

  it("clamps months to the last day", () => {
    assert.equal(addMonths("2027-01-31", 1), "2027-02-28");
    assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
    assert.equal(addMonths("2026-12-15", 2), "2027-02-15");
  });

  it("parses a relative token without taking it as the owner", () => {
    const parsed = parseMetadata("(+7d, onur, !high): text");
    assert.equal(parsed.meta?.relativeDue, "+7d");
    assert.equal(parsed.meta?.owner, "onur");
    assert.equal(parsed.meta?.due, undefined);
    assert.deepEqual(parsed.meta?.labels, []);
  });

  it("rewrites a relative token to an absolute date and keeps it on other edits", () => {
    const line = "// TODO(me, +7d, #perf): cache";
    assert.equal(rewriteMetadata(line, 3, "TODO", { due: "2026-11-28" }), "// TODO(me, 2026-11-28, #perf): cache");
    assert.equal(rewriteMetadata(line, 3, "TODO", { priority: "high" }), "// TODO(me, +7d, !high, #perf): cache");
  });
});
