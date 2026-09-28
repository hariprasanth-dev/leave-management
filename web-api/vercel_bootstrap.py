"""Shared Vercel / Mangum entry bootstrap for LeaveFlow gateway."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Callable


def resolve_web_api_root(entry_file: str) -> Path:
    """Resolve web-api root from repo `api/index.py` or `web-app/api/index.py`."""
    here = Path(entry_file).resolve().parent
    web_app_root = here.parent
    bundled = web_app_root / "server"
    sibling = web_app_root.parent / "web-api"
    repo_web_api = here.parent / "web-api"

    if (bundled / "gateway" / "main.py").is_file():
        return bundled
    if (repo_web_api / "gateway" / "main.py").is_file():
        return repo_web_api
    if (sibling / "gateway" / "main.py").is_file():
        return sibling
    raise RuntimeError("LeaveFlow backend not found (web-api or web-app/server)")


def _run_migrations(web_api_root: Path) -> None:
    if os.getenv("RUN_MIGRATIONS", "1").strip() == "0":
        return
    ini = web_api_root / "alembic.ini"
    script_dir = web_api_root / "alembic"
    if not ini.is_file() or not script_dir.is_dir():
        return
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(ini))
    cfg.set_main_option("script_location", str(script_dir))
    prev = os.getcwd()
    try:
        os.chdir(web_api_root)
        command.upgrade(cfg, "head")
    finally:
        os.chdir(prev)


def validate_production_env() -> None:
    if os.getenv("ENVIRONMENT", "production").strip().lower() == "development":
        return
    if not os.getenv("DATABASE_URL", "").strip():
        raise RuntimeError(
            "DATABASE_URL is not set. In Vercel → Settings → Environment Variables (Production), "
            "add your Neon pooled connection string, then redeploy."
        )
    jwt = os.getenv("JWT_SECRET", "").strip()
    if len(jwt) < 32:
        raise RuntimeError(
            "JWT_SECRET must be at least 32 characters in Vercel environment variables, then redeploy."
        )


def build_handler(entry_file: str) -> Callable[..., dict[str, Any]]:
    os.environ.setdefault("INLINE_SERVICES", "1")
    os.environ.setdefault("ENVIRONMENT", "production")

    try:
        web_api_root = resolve_web_api_root(entry_file)
        import sys

        root_s = str(web_api_root)
        if root_s not in sys.path:
            sys.path.insert(0, root_s)

        validate_production_env()
        _run_migrations(web_api_root)

        from mangum import Mangum

        from gateway.main import app

        return Mangum(app, lifespan="off")
    except Exception as exc:
        message = str(exc)

        def _failed_handler(event: dict, context: object) -> dict[str, Any]:  # noqa: ARG001
            return {
                "statusCode": 503,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"detail": message}),
            }

        return _failed_handler
