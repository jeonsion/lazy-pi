# Changelog

All notable changes to lazy-pi will be documented in this file.

## [0.2.0] - 2026-06-26

### Added

- **Stable manifest location** — `.lazy-pi-installed.json` now lives under `~/.gsd/agent/` instead of the bundle directory, so `npx lazy-pi uninstall` can always find what was installed even when the bundle cache has been cleaned.
- **`npx lazy-pi status`** — shows installed version, skill list, MCP servers, omo plugin path.
- **`npx lazy-pi --version` / `-v`** — print version and exit.
- **`npx lazy-pi --help` / `-h`** — usage summary.
- **Shim-marker recognition** — `isOurs()` now scans `SKILL.md` for the `<!-- LAZYPI:BEGIN -->` marker, so skills installed by an earlier version or a different bundle location are correctly recognized (no false COLLISION) and can be reclaimed by `uninstall`.
- **Upgrade awareness** — `install.mjs` detects when the running version differs from the installed version and logs an upgrade notice.
- **CHANGELOG.md** — this file.

### Changed

- **`bin/lazy-pi.js`** — rewritten as a subcommand router (`install` / `uninstall` / `status`) instead of a thin proxy, matching gsd-pi's CLI style.
- **`install.mjs`** — refactored into exported functions (`runInstall`, `runUninstall`, `readState`, `pkgVersion`) so the CLI can drive it without spawning a subprocess.
- **Manifest migration** — legacy bundle-local `.installed.json` is auto-migrated to `~/.gsd/agent/.lazy-pi-installed.json` on first run.
- **MCP backup renamed** — the one-time backup of `mcp.json` is now `mcp.json.lazy-pi-bak` (was `mcp.json.lazypi-bak`).

## [0.1.0] - 2026-06-25

### Added

- Initial release.
- `install.mjs` — idempotent installer that copies OmO workflow skills into `~/.gsd/agent/skills/` and registers MCP servers into `~/.gsd/agent/mcp.json`.
- `pi-harness-compat.md` — the Pi translation shim injected into every skill.
- `bin/lazy-pi.js` — basic `npx` entry point.
- `package.json`, `README.md`, `LICENSE`.
- Core skill set (14 skills) + 5 MCP servers (`grep_app`, `context7`, `codegraph`, `git_bash`, `lsp`).
- `--all` flag for peripheral skills.
- `--uninstall` for manifest-based removal.
- `--dry-run` for preview.
- Collision protection — never overwrites a skill directory lazy-pi did not create.
