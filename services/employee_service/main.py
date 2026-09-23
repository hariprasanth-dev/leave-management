from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from shared.auth import (
    EMPLOYEE_MANAGE,
    EMPLOYEE_READ,
    require_permission,
    user_has_permission,
)
from shared.db.session import get_db
from shared.schemas import (
    DepartmentInfo,
    Employee,
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeUpdate,
    HealthResponse,
    UserPublic,
)
from shared.services import EmployeeService

app = FastAPI(title="LeaveFlow Employee Service", version="0.7.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="employee-service")


@app.get("/employees/departments", response_model=list[DepartmentInfo])
def list_departments(
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(EMPLOYEE_READ)),
) -> list[DepartmentInfo]:
    _ = current_user
    return EmployeeService(db).list_departments()


@app.get("/employees", response_model=EmployeeListResponse)
def list_employees(
    manager_id: Optional[str] = Query(default=None),
    department_id: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    q: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    scope: Optional[str] = Query(default=None, description="'team' limits to direct reports"),
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(EMPLOYEE_READ)),
) -> EmployeeListResponse:
    # Managers without manage default to their direct reports.
    effective_manager_id = manager_id
    if scope == "team" and current_user.employee_id:
        effective_manager_id = current_user.employee_id
    elif (
        effective_manager_id is None
        and current_user.employee_id
        and current_user.role.value == "manager"
        and not user_has_permission(current_user, EMPLOYEE_MANAGE)
    ):
        effective_manager_id = current_user.employee_id

    try:
        return EmployeeService(db).list(
            manager_id=effective_manager_id,
            department_id=department_id,
            is_active=is_active,
            q=q,
            page=page,
            page_size=page_size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/employees/{employee_id}", response_model=Employee)
def get_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(EMPLOYEE_READ)),
) -> Employee:
    _ = current_user
    try:
        return EmployeeService(db).get(employee_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/employees", response_model=Employee, status_code=201)
def create_employee(
    body: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(EMPLOYEE_MANAGE)),
) -> Employee:
    _ = current_user
    try:
        return EmployeeService(db).create(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/employees/{employee_id}", response_model=Employee)
def update_employee(
    employee_id: str,
    body: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(EMPLOYEE_MANAGE)),
) -> Employee:
    _ = current_user
    try:
        return EmployeeService(db).update(employee_id, body)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/employees/{employee_id}", response_model=Employee)
def deactivate_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(EMPLOYEE_MANAGE)),
) -> Employee:
    _ = current_user
    try:
        return EmployeeService(db).deactivate(employee_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
