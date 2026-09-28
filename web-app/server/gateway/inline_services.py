"""Mount employee, leave, and approval routes on the gateway (no HTTP microservices)."""

from __future__ import annotations

import os

from fastapi import FastAPI
from starlette.applications import Starlette


def mount_inline_services(app: FastAPI) -> None:
    if os.getenv("INLINE_SERVICES") != "1":
        return

    from services.approval_service.main import app as approval_app
    from services.employee_service.main import app as employee_app
    from services.leave_service.main import app as leave_app

    routes = []
    for sub in (employee_app, leave_app, approval_app):
        routes.extend(sub.router.routes)

    combined = Starlette(routes=routes)
    app.mount("/api", combined)
