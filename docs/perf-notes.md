# Performance notes

Measured on 2026-10-26 with `npm run perf` on this machine. The script writes a gitignored fixture at `test/fixtures/perf-generated`, scans it with the same ripgrep runner the extension uses, then scans one changed file.

Fixture:

- 20,000 small `.cs` files under `src/`
- One 10,000-line `Large.cs` with a single TODO
- `bin/` and `obj/` files that contain TODOs and must be excluded

Results:

| Check | Target | Measured |
| --- | --- | --- |
| Full scan | under 30s | 165ms, 1201 matches, 0 ripgrep errors |
| One-file rescan | under 200ms | 5ms, 1 match |

The fixture write itself took 959ms and is not part of the scan time.

`npm test` does not build this fixture. Run `npm run perf` when you want to repeat the check. The generated tree is deleted after a local run if it is still on disk; the script creates it again.

Activation does not scan. `activate()` registers commands, the tree, and listeners, then schedules the scan with `setTimeout(..., 0)`.
