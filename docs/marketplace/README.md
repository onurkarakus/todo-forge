# Store listing texts

Ready-to-paste texts for the **Visual Studio Marketplace** and **Open VSX**, in English and Turkish. Nothing here is published automatically.

| File | Use |
| --- | --- |
| [listing.en.md](listing.en.md) | Name, short and long description, keywords, categories, Q&A and screenshot captions (English, primary) |
| [listing.tr.md](listing.tr.md) | The same in Turkish |
| [release-notes-1.0.0.en.md](release-notes-1.0.0.en.md) | 1.0.0 release notes for the store, GitHub release and social posts |
| [release-notes-1.0.0.tr.md](release-notes-1.0.0.tr.md) | Türkçe sürüm notları |

## Where each text lives

| Store field | Source | Notes |
| --- | --- | --- |
| Display name | `package.json` `displayName` → `package.nls.json` `ext.displayName` | VS Code shows `package.nls.tr.json` to Turkish users. The web Marketplace shows English. |
| Short description | `ext.description` in `package.nls.json` / `.tr.json` | Shown on search cards. Searchable. |
| Long description | `README.md` | The whole page body on both stores. English only on the stores. |
| Keywords / tags | `package.json` `keywords` | Maximum 30. Searchable. |
| Categories | `package.json` `categories` | `Other`, `Visualization`. |
| Icon, banner | `media/icon.png`, `galleryBanner` `#14232E` dark | PNG only. |
| Changelog tab | `CHANGELOG.md` | |
| Q&A | Marketplace publisher page setting | Point to GitHub issues (see listing). |

Both stores render README images from **public https URLs**. While the GitHub repo is private, see [../release.md](../release.md#3-readme-images).

## Screenshots in the README (in order)

| File | Caption |
| --- | --- |
| `media/screenshots/demo.gif` | Type a TODO with an owner, date and priority; it appears in the tree with a due hint; snooze it with a quick fix. |
| `01-overview-dark.png` | The TODO tree grouped by tag, highlighted tags, inline due hint, status bar counter. |
| `07-overview-light.png` | Light theme: an overdue HACK, a BUG and a NotImplementedException. |
| `02-hover-dark.png` | Hover card: owner, due date, priority, label, git blame, actions. |
| `03-quick-fix-dark.png` | Quick fixes: snooze, due date, priority, remove, pin, mute. |
| `04-changes-dark.png` | Changes view: uncommitted TODOs and TODOs on this branch. |
| `05-live-filter-dark.png` | Live filter with `is:mine`. |
| `06-insights-dark.png` | Insights: counts, ages from git blame, overdue and oldest TODOs. |
| `09-walkthrough-light.png` | Get Started walkthrough. |
| `08-snippet-light.png` | Snippet completion in a comment. |
