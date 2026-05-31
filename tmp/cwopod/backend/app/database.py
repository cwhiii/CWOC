import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(settings.database_url, echo=False, pool_size=20, max_overflow=10)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    """Dependency that provides a database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def create_worker_session() -> tuple[async_sessionmaker[AsyncSession], "AsyncEngine"]:
    """Create a fresh engine + session factory for use inside Celery workers.

    Celery tasks run in a fresh event loop (via _run_async). The module-level
    engine/session are bound to the FastAPI event loop and cannot be reused in a
    different loop (causes 'Future attached to a different loop' errors).

    Each task invocation should call this to get a session factory that is bound
    to the current (worker) event loop. The caller MUST dispose the returned
    engine after use to prevent connection pool leaks across task invocations.

    Returns:
        Tuple of (async_sessionmaker, engine) — caller must await engine.dispose().
    """
    logger.debug("create_worker_session: creating fresh engine for worker event loop")
    worker_engine = create_async_engine(
        settings.database_url, echo=False, pool_size=5, max_overflow=5
    )
    worker_session = async_sessionmaker(
        worker_engine, class_=AsyncSession, expire_on_commit=False
    )
    return worker_session, worker_engine
