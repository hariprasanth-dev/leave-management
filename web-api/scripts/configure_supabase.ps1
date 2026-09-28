# Prompts for Supabase DB password and writes web-api/.env (does not print password).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$secure = Read-Host "Supabase database password (Project Settings → Database)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if (-not $password) {
    Write-Error "Password cannot be empty."
}

$envContent = @"
# Supabase
DATABASE_HOST=db.jfijejumpohkwgoxikye.supabase.co
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_NAME=postgres
DATABASE_SSLMODE=require
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
Write-Host "Wrote web-api/.env with DATABASE_PASSWORD. Run: alembic upgrade head"
