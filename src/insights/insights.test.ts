import assert from "node:assert/strict";
import { describe, it } from "mocha";

import type { TodoMatch } from "../types";
import { buildInsights } from "./model";
import { escapeHtml, renderInsightsHtml, type InsightsStrings } from "./render";

const NOW = Date.UTC(2026, 10, 3) / 1000;

const match = (id: string, overrides: Partial<TodoMatch> = {}): TodoMatch => ({
  id,
  uri: `file:///w/${overrides.relativePath ?? "src/a/A.cs"}`,
  relativePath: "src/a/A.cs",
  line: Number(id),
  column: 0,
  endColumn: 4,
  leadColumn: 0,
  lineLength: 10,
  tag: "TODO",
  text: `item ${id}`,
  raw: "",
  kind: "tag",
  ...overrides,
});

const strings = Object.fromEntries(
  ["title", "total", "files", "overdue", "stale", "newOnBranch", "byTag", "byFolder", "byOwner", "ages", "agesUnavailable", "overdueList", "oldestList", "empty", "privacy"].map((key) => [key, key]),
) as unknown as InsightsStrings;

describe("insights", () => {
  const matches = [
    match("1", { meta: { due: "2026-10-01", labels: [] } }),
    match("2", { tag: "FIXME", relativePath: "web/x.ts", meta: { owner: "ayse", labels: [] } }),
    match("3", { text: "<script>alert(1)</script>" }),
  ];

  it("aggregates counts, overdue items and ages", () => {
    const data = buildInsights({
      matches,
      today: "2026-11-03",
      nowSeconds: NOW,
      staleAfterDays: 180,
      blameOf: (item) =>
        item.id === "3"
          ? { sha: "a".repeat(40), author: "Onur", email: "", time: NOW - 400 * 86400, summary: "", uncommitted: false }
          : undefined,
      isNew: (item) => item.id === "2",
      ageLabels: ["a", "b", "c", "d", "e", "f"],
      formatAge: (days) => `${days}d`,
    });
    assert.equal(data.total, 3);
    assert.equal(data.files, 2);
    assert.equal(data.overdueCount, 1);
    assert.equal(data.staleCount, 1);
    assert.equal(data.newCount, 1);
    assert.deepEqual(data.byTag, [
      ["TODO", 2],
      ["FIXME", 1],
    ]);
    assert.deepEqual(data.byOwner, [
      ["ayse", 1],
      ["Onur", 1],
    ]);
    assert.equal(data.ages?.[5]?.count, 1);
    assert.equal(data.oldest[0]?.detail, "400d");
  });

  it("renders a self-contained, escaped page with a strict CSP", () => {
    const data = buildInsights({
      matches,
      today: "2026-11-03",
      nowSeconds: NOW,
      staleAfterDays: 180,
      blameOf: () => undefined,
      isNew: () => false,
      ageLabels: [],
      formatAge: String,
    });
    assert.equal(data.ages, undefined);
    const html = renderInsightsHtml(data, strings, { nonce: "abc", cspSource: "vscode-resource:" });
    assert.match(html, /default-src 'none'/);
    assert.match(html, /script-src 'nonce-abc'/);
    assert.doesNotMatch(html, /https?:\/\//);
    assert.doesNotMatch(html, /<script>alert/);
    // Inline style attributes would be blocked by the CSP; sizes are classes.
    assert.doesNotMatch(html, /style="/);
    assert.match(html, /class="bar blue w100"/);
    assert.match(html, /\.w100\{width:100%\}/);
    assert.equal(escapeHtml(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  });

  it("renders an empty state", () => {
    const empty = buildInsights({
      matches: [],
      today: "2026-11-03",
      nowSeconds: NOW,
      staleAfterDays: 180,
      blameOf: () => undefined,
      isNew: () => false,
      ageLabels: [],
      formatAge: String,
    });
    assert.match(renderInsightsHtml(empty, strings, { nonce: "n", cspSource: "x" }), /class="empty"/);
  });
});
