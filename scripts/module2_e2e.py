"""Phase 7 Module 2 employee workflow E2E checks against the local gateway."""
from __future__ import annotations

import uuid

import httpx

BASE = "http://127.0.0.1:8000"


def login(email: str) -> str:
    r = httpx.post(
        f"{BASE}/api/auth/login",
        json={"email": email, "password": "password123"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def main() -> None:
    mgr = login("manager@example.com")
    emp = login("employee@example.com")
    print("login ok")

    # employee cannot manage
    forbidden = httpx.post(
        f"{BASE}/api/employees",
        headers=auth(emp),
        json={
            "email": "nobody@example.com",
            "full_name": "Nobody",
            "password": "password123",
            "department_id": str(uuid.uuid4()),
            "employee_code": "X999",
        },
        timeout=30,
    )
    assert forbidden.status_code == 403, forbidden.text
    print("employee manage forbidden ok")

    deps = httpx.get(f"{BASE}/api/employees/departments", headers=auth(mgr), timeout=30)
    deps.raise_for_status()
    departments = deps.json()
    assert len(departments) >= 1
    dept_id = departments[0]["id"]
    print("departments ok", len(departments))

    listed = httpx.get(
        f"{BASE}/api/employees",
        headers=auth(mgr),
        params={"page": 1, "page_size": 10, "q": "Alex"},
        timeout=30,
    )
    listed.raise_for_status()
    payload = listed.json()
    assert "items" in payload and "total" in payload
    assert payload["total"] >= 1
    print("list/search/pagination ok", payload["total"])

    code = f"E{uuid.uuid4().hex[:6].upper()}"
    email = f"newhire.{uuid.uuid4().hex[:8]}@example.com"
    created = httpx.post(
        f"{BASE}/api/employees",
        headers=auth(mgr),
        json={
            "email": email,
            "full_name": "New Hire",
            "password": "password123",
            "department_id": dept_id,
            "employee_code": code,
            "role": "employee",
        },
        timeout=30,
    )
    print("create", created.status_code, created.text)
    created.raise_for_status()
    employee = created.json()
    eid = employee["id"]
    assert employee["employee_code"] == code
    assert employee["is_active"] is True

    # new employee gets leave balances
    new_token = login(email)
    balances = httpx.get(f"{BASE}/api/leaves/balances", headers=auth(new_token), timeout=30)
    balances.raise_for_status()
    bal = balances.json()
    assert sum(b["total"] for b in bal) == 22
    print("default balances ok")

    detail = httpx.get(f"{BASE}/api/employees/{eid}", headers=auth(mgr), timeout=30)
    detail.raise_for_status()
    assert detail.json()["full_name"] == "New Hire"

    updated = httpx.patch(
        f"{BASE}/api/employees/{eid}",
        headers=auth(mgr),
        json={"full_name": "New Hire Updated", "department_id": dept_id},
        timeout=30,
    )
    updated.raise_for_status()
    assert updated.json()["full_name"] == "New Hire Updated"
    print("update ok")

    # duplicate email rejected
    dup = httpx.post(
        f"{BASE}/api/employees",
        headers=auth(mgr),
        json={
            "email": email,
            "full_name": "Dup",
            "password": "password123",
            "department_id": dept_id,
            "employee_code": f"D{uuid.uuid4().hex[:6].upper()}",
        },
        timeout=30,
    )
    assert dup.status_code == 400, dup.text
    print("duplicate email rejected ok")

    deactivated = httpx.delete(f"{BASE}/api/employees/{eid}", headers=auth(mgr), timeout=30)
    deactivated.raise_for_status()
    assert deactivated.json()["is_active"] is False
    print("deactivate ok")

    # inactive filtered out when is_active=true
    active_list = httpx.get(
        f"{BASE}/api/employees",
        headers=auth(mgr),
        params={"q": code, "is_active": True, "page": 1, "page_size": 10},
        timeout=30,
    )
    active_list.raise_for_status()
    assert all(item["id"] != eid for item in active_list.json()["items"])

    inactive_list = httpx.get(
        f"{BASE}/api/employees",
        headers=auth(mgr),
        params={"q": code, "is_active": False, "page": 1, "page_size": 10},
        timeout=30,
    )
    inactive_list.raise_for_status()
    assert any(item["id"] == eid for item in inactive_list.json()["items"])
    print("active filter ok")

    print("MODULE2_OK")


if __name__ == "__main__":
    main()
