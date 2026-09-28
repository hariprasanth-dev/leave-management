"""Outgoing email over SMTP (stdlib only). Failures are logged, never raised to callers."""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

from shared.config import settings

logger = logging.getLogger("uvicorn.error")


def send_email(to: str, subject: str, text: str, html: str | None = None) -> bool:
    """Send one message. Returns True when the SMTP server accepted it."""
    if not to:
        return False
    if not settings.smtp_enabled:
        logger.info("[LeaveFlow mail] SMTP not configured; would send %r to %s", subject, to)
        return False

    msg = EmailMessage()
    msg["From"] = settings.mail_from
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=settings.mail_from.rsplit("@", 1)[-1].strip("> ") or None)
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        context = ssl.create_default_context()
        if settings.smtp_ssl:
            server: smtplib.SMTP = smtplib.SMTP_SSL(
                settings.smtp_host, settings.smtp_port,
                timeout=settings.smtp_timeout_seconds, context=context,
            )
        else:
            server = smtplib.SMTP(
                settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds
            )
        with server:
            server.ehlo()
            if settings.smtp_starttls and not settings.smtp_ssl:
                server.starttls(context=context)
                server.ehlo()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)
        logger.info("[LeaveFlow mail] Sent %r to %s", subject, to)
        return True
    except (smtplib.SMTPException, OSError) as exc:
        logger.warning("[LeaveFlow mail] Failed to send %r to %s: %s", subject, to, exc)
        return False
