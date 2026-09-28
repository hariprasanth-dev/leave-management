from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from shared.config import settings
from shared.routers.auth import router as auth_router
from shared.schemas import HealthResponse

GATEWAY_VERSION = "0.2.1"

app = FastAPI(
    title="LeaveFlow API Gateway",
    version=GATEWAY_VERSION,
    description="Gateway with built-in /api/auth/* routes plus proxies for other services.",
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_gateway_version_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Gateway-Version"] = GATEWAY_VERSION
    return response

PROXY_SERVICES = ("employees", "leaves", "approvals")

ROUTE_MAP: dict[str, str] = {
    "employees": settings.employee_service_url,
    "leaves": settings.leave_service_url,
    "approvals": settings.approval_service_url,
}


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="gateway")


@app.on_event("startup")
def _log_gateway_version() -> None:
    import logging

    logging.getLogger("uvicorn.error").info(
        "LeaveFlow gateway %s — auth at /api/auth/login (DATABASE_URL set: %s)",
        GATEWAY_VERSION,
        bool(settings.database_url and "127.0.0.1" not in settings.database_url),
    )


@app.get("/health/version")
def health_version() -> dict[str, str]:
    """Use after deploy: must show 0.2.0+ and openapi must list /api/auth/login."""
    return {
        "gateway_version": GATEWAY_VERSION,
        "auth": "built-in",
        "login_path": "/api/auth/login",
    }


@app.get("/health/db")
def health_db() -> dict[str, Any]:
    """Show which PostgreSQL database the API is writing to (for local debugging)."""
    from sqlalchemy import text

    from shared.db.session import engine

    url = settings.database_url
    safe_url = url.split("@")[-1] if "@" in url else url
    try:
        with engine.connect() as conn:
            db_name = conn.execute(text("SELECT current_database()")).scalar()
            counts = {
                "employees": conn.execute(text("SELECT count(*) FROM employees")).scalar(),
                "users": conn.execute(text("SELECT count(*) FROM users")).scalar(),
                "leave_requests": conn.execute(text("SELECT count(*) FROM leave_requests")).scalar(),
            }
        return {
            "status": "ok",
            "database": db_name,
            "host": safe_url,
            "counts": counts,
            "browse_views": ["v_employee_directory", "v_leave_request_list"],
            "hint": (
                "Open database leave_management_api (not leave_management_db). "
                "Names/emails are on users or view v_employee_directory, not employees alone."
            ),
        }
    except Exception as exc:  # noqa: BLE001 — health must never 500-hide connection errors
        return {"status": "error", "host": safe_url, "detail": str(exc)}


@app.get("/health/services")
async def health_services() -> dict[str, Any]:
    results: dict[str, Any] = {"auth": {"status": "ok", "location": "gateway"}}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for name, base_url in ROUTE_MAP.items():
            try:
                response = await client.get(f"{base_url}/health")
                results[name] = response.json() if response.status_code == 200 else {"status": "error"}
            except httpx.HTTPError:
                results[name] = {"status": "unreachable"}
    return {"gateway": "ok", "services": results}


def _upstream_path(service: str, path: str) -> str:
    if service == "employees":
        return f"/employees/{path}" if path else "/employees"
    if service == "leaves":
        return f"/leaves/{path}" if path else "/leaves"
    if service == "approvals":
        return f"/approvals/{path}" if path else "/approvals"
    return f"/{path}"


@app.api_route("/api/{service}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@app.api_route("/api/{service}/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(
    service: Literal["employees", "leaves", "approvals"],
    request: Request,
    path: str = "",
) -> Response:
    base_url = ROUTE_MAP[service]
    upstream = f"{base_url}{_upstream_path(service, path)}"
    headers = {k: v for k, v in request.headers.items() if k.lower() not in {"host", "content-length"}}
    body = await request.body()

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            upstream_response = await client.request(
                method=request.method,
                url=upstream,
                params=request.query_params,
                content=body,
                headers=headers,
            )
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"{service} service unavailable") from exc

    excluded = {"content-encoding", "transfer-encoding", "content-length", "connection"}
    response_headers = {
        k: v for k, v in upstream_response.headers.items() if k.lower() not in excluded
    }
    return Response(
        content=upstream_response.content,
        status_code=upstream_response.status_code,
        headers=response_headers,
        media_type=upstream_response.headers.get("content-type"),
    )


@app.exception_handler(Exception)
async def unhandled_exception(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": str(exc)})
