from __future__ import annotations

import sys
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from shared.auth import (
    LEAVE_APPROVE,
    LEAVE_CREATE,
    LEAVE_READ_OWN,
    LEAVE_READ_TEAM,
    require_permission,
    user_has_permission,
)
from shared.db.session import get_db
from shared.schemas import (
    HealthResponse,
    LeaveBalance,
    LeaveListResponse,
    LeaveRequest,
    LeaveRequestCreate,
    LeaveStatus,
    LeaveTypeInfo,
    UserPublic,
)
from shared.services import LeaveService

app = FastAPI(title="LeaveFlow Leave Service", version="0.6.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _require_employee_id(user: UserPublic) -> str:
    if not user.employee_id:
        raise HTTPException(status_code=400, detail="User is not linked to an employee profile")
    return user.employee_id


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="leave-service")


@app.get("/leaves/types", response_model=List[LeaveTypeInfo])
def list_leave_types(
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_READ_OWN)),
) -> List[LeaveTypeInfo]:
    _ = current_user
    return LeaveService(db).list_types()


@app.get("/leaves/balances", response_model=List[LeaveBalance])
def get_balances(
    employee_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_READ_OWN)),
) -> List[LeaveBalance]:
    own_id = _require_employee_id(current_user)
    target = employee_id or own_id
    if target != own_id and not user_has_permission(current_user, LEAVE_READ_TEAM):
        raise HTTPException(status_code=403, detail="Missing permission: leave:read_team")
    return LeaveService(db).balances_for(target)


@app.get("/leaves", response_model=LeaveListResponse)
def list_leaves(
    employee_id: Optional[str] = Query(default=None),
    status: Optional[LeaveStatus] = Query(default=None),
    q: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_READ_OWN)),
) -> LeaveListResponse:
    own_id = _require_employee_id(current_user)
    status_value = status.value if status else None

    if employee_id and employee_id != own_id:
        if not user_has_permission(current_user, LEAVE_READ_TEAM):
            raise HTTPException(status_code=403, detail="Missing permission: leave:read_team")
        return LeaveService(db).list(
            employee_id=employee_id,
            status=status_value,
            q=q,
            page=page,
            page_size=page_size,
        )

    if user_has_permission(current_user, LEAVE_READ_TEAM) and employee_id is None:
        # Manager team inbox (optionally filtered)
        return LeaveService(db).list(
            employee_id=None,
            status=status_value,
            q=q,
            page=page,
            page_size=page_size,
        )

    return LeaveService(db).list(
        employee_id=own_id,
        status=status_value,
        q=q,
        page=page,
        page_size=page_size,
    )


@app.get("/leaves/{leave_id}", response_model=LeaveRequest)
def get_leave(
    leave_id: str,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_READ_OWN)),
) -> LeaveRequest:
    try:
        leave = LeaveService(db).get(leave_id)
    except (LookupError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    own_id = _require_employee_id(current_user)
    if leave.employee_id != own_id and not user_has_permission(current_user, LEAVE_READ_TEAM):
        raise HTTPException(status_code=403, detail="Forbidden")
    return leave


@app.post("/leaves", response_model=LeaveRequest, status_code=201)
def create_leave(
    body: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_CREATE)),
) -> LeaveRequest:
    eid = _require_employee_id(current_user)
    try:
        return LeaveService(db).create(body, employee_id=eid)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/leaves/{leave_id}/cancel", response_model=LeaveRequest)
def cancel_leave(
    leave_id: str,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_READ_OWN)),
) -> LeaveRequest:
    try:
        leave = LeaveService(db).get(leave_id)
    except (LookupError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    own_id = _require_employee_id(current_user)
    if leave.employee_id != own_id:
        raise HTTPException(status_code=403, detail="You can only cancel your own leave requests")
    try:
        return LeaveService(db).cancel(leave_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/leaves/{leave_id}/status", response_model=LeaveRequest)
def update_status(
    leave_id: str,
    status: LeaveStatus = Query(...),
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_APPROVE)),
) -> LeaveRequest:
    _ = current_user
    try:
        return LeaveService(db).update_status(leave_id, status)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
