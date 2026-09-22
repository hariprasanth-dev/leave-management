from __future__ import annotations

import sys
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, HTTPException, Query
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


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="approval-service")


@app.get("/approvals/pending", response_model=List[LeaveRequest])
def pending_approvals(
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_APPROVE)),
) -> List[LeaveRequest]:
    _ = current_user
    return ApprovalService(db).pending()


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
    body: ApprovalAction | None = None,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_APPROVE)),
) -> LeaveRequest:
    try:
        return ApprovalService(db).decide(
            leave_id=leave_id,
            action=LeaveStatus.approved,
            approver_employee_id=_require_approver_id(current_user),
            comment=body.comment if body else None,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/approvals/{leave_id}/reject", response_model=LeaveRequest)
def reject(
    leave_id: str,
    body: ApprovalAction | None = None,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(require_permission(LEAVE_APPROVE)),
) -> LeaveRequest:
    try:
        return ApprovalService(db).decide(
            leave_id=leave_id,
            action=LeaveStatus.rejected,
            approver_employee_id=_require_approver_id(current_user),
            comment=body.comment if body else None,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
