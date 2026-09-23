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

1. Create a database named `leave_management_api` (Postgres 16+).
2. Copy env and set credentials if needed:

```bash
copy .env.example .env
```

Default connection:

```
postgresql+psycopg://postgres:postgres@127.0.0.1:5432/leave_management_api
```

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
