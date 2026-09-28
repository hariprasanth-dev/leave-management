# LeaveFlow

LeaveFlow is a leave-management web app. Employees request time off, managers approve or reject those requests, and both sides see in-app alerts. Email is sent when SMTP is configured.

The repository has two apps you run:

| Folder | Role |
|--------|------|
| `web-api` | Python API and PostgreSQL schema |
| `web-app` | React website |

The website loads people, leave, and balances from the API. It does not ship a built-in dataset.

---

## Technology stack

| Layer | Choice |
|-------|--------|
| Website | React 19, React Router 7, Vite 8 |
| HTTP client | Axios |
| API | Python 3.11+, FastAPI, Pydantic, Uvicorn |
| Data access | SQLAlchemy 2, Alembic migrations, psycopg |
| Database | PostgreSQL 16+ locally, or Neon PostgreSQL when hosted |
| Auth | JWT access tokens (`python-jose`), refresh tokens, bcrypt password hashes |
| Email | SMTP (optional). In-app notifications work without it |
| Hosting | Vite static build plus one Python function on Vercel (`INLINE_SERVICES=1`) |

Local development uses Node.js (LTS) for the website and a Python virtual environment for the API.

---

## Architecture overview

Locally, the browser talks only to the **gateway** on port 8000. The gateway owns sign-in (`/api/auth/*`) and proxies the other domains to small FastAPI services:

```
Browser (Vite :5173)
    → Gateway :8000
         → auth routes (in the gateway process)
         → employees :8002
         → leaves :8003
         → approvals :8004
    → PostgreSQL database leave_management_api
```

`web-api/scripts/start-local.bat` applies migrations, then starts those five processes. Closing the helper windows stops the API.

On Vercel, the same gateway runs as one serverless function. `INLINE_SERVICES=1` mounts the employee, leave, and approval routes inside that process, so there are no separate ports. The website and API share one domain. The database is Neon (use the **pooled** connection string).

Request flow inside the API:

```
HTTP route → service (shared/services) → repository → PostgreSQL
```

Access control is permission-based. The UI hides navigation the signed-in user cannot use, and the API enforces the same permissions. Roles seeded in the database are `employee`, `manager`, `hr`, and `admin`. `admin:all` expands to every permission.

Sign-in issues a short-lived access token and a refresh token. Failed attempts are stored in `login_attempts` and lock the account temporarily after repeated failures. Passwords are stored as bcrypt hashes. Refresh tokens and temporary passwords are stored as hashes, not as raw secrets.

---

## Data model overview

Schema changes live in `web-api/alembic/versions`. Models are in `web-api/shared/models/entities.py`.

```
roles 1──* role_permissions *──1 permissions
users 1──* user_roles *──1 roles
users 1──1 employees
departments 1──* employees
employees 1──* employees          (manager → direct reports)
employees 1──* leave_balances *──1 leave_types
employees 1──* leave_requests *──1 leave_types
leave_requests 1──* leave_approvals *──1 employees (approver)
users 1──* notifications
users 1──* refresh_tokens
users 1──* password_reset_tokens
holidays                          (calendar, not tied to a user)
login_attempts                    (email + IP, including unknown emails)
```

| Table | What it stores |
|-------|----------------|
| `users` | Email, password hash, name, active flag, must-change-password flag |
| `roles`, `permissions`, `user_roles`, `role_permissions` | Who can do what |
| `departments` | Named org units (`Engineering` / `ENG` in the seed) |
| `employees` | Code (`ST-01`), department, manager, hire date, link to `users` |
| `leave_types` | Policy codes. Seed creates **Earned** (12 days/year) and **Sick** (10 days/year). Both are paid and require approval |
| `leave_balances` | Per employee, leave type, and calendar year: `entitled`, `used`, `pending`. `used + pending` cannot exceed `entitled`. Remaining is `entitled - used` |
| `leave_requests` | Start, end, working-day count, reason, status `pending` / `approved` / `rejected` / `cancelled` |
| `leave_approvals` | Approver, action `approved` or `rejected`, optional comment |
| `holidays` | Named dates. Optional holidays are flagged |
| `notifications` | In-app alerts for one user, optionally linked to a leave request |
| `refresh_tokens` | Hashed refresh tokens, expiry, revocation |
| `password_reset_tokens` | Hashed one-time temporary passwords, expiry, used-at |
| `login_attempts` | Success and failure rows used for lockout |

Browse views for SQL clients: `v_employee_directory`, `v_leave_request_list`. Names and emails live on `users` (and those views), not on `employees` alone.

A request moves pending days into `pending` when it is submitted. Approval moves them from `pending` to `used`. Rejection or cancellation releases `pending`. An employee with no manager above them can self-record leave; that decision is stored as an approval with a self-recorded comment.

---

## Setup instructions

These steps are for Windows PowerShell. On macOS, use `python3`, `source .venv/bin/activate`, and `cp` instead of `copy`. First-time setup is about 30–45 minutes. Starting the app after that takes about a minute.

### Install once

1. **Python 3.11+** — [python.org/downloads](https://www.python.org/downloads/). Tick **Add python.exe to PATH**.
2. **Node.js LTS** — [nodejs.org](https://nodejs.org/). This includes `npm`.
3. **PostgreSQL 16+** — [postgresql.org/download/windows](https://www.postgresql.org/download/windows/). This guide assumes user `postgres`, password `postgres`, port `5432`. If yours differ, change `DATABASE_URL` in `web-api/.env`.

Check a new terminal:

```powershell
python --version
node --version
npm --version
```

### Create the database

In pgAdmin, create a database named exactly **`leave_management_api`**. The app does not use `leave_management_db`.

### Backend

```powershell
cd D:\MVP\leave-management\web-api
copy .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
.\.venv\Scripts\alembic.exe upgrade head
python scripts\seed.py
```

The API reads **`web-api/.env`**, not `.env.example`. `DATABASE_URL` must point at `leave_management_api`. Leave `SMTP_HOST` empty to skip email.

If `Activate.ps1` is blocked, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Website

```powershell
cd D:\MVP\leave-management\web-app
copy .env.example .env
npm install
```

The default frontend env calls `http://127.0.0.1:8000`. Leave that unless the API runs elsewhere.

### Start (every session)

Terminal 1 — API (leave it open; extra windows for the services are expected):

```powershell
cd D:\MVP\leave-management\web-api
.\scripts\start-local.bat
```

Wait for **Backend started**. Check [http://127.0.0.1:8000/health/db](http://127.0.0.1:8000/health/db). Interactive API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

Terminal 2 — website:

```powershell
cd D:\MVP\leave-management\web-app
npm run dev
```

Open the URL Vite prints (usually [http://127.0.0.1:5173](http://127.0.0.1:5173)).

Stop the API by closing the helper windows, or run `start-local.bat` again (it frees ports 8000–8004 first). Stop the website with **Ctrl+C**.

### Demo accounts

Created by `python scripts\seed.py`. Password for both is `password123`.

| Role | Email |
|------|--------|
| Employee (Alex Employee, `ST-01`) | `employee@example.com` |
| Manager (Morgan Manager, `ST-02`) | `harip5340@gmail.com` |

If seed prints `Seed skipped`, roles already exist and these accounts are unchanged. Use a private window for a second session.

### Email (optional)

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `MAIL_FROM` in `web-api/.env`, then restart the API. Leave applied, approved, or rejected can email the other party. Forgot password emails a one-time temporary password (30 minutes, at most 3 per hour). With SMTP unset in development, that temporary password is written to the auth service log only. Mailtrap and similar sandboxes show mail in their inbox, not in Gmail.

### Hosted deploy (Vercel + Neon)

See [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md). Production needs `DATABASE_URL` (Neon **pooled** URL), `JWT_SECRET` (at least 32 characters, not the dev default), `ENVIRONMENT=production`, and `FRONTEND_URL` set to the site origin. Do not set `VITE_API_BASE_URL` when the API is on the same domain. After env changes, redeploy.

### If something fails

| Problem | What to try |
|---------|-------------|
| Blank site or network error | Start the API first. Open `/health/db`. |
| Invalid email or password on demo accounts | From `web-api` with the venv active, run `python scripts\seed.py` only if the database was empty. Otherwise the password was changed in the app. |
| No rows in pgAdmin | Open **`leave_management_api`**. Use `users`, `employees`, `leave_requests`, or the browse views. |
| Port already in use | Run `.\scripts\start-local.bat` again. |
| `.env` changes ignored | Restart `start-local.bat`. Services read env at startup. |
| Hosted login returns 500 | Confirm `DATABASE_URL` and `JWT_SECRET` are set on the Vercel **Production** environment, then redeploy. |

Reset the local database: from `web-api`, `python scripts\reset_db.py`. Smoke tests: `python scripts\e2e_leaves.py`, `e2e_employees.py`, `e2e_login_security.py`.

More detail: [web-api/README.md](web-api/README.md), [web-app/README.md](web-app/README.md).

---

## Assumptions

- One company, one database, one calendar year of balances at a time. The seed year is the year you run `seed.py`.
- Weekends are Saturday and Sunday. Leave length is the count of Monday–Friday days in the range, inclusive. Half days are not a separate unit.
- Both seeded leave types need a manager decision, except when the employee has no manager. That case is recorded as self-approved.
- The direct manager is the approver. There is no second approval level.
- Employee codes use the prefix `ST` (`ST-01`, `ST-02`, …).
- The signed-in user is also an employee row. Login identity is `users`; org data is `employees`.
- In-app notifications are enough for the product to be usable. Email is an add-on.
- Demo passwords and the dev `JWT_SECRET` are for local review only. Production must set its own secret and database URL.
- Reviewers use a modern desktop browser. Layout is responsive, but the walkthrough is the desktop app.

---

## Known limitations

- **Holidays are not deducted.** `holidays` can be stored, but the day count uses weekdays only. A public holiday on a weekday still consumes leave.
- **No carry-over or accrual.** Balances are a yearly entitlement (`12` earned, `10` sick in the seed). They do not accrue by month and do not roll into the next year by themselves.
- **HR and admin have no demo users.** Those roles and permissions exist. `seed.py` only creates the employee and the manager above.
- **Notifications are polled.** The bell refreshes about every 30 seconds. There is no websocket or push notification.
- **Email is best-effort.** With SMTP empty, messages are skipped (development may log a temporary password). A mail failure does not roll back the leave decision.
- **Single-step approval.** A manager sees their team’s pending requests. There is no HR queue after the manager, and no delegation when the manager is away.
- **Lockout is temporary, not an admin unlock screen.** Too many failures block sign-in for the lockout window (`login_attempts`). There is no separate “unlock user” page.
- **Local and hosted runtimes differ.** Local mode is five processes. Vercel mode is one process plus Neon. A laptop `DATABASE_URL` (`127.0.0.1`) will not work on Vercel.
- **Seed does not reset existing data.** If roles already exist, `seed.py` exits without changing passwords or balances.
