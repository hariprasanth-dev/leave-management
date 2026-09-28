# Apply LeaveFlow schema + demo data using Neon (run from web-api folder).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$envLocal = Join-Path (Split-Path (Get-Location) -Parent) ".env.local"
if (-not (Test-Path $envLocal)) {
    Write-Error "Missing repo root .env.local. From repo root run: neon link --project-id solitary-art-85510321 --branch production -y"
}

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Error "Create venv first: python -m venv .venv; .venv\Scripts\pip install -r requirements.txt"
}

$env:PYTHONPATH = (Get-Location).Path

Write-Host "Step 1/3 — verify Neon connection (reads ../.env.local DATABASE_URL)..."
& .\.venv\Scripts\python.exe scripts\verify_db.py
if ($LASTEXITCODE -eq 1) { exit 1 }

Write-Host "`nStep 2/3 — alembic upgrade head..."
& .\.venv\Scripts\alembic.exe upgrade head
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nStep 3/3 — seed demo users..."
& .\.venv\Scripts\python.exe scripts\seed.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& .\.venv\Scripts\python.exe scripts\verify_db.py

Write-Host @"

Done. Start API: .\scripts\start-local.bat
Neon console: https://console.neon.tech (project solitary-art-85510321)
"@
