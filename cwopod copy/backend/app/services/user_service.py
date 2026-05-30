"""User service: profile retrieval and updates."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.exceptions import NotFoundError, ValidationError


class UserService:
    """Handles user profile retrieval and updates."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_profile(self, user_id: UUID) -> User:
        """Return user profile data. Never includes password_hash in response."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise NotFoundError("User not found")

        return user

    async def update_profile(self, user_id: UUID, display_name: str | None = None) -> User:
        """Update user profile fields.

        Currently supports: display_name (max 100 chars).
        """
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise NotFoundError("User not found")

        if display_name is not None:
            if len(display_name) > 100:
                raise ValidationError("Display name must not exceed 100 characters")
            user.display_name = display_name

        await self.db.flush()
        return user
