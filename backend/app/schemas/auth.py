"""Authentication and User Profile Pydantic DTOs."""

import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.email_validation import validate_email_not_disposable
from app.models.user import UserRole


class UserRegisterRequest(BaseModel):
    """Borrower account registration payload."""

    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=20)
    pan_number: Optional[str] = Field(
        None,
        min_length=10,
        max_length=10,
        pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$",
        description="Standard Indian 10-character Permanent Account Number",
    )

    @field_validator("email")
    @classmethod
    def reject_disposable_email(cls, v: str) -> str:
        """Block disposable/temporary email domains and undeliverable addresses."""
        return validate_email_not_disposable(v)


class UserLoginRequest(BaseModel):
    """User credential login payload."""

    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenRefreshRequest(BaseModel):
    """Refresh token exchange payload."""

    refresh_token: str = Field(..., min_length=1)


class LogoutRequest(BaseModel):
    """Optional logout payload to revoke refresh token alongside access token."""

    refresh_token: Optional[str] = None


class TokenResponse(BaseModel):
    """JWT bearer token issuance payload."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_seconds: int


class UserProfileResponse(BaseModel):
    """Publicly safe user profile representation with masked PII."""

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    full_name: str
    role: UserRole
    is_active: bool
    phone_number: Optional[str] = None
    masked_pan: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
