# Fix production login (502 / auth service unavailable)

Production **https://leave-management-suev.onrender.com** is still on **gateway v0.1.0**.  
GitHub **main** has **v0.2.1** with login at **`POST /api/auth/login`**.

Login cannot work until Render runs the new code **and** `DATABASE_URL` points to Neon.

---

## Step 1 — Confirm GitHub (already OK if you pushed latest)

Open:  
https://github.com/hariprasanth-dev/leave-management/blob/main/web-api/gateway/main.py  

First lines should include: `GATEWAY_VERSION = "0.2.1"`

---

## Step 2 — Render service settings

Dashboard → **leave-management** → **Settings**

| Setting | Value |
|---------|--------|
| **Repository** | `hariprasanth-dev/leave-management` |
| **Branch** | `main` |
| **Root Directory** | `web-api` |
| **Runtime** | **Python 3** (recommended) *or* Docker with `gateway/Dockerfile` |

### If Python 3

| | |
|--|--|
| **Build Command** | `bash build.sh` |
| **Start Command** | `uvicorn gateway.main:app --host 0.0.0.0 --port $PORT` |

Build logs must show: `=== LeaveFlow gateway build: 0.2.1 ===`

### If Docker

| | |
|--|--|
| **Dockerfile Path** | `gateway/Dockerfile` |

---

## Step 3 — Environment variables (required)

**Environment** tab → add:

| Key | Value |
|-----|--------|
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | Neon **pooled** string (copy from repo `.env.local` or Neon console → Connection pooling **ON**) |
| `JWT_SECRET` | long random string |
| `FRONTEND_URL` | `https://leave-management-six-ruby.vercel.app` |

Copy Neon URL locally (does not print password):

```powershell
cd D:\MVP\leave-management\web-api
.\scripts\print_neon_database_url_for_render.ps1
```

Paste into Render **DATABASE_URL**, save.

---

## Step 4 — Deploy

**Manual Deploy** → **Clear build cache & deploy**

Wait until **Live**.

---

## Step 5 — Verify (must pass)

```text
https://leave-management-suev.onrender.com/health/version
→ {"gateway_version":"0.2.1","auth":"built-in",...}

https://leave-management-suev.onrender.com/docs
→ POST /api/auth/login under tag "auth"

https://leave-management-suev.onrender.com/health/db
→ "status":"ok", host contains neon.tech (not 127.0.0.1)
```

If `/health/version` is **404**, Render is **still on old code** — recheck Root Directory = `web-api` and branch = `main`.

---

## Step 6 — Vercel

Root Directory: **web-app**  
Env: `VITE_API_BASE_URL=https://leave-management-suev.onrender.com`  
Redeploy frontend.

---

## Step 7 — Test login

https://leave-management-six-ruby.vercel.app/login  
`employee@example.com` / `password123`

---

## If Render never updates

1. **Settings → Build & Deploy** → disconnect Git, reconnect same repo.  
2. Confirm latest commit SHA on deploy event matches GitHub `main`.  
3. Delete the Render service and create it again with Root Directory `web-api` (optional).
