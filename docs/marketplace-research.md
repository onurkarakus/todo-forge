# What makes a VS Code extension impressive – research and how TodoForge applies it

Research date: 2026-11-03, with Marketplace install counts and Todo Tree issue status re-checked on 2026-11-12. Sources are listed at the end; numbers are as reported by those sources on the date given.

## Summary

People decide in the first screen of the listing and the first minute after install. The extensions that win are the ones that **work with zero configuration**, **show the result in one image above the fold**, and **never surprise the user** (no sign-up, no paywall, no slowdown, no notification spam). Ratings drop when an extension breaks after a VS Code update, needs an external tool, or gets noisy.

## Findings

### 1. The listing is a landing page

- The Marketplace and Open VSX page body is the `README.md`. Visitors read the top and decide; the recommended order is one-sentence promise → short demo GIF/video → install and first use → settings table → known limits → where to report problems. [2][3]
- Display name and description are searchable and appear on search cards. Name + job ("TodoForge – TODO Tree, Highlights & Due Dates") beats a bare brand. [1][3]
- `keywords` are limited to **30** and are included in search tags. [1]
- The icon must be a **PNG** of at least 128×128 (256×256 for Retina); a contrasting `galleryBanner.color` with `theme: dark|light` frames the header. [1][2]
- README images must be **https** and **not SVG** (except trusted badge providers). `vsce` rewrites relative links to the GitHub repo in `package.json`, so a **private repo breaks images**; `--baseImagesUrl` overrides this. [2][3][5]
- GIFs work on the Marketplace and in VS Code; keep them small. Muted MP4 video is also supported and can be paused (accessibility). [4]
- A real `CHANGELOG.md`, `LICENSE`, `repository`, `bugs` and `homepage` links read as "alive"; missing ones read as abandoned. [3]

### 2. What the category leader teaches

Todo Tree (Gruntfuggly) is #1 for "todo" on the Marketplace with about **7.9M installs** (re-checked 12 November 2026: 7,920,230 installs, last update 12 April 2023, version 0.0.226). [6] Its open issues in 2026 are still dominated by **ripgrep not found / ripgrep errors after VS Code 1.122** ([#928](https://github.com/Gruntfuggly/todo-tree/issues/928) still open, 44 comments, last activity 30 September 2026) and commands not found ([#925](https://github.com/Gruntfuggly/todo-tree/issues/925) still open). [7] **Better Todo Tree** (FanaticPythoner.better-todo-tree) is the maintained fork: about **48,000 Marketplace installs** as of 12 November 2026 (version 1.3.4, last update 17 July 2026), licensed **GPL-3.0-only**. [8] **TODO Lens** (branchline.todo-lens) sells git blame age/author, My TODOs and Markdown export as Pro (one-time license after a 7-day trial). Those features stay free in TodoForge. Better Comments remains very large (~10.8M, still updated in November 2026); TODO Highlight (~6.2M) last released in 2021.

Takeaways:

- **Bundle your own dependencies** instead of reaching into VS Code's internals (Todo Tree uses VS Code's bundled ripgrep).
- **Default behavior matters more than options.** Users complain about noise (prose "note", build output) and empty trees, not missing knobs.
- **Being maintained is a feature.** A dated changelog and recent releases are visible trust signals.

### 3. What loses ratings (pattern across low-rated tool extensions)

- Mandatory sign-in or account, upsell or paywall inside the editor.
- Slow activation or scans that block the editor; progress notifications on every save.
- Breaking after VS Code updates; requiring a separate executable.
- Telemetry without a clear opt-out; network calls a company firewall blocks.

### 4. Publishing realities in late 2026

- Azure DevOps **global PATs** are being retired (VS Code docs: December 1, 2026; Azure DevOps blog: existing global PATs stop January 27, 2027). Marketplace now supports **Trusted Publishing** with GitHub Actions OIDC or Azure Pipelines workload identity. [9][10][11]
- Pre-releases: use `major.ODD_MINOR.patch` for pre-release and even minors for stable, and publish with `--pre-release`. [10]
- The verified-publisher check needs a verified domain and at least six months of publishing history. [10]
- Platform-specific VSIX files (`vsce --target`) keep downloads small when you ship a native binary. [10]

## How TodoForge applies this

| Principle | What we did |
| --- | --- |
| Zero config | Works on install; excludes `bin/ obj/ .vs/ node_modules/`, generated C#, minified files; honors `.gitignore`. Walkthrough + welcome views for the empty state. |
| Quiet defaults | Case-sensitive tags; strict `NOTE/BUG/REVIEW/OPTIMIZE`; scan progress only on the view; Problems and CodeLens off; one-time import offer. |
| Own dependencies | Per-platform VSIX with its own ripgrep in `bin/`; no reliance on VS Code internals. |
| Speed is visible | ~50 ms activation; ~51 ms full scan on 20k files; numbers in the README FAQ and `docs/perf-notes.md`. |
| Trust | No network, no telemetry, no account; AI opt-in with consent; strict CSP webview; untrusted-workspace limited mode; `SECURITY.md`. |
| Wow moments | Inline `TODO(owner, date, !prio, #label)` with overdue hints; hover with git blame; Ctrl+. snooze; Changes view for your branch; Insights. |
| Listing | Name + job in `displayName`; 30 keywords; PNG icon + dark banner `#14232E`; GIF first, then screenshots per feature in dark and light; comparison table; settings table; privacy and FAQ. |
| Switching cost | One **Import Settings** command for Todo Tree, Better Todo Tree, Better Comments, Rider and Visual Studio. |
| Accessibility | Light-theme colors tested at ≥ 4.5:1 contrast; theme colors overridable via `workbench.colorCustomizations`. |
| Locale | English and Turkish for UI, manifest and walkthrough. |
| Alive | Dated CHANGELOG, release notes, CONTRIBUTING, docs. |

## Open items

1. Repo is public; README images load from GitHub. A muted looping `demo.mp4` now sits next to the GIF in the README (added 12 November 2026).
2. Set up Trusted Publishing for publisher `onurkarakus` when the next Marketplace upload is done from CI.
3. The Open VSX namespace claim for `onurkarakus` was still pending on 12 November 2026 (`open-vsx.org/api/onurkarakus/todoforge` returned 404). Do not add a live Open VSX badge until the listing exists.

## Sources

1. Extension Manifest reference – https://code.visualstudio.com/api/references/extension-manifest
2. Publishing Extensions – https://code.visualstudio.com/api/working-with-extensions/publishing-extension
3. "How to Promote a VS Code Extension: A Solo Plan" – https://trymy.app/blog/how-to-promote-a-vs-code-extension
4. microsoft/vscode#134514 (video in READMEs instead of pausable GIFs) – https://github.com/microsoft/vscode/issues/134514
5. microsoft/vscode#39374 (images break with a private repo) – https://github.com/Microsoft/vscode/issues/39374
6. VSXRank: Todo Tree – https://vsxrank.com/ext/vscode/gruntfuggly.todo-tree
7. Todo Tree issues – https://github.com/Gruntfuggly/todo-tree/issues
8. "New Maintained Fork – Better Todo Tree" – https://github.com/Gruntfuggly/todo-tree/issues/935
9. Retirement of Global PATs in Azure DevOps – https://devblogs.microsoft.com/devops/retirement-of-global-personal-access-tokens-in-azure-devops/
10. Publishing Extensions (pre-release, platform-specific, verified publisher, secure publishing) – https://code.visualstudio.com/api/working-with-extensions/publishing-extension
11. Trusted Publishing for Visual Studio Marketplace – https://developer.microsoft.com/blog/trusted-publishing-visual-studio-marketplace/
