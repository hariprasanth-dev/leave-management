/**
 * Copy web-api into web-app/server for Vercel (Root Directory = web-app).
 * Run after backend changes: npm run sync-server
 */
import { cpSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const webAppRoot = join(import.meta.dirname, '..')
const src = join(webAppRoot, '..', 'web-api')
const dest = join(webAppRoot, 'server')

const skip = new Set(['.venv', '__pycache__', '.pytest_cache', '.mypy_cache'])

function shouldSkip(part) {
  return skip.has(part)
}

if (!existsSync(src)) {
  if (existsSync(join(dest, 'gateway', 'main.py'))) {
    console.log('Using committed web-app/server (no sibling web-api).')
    process.exit(0)
  }
  console.error('Missing web-api and web-app/server. Clone the full repo.')
  process.exit(1)
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true })
}

cpSync(src, dest, {
  recursive: true,
  filter: (path) => {
    const parts = path.split(/[/\\]/)
    return !parts.some(shouldSkip)
  },
})

console.log('Synced web-api -> web-app/server')
