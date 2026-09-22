# LeaveFlow Web App

React + JavaScript (JSX) frontend for the LeaveFlow leave management platform.

## Stack

- React 19 + Vite
- React Router
- Axios (talks to the API gateway)

## Setup

```bash
npm install
npm run dev
```

App runs at [http://localhost:5173](http://localhost:5173).

API calls are proxied to the gateway at `http://localhost:8000` (see `vite.config.js`).

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — balances & recent requests |
| `/leaves` | My leave requests |
| `/apply` | Submit a leave request |
| `/approvals` | Manager approval queue |

## Environment

Copy `.env.example` to `.env` if you need to override the API base URL:

```
VITE_API_BASE_URL=
```
