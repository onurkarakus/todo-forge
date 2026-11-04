# TodoForge 1.0.0 – release notes

**TodoForge 1.0 turns TODO comments into something you can act on, without leaving the editor or your machine.**

## Highlights

- **Owners, due dates, priorities, labels** – `TODO(onur, 2026-12-01, !high, #perf): …`. Overdue TODOs turn red; due-soon ones show a hint at the end of the line.
- **Hover card and quick fixes** – see who wrote a TODO and when (local git blame), then snooze, set a date or priority, pin, mute or remove it.
- **Changes view** – TODOs you have not committed and TODOs added on your branch.
- **Live filter and saved views** – `is:mine`, `is:overdue`, `is:new`, `is:stale`, `tag:`, `@owner`, `#label`, `path:`.
- **Pins and mute** – keep the important ones on top, hide the noise.
- **Insights** – counts by tag, folder and owner, ages, overdue and oldest TODOs.
- **Theme colors** that work on light themes too, a new icon, a Get Started walkthrough, and Turkish.
- **Import Settings** from Todo Tree, Rider or Visual Studio.
- **Copilot Chat tools** (opt-in) – ask Copilot about your TODOs with `#todos`, `#todoChanges` and `#todo`; read-only, from the local index, off by default (`todoforge.ai.chatTools`).

## Quieter by default

Tags are case-sensitive, and `NOTE`, `BUG`, `REVIEW`, `OPTIMIZE` need a `:` or `(`. Generated and minified files are skipped. Problems and CodeLens are off until you turn them on.

## Privacy

No network, no telemetry, no account. AI help (`todoforge.ai.enabled`) is off by default and only uses a chat model already available in VS Code, after you consent.

Full list: [CHANGELOG.md](../../CHANGELOG.md).
