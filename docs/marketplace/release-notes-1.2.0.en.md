# TodoForge 1.2.0

Faster to open, quicker to triage, smaller to download.

## New

- **Relative due dates.** Inside `TODO(…)`, type `+7d`, `+2w`, `+1m`, `today`, `tomorrow` or a weekday (`monday` … `sunday`) and accept the completion: the real ISO date goes into the comment. Already wrote `TODO(me, +7d)`? Use the **Convert +7d to 2026-11-28** quick fix (`Ctrl+.`) or **TodoForge: Convert Relative Due Dates in This File**. Comments keep a fixed date, so they mean the same thing next week.
- **Bulk actions in the tree.** Select several TODOs with `Ctrl`/`Shift`-click, then snooze, set a due date or priority, assign to yourself, **Assign Owner…**, pin, unpin or mute them all at once. File edits are a single undo step.
- **Instant tree after a reload.** The last scan is kept in VS Code's storage for this workspace and shown as soon as the window opens; a fresh scan then runs in the background. Settings that change what is scanned start from a clean scan.

## Faster

- Only the rows that changed are redrawn when a file changes, so the selection and scroll position stay put.
- Multi-root workspaces scan up to three folders at the same time.
- File watching is scoped to each workspace folder, and is off when TodoForge only scans open files or the current file.
- The Marketplace and Open VSX serve a package for your platform with only its own ripgrep binary: about 2–3 MB instead of about 15 MB.

## Fixed

- An edit made just before a file was deleted or closed could bring its TODOs back until the next full scan.

Offline, no account, no telemetry, as always.
