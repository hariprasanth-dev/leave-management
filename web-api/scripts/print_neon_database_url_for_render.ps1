# Copy DATABASE_URL from repo .env.local for Render (password masked in output).
$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$envLocal = Join-Path $root ".env.local"
if (-not (Test-Path $envLocal)) {
    Write-Error "Missing $envLocal — run: neon link --project-id solitary-art-85510321 --branch production -y"
}
$line = Get-Content $envLocal | Where-Object { $_ -match '^\s*DATABASE_URL=' } | Select-Object -First 1
if (-not $line) { Write-Error "No DATABASE_URL in .env.local" }

$url = $line -replace '^\s*DATABASE_URL=', '' -replace '^"', '' -replace '"$', ''
$masked = $url -replace '://([^:]+):([^@]+)@', '://$1:***@'
Write-Host "Paste this into Render -> Environment -> DATABASE_URL:"
Write-Host ""
Write-Host $url
Write-Host ""
Write-Host "(masked: $masked)"
Set-Clipboard -Value $url
Write-Host "Full URL copied to clipboard."
