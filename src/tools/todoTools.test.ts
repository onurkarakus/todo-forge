import assert from "node:assert/strict";
import { describe, it } from "mocha";

import type { BlameInfo, TodoMatch } from "../types";
import {
  buildToolQuery,
  clampLimit,
  findTodo,
  LIMITS,
  refOf,
  renderRecords,
  selectTodos,
  toRecord,
  type ToolContext,
} from "./todoTools";

const NOW = Date.UTC(2026, 10, 3) / 1000;

const match = (line: number, overrides: Partial<TodoMatch> = {}): TodoMatch => ({
  id: `m${line}`,
  uri: `file:///w/${overrides.relativePath ?? "src/A.cs"}`,
  relativePath: "src/A.cs",
  line,
  column: 0,
  endColumn: 4,
  leadColumn: 0,
  lineLength: 10,
  tag: "TODO",
  text: `item ${line}`,
  raw: `// TODO: item ${line}`,
  kind: "tag",
  ...overrides,
});

const blame = (author: string, daysAgo: number): BlameInfo => ({
  sha: "a".repeat(40),
  author,
  email: `${author}@x.dev`,
  time: NOW - daysAgo * 86400,
  summary: "c",
  uncommitted: false,
});

const matches = [
  match(0, { meta: { owner: "onur", due: "2026-11-01", priority: "high", labels: ["perf"] } }),
  match(5, { tag: "FIXME", relativePath: "web/app.ts", uri: "file:///w/web/app.ts", meta: { due: "2026-11-06", labels: [] } }),
  match(9, { kind: "code", tag: "NotImplemented", text: "" , raw: "throw new NotImplementedException();" }),
  match(12, { text: "old thing", meta: { priority: "low", labels: [] } }),
  match(3, { kind: "markdown", tag: "MARKDOWN", relativePath: "docs/x.md", uri: "file:///w/docs/x.md", markdownChecked: false }),
];

const blames = new Map<string, BlameInfo>([
  ["m0", blame("Onur", 3)],
  ["m12", blame("Ayse", 400)],
]);

const context: ToolContext = {
  today: "2026-11-03",
  staleAfterDays: 180,
  nowSeconds: NOW,
  me: { names: ["Onur"], emails: [] },
  blameOf: (item) => blames.get(item.id),
  isNew: (item) => item.line === 5,
  isUncommitted: (item) => item.line === 5,
  isOnBranch: (item) => item.line === 5 || item.line === 9,
  isPinned: (item) => item.line === 12,
};

describe("chat tools", () => {
  it("builds a query from structured input", () => {
    assert.equal(
      buildToolQuery({ file: "src\\api", tags: ["FIXME", " BUG "], owner: "@onur", label: "#perf", status: ["overdue", "mine", "dueSoon"], text: "cache it" }),
      "path:src/api tag:FIXME,BUG owner:onur label:perf is:overdue is:mine cache it",
    );
    assert.equal(buildToolQuery({ query: "is:new", owner: "Ayşe Demir" }), 'is:new owner:"Ayşe Demir"');
    assert.equal(buildToolQuery({}), "");
  });

  it("clamps the limit", () => {
    assert.equal(clampLimit(undefined), LIMITS.defaultItems);
    assert.equal(clampLimit(0), 1);
    assert.equal(clampLimit(10_000), LIMITS.maxItems);
    assert.equal(clampLimit("7"), LIMITS.defaultItems);
  });

  it("filters by status, priority and tag and sorts due dates first", () => {
    assert.deepEqual(selectTodos(matches, { status: ["overdue"] }, context).items.map(refOf), ["src/A.cs:1"]);
    assert.deepEqual(selectTodos(matches, { status: ["dueSoon"] }, context).items.map(refOf), ["web/app.ts:6"]);
    assert.deepEqual(selectTodos(matches, { status: ["due"] }, context).items.map(refOf), ["src/A.cs:1", "web/app.ts:6"]);
    assert.deepEqual(selectTodos(matches, { priority: ["high", "medium"] }, context).items.map(refOf), ["src/A.cs:1"]);
    assert.deepEqual(selectTodos(matches, { tags: ["FIXME"] }, context).items.map(refOf), ["web/app.ts:6"]);
    assert.deepEqual(selectTodos(matches, { status: ["stale"] }, context).items.map(refOf), ["src/A.cs:13"]);
    assert.deepEqual(selectTodos(matches, { status: ["mine"] }, context).items.map(refOf), ["src/A.cs:1"]);
    assert.deepEqual(selectTodos(matches, { status: ["uncommitted"] }, context).items.map(refOf), ["web/app.ts:6"]);
    assert.deepEqual(selectTodos(matches, { status: ["branch"] }, context).items.map(refOf), ["src/A.cs:10"]);
  });

  it("limits results and reports the total", () => {
    const result = selectTodos(matches, { limit: 2 }, context);
    assert.equal(result.items.length, 2);
    assert.equal(result.total, matches.length);
  });

  it("builds compact records with metadata, blame, change and pin state", () => {
    const [first, , code, old, checklist] = matches as [TodoMatch, TodoMatch, TodoMatch, TodoMatch, TodoMatch];
    assert.deepEqual(toRecord(first, context), {
      ref: "src/A.cs:1",
      tag: "TODO",
      text: "item 0",
      file: "src/A.cs",
      line: 1,
      owner: "onur",
      due: "2026-11-01",
      dueIn: -2,
      priority: "high",
      labels: ["perf"],
      author: "Onur",
      age: "3d",
    });
    assert.equal(toRecord(code, context).text, "throw new NotImplementedException();");
    assert.equal(toRecord(code, context).kind, "code");
    assert.equal(toRecord(code, context).change, "branch");
    assert.equal(toRecord(old, context).pinned, true);
    assert.equal(toRecord(checklist, context).tag, "CHECKLIST");
    assert.equal(toRecord(checklist, context).checked, false);
    const long = toRecord(match(1, { text: "x".repeat(500) }), context);
    assert.equal(long.text.length, LIMITS.textChars);
  });

  it("finds one TODO by ref, by file and line, or by a unique file", () => {
    assert.equal(findTodo(matches, { ref: "src/A.cs:13" })?.line, 12);
    assert.equal(findTodo(matches, { ref: "A.cs:12" })?.line, 12, "nearest line within 3");
    assert.equal(findTodo(matches, { file: "web/app.ts" })?.line, 5);
    assert.equal(findTodo(matches, { file: "src/A.cs" }), undefined, "ambiguous without a line");
    assert.equal(findTodo(matches, { file: "src/A.cs", line: 40 }), undefined);
    assert.equal(findTodo(matches, { ref: "nope.cs:1" }), undefined);
  });

  it("renders a summary and JSON within the size budget", () => {
    const records = Array.from({ length: 400 }, (_, index) => toRecord(match(index, { text: "y".repeat(150) }), context));
    const text = renderRecords("Found 400 TODOs.", records, 400);
    assert.ok(text.length <= LIMITS.totalChars + 400);
    assert.match(text, /^Found 400 TODOs\.\nShowing \d+ of 400\./);
    const json = text.slice(text.indexOf("```json") + 8, text.lastIndexOf("```"));
    assert.ok(Array.isArray(JSON.parse(json)));
  });
});
