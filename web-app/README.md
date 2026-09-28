# LeaveFlow website — run it on your computer

This folder is the **website**. You open it in Chrome, Edge, or Firefox to sign in, apply for leave, and approve requests.

It does not store data by itself. The **backend** in the `web-api` folder must already be running. If you have not set that up, do [the backend guide](../web-api/README.md) first (about 30–45 minutes the first time).

**Using a Windows PC?** Follow the steps below.  
**Using a Mac?** Install Node.js the same way, then use Terminal. The commands are the same except you do not use the `.bat` file.

---

## What you need (install once)

### Node.js

1. Open [https://nodejs.org/](https://nodejs.org/).
2. Download the **LTS** version (the button that says LTS, not Current).
3. Run the installer and accept the defaults.

### Check that it worked

1. Press the **Windows** key, type **PowerShell**, and open **Windows PowerShell**.
2. Paste these two lines, one at a time:

```powershell
node --version
npm --version
```

You should see version numbers, for example `v22...` and `10...`. If Windows says it cannot find `node`, close PowerShell, open a **new** window, and try again. A new window is required after installing Node.js.

---

## First-time setup

Do this **once**. Replace `D:\MVP\leave-management` with the folder where you saved the project. In File Explorer, click the address bar to copy that path.

1. Open PowerShell and go to this folder:

```powershell
cd D:\MVP\leave-management\web-app
```

2. Create the settings file:

```powershell
copy .env.example .env
```

3. You can leave `.env` as it is. It already points the website at the backend on this computer:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Change that line only if someone told you the backend is on a different address.

4. Install the website files (this can take a few minutes):

```powershell
npm install
```

Wait until the prompt comes back and you do not see a red `ERR!` line.

On a Mac, in Terminal:

```bash
cd /path/to/leave-management/web-app
cp .env.example .env
npm install
```

---

## Start the website (every time)

You need **two** things running: the backend, then this website.

### 1. Start the backend first

In a PowerShell window:

```powershell
cd D:\MVP\leave-management\web-api
.\scripts\start-local.bat
```

Wait for **Backend started**. Leave that window and the extra black windows open. Details are in [../web-api/README.md](../web-api/README.md).

Quick check: open [http://127.0.0.1:8000/health/db](http://127.0.0.1:8000/health/db). If that page does not load, do not start the website yet.

### 2. Start the website

Open a **second** PowerShell window:

```powershell
cd D:\MVP\leave-management\web-app
npm run dev
```

From that same folder you can also run:

```powershell
.\scripts\start-local.bat
```

3. When it says **Local**, open this address in your browser:

**[http://127.0.0.1:5173](http://127.0.0.1:5173)**

(The same page is often shown as [http://localhost:5173](http://localhost:5173).)

Leave the PowerShell window open while you use the site. If you close it, the page stops loading.

### Sign in

| Who | Email | Password |
|-----|--------|----------|
| Employee | `employee@example.com` | `password123` |
| Manager | `harip5340@gmail.com` | `password123` |

These accounts exist only after the backend setup has been run once (`python scripts\seed.py` in `web-api`). Use a private or incognito window if you want the employee and the manager signed in at the same time.

### Stop the website

Click the website’s PowerShell window and press **Ctrl+C**. Type `Y` and press Enter if it asks. Then close the backend windows when you are finished.

---

## What you can click through

Sign in as the **employee** first, apply for leave, then sign in as the **manager** and approve it.

**Employee** (`employee@example.com`)

1. Sign in. The login page has the brand on the left and the form on the right.
2. **Dashboard** shows your leave summary.
3. **My Leaves** → **Apply leave**. Pick dates. You should see **“N day(s) selected”** before you submit.
4. The **bell** icon shows a new alert (it can take up to about 30 seconds).
5. **Profile** shows an employee ID like **ST-01**.
6. **Settings** is where you change your password.
7. **Forgot password** is on the login page. Without email set up on the backend, the temporary password is printed in the backend’s **leave-auth** window.

**Manager** (`harip5340@gmail.com`)

1. **Dashboard** shows pending approvals and your team.
2. **Approvals** — approve or reject the request. The employee gets an in-app alert.
3. **Employees** — search the list. **Add employee** opens a panel on the right.
4. **My Leaves** — the manager can also request their own leave.
5. **Logout** asks you to confirm before signing out.

A nonsense address such as [http://127.0.0.1:5173/this-page-does-not-exist](http://127.0.0.1:5173/this-page-does-not-exist) should show a **404** page.

---

## If something goes wrong

| What you see | What to do |
|--------------|------------|
| `node` or `npm` is not recognized | Install Node.js LTS, then open a **new** PowerShell window. |
| Blank page or “network error” | Start the backend first. Open [http://127.0.0.1:8000/health/db](http://127.0.0.1:8000/health/db). Then run `npm run dev` again. |
| Page says it cannot be reached | The website window must stay open. Run `npm run dev` from the `web-app` folder and use the **http://127.0.0.1:5173** link it prints. |
| Invalid email or password | The sample people are created by the backend. In `web-api`, run `python scripts\seed.py` (see the backend guide). |
| `npm install` shows `ERR!` | Check your internet connection and run `npm install` again from the `web-app` folder. |
| You changed `.env` and the site still calls the old address | Stop the website with **Ctrl+C** and run `npm run dev` again. |

---

## For developers

Stack: React 19, Vite, React Router, Axios. The dev server is Vite on port **5173**. API calls go to `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`).

| Route | Page |
|-------|------|
| `/` | Dashboard |
| `/leaves` | Leave history |
| `/leaves/:id` | Leave detail |
| `/apply` | Apply for leave |
| `/approvals` | Manager approvals |
| `/employees` | Employee directory |
| `/employees/new` | Create employee |
| `/employees/:id` | Employee detail |
| `/employees/:id/edit` | Edit employee |
| `/profile` | Profile |
| `/settings` | Settings |

Production build: `npm run build`. Static files are written to `dist`.

```
web-app/
├── public/
├── src/
│   ├── api/
│   ├── auth/
│   ├── components/
│   ├── pages/
│   ├── App.jsx
│   ├── main.jsx
│   └── navigation.js
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```
