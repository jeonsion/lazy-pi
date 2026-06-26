#!/usr/bin/env node
// lazy-pi CLI — gsd-pi style TUI entry point.
//
//   lazy-pi                   no args: interactive TUI menu
//   lazy-pi install [--all]   port skills + MCP into Pi/GSD
//   lazy-pi uninstall         remove everything lazy-pi added
//   lazy-pi status            show what is installed
//   lazy-pi --version | -v
//   lazy-pi --help | -h

import { runInstall, runUninstall, readState, pkgVersion } from "../install.mjs"
import {
  clearScreen, menu, confirm, header, spinner, progress,
  BOLD, DIM, CYAN, GREEN, YELLOW, RED, RESET,
  SHOW_CURSOR, HIDE_CURSOR, LINE_CLEAR,
} from "../tui.mjs"

const VERSION = pkgVersion()
const argv = process.argv.slice(2)
const flag = (...names) => names.some((n) => argv.includes(n))
const positional = argv.filter((a) => !a.startsWith("-"))
const cmd = positional[0] || (flag("--version", "-v") ? "version" : flag("--help", "-h") ? "help" : "tui")

const dry = flag("--dry-run", "-n")
const all = flag("--all")

// --- Non-TUI commands (for scripting / explicit invocation) ---

function help() {
  process.stdout.write(`
  ${BOLD}lazy-pi${RESET} v${VERSION}
  lazycodex / OmO workflow skills + MCP servers, ported into Pi / GSD (Claude Code).

  ${BOLD}Usage:${RESET}
    ${CYAN}lazy-pi${RESET}                            Interactive TUI menu.
    ${CYAN}lazy-pi install${RESET} [--all] [--dry-run]   Install skills + MCP. --all adds peripheral skills.
    ${CYAN}lazy-pi uninstall${RESET} [--dry-run]         Remove everything lazy-pi installed.
    ${CYAN}lazy-pi status${RESET}                        Show installed version, skills, and MCP.
    ${CYAN}lazy-pi --version${RESET}, -v                 Print version.
    ${CYAN}lazy-pi --help${RESET}, -h                    This help.

  After install, start a NEW Pi session and type ${BOLD}ulw-plan${RESET} to begin.
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

// --- TUI screens ---

function waitForKey() {
  return new Promise((resolve) => {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")
    const handler = (data) => {
      process.stdin.setRawMode(false)
      process.stdin.removeListener("data", handler)
      process.stdin.pause()
      resolve(data)
    }
    process.stdin.on("data", handler)
  })
}

function guideScreenAfterInstall() {
  clearScreen()
  header()
  process.stdout.write(`\n`)
  process.stdout.write(`  ${GREEN}✔${RESET} ${BOLD}Install complete${RESET}\n\n`)
  process.stdout.write(`  ${BOLD}Next steps:${RESET}\n\n`)
  process.stdout.write(`    1. Start a ${BOLD}new Pi session${RESET}\n`)
  process.stdout.write(`    2. Type one of these commands inside Pi:\n\n`)
  process.stdout.write(`       ${CYAN}ulw-plan${RESET}        plan new work\n`)
  process.stdout.write(`       ${CYAN}start work${RESET}      execute a plan\n`)
  process.stdout.write(`       ${CYAN}ulw-loop${RESET}        evidence-bound delivery loop\n`)
  process.stdout.write(`       ${CYAN}init-deep${RESET}       bootstrap project memory\n`)
  process.stdout.write(`\n  ${DIM}Press any key to return to menu...${RESET}`)
  waitForKey().then(() => mainMenu())
}

function guideScreenAfterUninstall() {
  clearScreen()
  header()
  process.stdout.write(`\n`)
  process.stdout.write(`  ${GREEN}✔${RESET} ${BOLD}Uninstall complete${RESET}\n\n`)
  process.stdout.write(`  All lazy-pi skills and MCP servers have been removed.\n`)
  process.stdout.write(`  ${DIM}Backup at ~/.gsd/agent/mcp.json.lazy-pi-bak was left in place.${RESET}\n`)
  process.stdout.write(`\n  ${DIM}Press any key to return to menu...${RESET}`)
  waitForKey().then(() => mainMenu())
}

function statusScreen() {
  return new Promise((resolve) => {
    const s = readState()
    clearScreen()
    header()
    process.stdout.write(`\n  ${BOLD}Status${RESET}\n\n`)
    if (s.installedVersion) {
      process.stdout.write(`  ${GREEN}●${RESET} version   ${BOLD}v${s.installedVersion}${RESET}  (${s.installedAt?.slice(0, 10) || "?"})\n`)
      process.stdout.write(`  ${GREEN}●${RESET} skills    ${s.skills.length} installed\n`)
      process.stdout.write(`    ${DIM}${s.skills.join(", ")}${RESET}\n`)
      process.stdout.write(`  ${GREEN}●${RESET} MCP       ${s.mcp.length} servers\n`)
      process.stdout.write(`    ${DIM}${s.mcp.join(", ")}${RESET}\n`)
      process.stdout.write(`  ${GREEN}●${RESET} omo       ${s.omoPlugin ? "v" + s.omoPlugin.split("/").pop() : "(not found)"}\n`)
      process.stdout.write(`\n  ${DIM}Manifest:${RESET} ${s.manifestPath}\n`)
    } else {
      process.stdout.write(`  ${YELLOW}●${RESET} ${DIM}Not installed yet.${RESET}\n`)
    }
    process.stdout.write(`\n  ${DIM}Press any key to return...${RESET}`)
    waitForKey().then(resolve)
  })
}

async function runInstallFlow(withAll) {
  clearScreen()
  header()
  process.stdout.write(`\n`)
  const spin = spinner()
  const result = runInstall({ all: withAll, dry: false })
  spin.stop(result.ok ? `${GREEN}✔${RESET} Done` : `${RED}✘${RESET} Failed`)
  if (result.ok) {
    process.stdout.write(`  ${GREEN}●${RESET} Skills: ${result.skills} installed\n`)
    process.stdout.write(`  ${GREEN}●${RESET} MCP servers: ${result.mcp} registered\n`)
    guideScreenAfterInstall()
  } else {
    process.stdout.write(`\n  ${DIM}Press any key to return...${RESET}`)
    await waitForKey()
    await mainMenu()
  }
}

async function runUninstallFlow() {
  clearScreen()
  header()
  process.stdout.write(`\n`)
  const ok = await confirm(`${RED}Remove${RESET} all lazy-pi skills and MCP servers?`, false)
  if (!ok) { await mainMenu(); return }
  const spin = spinner()
  const result = runUninstall({ dry: false })
  spin.stop(result.ok ? `${GREEN}✔${RESET} Done` : `${RED}✘${RESET} Failed`)
  if (result.ok) guideScreenAfterUninstall()
  else {
    process.stdout.write(`\n  ${DIM}Press any key to return...${RESET}`)
    await waitForKey()
    await mainMenu()
  }
}

async function mainMenu() {
  const s = readState()
  const installed = !!s.installedVersion

  const items = [
    {
      label: installed ? "Reinstall / Update skills" : "Install skills",
      action: () => runInstallFlow(false),
    },
    {
      label: "Install with --all  (includes peripheral skills)",
      action: () => runInstallFlow(true),
    },
    {
      label: "Show status",
      action: () => statusScreen().then(() => mainMenu()),
    },
    ...(installed ? [{
      label: "Uninstall",
      action: () => runUninstallFlow(),
    }] : []),
    {
      label: "Quit",
      action: () => {
        clearScreen()
        process.stdout.write(SHOW_CURSOR)
        process.exit(0)
      },
    },
  ]

  await menu("What would you like to do?", items, { selected: installed ? 2 : 0 })
}

// --- Entry ---

switch (cmd) {
  case "version":
    process.stdout.write(`${VERSION}\n`)
    process.exit(0)
  case "help":
    help()
    process.exit(0)
  case "status":
    status()
    process.exit(0)
  case "uninstall": {
    process.stdout.write(`lazy-pi uninstall${dry ? " (dry-run)" : ""}\n`)
    const r = runUninstall({ dry })
    process.exit(r.ok ? 0 : 1)
  }
  case "install": {
    if (!dry && process.stdout.isTTY) {
      // In a TTY, go interactive if no --all flag explicitly set
      // but only if the user explicitly typed `lazy-pi install` (we want to honor it)
      process.stdout.write(`lazy-pi install${all ? " --all" : ""}\n`)
    }
    const r = runInstall({ all, dry })
    process.exit(r.ok ? 0 : 1)
  }
  case "tui":
  default: {
    if (!process.stdout.isTTY) {
      // Non-TTY: auto-install or show status
      const s = readState()
      if (!s.installedVersion) {
        const r = runInstall({ all: false, dry: false })
        process.exit(r.ok ? 0 : 1)
      } else {
        status()
        process.exit(0)
      }
    }
    // TTY: launch interactive menu
    process.on("exit", () => process.stdout.write(SHOW_CURSOR))
    mainMenu()
    break
  }
}
