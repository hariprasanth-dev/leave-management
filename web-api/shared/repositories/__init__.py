from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from shared.models import Department, Employee, LeaveBalance, LeaveRequest, LeaveType, User
from shared.models.entities import Role as RoleModel


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _with_auth_graph(self, stmt):
        return stmt.options(
            joinedload(User.roles).joinedload(RoleModel.permissions),
            joinedload(User.employee),
        )

    def get_by_email(self, email: str) -> User | None:
        stmt = self._with_auth_graph(select(User)).where(User.email == email.lower())
        return self.db.scalars(stmt).unique().first()

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        stmt = self._with_auth_graph(select(User)).where(User.id == user_id)
        return self.db.scalars(stmt).unique().first()


class DepartmentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self) -> list[Department]:
        return list(self.db.scalars(select(Department).order_by(Department.name)).all())

    def get_by_id(self, department_id: uuid.UUID) -> Department | None:
        return self.db.scalars(select(Department).where(Department.id == department_id)).first()


class EmployeeRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _base_query(self):
        return select(Employee).options(
            joinedload(Employee.user).joinedload(User.roles),
            joinedload(Employee.department),
            joinedload(Employee.manager).joinedload(Employee.user),
        )

    def list(
        self,
        manager_id: uuid.UUID | None = None,
        department_id: uuid.UUID | None = None,
        is_active: bool | None = None,
        q: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> tuple[list[Employee], int]:
        filters = []
        if manager_id is not None:
            filters.append(Employee.manager_id == manager_id)
        if department_id is not None:
            filters.append(Employee.department_id == department_id)
        if is_active is not None:
            filters.append(Employee.is_active.is_(is_active))
        if q:
            like = f"%{q.strip()}%"
            filters.append(
                or_(
                    Employee.employee_code.ilike(like),
                    User.full_name.ilike(like),
                    User.email.ilike(like),
                )
            )

        count_stmt = select(func.count()).select_from(Employee)
        if q:
            count_stmt = count_stmt.join(User, Employee.user_id == User.id)
        if filters:
            count_stmt = count_stmt.where(and_(*filters))
        total = int(self.db.scalar(count_stmt) or 0)

        stmt = self._base_query()
        if q:
            stmt = stmt.join(User, Employee.user_id == User.id)
        if filters:
            stmt = stmt.where(and_(*filters))
        stmt = (
            stmt.order_by(Employee.employee_code.asc())
            .offset(max(page - 1, 0) * page_size)
            .limit(page_size)
        )
        items = list(self.db.scalars(stmt).unique().all())
        return items, total

    def get_by_id(self, employee_id: uuid.UUID) -> Employee | None:
        stmt = self._base_query().where(Employee.id == employee_id)
        return self.db.scalars(stmt).unique().first()

    def get_by_code(self, employee_code: str) -> Employee | None:
        stmt = self._base_query().where(Employee.employee_code == employee_code)
        return self.db.scalars(stmt).unique().first()

    def add(self, employee: Employee) -> Employee:
        self.db.add(employee)
        self.db.flush()
        return employee


class LeaveTypeRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_code(self, code: str) -> LeaveType | None:
        return self.db.scalars(select(LeaveType).where(LeaveType.code == code)).first()

    def list_active(self) -> list[LeaveType]:
        return list(
            self.db.scalars(select(LeaveType).where(LeaveType.is_active.is_(True))).all()
        )


class LeaveBalanceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_for_employee(self, employee_id: uuid.UUID, year: int) -> list[LeaveBalance]:
        stmt = (
            select(LeaveBalance)
            .options(joinedload(LeaveBalance.leave_type))
            .where(LeaveBalance.employee_id == employee_id, LeaveBalance.year == year)
        )
        return list(self.db.scalars(stmt).unique().all())

    def get(
        self, employee_id: uuid.UUID, leave_type_id: uuid.UUID, year: int
    ) -> LeaveBalance | None:
        stmt = select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type_id,
            LeaveBalance.year == year,
        )
        return self.db.scalars(stmt).first()


class LeaveRequestRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _base_query(self):
        return select(LeaveRequest).options(
            joinedload(LeaveRequest.employee).joinedload(Employee.user),
            joinedload(LeaveRequest.leave_type),
        )

    def list(
        self,
        employee_id: uuid.UUID | None = None,
        status: str | None = None,
        statuses: list[str] | None = None,
        q: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> tuple[list[LeaveRequest], int]:
        filters = []
        if employee_id is not None:
            filters.append(LeaveRequest.employee_id == employee_id)
        if status:
            filters.append(LeaveRequest.status == status)
        if statuses:
            filters.append(LeaveRequest.status.in_(statuses))
        if q:
            like = f"%{q.strip()}%"
            filters.append(
                or_(
                    LeaveRequest.reason.ilike(like),
                    LeaveRequest.status.ilike(like),
                )
            )

        count_stmt = select(func.count()).select_from(LeaveRequest)
        if filters:
            count_stmt = count_stmt.where(and_(*filters))
        total = int(self.db.scalar(count_stmt) or 0)

        stmt = self._base_query()
        if filters:
            stmt = stmt.where(and_(*filters))
        stmt = (
            stmt.order_by(LeaveRequest.created_at.desc())
            .offset(max(page - 1, 0) * page_size)
            .limit(page_size)
        )
        items = list(self.db.scalars(stmt).unique().all())
        return items, total

    def list_by_status(self, status: str) -> list[LeaveRequest]:
        items, _ = self.list(status=status, page=1, page_size=500)
        return items

    def find_overlapping(
        self,
        employee_id: uuid.UUID,
        start: date,
        end: date,
        exclude_id: uuid.UUID | None = None,
    ) -> list[LeaveRequest]:
        stmt = self._base_query().where(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status.in_(("pending", "approved")),
            LeaveRequest.start_date <= end,
            LeaveRequest.end_date >= start,
        )
        if exclude_id is not None:
            stmt = stmt.where(LeaveRequest.id != exclude_id)
        return list(self.db.scalars(stmt).unique().all())

    def get_by_id(self, leave_id: uuid.UUID) -> LeaveRequest | None:
        stmt = self._base_query().where(LeaveRequest.id == leave_id)
        return self.db.scalars(stmt).unique().first()

    def add(self, leave: LeaveRequest) -> LeaveRequest:
        self.db.add(leave)
        self.db.flush()
        return leave


class HolidayRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def dates_between(self, start: date, end: date) -> set[date]:
        from shared.models import Holiday

        stmt = select(Holiday.holiday_date).where(
            Holiday.holiday_date >= start,
            Holiday.holiday_date <= end,
            Holiday.is_optional.is_(False),
        )
        return set(self.db.scalars(stmt).all())
