"""In-app notifications, stored per user and created when a leave request changes state."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from shared.auth.permissions import LEAVE_APPROVE
from shared.models import Employee, LeaveRequest, Notification, Permission, Role, User
from shared.schemas import NotificationItem, NotificationListResponse

logger = logging.getLogger("uvicorn.error")


def _fmt_days(value: float) -> str:
    text = f"{value:g}"
    return f"{text} day" if value == 1 else f"{text} days"


def _fmt_dates(leave: LeaveRequest) -> str:
    start = leave.start_date.strftime("%d %b")
    if leave.start_date == leave.end_date:
        return start
    return f"{start} – {leave.end_date.strftime('%d %b')}"


def _leave_label(leave: LeaveRequest) -> str:
    return leave.leave_type.name if leave.leave_type else "Leave"


def leave_approvers(db: Session, leave: LeaveRequest) -> list[User]:
    """Direct manager when one is set, otherwise every active approver other than the requester."""
    employee = leave.employee
    manager = employee.manager if employee else None
    if manager is not None and manager.user is not None and manager.user.is_active:
        return [manager.user]
    stmt = (
        select(User)
        .join(User.roles)
        .join(Role.permissions)
        .where(
            Permission.code == LEAVE_APPROVE,
            User.is_active.is_(True),
            User.id != employee.user_id,
        )
        .distinct()
    )
    return list(db.execute(stmt).scalars().all())


class NotificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(
        self,
        user_id: uuid.UUID,
        kind: str,
        title: str,
        body: str,
        link: str | None,
        leave_id: uuid.UUID | None = None,
    ) -> None:
        self.db.add(
            Notification(user_id=user_id, leave_id=leave_id, kind=kind, title=title, body=body, link=link)
        )

    def resolve_submitted(self, leave_id: uuid.UUID) -> None:
        """A decided or cancelled request no longer needs the approvers' attention."""
        self.db.execute(
            update(Notification)
            .where(
                Notification.leave_id == leave_id,
                Notification.kind == "leave_submitted",
                Notification.is_read.is_(False),
            )
            .values(is_read=True)
        )

    def list_for(self, user_id: str, limit: int = 20) -> NotificationListResponse:
        uid = uuid.UUID(user_id)
        rows = self.db.execute(
            select(Notification)
            .where(Notification.user_id == uid)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        ).scalars()
        unread = self.db.execute(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == uid, Notification.is_read.is_(False))
        ).scalar_one()
        return NotificationListResponse(
            items=[
                NotificationItem(
                    id=str(n.id),
                    kind=n.kind,
                    title=n.title,
                    body=n.body,
                    link=n.link,
                    is_read=n.is_read,
                    created_at=n.created_at,
                )
                for n in rows
            ],
            unread_count=int(unread),
        )

    def mark_read(self, user_id: str, notification_id: str) -> bool:
        result = self.db.execute(
            update(Notification)
            .where(
                Notification.id == uuid.UUID(notification_id),
                Notification.user_id == uuid.UUID(user_id),
            )
            .values(is_read=True)
        )
        self.db.commit()
        return result.rowcount > 0

    def mark_all_read(self, user_id: str) -> int:
        result = self.db.execute(
            update(Notification)
            .where(Notification.user_id == uuid.UUID(user_id), Notification.is_read.is_(False))
            .values(is_read=True)
        )
        self.db.commit()
        return result.rowcount


def _record(db: Session, build) -> None:
    """Notifications are best-effort: a failure here must never undo the leave change."""
    try:
        build(NotificationService(db))
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("Failed to record in-app notification")


def notify_leave_submitted(db: Session, leave_id: str) -> None:
    leave = db.get(LeaveRequest, uuid.UUID(leave_id))
    if leave is None or leave.status != "pending" or leave.employee is None:
        return
    requester = leave.employee.user.full_name if leave.employee.user else "An employee"

    def build(svc: NotificationService) -> None:
        for approver in leave_approvers(db, leave):
            svc.add(
                approver.id,
                "leave_submitted",
                f"{requester} requested {_leave_label(leave).lower()}",
                f"{_fmt_dates(leave)} · {_fmt_days(float(leave.days))} · waiting for your approval",
                "/approvals",
                leave.id,
            )

    _record(db, build)


def notify_leave_decided(
    db: Session, leave_id: str, approver_employee_id: str | None, comment: str | None
) -> None:
    leave = db.get(LeaveRequest, uuid.UUID(leave_id))
    if leave is None or leave.status not in ("approved", "rejected") or leave.employee is None:
        return
    approver = db.get(Employee, uuid.UUID(approver_employee_id)) if approver_employee_id else None
    approver_name = approver.user.full_name if approver and approver.user else "Your manager"
    verdict = leave.status
    note = (comment or "").strip()
    body = f"{_fmt_dates(leave)} · {_fmt_days(float(leave.days))} · by {approver_name}"
    if note:
        body = f"{body} · “{note[:120]}”"

    def build(svc: NotificationService) -> None:
        svc.resolve_submitted(leave.id)
        svc.add(
            leave.employee.user_id,
            f"leave_{verdict}",
            f"Your {_leave_label(leave).lower()} was {verdict}",
            body,
            f"/leaves/{leave.id}",
            leave.id,
        )

    _record(db, build)


def notify_leave_cancelled(db: Session, leave_id: str, was_pending: bool) -> None:
    """Tell approvers a request they were waiting on is gone. Self-recorded cancellations stay quiet."""
    leave = db.get(LeaveRequest, uuid.UUID(leave_id))
    if leave is None or not was_pending or leave.employee is None:
        return
    requester = leave.employee.user.full_name if leave.employee.user else "An employee"

    def build(svc: NotificationService) -> None:
        svc.resolve_submitted(leave.id)
        for approver in leave_approvers(db, leave):
            svc.add(
                approver.id,
                "leave_cancelled",
                f"{requester} cancelled a leave request",
                f"{_leave_label(leave)} · {_fmt_dates(leave)} · no action needed",
                f"/leaves/{leave.id}",
                leave.id,
            )

    _record(db, build)
