#!/usr/bin/env node
// lazy-pi installer — ports lazycodex/omo skills + MCP servers into Pi / GSD.
//
//   node install.mjs            # install (idempotent)
//   node install.mjs --all      # also port the heavy/peripheral skills
//   node install.mjs --uninstall
//   node install.mjs --dry-run  # print actions, change nothing
//
// Reads the already-installed omo codex plugin (built dist + skills) so the
// omo CLI / MCP binaries are reused as-is. No rebuild needed.
//
// This module also exports runInstall()/runUninstall()/readState() so the
// `lazy-pi` CLI (bin/lazy-pi.js) can drive it without spawning a subprocess.

import { homedir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync,
  readdirSync,
} from "node:fs"

const HOME = homedir()
const BUNDLE_DIR = dirname(fileURLToPath(import.meta.url))
const SHIM_PATH = join(BUNDLE_DIR, "pi-harness-compat.md")
const PKG_PATH = join(BUNDLE_DIR, "package.json")

const GSD_HOME = join(HOME, ".gsd", "agent")
const SKILLS_DST = join(GSD_HOME, "skills")
const MCP_PATH = join(GSD_HOME, "mcp.json")
// The manifest lives in the STABLE install target, not next to this script —
// under `npx` the bundle dir is an ephemeral cache, so a bundle-local manifest
// would make `npx lazy-pi uninstall` unable to find what was installed.
const MANIFEST_PATH = join(GSD_HOME, ".lazy-pi-installed.json")
// Legacy bundle-local manifest from older versions — migrated on first run.
const LEGACY_MANIFEST_PATH = join(BUNDLE_DIR, ".installed.json")

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

export function pkgVersion() {
  try { return JSON.parse(readFileSync(PKG_PATH, "utf8")).version || "0.0.0" }
  catch { return "0.0.0" }
}

// Locate the installed omo plugin (latest version dir under the codex cache).
function findOmoPlugin() {
  const base = join(HOME, ".codex", "plugins", "cache", "sisyphuslabs", "omo")
  if (!existsSync(base)) return null
  const versions = readdirSync(base).filter((v) => existsSync(join(base, v, "skills")))
  if (versions.length === 0) return null
  versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  return join(base, versions[0])
}

function readManifest() {
  for (const p of [MANIFEST_PATH, LEGACY_MANIFEST_PATH]) {
    if (existsSync(p)) {
      try {
        const m = JSON.parse(readFileSync(p, "utf8"))
        return { skills: [], mcp: [], version: null, installedAt: null, ...m }
      } catch { /* fall through */ }
    }
  }
  return { skills: [], mcp: [], version: null, installedAt: null }
}
function writeManifest(m, dry) {
  if (dry) return
  if (!existsSync(GSD_HOME)) mkdirSync(GSD_HOME, { recursive: true })
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + "\n")
  // Drop the stale bundle-local manifest once migrated.
  if (existsSync(LEGACY_MANIFEST_PATH) && LEGACY_MANIFEST_PATH !== MANIFEST_PATH) {
    try { rmSync(LEGACY_MANIFEST_PATH) } catch { /* ignore */ }
  }
}

// A skill dir is "ours" if the manifest lists it OR its SKILL.md carries our
// injected shim marker — so skills installed by an earlier bundle/location are
// still recognized (no false COLLISION, and uninstall can reclaim them).
function isOurs(name, manifest) {
  if (manifest.skills.includes(name)) return true
  const skillMd = join(SKILLS_DST, name, "SKILL.md")
  if (!existsSync(skillMd)) return false
  try { return readFileSync(skillMd, "utf8").includes(MARK_BEGIN) } catch { return false }
}

// Insert the shim right after the closing `---` of YAML frontmatter, wrapped in markers.
function injectShim(skillMd, shim) {
  const lines = skillMd.split("\n")
  if (lines[0]?.trim() !== "---") {
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

// Inspect current install state without changing anything (drives `status`).
export function readState() {
  const manifest = readManifest()
  const ours = []
  if (existsSync(SKILLS_DST)) {
    for (const name of readdirSync(SKILLS_DST)) {
      if (isOurs(name, manifest)) ours.push(name)
    }
  }
  let mcp = []
  if (existsSync(MCP_PATH)) {
    try {
      const f = JSON.parse(readFileSync(MCP_PATH, "utf8"))
      mcp = manifest.mcp.filter((n) => f.mcpServers && n in f.mcpServers)
    } catch { /* ignore */ }
  }
  return {
    installedVersion: manifest.version,
    installedAt: manifest.installedAt,
    skills: ours.sort(),
    mcp,
    omoPlugin: findOmoPlugin(),
    manifestPath: MANIFEST_PATH,
  }
}

export function runInstall({ all = false, dry = false, log = console.log } = {}) {
  const pluginRoot = findOmoPlugin()
  if (!pluginRoot) {
    log("ERROR: omo codex plugin not found under ~/.codex/plugins/cache/sisyphuslabs/omo/.")
    log("Install omo first:  omo install --platform=codex   (or)  npx lazycodex-ai install")
    return { ok: false, error: "omo-plugin-not-found" }
  }
  const version = pkgVersion()
  const manifest = readManifest()
  const prior = manifest.version
  if (prior && prior !== version) log(`upgrade: lazy-pi ${prior} -> ${version}`)
  else if (prior) log(`reinstall: lazy-pi ${version}`)
  else log(`install: lazy-pi ${version}`)
  log(`omo plugin: ${pluginRoot}`)

  const shim = readFileSync(SHIM_PATH, "utf8").trim()
  const skillSrcBase = join(pluginRoot, "skills")
  const wanted = all ? [...CORE_SKILLS, ...EXTRA_SKILLS] : CORE_SKILLS

  if (!existsSync(SKILLS_DST) && !dry) mkdirSync(SKILLS_DST, { recursive: true })

  // --- Skills ---
  for (const name of wanted) {
    const src = join(skillSrcBase, name)
    const dst = join(SKILLS_DST, name)
    if (!existsSync(src)) { log(`  skip ${name}: not in omo plugin`); continue }
    if (existsSync(dst) && !isOurs(name, manifest)) {
      log(`  COLLISION ${name}: ${dst} exists and was not created by lazy-pi — skipping (not overwriting).`)
      continue
    }
    log(`  ${existsSync(dst) ? "update" : "install"} skill: ${name}`)
    if (!dry) {
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
  if (!dry) {
    if (existsSync(MCP_PATH) && !existsSync(MCP_PATH + ".lazy-pi-bak")) {
      writeFileSync(MCP_PATH + ".lazy-pi-bak", readFileSync(MCP_PATH, "utf8"))
    }
    let existing = {}
    if (existsSync(MCP_PATH)) {
      try { existing = JSON.parse(readFileSync(MCP_PATH, "utf8")) } catch { existing = {} }
    }
    const merged = deepMergeMcp(existing, additions, manifest.mcp)
    if (!existsSync(dirname(MCP_PATH))) mkdirSync(dirname(MCP_PATH), { recursive: true })
    writeFileSync(MCP_PATH, JSON.stringify(merged, null, 2) + "\n")
  }

  manifest.version = version
  manifest.installedAt = new Date().toISOString()
  writeManifest(manifest, dry)
  log(`\nDone. lazy-pi ${version} — skills: ${manifest.skills.length}, MCP: ${manifest.mcp.length}.`)
  log("Restart Pi / start a new session so it re-scans skills and MCP servers.")
  return { ok: true, version, skills: manifest.skills.length, mcp: manifest.mcp.length }
}

export function runUninstall({ dry = false, log = console.log } = {}) {
  const manifest = readManifest()
  // Reclaim both manifest-listed skills and any shim-bearing skill dir.
  const names = new Set(manifest.skills)
  if (existsSync(SKILLS_DST)) {
    for (const name of readdirSync(SKILLS_DST)) {
      if (isOurs(name, manifest)) names.add(name)
    }
  }
  for (const name of names) {
    const dst = join(SKILLS_DST, name)
    if (existsSync(dst)) { log(`  remove skill: ${name}`); if (!dry) rmSync(dst, { recursive: true, force: true }) }
  }
  if (existsSync(MCP_PATH) && manifest.mcp.length) {
    if (!dry) {
      try {
        const file = JSON.parse(readFileSync(MCP_PATH, "utf8"))
        for (const name of manifest.mcp) delete file.mcpServers?.[name]
        writeFileSync(MCP_PATH, JSON.stringify(file, null, 2) + "\n")
      } catch (e) { log(`  could not edit ${MCP_PATH}: ${e.message}`) }
    }
    log(`  removed MCP servers: ${manifest.mcp.join(", ")}`)
  }
  if (!dry) {
    if (existsSync(MANIFEST_PATH)) rmSync(MANIFEST_PATH)
    if (existsSync(LEGACY_MANIFEST_PATH)) { try { rmSync(LEGACY_MANIFEST_PATH) } catch { /* ignore */ } }
  }
  log(`Uninstalled. (${MCP_PATH}.lazy-pi-bak left in place if it was created.)`)
  return { ok: true, removed: names.size }
}

// Direct-run guard: `node install.mjs [--all|--uninstall|--dry-run]`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2)
  const dry = args.includes("--dry-run")
  const all = args.includes("--all")
  const uninstall = args.includes("--uninstall")
  console.log(`lazy-pi ${uninstall ? "uninstall" : "install"}${dry ? " (dry-run)" : ""}${all ? " --all" : ""}`)
  if (uninstall) runUninstall({ dry })
  else runInstall({ all, dry })
}
