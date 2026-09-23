# LeaveFlow — Leave Management Platform

Scalable leave management system with a React frontend and FastAPI microservices.

## Repository layout

| Path | Description |
|------|-------------|
| [`web-app/`](web-app) | React + Vite + JSX SPA |
| [`web-api/`](web-api) | FastAPI microservices + PostgreSQL data layer |

## Architecture

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
   postgres (:5432)  leave_management_api
```

## Quick start

### Backend

```bash
cd web-api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
python scripts/seed.py
.\scripts\start-local.bat
```

Gateway: http://127.0.0.1:8000/docs

### Frontend

```bash
cd web-app
npm install
npm run dev
```

App: http://127.0.0.1:5173

Ensure `web-app/.env` contains:

```
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Sample credentials

| Role | Email | Password |
|------|-------|----------|
| Employee | `employee@example.com` | `password123` |
| Manager | `manager@example.com` | `password123` |

## Leave policy

| Type | Days / year |
|------|-------------|
| Earned Leave | 12 |
| Sick Leave | 10 |
| **Total** | **22** |

- Balance reduces only after approval
- Working days = Mon–Fri
- Pending-only cancellation
- Overlap and insufficient-balance checks enforced
