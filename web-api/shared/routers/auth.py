from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from shared.auth import get_current_user
from shared.db.session import get_db
from shared.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    TokenResponse,
    UserPublic,
)
from shared.services import AuthService
from shared.services.auth_service import LoginThrottled
from shared.services.notifications import send_temp_password_email

router = APIRouter()

FORGOT_PASSWORD_MESSAGE = (
    "If an active account uses that email, a temporary password is on its way. "
    "It works once and expires soon."
)

TRUSTED_PROXIES = {"127.0.0.1", "::1"}


def _client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and peer in TRUSTED_PROXIES:
        return forwarded.split(",")[0].strip()[:64] or peer
    return peer


def _throttled(exc: LoginThrottled) -> HTTPException:
    minutes = max(1, round(exc.retry_after_seconds / 60))
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many failed sign-in attempts. Try again in {minutes} minute(s).",
        headers={"Retry-After": str(exc.retry_after_seconds)},
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        return AuthService(db).authenticate(body.email, body.password, _client_ip(request))
    except LoginThrottled as exc:
        raise _throttled(exc) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/logout", response_model=MessageResponse)
def logout(body: LogoutRequest | None = None, db: Session = Depends(get_db)) -> MessageResponse:
    AuthService(db).logout(body.refresh_token if body else None)
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=UserPublic)
def me(current_user: UserPublic = Depends(get_current_user)) -> UserPublic:
    return current_user


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        return AuthService(db).refresh(body.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    body: ForgotPasswordRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
) -> MessageResponse:
    notice = AuthService(db).forgot_password(body.email)
    if notice is not None:
        background.add_task(
            send_temp_password_email,
            notice.to,
            notice.full_name,
            notice.temp_password,
            notice.expires_minutes,
        )
    return MessageResponse(message=FORGOT_PASSWORD_MESSAGE)


@router.post("/change-password", response_model=TokenResponse)
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserPublic = Depends(get_current_user),
) -> TokenResponse:
    try:
        return AuthService(db).change_password(
            current_user.id, body.current_password, body.new_password, _client_ip(request)
        )
    except LoginThrottled as exc:
        raise _throttled(exc) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
