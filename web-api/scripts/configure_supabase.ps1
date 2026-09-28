# Prompts for Supabase DB password and writes web-api/.env (does not print password).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$projectHost = Read-Host "Supabase host [db.jfijejumpohkwgoxikye.supabase.co]"
if (-not $projectHost) { $projectHost = "db.jfijejumpohkwgoxikye.supabase.co" }

$region = Read-Host "Supabase region [ap-northeast-1] (Settings → General)"
if (-not $region) { $region = "ap-northeast-1" }

$secure = Read-Host "Supabase database password (Project Settings → Database)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if (-not $password) {
    Write-Error "Password cannot be empty."
}

$envContent = @"
# Supabase PostgreSQL (same tables as local leave_management_api after alembic upgrade head)
DATABASE_HOST=$projectHost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_NAME=postgres
DATABASE_SSLMODE=require
SUPABASE_REGION=$region
SUPABASE_USE_POOLER=true
DATABASE_PASSWORD=$password

JWT_SECRET=dev-secret-change-me-in-production
ENVIRONMENT=development
FRONTEND_URL=http://127.0.0.1:5173
AUTH_SERVICE_URL=http://127.0.0.1:8001
EMPLOYEE_SERVICE_URL=http://127.0.0.1:8002
LEAVE_SERVICE_URL=http://127.0.0.1:8003
APPROVAL_SERVICE_URL=http://127.0.0.1:8004
"@

Set-Content -Path ".env" -Value $envContent -Encoding utf8
Write-Host "Wrote web-api/.env. Next: .\scripts\setup_supabase.ps1"
