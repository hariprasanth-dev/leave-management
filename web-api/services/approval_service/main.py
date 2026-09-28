from __future__ import annotations

import sys
from pathlib import Path
from typing import List

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from shared.auth import LEAVE_APPROVE, require_permission
from shared.db.session import get_db
from shared.schemas import (
    ApprovalAction,
    HealthResponse,
    LeaveListResponse,
    LeaveRequest,
    LeaveStatus,
    UserPublic,
)
from shared.services import ApprovalService
from shared.services.inbox import notify_leave_decided
from shared.services.notifications import build_leave_decision_notice, send_leave_decision_email

app = FastAPI(title="LeaveFlow Approval Service", version="0.6.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _require_approver_id(user: UserPublic) -> str:
    if not user.employee_id:
        raise HTTPException(status_code=400, detail="User is not linked to an employee profile")
    return user.employee_id


def _decide(
    leave_id: str,
    action: LeaveStatus,
    body: ApprovalAction | None,
    db: Session,
    current_user: UserPublic,
    background: BackgroundTasks,
) -> LeaveRequest:
    approver_id = _require_approver_id(current_user)
    comment = body.comment if body else None
    try:
        decided = ApprovalService(db).decide(
            leave_id=leave_id,
            action=action,
            approver_employee_id=approver_id,
            comment=comment,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    notify_leave_decided(db, decided.id, approver_id, comment)
    # Email goes out after the response; a mail failure never undoes the decision.
    notice = build_leave_decision_notice(db, decided.id, approver_id, comment)
    if notice is not None:
        background.add_task(send_leave_decision_email, notice)
    return decided


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="approval-service")


@app.get("/approvals/pending", response_model=List[LeaveRequest])
def pending_approvals(
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_APPROVE)),
) -> List[LeaveRequest]:
    return ApprovalService(db).pending(approver_employee_id=current_user.employee_id)


@app.get("/approvals/processed", response_model=LeaveListResponse)
def processed_approvals(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_APPROVE)),
) -> LeaveListResponse:
    _ = current_user
    return ApprovalService(db).processed(page=page, page_size=page_size)


@app.post("/approvals/{leave_id}/approve", response_model=LeaveRequest)
def approve(
    leave_id: str,
    background: BackgroundTasks,
    body: ApprovalAction | None = None,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_APPROVE)),
) -> LeaveRequest:
    return _decide(leave_id, LeaveStatus.approved, body, db, current_user, background)


@app.post("/approvals/{leave_id}/reject", response_model=LeaveRequest)
def reject(
    leave_id: str,
    background: BackgroundTasks,
    body: ApprovalAction | None = None,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_APPROVE)),
) -> LeaveRequest:
    return _decide(leave_id, LeaveStatus.rejected, body, db, current_user, background)
