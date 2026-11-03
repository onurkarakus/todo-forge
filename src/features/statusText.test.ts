import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { dueHint, hintText } from "../highlighting/hints";
import type { TodoMatch } from "../types";
import { statusText, summarize } from "./statusText";

const match = (uri: string, tag: string, due?: string): TodoMatch => ({
  id: `${uri}${tag}${due}`,
  uri,
  relativePath: uri,
  line: 0,
  column: 0,
  endColumn: 4,
  leadColumn: 0,
  lineLength: 4,
  tag,
  text: "",
  raw: "",
  kind: "tag",
  meta: due ? { due, labels: [] } : undefined,
});

describe("status bar and hints", () => {
  const all = [match("a", "TODO", "2026-11-01"), match("a", "FIXME"), match("b", "TODO")];

  it("summarizes the file and workspace", () => {
    const summary = summarize(all, "a", "2026-11-03");
    assert.equal(summary.fileCount, 2);
    assert.equal(summary.total, 3);
    assert.equal(summary.overdue, 1);
    assert.equal(statusText(summary, "compact", false), "$(checklist) 2/3 $(warning) 1");
    assert.equal(statusText(summary, "perTag", true), "$(sync~spin) TODO 2  FIXME 1 $(warning) 1");
    assert.equal(statusText(summarize(all, "zzz", "2026-01-01"), "compact", false), "$(checklist) 3");
  });

  it("describes due dates", () => {
    const strings = {
      overdue: (days: number) => `overdue ${days}d`,
      today: "today",
      dueIn: (days: number) => `in ${days}d`,
      priority: (priority: string) => `!${priority}`,
    };
    assert.deepEqual(dueHint(match("a", "TODO", "2026-11-01"), "2026-11-03"), { tone: "overdue", days: -2 });
    assert.equal(dueHint(match("a", "TODO", "2026-11-20"), "2026-11-03")?.tone, "later");
    assert.equal(hintText(match("a", "TODO", "2026-11-05"), "2026-11-03", strings), "in 2d");
    assert.equal(hintText(match("a", "TODO"), "2026-11-03", strings), undefined);
  });
});
