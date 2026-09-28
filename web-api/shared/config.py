from pathlib import Path
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "dev-secret-change-me-in-production"
_WEB_API_ROOT = Path(__file__).resolve().parents[1]
_REPO_ROOT = Path(__file__).resolve().parents[2]

_env_candidates = (_WEB_API_ROOT / ".env", _REPO_ROOT / ".env.local")
_env_files = tuple(str(p) for p in _env_candidates if p.is_file())

_DEFAULT_LOCAL_URL = (
    "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/leave_management_api"
)
_PLACEHOLDER_MARKERS = ("YOUR-PASSWORD", "YOUR_", ":PASSWORD@", "CHANGEME")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_files or None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "LeaveFlow"
    environment: str = "development"
    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    refresh_expire_days: int = 7
    temp_password_expire_minutes: int = 30
    temp_password_max_per_hour: int = 3
    frontend_url: str = "http://localhost:5173"

    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173"
    )

    employee_code_prefix: str = "ST"

    login_max_failures_per_email: int = 5
    login_max_failures_per_ip: int = 20
    login_lockout_minutes: int = 15

    database_url: str | None = None
    database_host: str | None = None
    database_port: int = 5432
    database_user: str = "postgres"
    database_password: str | None = None
    database_name: str = "leave_management_api"
    database_sslmode: str | None = None

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = True
    smtp_ssl: bool = False
    smtp_timeout_seconds: int = 15
    mail_from: str = "LeaveFlow <no-reply@leaveflow.local>"

    auth_service_url: str = "http://localhost:8001"
    employee_service_url: str = "http://localhost:8002"
    leave_service_url: str = "http://localhost:8003"
    approval_service_url: str = "http://localhost:8004"

    @staticmethod
    def _normalize_database_url(url: str) -> str:
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://") :]
        if "neon.tech" in url and "sslmode=" not in url:
            url += "&sslmode=require" if "?" in url else "?sslmode=require"
        return url

    @model_validator(mode="after")
    def resolve_database_url(self) -> "Settings":
        if self.database_url:
            url = self._normalize_database_url(self.database_url.strip())
            for marker in _PLACEHOLDER_MARKERS:
                if marker in url:
                    raise ValueError(
                        "DATABASE_URL still contains a placeholder. "
                        "Run `neon link` in the repo root or set DATABASE_URL in web-api/.env."
                    )
            self.database_url = url
            return self

        if self.database_host:
            password = (self.database_password or "").strip()
            if not password:
                raise ValueError(
                    "DATABASE_PASSWORD is empty. Set DATABASE_URL (Neon) or DATABASE_PASSWORD in web-api/.env"
                )
            host = self.database_host.strip()
            user = self.database_user.strip()
            port = self.database_port
            if "neon.tech" in host and not self.database_sslmode:
                self.database_sslmode = "require"
            user_q = quote_plus(user, safe="")
            pwd_q = quote_plus(password, safe="")
            name_q = quote_plus(self.database_name, safe="")
            query = f"?sslmode={quote_plus(self.database_sslmode)}" if self.database_sslmode else ""
            self.database_url = (
                f"postgresql+psycopg://{user_q}:{pwd_q}@{host}:{port}/{name_q}{query}"
            )
            return self

        self.database_url = _DEFAULT_LOCAL_URL
        if self.environment == "production":
            raise ValueError(
                "DATABASE_URL is required in production. "
                "Set Neon pooled connection string in the host environment."
            )
        return self

    @model_validator(mode="after")
    def _require_strong_secret_outside_dev(self) -> "Settings":
        if self.environment != "development" and (
            self.jwt_secret == DEFAULT_JWT_SECRET or len(self.jwt_secret) < 32
        ):
            raise ValueError("JWT_SECRET must be set to a random value of 32+ characters")
        return self

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host.strip())

    @property
    def cors_origin_list(self) -> list[str]:
        origins = {o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()}
        origins.add(self.frontend_url.rstrip("/"))
        return sorted(origins)


settings = Settings()
