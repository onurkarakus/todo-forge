import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { DEFAULT_SUBTAG_REGEX, DEFAULT_TAGS } from "../config/defaults";
import { compileMatcher } from "../utils/regexBuilder";
import { compileParseOptions, parseLine, type ParseOptions } from "./parseLine";

const location = { uri: "file:///src/A.cs", relativePath: "src/A.cs" };

const options = (overrides: Partial<ParseOptions> = {}): ParseOptions => {
  return {
    tags: DEFAULT_TAGS,
    caseSensitive: false,
    customRegex: "",
    subTagRegex: DEFAULT_SUBTAG_REGEX,
    markdownEnabled: true,
    multiline: false,
    multilineMaxLines: 3,
    ...overrides,
  };
};

const parse = (line: string, overrides: Partial<ParseOptions> = {}) => {
  const parsed = options(overrides);
  const compiled = compileParseOptions(parsed);
  return parseLine(line, 0, location, compiled.matcher, parsed);
};

describe("parseLine", () => {
  it("matches the comment matrix", () => {
    const cases: { line: string; tag: string; text: string; subTag?: string }[] = [
      { line: "// TODO: implement caching", tag: "TODO", text: "implement caching" },
      { line: "//TODO implement", tag: "TODO", text: "implement" },
      { line: "/// TODO: fix the xml doc", tag: "TODO", text: "fix the xml doc" },
      { line: "/* FIXME: broken */", tag: "FIXME", text: "broken" },
      { line: " * HACK: temporary", tag: "HACK", text: "temporary" },
      { line: "# NOTE: python", tag: "NOTE", text: "python" },
      { line: "-- BUG: sql", tag: "BUG", text: "sql" },
      { line: "<!-- REVIEW: html -->", tag: "REVIEW", text: "html" },
      { line: "' TODO: vb comment", tag: "TODO", text: "vb comment" },
      { line: "// OPTIMIZE: fsharp", tag: "OPTIMIZE", text: "fsharp" },
      { line: "@* TODO: razor *@", tag: "TODO", text: "razor" },
      { line: "FIXME@urgent: fix this", tag: "FIXME", text: "fix this", subTag: "urgent" },
      { line: "TODO: #123 ship it", tag: "TODO", text: "ship it", subTag: "123" },
    ];

    for (const entry of cases) {
      const matches = parse(entry.line);
      assert.equal(matches.length, 1, entry.line);
      assert.equal(matches[0]?.tag, entry.tag, entry.line);
      assert.equal(matches[0]?.text, entry.text, entry.line);
      assert.equal(matches[0]?.subTag, entry.subTag, entry.line);
      assert.equal(matches[0]?.kind, "tag");
    }
  });

  it("skips identifiers and strings", () => {
    assert.deepEqual(parse("var todoList = 1;"), []);
    assert.deepEqual(parse("var myTodo = 2;"), []);
    assert.deepEqual(parse('var s = "TODO: nope";'), []);
  });

  it("reads markdown checklists", () => {
    const open = parse("- [ ] write docs");
    assert.equal(open[0]?.kind, "markdown");
    assert.equal(open[0]?.markdownChecked, false);
    assert.equal(open[0]?.text, "write docs");

    const done = parse("- [x] done");
    assert.equal(done[0]?.markdownChecked, true);
    assert.equal(parse("* [ ] star item")[0]?.text, "star item");
    assert.equal(parse("1. [ ] numbered item")[0]?.text, "numbered item");
    assert.deepEqual(parse("- [ ] write docs", { markdownEnabled: false }), []);
  });

  it("rejects an invalid custom regex and keeps the built-in matcher", () => {
    const compiled = compileMatcher(DEFAULT_TAGS, false, "(");
    assert.equal(compiled.custom, false);
    assert.match(compiled.error ?? "", /rejected/i);
    const matches = parse("// TODO: still works", { customRegex: "(" });
    assert.equal(matches[0]?.tag, "TODO");
  });

  it("honors case sensitivity", () => {
    assert.equal(parse("// todo: lower", { caseSensitive: true }).length, 0);
    assert.equal(parse("// TODO: upper", { caseSensitive: true })[0]?.tag, "TODO");
  });
});
