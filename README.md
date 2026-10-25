# TodoForge

**Find TODO and FIXME comments inside the editor.** TodoForge scans the workspace, lists every tag in one tree, and highlights the matches in open files.

You do not have to search the repo by hand. Open the folder, let the scan finish, and the tree shows what is still open. A comment stays in the file until you edit it.

## What you can do

- **See every tag in one tree.** TODO, FIXME, HACK, BUG, NOTE, XXX, REVIEW, and OPTIMIZE are included. Add your own tags in settings.
- **Jump to the line.** Click a row, or use next and previous inside the current file.
- **Keep highlights in the editor.** The tag is marked in open files, and the overview ruler shows the rest of the file.
- **Track the ones that matter.** Send a comment to My Tasks. Priority, a due date, a note, and subtasks stay on this machine.
- **Tick Markdown checklists.** `- [ ]` and `- [x]` are their own group. Toggling one writes the file.
- **Stay fast on large solutions.** Build folders such as `bin/`, `obj/`, and `node_modules/` are skipped. `.gitignore` is honored.

## How a scan works

TodoForge reads comments. A tag inside a string or inside a name such as `todoList` is left out. These comment styles are recognized: `//`, `///`, `/* */`, `#`, `--`, `<!-- -->`, `'`, `@*`, and a block-continuation `*`.

The scan runs across the workspace. Saving a file updates that file. Unsaved editor text is included too. The status bar shows the counts, for example `TODO:12 FIXME:5`.

A sub-tag after the word is picked up. `#123` and `@urgent` can group on their own.

## The tree

The TodoForge icon on the Activity Bar opens the list. The badge is the match count.

The default grouping is by tag. Switch the view to file, sub-tag, or a flat list from the toolbar. Filter narrows the rows. Hide Folder asks before it adds that folder to the exclude list.

With the default label, a tag group shows `file:line` and the comment text. Grouping by file shows the tag and the text.

Copy, Reveal in Explorer, and Track as Task are on the row’s right-click menu. Drag a comment onto My Tasks to track it. If that comment is already tracked, TodoForge leaves the list as it is and tells you.

## Highlights

Highlighting is on by default and colors the tag. You can color the comment or the whole line instead, and you can set a color, a gutter icon, and a ruler lane per tag. Tags without a color use the built-in palette.

## My Tasks

My Tasks sits under the scanned comments. Tracking a comment records the file, the line, and the tag. Marking the task done does not change the comment. Turn on **Update Source On Done** when you want the tag replaced with `DONE`. The scan does not look for `DONE`.

Tasks are stored in VS Code workspace storage, so they are not written into the repo. Choose **Workspace File** to write `.vscode/todoforge.tasks.json` and share that file.

Export writes the current tree, or My Tasks, as Markdown. The tree can also be exported as JSON.

## Markdown checklists

Lines such as `- [ ]`, `- [x]`, `* [ ]`, and `1. [ ]` are listed apart from code tags. Toggle Checkbox updates that line in the file.

## CodeLens

CodeLens is off, so large files stay quiet. Turn it on to show **Track as Task** and **Copy** above a tag.

## Coming from Todo Tree

On first launch, if Todo Tree settings are present and TodoForge is still on its defaults, TodoForge offers to copy the tags, tag groups, include and exclude globs, the custom regex, case sensitivity, and tag colors. Your existing TodoForge settings are left as they are.

## Commands you will use

| Command | What it does |
| --- | --- |
| `TodoForge: Refresh` | Scans again |
| `TodoForge: Set Scan Mode` | Workspace, open files, the current file, or the workspace plus unsaved editors |
| `TodoForge: Change View` | Groups by tag, file, sub-tag, or a flat list |
| `TodoForge: Filter` | Narrows the tree |
| `TodoForge: Clear Filter` | Shows the full tree again |
| `TodoForge: Go to Next TODO` | Moves to the next tag in the current file |
| `TodoForge: Go to Previous TODO` | Moves to the previous tag in the current file |
| `TodoForge: Reveal Current File in Tree` | Shows the active file |
| `TodoForge: Quick Pick TODO` | Jumps to any match |
| `TodoForge: Track as Task` | Adds the comment to My Tasks |
| `TodoForge: Edit Task` | Edits priority, due date, note, and subtasks |
| `TodoForge: Toggle Task Done` | Marks a task or a subtask done |
| `TodoForge: Toggle Checkbox` | Flips a Markdown checklist in the file |
| `TodoForge: Copy` | Copies the row |
| `TodoForge: Reveal in Explorer` | Shows the file in the Explorer |
| `TodoForge: Hide Folder` | Excludes that folder after you confirm |
| `TodoForge: Export Tree to Markdown` | Saves the current tree as Markdown |
| `TodoForge: Export Tree to JSON` | Saves the current tree as JSON |
| `TodoForge: Export Tasks to Markdown` | Saves My Tasks as Markdown |
| `TodoForge: Open Settings` | Opens TodoForge settings |

## Settings

### General

| Setting | What it does | Default |
| --- | --- | --- |
| `todoforge.general.tags` | Comment tags to find | `TODO`, `FIXME`, `HACK`, `BUG`, `NOTE`, `XXX`, `REVIEW`, `OPTIMIZE` |
| `todoforge.general.tagGroups` | Nests tags under group names when grouping by tag | none |
| `todoforge.general.caseSensitive` | Matches tags with exact case | `false` |
| `todoforge.general.subTagRegex` | Reads a sub-tag from the text after the tag | `#123` and `@urgent` |
| `todoforge.general.labelFormat` | Row label. Tokens: `${tag}`, `${text}`, `${file}`, `${line}`, `${subtag}` | `${tag}: ${text}` |

### Scanning

| Setting | What it does | Default |
| --- | --- | --- |
| `todoforge.scanning.mode` | Workspace, open files, current file, or workspace plus unsaved editors | `workspace` |
| `todoforge.scanning.includeGlobs` | Globs to include. Empty includes every text file that is not excluded | none |
| `todoforge.scanning.excludeGlobs` | Globs to skip | `bin`, `obj`, `.vs`, `packages`, `node_modules`, `*.g.cs`, `*.designer.cs` |
| `todoforge.scanning.useGitignore` | Honors `.gitignore` and `.ignore` | `true` |
| `todoforge.scanning.useVsCodeExcludes` | Also honors `files.exclude` and `search.exclude` | `true` |
| `todoforge.scanning.maxFileSizeKb` | Skips files larger than this, in kilobytes | `1024` |
| `todoforge.scanning.debounceMs` | Waits this long after a change before updating | `400` |
| `todoforge.scanning.autoRefreshIntervalSec` | Full rescan interval in seconds. `0` is off | `0` |
| `todoforge.scanning.refreshOnGitHeadChange` | Rescans when `.git/HEAD` changes | `true` |
| `todoforge.regex.custom` | Replaces the built-in comment matcher. Use `$TAGS` for your tag list. An invalid pattern is rejected and the built-in matcher stays in use | empty |
| `todoforge.regex.multiline` | Appends following comment lines to a match | `false` |
| `todoforge.regex.multilineMaxLines` | Extra lines kept when multiline is on | `3` |

### Highlighting

| Setting | What it does | Default |
| --- | --- | --- |
| `todoforge.highlighting.enabled` | Highlights tags in open editors | `true` |
| `todoforge.highlighting.style` | Colors the tag, the comment, or the whole line | `tag` |
| `todoforge.highlighting.tags` | Per-tag color, icon, ruler lane, and font style | built-in palette |

### Tree, tasks, and status

| Setting | What it does | Default |
| --- | --- | --- |
| `todoforge.tree.groupBy` | Groups Found in Code by file, tag, sub-tag, or a flat list | `tag` |
| `todoforge.tree.showActivityBadge` | Shows the match count on the activity bar icon | `true` |
| `todoforge.tasks.enabled` | Shows My Tasks | `true` |
| `todoforge.tasks.storage` | `workspaceState` keeps tasks in VS Code. `workspaceFile` writes `.vscode/todoforge.tasks.json` | `workspaceState` |
| `todoforge.tasks.updateSourceOnDone` | Replaces the linked comment tag with `DONE` when the task is done | `false` |
| `todoforge.markdown.enabled` | Detects Markdown checklists | `true` |
| `todoforge.markdown.groupSeparately` | Places checklists in their own group | `true` |
| `todoforge.codelens.enabled` | Shows Track as Task and Copy above a tag | `false` |
| `todoforge.statusbar.enabled` | Shows counts in the status bar | `true` |
| `todoforge.statusbar.format` | `perTag` lists each tag. `total` shows one number | `perTag` |
| `todoforge.migrateFromTodoTree` | Offers to copy supported Todo Tree settings on first launch | `true` |

## Requirements

- VS Code 1.85.0 or newer

## Privacy

Scanning, highlights, and tasks stay on this machine. TodoForge does not collect or send usage data.

## Feedback

Use the Q&A section on the Marketplace page for questions and requests.

## License

MIT
