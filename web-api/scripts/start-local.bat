@echo off
setlocal
cd /d "%~dp0.."
set PYTHONPATH=%CD%

set UVICORN=%CD%\.venv\Scripts\uvicorn.exe
set ALEMBIC=%CD%\.venv\Scripts\alembic.exe
if not exist "%UVICORN%" (
  echo Missing venv. Run: python -m venv .venv ^&^& .venv\Scripts\pip install -r requirements.txt
  exit /b 1
)

echo Applying database migrations (alembic upgrade head)...
"%ALEMBIC%" upgrade head
if errorlevel 1 (
  echo Migration failed. Check DATABASE_URL in web-api/.env or repo .env.local ^(Neon^).
  exit /b 1
)

REM Stop previous listeners on API ports (ignore errors).
REM /T kills the whole tree; otherwise uvicorn --reload workers survive and keep serving old code.
for %%P in (8000 8001 8002 8003 8004) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P .*LISTENING"') do (
    taskkill /F /T /PID %%A >nul 2>&1
  )
)
REM Orphaned reload workers whose parent already died still hold the ports.
powershell -NoProfile -Command "$ids=@{}; $all=Get-CimInstance Win32_Process; $all|%%{$ids[[int]$_.ProcessId]=1}; $all|?{$_.Name -eq 'python.exe' -and $_.CommandLine -match 'spawn_main' -and -not $ids.ContainsKey([int]$_.ParentProcessId)}|%%{Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}"

timeout /t 1 /nobreak >nul

start "leave-auth" "%UVICORN%" services.auth_service.main:app --reload --port 8001 --host 127.0.0.1
start "leave-employee" "%UVICORN%" services.employee_service.main:app --reload --port 8002 --host 127.0.0.1
start "leave-leave" "%UVICORN%" services.leave_service.main:app --reload --port 8003 --host 127.0.0.1
start "leave-approval" "%UVICORN%" services.approval_service.main:app --reload --port 8004 --host 127.0.0.1
timeout /t 2 /nobreak >nul
REM Gateway is the edge: never trust client-sent X-Forwarded-For (used for login throttling).
start "leave-gateway" "%UVICORN%" gateway.main:app --reload --no-proxy-headers --port 8000 --host 127.0.0.1

echo.
echo Backend started:
echo   Gateway  http://127.0.0.1:8000/docs
echo   DB check http://127.0.0.1:8000/health/db
echo   Auth     :8001  Employee :8002  Leave :8003  Approval :8004
echo   Database leave_management_api  (not leave_management_db)
echo.
echo Next: start frontend with:
echo   cd ..\web-app
echo   npm run dev
echo.
endlocal
