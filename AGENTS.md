# TodoForge – Developer Guide

Conventions for working on the code base: commands, code style, architecture, tests and release rules.

VS Code extension for high-performance TODO/FIXME scanning and management.  
TypeScript, VS Code Extension API, ripgrep-based scanning.  
Target: Large codebases including .NET solutions.

## Commands

Build: `npm run compile`  
Watch: `npm run watch`  
Package: `npm run package`  
Lint: `npm run lint`  
Test: `npm test`  
Single test: `npm test -- --grep "describe name"`

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
  /scanning       -> Ripgrep integration, file watching, incremental updates
  /tree           -> TreeDataProvider, view models, grouping logic
  /highlighting   -> Editor decorations, gutter icons, ruler marks
  /tasks          -> Optional task management features
  /config         -> Settings reading, defaults, migration from Todo Tree
  /utils          -> Pure helpers (regex, path, debounce)
  extension.ts    -> Activation, command registration, disposables
```

- Data flows one way: scanning → tree/highlighting.
- Never import from `tree` or `highlighting` into `scanning`.
- Keep VS Code API calls at the edges. Core logic should be testable without VS Code.

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
- Telemetry is off by default and must be opt-in if ever added.

## Testing

- Unit tests for pure logic (regex, grouping, filtering).
- Integration tests for scanning behavior using fixture projects.
- Always test large-file and multi-root scenarios.
- Mock VS Code APIs; do not require a full VS Code instance for unit tests.

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
