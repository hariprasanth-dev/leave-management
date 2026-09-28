#!/usr/bin/env bash
# Render build command (Settings → Build → Build Command: bash build.sh)
set -euo pipefail
export PYTHONPATH="${PYTHONPATH:-$(pwd)}"
pip install -r requirements.txt
python -c "
from gateway.main import GATEWAY_VERSION
print('=== LeaveFlow gateway build:', GATEWAY_VERSION, '===')
if GATEWAY_VERSION < '0.2.2':
    raise SystemExit('Refusing to build: need gateway 0.2.2+ for /api/auth/login')
"
