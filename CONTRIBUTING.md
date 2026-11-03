# Contributing

Thanks for helping. TodoForge is an **editor-only** extension for individual developers: offline, no telemetry, no account. Please keep proposals inside that scope. Team dashboards, CI checks, a CLI, SARIF output or issue-tracker sync are out of scope.

## Setup

```sh
git clone https://github.com/onurkarakus/todo-forge.git
cd todo-forge
npm install
npm run compile
```

Press **F5** in VS Code to start an Extension Development Host.

## Before you open a pull request

```sh
npm run check-types
npm run lint
npm test
xvfb-run -a npm run test:integration   # or without xvfb on a desktop
```

- Add or update unit tests next to the code you change. Pure logic must not import `vscode`.
- New user-visible strings go through `vscode.l10n.t(...)`. Run `npm run l10n` and add the Turkish text to `l10n/bundle.l10n.tr.json`. Manifest strings go into `package.nls.json` and `package.nls.tr.json`.
- New settings: describe them in `package.nls.json`, add a default in `src/config/defaults.ts`, and list them in the README if users are likely to change them.
- Update `CHANGELOG.md` under an "Unreleased" heading.
- Use conventional commits (`feat:`, `fix:`, `perf:`, `docs:`, `refactor:`, `test:`, `chore:`).

Read [AGENTS.md](AGENTS.md) for code style and [docs/architecture.md](docs/architecture.md) for how the pieces fit.

## Reporting bugs

Include your VS Code version, OS, the TodoForge version, a small file that shows the problem, and anything relevant from the **TodoForge** Output channel.

## Translations

Turkish and English ship today. To add a language, copy `package.nls.json` to `package.nls.<locale>.json` and `l10n/bundle.l10n.json` to `l10n/bundle.l10n.<locale>.json` and translate the values. `src/manifest.test.ts` checks that keys and placeholders match.
