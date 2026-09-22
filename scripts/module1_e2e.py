"""Phase 6 Module 1 leave workflow E2E checks against the local gateway."""
from __future__ import annotations

from datetime import date, timedelta

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


def next_monday(from_day: date | None = None) -> date:
    d = from_day or date.today()
    while d.weekday() != 0:
        d += timedelta(days=1)
    return d


def main() -> None:
    emp = login("employee@example.com")
    mgr = login("manager@example.com")
    print("login ok")

    balances = httpx.get(f"{BASE}/api/leaves/balances", headers=auth(emp), timeout=30)
    balances.raise_for_status()
    bal = balances.json()
    print("balances:", bal)
    total = sum(x["total"] for x in bal)
    assert total == 22, total
    remaining_before = {x["leave_type"]: x["remaining"] for x in bal}

    start = next_monday(date.today() + timedelta(days=14))
    end = start + timedelta(days=1)  # Mon–Tue = 2 working days

    created = httpx.post(
        f"{BASE}/api/leaves",
        headers=auth(emp),
        json={
            "leave_type": "earned",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "reason": "Family event Module1 test",
        },
        timeout=30,
    )
    print("create status", created.status_code, created.text)
    created.raise_for_status()
    leave = created.json()
    leave_id = leave["id"]
    assert leave["status"] == "pending"
    assert leave["days"] == 2.0

    bal2 = httpx.get(f"{BASE}/api/leaves/balances", headers=auth(emp), timeout=30).json()
    rem2 = {x["leave_type"]: x["remaining"] for x in bal2}
    pend2 = {x["leave_type"]: x["pending"] for x in bal2}
    assert rem2["earned"] == remaining_before["earned"], (rem2, remaining_before)
    assert pend2["earned"] == 2.0
    print("soft-reserve ok remaining unchanged pending=2")

    overlap = httpx.post(
        f"{BASE}/api/leaves",
        headers=auth(emp),
        json={
            "leave_type": "sick",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "reason": "Overlap attempt",
        },
        timeout=30,
    )
    assert overlap.status_code == 400, overlap.text
    print("overlap rejected ok")

    huge_start = next_monday(start + timedelta(days=30))
    huge_end = huge_start + timedelta(days=40)
    insufficient = httpx.post(
        f"{BASE}/api/leaves",
        headers=auth(emp),
        json={
            "leave_type": "earned",
            "start_date": huge_start.isoformat(),
            "end_date": huge_end.isoformat(),
            "reason": "Too many days",
        },
        timeout=30,
    )
    assert insufficient.status_code == 400, insufficient.text
    print("insufficient rejected ok")

    approved = httpx.post(
        f"{BASE}/api/approvals/{leave_id}/approve",
        headers=auth(mgr),
        json={"comment": "ok"},
        timeout=30,
    )
    print("approve", approved.status_code, approved.text)
    approved.raise_for_status()
    assert approved.json()["status"] == "approved"

    bal3 = httpx.get(f"{BASE}/api/leaves/balances", headers=auth(emp), timeout=30).json()
    earned = next(x for x in bal3 if x["leave_type"] == "earned")
    assert earned["used"] == 2.0
    assert earned["pending"] == 0.0
    assert earned["remaining"] == remaining_before["earned"] - 2.0
    print("balance after approve ok", earned)

    cancel_start = huge_start
    cancel_leave = httpx.post(
        f"{BASE}/api/leaves",
        headers=auth(emp),
        json={
            "leave_type": "sick",
            "start_date": cancel_start.isoformat(),
            "end_date": cancel_start.isoformat(),
            "reason": "Cancel me",
        },
        timeout=30,
    )
    cancel_leave.raise_for_status()
    lid2 = cancel_leave.json()["id"]
    cancelled = httpx.post(f"{BASE}/api/leaves/{lid2}/cancel", headers=auth(emp), timeout=30)
    cancelled.raise_for_status()
    assert cancelled.json()["status"] == "cancelled"
    bal4 = httpx.get(f"{BASE}/api/leaves/balances", headers=auth(emp), timeout=30).json()
    sick = next(x for x in bal4 if x["leave_type"] == "sick")
    assert sick["used"] == 0.0
    assert sick["pending"] == 0.0
    print("cancel restores pending ok")

    lst = httpx.get(f"{BASE}/api/leaves?page=1&page_size=10", headers=auth(emp), timeout=30)
    lst.raise_for_status()
    assert "items" in lst.json() and "total" in lst.json()
    httpx.get(f"{BASE}/api/approvals/pending", headers=auth(mgr), timeout=30).raise_for_status()
    httpx.get(f"{BASE}/api/approvals/processed", headers=auth(mgr), timeout=30).raise_for_status()
    print("lists ok")
    print("MODULE1_OK")


if __name__ == "__main__":
    main()
