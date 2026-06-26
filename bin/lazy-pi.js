#!/usr/bin/env node
// lazy-pi CLI — subcommand router, mirroring gsd-pi's npx UX.
//
//   npx lazy-pi install [--all] [--dry-run]   port skills + MCP into Pi/GSD
//   npx lazy-pi uninstall [--dry-run]          remove everything lazy-pi added
//   npx lazy-pi status                         show what is installed
//   npx lazy-pi --version | -v
//   npx lazy-pi --help | -h
//
// Bare `npx lazy-pi` (no subcommand) runs `install`, matching `npx lazycodex-ai`.

import { runInstall, runUninstall, readState, pkgVersion } from "../install.mjs"

const argv = process.argv.slice(2)
const flag = (...names) => names.some((n) => argv.includes(n))
const VERSION = pkgVersion()

const positional = argv.find((a) => !a.startsWith("-"))
const cmd = positional || (flag("--version", "-v") ? "version" : flag("--help", "-h") ? "help" : "install")

const dry = flag("--dry-run", "-n")
const all = flag("--all")

function help() {
  process.stdout.write(`
  lazy-pi v${VERSION}
  lazycodex / OmO workflow skills + MCP servers, ported into Pi / GSD (Claude Code).

  Usage:
    npx lazy-pi install [--all] [--dry-run]   Install (default). --all adds heavy/peripheral skills.
    npx lazy-pi uninstall [--dry-run]         Remove every skill + MCP server lazy-pi installed.
    npx lazy-pi status                        Show installed version, skills, and MCP servers.
    npx lazy-pi --version, -v                 Print version.
    npx lazy-pi --help, -h                    This help.

  Options:
    --all        Also install peripheral skills (frontend, visual-qa, ultimate-browsing, ...).
    --dry-run    Print what would change without touching the filesystem.

  After install/uninstall, start a NEW Pi session so it re-scans skills and MCP servers.
`)
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

switch (cmd) {
  case "version": process.stdout.write(`${VERSION}\n`); break
  case "help": help(); break
  case "status": status(); break
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
    process.stderr.write(`unknown command: ${cmd}\n`)
    help()
    process.exit(1)
}
