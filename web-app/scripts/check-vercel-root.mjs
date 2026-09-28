/**
 * Vercel build guard: need either repo-root api + web-api, or web-app/server + web-app/api.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

if (process.env.VERCEL !== '1') {
  process.exit(0)
}

const cwd = process.cwd()
const embeddedBackend = join(cwd, 'server', 'gateway', 'main.py')
const embeddedApi = join(cwd, 'api', 'index.py')
const repoApi = join(cwd, '..', 'api', 'index.py')
const repoBackend = join(cwd, '..', 'web-api', 'gateway', 'main.py')

const okEmbedded = existsSync(embeddedBackend) && existsSync(embeddedApi)
const okRepoRoot = existsSync(repoApi) && existsSync(repoBackend)

if (okEmbedded || okRepoRoot) {
  process.exit(0)
}

console.error(`
LeaveFlow Vercel: Python API is missing from this deployment.

  If Root Directory is "web-app", commit web-app/server (run: npm run sync-server)
  or ensure the build runs sync-server-from-web-api.mjs.

  If Root Directory is ".", use the root vercel.json and set DATABASE_URL in Vercel.

  See VERCEL_DEPLOY.md
`)
process.exit(1)
