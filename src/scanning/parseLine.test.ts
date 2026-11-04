import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { DEFAULT_STRICT_TAGS, DEFAULT_SUBTAG_REGEX, DEFAULT_TAGS } from "../config/defaults";
import { compileMatcher } from "../utils/regexBuilder";
import { compileParseOptions, parseLine, parseLines, type ParseOptions } from "./parseLine";

const options = (overrides: Partial<ParseOptions> = {}): ParseOptions => {
  return {
    tags: DEFAULT_TAGS,
    strictTags: DEFAULT_STRICT_TAGS,
    caseSensitive: true,
    customRegex: "",
    subTagRegex: DEFAULT_SUBTAG_REGEX,
    markdownEnabled: true,
    multiline: false,
    multilineMaxLines: 3,
    dotnetPatterns: true,
    ...overrides,
  };
};

const parse = (line: string, file = "src/A.cs", overrides: Partial<ParseOptions> = {}) => {
  const parsed = options(overrides);
  const compiled = compileParseOptions(parsed);
  return parseLine(line, 0, { uri: `file:///w/${file}`, relativePath: file }, compiled.matcher, parsed);
};

describe("parseLine", () => {
  it("matches the comment matrix across languages", () => {
    const cases: { line: string; file: string; tag: string; text: string; subTag?: string }[] = [
      { line: "// TODO: implement caching", file: "A.cs", tag: "TODO", text: "implement caching" },
      { line: "//TODO implement", file: "A.cs", tag: "TODO", text: "implement" },
      { line: "/// TODO: fix the xml doc", file: "A.cs", tag: "TODO", text: "fix the xml doc" },
      { line: "/* FIXME: broken */", file: "a.ts", tag: "FIXME", text: "broken" },
      { line: " * HACK: temporary", file: "a.java", tag: "HACK", text: "temporary" },
      { line: "# NOTE: python", file: "a.py", tag: "NOTE", text: "python" },
      { line: "-- BUG: sql", file: "a.sql", tag: "BUG", text: "sql" },
      { line: "<!-- REVIEW: html -->", file: "a.html", tag: "REVIEW", text: "html" },
      { line: "' TODO: vb comment", file: "a.vb", tag: "TODO", text: "vb comment" },
      { line: "(* OPTIMIZE: fsharp *)", file: "a.fs", tag: "OPTIMIZE", text: "fsharp" },
      { line: "@* TODO: razor *@", file: "a.cshtml", tag: "TODO", text: "razor" },
      { line: "% TODO: cite this", file: "paper.tex", tag: "TODO", text: "cite this" },
      { line: "  {/* TODO: split component */}", file: "a.tsx", tag: "TODO", text: "split component" },
      { line: "<!-- FIXME: aria label -->", file: "a.vue", tag: "FIXME", text: "aria label" },
      { line: "<!-- TODO: slot -->", file: "a.svelte", tag: "TODO", text: "slot" },
      { line: "// TODO: frontmatter", file: "a.astro", tag: "TODO", text: "frontmatter" },
      { line: "; XXX: ini", file: "a.ini", tag: "XXX", text: "ini" },
      { line: "// FIXME@urgent: fix this", file: "A.cs", tag: "FIXME", text: "fix this", subTag: "urgent" },
      { line: "// TODO: #123 ship it", file: "A.cs", tag: "TODO", text: "ship it", subTag: "123" },
      { line: "# UNDONE: rollback", file: "a.sh", tag: "UNDONE", text: "rollback" },
    ];
    for (const entry of cases) {
      const matches = parse(entry.line, entry.file);
      assert.equal(matches.length, 1, `${entry.file}: ${entry.line}`);
      assert.equal(matches[0]?.tag, entry.tag, entry.line);
      assert.equal(matches[0]?.text, entry.text, entry.line);
      assert.equal(matches[0]?.subTag, entry.subTag, entry.line);
      assert.equal(matches[0]?.kind, "tag");
    }
  });

  it("skips identifiers, strings and other languages' comment tokens", () => {
    assert.deepEqual(parse("var todoList = 1;"), []);
    assert.deepEqual(parse("var myTodo = 2;"), []);
    assert.deepEqual(parse('var s = "TODO: nope";'), []);
    assert.deepEqual(parse("var s = $\"// TODO: {x}\";"), []);
    assert.deepEqual(parse("const url = 'http://x/TODO';", "a.ts"), []);
    assert.deepEqual(parse("# TODO: not a comment in C#", "A.cs"), []);
    assert.deepEqual(parse("const t = `// TODO: template`;", "a.ts"), []);
  });

  it("finds a comment after a string with an apostrophe-like quote", () => {
    const found = parse("var s = \"don't\"; // TODO: after string", "A.cs");
    assert.equal(found[0]?.text, "after string");
  });

  it("requires a colon for strict prose words", () => {
    assert.deepEqual(parse("# Note that this is fine", "a.py"), []);
    assert.deepEqual(parse("// NOTE this is prose", "A.cs"), []);
    assert.equal(parse("// NOTE: keep in sync", "A.cs")[0]?.tag, "NOTE");
    assert.equal(parse("// BUG(onur): crash", "A.cs")[0]?.tag, "BUG");
  });

  it("accepts mid-comment tags only in exact case or with a colon", () => {
    assert.equal(parse("x(); // remove this TODO later", "A.cs")[0]?.tag, "TODO");
    assert.deepEqual(parse("x(); // the todo list", "A.cs"), []);
  });

  it("parses inline metadata", () => {
    const found = parse("// TODO(onur, 2026-12-01, !high, #perf): cache it", "A.cs")[0];
    assert.equal(found?.text, "cache it");
    assert.deepEqual(found?.meta, { owner: "onur", due: "2026-12-01", priority: "high", labels: ["perf"] });
    assert.deepEqual(parse("// FIXME(@ayse): x", "A.cs")[0]?.meta, { owner: "ayse", labels: [] });
  });

  it("reports .NET code patterns in C# files", () => {
    const thrown = parse("    throw new NotImplementedException();", "A.cs");
    assert.equal(thrown[0]?.tag, "NotImplemented");
    assert.equal(thrown[0]?.kind, "code");
    assert.equal(parse('[Obsolete("Use Foo")]', "A.cs")[0]?.tag, "Obsolete");
    assert.equal(parse("#warning check this", "A.cs")[0]?.tag, "Warning");
    assert.deepEqual(parse("throw new NotImplementedException();", "a.ts"), []);
    assert.deepEqual(parse("throw new NotImplementedException();", "A.cs", { dotnetPatterns: false }), []);
    const both = parse("#warning TODO: wire this", "A.cs");
    assert.deepEqual(
      both.map((match) => match.tag),
      ["TODO"],
    );
  });

  it("reads markdown checklists and plain text notes", () => {
    const open = parse("- [ ] write docs", "notes.md");
    assert.equal(open[0]?.kind, "markdown");
    assert.equal(open[0]?.markdownChecked, false);
    assert.equal(open[0]?.text, "write docs");
    assert.equal(parse("- [x] done", "notes.md")[0]?.markdownChecked, true);
    assert.equal(parse("1. [ ] numbered item", "notes.md")[0]?.text, "numbered item");
    assert.deepEqual(parse("- [ ] write docs", "notes.md", { markdownEnabled: false }), []);
    assert.equal(parse("TODO: ship the release notes", "notes.md")[0]?.tag, "TODO");
    assert.deepEqual(parse("Our TODO list is long", "notes.md"), []);
  });

  it("rejects an invalid custom regex and keeps the built-in matcher", () => {
    const compiled = compileMatcher(DEFAULT_TAGS, false, "(");
    assert.equal(compiled.custom, false);
    assert.match(compiled.error ?? "", /rejected/i);
    assert.equal(parse("// TODO: still works", "A.cs", { customRegex: "(" })[0]?.tag, "TODO");
  });

  it("supports custom regexes with and without a tag group", () => {
    assert.equal(parse("REM TODO: batch", "a.txt2", { customRegex: "REM\\s+($TAGS)" })[0]?.tag, "TODO");
    assert.equal(parse("REM TODO: batch", "a.txt2", { customRegex: "REM\\s+(?:$TAGS)" })[0]?.tag, "TODO");
    assert.deepEqual(parse("ZZ TODO: custom only", "src/Extra.cs"), []);
    assert.equal(parse("ZZ TODO: custom only", "src/Extra.cs", { customRegex: "ZZ\\s+($TAGS)" })[0]?.tag, "TODO");
  });

  it("honors case sensitivity", () => {
    assert.equal(parse("// todo: lower").length, 0);
    assert.equal(parse("// todo: lower", "A.cs", { caseSensitive: false })[0]?.tag, "TODO");
    assert.equal(parse("// TODO: upper")[0]?.tag, "TODO");
  });

  it("joins continuation lines in multiline mode", () => {
    const parsed = options({ multiline: true });
    const compiled = compileParseOptions(parsed);
    const lines = ["// TODO: first part", "// second part", "int x = 1;"];
    const found = parseLines(lines, 0, { uri: "file:///w/A.cs", relativePath: "A.cs" }, compiled.matcher, parsed);
    assert.equal(found.length, 1);
    assert.equal(found[0]?.text, "first part second part");
  });
});
