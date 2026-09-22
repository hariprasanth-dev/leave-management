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

## Data model (Phase 2)

| Table | Purpose | PK | Key FKs / constraints |
|-------|---------|----|------------------------|
| `roles` | RBAC roles | `id` | unique `name` |
| `permissions` | Capability codes | `id` | unique `code` |
| `role_permissions` | Role ↔ permission | `(role_id, permission_id)` | FKs cascade |
| `users` | Auth identity | `id` | unique `email`, index `is_active` |
| `user_roles` | User ↔ role | `(user_id, role_id)` | FKs cascade |
| `departments` | Org units | `id` | unique `name`, `code` |
| `employees` | HR profile | `id` | FK `user_id` (1:1), `department_id`, self-FK `manager_id` |
| `leave_types` | Leave catalog | `id` | unique `code`, `default_days_per_year >= 0` |
| `leave_balances` | Entitlement ledger | `id` | unique `(employee_id, leave_type_id, year)` |
| `leave_requests` | Leave applications | `id` | FKs employee/type; `end_date >= start_date`; status check |
| `leave_approvals` | Approval audit | `id` | FKs request/approver; action check |
| `holidays` | Non-working days | `id` | unique `holiday_date` |

Relationships:
- users 1—1 employees
- departments 1—* employees
- employees 1—* employees (manager → reports)
- employees 1—* leave_balances *—1 leave_types
- employees 1—* leave_requests *—1 leave_types
- leave_requests 1—* leave_approvals *—1 employees (approver)

## Services

| Service | Port | Responsibility |
|---------|------|----------------|
| **gateway** | 8000 | API gateway |
| **auth-service** | 8001 | Login, JWT, current user |
| **employee-service** | 8002 | Employees & org |
| **leave-service** | 8003 | Requests & balances |
| **approval-service** | 8004 | Approve / reject + audit |
| **postgres** | 5432 | Shared database (Phase 2) |

## Quick start

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

Or point `DATABASE_URL` at any Postgres 16+ instance.

### 2. Install & migrate

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
copy .env.example .env          # Windows
# cp .env.example .env

alembic upgrade head
python scripts/seed.py
```

### 3. Run APIs

```bash
.\scripts\start-local.bat
# or docker compose up --build
```

- Gateway docs: http://localhost:8000/docs

## Demo credentials

- `employee@example.com` / `password123`
- `manager@example.com` / `password123`

## Layout

```
web-api/
├── alembic/                 # Migrations
├── gateway/
├── scripts/seed.py
├── services/
│   ├── auth_service/
│   ├── employee_service/
│   ├── leave_service/
│   └── approval_service/
├── shared/
│   ├── db/                  # Engine + session
│   ├── models/              # SQLAlchemy entities
│   ├── repositories/        # Data access
│   ├── services/            # Domain services
│   ├── schemas.py           # API DTOs
│   └── config.py
├── docker-compose.yml
└── requirements.txt
```
