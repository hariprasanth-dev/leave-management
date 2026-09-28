from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


class LeaveStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class LeaveType(str, Enum):
    """Fixed MVP policy leave types."""

    earned = "earned"
    sick = "sick"


LEAVE_TYPE_LABELS = {
    LeaveType.earned: "Earned Leave",
    LeaveType.sick: "Sick Leave",
}

LEAVE_POLICY_DAYS = {
    LeaveType.earned: 12,
    LeaveType.sick: 10,
}


class Role(str, Enum):
    employee = "employee"
    manager = "manager"
    hr = "hr"
    admin = "admin"


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    # Not required right after signing in with a temporary password.
    current_password: Optional[str] = Field(default=None, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def validate_strength(self):
        pw = self.new_password
        if pw != pw.strip():
            raise ValueError("Password can't start or end with a space")
        if not any(c.isalpha() for c in pw) or not any(c.isdigit() for c in pw):
            raise ValueError("Password must include at least one letter and one number")
        return self


class MessageResponse(BaseModel):
    message: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: Role
    roles: list[str] = []
    permissions: list[str] = []
    employee_id: Optional[str] = None
    must_change_password: bool = False


class DepartmentInfo(BaseModel):
    id: str
    name: str
    code: str


class Employee(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    department: str
    department_id: Optional[str] = None
    employee_code: Optional[str] = None
    hire_date: Optional[date] = None
    is_active: bool = True
    role: Role
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None


class EmployeeCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=150)
    password: str = Field(min_length=8, max_length=128)
    department_id: str
    manager_id: Optional[str] = None
    hire_date: Optional[date] = None
    role: Role = Role.employee

    @model_validator(mode="after")
    def validate_role(self):
        if self.role not in (Role.employee, Role.manager, Role.hr):
            raise ValueError("Role must be employee, manager, or hr")
        return self


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    department_id: Optional[str] = None
    manager_id: Optional[str] = None
    hire_date: Optional[date] = None
    is_active: Optional[bool] = None
    role: Optional[Role] = None


class EmployeeListResponse(BaseModel):
    items: list[Employee]
    total: int
    page: int
    page_size: int
    status_counts: dict[str, int] = Field(default_factory=dict)


class LeaveBalance(BaseModel):
    leave_type: LeaveType
    name: str
    total: float
    used: float
    pending: float
    remaining: float
    available: float


class LeaveTypeInfo(BaseModel):
    code: LeaveType
    name: str
    days_per_year: int


class LeaveRequestCreate(BaseModel):
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str = Field(min_length=3, max_length=1000)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("End date must be on or after start date")
        return self


class LeaveRequest(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    leave_type: LeaveType
    leave_type_name: str = ""
    start_date: date
    end_date: date
    days: float
    reason: str
    status: LeaveStatus
    self_recorded: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None


class LeavePolicy(BaseModel):
    """How the current user's leave is handled: routed for approval or recorded directly."""

    requires_approval: bool
    approver_name: Optional[str] = None


class LeaveListResponse(BaseModel):
    items: list[LeaveRequest]
    total: int
    page: int
    page_size: int


class NotificationItem(BaseModel):
    id: str
    kind: str
    title: str
    body: str = ""
    link: Optional[str] = None
    is_read: bool = False
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationItem]
    unread_count: int


class LeaveStatsBucket(BaseModel):
    """Working days on leave that fall inside one month or on one weekday."""

    key: int
    label: str
    approved: float = 0
    pending: float = 0


class LeaveStatsByType(BaseModel):
    leave_type: LeaveType
    name: str
    entitled: float
    approved: float = 0
    pending: float = 0
    remaining: float = 0


class LeaveStats(BaseModel):
    year: int
    available_years: list[int]
    approved_days: float
    pending_days: float
    request_counts: dict[str, int]
    by_type: list[LeaveStatsByType]
    monthly: list[LeaveStatsBucket]
    weekday: list[LeaveStatsBucket]


class TeamMemberSummary(BaseModel):
    employee_id: str
    full_name: str
    employee_code: Optional[str] = None
    email: str
    department: str
    on_leave_until: Optional[date] = None
    next_leave_start: Optional[date] = None
    entitled_days: float = 0
    taken_days: float = 0
    pending_days: float = 0
    available_days: float = 0


class TeamOverview(BaseModel):
    scope: str
    year: int
    team_size: int
    pending_count: int
    pending: list[LeaveRequest]
    on_leave_today: list[LeaveRequest]
    upcoming: list[LeaveRequest]
    members: list[TeamMemberSummary]
    monthly: list[LeaveStatsBucket]
    by_type: list[LeaveStatsByType]
    approved_days_this_month: float


class ApprovalAction(BaseModel):
    comment: Optional[str] = Field(default=None, max_length=1000)


class HealthResponse(BaseModel):
    status: str
    service: str
