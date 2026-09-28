# LeaveFlow API (`web-api`)

Python FastAPI microservices for LeaveFlow (database, auth, employees, leaves, approvals).

**First time running the full app?** Start with the non-technical setup in the repo root: **[../README.md](../README.md)** — install PostgreSQL, copy **`.env`** (not `.env.example`), migrate, seed, then `scripts\start-local.bat` and `web-app` → `npm run dev`.

---

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

```powershell
copy .env.example .env
```

Edit **`.env`** in this folder. The app does **not** read `.env.example` at runtime. After any change, restart `scripts\start-local.bat`.

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

## Seed accounts (backend only)

- `harip5340@gmail.com` / `password123` (Morgan Manager)
- `employee@example.com` / `password123`

No other demo users. Leave requests start empty; add data through the API/UI.

## Email notifications (SMTP)

- **New request:** when an employee applies, their manager gets an email at their work
  (login) address with the dates, working days, reason and balance left, plus a link to
  the approvals queue. Employees without a manager route to every active approver.
- **Decision:** when a manager approves or rejects, the employee gets an email with the
  status, dates, days, approver, comment and remaining balance.

Emails are sent in the background after the change is saved, so a mail outage never blocks
or undoes a request or decision.

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` and `MAIL_FROM` in **`.env`**
(use `.env.example` as a template only). Restart all services after editing. With
`SMTP_HOST` empty, emails are only logged in the service console (and temp passwords in
development are logged by the auth service).

**Mailtrap / sandboxes:** messages appear in the provider’s web inbox, not the recipient’s
real mailbox until you switch to production SMTP.

## In-app notifications

Stored in the `notifications` table (migration `007_notifications`) and shown in the header
bell, which polls every 30 seconds:

| Event | Who is notified |
|-------|-----------------|
| Leave submitted | The employee's manager |
| Leave approved / rejected | The employee |
| Pending leave cancelled | The manager |

Once a request is decided or cancelled, the manager's "requested leave" item is marked read
automatically. Endpoints: `GET /api/leaves/notifications`, `POST /api/leaves/notifications/{id}/read`,
`POST /api/leaves/notifications/read-all`. Users can only read or mark their own notifications.

## Forgot password and change password

Works the same for employees and managers (migration `008_temp_passwords`).

1. **Forgot password** (`POST /api/auth/forgot-password`): emails a one-time temporary
   password (`xxxx-xxxx-xxxx`) to the account's work email. The response is identical for
   known and unknown emails. Only a bcrypt hash is stored; it works once, expires after
   `TEMP_PASSWORD_EXPIRE_MINUTES` (30) and at most `TEMP_PASSWORD_MAX_PER_HOUR` (3) are
   issued per account. The current password keeps working, so nobody can lock a user out by
   requesting resets; signing in with the real password cancels any outstanding temp password.
2. **Temp sign-in:** the user is flagged `must_change_password`. Until they set a new
   password, the web app keeps them on Settings and the API returns
   `403 Password change required` for everything except `/me`, change-password and
   notifications.
3. **Change password** (`POST /api/auth/change-password`, Settings page): requires the
   current password (skipped after a temp sign-in), 8+ characters with a letter and a number,
   different from the current one. Wrong current passwords count toward the login throttle.
   On success every other session is signed out and fresh tokens are returned.

Without SMTP configured, temp passwords are printed in the auth service console
(development only). The old reset-link endpoint (`/reset-password`) was removed.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/seed.py` | Demo users, policy, balances |
| `scripts/reset_db.py` | Drop/recreate schema, migrate, seed |
| `scripts/e2e_leaves.py` | Leave workflow smoke test |
| `scripts/e2e_employees.py` | Employee CRUD smoke test |
| `scripts/start-local.bat` | Start gateway + 4 services |
| `scripts/e2e_login_security.py` | Login throttle, JWT, CORS smoke test |

## Frontend

The React UI lives in **`../web-app`**. See **[../web-app/README.md](../web-app/README.md)** and the product walkthrough in **[../README.md](../README.md)**.

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
