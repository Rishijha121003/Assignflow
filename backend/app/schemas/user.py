from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    """Payload for registering a new user."""
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150, description="User's full name")
    password: str = Field(..., min_length=6, max_length=128, description="Plaintext password")
    role: Literal["teacher", "student"] = Field("student", description="Role: 'teacher' or 'student'")


class UserLogin(BaseModel):
    """Payload for user authentication."""
    email: EmailStr
    password: str = Field(..., min_length=1, description="Account password")


class UserResponse(BaseModel):
    """Public user representation returned by API."""
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """Authentication token response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
