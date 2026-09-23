# LeaveFlow — Leave Management Platform

Scalable leave management system with a React frontend and FastAPI microservices.

## Repository layout

| Path | Description |
|------|-------------|
| [`web-app/`](web-app) | React + Vite + JSX SPA |
| [`web-api/`](web-api) | FastAPI microservices + PostgreSQL data layer |

## Architecture

```
Frontend (web-app)
   ↓
FastAPI gateway + microservices
   ↓
Service
   ↓
Repository
   ↓
PostgreSQL
```

```
web-app (:5173)
        │
        ▼
gateway (:8000)
   ├── auth-service      (:8001)
   ├── employee-service  (:8002)
   ├── leave-service     (:8003)
   └── approval-service  (:8004)
        │
        ▼
   postgres (:5432)
```

## Quick start

### Frontend

```bash
cd web-app
npm install
npm run dev
```

Opens http://127.0.0.1:5173 and calls the API at `http://127.0.0.1:8000`
(see `web-app/.env` → `VITE_API_BASE_URL`).

### Backend + database

Requires a local PostgreSQL database named `leave_management_api`.

```bash
cd web-api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Edit .env DATABASE_URL if your postgres password is not "postgres"

alembic upgrade head
python scripts/seed.py
.\scripts\start-local.bat
```

Open http://127.0.0.1:5173 → `/login` → `employee@example.com` / `password123` → Dashboard.

## Sample credentials

| Role | Email | Password |
|------|-------|----------|
| Employee | `employee@example.com` | `password123` |
| Manager | `manager@example.com` | `password123` |

## Leave policy (Module 1)

| Type | Days / year |
|------|-------------|
| Earned Leave | 12 |
| Sick Leave | 10 |
| **Total** | **22** |

Rules implemented:
- Full annual balance at year start; no accrual / carry-forward / encashment
- Working days = Mon–Fri (public holidays ignored)
- Balance reduces only on **approval**; reject/cancel do not reduce used days
- Pending requests soft-reserve available days (cannot over-apply)
- Overlaps with pending/approved requests are rejected
- Negative balance is not allowed
- Only **pending** requests can be cancelled

## Core Module 1 APIs

Leave service (`/api/leaves`):
- `GET /types`, `GET /balances`, `GET /`, `GET /{id}`
- `POST /`, `POST /{id}/cancel`

Approval service (`/api/approvals`):
- `GET /pending`, `GET /processed`
- `POST /{id}/approve`, `POST /{id}/reject`

## Core Module 2 APIs (Employees)

Employee service (`/api/employees`):
- `GET /departments`, `GET /`, `GET /{id}`
- `POST /`, `PATCH /{id}`, `DELETE /{id}` (soft deactivate)
- Search (`q`), department filter, active filter, pagination
- Create seeds default leave balances (Earned 12 + Sick 10)
- Managers have `employee:manage` in this MVP so demo CRUD works with sample credentials

## Assumptions & limitations

- Single-org MVP; managers see all employees when they have manage permission
- Soft-delete only (deactivate) — leave history retained
- Local development uses PostgreSQL (`leave_management_api`)
- No email notifications, half-day leave, or holiday calendar
- JWT access + refresh; roles: employee / manager / hr / admin
