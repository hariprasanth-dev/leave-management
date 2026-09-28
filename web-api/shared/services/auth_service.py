from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from shared.auth.permissions import ADMIN_ALL, ALL_PERMISSIONS
from shared.config import settings
from shared.models import LoginAttempt, PasswordResetToken, RefreshToken, User
from shared.repositories import UserRepository
from shared.schemas import (
    Role,
    TokenResponse,
    UserPublic,
)


INVALID_CREDENTIALS = "Invalid email or password"

logger = logging.getLogger("uvicorn.error")

# Checked when the email is unknown so response time doesn't reveal which accounts exist.
_DUMMY_HASH = bcrypt.hashpw(secrets.token_bytes(16), bcrypt.gensalt()).decode("utf-8")

# No 0/O, 1/l/I: the password is read from an email and typed by hand. 12 chars ≈ 69 bits.
_TEMP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"


def _generate_temp_password() -> str:
    return "-".join(
        "".join(secrets.choice(_TEMP_ALPHABET) for _ in range(4)) for _ in range(3)
    )


def _hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _check_password(raw: str, hashed: str) -> bool:
    return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))


class LoginThrottled(Exception):
    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__("Too many failed sign-in attempts")
        self.retry_after_seconds = max(1, retry_after_seconds)


@dataclass(frozen=True)
class TempPasswordNotice:
    to: str
    full_name: str
    temp_password: str
    expires_minutes: int


def _primary_role(user: User) -> Role:
    if not user.roles:
        return Role.employee
    name = user.roles[0].name
    try:
        return Role(name)
    except ValueError:
        return Role.employee


def _collect_permissions(user: User) -> list[str]:
    codes: set[str] = set()
    for role in user.roles or []:
        for perm in role.permissions or []:
            codes.add(perm.code)
    if ADMIN_ALL in codes:
        return sorted(set(ALL_PERMISSIONS))
    return sorted(codes)


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _user_to_public(user: User) -> UserPublic:
    roles = [r.name for r in (user.roles or [])]
    primary = _primary_role(user)
    return UserPublic(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=primary,
        roles=roles or [primary.value],
        permissions=_collect_permissions(user),
        employee_id=str(user.employee.id) if user.employee else None,
        must_change_password=bool(user.must_change_password),
    )


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)

    def _create_access_token(self, user: User) -> tuple[str, int]:
        expires_in = settings.jwt_expire_minutes * 60
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
        token = jwt.encode(
            {
                "sub": str(user.id),
                "email": user.email,
                "role": _primary_role(user).value,
                "type": "access",
                "iat": datetime.now(timezone.utc),
                "exp": expire,
                "jti": secrets.token_hex(16),
            },
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
        return token, expires_in

    def _create_refresh_token(self, user: User) -> str:
        raw = secrets.token_urlsafe(48)
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_expire_days)
        self.db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=_hash_token(raw),
                expires_at=expires_at,
            )
        )
        self.db.flush()
        return raw

    def _issue_tokens(self, user: User) -> TokenResponse:
        access_token, expires_in = self._create_access_token(user)
        refresh_token = self._create_refresh_token(user)
        self.db.commit()
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
        )

    def _recent_failures(self, column, value: str, since: datetime) -> tuple[int, datetime | None]:
        """Failures for this email/IP since `since` and since their last success."""
        last_success = self.db.scalar(
            select(func.max(LoginAttempt.created_at)).where(
                column == value,
                LoginAttempt.succeeded.is_(True),
            )
        )
        window_start = max(since, _aware(last_success)) if last_success else since
        count, oldest = self.db.execute(
            select(func.count(), func.min(LoginAttempt.created_at)).where(
                column == value,
                LoginAttempt.succeeded.is_(False),
                LoginAttempt.created_at > window_start,
            )
        ).one()
        return int(count or 0), (_aware(oldest) if oldest else None)

    def _check_throttle(self, email: str, ip_address: str) -> None:
        window = timedelta(minutes=settings.login_lockout_minutes)
        now = datetime.now(timezone.utc)
        since = now - window
        for column, value, limit in (
            (LoginAttempt.email, email, settings.login_max_failures_per_email),
            (LoginAttempt.ip_address, ip_address, settings.login_max_failures_per_ip),
        ):
            count, oldest = self._recent_failures(column, value, since)
            if count >= limit and oldest is not None:
                raise LoginThrottled(int((oldest + window - now).total_seconds()))

    def _record_attempt(self, email: str, ip_address: str, succeeded: bool) -> None:
        self.db.add(LoginAttempt(email=email, ip_address=ip_address, succeeded=succeeded))
        self.db.commit()

    def authenticate(self, email: str, password: str, ip_address: str = "unknown") -> TokenResponse:
        email = email.strip().lower()
        self._check_throttle(email, ip_address)

        user = self.users.get_by_email(email)
        temp_row: PasswordResetToken | None = None
        if user is None:
            _check_password(password, _DUMMY_HASH)
            valid = False
        else:
            valid = _check_password(password, user.password_hash)
            if not valid and user.is_active:
                temp_row = self._matching_temp_password(user, password)
                valid = temp_row is not None

        if not valid or user is None or not user.is_active:
            self._record_attempt(email, ip_address, succeeded=False)
            raise ValueError(INVALID_CREDENTIALS)

        now = datetime.now(timezone.utc)
        if temp_row is not None:
            temp_row.used_at = now
            user.must_change_password = True
        else:
            # Signed in with the real password: any emailed temporary password is no longer needed.
            self._retire_temp_passwords(user.id, now)
        self._record_attempt(email, ip_address, succeeded=True)
        return self._issue_tokens(user)

    def _matching_temp_password(self, user: User, password: str) -> PasswordResetToken | None:
        """The newest unused, unexpired temporary password, if `password` matches it."""
        row = self.db.scalars(
            select(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > datetime.now(timezone.utc),
            )
            .order_by(PasswordResetToken.created_at.desc())
            .limit(1)
        ).first()
        if row is not None and _check_password(password, row.token_hash):
            return row
        return None

    def _retire_temp_passwords(self, user_id: uuid.UUID, now: datetime) -> None:
        self.db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))
            .values(used_at=now)
        )

    def get_user_by_access_token(self, token: str) -> UserPublic:
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm],
                options={"require_exp": True, "require_sub": True},
            )
            if payload.get("type") != "access":
                raise ValueError("Invalid token")
            user_id = uuid.UUID(str(payload.get("sub")))
        except (JWTError, ValueError) as exc:
            raise ValueError("Invalid token") from exc

        user = self.users.get_by_id(user_id)
        if user is None or not user.is_active:
            raise ValueError("User not found")
        return _user_to_public(user)

    # Back-compat alias
    def get_user_by_token(self, token: str) -> UserPublic:
        return self.get_user_by_access_token(token)

    def refresh(self, refresh_token: str) -> TokenResponse:
        token_hash = _hash_token(refresh_token)
        row = self.db.scalars(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        ).first()
        now = datetime.now(timezone.utc)
        if row is None or row.revoked_at is not None or _aware(row.expires_at) < now:
            raise ValueError("Invalid refresh token")

        user = self.users.get_by_id(row.user_id)
        if user is None or not user.is_active:
            raise ValueError("User not found")

        row.revoked_at = now
        return self._issue_tokens(user)

    def logout(self, refresh_token: str | None) -> None:
        if not refresh_token:
            return
        token_hash = _hash_token(refresh_token)
        row = self.db.scalars(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        ).first()
        if row and row.revoked_at is None:
            row.revoked_at = datetime.now(timezone.utc)
            self.db.commit()

    def forgot_password(self, email: str) -> TempPasswordNotice | None:
        """Issue a one-time temporary password for an active account.

        The current password keeps working, so a stranger requesting resets can't lock anyone
        out. Returns None (and the caller still answers generically) for unknown or inactive
        accounts and when the hourly limit is reached.
        """
        email = email.strip().lower()
        user = self.users.get_by_email(email)
        temp_password = _generate_temp_password()
        # Hash even when nobody will use it so both paths take the same time.
        temp_hash = _hash_password(temp_password)
        if user is None or not user.is_active:
            return None

        now = datetime.now(timezone.utc)
        recent = self.db.scalar(
            select(func.count()).where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.created_at > now - timedelta(hours=1),
            )
        )
        if int(recent or 0) >= settings.temp_password_max_per_hour:
            logger.warning("[LeaveFlow auth] Temporary password limit reached for %s", user.email)
            return None

        self._retire_temp_passwords(user.id, now)
        self.db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=temp_hash,
                expires_at=now + timedelta(minutes=settings.temp_password_expire_minutes),
            )
        )
        self.db.commit()
        if settings.environment == "development" and not settings.smtp_enabled:
            logger.info(
                "[LeaveFlow auth] SMTP not configured. Temporary password for %s: %s",
                user.email,
                temp_password,
            )
        return TempPasswordNotice(
            to=user.email,
            full_name=user.full_name,
            temp_password=temp_password,
            expires_minutes=settings.temp_password_expire_minutes,
        )

    def change_password(
        self,
        user_id: str,
        current_password: str | None,
        new_password: str,
        ip_address: str = "unknown",
    ) -> TokenResponse:
        """Set a new password, sign out every other session and return fresh tokens."""
        user = self.users.get_by_id(uuid.UUID(user_id))
        if user is None or not user.is_active:
            raise ValueError("User not found")
        self._check_throttle(user.email, ip_address)

        # Right after a temporary-password sign in there is no "current" password to type.
        if not user.must_change_password:
            if not current_password or not _check_password(current_password, user.password_hash):
                self._record_attempt(user.email, ip_address, succeeded=False)
                raise ValueError("Current password is incorrect")
        if _check_password(new_password, user.password_hash):
            raise ValueError("New password must be different from your current password")

        now = datetime.now(timezone.utc)
        user.password_hash = _hash_password(new_password)
        user.must_change_password = False
        self._retire_temp_passwords(user.id, now)
        self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        return self._issue_tokens(user)
