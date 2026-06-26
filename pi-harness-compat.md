## Pi / GSD Harness Compatibility (READ FIRST)

This skill was authored for the **Codex** and **OpenCode** harnesses. You are running inside
**Pi / GSD (Claude Code)**. The skill body below may show `multi_agent_v1.*`, `call_omo_agent(...)`,
`apply_patch`, `update_plan`, `shell(...)`, or `task(...)`. **Do not call those literally.**
Translate every such example to the Pi-native tool using the tables below. When a code block in the
body conflicts with this section, **this section wins.**

### Tool translation (Codex / OpenCode → Pi)

| Codex / OpenCode example | Pi-native equivalent |
| --- | --- |
| `multi_agent_v1.spawn_agent({"message": M, "agent_type": R, "fork_context": false})` | `subagent` tool. Put the full self-contained assignment (TASK / DELIVERABLE / SCOPE / VERIFY) in the prompt. Choose the Pi agent for role `R` via the **Agent-role mapping** table. |
| Several independent `spawn_agent` calls | ONE `subagent` call in **parallel mode** (required when ≥2 ready tasks are independent). Do not serialize independent work. |
| `multi_agent_v1.wait_agent(...)` / `send_input` / `close_agent` | Not needed — the Pi `subagent` dispatch returns the child's result directly. For fan-out, read the parallel results when the call returns. |
| `call_omo_agent(subagent_type="explore", ...)` | `subagent` → **scout** |
| `task(subagent_type="plan", ...)` | `subagent` → **planner** |
| `task(category=..., ...)` (implementation / QA worker) | `subagent` → **worker** (impl) or **tester** (QA) |
| `apply_patch` | `edit` (surgical find/replace) or `write` (new file / full rewrite). Always `read` before `edit`. |
| `update_plan` | Use `TaskCreate` / `TaskUpdate` for the visible todo list, or just narrate. There is no `update_plan` in Pi. |
| `shell(cmd)` / `bash(cmd)` | `bash` (blocks, read result now) or `async_bash` (non-blocking, `await_job` later). For servers/watchers use `bg_shell`. |
| `background_output(...)` | `await_job` (for `async_bash`) or `bg_shell` `output`/`digest`. |
| Codex `read_file` / OpenCode `read` | `read` |
| ripgrep via shell for symbol defs | prefer `lsp` (definition/references/symbols); use `rg` for text. |

### Agent-role mapping (omo role → Pi/GSD agent)

Pass the Pi agent name to `subagent`. These GSD agents already exist in `~/.gsd/agent/agents/`.

| omo / lazycodex role | Pi/GSD agent | Use for |
| --- | --- | --- |
| `explorer` / `explore` | **scout** | internal codebase patterns, conventions, tests, where-things-live |
| `librarian` | **researcher** | external docs/contracts, best-practice lookup |
| `plan` | **planner** | architecture/plan drafting |
| `metis` (gap analysis) | **reviewer** | finding gaps/holes in a plan |
| `momus` (plan reviewer) | **reviewer** | high-accuracy plan review |
| `lazycodex-code-reviewer` | **reviewer** | code review |
| `lazycodex-gate-reviewer` | **reviewer** | final verification gate |
| `lazycodex-qa-executor` | **tester** | execute QA / write & run tests |
| generic implementation worker | **worker** | implement a unit of the plan |

If a needed role has no close match, omit `agent_type` and describe the role fully inside the `subagent`
prompt — the child runs with that prose as its instructions.

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
