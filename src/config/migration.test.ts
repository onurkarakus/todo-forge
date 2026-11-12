import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { DEFAULT_EXCLUDE_GLOBS, defaultSettings, settingsFromValues } from "./defaults";
import { mapBetterCommentsTags, mergeTags, parseRiderDotSettings, parseVisualStudioSettings } from "./importers";
import { mapTodoTreeSettings } from "./migration";
import { hideFromTree, styleForTag } from "../highlighting/palette";

describe("settings", () => {
  it("uses quiet .NET-aware defaults", () => {
    const settings = defaultSettings();
    assert.ok(settings.excludeGlobs.includes("**/bin/**"));
    assert.ok(settings.excludeGlobs.includes("**/*.designer.cs"));
    assert.ok(!settings.excludeGlobs.includes("**/packages/**"), "a source folder named packages must be scanned");
    assert.ok(settings.excludeGlobs.includes("**/packages/*.*.*/**"));
    assert.equal(settings.caseSensitive, true);
    assert.deepEqual(settings.strictTags, ["NOTE", "BUG", "REVIEW", "OPTIMIZE"]);
    assert.ok(settings.tags.includes("UNDONE"));
    assert.equal(settings.problemsEnabled, false);
    assert.equal(settings.aiEnabled, false);
    assert.equal(settings.chatTools, false);
    assert.equal(settings.codelensEnabled, false);
  });

  it("validates values and falls back on bad input", () => {
    const read = settingsFromValues({
      "general.tags": [],
      "tree.groupBy": "nonsense",
      "tree.sortBy": "priority",
      "regex.multilineMaxLines": 99,
      "problems.severity": { TODO: "hint", BAD: "loud" },
      "stale.afterDays": -4,
    });
    assert.equal(read.errors.length, 1);
    assert.ok(read.settings.tags.length > 0);
    assert.equal(read.settings.groupBy, "tag");
    assert.equal(read.settings.sortBy, "priority");
    assert.equal(read.settings.multilineMaxLines, 3);
    assert.deepEqual(read.settings.problemsSeverity, { TODO: "hint" });
    assert.equal(read.settings.staleAfterDays, 180);
    assert.deepEqual(read.settings.excludeGlobs, DEFAULT_EXCLUDE_GLOBS);
  });
});

describe("Todo Tree migration", () => {
  it("maps only the values it is given and adds the tag group to custom regexes", () => {
    const patch = mapTodoTreeSettings({
      tags: ["TODO", "HACK"],
      excludeGlobs: ["**/bin/**"],
      regex: "(//|#)\\s*($TAGS)",
      customHighlight: { TODO: { foreground: "#fff", icon: "not-a-real-icon" } },
    });
    assert.deepEqual(patch.values["general.tags"], ["TODO", "HACK"]);
    assert.equal(patch.values["regex.custom"], "(//|#)\\s*(?<tag>$TAGS)");
    assert.equal(patch.values["general.caseSensitive"], undefined);
    const read = settingsFromValues(patch.values);
    assert.deepEqual(read.settings.tags, ["TODO", "HACK"]);
    assert.equal(styleForTag("TODO", read.settings.tags, read.settings.tagStyles).icon, "checklist");
    assert.ok(patch.ignored.length > 0);
  });

  it("returns nothing when the user changed nothing", () => {
    assert.deepEqual(mapTodoTreeSettings({}).values, {});
  });

  it("converts Todo Tree tag groups", () => {
    const patch = mapTodoTreeSettings({ tagGroups: { Fixes: ["FIXME", "BUG"] } });
    assert.deepEqual(patch.values["general.tagGroups"], [{ name: "Fixes", tags: ["FIXME", "BUG"] }]);
  });

  it("maps ticket URLs and highlight knobs including hideFromTree", () => {
    const patch = mapTodoTreeSettings({
      subTagClickUrl: "https://jira.example.com/browse/${token}",
      customHighlight: {
        NOTE: { foreground: "#abc", hideFromTree: true, opacity: 0.5, iconColour: "#ignored-when-foreground-set" },
        HACK: { iconColour: "#123456", borderColor: "#000" },
      },
    });
    assert.equal(patch.values["general.ticketUrl"], "https://jira.example.com/browse/${token}");
    const styles = patch.values["highlighting.tags"] as Record<string, Record<string, unknown>>;
    assert.equal(styles.NOTE.foreground, "#abc");
    assert.equal(styles.NOTE.hideFromTree, true);
    assert.equal(styles.NOTE.opacity, 0.5);
    assert.equal(styles.HACK.foreground, "#123456");
    assert.equal(styles.HACK.border, "#000");
    const read = settingsFromValues(patch.values);
    assert.equal(hideFromTree("NOTE", read.settings.tagStyles), true);
    assert.equal(hideFromTree("note", read.settings.tagStyles), true);
  });
});

describe("IDE importers", () => {
  it("reads Rider TODO patterns", () => {
    const xml = `<wpf:ResourceDictionary xml:space="preserve" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:s="clr-namespace:System;assembly=mscorlib">
  <s:String x:Key="/Default/PatternsAndTemplates/Todo/TodoPatterns/=A1B2/Pattern/@EntryValue">(?&lt;=\\W|^)(?&lt;TAG&gt;REFACTOR)(\\W|$)(.*)</s:String>
  <s:String x:Key="/Default/PatternsAndTemplates/Todo/TodoPatterns/=A1B2/Name/@EntryValue">Refactor</s:String>
  <s:String x:Key="/Default/PatternsAndTemplates/Todo/TodoPatterns/=C3D4/Pattern/@EntryValue">(?&lt;=\\W|^)(?&lt;TAG&gt;TODO|PERF)(\\W|$)(.*)</s:String>
</wpf:ResourceDictionary>`;
    assert.deepEqual(parseRiderDotSettings(xml), ["REFACTOR", "TODO", "PERF"]);
  });

  it("reads Visual Studio task list tokens", () => {
    const xml = `<UserSettings><Category name="Environment_TaskList"><PropertyValue name="CommentTokens">"TODO":2,"HACK":2,"UNDONE":2,"UnresolvedMergeConflict":3,"REVIEW":1</PropertyValue></Category></UserSettings>`;
    assert.deepEqual(parseVisualStudioSettings(xml), ["TODO", "HACK", "UNDONE", "REVIEW"]);
    assert.deepEqual(parseVisualStudioSettings(`<PropertyValue name="CommentTokens">TODO:2;PERF:1</PropertyValue>`), ["TODO", "PERF"]);
  });

  it("merges tags without duplicates", () => {
    assert.deepEqual(mergeTags(["TODO", "FIXME"], ["todo", "HACK"]), ["TODO", "FIXME", "HACK"]);
  });
});

describe("Better Comments import", () => {
  it("maps markers and skips TODO words", () => {
    const mapped = mapBetterCommentsTags(
      [
        { tag: "!", color: "#FF2D00", bold: true },
        { tag: "?", color: "#3498DB" },
        { tag: "todo", color: "#FF8C00" },
        { tag: "//", strikethrough: true, color: "#474747" },
        { tag: "FIXME", color: "#red" },
      ],
      ["TODO", "FIXME"],
    );
    assert.deepEqual(
      mapped.markers.map((marker) => marker.tag),
      ["!", "?", "//"],
    );
    assert.equal(mapped.markers[0]?.bold, true);
    assert.deepEqual(mapped.ignored, ["todo", "FIXME"]);
  });
});
