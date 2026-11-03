# Security

## Reporting a problem

Please do not open a public issue for a security problem. Use GitHub's private reporting on this repository (**Security → Report a vulnerability**). You will get an answer within a week.

## What TodoForge does on your machine

- Runs the bundled `ripgrep` binary to read files in your workspace.
- Runs local, read-only `git` commands (`diff`, `ls-files`, `merge-base`, `blame`, `check-ignore`) with `execFile`, never through a shell. It never fetches, pulls or pushes.
- Writes to your files only when you ask: toggle a checklist item, snooze, set a date or priority, assign, remove a TODO, add a TODO, or export a view.
- Stores pins, muted TODOs, the filter and saved views in VS Code's extension storage.

## What it does not do

- No network requests, telemetry, analytics, accounts or sign-in.
- No remote content in webviews: the Insights panel uses a nonce-based Content Security Policy with `default-src 'none'`.

## Untrusted workspaces

In Restricted Mode TodoForge scans and highlights, but:

- git integration is off,
- `todoforge.regex.custom` and `todoforge.git.baseBranch` from the workspace are ignored,
- AI help is off.

## AI

`todoforge.ai.enabled` is off by default. When on, **Explain TODO with AI** asks for consent once and sends the TODO text and a few surrounding lines to the chat model you choose through VS Code's Language Model API. TodoForge does not contact any service itself.

## Supported versions

Security fixes go into the latest release.
