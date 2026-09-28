import os
import sys
from pathlib import Path

# Repo layout: /api/index.py → /web-api
WEB_API_ROOT = Path(__file__).resolve().parents[1] / "web-api"
sys.path.insert(0, str(WEB_API_ROOT))
os.environ.setdefault("INLINE_SERVICES", "1")
os.environ.setdefault("ENVIRONMENT", "production")

from mangum import Mangum

from gateway.main import app

handler = Mangum(app, lifespan="off")
