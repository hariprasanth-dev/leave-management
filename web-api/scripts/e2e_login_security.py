"""Attack-style checks against the login flow. Run with the backend up.

Cleans up its own login_attempts rows so real accounts are not left locked.
"""

from __future__ import annotations

import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from jose import jwt
from sqlalchemy import delete

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from shared.config import DEFAULT_JWT_SECRET, settings
from shared.db.session import SessionLocal
from shared.models import LoginAttempt

GATEWAY = "http://127.0.0.1:8000"
VICTIM = "employee@example.com"
GHOST = "nobody-here@example.com"
SPOOF_IP = "203.0.113.77"

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}{' - ' + detail if detail else ''}")


def login(client: httpx.Client, email: str, password: str, **headers) -> httpx.Response:
    return client.post(f"{GATEWAY}/api/auth/login", json={"email": email, "password": password}, headers=headers)


def cleanup() -> None:
    db = SessionLocal()
    try:
        db.execute(delete(LoginAttempt).where(LoginAttempt.email.in_([VICTIM, GHOST])))
        db.execute(delete(LoginAttempt).where(LoginAttempt.ip_address == SPOOF_IP))
        db.commit()
    finally:
        db.close()


def main() -> int:
    cleanup()
    with httpx.Client(timeout=15.0) as c:
        r = login(c, "harip5340@gmail.com", "password123")
        check("valid credentials return 200", r.status_code == 200, str(r.status_code))
        token = r.json().get("access_token", "")
        me = c.get(f"{GATEWAY}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        check("/me returns 200 with real token", me.status_code == 200, str(me.status_code))

        wrong = login(c, VICTIM, "wrong-password")
        ghost = login(c, GHOST, "wrong-password")
        check(
            "wrong password and unknown email look identical",
            wrong.status_code == ghost.status_code == 401 and wrong.json() == ghost.json(),
            f"{wrong.status_code}/{ghost.status_code} {wrong.json().get('detail')!r}",
        )

        t0 = time.perf_counter()
        login(c, VICTIM, "wrong-password")
        known_ms = (time.perf_counter() - t0) * 1000
        t0 = time.perf_counter()
        login(c, GHOST, "wrong-password")
        ghost_ms = (time.perf_counter() - t0) * 1000
        check(
            "response time does not reveal unknown emails",
            abs(known_ms - ghost_ms) < max(known_ms, ghost_ms) * 0.5,
            f"known={known_ms:.0f}ms unknown={ghost_ms:.0f}ms",
        )

        cleanup()
        for _ in range(settings.login_max_failures_per_email):
            login(c, VICTIM, "guess-123", **{"X-Forwarded-For": SPOOF_IP})
        locked = login(c, VICTIM, "password123")
        check(
            f"account locks after {settings.login_max_failures_per_email} failures (even with correct password)",
            locked.status_code == 429 and "retry-after" in locked.headers,
            f"{locked.status_code} Retry-After={locked.headers.get('retry-after')}",
        )

        db = SessionLocal()
        try:
            spoofed = db.query(LoginAttempt).filter(LoginAttempt.ip_address == SPOOF_IP).count()
        finally:
            db.close()
        check("client-supplied X-Forwarded-For is ignored", spoofed == 0, f"rows with spoofed IP={spoofed}")

        forged = jwt.encode(
            {
                "sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
                "type": "access",
                "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            },
            DEFAULT_JWT_SECRET,
            algorithm="HS256",
        )
        r = c.get(f"{GATEWAY}/api/auth/me", headers={"Authorization": f"Bearer {forged}"})
        check("token forged with the public default secret is rejected", r.status_code == 401, str(r.status_code))

        header = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0"
        body = jwt.get_unverified_claims(forged)
        import base64
        import json

        payload = base64.urlsafe_b64encode(json.dumps(body, default=str).encode()).rstrip(b"=").decode()
        r = c.get(f"{GATEWAY}/api/auth/me", headers={"Authorization": f"Bearer {header}.{payload}."})
        check("unsigned alg=none token is rejected", r.status_code == 401, str(r.status_code))

        r = c.get(f"{GATEWAY}/api/employees")
        check("protected API without token returns 401", r.status_code == 401, str(r.status_code))

        r = c.options(
            f"{GATEWAY}/api/auth/login",
            headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
        )
        check(
            "CORS refuses unknown origins",
            r.headers.get("access-control-allow-origin") not in ("*", "https://evil.example"),
            f"allow-origin={r.headers.get('access-control-allow-origin')}",
        )

        r = login(c, GHOST, "x")
        check(
            "security headers + no-store on auth responses",
            r.headers.get("x-frame-options") == "DENY" and r.headers.get("cache-control") == "no-store",
            f"XFO={r.headers.get('x-frame-options')} cache={r.headers.get('cache-control')}",
        )

    cleanup()
    failed = [n for n, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
