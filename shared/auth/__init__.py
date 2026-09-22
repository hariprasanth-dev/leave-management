"""Shared authentication and authorization dependencies."""

from shared.auth.deps import (
    get_current_user,
    get_optional_user,
    require_permission,
    require_role,
    security,
    user_has_permission,
    user_has_role,
)
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
    "get_current_user",
    "get_optional_user",
    "require_permission",
    "require_role",
    "security",
    "user_has_permission",
    "user_has_role",
]
