# Performance notes

Measured on 2026-11-03 with `npm run perf` and the integration tests on a Linux x64 box (Node 22, VS Code 1.144).

Fixture (`test/fixtures/perf-generated`, written by the script and gitignored):

- 20,000 small `.cs` files under `src/`
- one 10,000-line `Large.cs` with a single TODO
- `bin/` and `obj/` files with TODOs that must be excluded

| Check | Target | 0.1.0 (2026-10-26) | 1.0.0 (2026-11-03) |
| --- | --- | --- | --- |
| Activation (`activate()` returns) | < 100 ms | – | 48–54 ms |
| Full scan, 20k files | < 30 s | 165 ms, 1201 matches | ~51 ms, 1201 matches |
| One-file rescan | < 200 ms | 5 ms | 7 ms |
| Watcher path filter, 100k paths | – | – | ~285 ms (2.8 µs per path) |
| Group by file + filter, 1201 matches | < 50 ms | – | 15 ms |

Notes:

- Activation does not scan. The first scan is scheduled after activation and shows progress on the TODO view only.
- Scan time includes comment-context checks and metadata parsing. The 0.1.0 number used a different machine run; treat the comparison as "same order of magnitude", not a speed-up claim.
- Live edits are parsed in the extension host per changed document with a debounce (`todoforge.scanning.debounceMs`, 400 ms).
- Only scan-related settings trigger a rescan.
