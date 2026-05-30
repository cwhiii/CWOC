"""Authentication service: registration, login, logout, session management."""

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import Session, User


class AuthError(Exception):
    """Raised when authentication fails."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


# Pre-computed dummy hash for constant-time comparison on non-existent users
_DUMMY_HASH = bcrypt.hashpw(b"dummy-timing-safe", bcrypt.gensalt(rounds=12))


class AuthService:
    """Handles user registration, login, logout, and session validation."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, email: str, password: str) -> tuple[User, Session]:
        """Register a new user account.

        - Validates email format and password length (>= 8 chars)
        - Normalizes email to lowercase
        - Hashes password with bcrypt (cost factor 12)
        - Creates user record
        - Creates session and returns (user, session)
        - Raises AuthError if email already exists (generic message)
        """
        # Validate username (non-empty, reasonable length)
        if not email or len(email.strip()) < 1:
            raise AuthError("Username is required")
        if len(email.strip()) > 254:
            raise AuthError("Username is too long")

        # Validate password length
        if not password or len(password) < 8:
            raise AuthError("Password must be at least 8 characters")

        # Normalize email
        normalized_email = email.strip().lower()

        # Hash password with bcrypt cost factor 12
        password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt(rounds=12)
        ).decode("utf-8")

        # Create user
        user = User(email=normalized_email, password_hash=password_hash)
        self.db.add(user)

        try:
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            raise AuthError(
                "Registration failed. Please check your input and try again."
            )

        # Create session
        session = await self._create_session(user.id)
        return user, session

    async def login(self, email: str, password: str) -> tuple[User, Session]:
        """Authenticate user and create session.

        - Looks up user by lowercase email
        - Verifies password with bcrypt constant-time comparison
        - Creates new session
        - Returns (user, session)
        - Raises AuthError with generic message on failure
        """
        normalized_email = email.strip().lower()

        # Query user by email
        result = await self.db.execute(
            select(User).where(User.email == normalized_email)
        )
        user = result.scalar_one_or_none()

        if user is None:
            # Constant-time dummy check to prevent timing attacks
            bcrypt.checkpw(b"dummy", _DUMMY_HASH)
            raise AuthError("Invalid email or password")

        # Verify password (constant-time comparison via bcrypt)
        if not bcrypt.checkpw(
            password.encode("utf-8"), user.password_hash.encode("utf-8")
        ):
            raise AuthError("Invalid email or password")

        # Create session
        session = await self._create_session(user.id)
        return user, session

    async def logout(self, session_token: str) -> None:
        """Destroy a session. Idempotent: no error if token doesn't exist."""
        await self.db.execute(
            delete(Session).where(Session.token == session_token)
        )

    async def validate_session(self, session_token: str) -> User | None:
        """Validate a session token and return the associated user.

        - Checks expiry (sliding window: extends by 30 min on each valid request)
        - Deletes expired sessions
        - Returns User or None
        """
        now = datetime.now(timezone.utc)

        result = await self.db.execute(
            select(Session).where(Session.token == session_token)
        )
        session = result.scalar_one_or_none()

        if session is None:
            return None

        # Check expiry
        if session.expires_at.replace(tzinfo=timezone.utc) < now:
            await self.db.execute(
                delete(Session).where(Session.id == session.id)
            )
            return None

        # Extend session (sliding window)
        session.last_active = now
        session.expires_at = now + timedelta(minutes=settings.session_expiry_minutes)

        # Fetch associated user
        result = await self.db.execute(
            select(User).where(User.id == session.user_id)
        )
        return result.scalar_one_or_none()

    async def cleanup_expired_sessions(self) -> int:
        """Delete all expired sessions. Returns count of deleted sessions."""
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            delete(Session).where(Session.expires_at < now)
        )
        return result.rowcount

    async def _create_session(self, user_id: UUID) -> Session:
        """Create a new session for the given user."""
        now = datetime.now(timezone.utc)
        token = secrets.token_urlsafe(32)

        session = Session(
            user_id=user_id,
            token=token,
            expires_at=now + timedelta(minutes=settings.session_expiry_minutes),
            last_active=now,
        )
        self.db.add(session)
        await self.db.flush()
        return session
