// Interactive TUI for lazy-pi — arrow-key menu, zero dependencies.
// Mirrors gsd-pi's guided installer UX using only Node built-ins.

import * as readline from "node:readline"

// --- ANSI escapes ---
const ESC = "\x1b"
const HIDE_CURSOR = `${ESC}[?25l`
const SHOW_CURSOR = `${ESC}[?25h`
const CLEAR = `${ESC}[2J${ESC}[H`
const LINE_UP = (n) => `${ESC}[${n}A`
const LINE_CLEAR = `${ESC}[2K`

const BOLD = `${ESC}[1m`
const DIM = `${ESC}[2m`
const CYAN = `${ESC}[36m`
const GREEN = `${ESC}[32m`
const YELLOW = `${ESC}[33m`
const RED = `${ESC}[31m`
const MAGENTA = `${ESC}[35m`
const WHITE = `${ESC}[37m`
const RESET = `${ESC}[0m`

const BG_CYAN = `${ESC}[46m`
const BG_RESET = `${ESC}[49m`

function clearScreen() { process.stdout.write(CLEAR) }

// --- Key reader ---
function rawMode(onKey) {
  const wasRaw = process.stdin.isRaw
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding("utf8")

  const handler = (data) => {
    const key = data.toString()
    if (key === "\x03") { cleanup(); process.exit(0) } // Ctrl-C
    onKey(key)
  }
  process.stdin.on("data", handler)

  function cleanup() {
    process.stdin.setRawMode(wasRaw)
    process.stdin.removeListener("data", handler)
    process.stdin.pause()
  }
  return cleanup
}

// --- Spinner ---
function spinner(frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]) {
  let i = 0
  let active = true
  const timer = setInterval(() => {
    if (!active) return
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(`  ${CYAN}${frames[i % frames.length]}${RESET}`)
    i++
  }, 80)
  return {
    stop(msg) {
      active = false
      clearInterval(timer)
      readline.cursorTo(process.stdout, 0)
      if (msg) process.stdout.write(`  ${msg}${LINE_CLEAR}\n`)
    }
  }
}

// --- Menu ---
function menu(title, items, { selected = 0, onSelect, onRender } = {}) {
  return new Promise((resolve) => {
    let idx = selected
    let done = false

    function render() {
      clearScreen()
      header()
      if (title) process.stdout.write(`\n  ${BOLD}${title}${RESET}\n\n`)
      items.forEach((item, i) => {
        const prefix = i === idx ? ` ${CYAN}❯${RESET}` : "  "
        const label = item.label || item
        const style = item.disabled ? DIM : i === idx ? `${BOLD}${CYAN}` : ""
        const suffix = style ? RESET : ""
        process.stdout.write(`${prefix} ${style}${label}${suffix}\n`)
      })
      process.stdout.write(`\n  ${DIM}↑↓ navigate  ↵ select  Ctrl-C quit${RESET}\n`)
      if (onRender) onRender()
    }

    const cleanup = rawMode((key) => {
      if (key === "\x1b[A" || key === "k") { idx = (idx - 1 + items.length) % items.length; render() }       // ↑
      else if (key === "\x1b[B" || key === "j") { idx = (idx + 1) % items.length; render() }                 // ↓
      else if (key === "\r" || key === "\n") {
        const item = items[idx]
        if (item.disabled) return
        done = true
        cleanup()
        process.stdout.write(SHOW_CURSOR)
        if (item.action) item.action()
        else if (onSelect) onSelect(item, idx)
        resolve({ item, idx })
      }
    })

    process.stdout.write(HIDE_CURSOR)
    render()
  })
}

// --- Progress bar ---
function progress(label, steps, work) {
  return new Promise(async (resolve) => {
    clearScreen()
    header()
    process.stdout.write(`\n  ${BOLD}${label}${RESET}\n\n`)
    for (let i = 0; i < steps.length; i++) {
      const spin = spinner()
      const result = await work(steps[i], i)
      spin.stop(`${GREEN}✔${RESET} ${steps[i]}`)
    }
    process.stdout.write(`\n`)
    resolve()
  })
}

// --- Confirm ---
function confirm(question, defaultYes = true) {
  return new Promise((resolve) => {
    const yes = defaultYes ? `${BOLD}Y${RESET}/n` : `y/${BOLD}N${RESET}`
    process.stdout.write(`\n  ${question} ${DIM}(${yes})${RESET} `)

    const cleanup = rawMode((key) => {
      cleanup()
      if (key === "\r" || key === "\n") { process.stdout.write(`${defaultYes ? "Yes" : "No"}\n`); resolve(defaultYes) }
      else if (key === "y" || key === "Y") { process.stdout.write("Yes\n"); resolve(true) }
      else if (key === "n" || key === "N") { process.stdout.write("No\n"); resolve(false) }
      else { process.stdout.write(`${defaultYes ? "Yes" : "No"}\n`); resolve(defaultYes) }
    })
  })
}

// --- Header / Banner ---
function header() {
  process.stdout.write(`\n`)
  process.stdout.write(`  ${BOLD}${CYAN}lazy-pi${RESET} ${DIM}v${pkgVersion()}${RESET}\n`)
  process.stdout.write(`  ${DIM}lazycodex / OmO workflow → Pi / GSD${RESET}\n`)
}

import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
let _version = null
function pkgVersion() {
  if (_version) return _version
  try { _version = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8")).version || "0.0.0" }
  catch { _version = "0.0.0" }
  return _version
}

export {
  clearScreen, menu, progress, confirm, header, spinner,
  BOLD, DIM, CYAN, GREEN, YELLOW, RED, MAGENTA, WHITE, RESET,
  SHOW_CURSOR, HIDE_CURSOR, CLEAR, LINE_CLEAR,
  LINE_UP, BG_CYAN, BG_RESET,
}
