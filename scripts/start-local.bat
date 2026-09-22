@echo off
setlocal
set PYTHONPATH=%~dp0..
cd /d "%~dp0.."

if not exist leaveflow.db (
  echo Initializing database...
  .venv\Scripts\python.exe -m scripts.init_db
)

set UVICORN=%~dp0..\ .venv\Scripts\uvicorn.exe
set UVICORN=%CD%\.venv\Scripts\uvicorn.exe

start "leave-gateway" "%UVICORN%" gateway.main:app --reload --port 8000 --host 127.0.0.1
start "leave-auth" "%UVICORN%" services.auth_service.main:app --reload --port 8001 --host 127.0.0.1
start "leave-employee" "%UVICORN%" services.employee_service.main:app --reload --port 8002 --host 127.0.0.1
start "leave-leave" "%UVICORN%" services.leave_service.main:app --reload --port 8003 --host 127.0.0.1
start "leave-approval" "%UVICORN%" services.approval_service.main:app --reload --port 8004 --host 127.0.0.1

echo Started LeaveFlow services on ports 8000-8004.
endlocal
