# Ask Copilot about your TODOs

TodoForge can answer questions in Copilot Chat or agent mode (VS Code 1.95 or later) with three read-only tools:

- `#todos` – list and filter TODOs: overdue, due soon, stale, mine, by tag, owner, file or priority
- `#todoChanges` – TODOs you have not committed and TODOs added on this branch
- `#todo` – one TODO with its metadata and git blame

The tools are **off by default**. Turn on `todoforge.ai.chatTools` to use them.

When they are on, they run only when you chat and the model calls them. They send TODO lines and their metadata from TodoForge's index to the chat model you use, never surrounding code. TodoForge makes no network request itself. They stay off in untrusted workspaces.
