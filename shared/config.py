from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # SQLite for local Phase 3 without Docker; use Postgres in compose/prod.
    database_url: str = "sqlite+pysqlite:///./leaveflow.db"

    auth_service_url: str = "http://localhost:8001"
    employee_service_url: str = "http://localhost:8002"
    leave_service_url: str = "http://localhost:8003"
    approval_service_url: str = "http://localhost:8004"


settings = Settings()
