# PRD: TodoForge – Modern, High-Performance TODO Management Extension for VS Code

**Version:** 1.0  
**Date:** 2026-10-25  
**Status:** Draft for Implementation  
**Target:** VS Code Extension (TypeScript)  
**Author:** Onur Karakuş  

---

## 1. Product Overview

### 1.1 Vision
TodoForge is a modern, actively maintained, high-performance replacement for the abandoned Todo Tree extension. It combines lightning-fast workspace scanning with a clean tree view, rich highlighting, and optional lightweight task management. It must work flawlessly on very large codebases (including monorepos and .NET solutions with tens of thousands of files) without degrading editor performance.

### 1.2 Problem Statement
- Original Todo Tree is abandoned, suffers from severe performance issues on large files/projects, causes ripgrep errors, and conflicts with other extensions.
- Better Todo Tree fixed performance but remains a pure scanner + tree.
- Todo It added task management but is still small and not optimized for massive codebases.
- Developers need a single, reliable, fast tool that surfaces TODOs/FIXMEs/HACKs without leaving VS Code, works well with C#, TypeScript, and large solutions, and does not slow down the editor.

### 1.3 Goals
- Be significantly faster and more reliable than Todo Tree and Better Todo Tree on large projects.
- Provide excellent support for .NET / C# / F# / VB projects (including multi-project solutions).
- Offer a familiar tree + highlight experience with modern improvements.
- Include optional lightweight task features without bloating the core.
- Zero impact on other extensions (no global side effects).
- Excellent default experience with deep customization.

### 1.4 Non-Goals (v1)
- Full project management system (Jira/Linear sync is future).
- Built-in AI model (use VS Code Language Model API optionally).
- Cloud storage or accounts.
- Support for every possible comment style out of the box (extensible via regex).

---

## 2. Target Users

1. **Individual developers** working on medium-to-large codebases who use TODO comments heavily.
2. **.NET developers** working with large solutions (Blazor, ASP.NET Core, multi-project).
3. **Teams** that want a lightweight, local TODO overview without external tools.
4. Users migrating from Todo Tree or Better Todo Tree.

---

## 3. Competitor Summary (for context)

| Product              | Strengths                          | Weaknesses                          | TodoForge Advantage          |
|----------------------|------------------------------------|-------------------------------------|------------------------------|
| Todo Tree            | Popular, feature-rich config       | Abandoned, slow, ripgrep bugs       | Active + much faster         |
| Better Todo Tree     | Performance fixes, compatibility   | Still pure scanner                  | Task features + .NET focus   |
| Todo It              | Task management + AI               | Small user base, newer              | Better performance + scale   |
| TODO Highlight       | Lightweight                        | No tree                             | Full tree + more             |

---

## 4. Core Features (Must Have – MVP)

### 4.1 Workspace Scanning
- Use ripgrep (via `@vscode/ripgrep` or bundled) for fast scanning.
- Respect `.gitignore`, `.ignore`, and VS Code exclude settings.
- Support include/exclude globs.
- Scan modes:
  - Full workspace
  - Open files only
  - Current file
  - Workspace + open files
- Incremental updates when files change (debounced).
- Excellent performance on large .NET solutions (10k–50k+ files).
- Support for multi-root workspaces.
- Special handling for .NET projects (respect `bin/`, `obj/`, `.vs/` by default).

### 4.2 Tree View
- Dedicated Activity Bar view (can be moved to Explorer).
- Grouping options:
  - By file (hierarchical)
  - By tag
  - By sub-tag
  - Flat list
- Badges showing counts.
- Click to jump to exact line and column.
- Filter box inside the tree.
- Collapse/Expand all.
- Context menu actions (hide folder, reveal in explorer, etc.).
- Status bar item showing total or per-tag counts.
- Optional Activity Bar badge.

### 4.3 Editor Highlighting
- Highlight tags in open editors.
- Configurable per tag:
  - Foreground / background color
  - Gutter icon (Codicons)
  - Overview ruler marker
  - Font style / weight
- Highlight types: tag only, full comment, whole line.
- Disable highlighting completely.
- Must not cause lag on large files (e.g., 10k+ line C# files).

### 4.4 Tags & Configuration
- Default tags: TODO, FIXME, HACK, BUG, NOTE, XXX, REVIEW, OPTIMIZE.
- User-defined tags.
- Tag groups.
- Sub-tag extraction via regex (e.g., `TODO: #123` or `FIXME@urgent`).
- Case sensitivity setting.
- Custom regex support (with `$TAGS` placeholder).
- Multiline TODO support (configurable).
- Markdown task list support (`- [ ]`, `- [x]`, numbered lists).

### 4.5 .NET / C# Specific
- Excellent default regex for C# comments (`//`, `/* */`, XML docs).
- Ignore common generated folders: `bin/`, `obj/`, `.vs/`, `packages/`, `node_modules/`.
- Support for `.cs`, `.cshtml`, `.razor`, `.fs`, `.vb` files.
- Handle large solution files and multi-project workspaces efficiently.
- Optional: recognize `#pragma warning disable` or specific .NET patterns if useful.

### 4.6 Performance Requirements (Critical)
- First full scan of a large .NET solution (< 30 seconds on typical hardware).
- Subsequent incremental updates < 200 ms.
- No noticeable lag when typing in large files.
- Memory efficient (avoid loading entire files into memory unnecessarily).
- Must not block the extension host or slow down IntelliSense / other extensions.
- Debounced file watcher.

---

## 5. Advanced Features (Should Have)

### 5.1 Lightweight Task Management
- Convert a scanned TODO into a “Tracked Task”.
- Task properties:
  - Title (editable)
  - Priority (High / Medium / Low)
  - Due date
  - Note (multi-line)
  - Subtasks
  - Linked source location(s)
- Checkbox to mark done (optionally update source comment).
- Separate “My Tasks” section or mixed view.
- Drag-and-drop reordering.
- Export tasks to Markdown.

### 5.2 Markdown Checklist Integration
- Detect `- [ ]` and `- [x]` in Markdown files.
- Allow toggling checkbox from the tree (updates the file).
- Group them separately or under a “Markdown” tag.

### 5.3 Navigation & Productivity
- Commands: Go to Next / Previous TODO in current file.
- Reveal current file in tree.
- Quick pick to jump to any TODO.
- Export full tree to Markdown or JSON.

### 5.4 Customization
- Color schemes that cycle automatically.
- Per-tag icons and colors.
- Custom label format in tree (`${tag}: ${text}` etc.).
- Scan scope presets.
- Periodic auto-refresh.
- Refresh on Git HEAD change.

### 5.5 CodeLens (Optional)
- Optional CodeLens above TODO comments:
  - “Track as Task”
  - “Copy”
  - “Explain” (if AI available)

---

## 6. Future / Nice-to-Have Features

- Optional AI features via VS Code Language Model API:
  - Summarize all TODOs
  - Suggest priority
  - Expand cryptic TODOs
- One-click create GitHub Issue from TODO.
- Integration with existing issue trackers (read-only links).
- Sub-tag clickable URLs.
- Better notebook support (Jupyter).
- Vue / Svelte / Astro embedded comment support.
- Telemetry-free, privacy-first.

---

## 7. User Interface

### 7.1 Tree View Layout
```
TodoForge
├── 🔍 Found in Code
│   ├── TODO (42)
│   │   ├── src/Program.cs:15  Implement caching
│   │   └── ...
│   ├── FIXME (7)
│   └── Markdown Checklists (3)
└── 📌 My Tasks
    ├── ☐ High priority item (due tomorrow)
    └── ☑ Completed item
```

### 7.2 Toolbar Actions
- Refresh
- Change view (Tree / Flat / By Tag)
- Filter
- Scan mode selector
- Settings

### 7.3 Status Bar
- Shows count (e.g., “TODOs: 42” or “TODO:12 FIXME:5”)
- Click cycles or opens tree.

---

## 8. Settings Structure (High Level)

```json
{
  "todoforge.general.tags": ["TODO", "FIXME", "HACK", "BUG"],
  "todoforge.scanning.mode": "workspace",
  "todoforge.scanning.excludeGlobs": ["**/bin/**", "**/obj/**", "**/.vs/**"],
  "todoforge.highlighting.enabled": true,
  "todoforge.tree.groupBy": "file",
  "todoforge.tasks.enabled": true,
  "todoforge.regex.custom": ""
}
```

Full settings should be well-documented with descriptions.

---

## 9. Technical Requirements

- Language: TypeScript
- VS Code API: ^1.85.0 or higher
- Use `@vscode/ripgrep` for scanning.
- File watching with debounce.
- No global prototype modifications (especially RegExp).
- Efficient data structures for tree (avoid full rebuilds).
- Support for multi-root workspaces.
- Works offline.
- No telemetry by default.
- Compatible with VS Code, Cursor, VSCodium, Windsurf.

### 9.1 Large Project Optimizations
- Stream ripgrep results.
- Process results in batches.
- Cache scan results intelligently.
- Skip binary and very large files by default.
- Configurable max file size.
- Lazy loading in tree view if needed.

### 9.2 .NET Specific Defaults
```json
"todoforge.scanning.excludeGlobs": [
  "**/bin/**",
  "**/obj/**",
  "**/.vs/**",
  "**/packages/**",
  "**/node_modules/**",
  "**/*.g.cs",
  "**/*.designer.cs"
]
```

---

## 10. Non-Functional Requirements

| Requirement          | Target                                      |
|----------------------|---------------------------------------------|
| First scan (large)   | < 30s for 20k files                         |
| Incremental update   | < 200ms                                     |
| Memory               | Low footprint, no leaks                     |
| Editor responsiveness| No lag while typing                         |
| Startup time         | Extension activation < 500ms                |
| Compatibility        | VS Code 1.85+                               |

---

## 11. Success Metrics

- Positive reviews mentioning speed and reliability.
- Low issue rate related to performance or crashes.
- Migration path from Todo Tree / Better Todo Tree.
- Adoption among .NET developers.

---

## 12. Implementation Notes

- Start with a solid scanning + tree + highlighting core.
- Prioritize performance and .NET defaults from day one.
- Make configuration extensive but with excellent defaults.
- Keep the UI clean and familiar to Todo Tree users.
- Document all settings thoroughly in `package.json` and README.
- Include a migration guide from Todo Tree.

---

## 13. Open Questions

- Exact default regex for maximum language coverage.
- Whether task storage should be in `.vscode/todoforge.json` or workspace state.
- Level of AI integration in v1.

---

**End of PRD**

This document should be used as the single source of truth for implementing TodoForge. All features listed under “Must Have” and “Should Have” are expected in the initial strong release.
