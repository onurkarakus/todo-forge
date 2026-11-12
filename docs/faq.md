# FAQ

## Install and setup

**Do I need to configure anything?** No. The defaults skip build output (`bin/`, `obj/`, `.vs/`, `node_modules/`, generated C#, minified files) and honor `.gitignore`, `files.exclude` and `search.exclude`.

**I use Todo Tree or Better Todo Tree. Can I keep my settings?** Run **TodoForge: Import Settings** and pick the source. Tags, tag groups, include/exclude globs, the custom regex, case sensitivity, custom highlights and ticket URL templates are copied after you confirm. See [migration-from-todo-tree.md](migration-from-todo-tree.md). The same command also imports Better Comments / Better Comments Next markers.

**I come from Rider or Visual Studio.** The same command reads a Rider/ReSharper `.DotSettings` file or a Visual Studio `.vssettings` export and adds their TODO tokens. You can also add their default lists (`TODO, BUG` / `TODO, HACK, UNDONE`).

**Can both Todo Tree and TodoForge run?** Yes, but you will see two highlights. Turn one off per workspace if that bothers you.

**I also use Better Comments.** TodoForge can color `// !`, `// ?`, `// *` and `////` itself (`todoforge.commentMarkers.enabled`). If Better Comments or Better Comments Next is installed, TodoForge leaves those markers alone until you set that setting to `true` in your user or workspace settings, so the two do not fight. You can also turn one of them off.

**How do ticket links work?** Set `todoforge.general.ticketUrl`, for example `https://github.com/org/repo/issues/${token}` or `https://jira.example.com/browse/${token}`. Tokens such as `#123`, `FIXME[JIRA-123]` and `PROJ-123` then become links in the hover card and the tree. Clicking one opens your browser. TodoForge does not call any issue tracker API. Raw `https://` URLs in the comment are always clickable.

## Finding TODOs

**A TODO is missing.** Check, in order:

1. It is in a comment for that file type (strings and names are skipped).
2. The tag is in `todoforge.general.tags` with the same case (or turn off `todoforge.general.caseSensitive`).
3. Strict tags (`NOTE`, `BUG`, `REVIEW`, `OPTIMIZE`) need `:` or `(`.
4. The file is not excluded or larger than `todoforge.scanning.maxFileSizeKb` (1024 KB).
5. The **TodoForge** channel in the Output panel lists scan errors.

**Too many results.** Add globs to `todoforge.scanning.excludeGlobs`, right-click a folder in the tree and choose **Hide Folder from Scans**, mute single TODOs, or set `"hideFromTree": true` on a tag in `todoforge.highlighting.tags` so it stays colored in the editor but is left out of the tree.

**Does it read unsaved changes?** Yes. Open editors are parsed as you type.

## Owners, dates and git

**How does `is:mine` know who I am?** `todoforge.syntax.owner`, or your local `git config user.name` and email. A TODO is yours if its inline owner matches, or if git blame says you wrote the line and it has no other owner.

**Why is the Changes view empty?** It needs a git repository and a trusted workspace. "This branch" compares with `todoforge.git.baseBranch` or the detected default branch; if you are on that branch, only uncommitted TODOs show.

**Does TodoForge fetch from my remote?** No. It only reads local git data.

## Privacy and security

**Does it send anything anywhere?** No network requests, no telemetry, no account.

**What about AI?** Off by default. When you turn on `todoforge.ai.enabled` and run **Explain TODO with AI**, TodoForge asks for consent once, then sends the TODO and nearby lines to a chat model you pick inside VS Code (for example GitHub Copilot). That model's terms apply. TodoForge makes no request itself.

**What do the Copilot chat tools share?** Nothing by default: they are off until you set `todoforge.ai.chatTools` to `true`. When on, only when you chat and the model calls a TodoForge tool: the matching TODO lines with path, line, tag, owner, dates, labels and blame author, from TodoForge's local index, go to the chat model you are using. No surrounding code. TodoForge itself makes no request. Set it back to `false` to turn them off.

**I don't use Copilot.** The tools do nothing without a chat extension, and on VS Code older than 1.95 they are not registered.

**Untrusted workspaces?** Scanning and highlights work. Git commands, the workspace's custom regex, AI and the chat tools are off until you trust the folder.

## Platforms

**Remote SSH, WSL, Dev Containers, Codespaces?** Yes; TodoForge runs on the machine with the files.

**vscode.dev / virtual workspaces?** Not supported, because TodoForge needs ripgrep and git on a real file system.

**Which VS Code versions?** 1.90 and later.

## Data

**Where are pins and saved views stored?** In VS Code's storage: pins, muted TODOs and the current filter per workspace; saved views per user. Nothing is added to your repo.

**What happened to My Tasks from 0.1?** It was replaced by Pins in 1.0. Pin the TODOs you want at the top of the tree.
