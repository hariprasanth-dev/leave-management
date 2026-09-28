/**
 * Same-origin API (/api/auth/login) needs repo-root Vercel deploy (../api/index.py + web-api).
 * If Root Directory is only web-app, POST /api/* returns index.html → 405.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

if (process.env.VERCEL !== '1') {
  process.exit(0)
}

const apiEntry = join(process.cwd(), '..', 'api', 'index.py')
const backend = join(process.cwd(), '..', 'web-api', 'gateway', 'main.py')

if (existsSync(apiEntry) && existsSync(backend)) {
  process.exit(0)
}

console.error(`
LeaveFlow Vercel misconfiguration:

  POST /api/auth/login is returning 405 because the Python API is not deployed.

  Fix: Vercel → Project Settings → General → Root Directory → set to "." (repository root),
  not "web-app". Then redeploy.

  See VERCEL_DEPLOY.md in the repo root.

  Alternative: keep Root Directory "web-app" but set VITE_API_BASE_URL to a separate API host
  (e.g. Render) in Vercel env vars — do not use same-origin /api/... in that mode.
`)
process.exit(1)
