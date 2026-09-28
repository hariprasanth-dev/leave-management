import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB_APP_ROOT = HERE.parent
for candidate in (WEB_APP_ROOT / "server", WEB_APP_ROOT.parent / "web-api"):
    if (candidate / "vercel_bootstrap.py").is_file():
        sys.path.insert(0, str(candidate))
        break

from vercel_bootstrap import build_handler

handler = build_handler(__file__)
