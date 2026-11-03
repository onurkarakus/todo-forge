# Store listing – English

## Display name (≤ 60 characters is safest)

```
TodoForge – TODO Tree, Highlights & Due Dates
```

## Short description (search card, ~200 characters)

```
Fast, offline TODO and FIXME tree with theme-aware highlights, owners and due dates, quick fixes, a Changes view for your branch and first-class .NET support. No account, no telemetry.
```

Alternative, shorter (Open VSX card, social previews):

```
Every TODO in one tree, with owners, due dates and a Changes view for your branch. Offline, no account.
```

## Categories

`Other`, `Visualization`

## Keywords (30, the Marketplace limit)

```
todo, fixme, todo tree, todo-tree, todo highlight, hack, bug, xxx, comments, highlight,
task list, tasks, due date, deadline, owner, dotnet, csharp, c#, rider, visual studio,
ripgrep, markdown, checklist, git, branch, blame, offline, privacy, productivity, notes
```

## Long description

The Marketplace and Open VSX pages show `README.md`. Its structure, top to bottom:

1. Icon, name, one-line promise: *Every TODO in your code, in one tree, with owners, due dates and a Changes view for your branch.*
2. Trust line: *Fast on big .NET and web repos. Offline. No account. No telemetry.*
3. Demo GIF (typing a TODO → tree → snooze).
4. **Why TodoForge** – five bullets: works on install, TODOs that carry meaning, see what you are adding, act from the line, private by design.
5. **Features** with a screenshot each: tree, highlights (dark + light), owners/dates/priorities (hover + quick fix), Changes, live filter (query table), Insights, Get Started and import.
6. **TodoForge and Todo Tree** comparison table.
7. **Commands and keys**, **Settings** (20 most used), **Privacy**, **FAQ**, **Feedback**.

### Plain-text version (for Open VSX "description" fields, newsletters, Product Hunt-style posts)

> **TodoForge** finds every TODO, FIXME, HACK and BUG comment in your workspace and puts them in one tree, with highlights that follow your theme.
>
> Write `TODO(onur, 2026-12-01, !high, #perf): cache this` and the TODO gets an owner, a due date that turns red when it passes, a priority and a label. Hover it to see who wrote it and when; press Ctrl+. to snooze it, set a date or remove it.
>
> The **Changes** view shows the TODOs you have not committed and the ones you added on your branch, from local git, so they do not slip into a pull request by accident. A live filter (`is:mine`, `is:overdue`, `@ayse`, `#perf`), pins, saved views and an Insights panel help you keep the list short.
>
> TodoForge is built for large .NET and web repos: it skips `bin/`, `obj/`, `node_modules/` and generated files out of the box, reads real comments in 70+ file types, and also lists `NotImplementedException`, `[Obsolete]` and `#warning` in C#. A full scan of 20,000 files takes about 50 ms.
>
> Private by design: no network, no telemetry, no account. AI help is opt-in and uses a model you already have in VS Code.
>
> Coming from Todo Tree, Rider or Visual Studio? One command imports your tags.

## Feature bullets (for galleries, stores with bullet fields)

- One tree for TODO, FIXME, HACK, BUG, XXX, UNDONE, NOTE, REVIEW, OPTIMIZE and your own tags
- Owners, due dates, priorities and labels inside the comment
- Hover card with git blame, one-click Snooze, Due date, Priority
- Quick fixes and a snippet for new TODOs
- Changes view: uncommitted TODOs and TODOs on your branch
- Live filter, pins, mute, saved views, My TODOs
- Insights panel: by tag, folder, owner, age; overdue and oldest
- Theme colors with accessible light-theme contrast
- .NET aware: excludes build output, finds NotImplementedException and [Obsolete]
- Import from Todo Tree, Rider or Visual Studio
- English and Turkish
- Offline, no telemetry, no account

## Q&A setting

Marketplace Q&A: link to GitHub issues (`https://github.com/onurkarakus/todo-forge/issues`) so questions land in one place.

## Open VSX specifics

- Namespace: `onurkarakus` (claim it so the listing is verified).
- Open VSX uses the same `package.json` and `README.md`; publish the universal VSIX or each platform VSIX.
- License: MIT (from `LICENSE`).

## Social / announcement post (≤ 280 characters)

```
TodoForge 1.0 for VS Code: every TODO in one tree, with owners, due dates and a Changes view for your branch. Hover for git blame, Ctrl+. to snooze. Fast on big .NET repos. Offline, no account, no telemetry.
```
