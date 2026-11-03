import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { commentContextAt } from "./commentContext";
import { extensionOf, isDotnetFile, syntaxFor } from "./languages";
import {
  addDays,
  daysUntil,
  isIsoDate,
  parseMetadata,
  parsePriority,
  rewriteMetadata,
  serializeMetadata,
  snoozeDate,
} from "./metadata";
import { buildTodoLine, planRemoval } from "./removal";

describe("languages", () => {
  it("maps extensions and special file names", () => {
    assert.equal(extensionOf("src/App.Vue"), "vue");
    assert.deepEqual(syntaxFor("a.tsx")?.block.map(([open]) => open).includes("{/*"), true);
    assert.equal(syntaxFor("Dockerfile")?.insert, "#");
    assert.equal(syntaxFor("paper.tex")?.insert, "%");
    assert.equal(syntaxFor("unknown.zzz"), undefined);
    assert.equal(isDotnetFile("A.cs"), true);
    assert.equal(isDotnetFile("A.ts"), false);
  });
});

describe("commentContextAt", () => {
  const cs = syntaxFor("A.cs");
  it("detects line and block comments", () => {
    const line = "var x = 1; // TODO: a";
    const context = commentContextAt(line, line.indexOf("TODO"), cs);
    assert.equal(context.inComment, true);
    assert.equal(context.commentStart, line.indexOf("//"));
    assert.equal(context.direct, true);
    const block = "/* FIXME */ code();";
    const blockContext = commentContextAt(block, 3, cs);
    assert.equal(blockContext.blockClose, "*/");
  });

  it("skips string literals", () => {
    const line = 'Log("// TODO: no"); // TODO: yes';
    assert.equal(commentContextAt(line, line.indexOf("TODO"), cs).inComment, false);
    assert.equal(commentContextAt(line, line.lastIndexOf("TODO"), cs).inComment, true);
  });

  it("treats Javadoc continuation lines as comments", () => {
    const line = "   * TODO: describe";
    assert.equal(commentContextAt(line, line.indexOf("TODO"), syntaxFor("A.java")).inComment, true);
  });
});

describe("metadata", () => {
  it("validates dates and priorities", () => {
    assert.equal(isIsoDate("2026-02-28"), true);
    assert.equal(isIsoDate("2026-02-30"), false);
    assert.equal(isIsoDate("26-02-01"), false);
    assert.equal(parsePriority("!P1"), "high");
    assert.equal(parsePriority("!med"), "medium");
    assert.equal(parsePriority("!soon"), undefined);
  });

  it("parses in any order and keeps unknown words as labels", () => {
    const parsed = parseMetadata("(#api, !low, 2027-01-05, @onur, extra): rest");
    assert.deepEqual(parsed.meta, { owner: "onur", due: "2027-01-05", priority: "low", labels: ["api", "extra"] });
    assert.equal(parsed.length, "(#api, !low, 2027-01-05, @onur, extra)".length);
    assert.deepEqual(parseMetadata(": no meta"), { length: 0 });
    assert.deepEqual(parseMetadata("(a(b))"), { length: 0 });
  });

  it("serializes in a stable order", () => {
    assert.equal(serializeMetadata({ owner: "onur", due: "2026-12-01", priority: "high", labels: ["perf"] }), "(onur, 2026-12-01, !high, #perf)");
    assert.equal(serializeMetadata({ labels: [] }), "");
  });

  it("rewrites metadata in place", () => {
    assert.equal(
      rewriteMetadata("// TODO: cache", 3, "TODO", { due: "2026-12-01" }),
      "// TODO(2026-12-01): cache",
    );
    assert.equal(
      rewriteMetadata("// TODO(onur, !low): cache", 3, "TODO", { priority: "high" }),
      "// TODO(onur, !high): cache",
    );
    assert.equal(rewriteMetadata("// TODO(onur): cache", 3, "TODO", { owner: null }), "// TODO: cache");
    assert.equal(rewriteMetadata("// TODO cache", 3, "TODO", { owner: "ayse" }), "// TODO(ayse): cache");
    assert.equal(rewriteMetadata("// moved TODO", 3, "TODO", { owner: "x" }), undefined, "tag moved: no edit");
    assert.equal(rewriteMetadata("// TODOS: x", 3, "TODO", { owner: "x" }), undefined, "longer word: no edit");
  });

  it("computes dates without time zone drift", () => {
    assert.equal(addDays("2026-12-30", 3), "2027-01-02");
    assert.equal(daysUntil("2026-11-01", "2026-11-03"), -2);
    assert.equal(daysUntil("2026-03-30", "2026-03-28"), 2, "across a DST change");
    assert.equal(snoozeDate(undefined, 7, "2026-11-03"), "2026-11-10");
    assert.equal(snoozeDate("2026-12-01", 7, "2026-11-03"), "2026-12-08", "future due dates move from the due date");
    assert.equal(snoozeDate("2026-10-01", 1, "2026-11-03"), "2026-11-04", "overdue dates move from today");
  });
});

describe("removal", () => {
  const cs = syntaxFor("A.cs");
  it("deletes a comment-only line", () => {
    assert.deepEqual(planRemoval("    // TODO: x", 7, cs), { kind: "line" });
    assert.deepEqual(planRemoval("/* TODO: x */", 3, cs), { kind: "line" });
  });

  it("cuts a trailing comment back to the code", () => {
    const line = "call(); // TODO: x";
    assert.deepEqual(planRemoval(line, line.indexOf("TODO"), cs), { kind: "range", start: 7, end: line.length, replacement: "" });
  });

  it("keeps code after a closed block comment", () => {
    const line = "/* TODO: x */ call();";
    const plan = planRemoval(line, 3, cs);
    assert.ok(plan && plan.kind === "range");
    if (plan?.kind === "range") {
      assert.equal(`${line.slice(0, plan.start)}${plan.replacement}${line.slice(plan.end)}`, "call();");
    }
  });

  it("refuses when the tag is not in a comment", () => {
    assert.equal(planRemoval('Log("TODO: x");', 5, cs), undefined);
  });

  it("builds new comment lines per syntax", () => {
    assert.equal(buildTodoLine("  ", syntaxFor("a.py"), "TODO: x"), "  # TODO: x");
    assert.equal(buildTodoLine("", syntaxFor("a.css"), "TODO: x"), "/* TODO: x */");
  });
});
