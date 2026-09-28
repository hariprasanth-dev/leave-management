import sys
from pathlib import Path

WEB_API_ROOT = Path(__file__).resolve().parents[1] / "web-api"
sys.path.insert(0, str(WEB_API_ROOT))

from vercel_bootstrap import build_handler

handler = build_handler(__file__)
