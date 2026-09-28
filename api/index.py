"""Vercel Python entry.

The runtime serves the top-level FastAPI `app` over ASGI. A Mangum `handler`
makes the function crash with FUNCTION_INVOCATION_FAILED.
"""

import sys
from pathlib import Path

from fastapi import FastAPI

# Literal FastAPI() assignment so Vercel detects this file as the ASGI entrypoint.
app = FastAPI()

_here = Path(__file__).resolve().parent
for _candidate in (
    _here.parent / "web-api",
    _here.parent / "server",
    _here.parent.parent / "web-api",
):
    if (_candidate / "vercel_bootstrap.py").is_file():
        _path = str(_candidate)
        if _path not in sys.path:
            sys.path.insert(0, _path)
        break

from vercel_bootstrap import load_app

app = load_app(__file__)
