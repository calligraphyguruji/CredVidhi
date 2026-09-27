"""API v1 Route definitions."""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.products import router as products_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(products_router)

__all__ = ["api_v1_router", "health_router", "auth_router", "products_router"]
