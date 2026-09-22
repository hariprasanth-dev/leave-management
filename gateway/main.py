from typing import Any

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
from shared.schemas import HealthResponse

app = FastAPI(
    title="LeaveFlow API Gateway",
    version="0.1.0",
    description="Routes client traffic to LeaveFlow microservices.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROUTE_MAP: dict[str, str] = {
    "auth": settings.auth_service_url,
    "employees": settings.employee_service_url,
    "leaves": settings.leave_service_url,
    "approvals": settings.approval_service_url,
}


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="gateway")


@app.get("/health/services")
async def health_services() -> dict[str, Any]:
    results: dict[str, Any] = {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for name, base_url in ROUTE_MAP.items():
            try:
                response = await client.get(f"{base_url}/health")
                results[name] = response.json() if response.status_code == 200 else {"status": "error"}
            except httpx.HTTPError:
                results[name] = {"status": "unreachable"}
    return {"gateway": "ok", "services": results}


def _upstream_path(service: str, path: str) -> str:
    """Map gateway /api/{service}/... to the service's own routes."""
    if service == "auth":
        # /api/auth/login -> /login, /api/auth/me -> /me
        return f"/{path}" if path else "/"
    if service == "employees":
        return f"/employees/{path}" if path else "/employees"
    if service == "leaves":
        return f"/leaves/{path}" if path else "/leaves"
    if service == "approvals":
        return f"/approvals/{path}" if path else "/approvals"
    return f"/{path}"


@app.api_route("/api/{service}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@app.api_route("/api/{service}/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(service: str, request: Request, path: str = "") -> Response:
    base_url = ROUTE_MAP.get(service)
    if not base_url:
        raise HTTPException(status_code=404, detail=f"Unknown service '{service}'")

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
