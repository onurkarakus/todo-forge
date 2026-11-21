# Store listing – English

## Display name (≤ 60 characters is safest)

```
TodoForge – TODO Tree, Highlights & Due Dates
```

## Short description (search card, ~200 characters)

```
TODO and FIXME tree with owners and due dates in the comment, a Changes view for your branch, and theme-aware highlights. Offline, no account, no telemetry. Built for large .NET and web repos.
```

Alternative, shorter (Open VSX card, social previews):

```
Every TODO in one tree, with owners, due dates and a Changes view for your branch. Offline, no account.
```

## Categories

`Other`, `Visualization`

## Keywords (30, the Marketplace limit)

```
todo, fixme, todo tree, todo-tree, todo highlight, todo comments, comment highlight, comments,
highlight, annotations, tasks, task list, due date, deadline, overdue, owner, priority, hack, bug,
csharp, c#, dotnet, markdown, checklist, git, offline, privacy, productivity, copilot, comment tags
```

## Long description

The Marketplace and Open VSX pages show `README.md`. Its structure, top to bottom:

1. Icon, name, one-line promise: *Every TODO in your code, in one tree, with owners, due dates and a Changes view for your branch.*
2. Trust line: *Fast on big .NET and web repos. Offline. No account. No telemetry.*
3. Badges (Marketplace version and installs from vsmarketplacebadges.dev, Open VSX version and downloads, MIT license) and the demo GIF at the top (typing a TODO → tree → snooze). Images use absolute `raw.githubusercontent.com` URLs.
4. **Why TodoForge** – five bullets: works on install, TODOs that carry meaning, see what you are adding, act from the line, private by design.
5. **New in 1.2** – relative due dates, bulk actions in the tree, instant tree after a reload, smoother updates, smaller platform packages, parallel multi-root scans.
6. **Features** with a screenshot each: tree, highlights (dark + light), owners/dates/priorities (hover + quick fix), Changes, live filter (query table), Insights, Copilot Chat tools (`#todos`, `#todoChanges`, `#todo`), Get Started and import.
7. **Commands and keys**, **Settings** (20 most used), **Privacy**, **FAQ**, **Feedback**. The listing describes what TodoForge offers; it does not name or compare other extensions.

### Plain-text version (for Open VSX "description" fields, newsletters, Product Hunt-style posts)

> **TodoForge** finds every TODO, FIXME, HACK and BUG comment in your workspace and puts them in one tree, with highlights that follow your theme.
>
> Write `TODO(onur, 2026-12-01, !high, #perf): cache this` and the TODO gets an owner, a due date that turns red when it passes, a priority and a label. Hover it to see who wrote it and when; press Ctrl+. to snooze it, set a date or remove it. Short on time? Type `+7d`, `+2w`, `tomorrow` or `friday` and TodoForge writes the real date into the comment.
>
> Select several TODOs in the tree to snooze, date, prioritize, assign, pin or mute them in one go.
>
> The **Changes** view shows the TODOs you have not committed and the ones you added on your branch, from local git, so they do not slip into a pull request by accident. A live filter (`is:mine`, `is:overdue`, `@ayse`, `#perf`), pins, saved views and an Insights panel help you keep the list short.
>
> TodoForge is built for large .NET and web repos: it skips `bin/`, `obj/`, `node_modules/` and generated files out of the box, reads real comments in 70+ file types, and also lists `NotImplementedException`, `[Obsolete]` and `#warning` in C#. A full scan of 20,000 files takes well under 100 ms, the tree shows the last scan instantly after a reload, and the download is a 2–3 MB package built for your platform.
>
> Private by design: no network, no telemetry, no account. AI help is opt-in and uses a model you already have in VS Code.
>
> Using Copilot Chat? Ask “which overdue TODOs are mine?” or “what TODOs did I add on this branch?”: turn on `todoforge.ai.chatTools` and TodoForge answers through read-only chat tools (`#todos`, `#todoChanges`, `#todo`) from its local index. Off by default.
>
> If you already have tags and markers set up, **Import Settings** can bring them over, including from Visual Studio and Rider settings files.

## Feature bullets (for galleries, stores with bullet fields)

- One tree for TODO, FIXME, HACK, BUG, XXX, UNDONE, NOTE, REVIEW, OPTIMIZE and your own tags
- Owners, due dates, priorities and labels inside the comment
- Relative due dates (`+7d`, `+2w`, `+1m`, `tomorrow`, `friday`) written as real dates
- Multi-select in the tree: snooze, date, prioritize, assign, pin or mute many TODOs at once
- Instant tree after a reload; only changed rows redraw
- Hover card with git blame, one-click Snooze, Due date, Priority
- Quick fixes and a snippet for new TODOs
- Changes view: uncommitted TODOs and TODOs on your branch
- Live filter, pins, mute, saved views, My TODOs
- Insights panel: by tag, folder, owner, age; overdue and oldest
- Theme colors with accessible light-theme contrast
- .NET aware: excludes build output, finds NotImplementedException and [Obsolete]
- Import Settings: bring over tags, excludes and markers, including from Visual Studio and Rider
- Comment markers (`// !`, `// ?`, `// *`, `////`) in the editor
- Clickable ticket links, Current file toggle, copy the view as a Markdown checklist
- Copilot Chat tools: ask about your TODOs with #todos, #todoChanges and #todo (read-only, opt-in)
- English and Turkish
- Offline, no telemetry, no account

## Q&A setting

`package.json` `qna` points to GitHub issues (`https://github.com/onurkarakus/todo-forge/issues`) so questions land in one place.

## Open VSX specifics

- Namespace: `onurkarakus` — created and verified ([EclipseFdn/open-vsx.org#15275](https://github.com/EclipseFdn/open-vsx.org/issues/15275), granted 5 November 2026). TodoForge is published there: https://open-vsx.org/extension/onurkarakus/todoforge
- Open VSX uses the same `package.json` and `README.md`. From 1.2.0 each platform gets its own package (`npm run package:platforms`, files in `vsix/<version>/`); the universal package stays available as a fallback for other platforms.
- License: MIT (from `LICENSE`).

## Social / announcement post (≤ 280 characters)

1.2.0:

```
TodoForge 1.2 for VS Code: write TODO(me, +7d) and get a real date, select many TODOs to snooze or assign at once, an instant tree after reload and a 2–3 MB download for your platform. Offline, no account, no telemetry.
```

1.0.0:

```
TodoForge 1.0 for VS Code: every TODO in one tree, with owners, due dates and a Changes view for your branch. Hover for git blame, Ctrl+. to snooze. Fast on big .NET repos. Offline, no account, no telemetry.
```
