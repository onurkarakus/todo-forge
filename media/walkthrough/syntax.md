# TODOs with an owner, a date and a priority

Everything in the parentheses is optional, in any order:

```csharp
// TODO(onur, 2026-12-01, !high, #perf): cache the price lookup
// FIXME(@ayse): null check before Save()
// HACK(2026-11-15): remove after the API fix ships
```

| Part | Example | Meaning |
| --- | --- | --- |
| owner | `onur` or `@onur` | who will do it |
| due date | `2026-12-01` | ISO date; turns red when overdue |
| priority | `!high`, `!medium`, `!low` | sort by priority |
| labels | `#perf` | filter with `#perf` |

**Tips**

- Type `TO` inside a comment and pick **TODO(owner, date)** from the suggestions.
- Put the cursor on a TODO and press **Ctrl+.** (Cmd+. on macOS) to snooze it, set a date or priority, or remove it.
- Hover a TODO to see who wrote it and when (from local git blame).
