"""User-scoped query helper for data isolation."""

from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base


class UserScopedQuery:
    """Provides user-scoped database queries for data isolation.

    All queries are automatically filtered by user_id, ensuring
    no cross-user data leakage at the ORM level.

    Usage:
        scoped = UserScopedQuery(db, current_user.id)
        projects = await scoped.list_all(BookProject)
        project = await scoped.get_by_id(BookProject, some_id)
    """

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

    def base_query(self, model: type) -> Select:
        """Returns a SELECT query pre-filtered by user_id.

        Usage: query = scoped.base_query(BookProject).where(...)
        """
        return select(model).where(model.user_id == self.user_id)

    async def get_by_id(self, model: type, resource_id: UUID):
        """Get a single resource by ID, scoped to user.

        Returns None if not found OR belongs to another user.
        This prevents information leakage about other users' resources.
        """
        result = await self.db.execute(
            select(model).where(
                model.id == resource_id,
                model.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def create(self, instance) -> object:
        """Insert a new record, automatically setting user_id."""
        instance.user_id = self.user_id
        self.db.add(instance)
        await self.db.flush()
        return instance

    async def list_all(self, model: type, **filters):
        """Return all records for user with optional additional filters."""
        query = self.base_query(model)
        for key, value in filters.items():
            query = query.where(getattr(model, key) == value)
        result = await self.db.execute(query)
        return result.scalars().all()
