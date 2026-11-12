import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { syntaxFor } from "../syntax/languages";
import {
  collectCommentMarkers,
  DEFAULT_COMMENT_MARKERS,
  findMarkerOnLine,
  lineStartsWithTag,
} from "./commentMarkers";

const syntax = syntaxFor("file.ts");
const python = syntaxFor("file.py");
const tags = ["TODO", "FIXME", "HACK", "BUG", "NOTE"];

describe("comment markers", () => {
  it("finds Better Comments defaults after a line comment", () => {
    const alert = findMarkerOnLine("  // ! watch this", syntax, DEFAULT_COMMENT_MARKERS, tags, true);
    assert.equal(alert?.marker.tag, "!");
    assert.equal(alert?.start, "  // ".length);
    assert.equal(alert?.end, "  // ! watch this".length);
    assert.equal(alert?.closed, true);

    const question = findMarkerOnLine("// ? why", syntax, DEFAULT_COMMENT_MARKERS, tags, true);
    assert.equal(question?.marker.tag, "?");

    const highlight = findMarkerOnLine("/* * keep this */", syntax, DEFAULT_COMMENT_MARKERS, tags, true);
    assert.equal(highlight?.marker.tag, "*");
    assert.equal(highlight?.closed, true);
    assert.ok((highlight?.end ?? 0) < "/* * keep this */".length);

    const struck = findMarkerOnLine("  //// obsolete", syntax, DEFAULT_COMMENT_MARKERS, tags, true);
    assert.equal(struck?.marker.tag, "//");
    assert.equal(struck?.marker.strikethrough, true);
  });

  it("respects hash and other comment syntax", () => {
    const hit = findMarkerOnLine("# ! alert", python, DEFAULT_COMMENT_MARKERS, tags, true);
    assert.equal(hit?.marker.tag, "!");
  });

  it("ignores markers inside strings", () => {
    const hit = findMarkerOnLine('const hint = "// ! not a comment";', syntax, DEFAULT_COMMENT_MARKERS, tags, true);
    assert.equal(hit, undefined);
  });

  it("does not decorate a comment whose marker is followed by a TODO tag", () => {
    assert.equal(findMarkerOnLine("// ! TODO: still a todo", syntax, DEFAULT_COMMENT_MARKERS, tags, true), undefined);
    assert.equal(findMarkerOnLine("// !FIXME: x", syntax, DEFAULT_COMMENT_MARKERS, tags, true), undefined);
  });

  it("does not treat a TODO comment as a marker", () => {
    assert.equal(findMarkerOnLine("// TODO: write tests", syntax, DEFAULT_COMMENT_MARKERS, tags, true), undefined);
  });

  it("keeps a block-comment marker on later lines when multiline is on", () => {
    const lines = ["/* ! careful", " * still the alert", " * and more", " */", "const x = 1;"];
    const spans = collectCommentMarkers(lines, 0, 4, syntax, DEFAULT_COMMENT_MARKERS, {
      multiline: true,
      todoTags: tags,
      caseSensitive: true,
    });
    assert.equal(spans.length, 3);
    assert.equal(spans[0]?.marker.tag, "!");
    assert.equal(spans[1]?.line, 1);
    assert.equal(spans[1]?.marker.tag, "!");
    assert.equal(spans[2]?.line, 2);
  });

  it("does not continue a marker past the block close or when multiline is off", () => {
    const lines = ["/* ! careful", " * still"];
    const off = collectCommentMarkers(lines, 0, 1, syntax, DEFAULT_COMMENT_MARKERS, {
      multiline: false,
      todoTags: tags,
      caseSensitive: true,
    });
    assert.equal(off.length, 1);
  });

  it("detects a TODO tag after a marker", () => {
    assert.equal(lineStartsWithTag(" TODO: x", tags, true), true);
    assert.equal(lineStartsWithTag(" note that", tags, true), false);
    assert.equal(lineStartsWithTag(" todo: x", tags, false), true);
  });
});
