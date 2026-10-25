import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { defaultSettings, settingsFromValues } from "./defaults";
import { mapTodoTreeSettings } from "./migration";
import { styleForTag } from "../highlighting/palette";

describe("settings and migration", () => {
  it("uses .NET exclude defaults", () => {
    const settings = defaultSettings();
    assert.ok(settings.excludeGlobs.includes("**/bin/**"));
    assert.ok(settings.excludeGlobs.includes("**/*.designer.cs"));
    assert.equal(settings.groupBy, "tag");
    assert.equal(settings.tasksStorage, "workspaceState");
  });

  it("maps supported Todo Tree settings", () => {
    const patch = mapTodoTreeSettings({
      tags: ["TODO", "HACK"],
      excludeGlobs: ["**/bin/**"],
      regex: "//\\s*$TAGS",
      customHighlight: { TODO: { foreground: "#fff", icon: "not-a-real-icon" } },
    });
    assert.deepEqual(patch.values["general.tags"], ["TODO", "HACK"]);
    const read = settingsFromValues(patch.values);
    assert.deepEqual(read.settings.tags, ["TODO", "HACK"]);
    assert.equal(styleForTag("TODO", 0, read.settings.tagStyles).icon, "checklist");
    assert.ok(patch.ignored.length > 0);
  });
});
