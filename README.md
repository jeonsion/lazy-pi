# lazy-pi

**lazycodex workflow, for Pi (GSD).**

The [lazycodex](https://github.com/code-yeongyu/lazycodex) planning-and-execution workflow — `ulw-plan`, `start-work`, `ulw-loop`, and 11 more engineering skills — ported into the Pi / GSD harness. Type `ulw-plan` inside Pi and go.

lazycodex targets Codex and OpenCode only. lazy-pi is the Pi target.

## Quick start

```bash
npx lazy-pi install        # install 14 skills + 5 MCP servers
```

Then **restart Pi** and type `ulw-plan`.

## What you get

### 14 workflow skills

| Skill | What it does |
|---|---|
| `ulw-plan` | Explore codebase, ask only real decisions, write a plan |
| `start-work` | Execute a plan through Pi subagents |
| `ulw-loop` | Evidence-bound, checkpointed delivery |
| `init-deep` | Bootstrap project memory |
| `review-work` | Post-implementation review with 5 parallel agents |
| `refactor` | Intelligent refactoring |
| `debugging` | Hypothesis-driven debugging |
| `programming` | Type-safe code (Python/Rust/TypeScript/Go) |
| `remove-ai-slops` | Clean AI-generated code smells |
| `ultraresearch` | Maximum-saturation research |
| `ast-grep` | AST-aware search and rewrite |
| `lsp` | Language-server diagnostics and navigation |
| `git-master` | Atomic commits, rebase, bisect, blame |
| `rules` | Project rule injection |

### 5 MCP servers

`codegraph`, `git_bash`, `lsp`, `grep_app`, `context7` — all registered in `~/.gsd/agent/mcp.json`, reusing OmO's already-built binaries.

## Commands

```bash
npx lazy-pi install                 # install (idempotent)
npx lazy-pi install --all           # + peripheral skills
npx lazy-pi install --dry-run       # preview
npx lazy-pi uninstall               # remove everything
```

## Prerequisites

- Pi / GSD installed
- OmO installed for Codex: `npx lazycodex-ai install`
- Node.js ≥ 18

## How it works

`install.mjs` finds your existing OmO plugin, copies skills into `~/.gsd/agent/skills/`, injects a Pi translation shim into each, and registers MCP servers. No rebuild, no recompile — it reuses what OmO already built.

## Credits

Upstream: [lazycodex](https://github.com/code-yeongyu/lazycodex) / [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) by Yeongyu Kim.
Target: [gsd-pi](https://github.com/open-gsd/gsd-pi).

MIT License.
