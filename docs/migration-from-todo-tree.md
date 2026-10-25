# Migrating from Todo Tree

TodoForge reads a few Todo Tree settings on first launch. It asks before writing anything. If you already changed a TodoForge setting, it leaves your settings alone.

## Copied

| Todo Tree | TodoForge |
| --- | --- |
| `todo-tree.general.tags` | `todoforge.general.tags` |
| `todo-tree.general.tagGroups` | `todoforge.general.tagGroups` |
| `todo-tree.filtering.excludeGlobs` | `todoforge.scanning.excludeGlobs` |
| `todo-tree.filtering.includeGlobs` | `todoforge.scanning.includeGlobs` |
| `todo-tree.regex.regex` | `todoforge.regex.custom` |
| `todo-tree.regex.regexCaseSensitive` | `todoforge.general.caseSensitive` |
| `todo-tree.highlights.customHighlight` | `todoforge.highlighting.tags` |

Unknown icon names in a copied highlight fall back to the built-in icon for that tag.

## Not copied

TodoForge does not import these. Set the TodoForge equivalent yourself if you used them.

- `todo-tree.regex.regexMatches`
- `todo-tree.general.statusBar`
- `todo-tree.tree.*`
- `todo-tree.highlights.defaultHighlight`
- Any other Todo Tree key

Those keys are listed in the TodoForge output channel when a migration runs.

## Turn the prompt off

Set `todoforge.migrateFromTodoTree` to `false`. The prompt is also skipped after you choose Copy Settings or Not Now.
