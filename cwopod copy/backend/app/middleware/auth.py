"""Authentication middleware: FastAPI dependencies for route protection."""

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services.auth_service import AuthService
from app.utils.exceptions import UnauthorizedError


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency that validates the session and returns the current user.

    Extracts session_token from cookies, validates it, and returns the User.
    Raises 401 if no valid session exists.

    Usage: current_user: User = Depends(get_current_user)
    """
    session_token = request.cookies.get("session_token")

    if not session_token:
        raise UnauthorizedError("Authentication required")

    auth_service = AuthService(db)
    user = await auth_service.validate_session(session_token)

    if user is None:
        raise UnauthorizedError("Authentication required")

    return user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """FastAPI dependency that returns the current user or None.

    Does not raise on missing/invalid session. Useful for routes that
    work with or without authentication.
    """
    session_token = request.cookies.get("session_token")

    if not session_token:
        return None

    auth_service = AuthService(db)
    return await auth_service.validate_session(session_token)
