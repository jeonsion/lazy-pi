#!/usr/bin/env node
// lazy-pi CLI entry — thin wrapper around install.mjs so the bundle can run via
//   npx lazy-pi install [--all|--dry-run|--uninstall]
// mirroring lazycodex's `npx lazycodex-ai install`.

import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const installer = join(here, "..", "install.mjs")

const args = process.argv.slice(2)
// `lazy-pi install [flags]` → drop the verb; anything else is forwarded as-is.
const forwarded = args[0] === "install" ? args.slice(1) : args

const result = spawnSync(process.execPath, [installer, ...forwarded], { stdio: "inherit" })

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}
process.exit(result.status ?? 1)
