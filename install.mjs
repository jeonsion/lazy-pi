#!/usr/bin/env node
// lazypi installer — ports lazycodex/omo skills + MCP servers into Pi / GSD.
//
//   node install.mjs            # install (idempotent)
//   node install.mjs --all      # also port the heavy/peripheral skills
//   node install.mjs --uninstall
//   node install.mjs --dry-run  # print actions, change nothing
//
// Reads the already-installed omo codex plugin (built dist + skills) so the
// omo CLI / MCP binaries are reused as-is. No rebuild needed.

import { homedir } from "node:os"
import { join, dirname } from "node:path"
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync,
  readdirSync, statSync,
} from "node:fs"

const HOME = homedir()
const args = process.argv.slice(2)
const DRY = args.includes("--dry-run")
const ALL = args.includes("--all")
const UNINSTALL = args.includes("--uninstall")

const BUNDLE_DIR = dirname(new URL(import.meta.url).pathname)
const SHIM_PATH = join(BUNDLE_DIR, "pi-harness-compat.md")
const MANIFEST_PATH = join(BUNDLE_DIR, ".installed.json")

const GSD_HOME = join(HOME, ".gsd", "agent")
const SKILLS_DST = join(GSD_HOME, "skills")
const MCP_PATH = join(GSD_HOME, "mcp.json")

// Locate the installed omo plugin (latest version dir under the codex cache).
function findOmoPlugin() {
  const base = join(HOME, ".codex", "plugins", "cache", "sisyphuslabs", "omo")
  if (!existsSync(base)) return null
  const versions = readdirSync(base).filter((v) => existsSync(join(base, v, "skills")))
  if (versions.length === 0) return null
  versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  return join(base, versions[0])
}

const MARK_BEGIN = "<!-- LAZYPI:BEGIN -->"
const MARK_END = "<!-- LAZYPI:END -->"

// Core workflow set (the user-chosen scope). --all adds the heavy/peripheral ones.
const CORE_SKILLS = [
  "ulw-plan", "start-work", "ulw-loop", "init-deep",
  "review-work", "refactor", "debugging", "programming",
  "rules", "remove-ai-slops", "ultraresearch", "ast-grep",
  "lsp", "git-master",
]
const EXTRA_SKILLS = [
  "frontend", "visual-qa", "ultimate-browsing", "teammode",
  "comment-checker", "lsp-setup",
]

const MCP_SERVERS = (pluginRoot) => ({
  grep_app: { url: "https://mcp.grep.app" },
  context7: { url: "https://mcp.context7.com/mcp" },
  codegraph: {
    command: "node",
    args: [join(pluginRoot, "components/codegraph/dist/serve.js")],
    required: false,
  },
  git_bash: {
    command: "node",
    args: [join(pluginRoot, "components/git-bash-mcp/dist/cli.js"), "mcp"],
  },
  lsp: {
    command: "node",
    args: [join(pluginRoot, "components/lsp-daemon/dist/cli.js"), "mcp"],
  },
})

function log(...a) { console.log(...a) }
function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return { skills: [], mcp: [] }
  try { return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) }
  catch { return { skills: [], mcp: [] } }
}
function writeManifest(m) {
  if (DRY) return
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + "\n")
}

// Insert the shim right after the closing `---` of YAML frontmatter, wrapped in markers.
function injectShim(skillMd, shim) {
  const lines = skillMd.split("\n")
  if (lines[0]?.trim() !== "---") {
    // No frontmatter — prepend shim at top.
    return `${MARK_BEGIN}\n${shim}\n${MARK_END}\n\n${skillMd}`
  }
  let close = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") { close = i; break }
  }
  if (close === -1) return `${MARK_BEGIN}\n${shim}\n${MARK_END}\n\n${skillMd}`
  const head = lines.slice(0, close + 1).join("\n")
  const body = lines.slice(close + 1).join("\n")
  return `${head}\n\n${MARK_BEGIN}\n${shim}\n${MARK_END}\n${body}`
}
// Strip a previously injected shim (for clean re-inject / uninstall).
function stripShim(md) {
  const b = md.indexOf(MARK_BEGIN)
  const e = md.indexOf(MARK_END)
  if (b === -1 || e === -1) return md
  const after = md.slice(e + MARK_END.length).replace(/^\n+/, "")
  return md.slice(0, b).replace(/\n+$/, "\n") + "\n" + after
}

function deepMergeMcp(existing, additions, managed) {
  const file = existing && typeof existing === "object" ? existing : {}
  file.mcpServers = file.mcpServers || {}
  for (const [name, cfg] of Object.entries(additions)) {
    file.mcpServers[name] = cfg
    if (!managed.includes(name)) managed.push(name)
  }
  return file
}

function doInstall() {
  const pluginRoot = findOmoPlugin()
  if (!pluginRoot) {
    console.error("ERROR: omo codex plugin not found under ~/.codex/plugins/cache/sisyphuslabs/omo/.")
    console.error("Install omo first:  omo install --platform=codex   (or)  npx lazycodex-ai install")
    process.exit(1)
  }
  log(`omo plugin: ${pluginRoot}`)
  const shim = readFileSync(SHIM_PATH, "utf8").trim()
  const skillSrcBase = join(pluginRoot, "skills")
  const wanted = ALL ? [...CORE_SKILLS, ...EXTRA_SKILLS] : CORE_SKILLS
  const manifest = readManifest()

  if (!existsSync(SKILLS_DST) && !DRY) mkdirSync(SKILLS_DST, { recursive: true })

  // --- Skills ---
  for (const name of wanted) {
    const src = join(skillSrcBase, name)
    const dst = join(SKILLS_DST, name)
    if (!existsSync(src)) { log(`  skip ${name}: not in omo plugin`); continue }
    const alreadyOurs = manifest.skills.includes(name)
    if (existsSync(dst) && !alreadyOurs) {
      log(`  COLLISION ${name}: ${dst} exists and was not created by lazypi — skipping (not overwriting).`)
      continue
    }
    log(`  ${existsSync(dst) ? "update" : "install"} skill: ${name}`)
    if (!DRY) {
      if (existsSync(dst)) rmSync(dst, { recursive: true, force: true })
      cpSync(src, dst, { recursive: true })
      const skillMd = join(dst, "SKILL.md")
      if (existsSync(skillMd)) {
        const raw = stripShim(readFileSync(skillMd, "utf8"))
        writeFileSync(skillMd, injectShim(raw, shim))
      }
    }
    if (!manifest.skills.includes(name)) manifest.skills.push(name)
  }

  // --- MCP servers (global) ---
  const additions = MCP_SERVERS(pluginRoot)
  log(`  register MCP servers -> ${MCP_PATH}: ${Object.keys(additions).join(", ")}`)
  if (!DRY) {
    if (existsSync(MCP_PATH) && !existsSync(MCP_PATH + ".lazypi-bak")) {
      writeFileSync(MCP_PATH + ".lazypi-bak", readFileSync(MCP_PATH, "utf8"))
    }
    let existing = {}
    if (existsSync(MCP_PATH)) {
      try { existing = JSON.parse(readFileSync(MCP_PATH, "utf8")) } catch { existing = {} }
    }
    const merged = deepMergeMcp(existing, additions, manifest.mcp)
    if (!existsSync(dirname(MCP_PATH))) mkdirSync(dirname(MCP_PATH), { recursive: true })
    writeFileSync(MCP_PATH, JSON.stringify(merged, null, 2) + "\n")
  }

  writeManifest(manifest)
  log(`\nDone. Skills: ${manifest.skills.length}, MCP: ${manifest.mcp.length}.`)
  log("Restart Pi / start a new session so it re-scans skills and MCP servers.")
}

function doUninstall() {
  const manifest = readManifest()
  for (const name of manifest.skills) {
    const dst = join(SKILLS_DST, name)
    if (existsSync(dst)) { log(`  remove skill: ${name}`); if (!DRY) rmSync(dst, { recursive: true, force: true }) }
  }
  if (existsSync(MCP_PATH) && manifest.mcp.length) {
    if (!DRY) {
      try {
        const file = JSON.parse(readFileSync(MCP_PATH, "utf8"))
        for (const name of manifest.mcp) delete file.mcpServers?.[name]
        writeFileSync(MCP_PATH, JSON.stringify(file, null, 2) + "\n")
      } catch (e) { console.error(`  could not edit ${MCP_PATH}: ${e.message}`) }
    }
    log(`  removed MCP servers: ${manifest.mcp.join(", ")}`)
  }
  if (!DRY) writeManifest({ skills: [], mcp: [] })
  log("Uninstalled. (mcp.json.lazypi-bak left in place if it was created.)")
}

log(`lazypi ${UNINSTALL ? "uninstall" : "install"}${DRY ? " (dry-run)" : ""}${ALL ? " --all" : ""}`)
if (UNINSTALL) doUninstall()
else doInstall()
