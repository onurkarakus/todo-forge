/**
 * Comment and string syntax per file extension. The scanner uses it to tell a
 * tag inside a comment from the same word inside a string literal.
 */
export interface CommentSyntax {
  /** Tokens that start a comment running to the end of the line. */
  line: readonly string[];
  /** Block comment open and close tokens. */
  block: readonly (readonly [string, string])[];
  /** Characters that open and close a string literal. */
  strings: readonly string[];
  /** Token used when TodoForge inserts a new comment. */
  insert: string;
  /** Close token appended when the insert token is a block opener. */
  insertClose?: string;
}

const C_LIKE: CommentSyntax = {
  line: ["//"],
  block: [["/*", "*/"]],
  strings: ['"', "'", "`"],
  insert: "//",
};

const CSHARP: CommentSyntax = {
  line: ["//", "#warning", "#error"],
  block: [["/*", "*/"]],
  strings: ['"', "'"],
  insert: "//",
};

const HASH: CommentSyntax = { line: ["#"], block: [], strings: ['"', "'"], insert: "#" };

const MARKUP: CommentSyntax = {
  line: [],
  block: [["<!--", "-->"]],
  strings: [],
  insert: "<!--",
  insertClose: " -->",
};

const COMPONENT: CommentSyntax = {
  line: ["//"],
  block: [
    ["{/*", "*/}"],
    ["/*", "*/"],
    ["<!--", "-->"],
  ],
  strings: ['"', "`"],
  insert: "//",
};

const RAZOR: CommentSyntax = {
  line: ["//"],
  block: [
    ["@*", "*@"],
    ["<!--", "-->"],
    ["/*", "*/"],
  ],
  strings: ['"'],
  insert: "@*",
  insertClose: " *@",
};

const SQL: CommentSyntax = { line: ["--"], block: [["/*", "*/"]], strings: ["'"], insert: "--" };
const VB: CommentSyntax = { line: ["'", "REM "], block: [], strings: ['"'], insert: "'" };
const FSHARP: CommentSyntax = { line: ["//"], block: [["(*", "*)"]], strings: ['"'], insert: "//" };
const PERCENT: CommentSyntax = { line: ["%"], block: [], strings: [], insert: "%" };
const SEMICOLON: CommentSyntax = { line: [";"], block: [], strings: ['"'], insert: ";" };
const LUA: CommentSyntax = { line: ["--"], block: [["--[[", "]]"]], strings: ['"', "'"], insert: "--" };
const HASKELL: CommentSyntax = { line: ["--"], block: [["{-", "-}"]], strings: ['"'], insert: "--" };
const CSS: CommentSyntax = { line: [], block: [["/*", "*/"]], strings: ['"', "'"], insert: "/*", insertClose: " */" };
const SCSS: CommentSyntax = { line: ["//"], block: [["/*", "*/"]], strings: ['"', "'"], insert: "//" };
const POWERSHELL: CommentSyntax = { line: ["#"], block: [["<#", "#>"]], strings: ['"', "'"], insert: "#" };
const BATCH: CommentSyntax = { line: ["REM ", "rem ", "::"], block: [], strings: [], insert: "REM" };
const INI: CommentSyntax = { line: [";", "#"], block: [], strings: ['"'], insert: ";" };
const PHP: CommentSyntax = { line: ["//", "#"], block: [["/*", "*/"]], strings: ['"', "'"], insert: "//" };

const BY_EXTENSION: Record<string, CommentSyntax> = {};

const register = (syntax: CommentSyntax, extensions: string): void => {
  for (const extension of extensions.split(" ")) {
    BY_EXTENSION[extension] = syntax;
  }
};

register(
  C_LIKE,
  "js mjs cjs ts mts cts java kt kts go rs swift c h cc cpp cxx hpp hh m mm scala dart groovy gradle cjsx json jsonc json5 proto zig v sol",
);
register(COMPONENT, "jsx tsx vue svelte astro mdx");
register(CSHARP, "cs csx");
register(RAZOR, "cshtml razor");
register(VB, "vb vbs bas");
register(FSHARP, "fs fsi fsx ml mli");
register(
  HASH,
  "py pyi rb sh bash zsh fish yaml yml toml r pl pm cmake mk dockerfile tf hcl nix ex exs cr coffee conf gitignore env",
);
register(MARKUP, "html htm xml xaml axaml csproj vbproj fsproj props targets config resx nuspec svg md markdown plist");
register(SQL, "sql psql");
register(PERCENT, "tex sty cls bib dtx ltx erl hrl");
register(SEMICOLON, "clj cljs cljc edn lisp el scm asm s");
register(LUA, "lua");
register(HASKELL, "hs elm purs");
register(CSS, "css");
register(SCSS, "scss less styl");
register(POWERSHELL, "ps1 psm1 psd1");
register(BATCH, "bat cmd");
register(PHP, "php");
register(INI, "ini properties cfg editorconfig");

const SPECIAL_FILES: Record<string, CommentSyntax> = {
  dockerfile: HASH,
  makefile: HASH,
  gemfile: HASH,
  rakefile: HASH,
  "cmakelists.txt": HASH,
};

export const extensionOf = (filePath: string): string => {
  const slash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  const name = filePath.slice(slash + 1).toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? name : name.slice(dot + 1);
};

/** Returns the syntax for a path, or undefined when the language is unknown. */
export const syntaxFor = (filePath: string): CommentSyntax | undefined => {
  const slash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  const name = filePath.slice(slash + 1).toLowerCase();
  const special = SPECIAL_FILES[name];
  if (special) {
    return special;
  }
  return BY_EXTENSION[extensionOf(filePath)];
};

export const isDotnetFile = (filePath: string): boolean => {
  return ["cs", "csx", "vb", "fs", "fsx", "cshtml", "razor"].includes(extensionOf(filePath));
};
