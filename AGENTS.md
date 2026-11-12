# TodoForge – Developer Guide

Conventions for working on the code base: commands, code style, architecture, tests and release rules.

VS Code extension for high-performance TODO/FIXME scanning and management.  
TypeScript, VS Code Extension API, ripgrep-based scanning.  
Target: Large codebases including .NET solutions.

## Product scope

TodoForge is **editor-only, for individual developers**:

- Offline. No network requests, no telemetry, no account, no sign-in.
- Local, read-only git only (`diff`, `ls-files`, `merge-base`, `blame`, `check-ignore`). Never fetch or push.
- No team, CI, CLI, SARIF or issue-tracker features. Say no to them in reviews.
- AI features stay opt-in (`todoforge.ai.enabled`, default `false`) and only use `vscode.lm`.
- Chat tools (`features/chatTools`, `tools/todoTools`) stay read-only, return only indexed TODO data (never surrounding code), cap their output, are opt-in (`todoforge.ai.chatTools`, default `false`), and stay off in untrusted workspaces. Feature-detect any `vscode.lm` API newer than the `engines` version.

See [docs/architecture.md](docs/architecture.md) before larger changes.

## Commands

Build: `npm run compile`  
Watch: `npm run watch`  
Package: `npm run package`  
Lint: `npm run lint`  
Test: `npm test`  
Single test: `npm test -- --grep "describe name"`  
Integration tests: `npm run test:integration` (real VS Code; on Linux run under `xvfb-run -a`; set `VSCODE_EXECUTABLE` to reuse a local build)  
Performance: `npm run perf`  
Localization: `npm run l10n` after changing any `vscode.l10n.t` string, then update `l10n/bundle.l10n.tr.json`  
VSIX: `node scripts/package.mjs linux-x64` (one target) or `npm run package:platforms` (all). Publishing is a manual maintainer step (see [docs/release.md](docs/release.md)).

## Code Style

- TypeScript strict mode. Never use `any` unless absolutely unavoidable and commented.
- Prefer `const`. Use `let` only when reassignment is required. Never `var`.
- Named exports only. Avoid default exports.
- Functional style preferred. Classes only when VS Code API requires them (e.g. TreeDataProvider).
- Explicit return types on public functions.
- Use early returns to reduce nesting.
- Prefer async/await over raw Promises.

```ts
// Good
export const scanWorkspace = async (
  workspaceFolders: readonly WorkspaceFolder[]
): Promise<TodoItem[]> => {
  // ...
};
```

## Error Handling

- Do not swallow errors silently.
- Log unexpected errors with context using the extension's logger.
- Let user-facing errors surface via `vscode.window.showErrorMessage`.
- Scanning and file operations must be resilient: one bad file must not crash the whole scan.

## Architecture

```
/src
  /scanning       -> ripgrep runner, line parser, path filter, index, line shifting
  /syntax         -> comment syntax per language, inline metadata, TODO removal
  /git            -> local git (diff/blame parsing, service, context with caches)
  /core           -> engine (scan, watch, live edits), state (pins, mute, views)
  /tree           -> TODO tree and Changes tree providers, grouping, query language
  /highlighting   -> palette (theme colors), decorations, comment markers, inline hints, icons
  /features       -> hover, quick fixes, completion, diagnostics, status bar, insights panel, AI, import
  /tools          -> chat tool logic: filters, limits, rendering (pure)
  /pins           -> pin fingerprints and resolution
  /insights       -> insights model and HTML rendering (pure)
  /config         -> settings, defaults, migration, importers (Todo Tree, Better Todo Tree, Better Comments, Rider, Visual Studio)
  /commands       -> navigation helpers
  /utils          -> pure helpers (regex, paths, debounce, ids)
  controller.ts   -> composition root: commands, views, context keys
  extension.ts    -> activate/deactivate; returns a small test API
```

- Data flows one way: scanning → engine → tree/highlighting/features.
- Never import from `tree`, `highlighting` or `features` into `scanning`, `syntax` or `git` parsers.
- Keep VS Code API calls at the edges. Pure modules (`scanning/parseLine`, `syntax/*`, `tree/query`, `tree/grouping`, `git/*Parse`, `insights/*`, `pins/*`, `config/importers`) must not import `vscode`.
- `package.json`, `package.nls.json` and `package.nls.tr.json` must stay in sync; `src/manifest.test.ts` checks keys, commands, menus and walkthrough media.

## Performance Rules

- Never block the extension host.
- All workspace scans must be incremental or heavily debounced.
- Do not load entire large files into memory.
- Respect `.gitignore` and user exclude globs by default.
- Default excludes for .NET: `bin/`, `obj/`, `.vs/`, `packages/`.
- Debounce file change events (recommended 300–500ms).

## Boundaries

- Never modify files in `/out/` or `/dist/` (generated).
- Never commit `.vsix`, `node_modules`, or any secrets.
- Do not use global prototype modifications (especially `RegExp`).
- Do not introduce heavy dependencies without justification.
- No telemetry and no network calls. Do not add either.

## Testing

- Unit tests for pure logic (regex, grouping, filtering).
- Integration tests for scanning behavior using fixture projects.
- Always test large-file and multi-root scenarios.
- Mock VS Code APIs; do not require a full VS Code instance for unit tests.
- Integration tests in `test/integration/` run in a real VS Code against a temporary git workspace made by `scripts/run-integration.mjs`, once trusted and once in Restricted Mode (`untrusted.test.cjs`).
- Marketplace screenshots come from `scripts/screenshots/` (demo workspace + Playwright driver). Re-run them when the UI changes.

## Git

- Squash merge only.
- Conventional commits: `feat:`, `fix:`, `perf:`, `chore:`, `docs:`, `refactor:`.
- Branch format: `type/short-description` (e.g. `feat/incremental-scan`, `fix/dotnet-excludes`).
- Keep commits focused. One logical change per commit.

## VS Code Specific

- Register all commands, views, and configuration in `package.json` under `contributes`.
- Use `context.subscriptions` for all disposables.
- Support multi-root workspaces.
- Activation event should be lightweight (`onView:todoforge` or `onStartupFinished` if justified).
- Follow VS Code extension guidelines for contribution points and when clauses.

## Defaults & Compatibility

- Must work out of the box on large .NET solutions.
- Provide a migration path from Todo Tree settings where reasonable.
- Excellent defaults > excessive configuration.
- Document every setting with a clear description in `package.json`.
