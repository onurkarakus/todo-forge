# Architecture

TodoForge is a single VS Code extension bundled with esbuild into `dist/extension.js`. It activates on `onStartupFinished`, registers everything, and schedules the first scan so activation stays near 50 ms.

## Principles

- **Editor-only.** No network, no telemetry, no account. Git is used read-only and locally.
- **Pure core, thin edges.** Parsing, matching, querying, grouping, git output parsing, pins and insights are pure TypeScript and unit tested without VS Code. VS Code APIs live in `core/`, `features/`, `tree/*Provider.ts`, `highlighting/highlighter.ts` and `controller.ts`.
- **Quiet by default.** Case-sensitive tags, strict common-word tags, generous excludes, no notifications during scans, Problems and CodeLens off.

## Data flow

```
ripgrep (bundled) ──► scanning/scanner ──► parseLine (+ syntax/commentContext, syntax/metadata)
                                              │
file watcher / editor edits ──► core/engine ──┤  index of TodoMatch per file, dirty-buffer overlay
                                              │
             git/gitContext (diff, blame) ────┤
             core/state (pins, mute, query) ──┤
                                              ▼
                                       controller.publish()
              ┌──────────────┬──────────────┼───────────────┬─────────────────┐
         tree/todoTree   tree/changes   highlighting    features/*        status bar
          (grouping,      (uncommitted,  (decorations,   (hover, quick     (summary)
           query, pins)    this branch)   hints)          fixes, problems,
                                                          insights, AI)
```

## Modules

| Folder | Role | VS Code API |
| --- | --- | --- |
| `scanning/` | ripgrep runner, `parseLine`, path filter (picomatch), index store, line shifting on edits | no (except `rgPath` file lookup) |
| `syntax/` | comment syntax for 70+ file types, comment-context detection, inline metadata `TODO(owner, date, !prio, #label)`, TODO removal plans | no |
| `git/` | `diffParse`, `blameParse` (pure); `gitService` runs `git` with safe flags; `gitContext` caches change sets and blame and watches `.git/HEAD` | `gitContext` only |
| `core/` | `engine` (scan, watch, debounce, multi-root, scan modes, progress on the view), `state` (pins, mute in workspace state; saved views in global state) | yes |
| `tree/` | `query` (filter language), `grouping`, `elements`, providers for the TODO tree and Changes view, export | providers only |
| `highlighting/` | `palette` (built-in tag colors per theme, contributed colors), `hints`, `decorationFactory`, `highlighter` | yes |
| `features/` | hover card, code actions, completion, diagnostics, status bar, insights panel, AI, import settings, editing helpers, checkbox toggle | yes |
| `pins/` | fingerprints that survive line moves, resolution, ordering | no |
| `insights/` | `model` (counts, ages, lists) and `render` (CSP HTML) | no |
| `config/` | settings reader and writer, defaults, migration, importers for Todo Tree, Rider and Visual Studio | `settings` only |

## Matching

1. ripgrep finds candidate lines with a tag regex built from `todoforge.general.tags` (`utils/regexBuilder`).
2. `parseLine` checks that the tag is in a real comment for the file's language (`syntax/languages`, `syntax/commentContext`), so strings and identifiers are skipped.
3. Strict tags (`NOTE`, `BUG`, `REVIEW`, `OPTIMIZE` by default) need `:` or `(` after them.
4. Inline metadata in parentheses is parsed (`syntax/metadata`).
5. In C#-family files, `NotImplementedException`, `[Obsolete]` and `#warning` are added as code markers when they are real code.

A custom regex (`todoforge.regex.custom`) replaces steps 2–4; it is ignored in untrusted workspaces.

## Git

`gitService` runs `git -c core.quotepath=off -c color.ui=false …` with `execFile` (no shell). Used commands:

- `diff HEAD --unified=0` and `ls-files --others --exclude-standard` for uncommitted TODOs
- `merge-base` + `diff <base> --unified=0` for TODOs on this branch
- `blame --line-porcelain -L n,n --contents -` for author and age (dirty buffers included)
- `check-ignore --stdin` to filter watcher events

The base branch is `todoforge.git.baseBranch` or the first of `origin/HEAD`, `main`, `master`, `develop` that exists. Git is off in untrusted workspaces.

## Storage

| What | Where |
| --- | --- |
| Pins, muted TODOs, current filter, My TODOs toggle | `ExtensionContext.workspaceState` |
| Saved views, AI consent | `ExtensionContext.globalState` |
| Settings | VS Code settings (`todoforge.*`) |

Nothing is written to the repository unless the user edits a TODO or exports a view.

## Webview

The Insights panel builds a full HTML string with a nonce-based CSP (`default-src 'none'`, no `unsafe-inline`). Bar sizes are CSS classes because inline `style` attributes would be blocked. Links post a message back to open the TODO.

## Packaging

`scripts/package.mjs` builds one VSIX per VS Code target and copies only that platform's ripgrep into `bin/<platform>-<arch>/`. `scanning/rgPath` looks there first, then in `node_modules/@vscode/ripgrep-*` during development. See [release.md](release.md).
