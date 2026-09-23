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
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str
    reset_token: Optional[str] = None


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: Role
    roles: list[str] = []
    permissions: list[str] = []
    employee_id: Optional[str] = None


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
    employee_code: str = Field(min_length=2, max_length=30)
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
    created_at: datetime
    updated_at: Optional[datetime] = None


class LeaveListResponse(BaseModel):
    items: list[LeaveRequest]
    total: int
    page: int
    page_size: int


class ApprovalAction(BaseModel):
    comment: Optional[str] = Field(default=None, max_length=1000)


class HealthResponse(BaseModel):
    status: str
    service: str
