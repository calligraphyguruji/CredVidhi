"""API v1 Route definitions."""

from fastapi import APIRouter

from app.api.v1.applications import router as applications_router
from app.api.v1.auth import router as auth_router
from app.api.v1.documents import router as documents_router
from app.api.v1.health import router as health_router
from app.api.v1.products import router as products_router
from app.api.v1.queues import router as queues_router
from app.api.v1.underwriting import router as underwriting_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(products_router)
api_v1_router.include_router(applications_router)
api_v1_router.include_router(queues_router)
api_v1_router.include_router(documents_router)
api_v1_router.include_router(underwriting_router)

__all__ = [
    "api_v1_router",
    "health_router",
    "auth_router",
    "products_router",
    "applications_router",
    "queues_router",
    "documents_router",
    "underwriting_router",
]
