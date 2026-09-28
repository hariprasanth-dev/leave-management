from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from shared.auth.permissions import ADMIN_ALL
from shared.db.session import get_db
from shared.schemas import Role, UserPublic
from shared.services import AuthService

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> UserPublic:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return AuthService(db).get_user_by_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[UserPublic]:
    if credentials is None:
        return None
    try:
        return AuthService(db).get_user_by_access_token(credentials.credentials)
    except ValueError:
        return None


def user_has_permission(user: UserPublic, permission: str) -> bool:
    perms = set(user.permissions or [])
    return ADMIN_ALL in perms or permission in perms


def user_has_role(user: UserPublic, *roles: str | Role) -> bool:
    wanted = {r.value if isinstance(r, Role) else r for r in roles}
    user_roles = set(user.roles or [])
    if user.role:
        user_roles.add(user.role.value if isinstance(user.role, Role) else str(user.role))
    return bool(user_roles & wanted)


def require_role(*roles: str) -> Callable[..., UserPublic]:
    """FastAPI dependency factory: require_role('manager', 'admin')."""

    def dependency(current_user: UserPublic = Depends(get_current_user)) -> UserPublic:
        if not user_has_role(current_user, *roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(roles)}",
            )
        return current_user

    return dependency


def require_permission(*permissions: str) -> Callable[..., UserPublic]:
    """FastAPI dependency factory: require_permission('leave:approve')."""

    def dependency(current_user: UserPublic = Depends(get_current_user)) -> UserPublic:
        if not any(user_has_permission(current_user, p) for p in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {', '.join(permissions)}",
            )
        return current_user

    return dependency


def require_any_permission(permissions: Iterable[str]) -> Callable[..., UserPublic]:
    return require_permission(*permissions)
