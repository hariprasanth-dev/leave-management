# LeaveFlow API

Python FastAPI microservices for the LeaveFlow leave management platform.

## Architecture

```
Frontend
   ↓
FastAPI (gateway + services)
   ↓
Service
   ↓
Repository
   ↓
PostgreSQL
```

## Services

| Service | Port | Responsibility |
|---------|------|----------------|
| **gateway** | 8000 | API gateway |
| **auth-service** | 8001 | Login, JWT, current user |
| **employee-service** | 8002 | Employees & org |
| **leave-service** | 8003 | Requests & balances |
| **approval-service** | 8004 | Approve / reject + audit |

## Quick start (local PostgreSQL)

1. Create a database named **`leave_management_api`** (Postgres 16+).  
   Do **not** use `leave_management_db` — the API does not write there.
2. Copy env and set credentials if needed:

```bash
copy .env.example .env
```

Default connection:

```
postgresql+psycopg://postgres:postgres@127.0.0.1:5432/leave_management_api
```

### Where data lives (pgAdmin / DBeaver)

| What you added in the UI | Tables / views to open |
|--------------------------|------------------------|
| Employee (name, email) | `users` + `employees`, or view **`v_employee_directory`** |
| Leave request | `leave_requests`, or view **`v_leave_request_list`** |
| Leave balances | `leave_balances` |

`employees` has codes and FKs only — **full name and email are on `users`**.

Confirm the live connection: [http://127.0.0.1:8000/health/db](http://127.0.0.1:8000/health/db)

3. Install, migrate, seed:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python scripts/seed.py
```

4. Start all services:

```bash
.\scripts\start-local.bat
```

- Gateway docs: http://127.0.0.1:8000/docs

## Quick start (Neon cloud PostgreSQL)

Neon is PostgreSQL. Link the project from the **repo root** (creates gitignored `.env.local` with `DATABASE_URL`). The Python API reads `.env.local` automatically.

```powershell
cd D:\MVP\leave-management
npm i -g neon@latest
neon login
neon link --project-id solitary-art-85510321 --branch production -y
neon config init
# edit neon.ts, then:
neon deploy

cd web-api
.\scripts\setup_neon.ps1
.\scripts\start-local.bat
```

Or migrate manually:

```powershell
cd D:\MVP\leave-management\web-api
$env:PYTHONPATH = (Get-Location).Path
.\.venv\Scripts\alembic.exe upgrade head
python scripts\seed.py
python scripts\verify_db.py
```

Confirm: [http://127.0.0.1:8000/health/db](http://127.0.0.1:8000/health/db) (host should include `neon.tech`).

**Render:** set `DATABASE_URL` to the Neon **pooled** connection string (same as `.env.local`).

## Demo credentials

- `employee@example.com` / `password123`
- `manager@example.com` / `password123`

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/seed.py` | Demo users, policy, balances |
| `scripts/reset_db.py` | Drop/recreate schema, migrate, seed |
| `scripts/e2e_leaves.py` | Leave workflow smoke test |
| `scripts/e2e_employees.py` | Employee CRUD smoke test |
| `scripts/setup_neon.ps1` | Migrate + seed using Neon `.env.local` |
| `scripts/verify_db.py` | Test DB connection and tables |
| `scripts/start-local.bat` | Start gateway + 4 services |

## Deploy on Render (with Vercel frontend)

The API is **five processes locally** (gateway + 4 services). A Render web service must run **all of them**, not `gateway/Dockerfile` alone — otherwise `/api/auth/login` returns **502** (`auth service unavailable`).

1. **Root directory:** `web-api`
2. **Runtime:** Docker
3. **Dockerfile:** `Dockerfile` (repo root under `web-api`, not `gateway/Dockerfile`)
4. **Environment variables** (Render dashboard):
   - `DATABASE_URL` — Neon pooled URI (`postgresql://…neon.tech/…`)
   - `JWT_SECRET` — strong random string
   - `FRONTEND_URL` — your Vercel URL (e.g. `https://leave-management-six-ruby.vercel.app`)
5. After deploy, check:
   - [https://YOUR-SERVICE.onrender.com/health/version](https://YOUR-SERVICE.onrender.com/health/version) — must show **`gateway_version`: `0.2.0`** and **`auth`: `built-in`**. If you still see only `/health` in Swagger with no **`POST /api/auth/login`**, Render is serving an **old build** — use **Manual Deploy → Clear build cache & deploy**.
   - [https://YOUR-SERVICE.onrender.com/openapi.json](https://YOUR-SERVICE.onrender.com/openapi.json) — must include **`/api/auth/login`**
   - [https://YOUR-SERVICE.onrender.com/health/services](https://YOUR-SERVICE.onrender.com/health/services) — `auth` should be on the gateway; other services may be `unreachable` until you use the full `Dockerfile` + `start-production.sh`
   - `/health/db` — should show a **Neon** host (`neon.tech`), not `127.0.0.1`. Use the same `DATABASE_URL` as repo `.env.local`.

Optional: use `render.yaml` in this folder as a Render Blueprint template.

## Layout

```
web-api/
├── alembic/
├── gateway/
├── scripts/
├── services/
│   ├── auth_service/
│   ├── employee_service/
│   ├── leave_service/
│   └── approval_service/
├── shared/
│   ├── auth/
│   ├── db/
│   ├── models/
│   ├── repositories/
│   ├── services/
│   ├── schemas.py
│   └── config.py
├── docker-compose.yml
└── requirements.txt
```
