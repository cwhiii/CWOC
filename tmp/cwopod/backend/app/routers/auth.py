"""Auth router: registration, login, logout endpoints."""

import logging

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.system_settings import SystemSettings
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse
from app.services.auth_service import AuthError, AuthService

logger = logging.getLogger(__name__)

router = APIRouter()

# Cookie settings
COOKIE_NAME = "session_token"
COOKIE_MAX_AGE = settings.session_expiry_minutes * 60
COOKIE_PATH = "/api"
COOKIE_HTTPONLY = True
COOKIE_SAMESITE = "lax"


@router.get("/registration-status")
async def registration_status(db: AsyncSession = Depends(get_db)):
    """Public endpoint: check if self-registration is allowed."""
    logger.debug("registration_status: checking system settings")
    result = await db.execute(select(SystemSettings).limit(1))
    sys_settings = result.scalar_one_or_none()
    allowed = sys_settings.allow_public_registration if sys_settings else False
    logger.debug("registration_status: allow_public_registration=%s", allowed)
    return {"registration_open": allowed}


def _set_session_cookie(response: Response, token: str) -> None:
    """Set the session cookie on the response."""
    # Only set secure=True if we're actually on HTTPS
    is_https = settings.app_url.startswith("https://")
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        path=COOKIE_PATH,
        httponly=COOKIE_HTTPONLY,
        samesite=COOKIE_SAMESITE,
        secure=is_https,
    )


def _clear_session_cookie(response: Response) -> None:
    """Clear the session cookie from the response."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path=COOKIE_PATH,
        httponly=COOKIE_HTTPONLY,
        samesite=COOKIE_SAMESITE,
    )


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    body: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user account.

    Creates the user, starts a session, and sets the session cookie.
    Returns the user profile on success.
    Blocked if public registration is disabled in system settings.
    """
    logger.info("register: email=%s", body.email)

    # Check if public registration is allowed
    result = await db.execute(select(SystemSettings).limit(1))
    sys_settings = result.scalar_one_or_none()
    if sys_settings and not sys_settings.allow_public_registration:
        logger.warning("register: public registration disabled, rejecting email=%s", body.email)
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail="Public registration is disabled. Contact the administrator."
        )

    auth_service = AuthService(db)

    try:
        user, session = await auth_service.register(body.email, body.password)
    except AuthError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=e.message)

    _set_session_cookie(response, session.token)

    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_admin=user.is_admin,
    )


@router.post("/login", response_model=UserResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate and create a session.

    Verifies credentials, creates a session, and sets the session cookie.
    Returns the user profile on success.
    """
    auth_service = AuthService(db)

    try:
        user, session = await auth_service.login(body.email, body.password)
    except AuthError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail=e.message)

    _set_session_cookie(response, session.token)

    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_admin=user.is_admin,
    )


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Destroy the current session.

    Clears the session cookie. Always returns 204 (idempotent).
    """
    session_token = request.cookies.get(COOKIE_NAME)

    if session_token:
        auth_service = AuthService(db)
        await auth_service.logout(session_token)

    _clear_session_cookie(response)
