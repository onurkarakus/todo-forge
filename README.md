<p align="center">
  <img src="media/icon.png" width="96" alt="TodoForge icon">
</p>

<h1 align="center">TodoForge</h1>

<p align="center">
  <b>Every TODO in your code, in one tree, with owners, due dates and a Changes view for your branch.</b><br>
  Fast on big .NET and web repos. Offline. No account. No telemetry.
</p>

<video src="media/screenshots/demo.mp4" autoplay loop muted playsinline width="1100">
  <img src="media/screenshots/demo.gif" alt="TodoForge: type a TODO with an owner, a date and a priority, see it in the tree, snooze it with a quick fix">
</video>

## Why TodoForge

- **Works on install.** Open a folder and the TODO tree fills in. `bin/`, `obj/`, `node_modules/`, generated C# and minified files are skipped out of the box, and `.gitignore` is honored.
- **TODOs that carry meaning.** Write `TODO(onur, 2026-12-01, !high, #perf): …` and get an owner, a due date that turns red when overdue, a priority and labels. Every part is optional.
- **See what you are adding.** The **Changes** view lists TODOs you have not committed and TODOs added on your branch, from local git. Check it before you open a pull request.
- **Act from the line.** Hover a TODO for who wrote it and when, then Snooze, set a date, set a priority, pin or remove it with one click or **Ctrl+.**
- **Private by design.** Nothing leaves your machine. No sign-in, no telemetry, no network calls. AI help and the Copilot chat tools are off unless you turn them on.

## Features

### A tree of every TODO

![The TODO tree grouped by tag next to a C# file with highlighted TODOs, an inline due-date hint and the status bar counter](media/screenshots/01-overview-dark.png)

- Group by **tag**, **file**, **owner**, **label** or a flat list. Sort by location, priority, due date or age. Expand or collapse the whole tree, or toggle **Current file** to focus the active editor without changing the scan mode. The tree can follow the file you are in (`todoforge.tree.autoReveal`).
- Finds `TODO FIXME HACK BUG XXX UNDONE NOTE REVIEW OPTIMIZE` and your own tags. `NOTE`, `BUG`, `REVIEW` and `OPTIMIZE` only count with a `:` or `(`, so “// Note that…” is not a TODO.
- Reads real comments in 70+ file types, including Vue, Svelte, JSX/TSX, Astro, Razor, LaTeX and INI files. A `todoList` variable or a `"TODO"` string is not a TODO.
- In C#, also lists `throw new NotImplementedException()`, `[Obsolete]` and `#warning`.
- Markdown checklists (`- [ ]`) get their own group; tick them from the tree.
- **Pins** keep the TODOs you care about at the top, and follow the line when the file changes. Drag to reorder.
- **Mute** a TODO you never want to see again in this workspace.

### Highlights that follow your theme

Tags are colored in the editor, the gutter and the overview ruler, with separate light and dark colors that pass WCAG AA contrast on the light theme. Recolor built-in tags from your theme with `workbench.colorCustomizations` (`todoforge.todoForeground`, `todoforge.fixmeForeground`, …). You can highlight only the tag, the tag and the text after it, the whole comment or the line; turn the gutter icon off, lower the opacity or add a border. Set `hideFromTree` on a tag (for example `NOTE`) to keep the color in the editor but leave it out of the tree.

TodoForge can also replace [Better Comments](https://marketplace.visualstudio.com/items?itemName=aaron-bond.better-comments): `// !` is an alert, `// ?` a question, `// *` a highlight and `////` is struck through. Those markers stay in the editor and do not appear in the TODO tree unless the comment also has a real TODO or FIXME tag. If Better Comments is also installed, turn one of them off so the colors do not stack.

![The light theme: a HACK comment with an "overdue 6d" hint, a BUG and a NotImplementedException](media/screenshots/07-overview-light.png)

### Owners, due dates and priorities

```csharp
// TODO(onur, 2026-12-01, !high, #perf): cache the price lookup
// FIXME(@ayse): null check before Save()
// HACK(2026-11-15): remove after the API fix ships
```

- Overdue and due-soon TODOs show a hint at the end of the line (`overdue 6d`, `due in 3d · !high`).
- Type `todo` in a comment and pick **TODO(owner, date)** to get the snippet.
- Your name comes from `todoforge.syntax.owner` or your local `git config user.name`.
- Ticket tokens such as `#123` or `FIXME[JIRA-123]` become links in the hover card when you set `todoforge.general.ticketUrl` (for example `https://github.com/org/repo/issues/${token}` or `https://jira.example.com/browse/${token}`). Clicking them opens your browser. TodoForge itself makes no request.

| Hover card | Quick fixes |
| --- | --- |
| ![Hover card with owner, due date, priority, label, git blame and action links](media/screenshots/02-hover-dark.png) | ![Quick fix menu: Snooze 1 day, 1 week, 1 month, set due date, set priority, remove, pin, mute](media/screenshots/03-quick-fix-dark.png) |

### Changes: TODOs on your branch

![The Changes view: one uncommitted FIXME and two TODOs added on feature/checkout since main](media/screenshots/04-changes-dark.png)

TodoForge runs read-only local git commands (`git diff`, `git ls-files`, `git merge-base`, `git blame`) to split TODOs into **Uncommitted** and **This branch**. The base branch is detected (`origin/HEAD`, `main`, `master`, `develop`) or set with `todoforge.git.baseBranch`. Nothing is fetched.

### Filter as you type

![Live filter with is:mine applied: 5 of 18 TODOs](media/screenshots/05-live-filter-dark.png)

| Query | Shows |
| --- | --- |
| `is:mine` | yours, by inline owner or git blame |
| `is:overdue`, `is:due` | past due, has a due date |
| `is:new` | uncommitted or added on this branch |
| `is:stale` | older than `todoforge.stale.afterDays` (git blame) |
| `tag:FIXME,BUG` | these tags |
| `@ayse`, `#perf`, `path:src/api` | owner, label, path |
| `-word`, `-tag:NOTE` | exclude |

Save any filter as a **view**. Built-in views: My TODOs, Overdue, Due dates, New on this branch, Stale, FIXME and BUG, .NET code markers.

### Insights

![Insights: totals, overdue, stale, new on this branch, counts by tag, folder and owner, age from git blame, overdue and oldest lists](media/screenshots/06-insights-dark.png)

Counts by tag, folder and owner, age from git blame, and the overdue and oldest TODOs. It is a local webview with a strict content security policy: no scripts or styles from the network.

### Ask Copilot about your TODOs

TodoForge adds three read-only tools for Copilot Chat and agent mode (VS Code 1.95 or later). They are **off by default**: set `todoforge.ai.chatTools` to `true` (or use the **Ask Copilot about your TODOs** step in Get Started) to turn them on.

| Tool | Reference | What it returns |
| --- | --- | --- |
| List TODOs | `#todos` | TODOs filtered by file, tag, owner, label, priority, overdue, due soon, stale, mine, new, uncommitted or this branch |
| TODO Changes | `#todoChanges` | TODOs you have not committed and TODOs added on this branch |
| TODO Details | `#todo` | One TODO with its metadata and git blame |

Ask “which overdue TODOs are mine?”, “what TODOs did I add on this branch?” or “plan the FIXMEs in `src/api`”. Results are capped (50 by default, 200 at most) so a large repo does not flood the chat.

The tools read the index TodoForge already has. They never read surrounding code and make no network request. They run only when you chat and the model calls them, and VS Code shows each call. They are off in untrusted workspaces. Without Copilot or another chat extension, or on VS Code older than 1.95, nothing changes.

### Get started in a minute

![The Get Started walkthrough in the light theme](media/screenshots/09-walkthrough-light.png)

The walkthrough opens from **TodoForge: Get Started**. Coming from Todo Tree, Better Todo Tree, Better Comments, JetBrains Rider/ReSharper or Visual Studio? **TodoForge: Import Settings** brings your tags, excludes and comment markers in one step.

![Completion inside a comment offering TODO and TODO(owner, date)](media/screenshots/08-snippet-light.png)

## TodoForge and the alternatives

[Todo Tree](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree) is the extension most people know (about 7.9 million Marketplace installs). Its latest release is still 0.0.226 from April 2023, and after VS Code 1.122 many people report it no longer starts ([ripgrep errors](https://github.com/Gruntfuggly/todo-tree/issues/928), [commands missing](https://github.com/Gruntfuggly/todo-tree/issues/925)). **[Better Todo Tree](https://marketplace.visualstudio.com/items?itemName=FanaticPythoner.better-todo-tree)** is the maintained fork (about 48,000 Marketplace installs as of 12 November 2026). It is licensed **GPL-3.0**; TodoForge is **MIT**.

**[TODO Lens](https://marketplace.visualstudio.com/items?itemName=branchline.todo-lens)** combines comment colors with a TODO tree. Git blame age and author, My TODOs and Markdown export are Pro features there (a paid, one-time license after a trial). They are free in TodoForge.

[Better Comments](https://marketplace.visualstudio.com/items?itemName=aaron-bond.better-comments) (about 10.8 million installs, still maintained) colors `// !`, `// ?`, `// *` and `////`. [TODO Highlight](https://marketplace.visualstudio.com/items?itemName=wayou.vscode-todo-highlight) (about 6.2 million installs) last released in 2021. TodoForge can take over those editor colors so you do not need a second extension for them.

| | TodoForge | Todo Tree | Better Todo Tree | TODO Lens |
| --- | --- | --- | --- | --- |
| Maintained (as of November 2026) | ✓ | last release April 2023 | ✓ | ✓ |
| License | MIT | MIT | GPL-3.0 | source-available, no derivatives |
| Tree of TODOs, editor highlights, custom tags | ✓ | ✓ | ✓ | ✓ |
| Works without extra setup on .NET (`bin/`, `obj/`, generated files) | ✓ | needs exclude globs | needs exclude globs | – |
| Ships its own ripgrep | ✓ per-platform build | uses the one inside VS Code | uses the one inside VS Code | uses the one inside VS Code |
| Comment-aware matching (not in strings or names) | ✓ per language | one regex for all files | one regex for all files | – |
| Owner, due date, priority, labels in the comment | ✓ | – | – | – |
| Hover card, quick fixes, snippet | ✓ | – | – | – |
| Changes view (uncommitted / this branch) | ✓ | – | – | – |
| Git blame age and author, `is:mine`, stale | ✓ free | – | – | Pro |
| Pins, mute, saved views, live filter query | ✓ | filter text only | filter text only | My TODOs is Pro |
| Better Comments-style markers (`// !`, `// ?`, `// *`, `////`) | ✓ | – | – | ✓ |
| Theme colors with light-theme contrast | ✓ | custom colors | custom colors | custom colors |
| Insights panel | ✓ | – | – | – |
| Export / copy the current view as Markdown | ✓ free | export | export | export is Pro |
| Import from Todo Tree, Better Todo Tree, Better Comments, Rider, Visual Studio | ✓ | – | imports Todo Tree | – |
| Offline, no account, no telemetry | ✓ | ✓ | ✓ | Pro license for some features |

TodoForge has hide-from-tree, text-after-tag highlights, opacity, borders, a gutter toggle and a wider built-in icon set. Todo Tree and Better Todo Tree still have more highlight knobs (per-tag regexes, large icon packs). If you rely on one TodoForge does not have, tell us in an issue.

## Commands and keys

| Command | Key |
| --- | --- |
| Go to Next TODO in File | `Ctrl+Alt+PageDown` (`Cmd+Alt+PageDown`) |
| Go to Previous TODO in File | `Ctrl+Alt+PageUp` (`Cmd+Alt+PageUp`) |
| Filter… (when the tree has focus) | `Ctrl+Alt+F` (`Cmd+Alt+F`) |
| Quick fixes on a TODO | `Ctrl+.` (`Cmd+.`) |
| Go to TODO… | Command Palette |
| Show My TODOs / Show All TODOs | Command Palette, tree toolbar |
| Show Current File Only / Show All Files | Command Palette, tree toolbar |
| Expand All / Collapse All | Command Palette, tree toolbar |
| Open Saved View… / Save Current View… | Command Palette, tree menu |
| Show Insights | Command Palette, tree menu |
| Import Settings… | Command Palette, tree menu |
| Copy View as Markdown Checklist / Export View as Markdown… or JSON… | Command Palette, tree menu |
| Open Ticket | hover, tree menu |
| Explain TODO with AI… | Command Palette, after you opt in |

## Settings

The defaults are meant to be left alone. The ones people change most:

| Setting | Default | What it does |
| --- | --- | --- |
| `todoforge.general.tags` | `TODO FIXME HACK BUG XXX UNDONE NOTE REVIEW OPTIMIZE` | Tags to find. |
| `todoforge.general.strictTags` | `NOTE BUG REVIEW OPTIMIZE` | Tags that need `:` or `(` after them. |
| `todoforge.general.caseSensitive` | `true` | `todo` in prose is not a TODO. |
| `todoforge.scanning.excludeGlobs` | .NET, node and generated files | Paths to skip. |
| `todoforge.scanning.mode` | `workspace` | Or only open files / the current file. |
| `todoforge.tree.groupBy` | `tag` | `tag`, `file`, `owner`, `subtag`, `flat`. |
| `todoforge.tree.sortBy` | `location` | `location`, `priority`, `due`, `age`. |
| `todoforge.highlighting.style` | `tag` | `tag`, `text` (tag and the text after it), `comment` or `line`. |
| `todoforge.highlighting.inlineHints` | `true` | `overdue 3d` after the line. |
| `todoforge.highlighting.tags` | `{}` | Per-tag colors, icons, ruler, `hideFromTree`, opacity, border. |
| `todoforge.highlighting.gutterIcons` | `true` | Gutter icon next to each TODO. |
| `todoforge.commentMarkers.enabled` | `true` | Better Comments-style `// !`, `// ?`, `// *`, `////` in the editor. |
| `todoforge.general.ticketUrl` | `""` | URL template for `#123` / `JIRA-123`. Opens in the browser on click. |
| `todoforge.tree.autoReveal` | `true` | Reveal the active file in the tree without taking focus. |
| `todoforge.dotnet.codePatterns` | `true` | `NotImplementedException`, `[Obsolete]`, `#warning`. |
| `todoforge.markdown.enabled` | `true` | Find `- [ ]` checklist items. |
| `todoforge.statusbar.format` | `compact` | `2/18 ⚠1`, or per-tag counts. |
| `todoforge.problems.enabled` | `false` | Also list TODOs in Problems. |
| `todoforge.codelens.enabled` | `false` | Pin / Snooze above each TODO. |
| `todoforge.syntax.owner` | `""` | Your name for `is:mine`; empty uses git. |
| `todoforge.stale.afterDays` | `180` | When a TODO counts as stale. |
| `todoforge.git.enabled` | `true` | Changes view, blame, `is:mine`. |
| `todoforge.git.baseBranch` | `""` | Branch for “This branch”; empty detects it. |
| `todoforge.ai.enabled` | `false` | Opt in to Explain TODO with AI. |
| `todoforge.ai.chatTools` | `false` | Opt in to the Copilot Chat tools (`#todos`, `#todoChanges`, `#todo`). |

All 50 settings are listed in the Settings editor under **TodoForge** (**TodoForge: Open Settings**).

## Privacy

- **No network.** TodoForge makes no HTTP requests. Scanning uses the bundled ripgrep; git features run local, read-only git commands. Ticket links and raw URLs open in your browser only when you click them.
- **No telemetry, no account, no sign-in.**
- **Your data stays in VS Code.** Pins, muted TODOs and saved views live in VS Code's workspace and global state. Nothing is written to your repo unless you edit a TODO (snooze, set a date, remove) or export a view.
- **AI is opt-in.** With `todoforge.ai.enabled` on, **Explain TODO with AI** asks for consent once, then sends only the TODO and nearby lines to a chat model you already have in VS Code (for example GitHub Copilot). Off by default, and off in untrusted workspaces.
- **Chat tools are opt-in.** Off by default; turn on `todoforge.ai.chatTools`. When they are on and you chat with Copilot (or another chat model in VS Code) and the model calls a TodoForge tool, the tool returns TODO lines and their metadata (path, line, tag, text, owner, dates, labels, blame author) from TodoForge's local index to that chat. That chat model, and its provider's terms, then see that data, as with any file you attach. TodoForge makes no request itself, never sends surrounding code, and does nothing when you do not chat.
- **Untrusted workspaces.** Scanning and highlights work; git, the workspace's custom regex, AI and the chat tools stay off.

See [SECURITY.md](SECURITY.md) for how to report a problem.

## FAQ

**Does it work with Todo Tree or Better Comments installed?** Yes. Both can run; turn one off if highlights stack. If Better Comments (or Better Comments Next) is installed, TodoForge leaves comment markers to that extension until you set `todoforge.commentMarkers.enabled` yourself. **Import Settings** copies tags, excludes and markers from Todo Tree, Better Todo Tree, Better Comments, Rider and Visual Studio.

**My TODO is not found.** Check that it is in a comment, that the tag is in `todoforge.general.tags`, and that the file is not excluded (`.gitignore`, `files.exclude`, `todoforge.scanning.excludeGlobs`). Strict tags (`NOTE`, `BUG`, …) need a `:` or `(`. The **TodoForge** channel in the Output panel has the details.

**How fast is it?** Activation takes about 50 ms and does not wait for the scan. On a 20,000-file test repo a full scan takes about 50 ms and one changed file about 7 ms.

**Does it support Remote SSH, WSL, Dev Containers and Codespaces?** Yes, it runs where your files are. It does not support virtual workspaces (such as vscode.dev with a GitHub repo) because it needs ripgrep and git.

**Where do pins and saved views go?** VS Code's storage for this workspace (pins, mute) and for you (saved views). Not in your repo.

More answers in [docs/faq.md](docs/faq.md).

## Feedback

Found a bug or missing something? [Open an issue](https://github.com/onurkarakus/todo-forge/issues). Release notes are in [CHANGELOG.md](CHANGELOG.md).

TodoForge is MIT licensed.
