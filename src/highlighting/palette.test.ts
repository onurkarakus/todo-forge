import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "mocha";

import { highlightSpan } from "./rangePlan";
import { applyOpacity, BUILTIN_TAGS, COMMENT_MARKER_COLORS, contributedColors, hideFromTree, styleForTag } from "./palette";
import type { TodoMatch } from "../types";

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8")) as {
  contributes: { colors: { id: string; description: string; defaults: Record<string, string> }[] };
};

/** WCAG relative luminance contrast against white. */
const contrastOnWhite = (hex: string): number => {
  const channel = (value: number): number => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
  return 1.05 / (luminance + 0.05);
};

describe("palette", () => {
  it("matches the colors contributed in package.json", () => {
    assert.deepEqual(manifest.contributes.colors, contributedColors());
  });

  it("uses light-theme colors with at least 4.5:1 contrast on white", () => {
    for (const [tag, builtin] of Object.entries(BUILTIN_TAGS)) {
      assert.ok(contrastOnWhite(builtin.colors.light) >= 4.5, `${tag} ${builtin.colors.light}`);
    }
  });

  it("uses theme colors for built-in tags and fixed colors for overrides and custom tags", () => {
    assert.equal(styleForTag("TODO", ["TODO"], {}).themeKey, "todo");
    assert.equal(styleForTag("todo", ["TODO"], {}).themeKey, "todo");
    const override = styleForTag("TODO", ["TODO"], { TODO: { foreground: "#123456" } });
    assert.equal(override.themeKey, undefined);
    assert.equal(override.colors.light, "#123456");
    const custom = styleForTag("PERF", ["TODO", "PERF"], {});
    assert.equal(custom.themeKey, undefined);
    assert.equal(custom.icon, "circle");
    assert.notEqual(custom.colors.dark, custom.colors.light);
  });

  it("hides configured tags from the tree, case-insensitively", () => {
    assert.equal(hideFromTree("NOTE", { NOTE: { hideFromTree: true } }), true);
    assert.equal(hideFromTree("note", { NOTE: { hideFromTree: true } }), true);
    assert.equal(hideFromTree("TODO", { NOTE: { hideFromTree: true } }), false);
  });

  it("applies opacity to hex colors, including existing alpha", () => {
    assert.equal(applyOpacity("#ff0000", 0.5).toLowerCase(), "#ff000080");
    assert.equal(applyOpacity("#fff", 1).toLowerCase(), "#ffffff");
    assert.equal(applyOpacity("#FF000080", 0.5).toLowerCase(), "#ff000040");
  });

  it("uses light-theme marker colors with at least 4.5:1 contrast on white", () => {
    for (const [key, value] of Object.entries(COMMENT_MARKER_COLORS)) {
      assert.ok(contrastOnWhite(value.light) >= 4.5, `${key} ${value.light}`);
    }
  });
});

describe("highlight spans", () => {
  const match = {
    line: 2,
    column: 3,
    endColumn: 7,
    leadColumn: 0,
    lineLength: 20,
  } as TodoMatch;

  it("covers the tag, the following text, the comment or the whole line", () => {
    assert.deepEqual(highlightSpan(match, "tag"), { line: 2, start: 3, end: 7 });
    assert.deepEqual(highlightSpan(match, "text"), { line: 2, start: 3, end: 20 });
    assert.deepEqual(highlightSpan(match, "comment"), { line: 2, start: 0, end: 20 });
    assert.deepEqual(highlightSpan(match, "line"), { line: 2, start: 0, end: 20 });
  });
});
