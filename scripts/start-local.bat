@echo off
setlocal
cd /d "%~dp0.."
set PYTHONPATH=%CD%

set UVICORN=%CD%\.venv\Scripts\uvicorn.exe
if not exist "%UVICORN%" (
  echo Missing venv. Run: python -m venv .venv ^&^& .venv\Scripts\pip install -r requirements.txt
  exit /b 1
)

REM Stop previous listeners on API ports (ignore errors)
for %%P in (8000 8001 8002 8003 8004) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P .*LISTENING"') do (
    taskkill /F /PID %%A >nul 2>&1
  )
)

timeout /t 1 /nobreak >nul

start "leave-auth" "%UVICORN%" services.auth_service.main:app --reload --port 8001 --host 127.0.0.1
start "leave-employee" "%UVICORN%" services.employee_service.main:app --reload --port 8002 --host 127.0.0.1
start "leave-leave" "%UVICORN%" services.leave_service.main:app --reload --port 8003 --host 127.0.0.1
start "leave-approval" "%UVICORN%" services.approval_service.main:app --reload --port 8004 --host 127.0.0.1
timeout /t 2 /nobreak >nul
start "leave-gateway" "%UVICORN%" gateway.main:app --reload --port 8000 --host 127.0.0.1

echo.
echo Backend started:
echo   Gateway  http://127.0.0.1:8000/docs
echo   Auth     :8001  Employee :8002  Leave :8003  Approval :8004
echo.
echo Next: start frontend with:
echo   cd ..\web-app
echo   npm run dev
echo.
endlocal
