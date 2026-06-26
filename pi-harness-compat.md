## Pi / GSD Harness Compatibility (READ FIRST)

This skill was authored for the **Codex** and **OpenCode** harnesses. You are running inside
**Pi / GSD (Claude Code)**. The skill body below may show `multi_agent_v1.*`, `call_omo_agent(...)`,
`apply_patch`, `update_plan`, `shell(...)`, or `task(...)`. **Do not call those literally.**
Translate every such example to the Pi-native tool using the tables below. When a code block in the
body conflicts with this section, **this section wins.**

### Tool translation (Codex / OpenCode → Pi)

| Codex / OpenCode example | Pi-native equivalent |
| --- | --- |
| `multi_agent_v1.spawn_agent(...)` | **Prefer inline execution first.** Only dispatch a `subagent` when: (a) ≥2 tasks can run in parallel, (b) the task scans many files and would bloat main context, or (c) the task needs isolated reasoning (reviewer/planner). Otherwise — single small impl, simple QA, targeted file edits — just do it yourself inline. Tokens saved. |
| Several independent `spawn_agent` calls that are genuinely parallel | ONE `subagent` call in **parallel mode**. Do not serialize independent work. |
| `multi_agent_v1.wait_agent(...)` / `send_input` / `close_agent` | Not needed — `subagent` returns the result directly. |
| `call_omo_agent(subagent_type="explore", ...)` | Inline `read` + `rg` + `lsp` for small scope. `subagent` → **scout** only when scanning a broad subsystem. |
| `task(subagent_type="plan", ...)` | Do the planning inline unless the codebase is too large for one context. |
| `task(category=..., ...)` (implementation worker) | Do it inline. You have the full tool surface. Only dispatch to **worker** if the task is independently verifiable and large. |
| `task(category=..., ...)` (QA worker) | Do it inline — run the tests, check the output. |
| `apply_patch` | `edit` (surgical find/replace) or `write` (new file / full rewrite). Always `read` before `edit`. |
| `update_plan` | Use `TaskCreate` / `TaskUpdate` for the visible todo list, or just narrate. |
| `shell(cmd)` / `bash(cmd)` | `bash` (blocks) or `async_bash` (non-blocking, `await_job` later). For servers/watchers use `bg_shell`. |
| `background_output(...)` | `await_job` (for `async_bash`) or `bg_shell` `output`/`digest`. |
| Codex `read_file` / OpenCode `read` | `read` |
| ripgrep via shell for symbol defs | prefer `lsp` (definition/references/symbols); use `rg` for text. |

### When to use subagent vs inline

**Do it inline (no subagent) when:**
- Single file edit, small refactor, targeted fix
- Running tests or verifying output
- Reading ≤5 files
- Any task under ~3 trivial steps

**Use subagent when:**
- ≥2 genuinely independent tasks (parallel dispatch saves wall time)
- Scanning a broad subsystem (10+ files) — keeps main context clean
- External research / doc lookup that would bloat with raw search results
- Reviewer/planner roles that need isolated, focused reasoning

Default: inline. Subagent is the exception, not the rule.

### Agent-role mapping (omo role → Pi/GSD agent)

When you do dispatch a `subagent`, pick the GSD agent from this table.

| omo / lazycodex role | Pi/GSD agent | Use for |
| --- | --- | --- |
| `explorer` / `explore` | **scout** | broad codebase scan (skip for narrow searches — use `rg`/`lsp` inline) |
| `librarian` | **researcher** | external docs/contracts lookup |
| `plan` | **planner** | plan drafting (large codebase) |
| `metis` (gap analysis) | **reviewer** | finding gaps/holes in a plan |
| `momus` (plan reviewer) | **reviewer** | high-accuracy plan review |
| `lazycodex-code-reviewer` | **reviewer** | code review |
| `lazycodex-gate-reviewer` | **reviewer** | final verification gate |
| `lazycodex-qa-executor` | **tester** | complex QA suites (simple QA: inline) |
| generic implementation worker | **worker** | large, independently verifiable implementation units |

### Things that work UNCHANGED in Pi

- **`omo` CLI** is installed (`~/.local/bin/omo`). All `omo ulw-loop ...`, `omo sparkshell ...`,
  `omo boulder ...` commands work as written. Run them with `bash`.
- **Scaffold/helper scripts** shipped in the skill (`node "<skill-root>/scripts/*.mjs"`) work as written.
- **MCP tools** `codegraph_*`, `lsp`, `git_bash`, `grep_app`, `context7` are registered in Pi
  (`~/.gsd/agent/mcp.json`). If a `codegraph_*` tool is absent/cold, fall back to `read`/`rg`/`lsp` as the
  skill already instructs.
- **`.omo/` artifact paths** are unchanged — keep writing plans/drafts/evidence/ledgers under `.omo/`.
  Do not redirect them into `.gsd/` (that is GSD's own state).

### Approval & safety (Pi house rules still apply)

- Planning skills stay **plan-only**: never start implementation until the user explicitly says so.
- Never take outward-facing/destructive actions without explicit user confirmation.
- Verify before claiming done — fresh evidence in the current turn, not "earlier".

<!-- end Pi compat shim; original skill follows -->
