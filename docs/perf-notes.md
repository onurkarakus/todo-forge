# Performance notes

Measured with `npm run perf` and the integration tests on a Linux x64 box (8 cores, Node 22): 1.0.0 on 2026-11-03 (VS Code 1.144), 1.2.0 on 2026-11-21 (VS Code 1.147).

Fixture (`test/fixtures/perf-generated`, written by the script and gitignored):

- 20,000 small `.cs` files under `src/`
- one 10,000-line `Large.cs` with a single TODO
- `bin/` and `obj/` files with TODOs that must be excluded

| Check | Target | 0.1.0 (2026-10-26) | 1.0.0 (2026-11-03) | 1.2.0 (2026-11-21) |
| --- | --- | --- | --- | --- |
| Activation (`activate()` returns, integration harness) | < 100 ms | – | 48–54 ms | 65–215 ms (1.1.2 in the same harness: 44–167 ms) |
| Full scan, 20k files | < 30 s | 165 ms, 1201 matches | ~51 ms, 1201 matches | 55–78 ms, 1201 matches |
| One-file rescan | < 200 ms | 5 ms | 7 ms | 7–10 ms |
| Watcher path filter, 100k paths | – | – | ~285 ms (2.8 µs per path) | 308–318 ms |
| Group by file + filter, 1201 matches | < 50 ms | – | 15 ms | 13 ms |
| Multi-root, 4 × 5,000 files (1200 matches), median of 5 | – | – | – | 75–78 ms one root at a time, 46–51 ms three at once |
| Saved index, 1201 matches (524 KB) | – | – | – | write 3–5 ms, read 3 ms |
| Saved index, 20,000 matches (7.1 MB, the limit is 20,000) | – | – | – | write 33–44 ms, read 26–31 ms |
| Tree shown from the saved index after a reload (integration fixture, 20 TODOs) | – | – | – | 24–72 ms after `start()` |
| Tree refresh plan after one edit, 1201 matches | – | – | – | 5 ms, 1 row refreshed instead of the whole tree |

Notes:

- Activation does not scan. The saved index (if any) is read first, then the first scan is scheduled and shows progress on the TODO view only.
- Activation in the integration harness is noisy: the same machine measured 44–167 ms for 1.1.2 and 65–215 ms for 1.2.0 over three runs each, with no code on the activation path that waits for I/O.
- Package size: each platform VSIX carries one ripgrep binary; see the 1.2.0 sizes in [release.md](release.md).
- Scan time includes comment-context checks and metadata parsing. The 0.1.0 number used a different machine run; treat the comparison as "same order of magnitude", not a speed-up claim.
- Live edits are parsed in the extension host per changed document with a debounce (`todoforge.scanning.debounceMs`, 400 ms).
- Only scan-related settings trigger a rescan.
