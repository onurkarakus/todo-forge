# TODO syntax

## Tags

Default tags: `TODO FIXME HACK BUG XXX UNDONE NOTE REVIEW OPTIMIZE` (`todoforge.general.tags`). Matching is case-sensitive by default (`todoforge.general.caseSensitive`).

Strict tags (`todoforge.general.strictTags`, default `NOTE BUG REVIEW OPTIMIZE`) are common English words, so they only count when followed by `:` or `(`:

```ts
// NOTE: counted
// Note that this is prose: not counted
// BUG(ayse): counted
```

A tag must be inside a comment for the file's language. These are **not** TODOs:

```ts
const todoList = [];          // identifier
log("TODO: later");          // string
```

## Inline metadata

Everything in parentheses is optional and can come in any order, separated by commas or spaces:

```
TAG(owner, YYYY-MM-DD, !priority, #label, #label2): text
```

| Part | Forms | Notes |
| --- | --- | --- |
| owner | `onur`, `@onur` | first bare word; `@` optional |
| due date | `2026-12-01` | ISO date; overdue turns red, within 7 days shows "due in Nd" |
| priority | `!high`, `!medium`, `!low` (also `!h`, `!m`, `!l`, `!1`–`!3`) | used by sort and the hint |
| labels | `#perf`, `#a11y` | filter with `#perf`; `#123` stays a sub-tag (issue number) |

Examples:

```csharp
// TODO(onur, 2026-12-01, !high, #perf): cache the price lookup
// FIXME(@ayse): null check before Save()
// HACK(2026-11-15): remove after the API fix ships
```

```html
<!-- TODO(mehmet, #a11y): announce total changes to screen readers -->
```

```python
# TODO(!low): tidy up
```

## Sub-tags

`todoforge.general.subTagRegex` (default `(?:#(\d+)|@([\w-]+))`) runs on the text after the tag. The first group becomes the sub-tag, for example `#123` or `@urgent`. Group by **Label or sub-tag** to use it.

## Markdown checklists

With `todoforge.markdown.enabled`, `- [ ] item` and `- [x] item` in Markdown files are listed in their own group (`todoforge.markdown.groupSeparately`). Toggle them from the tree.

## .NET code markers

With `todoforge.dotnet.codePatterns` (default on), C#, VB, F# and Razor files also list:

- `throw new NotImplementedException(...)`
- `[Obsolete]` / `[Obsolete("...")]`
- `#warning ...`

They must be real code, not text in a comment or a string.

## Supported comment styles

| Style | File types (by extension) |
| --- | --- |
| `//`, `/* */` | C#, Java, Kotlin, Go, Rust, Swift, C/C++, Dart, Scala, TypeScript/JavaScript, F# (`(* *)` too), SCSS/Less |
| `//`, `/* */`, `{/* */}`, `<!-- -->` | JSX/TSX, Vue, Svelte, Astro, MDX |
| `@* *@`, `//`, `<!-- -->` | Razor (`.cshtml`, `.razor`) |
| `<!-- -->` | HTML, XML, XAML, project files (`.csproj`, `.props`, `.targets`, `.config`, `.resx`, `.nuspec`), Markdown |
| `#` | Python, Ruby, shell, YAML, TOML, Dockerfile, Makefile, R, Perl and similar |
| `#`, `<# #>` | PowerShell |
| `--`, `/* */` | SQL |
| `--`, `--[[ ]]` | Lua |
| `--`, `{- -}` | Haskell, Elm, PureScript |
| `'`, `REM` | Visual Basic |
| `REM`, `::` | Batch files |
| `%` | LaTeX, BibTeX, Erlang |
| `;` | Lisp/Clojure, assembly |
| `;`, `#` | INI, `.properties`, `.cfg`, `.editorconfig` |
| `/* */` | CSS |
| `//`, `#`, `/* */` | PHP |

`*` continuation lines inside block comments are recognized. See `src/syntax/languages.ts` for the full list.

## Custom regex

`todoforge.regex.custom` replaces the language-aware matcher with your regex. Put `$TAGS` where the tag alternatives go. Metadata, strict tags and comment detection do not apply to custom matches. The setting is ignored in untrusted workspaces.

## Comment markers

These are **not** TODOs. They are colored only in the editor (`todoforge.commentMarkers.enabled`, on by default):

```ts
// ! alert
// ? question
// * highlight
//// struck through
```

They must sit in a comment, just like tags. A comment such as `// ! TODO: fix this` is still a TODO and is listed in the tree; the marker is not applied on that line. Add your own markers in `todoforge.commentMarkers.tags`. Recolor the built-ins with `workbench.colorCustomizations` (`todoforge.commentAlertForeground`, and so on).

## Ticket tokens

After a tag, `#123`, `[JIRA-123]` or a bare `PROJ-123` can be turned into a link with `todoforge.general.ticketUrl`. The template accepts `${token}` (the id), `${subTag}` (as written) and `${tag}`. Clicking the link opens the browser; nothing is fetched in the background.

