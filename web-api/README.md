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

## Quick start (Supabase)

Use the same **host / port / database / user** as Supabase → **Connect** (direct connection).

1. Copy env: `copy .env.example .env`
2. Set **`DATABASE_PASSWORD`** to the **database password** from **Project Settings → Database** (reset there if needed — not the API anon/service keys).
3. Set **`SUPABASE_REGION`** to your project region (**Settings → General**, e.g. `ap-northeast-1`).  
   On Windows, **`SUPABASE_USE_POOLER=true`** (default) routes through the IPv4 session pooler so the IPv6-only `db.*` host does not time out.
4. Migrate and seed:

```bash
set PYTHONPATH=%CD%
.venv\Scripts\alembic upgrade head
.venv\Scripts\python scripts\seed.py
.\scripts\start-local.bat
```

Browse data in **Supabase → Table Editor** (`users`, `employees`, `leave_requests`, …).

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
| `scripts/start-local.bat` | Start gateway + 4 services |

## Deploy on Render (with Vercel frontend)

The API is **five processes locally** (gateway + 4 services). A Render web service must run **all of them**, not `gateway/Dockerfile` alone — otherwise `/api/auth/login` returns **502** (`auth service unavailable`).

1. **Root directory:** `web-api`
2. **Runtime:** Docker
3. **Dockerfile:** `Dockerfile` (repo root under `web-api`, not `gateway/Dockerfile`)
4. **Environment variables** (Render dashboard):
   - `DATABASE_URL` — Supabase URI (`postgresql://…`) or use `DATABASE_HOST` + `DATABASE_PASSWORD` like local `.env`
   - `SUPABASE_REGION` — e.g. `ap-northeast-1` if using Supabase pooler
   - `JWT_SECRET` — strong random string
   - `FRONTEND_URL` — your Vercel URL (e.g. `https://leave-management-six-ruby.vercel.app`)
5. After deploy, check:
   - [https://YOUR-SERVICE.onrender.com/health/version](https://YOUR-SERVICE.onrender.com/health/version) — must show **`gateway_version`: `0.2.0`** and **`auth`: `built-in`**. If you still see only `/health` in Swagger with no **`POST /api/auth/login`**, Render is serving an **old build** — use **Manual Deploy → Clear build cache & deploy**.
   - [https://YOUR-SERVICE.onrender.com/openapi.json](https://YOUR-SERVICE.onrender.com/openapi.json) — must include **`/api/auth/login`**
   - [https://YOUR-SERVICE.onrender.com/health/services](https://YOUR-SERVICE.onrender.com/health/services) — `auth` should be on the gateway; other services may be `unreachable` until you use the full `Dockerfile` + `start-production.sh`
   - `/health/db` — should show your Supabase host, not `127.0.0.1`. Copy the same **`DATABASE_*` / `DATABASE_PASSWORD`** values from local `web-api/.env` into Render **Environment** (do not commit `.env`).

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
