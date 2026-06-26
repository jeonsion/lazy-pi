#!/usr/bin/env node
// lazy-pi CLI — gsd-pi style entry point.
//
//   lazy-pi                     no args: install if needed, else show dashboard
//   lazy-pi install [--all]     port skills + MCP into Pi/GSD
//   lazy-pi uninstall           remove everything lazy-pi added
//   lazy-pi status              show what is installed
//   lazy-pi --version | -v
//   lazy-pi --help | -h

import { runInstall, runUninstall, readState, pkgVersion } from "../install.mjs"

const argv = process.argv.slice(2)
const flag = (...names) => names.some((n) => argv.includes(n))
const VERSION = pkgVersion()

const positional = argv.filter((a) => !a.startsWith("-"))
const cmd = positional[0] || (flag("--version", "-v") ? "version" : flag("--help", "-h") ? "help" : "default")

const dry = flag("--dry-run", "-n")
const all = flag("--all")

const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const CYAN = "\x1b[36m"
const GREEN = "\x1b[32m"
const RESET = "\x1b[0m"

function help() {
  process.stdout.write(`
  ${BOLD}lazy-pi${RESET} v${VERSION}
  lazycodex / OmO workflow skills + MCP servers, ported into Pi / GSD (Claude Code).

  ${BOLD}Usage:${RESET}
    ${CYAN}lazy-pi${RESET}                            Install (first run) or show dashboard.
    ${CYAN}lazy-pi install${RESET} [--all] [--dry-run]   Install skills + MCP. --all adds peripheral skills.
    ${CYAN}lazy-pi uninstall${RESET} [--dry-run]         Remove everything lazy-pi installed.
    ${CYAN}lazy-pi status${RESET}                        Show installed version, skills, and MCP.
    ${CYAN}lazy-pi --version${RESET}, -v                 Print version.
    ${CYAN}lazy-pi --help${RESET}, -h                    This help.

  After install, start a NEW Pi session and type ${BOLD}ulw-plan${RESET} to begin.
`)
}

function dashboard() {
  const s = readState()
  const installed = !!s.installedVersion

  process.stdout.write(`\n  ${BOLD}lazy-pi${RESET} ${DIM}v${VERSION}${RESET}\n`)
  process.stdout.write(`  ${DIM}lazycodex / OmO → Pi / GSD adapter${RESET}\n\n`)

  if (installed) {
    process.stdout.write(`  ${GREEN}●${RESET} installed  ${BOLD}v${s.installedVersion}${RESET}  (${s.installedAt?.slice(0, 10) || "?"})\n`)
    process.stdout.write(`  ${GREEN}●${RESET} skills    ${s.skills.length} installed\n`)
    process.stdout.write(`  ${GREEN}●${RESET} MCP       ${s.mcp.length} servers\n`)
    process.stdout.write(`  ${GREEN}●${RESET} omo       ${s.omoPlugin ? "v" + s.omoPlugin.split("/").pop() : "(not found)"}\n`)
    process.stdout.write(`\n  ${BOLD}Ready.${RESET} Start a ${BOLD}new Pi session${RESET} and type:\n\n`)
    process.stdout.write(`      ${CYAN}ulw-plan${RESET}        plan new work\n`)
    process.stdout.write(`      ${CYAN}start work${RESET}      execute a plan\n`)
    process.stdout.write(`      ${CYAN}ulw-loop${RESET}        evidence-bound delivery loop\n`)
    process.stdout.write(`      ${CYAN}init-deep${RESET}       bootstrap project memory\n\n`)
    process.stdout.write(`  ${DIM}Commands:${RESET} lazy-pi ${DIM}install / uninstall / status / --help${RESET}\n\n`)
  } else {
    process.stdout.write(`  ${DIM}Not installed yet.${RESET}\n\n`)
    process.stdout.write(`  Running ${BOLD}lazy-pi install${RESET}...\n\n`)
    const r = runInstall({ all: false, dry: false })
    if (r.ok) {
      process.stdout.write(`\n  ${GREEN}Done.${RESET} Start a ${BOLD}new Pi session${RESET} and type ${CYAN}ulw-plan${RESET} to begin.\n\n`)
    }
  }
}

switch (cmd) {
  case "version":
    process.stdout.write(`${VERSION}\n`)
    break
  case "help":
    help()
    break
  case "status":
    status()
    break
  case "uninstall": {
    process.stdout.write(`lazy-pi uninstall${dry ? " (dry-run)" : ""}\n`)
    const r = runUninstall({ dry })
    process.exit(r.ok ? 0 : 1)
    break
  }
  case "install": {
    process.stdout.write(`lazy-pi install${dry ? " (dry-run)" : ""}${all ? " --all" : ""}\n`)
    const r = runInstall({ all, dry })
    process.exit(r.ok ? 0 : 1)
    break
  }
  default:
    // bare `lazy-pi` — dashboard or auto-install
    dashboard()
    break
}

function status() {
  const s = readState()
  process.stdout.write(`lazy-pi (bundle v${VERSION})\n`)
  process.stdout.write(`  installed version : ${s.installedVersion || "(not installed)"}\n`)
  if (s.installedAt) process.stdout.write(`  installed at      : ${s.installedAt}\n`)
  process.stdout.write(`  omo plugin        : ${s.omoPlugin || "(not found)"}\n`)
  process.stdout.write(`  skills (${s.skills.length})        : ${s.skills.join(", ") || "(none)"}\n`)
  process.stdout.write(`  mcp servers (${s.mcp.length})    : ${s.mcp.join(", ") || "(none)"}\n`)
  process.stdout.write(`  manifest          : ${s.manifestPath}\n`)
}
