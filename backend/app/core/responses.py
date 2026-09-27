"""Standardized API Response and Error Envelope System.

Ensures strict contract uniformity across all API v1 endpoints.
"""

from typing import Any, Dict, Generic, Optional, TypeVar

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    """Normalized error detail payload."""

    code: str = Field(..., description="Machine-readable invariant error code")
    message: str = Field(..., description="Human-readable error explanation")
    details: Dict[str, Any] = Field(
        default_factory=dict, description="Contextual error metadata or field errors"
    )


class ApiResponse(BaseModel, Generic[T]):
    """Standardized top-level API response envelope."""

    success: bool
    data: Optional[T] = None
    error: Optional[ErrorDetail] = None


def success_response(
    data: Any = None,
    status_code: int = 200,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    """Construct a standardized 2xx JSONResponse."""
    payload = {
        "success": True,
        "data": jsonable_encoder(data) if data is not None else None,
        "error": None,
    }
    return JSONResponse(content=payload, status_code=status_code, headers=headers)


def error_response(
    code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    status_code: int = 400,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    """Construct a standardized 4xx/5xx error JSONResponse."""
    payload = {
        "success": False,
        "data": None,
        "error": {
            "code": code,
            "message": message,
            "details": jsonable_encoder(details) if details is not None else {},
        },
    }
    return JSONResponse(content=payload, status_code=status_code, headers=headers)
