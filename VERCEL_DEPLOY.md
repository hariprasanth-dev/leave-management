# Vercel full-stack deploy (frontend + API on one domain)

Render is optional. This setup runs the FastAPI gateway on **Vercel serverless** with **Neon**.

## 1. Vercel project settings

Either layout works:

| Root Directory | Config used |
|----------------|-------------|
| **`web-app`** (common) | `web-app/vercel.json` + `web-app/api/index.py` + bundled `web-app/server/` |
| **`.`** (repo root) | Root `vercel.json` + `api/index.py` + `web-api/` |

After backend changes, refresh the bundle before push:

```powershell
cd web-app
npm run sync-server
git add server
```

| Setting | Value |
|---------|--------|
| **Framework** | Vite (if Root = `web-app`) or Other (if Root = `.`) |

### Login returns **405 Method Not Allowed**?

`POST /api/auth/login` must hit **`/api/index.py`**, not `index.html`. Redeploy after pulling the latest `web-app/vercel.json` (rewrites to `/api/index.py`).

Open **`/health/version`** in the browser — you must see JSON (`gateway_version`), not the login page.

## 2. Environment variables (Production)

Copy from Neon (repo `.env.local`):

```powershell
cd web-app\..\web-api
.\scripts\print_neon_database_url_for_render.ps1
```

Set in Vercel → Settings → Environment Variables (**Production** — required for login):

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Neon **pooled** connection string (from `.env.local` or Neon dashboard) |
| `ENVIRONMENT` | `production` |
| `JWT_SECRET` | Random string **at least 32 characters** (Vercel “Generate” is fine) |
| `FRONTEND_URL` | `https://leave-management-six-ruby.vercel.app` |

If login returns **500** / `FUNCTION_INVOCATION_FAILED`, the API usually starts without `DATABASE_URL` or `JWT_SECRET`. After adding them, **Redeploy** (env vars apply only on new deployments).

Optional: `RUN_MIGRATIONS=1` (default) runs `alembic upgrade head` on each cold start so Neon has tables like `login_attempts`.

Do **not** set `VITE_API_BASE_URL` — the app calls `/api/...` on the same domain.

## 3. Deploy

Push to `main` or redeploy in Vercel dashboard.

### Build fails with `externally-managed-environment` / `pip install`

Do **not** run `pip install` in Vercel **Install Command**. Leave it as **`npm install`** only (see `web-app/vercel.json`). Vercel installs Python deps from **`web-app/api/requirements.txt`** automatically when it builds `api/index.py`.

In the dashboard: **Settings → Build & Development → Install Command** → override **Off**, or set to `npm install` only.

## 4. Verify

- `https://YOUR-APP.vercel.app/health/version` → `"gateway_version":"0.3.0"`
- `https://YOUR-APP.vercel.app/health/db` → `"status":"ok"`, host contains `neon.tech`
- Login at `/login` with `employee@example.com` / `password123`

Response header `X-Gateway-Version: 0.2.2` on any API call.

## 5. Render (optional)

If you still use Render, follow `web-api/RENDER_DEPLOY.md`. Until Render shows v0.2.2, use Vercel API instead.
