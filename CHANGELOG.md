# Changelog

All notable changes to TodoForge. Dates are in the Europe/Istanbul time zone.

## [1.1.1] - 2026-11-18

Marketplace listing and documentation. Same features as 1.1.0.

### Changed

- Sharper short description and keywords for Marketplace search.
- README: version, installs and rating badges, the demo GIF at the top, and absolute image URLs.

### Documentation

- The README now leads with what TodoForge offers. Q&A on the Marketplace page points to GitHub issues.

## [1.1.0] - 2026-11-15

Comment colors in the editor, clickable tickets, a focus mode for the current file and easier moves from other TODO extensions. Still offline, no account, no telemetry.

### Added

- **Comment markers**, Better Comments style: `// !` alert, `// ?` question, `// *` highlight and `////` strikethrough, plus your own markers (`todoforge.commentMarkers.*`). They only color the editor and stay out of the TODO tree unless the comment also has a real TODO or FIXME tag. Colors follow the theme and `workbench.colorCustomizations`. If Better Comments or Better Comments Next is installed, TodoForge leaves the markers to that extension until you set `todoforge.commentMarkers.enabled` yourself.
- **Current file** toggle in the tree toolbar. It focuses the tree on the active editor without changing `todoforge.scanning.mode`.
- **Expand All** and **Collapse All** in the tree toolbar and the Command Palette.
- The tree can follow the file you are in (`todoforge.tree.autoReveal`, on by default).
- **Clickable tickets**: `#123`, `FIXME[JIRA-123]` and `PROJ-123` open in your browser from the hover card and the tree when `todoforge.general.ticketUrl` is set (placeholders `${token}`, `${subTag}`, `${tag}`). Raw `https://` links in a comment are always clickable. No API and no issue sync.
- **Copy View as Markdown Checklist** copies the filtered tree to the clipboard.
- Highlight options:
  - per-tag `hideFromTree`: keep the color in the editor, leave the tag out of the tree
  - `todoforge.highlighting.style` value `text`: the tag plus the text after it
  - global and per-tag opacity, and an optional border
  - a gutter icon toggle (`todoforge.highlighting.gutterIcons`) and more built-in icons
- **Import Settings** also reads Better Todo Tree, Better Comments and Better Comments Next, including ticket URL templates and `hideFromTree` when they exist.

### Changed

- **Show Insights** is now in the tree toolbar instead of the `…` menu. **Refresh** moved into the `…` menu, since the tree refreshes on its own.

### Documentation

- README: a section on **Explain TODO with AI**, screenshots of the Copilot chat tools, and a demo video.
- The comparison table now covers Better Todo Tree (the maintained Todo Tree fork, GPL-3.0) and TODO Lens, where git blame, My TODOs and export are paid features. They stay free in TodoForge.
- Contributors: the Run and Debug view has configurations for unit tests, integration tests and the sample projects in `test/fixtures` (see `CONTRIBUTING.md`).

## [1.0.0] - 2026-11-04

First Marketplace release. TodoForge 1.0 is an editor-only release for individual developers: offline, no account, no telemetry, no network.

### Added

- **Inline metadata**: `TODO(owner, 2026-12-01, !high, #label): text`. Owner, due date, priority and labels are optional and can come in any order.
- **Hover card** with owner, due date, priority, labels, git blame (author, age, commit) and one-click actions.
- **Quick fixes** (`Ctrl+.`): snooze 1 day, 1 week or 1 month, set due date, set priority, assign to me, remove the TODO, pin, mute.
- **Snippet completion** inside comments: `TODO:` and `TODO(owner, date)`.
- **Inline hints** after the line: `overdue 6d`, `due in 3d · !high`.
- **Changes view**: TODOs you have not committed and TODOs added on your branch, from read-only local git.
- **Git blame** for age and author, `is:mine`, and stale TODOs (`todoforge.stale.afterDays`).
- **Live filter** with a query language: `is:mine is:overdue is:due is:new is:stale tag: @owner #label path: -word`.
- **Saved views**, plus built-in views (My TODOs, Overdue, Due dates, New on this branch, Stale, FIXME and BUG, .NET code markers).
- **Pins** at the top of the tree that follow the line as the file changes, with drag-and-drop ordering.
- **Mute** a TODO in this workspace, and **Unmute TODOs…** to bring it back.
- **Insights** panel: counts by tag, folder and owner, age from git blame, and the overdue and oldest TODOs. Local webview with a strict CSP.
- **Explain TODO with AI** (opt-in, off by default): uses a chat model you already have in VS Code through the Language Model API, after a one-time consent prompt.
- **Copilot Chat tools** (VS Code 1.95+): `#todos` lists and filters TODOs, `#todoChanges` lists uncommitted and branch TODOs, `#todo` shows one TODO with blame. Read-only, local index only, capped results. Off by default: opt in with the new setting `todoforge.ai.chatTools` or the new Get Started step. Off in untrusted workspaces. Nothing changes on older VS Code or without a chat extension.
- **Import Settings** from Todo Tree, JetBrains Rider/ReSharper (`.DotSettings`) or Visual Studio (`.vssettings`) in one command.
- **Group by owner** and **label**, and **sort by priority, due date or age**.
- **Next/previous TODO in file** keybindings: `Ctrl+Alt+PageDown` / `Ctrl+Alt+PageUp`.
- **Status bar** counter (`2/18 ⚠1`: this file, total, overdue) with a per-tag format.
- **Problems panel** integration (off by default) with per-tag severity.
- Comment syntax for Vue, Svelte, JSX/TSX, Astro, MDX, LaTeX and INI-style files.
- `UNDONE` tag (Visual Studio's default list).
- **.NET code markers** in C#: `throw new NotImplementedException()`, `[Obsolete]` and `#warning` (`todoforge.dotnet.codePatterns`).
- Theme colors (`todoforge.<tag>Foreground` / `Background`, plus overdue, due-soon, stale and hint colors) with WCAG AA contrast on light themes.
- New icon, activity bar icon and gallery banner.
- Get Started walkthrough and welcome views.
- English and Turkish localization.
- Untrusted workspaces run in limited mode: scanning and highlights work; git, the workspace custom regex and AI are off.
- Per-platform VSIX builds with only that platform's ripgrep.

### Changed

- **Quieter defaults**: tags are case-sensitive, and `NOTE`, `BUG`, `REVIEW`, `OPTIMIZE` only count when followed by `:` or `(`.
- More default excludes: `packages/*.*.*`, `*.g.cs`, `*.g.i.cs`, `*.designer.cs`, `*.min.*`.
- Scanning shows progress on the TODO view instead of a notification.
- Tag groups in the tree follow the order of `todoforge.general.tags`.
- `todoforge.general.tagGroups` is now an array of `{ name, tags }`. Old object values are converted.
- The Todo Tree prompt became the **Import Settings** command; the first-run offer is still there and can be turned off with `todoforge.migrateFromTodoTree`.

### Removed

- **My Tasks** was replaced by **Pins**. Tasks stored by 0.1 are not migrated; pin the TODOs you want to keep at the top.
- `todoforge.tasks.updateSourceOnDone` and the task storage settings.
- The "Track as Task" CodeLens. CodeLens now offers Pin and Snooze (off by default).

### Fixed

- `;` comments in INI, `.properties`, `.cfg` and `.editorconfig` files were not found.
- Changing a color or tree setting no longer rescans the whole workspace.
- The Changes view, `is:uncommitted` and `is:new` now follow unsaved edits: lines added or removed above a TODO no longer move it in or out of the view until you save. Reverting the file restores the saved state.

### Tests

- Integration run in Restricted Mode (workspace trust on): scanning works, git stays off, a workspace custom regex is ignored, chat tools refuse.
- Integration tests for the chat tools and for Changes with unsaved edits.

## [0.1.0] - 2026-10-26

Internal preview, never published to a marketplace.

### Added

- Workspace scan for TODO, FIXME, HACK, BUG, NOTE, XXX, REVIEW, and OPTIMIZE in comments.
- Tree grouped by tag, file, sub-tag, or a flat list, with filter, badge, and status bar counts.
- Editor highlights and overview ruler marks.
- My Tasks, with priority, due date, note, and subtasks. Storage stays in VS Code unless you choose a workspace file.
- Markdown checklists in their own group. Toggling a checkbox writes the file.
- Optional CodeLens actions: Track as Task and Copy.
- First-launch copy of supported Todo Tree settings.
- Default excludes for `bin/`, `obj/`, `.vs/`, `packages/`, `node_modules/`, and generated C# files.
