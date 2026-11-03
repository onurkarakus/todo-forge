import assert from "node:assert/strict";
import { describe, it } from "mocha";

import type { BlameInfo, TodoMatch } from "../types";
import { ageInDays, filterByQuery, formatAge, isMine, parseQuery, queryNeedsBlame, sortMatches, type QueryContext } from "./query";

const NOW = Date.UTC(2026, 10, 3) / 1000;

const match = (id: string, overrides: Partial<TodoMatch> = {}): TodoMatch => ({
  id,
  uri: `file:///w/${overrides.relativePath ?? "src/A.cs"}`,
  relativePath: "src/A.cs",
  line: Number(id),
  column: 0,
  endColumn: 4,
  leadColumn: 0,
  lineLength: 10,
  tag: "TODO",
  text: `item ${id}`,
  raw: `// TODO: item ${id}`,
  kind: "tag",
  ...overrides,
});

const blame = (author: string, daysAgo: number, email = `${author}@x.dev`): BlameInfo => ({
  sha: "a".repeat(40),
  author,
  email,
  time: NOW - daysAgo * 86400,
  summary: "commit",
  uncommitted: false,
});

const matches = [
  match("1", { meta: { owner: "onur", due: "2026-11-01", labels: ["perf"] } }),
  match("2", { tag: "FIXME", relativePath: "web/app.ts", meta: { priority: "high", labels: [] } }),
  match("3", { kind: "code", tag: "NotImplemented" }),
  match("4", { text: "old thing" }),
];

const blames = new Map<string, BlameInfo>([
  ["2", blame("Onur Karakuş", 10, "onur@x.dev")],
  ["4", blame("Ayşe", 400)],
]);

const context: QueryContext = {
  today: "2026-11-03",
  staleAfterDays: 180,
  nowSeconds: NOW,
  me: { names: ["Onur Karakuş", "onur"], emails: ["onur@x.dev"] },
  blameOf: (item) => blames.get(item.id),
  isNew: (item) => item.id === "2",
};

const ids = (query: string): string[] => filterByQuery(matches, query, context).map((item) => item.id);

describe("query", () => {
  it("parses keys, negation and quotes", () => {
    assert.deepEqual(parseQuery('-tag:FIXME @onur #perf "two words" path:src'), [
      { negate: true, key: "tag", value: "FIXME" },
      { negate: false, key: "owner", value: "onur" },
      { negate: false, key: "label", value: "perf" },
      { negate: false, key: "text", value: "two words" },
      { negate: false, key: "path", value: "src" },
    ]);
  });

  it("filters by text, tag, path, label and owner", () => {
    assert.deepEqual(ids("old"), ["4"]);
    assert.deepEqual(ids("tag:FIXME,NotImplemented"), ["2", "3"]);
    assert.deepEqual(ids("-tag:TODO"), ["2", "3"]);
    assert.deepEqual(ids("path:web/"), ["2"]);
    assert.deepEqual(ids("#perf"), ["1"]);
    assert.deepEqual(ids("@ayşe"), ["4"]);
    assert.deepEqual(ids(""), ["1", "2", "3", "4"]);
  });

  it("supports is: filters", () => {
    assert.deepEqual(ids("is:mine"), ["1", "2"]);
    assert.deepEqual(ids("is:overdue"), ["1"]);
    assert.deepEqual(ids("is:due"), ["1"]);
    assert.deepEqual(ids("is:stale"), ["4"]);
    assert.deepEqual(ids("is:new"), ["2"]);
    assert.deepEqual(ids("is:code"), ["3"]);
    assert.equal(isMine(matches[3]!, context), false);
  });

  it("knows when blame is needed", () => {
    assert.equal(queryNeedsBlame("is:mine"), true);
    assert.equal(queryNeedsBlame("@onur"), true);
    assert.equal(queryNeedsBlame("tag:TODO is:overdue"), false);
  });

  it("sorts by age, due date and priority", () => {
    assert.deepEqual(sortMatches(matches, "age", context).map((item) => item.id).slice(0, 2), ["4", "2"]);
    assert.equal(sortMatches(matches, "due", context)[0]?.id, "1");
    assert.equal(sortMatches(matches, "priority", context)[0]?.id, "2");
  });

  it("formats ages", () => {
    assert.equal(ageInDays(blame("x", 3), NOW), 3);
    assert.equal(ageInDays(undefined, NOW), undefined);
    assert.equal(formatAge(0), "today");
    assert.equal(formatAge(9), "9d");
    assert.equal(formatAge(30), "4w");
    assert.equal(formatAge(200), "6mo");
    assert.equal(formatAge(800), "2y");
  });
});
