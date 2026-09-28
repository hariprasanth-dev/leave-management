"""Emails: leave decisions, new requests for approvers and temporary passwords."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from html import escape

from sqlalchemy.orm import Session

from shared.config import settings
from shared.models import Employee, LeaveBalance, LeaveRequest
from shared.services.mailer import send_email


@dataclass(frozen=True)
class LeaveDecisionNotice:
    leave_id: str
    to: str
    employee_name: str
    status: str
    leave_type: str
    start_date: str
    end_date: str
    days: float
    reason: str
    approver_name: str
    comment: str | None
    remaining: float | None


def build_leave_decision_notice(
    db: Session, leave_id: str, approver_employee_id: str | None, comment: str | None
) -> LeaveDecisionNotice | None:
    """Snapshot what the email needs while the request's DB session is still open."""
    leave = db.get(LeaveRequest, uuid.UUID(leave_id))
    if leave is None or leave.employee is None or leave.employee.user is None:
        return None
    user = leave.employee.user
    approver = db.get(Employee, uuid.UUID(approver_employee_id)) if approver_employee_id else None
    balance = (
        db.query(LeaveBalance)
        .filter_by(
            employee_id=leave.employee_id,
            leave_type_id=leave.leave_type_id,
            year=leave.start_date.year,
        )
        .first()
    )
    remaining = (
        max(float(balance.entitled) - float(balance.used) - float(balance.pending), 0)
        if balance
        else None
    )
    return LeaveDecisionNotice(
        leave_id=str(leave.id),
        to=user.email,
        employee_name=user.full_name,
        status=leave.status,
        leave_type=leave.leave_type.name if leave.leave_type else "Leave",
        start_date=leave.start_date.strftime("%d %b %Y"),
        end_date=leave.end_date.strftime("%d %b %Y"),
        days=float(leave.days),
        reason=leave.reason,
        approver_name=approver.user.full_name if approver and approver.user else "Your manager",
        comment=(comment or "").strip() or None,
        remaining=remaining,
    )


def _fmt_days(value: float) -> str:
    text = f"{value:g}"
    return f"{text} day" if value == 1 else f"{text} days"


def send_leave_decision_email(notice: LeaveDecisionNotice) -> bool:
    approved = notice.status == "approved"
    verdict = "approved" if approved else "rejected"
    dates = (
        notice.start_date
        if notice.start_date == notice.end_date
        else f"{notice.start_date} – {notice.end_date}"
    )
    link = f"{settings.frontend_url.rstrip('/')}/leaves/{notice.leave_id}"
    subject = f"Your {notice.leave_type} request was {verdict} ({dates})"

    rows = [
        ("Status", verdict.capitalize()),
        ("Leave type", notice.leave_type),
        ("Dates", dates),
        ("Working days", _fmt_days(notice.days)),
        ("Reason", notice.reason),
        ("Decided by", notice.approver_name),
    ]
    if notice.comment:
        rows.append(("Comment", notice.comment))
    if notice.remaining is not None:
        rows.append((f"{notice.leave_type} left", _fmt_days(notice.remaining)))

    first_name = notice.employee_name.split(" ")[0] or notice.employee_name
    intro = (
        f"Good news, your leave request has been approved by {notice.approver_name}."
        if approved
        else f"Your leave request has been rejected by {notice.approver_name}."
    )
    text = _render_text(first_name, intro, rows, "View the request", link)
    html = _render_html(
        badge=verdict,
        accent="#0f766e" if approved else "#b91c1c",
        badge_bg="#ccfbf1" if approved else "#fee2e2",
        first_name=first_name,
        intro=intro,
        rows=rows,
        button="View request",
        link=link,
    )
    return send_email(notice.to, subject, text, html)


@dataclass(frozen=True)
class LeaveRequestNotice:
    leave_id: str
    to: list[str]
    manager_names: list[str]
    employee_name: str
    employee_code: str | None
    leave_type: str
    start_date: str
    end_date: str
    days: float
    reason: str
    available_after: float | None


def build_leave_request_notice(db: Session, leave_id: str) -> LeaveRequestNotice | None:
    """Snapshot a newly submitted request for the approvers' email. None when no one needs to act."""
    from shared.services.inbox import leave_approvers

    leave = db.get(LeaveRequest, uuid.UUID(leave_id))
    if leave is None or leave.status != "pending" or leave.employee is None:
        return None
    approvers = [u for u in leave_approvers(db, leave) if u.email]
    if not approvers:
        return None
    balance = (
        db.query(LeaveBalance)
        .filter_by(
            employee_id=leave.employee_id,
            leave_type_id=leave.leave_type_id,
            year=leave.start_date.year,
        )
        .first()
    )
    available_after = (
        max(float(balance.entitled) - float(balance.used) - float(balance.pending), 0)
        if balance
        else None
    )
    return LeaveRequestNotice(
        leave_id=str(leave.id),
        to=[u.email for u in approvers],
        manager_names=[u.full_name for u in approvers],
        employee_name=leave.employee.user.full_name if leave.employee.user else "An employee",
        employee_code=leave.employee.employee_code,
        leave_type=leave.leave_type.name if leave.leave_type else "Leave",
        start_date=leave.start_date.strftime("%d %b %Y"),
        end_date=leave.end_date.strftime("%d %b %Y"),
        days=float(leave.days),
        reason=leave.reason,
        available_after=available_after,
    )


def send_leave_request_email(notice: LeaveRequestNotice) -> int:
    """Email each approver; returns how many messages were accepted by the SMTP server."""
    dates = (
        notice.start_date
        if notice.start_date == notice.end_date
        else f"{notice.start_date} – {notice.end_date}"
    )
    link = f"{settings.frontend_url.rstrip('/')}/approvals"
    who = f"{notice.employee_name} ({notice.employee_code})" if notice.employee_code else notice.employee_name
    subject = f"Leave request from {notice.employee_name}: {notice.leave_type}, {dates}"
    rows = [
        ("Employee", who),
        ("Leave type", notice.leave_type),
        ("Dates", dates),
        ("Working days", _fmt_days(notice.days)),
        ("Reason", notice.reason),
    ]
    if notice.available_after is not None:
        rows.append((f"{notice.leave_type} left after this", _fmt_days(notice.available_after)))
    intro = f"{notice.employee_name} has requested leave and is waiting for your approval."

    sent = 0
    for to, name in zip(notice.to, notice.manager_names):
        first_name = name.split(" ")[0] or name
        text = _render_text(first_name, intro, rows, "Review it", link)
        html = _render_html(
            badge="Action needed",
            accent="#b45309",
            badge_bg="#fef3c7",
            first_name=first_name,
            intro=intro,
            rows=rows,
            button="Review request",
            link=link,
        )
        if send_email(to, subject, text, html):
            sent += 1
    return sent


def send_temp_password_email(to: str, full_name: str, temp_password: str, expires_minutes: int) -> bool:
    first_name = full_name.split(" ")[0] or full_name
    link = f"{settings.frontend_url.rstrip('/')}/login"
    subject = f"Your {settings.app_name} temporary password"
    intro = (
        "We received a request to reset your password. Use this temporary password to sign in. "
        "You'll be asked to choose a new password straight away."
    )
    rows = [
        ("Works", "Once, for a single sign in"),
        ("Expires", f"In {expires_minutes} minutes"),
        ("Didn't ask?", "Ignore this email. Your current password still works."),
    ]
    text = "\n".join(
        [f"Hi {first_name},", "", intro, "", f"Temporary password: {temp_password}", ""]
        + [f"{label}: {value}" for label, value in rows]
        + ["", f"Sign in: {link}", "", f"— {settings.app_name}"]
    )
    html = _render_html(
        badge="Password reset",
        accent="#1e40af",
        badge_bg="#dbeafe",
        first_name=first_name,
        intro=intro,
        rows=rows,
        button="Sign in",
        link=link,
        code=temp_password,
    )
    return send_email(to, subject, text, html)


def _render_text(first_name: str, intro: str, rows: list[tuple[str, str]], cta: str, link: str) -> str:
    return "\n".join(
        [f"Hi {first_name},", "", intro, ""]
        + [f"{label}: {value}" for label, value in rows]
        + ["", f"{cta}: {link}", "", f"— {settings.app_name}"]
    )


def _render_html(
    *,
    badge: str,
    accent: str,
    badge_bg: str,
    first_name: str,
    intro: str,
    rows: list[tuple[str, str]],
    button: str,
    link: str,
    code: str | None = None,
) -> str:
    code_block = (
        f'<p style="margin:0 0 18px;padding:14px 18px;border-radius:10px;background:#f1f5f9;'
        f"border:1px dashed #94a3b8;text-align:center;font-family:Consolas,Menlo,monospace;"
        f'font-size:22px;font-weight:700;letter-spacing:.08em;color:#0f172a">{escape(code)}</p>'
        if code
        else ""
    )
    table_rows = "".join(
        f'<tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:140px;vertical-align:top">'
        f"{escape(label)}</td>"
        f'<td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600">{escape(value)}</td></tr>'
        for label, value in rows
    )
    return f"""<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0"
 style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:linear-gradient(135deg,#0f766e,#1e40af);padding:20px 28px;color:#fff;font-size:18px;font-weight:700">
{escape(settings.app_name)}</td></tr>
<tr><td style="padding:28px">
<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:{badge_bg};color:{accent};
 font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">{escape(badge)}</span>
<h1 style="margin:14px 0 6px;font-size:20px;color:#0f172a">Hi {escape(first_name)},</h1>
<p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.5">{escape(intro)}</p>
{code_block}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
 style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">{table_rows}</table>
<p style="margin:24px 0 0"><a href="{escape(link)}"
 style="display:inline-block;background:{accent};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">
{escape(button)}</a></p>
</td></tr>
<tr><td style="padding:14px 28px;background:#f8fafc;color:#94a3b8;font-size:12px">
This is an automated message from {escape(settings.app_name)}. Please don't reply.</td></tr>
</table></td></tr></table>
</body></html>"""
