import assert from "node:assert/strict";
import { describe, it } from "mocha";

import type { TodoMatch } from "../types";
import { fingerprint, isPinned, pinFromMatch, reorderPins, resolvePin } from "./pins";

const match = (line: number, text: string, tag = "TODO"): TodoMatch => ({
  id: `${line}`,
  uri: "file:///w/A.cs",
  relativePath: "A.cs",
  line,
  column: 3,
  endColumn: 7,
  leadColumn: 0,
  lineLength: 20,
  tag,
  text,
  raw: `// ${tag}: ${text}`,
  kind: "tag",
});

describe("pins", () => {
  it("follows a TODO when lines move", () => {
    const pin = pinFromMatch(match(10, "cache  results"));
    const moved = [match(2, "other"), match(14, "Cache results"), match(40, "cache results")];
    assert.equal(resolvePin(pin, moved)?.line, 14);
    assert.ok(isPinned([pin], match(99, "cache results")));
  });

  it("falls back to the same line when the text changed", () => {
    const pin = pinFromMatch(match(10, "cache"));
    assert.equal(resolvePin(pin, [match(10, "cache everything")])?.text, "cache everything");
    assert.equal(resolvePin(pin, [match(11, "unrelated")]), undefined);
  });

  it("reorders by drag and drop", () => {
    const pins = ["a", "b", "c"].map((text, index) => ({ ...pinFromMatch(match(index, text)), id: text }));
    assert.deepEqual(reorderPins(pins, "c", "a").map((pin) => pin.id), ["c", "a", "b"]);
    assert.deepEqual(reorderPins(pins, "a", undefined).map((pin) => pin.id), ["b", "c", "a"]);
    assert.deepEqual(reorderPins(pins, "zzz", "a").map((pin) => pin.id), ["a", "b", "c"]);
  });

  it("builds stable fingerprints", () => {
    assert.equal(fingerprint(match(1, "A  b")), fingerprint(match(9, "a b")));
    assert.notEqual(fingerprint(match(1, "a")), fingerprint(match(1, "a", "FIXME")));
  });
});
