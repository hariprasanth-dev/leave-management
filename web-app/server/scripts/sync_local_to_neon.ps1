# Copy all LeaveFlow data from local PostgreSQL (pgAdmin) into Neon.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$envLocal = Join-Path (Split-Path (Get-Location) -Parent) ".env.local"
if (-not (Test-Path $envLocal)) {
    Write-Error "Missing .env.local. From repo root: neon link --project-id solitary-art-85510321 --branch production -y"
}

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Error "Run: python -m venv .venv; .venv\Scripts\pip install -r requirements.txt"
}

$env:PYTHONPATH = (Get-Location).Path

Write-Host "Dry run first (counts only)..."
& .\.venv\Scripts\python.exe scripts\sync_local_to_neon.py --dry-run
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$confirm = Read-Host "`nThis REPLACES data in Neon app tables. Continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Cancelled."
    exit 0
}

& .\.venv\Scripts\python.exe scripts\sync_local_to_neon.py
exit $LASTEXITCODE
