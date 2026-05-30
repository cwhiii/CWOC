"""Pydantic schemas for auth endpoints."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    display_name: str | None = None
    is_admin: bool = False


class UserProfileResponse(BaseModel):
    email: str
    display_name: str | None = None
    is_admin: bool = False
    created_at: datetime


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=100)
