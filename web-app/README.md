# LeaveFlow Web App

React + JavaScript (JSX) frontend for the LeaveFlow leave management platform.

## Stack

- React 19 + Vite
- React Router
- Axios (API gateway via Vite proxy)

## Setup

```bash
npm install
# ensure .env has: VITE_API_BASE_URL=http://127.0.0.1:8000
npm run dev
```

Or: `.\scripts\start-local.bat`

App: http://127.0.0.1:5173  
API: http://127.0.0.1:8000 (set in `.env`)

## Routes

| Route | Purpose |
|-------|---------|
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

## Layout

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
├── index.html
├── package.json
└── vite.config.js
```
