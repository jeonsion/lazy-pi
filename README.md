# lazy-pi

[![npm version](https://img.shields.io/npm/v/lazy-pi?label=npm&logo=npm)](https://www.npmjs.com/package/lazy-pi)
[![npm downloads](https://img.shields.io/npm/dm/lazy-pi?label=downloads&logo=npm&color=red)](https://www.npmjs.com/package/lazy-pi)
[![License: MIT](https://img.shields.io/github/license/jeonsion/lazy-pi?label=license)](https://github.com/jeonsion/lazy-pi/blob/main/LICENSE)

**The [lazycodex](https://github.com/code-yeongyu/lazycodex) workflow, ported to the Pi / GSD ([gsd-pi](https://github.com/open-gsd/gsd-pi)) harness.**

lazycodex distributes [oh-my-openagent (OmO)](https://github.com/code-yeongyu/oh-my-openagent) —
the `ulw-plan` → `start-work` → `ulw-loop` planning-and-execution workflow, code-intelligence MCP
servers, and a set of engineering skills — but it only targets **Codex** and **OpenCode**
(`omo install --platform=codex|opencode|both`). There is no Pi target.

**lazy-pi is that missing target.** It adapts the OmO assets you already have installed so the same
workflow runs inside **Pi / GSD (Claude Code)**, with every Codex/OpenCode-specific construct
translated to a Pi-native equivalent.

> Think of it as `lazycodex` is to Codex what `lazy-pi` is to Pi.

---

## What it does

lazy-pi does **not** reinstall or rebuild OmO. It reuses the binaries and skills OmO already built
under `~/.codex/plugins/cache/sisyphuslabs/omo/<version>/` and re-targets them at Pi:

1. **Skills** — copies the OmO workflow skills into `~/.gsd/agent/skills/` and injects a
   **Pi compatibility shim** ([`pi-harness-compat.md`](./pi-harness-compat.md)) at the top of each.
   The shim is the heart of the port: it translates the Codex/OpenCode constructs the skill bodies
   assume — `multi_agent_v1.spawn_agent`, `call_omo_agent(...)`, `apply_patch`, `update_plan`,
   `shell(...)`, and roles like `explorer` / `librarian` / `momus` — into Pi-native tools
   (`subagent`, `edit`/`write`, `bash`) and the GSD agents that already ship in
   `~/.gsd/agent/agents/` (`scout` / `researcher` / `planner` / `reviewer` / `tester` / `worker`).
   When a skill's code block conflicts with the shim, **the shim wins.**

2. **MCP servers** — registers OmO's `codegraph`, `git_bash`, and `lsp` servers (plus the hosted
   `grep_app` and `context7`) into `~/.gsd/agent/mcp.json`, pointing at the dist binaries OmO
   already built. No recompile.

3. **The `omo` CLI is harness-agnostic** and already on your `PATH` (`~/.local/bin/omo`), so
   `omo ulw-loop ...`, `omo sparkshell ...`, and `omo boulder ...` work from Pi unchanged.

### The translation, at a glance

| Codex / OpenCode construct | Pi-native equivalent |
| --- | --- |
| `multi_agent_v1.spawn_agent({...})` | `subagent` tool (role chosen via the mapping table) |
| several independent spawns | one `subagent` call in **parallel mode** |
| `call_omo_agent(subagent_type="explore")` | `subagent` → **scout** |
| `task(subagent_type="plan")` | `subagent` → **planner** |
| `apply_patch` | `edit` / `write` (always `read` first) |
| `update_plan` | `TaskCreate` / `TaskUpdate` |
| `shell(cmd)` | `bash` / `async_bash` / `bg_shell` |

The full mapping (and the omo-role → GSD-agent table) lives in
[`pi-harness-compat.md`](./pi-harness-compat.md).

---

## Prerequisites

- **Pi / GSD (Claude Code)** installed, with `~/.gsd/agent/` present.
- **OmO already installed for Codex** so the binaries and skills exist locally:
  ```sh
  npx lazycodex-ai install          # or: omo install --platform=codex
  ```
  lazy-pi reads from `~/.codex/plugins/cache/sisyphuslabs/omo/<version>/`; if that path is missing,
  the installer tells you to run the line above first.
- **Node.js ≥ 18.**

## Install

### 1. One-shot — skills + MCP only (recommended first run)

Installs the skills and MCP servers into Pi. The `lazy-pi` command runs from the npx cache and
does not stay on PATH after the terminal closes.

```bash
npx lazy-pi install             # core workflow set (idempotent — safe to re-run)
npx lazy-pi install --all       # also install heavy/peripheral skills
npx lazy-pi install --dry-run   # preview without touching the filesystem
```

### 2. Global install — keep the `lazy-pi` command permanently

After step 1, install globally so `lazy-pi` is always on PATH:

```bash
npm install -g lazy-pi@latest
```

Now just run `lazy-pi` — it shows a live dashboard, or auto-installs if needed:

```bash
lazy-pi                          # dashboard (installed) or auto-install (first run)
lazy-pi status                   # full install details
lazy-pi uninstall                # remove everything lazy-pi added
lazy-pi --help                   # all commands
```

### 3. Clone and run (no npm)

```bash
git clone https://github.com/jeonsion/lazy-pi.git
cd lazy-pi
node install.mjs                # same as `npx lazy-pi install`
```

A re-run re-copies skills from the latest installed OmO version and re-injects a fresh shim, so it
doubles as the **update** path: bump OmO (`omo install --platform=codex`), then re-run `lazy-pi install`.

> After install or uninstall, **start a new Pi session** so the skill loader and MCP client re-scan
> `~/.gsd/agent/skills/` and `~/.gsd/agent/mcp.json`.

## Scope

**Core set (default):** `ulw-plan`, `start-work`, `ulw-loop`, `init-deep`, `review-work`,
`refactor`, `debugging`, `programming`, `rules`, `remove-ai-slops`, `ultraresearch`, `ast-grep`,
`lsp`, `git-master`.

**With `--all`:** also `frontend`, `visual-qa`, `ultimate-browsing`, `teammode`, `comment-checker`,
`lsp-setup`.

**Not ported — the 21 Codex hooks** (auto rule-injection, ultrawork trigger, auto LSP-diagnostics,
telemetry, start-work continuation). Those bind to Codex's hook contract and would need a separate
Pi extension bridging Pi's event system. The skills still work without them — you trigger a workflow
explicitly instead of having a hook auto-fire it.

## Using the workflow in Pi

- **Plan** — say `ulw-plan`, "plan this", or "make a plan". The `ulw-plan` skill loads, explores the
  codebase, asks only genuine owner-decisions, waits for your okay, then writes a decision-complete
  plan under `.omo/plans/`.
- **Execute** — say `start work` / "execute the plan". `start-work` orchestrates implementation
  through Pi subagents (it never implements directly).
- **Durable loop** — say `ulw-loop` / `ulw` for evidence-bound, checkpointed execution via the
  `omo ulw-loop` CLI.
- **Bootstrap project memory** — say `init-deep`.

## Safety & reversibility

- **No clobbering.** If a skill directory already exists and lazy-pi did not create it (checked via
  shim-marker or manifest), it's skipped with a `COLLISION` notice — never overwritten.
- **Backed up.** `~/.gsd/agent/mcp.json` is copied to `mcp.json.lazy-pi-bak` before the first edit.
- **Tracked.** `~/.gsd/agent/.lazy-pi-installed.json` records exactly which skills and MCP servers
  were added, so `uninstall` removes only those and nothing else.
- **Upgrade aware.** Re-running with a newer version logs an upgrade notice and refreshes all skills
  with the latest shim.
- **Isolated artifacts.** Workflow artifacts stay under `.omo/` (plans / drafts / evidence /
  ledgers) and never touch GSD's own `.gsd/` state.

## Layout

```
lazy-pi/
  bin/lazy-pi.js         # npx entry — subcommand router (install / uninstall / status)
  install.mjs            # idempotent installer / updater / uninstaller
  pi-harness-compat.md   # the Pi translation shim injected into every skill
  CHANGELOG.md
  package.json
  README.md
  LICENSE
```

Installed state lives under `~/.gsd/agent/`:

```
~/.gsd/agent/
  .lazy-pi-installed.json   # manifest of installed skills + MCP servers
  mcp.json.lazy-pi-bak      # one-time backup of mcp.json
```

## How it works (internals)

`install.mjs`:

1. Finds the newest OmO plugin version under `~/.codex/plugins/cache/sisyphuslabs/omo/`.
2. For each wanted skill, copies its directory into `~/.gsd/agent/skills/<name>/` and rewrites
   `SKILL.md` — stripping any prior shim, then injecting the current `pi-harness-compat.md` **after**
   the YAML frontmatter's closing `---` so Pi's frontmatter parser (`name` / `description`) stays
   intact and the shim is read first.
3. Deep-merges the five MCP server definitions into `~/.gsd/agent/mcp.json` (creating a one-time
   `.lazypi-bak` backup), pointing each at OmO's already-built dist binary.
4. Writes `~/.gsd/agent/.lazy-pi-installed.json` so the operation is fully reversible
   (and `npx lazy-pi uninstall` finds its manifest even when the bundle cache has been cleaned).

## Credits & license

- Upstream workflow, skills, and MCP servers: **[lazycodex](https://github.com/code-yeongyu/lazycodex)**
  and **[oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)** by
  [Yeongyu Kim](https://github.com/code-yeongyu).
- Target harness: **[gsd-pi](https://github.com/open-gsd/gsd-pi)** (Pi / GSD).

lazy-pi is an independent adapter layer and is not affiliated with or endorsed by the upstream
projects. Skill and MCP content remains under its upstream MIT licenses; the lazy-pi installer and
shim are MIT — see [LICENSE](./LICENSE).
