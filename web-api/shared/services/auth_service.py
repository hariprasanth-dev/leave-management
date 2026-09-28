from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from shared.auth.permissions import ADMIN_ALL, ALL_PERMISSIONS
from shared.config import settings
from shared.models import PasswordResetToken, RefreshToken, User
from shared.repositories import UserRepository
from shared.schemas import (
    MessageResponse,
    Role,
    TokenResponse,
    UserPublic,
)


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
                "exp": expire,
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

    def authenticate(self, email: str, password: str) -> TokenResponse:
        user = self.users.get_by_email(email)
        if (
            user is None
            or not user.is_active
            or not bcrypt.checkpw(password.encode("utf-8"), user.password_hash.encode("utf-8"))
        ):
            raise ValueError("Invalid credentials")
        return self._issue_tokens(user)

    def get_user_by_access_token(self, token: str) -> UserPublic:
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            if payload.get("type") != "access":
                raise ValueError("Invalid token")
            user_id = payload.get("sub")
            email = payload.get("email")
        except JWTError as exc:
            raise ValueError("Invalid token") from exc

        user = None
        if user_id:
            try:
                user = self.users.get_by_id(uuid.UUID(user_id))
            except ValueError:
                user = None
        if user is None and email:
            user = self.users.get_by_email(email)
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

    def forgot_password(self, email: str) -> MessageResponse:
        """Always return a generic message to avoid email enumeration."""
        user = self.users.get_by_email(email)
        reset_token: str | None = None
        if user and user.is_active:
            raw = secrets.token_urlsafe(32)
            expires_at = datetime.now(timezone.utc) + timedelta(
                minutes=settings.password_reset_expire_minutes
            )
            self.db.add(
                PasswordResetToken(
                    user_id=user.id,
                    token_hash=_hash_token(raw),
                    expires_at=expires_at,
                )
            )
            self.db.commit()
            reset_token = raw
            # In production, email this link instead of returning the token.
            print(
                f"[LeaveFlow] Password reset for {user.email}: "
                f"{settings.frontend_url}/reset-password?token={raw}"
            )

        response = MessageResponse(
            message="If that email exists, a password reset link has been sent.",
        )
        if settings.environment == "development" and reset_token:
            response.reset_token = reset_token
        return response

    def reset_password(self, token: str, new_password: str) -> MessageResponse:
        token_hash = _hash_token(token)
        row = self.db.scalars(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        ).first()
        now = datetime.now(timezone.utc)
        if row is None or row.used_at is not None or _aware(row.expires_at) < now:
            raise ValueError("Invalid or expired reset token")

        user = self.users.get_by_id(row.user_id)
        if user is None or not user.is_active:
            raise ValueError("User not found")

        user.password_hash = bcrypt.hashpw(
            new_password.encode("utf-8"),
            bcrypt.gensalt(),
        ).decode("utf-8")
        row.used_at = now

        # Revoke all refresh tokens for this user
        for rt in self.db.scalars(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at.is_(None),
            )
        ).all():
            rt.revoked_at = now

        self.db.commit()
        return MessageResponse(message="Password updated successfully. You can sign in now.")
