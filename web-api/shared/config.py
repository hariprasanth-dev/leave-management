import re
from urllib.parse import quote_plus, urlparse

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_LOCAL_URL = (
    "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/leave_management_api"
)
_PLACEHOLDER_MARKERS = ("YOUR_SUPABASE_PASSWORD", "YOUR-PASSWORD", "YOUR_", ":PASSWORD@")
_SUPABASE_DIRECT_HOST = re.compile(r"^db\.([a-z0-9]+)\.supabase\.co$", re.I)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "LeaveFlow"
    environment: str = "development"
    jwt_secret: str = "dev-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    refresh_expire_days: int = 7
    password_reset_expire_minutes: int = 60
    frontend_url: str = "http://localhost:5173"

    database_url: str | None = None
    database_host: str | None = None
    database_port: int = 5432
    database_user: str = "postgres"
    database_password: str | None = None
    database_name: str = "postgres"
    database_sslmode: str | None = None
    # Supabase direct host (db.*) is IPv6-only; pooler uses IPv4 (required on many Windows networks).
    supabase_region: str | None = None
    supabase_use_pooler: bool = True

    auth_service_url: str = "http://localhost:8001"
    employee_service_url: str = "http://localhost:8002"
    leave_service_url: str = "http://localhost:8003"
    approval_service_url: str = "http://localhost:8004"

    @staticmethod
    def _normalize_database_url(url: str) -> str:
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://") :]
        if "supabase.co" in url and "sslmode=" not in url:
            url += "&sslmode=require" if "?" in url else "?sslmode=require"
        return url

    @classmethod
    def _apply_supabase_pooler(
        cls,
        host: str,
        user: str,
        port: int,
        region: str | None,
        use_pooler: bool,
    ) -> tuple[str, str, int]:
        if not use_pooler or not region:
            return host, user, port
        match = _SUPABASE_DIRECT_HOST.match(host.strip())
        if not match:
            return host, user, port
        project_ref = match.group(1)
        pooler_host = f"aws-0-{region.strip()}.pooler.supabase.com"
        pooler_user = user if user.startswith("postgres.") else f"postgres.{project_ref}"
        return pooler_host, pooler_user, port

    @classmethod
    def _pooler_from_database_url(cls, url: str, region: str | None, use_pooler: bool) -> str | None:
        if not use_pooler or not region:
            return None
        parsed = urlparse(url.replace("postgresql+psycopg://", "postgresql://", 1))
        if not parsed.hostname:
            return None
        host, user, port = cls._apply_supabase_pooler(
            parsed.hostname,
            parsed.username or "postgres",
            parsed.port or 5432,
            region,
            use_pooler,
        )
        if host == parsed.hostname:
            return None
        password = parsed.password or ""
        user_q = quote_plus(user, safe="")
        pwd_q = quote_plus(password, safe="")
        db = quote_plus((parsed.path or "/postgres").lstrip("/") or "postgres", safe="")
        query = parsed.query or "sslmode=require"
        if "sslmode=" not in query:
            query = f"{query}&sslmode=require" if query else "sslmode=require"
        return f"postgresql+psycopg://{user_q}:{pwd_q}@{host}:{port}/{db}?{query}"

    @model_validator(mode="after")
    def resolve_database_url(self) -> "Settings":
        if self.database_url:
            url = self._normalize_database_url(self.database_url.strip())
            for marker in _PLACEHOLDER_MARKERS:
                if marker in url:
                    raise ValueError(
                        "DATABASE_URL still contains a placeholder. Set DATABASE_PASSWORD "
                        "in web-api/.env (Supabase → Project Settings → Database)."
                    )
            pooled = self._pooler_from_database_url(url, self.supabase_region, self.supabase_use_pooler)
            self.database_url = pooled or url
            return self

        if self.database_host:
            password = (self.database_password or "").strip()
            if not password:
                raise ValueError(
                    "DATABASE_PASSWORD is empty. Supabase → Project Settings → Database → "
                    "reset the password, then set DATABASE_PASSWORD in web-api/.env"
                )
            host = self.database_host.strip()
            user = self.database_user.strip()
            port = self.database_port
            if self.supabase_use_pooler and self.supabase_region:
                host, user, port = self._apply_supabase_pooler(
                    host, user, port, self.supabase_region, True
                )
            if "supabase.co" in host and not self.database_sslmode:
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
        return self


settings = Settings()
