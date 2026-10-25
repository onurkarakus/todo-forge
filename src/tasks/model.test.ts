import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "mocha";

import type { TodoMatch, TrackedTask } from "../types";
import { readTaskFile, taskFilePath, writeTaskFile } from "./fileStore";
import { tasksToMarkdown } from "./markdownExport";
import {
  applyDraft,
  findTaskForMatch,
  isDueDate,
  reorderTasks,
  sortTasks,
  taskFromMatch,
  toggleTaskDone,
} from "./model";
import { replaceTagOnLine, toggleCheckboxLine } from "./sourceEdit";

const task = (overrides: Partial<TrackedTask>): TrackedTask => {
  return {
    id: overrides.id ?? "t1",
    title: overrides.title ?? "Item",
    priority: overrides.priority ?? "medium",
    dueDate: overrides.dueDate,
    note: overrides.note ?? "",
    done: overrides.done ?? false,
    order: overrides.order ?? 0,
    subtasks: overrides.subtasks ?? [],
    sources: overrides.sources ?? [],
  };
};

describe("tasks", () => {
  it("sorts by done, priority, then order", () => {
    const sorted = sortTasks([
      task({ id: "low", priority: "low", order: 0 }),
      task({ id: "done", done: true, priority: "high", order: 0 }),
      task({ id: "high", priority: "high", order: 2 }),
      task({ id: "high-first", priority: "high", order: 1 }),
    ]);
    assert.deepEqual(
      sorted.map((item) => item.id),
      ["high-first", "high", "low", "done"],
    );
  });

  it("reorders and rejects a bad due date", () => {
    const next = reorderTasks(
      [task({ id: "a", order: 0 }), task({ id: "b", order: 1 }), task({ id: "c", order: 2 })],
      "c",
      "a",
    );
    assert.equal(next[0]?.id, "c");
    assert.equal(isDueDate("2026-10-26"), true);
    assert.equal(isDueDate("26-10-2026"), false);
    const updated = applyDraft(task({}), {
      title: "Ship",
      priority: "high",
      dueDate: "tomorrow",
      note: "line",
      subtasks: [],
    });
    assert.match(updated.error ?? "", /YYYY-MM-DD/);
  });

  it("round-trips a task file", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "todoforge-"));
    const file = taskFilePath(directory);
    const match: TodoMatch = {
      id: "m",
      uri: "file:///src/A.cs",
      relativePath: "src/A.cs",
      line: 4,
      column: 3,
      endColumn: 7,
      leadColumn: 0,
      lineLength: 20,
      tag: "TODO",
      text: "cache",
      raw: "// TODO: cache",
      kind: "tag",
    };
    await writeTaskFile(file, [taskFromMatch(match, 0)]);
    const loaded = await readTaskFile(file);
    const created = taskFromMatch(match, 0);
    assert.equal(findTaskForMatch([created], match)?.id, created.id);
    assert.equal(findTaskForMatch([created], { ...match, line: 9 }), undefined);
    assert.equal(loaded.tasks[0]?.title, "cache");
    assert.equal(loaded.tasks[0]?.sources[0]?.line, 4);
    const broken = await readTaskFile(path.join(directory, "missing.json"));
    assert.deepEqual(broken.tasks, []);
  });

  it("exports markdown and edits source lines", () => {
    const done = toggleTaskDone([task({ title: "Ship", priority: "high", dueDate: "2026-10-27" })], "t1");
    const markdown = tasksToMarkdown(done);
    assert.match(markdown, /- \[x\] Ship \(due 2026-10-27\) — high/);
    assert.equal(replaceTagOnLine("// TODO: cache", "TODO", 3), "// DONE: cache");
    assert.equal(replaceTagOnLine("no tag", "TODO", 0), undefined);
    assert.equal(toggleCheckboxLine("- [ ] docs"), "- [x] docs");
    assert.equal(toggleCheckboxLine("- [x] docs"), "- [ ] docs");
  });
});
