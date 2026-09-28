import os
import sys
from pathlib import Path

# Vercel Root Directory = web-app → bundled copy; repo root deploy uses sibling web-api.
HERE = Path(__file__).resolve().parent
WEB_APP_ROOT = HERE.parent
BUNDLED = WEB_APP_ROOT / "server"
SIBLING = WEB_APP_ROOT.parent / "web-api"

if (BUNDLED / "gateway" / "main.py").is_file():
    WEB_API_ROOT = BUNDLED
elif (SIBLING / "gateway" / "main.py").is_file():
    WEB_API_ROOT = SIBLING
else:
    raise RuntimeError("web-api not found (expected web-app/server or ../web-api)")

sys.path.insert(0, str(WEB_API_ROOT))
os.environ.setdefault("INLINE_SERVICES", "1")
os.environ.setdefault("ENVIRONMENT", "production")

from mangum import Mangum

from gateway.main import app

handler = Mangum(app, lifespan="off")
