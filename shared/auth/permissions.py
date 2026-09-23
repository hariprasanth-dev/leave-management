"""Canonical permission codes used across LeaveFlow."""

LEAVE_CREATE = "leave:create"
LEAVE_READ_OWN = "leave:read_own"
LEAVE_READ_TEAM = "leave:read_team"
LEAVE_APPROVE = "leave:approve"
EMPLOYEE_READ = "employee:read"
EMPLOYEE_MANAGE = "employee:manage"
ADMIN_ALL = "admin:all"

ALL_PERMISSIONS = [
    LEAVE_CREATE,
    LEAVE_READ_OWN,
    LEAVE_READ_TEAM,
    LEAVE_APPROVE,
    EMPLOYEE_READ,
    EMPLOYEE_MANAGE,
    ADMIN_ALL,
]

# Role → permissions (mirrors seed data; used for docs/tests)
ROLE_PERMISSIONS = {
    "employee": [LEAVE_CREATE, LEAVE_READ_OWN],
    "manager": [
        LEAVE_CREATE,
        LEAVE_READ_OWN,
        LEAVE_READ_TEAM,
        LEAVE_APPROVE,
        EMPLOYEE_READ,
        EMPLOYEE_MANAGE,  # Module 2: managers can maintain team records in MVP
    ],
    "hr": [
        LEAVE_CREATE,
        LEAVE_READ_OWN,
        LEAVE_READ_TEAM,
        LEAVE_APPROVE,
        EMPLOYEE_READ,
        EMPLOYEE_MANAGE,
    ],
    "admin": [ADMIN_ALL],
}
