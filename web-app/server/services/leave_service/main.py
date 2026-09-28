from __future__ import annotations

import sys
from datetime import date
from pathlib import Path
from typing import List, Optional

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
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
    get_current_user,
    require_permission,
    user_has_permission,
)
from shared.db.session import get_db
from shared.schemas import (
    HealthResponse,
    LeaveBalance,
    LeaveListResponse,
    LeavePolicy,
    LeaveRequest,
    LeaveRequestCreate,
    LeaveStats,
    LeaveStatus,
    LeaveTypeInfo,
    NotificationListResponse,
    TeamOverview,
    UserPublic,
)
from shared.services import LeaveService, working_days
from shared.services.inbox import (
    NotificationService,
    notify_leave_cancelled,
    notify_leave_decided,
    notify_leave_submitted,
)
from shared.services.notifications import (
    build_leave_decision_notice,
    build_leave_request_notice,
    send_leave_decision_email,
    send_leave_request_email,
)

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


@app.get("/leaves/stats", response_model=LeaveStats)
def get_stats(
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
    employee_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_READ_OWN)),
) -> LeaveStats:
    own_id = _require_employee_id(current_user)
    target = employee_id or own_id
    if target != own_id and not user_has_permission(current_user, LEAVE_READ_TEAM):
        raise HTTPException(status_code=403, detail="Missing permission: leave:read_team")
    try:
        return LeaveService(db).stats_for(target, year)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid employee id") from exc


@app.get("/leaves/team-overview", response_model=TeamOverview)
def get_team_overview(
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_READ_TEAM)),
) -> TeamOverview:
    return LeaveService(db).team_overview(current_user)


@app.get("/leaves/working-days")
def get_working_days(
    start_date: date = Query(...),
    end_date: date = Query(...),
    current_user: UserPublic = Depends(require_permission(LEAVE_READ_OWN)),
) -> dict[str, float | int]:
    _ = current_user
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="End date must be on or after start date")
    if (end_date - start_date).days > 366:
        raise HTTPException(status_code=400, detail="Range can't be longer than a year")
    return {
        "days": working_days(start_date, end_date),
        "calendar_days": (end_date - start_date).days + 1,
    }


@app.get("/leaves/policy", response_model=LeavePolicy)
def get_policy(
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_CREATE)),
) -> LeavePolicy:
    try:
        return LeaveService(db).policy_for(_require_employee_id(current_user))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/leaves/notifications", response_model=NotificationListResponse)
def list_notifications(
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(get_current_user),
) -> NotificationListResponse:
    return NotificationService(db).list_for(current_user.id, limit)


@app.post("/leaves/notifications/read-all")
def read_all_notifications(
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(get_current_user),
) -> dict[str, int]:
    return {"updated": NotificationService(db).mark_all_read(current_user.id)}


@app.post("/leaves/notifications/{notification_id}/read")
def read_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(get_current_user),
) -> dict[str, bool]:
    try:
        found = NotificationService(db).mark_read(current_user.id, notification_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Notification not found") from exc
    if not found:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


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
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_CREATE)),
) -> LeaveRequest:
    eid = _require_employee_id(current_user)
    try:
        created = LeaveService(db).create(body, employee_id=eid)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if created.status == LeaveStatus.pending:
        notify_leave_submitted(db, created.id)
        notice = build_leave_request_notice(db, created.id)
        if notice is not None:
            background.add_task(send_leave_request_email, notice)
    return created


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
    was_pending = leave.status == LeaveStatus.pending
    try:
        cancelled = LeaveService(db).cancel(leave_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    notify_leave_cancelled(db, cancelled.id, was_pending)
    return cancelled


@app.patch("/leaves/{leave_id}/status", response_model=LeaveRequest)
def update_status(
    leave_id: str,
    background: BackgroundTasks,
    status: LeaveStatus = Query(...),
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_APPROVE)),
) -> LeaveRequest:
    actor_id = _require_employee_id(current_user)
    try:
        updated = LeaveService(db).update_status(leave_id, status, actor_employee_id=actor_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if status in (LeaveStatus.approved, LeaveStatus.rejected):
        notify_leave_decided(db, updated.id, actor_id, None)
        notice = build_leave_decision_notice(db, updated.id, actor_id, None)
        if notice is not None:
            background.add_task(send_leave_decision_email, notice)
    return updated
