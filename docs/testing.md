# Testing

| Check | Command | What it covers |
| --- | --- | --- |
| Types | `npm run check-types` | `tsc --noEmit`, strict mode |
| Lint | `npm run lint` | ESLint on `src/` |
| Unit tests | `npm test` | mocha + tsx on `src/**/*.test.ts`, no VS Code needed |
| Integration tests | `npm run test:integration` | real VS Code via `@vscode/test-electron` |
| Performance | `npm run perf` | 20,000-file synthetic repo |

## Unit tests

Pure modules have tests next to them:

- `scanning/parseLine.test.ts` – per-language matrix, strict tags, metadata, .NET markers, strings and identifiers that must not match
- `scanning/scanner.test.ts` – ripgrep runner on fixtures, multi-root, excludes, large files
- `scanning/pathFilter.test.ts` – excludes, includes, `.gitignore`-style patterns
- `syntax/syntax.test.ts` – comment syntax, metadata, removal plans
- `tree/query.test.ts`, `tree/grouping.test.ts` – filter language, grouping, tag order
- `git/git.test.ts` – diff and blame parsing plus a temporary git repo
- `pins/pins.test.ts`, `insights/insights.test.ts`, `features/statusText.test.ts`
- `highlighting/palette.test.ts` – contributed colors match the palette; light colors reach 4.5:1 contrast
- `config/migration.test.ts`, `commands/navigation.test.ts`
- `manifest.test.ts` – every `%key%` exists in both NLS files, l10n bundles have the same keys and placeholders, menu commands exist and are registered, walkthrough media exists, at most 30 keywords, quiet defaults

Run one file or suite:

```sh
npx mocha --require tsx src/tree/query.test.ts
npm test -- --grep "grouping"
```

## Integration tests

`scripts/run-integration.mjs` copies `test/fixtures/sample` to a temp folder, makes a git repo with a `feature` branch (one committed FIXME) and one uncommitted TODO, then starts VS Code with the extension under development. `test/integration/extension.test.cjs` checks:

- activation time and command registration
- the scan finds fixture TODOs and skips build output and generated files
- inline metadata parsing
- the Changes view splits uncommitted and branch TODOs
- the filter query language
- hover card actions, quick fixes (snooze edits the file), snippet completion
- pin and unpin, next TODO navigation, a TODO typed into an open editor
- the Insights panel opens
- the Changes view stays right while a file has unsaved edits, and after revert
- the chat tools are registered, filter and cap results, and respect `todoforge.ai.chatTools` (through `vscode.lm.invokeTool`, no Copilot needed)

A second run, `test/integration/untrusted.test.cjs`, opens a copy of the workspace in Restricted Mode. `runTests` always passes `--disable-workspace-trust`, so the script starts VS Code itself with workspace trust on and a workspace `.vscode/settings.json` that sets `todoforge.regex.custom` and `todoforge.git.baseBranch`. It checks that scanning works, git stays off, the custom regex is ignored and the chat tools refuse.

On Linux without a display:

```sh
xvfb-run -a npm run test:integration
```

To reuse a downloaded VS Code instead of fetching one, set `VSCODE_EXECUTABLE=/path/to/code`.

The extension returns a small API from `activate()` for these tests (`all`, `visible`, `changes`, `pins`, `query`, `scanned`, `refresh`). It is not a public API.

## Performance

`npm run perf` writes a gitignored fixture at `test/fixtures/perf-generated` and measures a full scan, a one-file rescan, the watcher path filter, and grouping plus filtering. Latest numbers are in [perf-notes.md](perf-notes.md).

## Screenshots

`scripts/screenshots/` drives a real VS Code with Playwright to make the Marketplace images. It needs `playwright-core` (not a project dependency) and an X display:

```sh
npm i --no-save playwright-core
node scripts/package.mjs linux-x64
node scripts/screenshots/demo-workspace.mjs /tmp/contoso-shop
xvfb-run -a -s "-screen 0 1920x1200x24" node scripts/screenshots/capture.cjs \
  --code /path/to/VSCode-linux-x64/code --vsix vsix/todoforge-linux-x64-1.0.0.vsix \
  --workspace /tmp/contoso-shop --out media/screenshots
```

`--session dark|light|gif` and `--only hero,hover,…` limit what is captured. The GIF needs `ffmpeg`.
