from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import and_, case, func, or_, select, true
from sqlalchemy.orm import Session, aliased, joinedload

from shared.models import Department, Employee, LeaveBalance, LeaveRequest, LeaveType, User
from shared.models.entities import Role as RoleModel
from shared.models.entities import UserRole


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

    SORT_FIELDS = ("code", "name", "email", "department", "role", "manager", "hire_date", "status")

    @staticmethod
    def _role_name():
        return (
            select(func.min(RoleModel.name))
            .join(UserRole, UserRole.role_id == RoleModel.id)
            .where(UserRole.user_id == Employee.user_id)
            .correlate(Employee)
            .scalar_subquery()
        )

    def list(
        self,
        manager_id: uuid.UUID | None = None,
        department_id: uuid.UUID | None = None,
        is_active: bool | None = None,
        q: str | None = None,
        role: str | None = None,
        sort: str = "code",
        order: str = "asc",
        page: int = 1,
        page_size: int = 10,
    ) -> tuple[list[Employee], int, dict[str, int]]:
        """Returns (page items, total matching, active/inactive counts ignoring the status filter)."""
        filters = []
        if manager_id is not None:
            filters.append(Employee.manager_id == manager_id)
        if department_id is not None:
            filters.append(Employee.department_id == department_id)
        if role:
            filters.append(
                Employee.user_id.in_(
                    select(UserRole.user_id)
                    .join(RoleModel, UserRole.role_id == RoleModel.id)
                    .where(RoleModel.name == role)
                )
            )
        if q:
            like = f"%{q.strip()}%"
            filters.append(
                or_(
                    Employee.employee_code.ilike(like),
                    User.full_name.ilike(like),
                    User.email.ilike(like),
                )
            )
        status_filter = [Employee.is_active.is_(is_active)] if is_active is not None else []

        count_rows = self.db.execute(
            select(Employee.is_active, func.count())
            .select_from(Employee)
            .join(User, Employee.user_id == User.id)
            .where(and_(true(), *filters))
            .group_by(Employee.is_active)
        ).all()
        counts = {"active": 0, "inactive": 0}
        for active, n in count_rows:
            counts["active" if active else "inactive"] = int(n)
        total = (
            counts["active" if is_active else "inactive"]
            if is_active is not None
            else counts["active"] + counts["inactive"]
        )

        manager_user = aliased(User)
        manager_emp = aliased(Employee)
        sort_columns = {
            "code": Employee.employee_code,
            "name": func.lower(User.full_name),
            "email": func.lower(User.email),
            "department": func.lower(Department.name),
            "role": self._role_name(),
            "manager": func.lower(manager_user.full_name),
            "hire_date": Employee.hire_date,
            "status": case((Employee.is_active.is_(True), 0), else_=1),
        }
        column = sort_columns.get(sort, Employee.employee_code)
        direction = column.desc().nulls_last() if order == "desc" else column.asc().nulls_last()

        stmt = (
            self._base_query()
            .join(User, Employee.user_id == User.id)
            .outerjoin(Department, Employee.department_id == Department.id)
            .outerjoin(manager_emp, Employee.manager_id == manager_emp.id)
            .outerjoin(manager_user, manager_emp.user_id == manager_user.id)
            .where(and_(true(), *filters, *status_filter))
            .order_by(direction, Employee.employee_code.asc())
            .offset(max(page - 1, 0) * page_size)
            .limit(page_size)
        )
        items = list(self.db.scalars(stmt).unique().all())
        return items, total, counts

    def get_by_id(self, employee_id: uuid.UUID) -> Employee | None:
        stmt = self._base_query().where(Employee.id == employee_id)
        return self.db.scalars(stmt).unique().first()

    def get_by_code(self, employee_code: str) -> Employee | None:
        stmt = self._base_query().where(Employee.employee_code == employee_code)
        return self.db.scalars(stmt).unique().first()

    def codes_with_prefix(self, prefix: str) -> list[str]:
        stmt = select(Employee.employee_code).where(Employee.employee_code.like(f"{prefix}-%"))
        return list(self.db.scalars(stmt).all())

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

    def list_for_employees(self, employee_ids: list[uuid.UUID], year: int) -> list[LeaveBalance]:
        if not employee_ids:
            return []
        stmt = (
            select(LeaveBalance)
            .options(joinedload(LeaveBalance.leave_type))
            .where(LeaveBalance.employee_id.in_(employee_ids), LeaveBalance.year == year)
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

    def list_for_employee_between(
        self,
        employee_id: uuid.UUID,
        start: date,
        end: date,
    ) -> list[LeaveRequest]:
        stmt = self._base_query().where(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.start_date <= end,
            LeaveRequest.end_date >= start,
        )
        return list(self.db.scalars(stmt).unique().all())

    def list_for_employees_between(
        self,
        employee_ids: list[uuid.UUID],
        start: date,
        end: date,
    ) -> list[LeaveRequest]:
        if not employee_ids:
            return []
        stmt = self._base_query().where(
            LeaveRequest.employee_id.in_(employee_ids),
            LeaveRequest.start_date <= end,
            LeaveRequest.end_date >= start,
        )
        return list(self.db.scalars(stmt).unique().all())

    def years_for_employee(self, employee_id: uuid.UUID) -> list[int]:
        stmt = (
            select(func.extract("year", LeaveRequest.start_date))
            .where(LeaveRequest.employee_id == employee_id)
            .distinct()
        )
        return sorted({int(y) for y in self.db.scalars(stmt).all() if y is not None})

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
