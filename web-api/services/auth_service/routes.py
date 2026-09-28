"""Re-export for auth microservice; canonical router lives in shared.routers.auth."""

from shared.routers.auth import router

__all__ = ["router"]
