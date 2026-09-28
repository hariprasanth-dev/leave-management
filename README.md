# LeaveFlow — run the app on your computer

LeaveFlow is a leave-management web app: employees request time off, managers approve or reject, and both sides get in-app alerts (and email when SMTP is set up).

This repo has two folders you need:

| Folder | What it is |
|--------|------------|
| **`web-api`** | Backend (database + API). Must be running first. |
| **`web-app`** | Website you open in the browser. |

Everything you see in the UI (people, leaves, balances) comes from the **backend**, not from hard-coded demo data in the frontend.

---

## Who this guide is for

These steps are written for **reviewers and testers who are not developers**. You copy commands into **PowerShell** or **Command Prompt** on Windows. If you use a Mac, the same ideas apply; use `python3` / `source .venv/bin/activate` instead of the Windows paths below.

**Time:** about 30–45 minutes the first time (installing PostgreSQL takes the longest). After that, starting the app takes about one minute.

---

## What to install first (one time)

Install these on your PC and restart the terminal after each install:

1. **Python 3.11 or newer** — [https://www.python.org/downloads/](https://www.python.org/downloads/)  
   On the installer, tick **“Add python.exe to PATH”**, then finish.

2. **Node.js (LTS)** — [https://nodejs.org/](https://nodejs.org/)  
   This includes `npm`, which runs the website.

3. **PostgreSQL 16+** — [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)  
   Remember the password you choose for the `postgres` user (the guide below assumes `postgres` / `postgres`; change `.env` if yours is different).

4. **Git** (optional) — only if you clone the repo. If you received a ZIP, unzip it and open the folder in File Explorer.

Check that tools work (open a **new** PowerShell window):

```powershell
python --version
node --version
npm --version
```

You should see version numbers, not “command not found”.

---

## First-time setup

Do these steps **once** per machine. Replace `D:\MVP\leave-management` with the folder where you saved the project.

### Step 1 — Create the database

1. Open **pgAdmin** (installed with PostgreSQL) or any Postgres tool.
2. Connect to your local server.
3. Create a database named exactly: **`leave_management_api`**  
   (Not `leave_management_db` — the app will not use that name.)

### Step 2 — Backend (`web-api`)

Open PowerShell:

```powershell
cd D:\MVP\leave-management\web-api
```

Copy the settings template and edit if your Postgres password is not `postgres`:

```powershell
copy .env.example .env
notepad .env
```

Important lines in **`.env`** (not `.env.example` — the app only reads **`.env`**):

- `DATABASE_URL` — must point at **`leave_management_api`**
- Optional **email**: fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM` if you want real emails. Leave `SMTP_HOST` empty to skip email (forgot-password temp codes are then logged in the auth service window in development only).

Create the Python environment and load demo data:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
.\.venv\Scripts\alembic.exe upgrade head
python scripts\seed.py
```

You should see demo login emails printed at the end.

### Step 3 — Frontend (`web-app`)

In the same or a new PowerShell window:

```powershell
cd D:\MVP\leave-management\web-app
copy .env.example .env
npm install
```

The default `.env` points the site at `http://127.0.0.1:8000` — leave it unless your API runs elsewhere.

---

## Start the app (every time you review)

You need **two** terminals left open while you use LeaveFlow.

### Terminal 1 — Backend

```powershell
cd D:\MVP\leave-management\web-api
.\scripts\start-local.bat
```

Wait until you see **“Backend started”**. Several small black windows may open (auth, employees, leaves, approvals, gateway). That is normal.

Quick check in the browser: [http://127.0.0.1:8000/health/db](http://127.0.0.1:8000/health/db)  
You want a JSON response that shows the database is connected.

API documentation (optional): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Terminal 2 — Website

```powershell
cd D:\MVP\leave-management\web-app
npm run dev
```

Open the address shown (usually **[http://localhost:5173](http://localhost:5173)** or [http://127.0.0.1:5173](http://127.0.0.1:5173)).

### Stop the app

- Close the backend helper windows, or run `start-local.bat` again (it stops old processes on ports 8000–8004 first).
- In the frontend terminal, press **Ctrl+C**.

---

## Demo logins (after `seed.py`)

| Role | Email | Password |
|------|--------|----------|
| **Employee** | `employee@example.com` | `password123` |
| **Manager** | `harip5340@gmail.com` | `password123` |

Use a private/incognito window if you want employee and manager sessions in two browsers at once.

---

## Review checklist (walk through the product)

Use this as a script for UAT or stakeholder demos.

### As employee (`employee@example.com`)

1. **Sign in** — Login page: brand panel on the left, form on the right; “Forgot password?” under the password field.
2. **Dashboard** — Leave summary and stats in one place; sidebar has **My Leaves** (not a separate “Apply leave” item).
3. **My Leaves** — Open **Apply leave**, pick dates, confirm the banner shows **“N day(s) selected”**, submit.
4. **Notifications** — Bell icon: new items after submit (may take up to ~30 seconds).
5. **Profile** — Employee ID format like **ST-01** (company prefix + number).
6. **Settings** — Change password (optional); rules show as you type.
7. **Forgot password** (optional) — Sign out, use Forgot password; with SMTP configured, check your mail provider (Mailtrap sandbox shows mail in the Mailtrap inbox, not Gmail).

### As manager (`harip5340@gmail.com`)

1. **Dashboard** — Pending approvals, **My team** (at most 5 people) and **View all** to Employees.
2. **Approvals** — Approve or reject a pending request; employee gets in-app notification (and email if SMTP is on).
3. **Employees** — Search, sort, filter; **Add employee** opens a right-side sheet; manager cannot edit/delete their own HR record from this list where the app restricts it.
4. **My Leaves** — Manager can track their own leave like an employee.
5. **Logout** — Confirm in the popup before signing out.

### General

- Open a nonsense URL (e.g. `/this-page-does-not-exist`) — **404** page with header and sidebar.
- Breadcrumbs appear in the **header**; the menu toggle is on the **sidebar**.

---

## Email (optional)

To send forgot-password mail and leave notifications:

1. Put SMTP settings in **`web-api/.env`** only (never commit real passwords to git).
2. **Restart the backend** (`start-local.bat`) after changing `.env`.
3. **Mailtrap** and similar sandboxes capture mail in their website inbox — mail will **not** arrive in Gmail until you use production SMTP (Gmail App Password, Microsoft 365, SendGrid, etc.).

See **`web-api/README.md`** for what each email type contains.

---

## Something went wrong?

| Problem | What to try |
|---------|-------------|
| Website blank or “network error” | Start **backend first**, then `npm run dev`. Check [http://127.0.0.1:8000/health/db](http://127.0.0.1:8000/health/db). |
| “Invalid email or password” on demo accounts | Run `python scripts\seed.py` again from `web-api` (with venv activated). |
| Data not showing in pgAdmin | Open database **`leave_management_api`**, tables `users`, `employees`, `leave_requests`, or views `v_employee_directory`, `v_leave_request_list`. |
| Email never arrives | Settings must be in **`web-api/.env`**, not `.env.example`. Restart backend. For Mailtrap, check the sandbox inbox online. |
| Port already in use | Run `.\scripts\start-local.bat` again; it tries to free ports 8000–8004. |
| `Activate.ps1` blocked | Run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Changed `.env` but nothing changed | Stop and run **`start-local.bat`** again — services load env at startup. |

---

## For developers

| Topic | Where to read more |
|--------|---------------------|
| API services, migrations, SMTP, security | [`web-api/README.md`](web-api/README.md) |
| Frontend env vars and build | [`web-app/README.md`](web-app/README.md) |
| Reset database | `web-api`: `python scripts\reset_db.py` |
| Smoke tests | `web-api`: `python scripts\e2e_leaves.py`, `e2e_login_security.py` |

**Build frontend for production:** `cd web-app` → `npm run build` → static files in `web-app/dist`.

---

## Project layout

```
leave-management/
├── README.md          ← start here (this file)
├── web-api/           ← Python API + PostgreSQL
└── web-app/           ← React website (Vite)
```
