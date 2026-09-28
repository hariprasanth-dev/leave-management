# Apply LeaveFlow schema + demo data to Supabase (run from web-api folder).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Error "Create venv first: python -m venv .venv; .venv\Scripts\pip install -r requirements.txt"
}

$env:PYTHONPATH = (Get-Location).Path

Write-Host "Step 1/3 — verify .env (Supabase credentials)..."
& .\.venv\Scripts\python.exe scripts\verify_db.py
if ($LASTEXITCODE -eq 1) {
    Write-Host "Fix .env first. Run: .\scripts\configure_supabase.ps1"
    exit 1
}

Write-Host "`nStep 2/3 — alembic upgrade head (creates tables on Supabase)..."
& .\.venv\Scripts\alembic.exe upgrade head
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nStep 3/3 — seed demo users (employee@example.com / password123)..."
& .\.venv\Scripts\python.exe scripts\seed.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nStep 4 — verify again..."
& .\.venv\Scripts\python.exe scripts\verify_db.py

Write-Host @"

Done. Start API: .\scripts\start-local.bat
Check: http://127.0.0.1:8000/health/db

Supabase: open Table Editor — same table names as pgAdmin (users, employees, leave_requests, ...).
Render: copy the same DATABASE_* variables from .env into Environment (no .env file on Render).
"@
