from __future__ import annotations

import calendar
import uuid
from datetime import date, timedelta

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
    LeavePolicy as LeavePolicySchema,
    LeaveRequest as LeaveRequestSchema,
    LeaveRequestCreate,
    LeaveStats as LeaveStatsSchema,
    LeaveStatsBucket,
    LeaveStatsByType,
    LeaveStatus,
    LeaveType as LeaveTypeEnum,
    LeaveTypeInfo,
    Role,
    TeamMemberSummary,
    TeamOverview as TeamOverviewSchema,
    UserPublic,
)
from shared.config import settings
from shared.services.auth_service import _primary_role


def _is_hr_or_admin(actor: UserPublic | None) -> bool:
    if actor is None:
        return False
    perms = set(actor.permissions or [])
    if "admin:all" in perms:
        return True
    roles = {*(actor.roles or [])}
    if actor.role is not None:
        roles.add(actor.role.value if isinstance(actor.role, Role) else str(actor.role))
    return bool(roles & {"hr", "admin"})


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
        self_recorded=any(a.approver_id == leave.employee_id for a in leave.approvals or []),
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
        role: str | None = None,
        sort: str = "code",
        order: str = "asc",
        page: int = 1,
        page_size: int = 10,
    ) -> EmployeeListResponse:
        mid = uuid.UUID(manager_id) if manager_id else None
        did = uuid.UUID(department_id) if department_id else None
        items, total, counts = self.employees.list(
            manager_id=mid,
            department_id=did,
            is_active=is_active,
            q=q,
            role=role,
            sort=sort,
            order=order,
            page=page,
            page_size=page_size,
        )
        return EmployeeListResponse(
            items=[self._to_schema(e) for e in items],
            total=total,
            page=page,
            page_size=page_size,
            status_counts=counts,
        )

    def get(self, employee_id: str) -> EmployeeSchema:
        employee = self.employees.get_by_id(uuid.UUID(employee_id))
        if employee is None:
            raise LookupError("Employee not found")
        return self._to_schema(employee)

    def next_employee_code(self) -> str:
        """Next company employee ID: <prefix>-NN, e.g. ST-01, ST-02 … ST-100."""
        prefix = settings.employee_code_prefix.strip().upper()
        numbers = [
            int(code.split("-", 1)[1])
            for code in self.employees.codes_with_prefix(prefix)
            if code.split("-", 1)[1].isdigit()
        ]
        return f"{prefix}-{max(numbers, default=0) + 1:02d}"

    def create(self, body: EmployeeCreate, actor: UserPublic | None = None) -> EmployeeSchema:
        """Create employee + login user. Managers may add team members who can sign in."""
        email = body.email.lower().strip()
        existing_user = self.db.scalars(select(User).where(User.email == email)).first()
        if existing_user is not None:
            raise ValueError("Email already registered")

        department = self.departments.get_by_id(uuid.UUID(body.department_id))
        if department is None:
            raise ValueError("Department not found")

        # Managers can only create employee-role accounts; HR/admin may assign manager/hr.
        role_value = body.role
        manager_id = body.manager_id
        if actor and not _is_hr_or_admin(actor):
            if role_value != Role.employee:
                raise ValueError("Managers can only create employee accounts")
            role_value = Role.employee
            if not manager_id and actor.employee_id:
                manager_id = actor.employee_id

        manager = None
        if manager_id:
            manager = self.employees.get_by_id(uuid.UUID(manager_id))
            if manager is None:
                raise ValueError("Manager not found")
            if not manager.is_active:
                raise ValueError("Manager must be an active employee")

        role = self.db.scalars(select(RoleModel).where(RoleModel.name == role_value.value)).first()
        if role is None:
            raise ValueError(f"Role '{role_value.value}' is not configured")

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
            employee_code=self.next_employee_code(),
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

    def update(
        self,
        employee_id: str,
        body: EmployeeUpdate,
        actor: UserPublic | None = None,
    ) -> EmployeeSchema:
        employee = self.employees.get_by_id(uuid.UUID(employee_id))
        if employee is None:
            raise LookupError("Employee not found")
        if actor and not _is_hr_or_admin(actor) and _primary_role(employee.user) != Role.employee:
            raise PermissionError("Manager, HR and admin records can only be changed by HR or an admin")

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
            if actor and not _is_hr_or_admin(actor) and role_value != Role.employee.value:
                raise ValueError("Managers can only assign the employee role")
            role = self.db.scalars(select(RoleModel).where(RoleModel.name == role_value)).first()
            if role is None:
                raise ValueError(f"Role '{role_value}' is not configured")
            employee.user.roles.clear()
            employee.user.roles.append(role)

        self.db.commit()
        return self._to_schema(self.employees.get_by_id(employee.id))

    def deactivate(self, employee_id: str, actor: UserPublic | None = None) -> EmployeeSchema:
        return self.update(employee_id, EmployeeUpdate(is_active=False), actor=actor)

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

    def stats_for(self, employee_id: str, year: int | None = None) -> LeaveStatsSchema:
        year = year or date.today().year
        eid = uuid.UUID(employee_id)
        year_start, year_end = date(year, 1, 1), date(year, 12, 31)

        monthly = [
            LeaveStatsBucket(key=m, label=calendar.month_abbr[m]) for m in range(1, 13)
        ]
        weekday = [LeaveStatsBucket(key=d, label=calendar.day_abbr[d]) for d in range(5)]
        by_type: dict[str, LeaveStatsByType] = {}
        for row in self.balances.list_for_employee(eid, year):
            try:
                code = LeaveTypeEnum(row.leave_type.code)
            except ValueError:
                continue
            by_type[code.value] = LeaveStatsByType(
                leave_type=code,
                name=LEAVE_TYPE_LABELS.get(code, row.leave_type.name),
                entitled=float(row.entitled),
            )

        request_counts = {s.value: 0 for s in LeaveStatus}
        approved_days = pending_days = 0.0

        for leave in self.leaves.list_for_employee_between(eid, year_start, year_end):
            if leave.start_date.year == year:
                request_counts[leave.status] = request_counts.get(leave.status, 0) + 1
            if leave.status not in (LeaveStatus.approved.value, LeaveStatus.pending.value):
                continue
            field = leave.status
            code = leave.leave_type.code if leave.leave_type else LeaveTypeEnum.earned.value
            type_row = by_type.get(code)
            if type_row is None:
                try:
                    enum_code = LeaveTypeEnum(code)
                except ValueError:
                    continue
                type_row = by_type[code] = LeaveStatsByType(
                    leave_type=enum_code,
                    name=LEAVE_TYPE_LABELS.get(enum_code, code),
                    entitled=float(LEAVE_POLICY_DAYS.get(enum_code, 0)),
                )

            current = max(leave.start_date, year_start)
            last = min(leave.end_date, year_end)
            while current <= last:
                if current.weekday() < 5:
                    for bucket in (monthly[current.month - 1], weekday[current.weekday()]):
                        setattr(bucket, field, getattr(bucket, field) + 1)
                    setattr(type_row, field, getattr(type_row, field) + 1)
                    if field == LeaveStatus.approved.value:
                        approved_days += 1
                    else:
                        pending_days += 1
                current += timedelta(days=1)

        for row in by_type.values():
            row.remaining = max(row.entitled - row.approved, 0)

        years = set(self.leaves.years_for_employee(eid)) | {date.today().year, year}
        return LeaveStatsSchema(
            year=year,
            available_years=sorted(years, reverse=True),
            approved_days=approved_days,
            pending_days=pending_days,
            request_counts=request_counts,
            by_type=list(by_type.values()),
            monthly=monthly,
            weekday=weekday,
        )

    def team_overview(self, actor: UserPublic, upcoming_window_days: int = 30) -> TeamOverviewSchema:
        """Manager view: direct reports. HR/admin: every active employee except themselves."""
        today = date.today()
        year = today.year
        year_start, year_end = date(year, 1, 1), date(year, 12, 31)
        own_id = uuid.UUID(actor.employee_id) if actor.employee_id else None

        if _is_hr_or_admin(actor):
            scope = "organization"
            members, _, _ = self.employees.list(is_active=True, page=1, page_size=1000)
            members = [m for m in members if m.id != own_id]
        else:
            scope = "team"
            members, _, _ = (
                self.employees.list(manager_id=own_id, is_active=True, page=1, page_size=1000)
                if own_id
                else ([], 0, {})
            )
        member_ids = [m.id for m in members]

        summaries: dict[uuid.UUID, TeamMemberSummary] = {
            m.id: TeamMemberSummary(
                employee_id=str(m.id),
                full_name=m.user.full_name if m.user else "",
                employee_code=m.employee_code,
                email=m.user.email if m.user else "",
                department=m.department.name if m.department else "",
            )
            for m in members
        }

        by_type: dict[str, LeaveStatsByType] = {}
        for row in self.balances.list_for_employees(member_ids, year):
            summary = summaries.get(row.employee_id)
            if summary is None:
                continue
            entitled, used, pending = float(row.entitled), float(row.used), float(row.pending)
            summary.entitled_days += entitled
            summary.taken_days += used
            summary.pending_days += pending
            summary.available_days += max(entitled - used - pending, 0)
            try:
                code = LeaveTypeEnum(row.leave_type.code)
            except ValueError:
                continue
            type_row = by_type.setdefault(
                code.value,
                LeaveStatsByType(
                    leave_type=code,
                    name=LEAVE_TYPE_LABELS.get(code, row.leave_type.name),
                    entitled=0,
                ),
            )
            type_row.entitled += entitled
            type_row.approved += used
            type_row.pending += pending
        for type_row in by_type.values():
            type_row.remaining = max(type_row.entitled - type_row.approved, 0)

        monthly = [
            LeaveStatsBucket(key=m, label=calendar.month_abbr[m]) for m in range(1, 13)
        ]
        horizon = today + timedelta(days=upcoming_window_days)
        window_end = max(year_end, horizon)
        pending: list[LeaveRequest] = []
        on_leave: list[LeaveRequest] = []
        upcoming: list[LeaveRequest] = []

        for leave in self.leaves.list_for_employees_between(member_ids, year_start, window_end):
            if leave.status not in (LeaveStatus.approved.value, LeaveStatus.pending.value):
                continue
            summary = summaries.get(leave.employee_id)
            if leave.status == LeaveStatus.pending.value:
                pending.append(leave)
            if leave.status == LeaveStatus.approved.value and leave.start_date <= today <= leave.end_date:
                on_leave.append(leave)
                if summary and (summary.on_leave_until is None or leave.end_date > summary.on_leave_until):
                    summary.on_leave_until = leave.end_date
            if today < leave.start_date <= horizon:
                upcoming.append(leave)
            if summary and leave.start_date > today and (
                summary.next_leave_start is None or leave.start_date < summary.next_leave_start
            ):
                summary.next_leave_start = leave.start_date

            current = max(leave.start_date, year_start)
            last = min(leave.end_date, year_end)
            while current <= last:
                if current.weekday() < 5:
                    bucket = monthly[current.month - 1]
                    setattr(bucket, leave.status, getattr(bucket, leave.status) + 1)
                current += timedelta(days=1)

        pending.sort(key=lambda l: l.created_at)
        on_leave.sort(key=lambda l: l.end_date)
        upcoming.sort(key=lambda l: l.start_date)

        return TeamOverviewSchema(
            scope=scope,
            year=year,
            team_size=len(members),
            pending_count=len(pending),
            pending=[leave_to_schema(l) for l in pending],
            on_leave_today=[leave_to_schema(l) for l in on_leave],
            upcoming=[leave_to_schema(l) for l in upcoming],
            members=sorted(summaries.values(), key=lambda s: s.employee_code or s.full_name),
            monthly=monthly,
            by_type=list(by_type.values()),
            approved_days_this_month=monthly[today.month - 1].approved,
        )

    @staticmethod
    def _requires_approval(employee: Employee) -> bool:
        """Leave needs sign-off unless a manager/HR/admin has nobody above them to approve it."""
        if employee.manager_id is not None:
            return True
        return employee.user is None or _primary_role(employee.user) == Role.employee

    def policy_for(self, employee_id: str) -> LeavePolicySchema:
        employee = self.employees.get_by_id(uuid.UUID(employee_id))
        if employee is None:
            raise LookupError("Employee not found")
        manager = employee.manager
        return LeavePolicySchema(
            requires_approval=self._requires_approval(employee),
            approver_name=manager.user.full_name if manager and manager.user else None,
        )

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

        needs_approval = self._requires_approval(employee)
        leave = LeaveRequest(
            employee_id=employee.id,
            leave_type_id=leave_type.id,
            start_date=body.start_date,
            end_date=body.end_date,
            days=days,
            reason=body.reason,
            status=LeaveStatus.pending.value if needs_approval else LeaveStatus.approved.value,
        )
        self.leaves.add(leave)
        if needs_approval:
            # Soft-reserve only — official balance reduces on approval.
            balance.pending = float(balance.pending) + days
        else:
            balance.used = float(balance.used) + days
            self.db.add(
                LeaveApproval(
                    leave_request_id=leave.id,
                    approver_id=employee.id,
                    action=LeaveStatus.approved.value,
                    comment="Self-recorded: no approver above this role",
                )
            )
        self.db.commit()
        return leave_to_schema(self.leaves.get_by_id(leave.id))

    def cancel(self, leave_id: str) -> LeaveRequestSchema:
        leave = self.leaves.get_by_id(uuid.UUID(leave_id))
        if leave is None:
            raise LookupError("Leave request not found")

        self_recorded = leave.status == LeaveStatus.approved.value and any(
            a.approver_id == leave.employee_id for a in leave.approvals or []
        )
        if self_recorded:
            if leave.start_date <= date.today():
                raise ValueError("Recorded leave can only be cancelled before it starts")
        elif leave.status != LeaveStatus.pending.value:
            raise ValueError("Only pending leaves can be cancelled")

        balance = self.balances.get(leave.employee_id, leave.leave_type_id, leave.start_date.year)
        if balance is not None:
            if self_recorded:
                balance.used = max(float(balance.used) - float(leave.days), 0)
            else:
                balance.pending = max(float(balance.pending) - float(leave.days), 0)

        leave.status = LeaveStatus.cancelled.value
        self.db.commit()
        return leave_to_schema(self.leaves.get_by_id(leave.id))

    def update_status(
        self, leave_id: str, status: LeaveStatus, actor_employee_id: str | None = None
    ) -> LeaveRequestSchema:
        leave = self.leaves.get_by_id(uuid.UUID(leave_id))
        if leave is None:
            raise LookupError("Leave request not found")
        if actor_employee_id and leave.employee_id == uuid.UUID(actor_employee_id):
            raise PermissionError("You can't approve or reject your own leave request")
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

    def pending(self, approver_employee_id: str | None = None) -> list[LeaveRequestSchema]:
        own_id = uuid.UUID(approver_employee_id) if approver_employee_id else None
        return [
            leave_to_schema(l)
            for l in self.leaves.list_by_status(LeaveStatus.pending.value)
            if l.employee_id != own_id
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
        if leave.employee_id == uuid.UUID(approver_employee_id):
            raise PermissionError("You can't approve or reject your own leave request")
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
