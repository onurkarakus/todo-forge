# Migrating from Todo Tree, Better Comments, Rider or Visual Studio

Run **TodoForge: Import Settings…** from the Command Palette or the TODO view's `…` menu. TodoForge shows what it will write and asks before changing anything. Settings are written to your user settings.

On the first start after install, if Todo Tree settings exist, TodoForge offers this once. Turn the offer off with `todoforge.migrateFromTodoTree: false`.

## From Todo Tree

| Todo Tree | TodoForge |
| --- | --- |
| `todo-tree.general.tags` | `todoforge.general.tags` |
| `todo-tree.general.tagGroups` | `todoforge.general.tagGroups` (converted to `[{ name, tags }]`) |
| `todo-tree.filtering.excludeGlobs` | `todoforge.scanning.excludeGlobs` |
| `todo-tree.filtering.includeGlobs` | `todoforge.scanning.includeGlobs` |
| `todo-tree.regex.regex` | `todoforge.regex.custom` |
| `todo-tree.regex.regexCaseSensitive` | `todoforge.general.caseSensitive` |
| `todo-tree.highlights.customHighlight` | `todoforge.highlighting.tags` (including `hideFromTree`, opacity and border when present) |
| `todo-tree.tree.subTagClickUrl` | `todoforge.general.ticketUrl` |

Unknown icon names in a copied highlight fall back to the built-in icon for that tag. Keys TodoForge does not copy are listed in the **TodoForge** Output channel.

Tip: Todo Tree's default regex is close to TodoForge's built-in matcher. If you never changed it, leave `todoforge.regex.custom` empty to get comment-aware matching and inline metadata.

## From Better Todo Tree

Choose **Better Todo Tree**. The same keys are read from `better-todo-tree.*`, with a fallback to leftover `todo-tree.*` values if you kept them after the rebrand.

## From Better Comments / Better Comments Next

Choose **Better Comments** or **Better Comments Next**. Marker tags (`!`, `?`, `*`, `//` and any custom ones) become `todoforge.commentMarkers.tags`. Words that are already TodoForge tags, such as `TODO` or `FIXME`, are skipped so they stay in the tree instead of becoming editor-only decorations.

## From JetBrains Rider / ReSharper

Choose **JetBrains Rider / ReSharper** and pick a `.DotSettings` file (for example `YourSolution.sln.DotSettings`). TodoForge reads the TODO patterns and adds their tag names to `todoforge.general.tags`. Or choose **Rider defaults** to add `TODO, BUG`.

## From Visual Studio

Export your settings in Visual Studio (**Tools → Import and Export Settings → Export**, include **Environment → Task List**) and pick the `.vssettings` file. TodoForge adds the Task List tokens. Or choose **Visual Studio defaults** to add `TODO, HACK, UNDONE`.

## What has no equivalent

- Todo Tree's per-tag `regex` and icon packs beyond TodoForge's built-in set. Hide-from-tree, text highlights, opacity, borders and the gutter toggle are available in TodoForge.
- Todo Tree's `tree.*` layout keys: use **Group By** and **Sort By** in the TODO view.
- Visual Studio Task List priorities per token: use `!high` in the TODO instead.
