@echo off
cd /d "%~dp0"
echo Starting LeaveFlow frontend on http://127.0.0.1:5173
echo API base: see .env VITE_API_BASE_URL (default http://127.0.0.1:8000)
npm run dev
