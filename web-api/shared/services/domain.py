from __future__ import annotations

import uuid
from datetime import date

import bcrypt
from sqlalchemy import select
from sqlalchemy.orm import Session

from shared.models import (
    Employee,
    LeaveApproval,
    LeaveBalance,
    LeaveRequest,
    Role as RoleModel,
    User,
    UserRole,
)
from shared.repositories import (
    DepartmentRepository,
    EmployeeRepository,
    LeaveBalanceRepository,
    LeaveRequestRepository,
    LeaveTypeRepository,
)
from shared.schemas import (
    LEAVE_POLICY_DAYS,
    LEAVE_TYPE_LABELS,
    DepartmentInfo,
    Employee as EmployeeSchema,
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeUpdate,
    LeaveBalance as LeaveBalanceSchema,
    LeaveListResponse,
    LeaveRequest as LeaveRequestSchema,
    LeaveRequestCreate,
    LeaveStatus,
    LeaveType as LeaveTypeEnum,
    LeaveTypeInfo,
    Role,
)
from shared.services.auth_service import _primary_role


def working_days(start: date, end: date) -> float:
    """Count full Mon–Fri days inclusive. Public holidays are ignored (MVP policy)."""
    if end < start:
        return 0.0
    days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:
            days += 1
        current = date.fromordinal(current.toordinal() + 1)
    return float(days)


def leave_to_schema(leave: LeaveRequest) -> LeaveRequestSchema:
    employee_name = None
    if leave.employee and leave.employee.user:
        employee_name = leave.employee.user.full_name
    code = leave.leave_type.code if leave.leave_type else LeaveTypeEnum.earned.value
    try:
        leave_type = LeaveTypeEnum(code)
    except ValueError:
        leave_type = LeaveTypeEnum.earned
    return LeaveRequestSchema(
        id=str(leave.id),
        employee_id=str(leave.employee_id),
        employee_name=employee_name,
        leave_type=leave_type,
        leave_type_name=LEAVE_TYPE_LABELS.get(leave_type, leave_type.value),
        start_date=leave.start_date,
        end_date=leave.end_date,
        days=float(leave.days),
        reason=leave.reason,
        status=LeaveStatus(leave.status),
        created_at=leave.created_at,
        updated_at=leave.updated_at,
    )


class EmployeeService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.employees = EmployeeRepository(db)
        self.departments = DepartmentRepository(db)
        self.leave_types = LeaveTypeRepository(db)

    def list_departments(self) -> list[DepartmentInfo]:
        return [
            DepartmentInfo(id=str(d.id), name=d.name, code=d.code)
            for d in self.departments.list()
        ]

    def list(
        self,
        manager_id: str | None = None,
        department_id: str | None = None,
        is_active: bool | None = None,
        q: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> EmployeeListResponse:
        mid = uuid.UUID(manager_id) if manager_id else None
        did = uuid.UUID(department_id) if department_id else None
        items, total = self.employees.list(
            manager_id=mid,
            department_id=did,
            is_active=is_active,
            q=q,
            page=page,
            page_size=page_size,
        )
        return EmployeeListResponse(
            items=[self._to_schema(e) for e in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    def get(self, employee_id: str) -> EmployeeSchema:
        employee = self.employees.get_by_id(uuid.UUID(employee_id))
        if employee is None:
            raise LookupError("Employee not found")
        return self._to_schema(employee)

    def create(self, body: EmployeeCreate) -> EmployeeSchema:
        email = body.email.lower().strip()
        existing_user = self.db.scalars(select(User).where(User.email == email)).first()
        if existing_user is not None:
            raise ValueError("Email already registered")

        if self.employees.get_by_code(body.employee_code.strip().upper()):
            raise ValueError("Employee code already exists")

        department = self.departments.get_by_id(uuid.UUID(body.department_id))
        if department is None:
            raise ValueError("Department not found")

        manager = None
        if body.manager_id:
            manager = self.employees.get_by_id(uuid.UUID(body.manager_id))
            if manager is None:
                raise ValueError("Manager not found")
            if not manager.is_active:
                raise ValueError("Manager must be an active employee")

        role = self.db.scalars(select(RoleModel).where(RoleModel.name == body.role.value)).first()
        if role is None:
            raise ValueError(f"Role '{body.role.value}' is not configured")

        user = User(
            email=email,
            password_hash=bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode(
                "utf-8"
            ),
            full_name=body.full_name.strip(),
            is_active=True,
        )
        self.db.add(user)
        self.db.flush()
        self.db.add(UserRole(user_id=user.id, role_id=role.id))

        employee = Employee(
            user_id=user.id,
            department_id=department.id,
            manager_id=manager.id if manager else None,
            employee_code=body.employee_code.strip().upper(),
            hire_date=body.hire_date or date.today(),
            is_active=True,
        )
        self.employees.add(employee)

        year = date.today().year
        for code, days in LEAVE_POLICY_DAYS.items():
            leave_type = self.leave_types.get_by_code(code.value)
            if leave_type is None:
                continue
            self.db.add(
                LeaveBalance(
                    employee_id=employee.id,
                    leave_type_id=leave_type.id,
                    year=year,
                    entitled=float(days),
                    used=0,
                    pending=0,
                )
            )

        self.db.commit()
        return self._to_schema(self.employees.get_by_id(employee.id))

    def update(self, employee_id: str, body: EmployeeUpdate) -> EmployeeSchema:
        employee = self.employees.get_by_id(uuid.UUID(employee_id))
        if employee is None:
            raise LookupError("Employee not found")

        data = body.model_dump(exclude_unset=True)

        if "full_name" in data and data["full_name"] is not None:
            employee.user.full_name = data["full_name"].strip()

        if "department_id" in data and data["department_id"] is not None:
            department = self.departments.get_by_id(uuid.UUID(data["department_id"]))
            if department is None:
                raise ValueError("Department not found")
            employee.department_id = department.id

        if "manager_id" in data:
            mid = data["manager_id"]
            if mid is None or mid == "":
                employee.manager_id = None
            else:
                manager = self.employees.get_by_id(uuid.UUID(mid))
                if manager is None:
                    raise ValueError("Manager not found")
                if manager.id == employee.id:
                    raise ValueError("Employee cannot be their own manager")
                employee.manager_id = manager.id

        if "hire_date" in data:
            employee.hire_date = data["hire_date"]

        if "is_active" in data and data["is_active"] is not None:
            employee.is_active = data["is_active"]
            employee.user.is_active = data["is_active"]

        if "role" in data and data["role"] is not None:
            role_value = data["role"].value if isinstance(data["role"], Role) else data["role"]
            role = self.db.scalars(select(RoleModel).where(RoleModel.name == role_value)).first()
            if role is None:
                raise ValueError(f"Role '{role_value}' is not configured")
            employee.user.roles.clear()
            employee.user.roles.append(role)

        self.db.commit()
        return self._to_schema(self.employees.get_by_id(employee.id))

    def deactivate(self, employee_id: str) -> EmployeeSchema:
        return self.update(employee_id, EmployeeUpdate(is_active=False))

    @staticmethod
    def _to_schema(employee: Employee) -> EmployeeSchema:
        manager_name = None
        if employee.manager and employee.manager.user:
            manager_name = employee.manager.user.full_name
        return EmployeeSchema(
            id=str(employee.id),
            email=employee.user.email,
            full_name=employee.user.full_name,
            department=employee.department.name,
            department_id=str(employee.department_id),
            employee_code=employee.employee_code,
            hire_date=employee.hire_date,
            is_active=bool(employee.is_active),
            role=_primary_role(employee.user),
            manager_id=str(employee.manager_id) if employee.manager_id else None,
            manager_name=manager_name,
        )


class LeaveService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.leaves = LeaveRequestRepository(db)
        self.balances = LeaveBalanceRepository(db)
        self.leave_types = LeaveTypeRepository(db)
        self.employees = EmployeeRepository(db)

    def list_types(self) -> list[LeaveTypeInfo]:
        return [
            LeaveTypeInfo(
                code=LeaveTypeEnum(lt.code),
                name=lt.name,
                days_per_year=int(lt.default_days_per_year),
            )
            for lt in self.leave_types.list_active()
            if lt.code in {t.value for t in LeaveTypeEnum}
        ]

    def list(
        self,
        employee_id: str | None = None,
        status: str | None = None,
        statuses: list[str] | None = None,
        q: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> LeaveListResponse:
        eid = uuid.UUID(employee_id) if employee_id else None
        items, total = self.leaves.list(
            employee_id=eid,
            status=status,
            statuses=statuses,
            q=q,
            page=page,
            page_size=page_size,
        )
        return LeaveListResponse(
            items=[leave_to_schema(l) for l in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    def get(self, leave_id: str) -> LeaveRequestSchema:
        leave = self.leaves.get_by_id(uuid.UUID(leave_id))
        if leave is None:
            raise LookupError("Leave request not found")
        return leave_to_schema(leave)

    def balances_for(self, employee_id: str, year: int | None = None) -> list[LeaveBalanceSchema]:
        year = year or date.today().year
        rows = self.balances.list_for_employee(uuid.UUID(employee_id), year)
        result: list[LeaveBalanceSchema] = []
        for row in rows:
            try:
                code = LeaveTypeEnum(row.leave_type.code)
            except ValueError:
                continue
            entitled = float(row.entitled)
            used = float(row.used)
            pending = float(row.pending)
            remaining = entitled - used
            available = remaining - pending
            result.append(
                LeaveBalanceSchema(
                    leave_type=code,
                    name=LEAVE_TYPE_LABELS.get(code, row.leave_type.name),
                    total=entitled,
                    used=used,
                    pending=pending,
                    remaining=max(remaining, 0),
                    available=max(available, 0),
                )
            )
        return result

    def create(self, body: LeaveRequestCreate, employee_id: str) -> LeaveRequestSchema:
        employee = self.employees.get_by_id(uuid.UUID(employee_id))
        if employee is None:
            raise LookupError("Employee not found")

        leave_type = self.leave_types.get_by_code(body.leave_type.value)
        if leave_type is None or not leave_type.is_active:
            raise ValueError("Unknown leave type")

        days = working_days(body.start_date, body.end_date)
        if days <= 0:
            raise ValueError("Selected range must include at least one working day (Mon–Fri)")

        overlaps = self.leaves.find_overlapping(employee.id, body.start_date, body.end_date)
        if overlaps:
            raise ValueError("Leave request overlaps an existing pending or approved request")

        year = body.start_date.year
        balance = self.balances.get(employee.id, leave_type.id, year)
        if balance is None:
            raise ValueError("No leave balance configured for this type/year")

        available = float(balance.entitled) - float(balance.used) - float(balance.pending)
        if available < days:
            raise ValueError("Insufficient leave balance")

        leave = LeaveRequest(
            employee_id=employee.id,
            leave_type_id=leave_type.id,
            start_date=body.start_date,
            end_date=body.end_date,
            days=days,
            reason=body.reason,
            status=LeaveStatus.pending.value,
        )
        self.leaves.add(leave)
        # Soft-reserve only — official balance reduces on approval.
        balance.pending = float(balance.pending) + days
        self.db.commit()
        return leave_to_schema(self.leaves.get_by_id(leave.id))

    def cancel(self, leave_id: str) -> LeaveRequestSchema:
        leave = self.leaves.get_by_id(uuid.UUID(leave_id))
        if leave is None:
            raise LookupError("Leave request not found")
        if leave.status != LeaveStatus.pending.value:
            raise ValueError("Only pending leaves can be cancelled")

        balance = self.balances.get(leave.employee_id, leave.leave_type_id, leave.start_date.year)
        if balance is not None:
            balance.pending = max(float(balance.pending) - float(leave.days), 0)

        leave.status = LeaveStatus.cancelled.value
        self.db.commit()
        return leave_to_schema(self.leaves.get_by_id(leave.id))

    def update_status(self, leave_id: str, status: LeaveStatus) -> LeaveRequestSchema:
        leave = self.leaves.get_by_id(uuid.UUID(leave_id))
        if leave is None:
            raise LookupError("Leave request not found")
        if leave.status != LeaveStatus.pending.value:
            raise ValueError("Only pending leaves can change status")

        balance = self.balances.get(leave.employee_id, leave.leave_type_id, leave.start_date.year)
        if balance is not None:
            balance.pending = max(float(balance.pending) - float(leave.days), 0)
            if status == LeaveStatus.approved:
                remaining = float(balance.entitled) - float(balance.used)
                if remaining < float(leave.days):
                    raise ValueError("Insufficient leave balance to approve this request")
                balance.used = float(balance.used) + float(leave.days)

        leave.status = status.value
        self.db.commit()
        return leave_to_schema(self.leaves.get_by_id(leave.id))


class ApprovalService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.leaves = LeaveRequestRepository(db)
        self.balances = LeaveBalanceRepository(db)
        self.leave_service = LeaveService(db)

    def pending(self) -> list[LeaveRequestSchema]:
        return [
            leave_to_schema(l)
            for l in self.leaves.list_by_status(LeaveStatus.pending.value)
        ]

    def processed(self, page: int = 1, page_size: int = 10) -> LeaveListResponse:
        return self.leave_service.list(
            statuses=[LeaveStatus.approved.value, LeaveStatus.rejected.value],
            page=page,
            page_size=page_size,
        )

    def decide(
        self,
        leave_id: str,
        action: LeaveStatus,
        approver_employee_id: str,
        comment: str | None = None,
    ) -> LeaveRequestSchema:
        if action not in (LeaveStatus.approved, LeaveStatus.rejected):
            raise ValueError("Action must be approved or rejected")

        leave = self.leaves.get_by_id(uuid.UUID(leave_id))
        if leave is None:
            raise LookupError("Leave request not found")
        if leave.status != LeaveStatus.pending.value:
            raise ValueError("Only pending leaves can be decided")

        balance = self.balances.get(leave.employee_id, leave.leave_type_id, leave.start_date.year)
        if balance is not None:
            balance.pending = max(float(balance.pending) - float(leave.days), 0)
            if action == LeaveStatus.approved:
                remaining = float(balance.entitled) - float(balance.used)
                if remaining < float(leave.days):
                    raise ValueError("Insufficient leave balance to approve this request")
                balance.used = float(balance.used) + float(leave.days)

        leave.status = action.value
        self.db.add(
            LeaveApproval(
                leave_request_id=leave.id,
                approver_id=uuid.UUID(approver_employee_id),
                action=action.value,
                comment=comment,
            )
        )
        self.db.commit()
        return leave_to_schema(self.leaves.get_by_id(leave.id))
