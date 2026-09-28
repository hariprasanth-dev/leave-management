# Vercel full-stack deploy (frontend + API on one domain)

Render is optional. This setup runs the FastAPI gateway on **Vercel serverless** with **Neon**.

## 1. Vercel project settings

| Setting | Value |
|---------|--------|
| **Root Directory** | `.` (repository root, **not** `web-app`) |
| **Framework** | Other (uses root `vercel.json`) |

### Login returns **405 Method Not Allowed**?

The Network tab shows `POST /api/auth/login` with response `index.html` — the SPA rewrite is handling `/api` instead of the Python gateway.

**Fix:** Vercel → **Settings → General → Root Directory** → clear the field or set to **`.`** (repo root), **not** `web-app`. Redeploy. Then open `/health/version` (must return JSON, not the login page).

If Root Directory must stay `web-app`, set **`VITE_API_BASE_URL`** to your API host (e.g. Render) and redeploy; do **not** use empty same-origin `/api` in that mode.

## 2. Environment variables (Production)

Copy from Neon (repo `.env.local`):

```powershell
cd web-app\..\web-api
.\scripts\print_neon_database_url_for_render.ps1
```

Set in Vercel → Settings → Environment Variables:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Neon pooled connection string |
| `ENVIRONMENT` | `production` |
| `JWT_SECRET` | long random string |
| `FRONTEND_URL` | `https://leave-management-six-ruby.vercel.app` |
| `INLINE_SERVICES` | `1` (set automatically in `api/index.py`) |

Do **not** set `VITE_API_BASE_URL` — the app calls `/api/...` on the same domain.

## 3. Deploy

Push to `main` or redeploy in Vercel dashboard.

## 4. Verify

- `https://YOUR-APP.vercel.app/health/version` → `"gateway_version":"0.3.0"`
- `https://YOUR-APP.vercel.app/health/db` → `"status":"ok"`, host contains `neon.tech`
- Login at `/login` with `employee@example.com` / `password123`

Response header `X-Gateway-Version: 0.2.2` on any API call.

## 5. Render (optional)

If you still use Render, follow `web-api/RENDER_DEPLOY.md`. Until Render shows v0.2.2, use Vercel API instead.
