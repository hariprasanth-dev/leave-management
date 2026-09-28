# LeaveFlow backend — run it on your computer

This folder is the **backend**. It stores people, leave requests, and passwords in a database, and answers the website when someone signs in or applies for leave.

The website will not work until this backend is running. After the first setup, starting it takes about one minute.

**Using a Windows PC?** Follow the steps below in order.  
**Using a Mac?** The same steps apply. Where a command is different, the Mac version is written underneath.

---

## What you need (install once)

Install these three programs. After each install, close any open terminal windows and open a new one.

### 1. Python

1. Open [https://www.python.org/downloads/](https://www.python.org/downloads/).
2. Download **Python 3.11 or newer**.
3. Run the installer.
4. On the first screen, tick **Add python.exe to PATH**.
5. Click **Install Now**.

### 2. PostgreSQL (the database)

1. Open [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/) (Mac: [https://www.postgresql.org/download/](https://www.postgresql.org/download/)).
2. Download **PostgreSQL 16** or newer and run the installer.
3. When it asks for a password for the `postgres` user, type a password you will remember. This guide uses **`postgres`**. If you pick a different password, you will type it into a settings file in Step 2 below.
4. Leave the port as **5432**.
5. Finish the installer. It also installs **pgAdmin**, which you will use to create the database.

### 3. Check that Python works

1. Press the **Windows** key, type **PowerShell**, and open **Windows PowerShell**.
2. Paste this line and press **Enter** (right-click pastes in some PowerShell windows):

```powershell
python --version
```

You should see something like `Python 3.11` or higher. If Windows says it cannot find `python`, reinstall Python and tick **Add python.exe to PATH**, then open a **new** PowerShell window.

On a Mac, open **Terminal** and run `python3 --version`.

---

## First-time setup

Do this **once** on each computer. In the commands below, replace `D:\MVP\leave-management` with the folder where this project is saved. In File Explorer, the address bar shows that path. You can copy it from there.

### Step 1 — Create the database

1. Open **pgAdmin 4** from the Start menu.
2. If it asks for a master password, set one and remember it. This password only unlocks pgAdmin on your PC.
3. In the left panel, click **Servers**, then **PostgreSQL**.
4. Enter the `postgres` password you chose during install.
5. Right-click **Databases** → **Create** → **Database…**
6. In **Database**, type exactly:

```text
leave_management_api
```

7. Click **Save**.

The name must be `leave_management_api`. A database named `leave_management_db` will stay empty — the app does not use it.

### Step 2 — Settings file

1. Open PowerShell.
2. Go to this folder (change the path if yours is different):

```powershell
cd D:\MVP\leave-management\web-api
```

3. Copy the example settings:

```powershell
copy .env.example .env
```

4. Open the new file in Notepad:

```powershell
notepad .env
```

5. If your Postgres password is **not** `postgres`, change only this line. Replace `YOUR_PASSWORD` with your password:

```text
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@127.0.0.1:5432/leave_management_api
```

6. Save the file and close Notepad.

The app reads **`.env`** only. Editing `.env.example` does nothing.

Email is optional. Leave `SMTP_HOST` empty and the app still works. Forgot-password codes are then printed in the black **leave-auth** window (on this computer only). To send real email, see [Email (optional)](#email-optional) later.

On a Mac, use Terminal:

```bash
cd /path/to/leave-management/web-api
cp .env.example .env
open -e .env
```

### Step 3 — Install the backend and load sample people

Stay in the `web-api` folder. Paste these lines **one at a time** and wait for each to finish:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
.\.venv\Scripts\alembic.exe upgrade head
python scripts\seed.py
```

What each line does:

| Line | What you should see |
|------|---------------------|
| `python -m venv .venv` | A new `.venv` folder. No error. |
| `Activate.ps1` | The start of the line changes to `(.venv)`. |
| `pip install ...` | A lot of download text, then it returns to the prompt. |
| `alembic upgrade head` | Lines ending in the latest migration. No “FAILED”. |
| `python scripts\seed.py` | `Seed completed` and two email addresses. |

If PowerShell says running scripts is disabled, paste this once, press Enter, then run `Activate.ps1` again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

On a Mac:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python scripts/seed.py
```

### Sample sign-in accounts

These are created by `seed.py`. Password for both is `password123`.

| Who | Email | Password |
|-----|--------|----------|
| Employee (Alex Employee) | `employee@example.com` | `password123` |
| Manager (Morgan Manager) | `harip5340@gmail.com` | `password123` |

There are no leave requests yet. Apply for leave from the website after both parts are running.

---

## Start the backend (every time)

1. Open PowerShell.
2. Run:

```powershell
cd D:\MVP\leave-management\web-api
.\scripts\start-local.bat
```

3. Wait until you see **Backend started**.
4. Several extra windows open (`leave-auth`, `leave-employee`, `leave-leave`, `leave-approval`, `leave-gateway`). Leave them open. Closing them stops the backend.

Check it in a browser: open [http://127.0.0.1:8000/health/db](http://127.0.0.1:8000/health/db).  
You want a short page of text that shows the database is connected.

Optional: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) lists every API action. You do not need this to use the website.

Then start the website. See [../web-app/README.md](../web-app/README.md).

On a Mac there is no `.bat` file. From `web-api`, with the virtual environment turned on (`source .venv/bin/activate`), run `alembic upgrade head`, then open five Terminal tabs and run one command in each:

```bash
export PYTHONPATH=.
uvicorn services.auth_service.main:app --reload --port 8001 --host 127.0.0.1
uvicorn services.employee_service.main:app --reload --port 8002 --host 127.0.0.1
uvicorn services.leave_service.main:app --reload --port 8003 --host 127.0.0.1
uvicorn services.approval_service.main:app --reload --port 8004 --host 127.0.0.1
uvicorn gateway.main:app --reload --no-proxy-headers --port 8000 --host 127.0.0.1
```

Start the gateway (port 8000) last.

### Stop the backend

Close the five extra windows, or run `.\scripts\start-local.bat` again. Running it again closes anything already using ports 8000–8004 and starts fresh.

---

## Email (optional)

Skip this if you only want to click around the app. In-app alerts (the bell icon) work without email.

To send mail for new leave requests, approvals, and forgot-password:

1. Open `web-api\.env` in Notepad.
2. Fill in:

| Setting | What to put |
|---------|-------------|
| `SMTP_HOST` | Your mail server, for example `smtp.gmail.com` |
| `SMTP_PORT` | Usually `587` |
| `SMTP_USERNAME` | The mailbox login |
| `SMTP_PASSWORD` | The mailbox password or app password |
| `MAIL_FROM` | The “from” name, for example `LeaveFlow <no-reply@yourdomain.com>` |

3. Save the file.
4. Stop the backend and run `.\scripts\start-local.bat` again. A change to `.env` is picked up only at startup.

What gets sent:

- An employee applies → their manager gets an email with dates, days, reason, and balance left.
- A manager approves or rejects → the employee gets an email with the decision.
- Someone uses **Forgot password** → that account gets a one-time temporary password.

**Mailtrap** and similar test inboxes show the message on the provider’s website. It will not arrive in Gmail until you use a real mailbox (Gmail App Password, Microsoft 365, SendGrid, and so on).

Do not put real passwords in `.env.example`, and do not commit `.env` to git.

---

## If something goes wrong

| What you see | What to do |
|--------------|------------|
| `python` is not recognized | Reinstall Python with **Add python.exe to PATH**. Open a new PowerShell window. |
| `Activate.ps1` cannot be loaded | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then activate again. |
| Missing venv | You skipped Step 3. From `web-api`, run `python -m venv .venv` and `pip install -r requirements.txt`. |
| Migration failed / cannot connect | PostgreSQL must be running. In `.env`, the password and database name must match what you created. Database name is `leave_management_api`. |
| Port already in use | Run `.\scripts\start-local.bat` again. It frees ports 8000–8004 first. |
| Website says network error | This backend must be started first. Open [http://127.0.0.1:8000/health/db](http://127.0.0.1:8000/health/db). |
| Demo login says invalid password | From `web-api`, with `(.venv)` showing, run `python scripts\seed.py` again. |
| Changed `.env` and nothing changed | Stop the extra windows and run `start-local.bat` again. |
| No rows in pgAdmin | Open database **`leave_management_api`**. Names and emails are in `users`. Employee codes are in `employees`. Leave requests are in `leave_requests`. |

---

## For developers

```
Browser  →  gateway :8000  →  auth :8001
                            →  employees :8002
                            →  leaves :8003
                            →  approvals :8004
                            →  PostgreSQL (leave_management_api)
```

| Script | Purpose |
|--------|---------|
| `scripts/start-local.bat` | Migrate, then start gateway and the four services |
| `scripts/seed.py` | Demo users, leave policy, and balances |
| `scripts/reset_db.py` | Drop the schema, migrate, and seed again |
| `scripts/e2e_leaves.py` | Leave workflow smoke test |
| `scripts/e2e_employees.py` | Employee create/read/update smoke test |
| `scripts/e2e_login_security.py` | Login throttle, JWT, and CORS smoke test |

Default database URL (password `postgres`):

```text
postgresql+psycopg://postgres:postgres@127.0.0.1:5432/leave_management_api
```

In-app notifications live in `notifications` and the website bell polls them about every 30 seconds. Users can read only their own: `GET /api/leaves/notifications`, `POST /api/leaves/notifications/{id}/read`, `POST /api/leaves/notifications/read-all`.

Forgot password (`POST /api/auth/forgot-password`) emails a one-time code. It expires after `TEMP_PASSWORD_EXPIRE_MINUTES` (30) and is limited to `TEMP_PASSWORD_MAX_PER_HOUR` (3). The real password still works. After a temporary sign-in, the API returns `403 Password change required` until Settings sets a new password (8+ characters, a letter and a number).

The website is in [../web-app](../web-app). A full walkthrough of both parts is in [../README.md](../README.md).
