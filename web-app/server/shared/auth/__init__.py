"""Shared authentication and authorization.

Permission constants are safe to import without pulling in FastAPI deps.
Dependency helpers live in ``shared.auth.deps``.
"""

from shared.auth.permissions import (
    ADMIN_ALL,
    ALL_PERMISSIONS,
    EMPLOYEE_MANAGE,
    EMPLOYEE_READ,
    LEAVE_APPROVE,
    LEAVE_CREATE,
    LEAVE_READ_OWN,
    LEAVE_READ_TEAM,
    ROLE_PERMISSIONS,
)

__all__ = [
    "ADMIN_ALL",
    "ALL_PERMISSIONS",
    "EMPLOYEE_MANAGE",
    "EMPLOYEE_READ",
    "LEAVE_APPROVE",
    "LEAVE_CREATE",
    "LEAVE_READ_OWN",
    "LEAVE_READ_TEAM",
    "ROLE_PERMISSIONS",
    # Lazy-exported from deps (see __getattr__)
    "get_active_user",
    "get_current_user",
    "get_optional_user",
    "require_permission",
    "require_role",
    "require_any_permission",
    "security",
    "user_has_permission",
    "user_has_role",
]


def __getattr__(name: str):
    if name in {
        "get_active_user",
        "get_current_user",
        "get_optional_user",
        "require_permission",
        "require_role",
        "require_any_permission",
        "security",
        "user_has_permission",
        "user_has_role",
    }:
        from shared.auth import deps

        return getattr(deps, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
