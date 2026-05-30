from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "book_studio",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=7200,  # 2 hour hard limit (for model downloads)
    task_soft_time_limit=3600,  # 1 hour soft limit
)

# Auto-discover tasks from service modules
celery_app.autodiscover_tasks([
    "app.services.quality_controller",
    "app.services.source_service",
])

# Explicitly include task modules that don't follow the tasks.py convention
celery_app.conf.update(
    include=[
        "app.services.typeset.pdf_generator",
        "app.services.cover.tasks",
        "app.services.comfyui.tasks",
        "app.services.ollama.tasks",
        "app.services.source_service.tasks",
        "app.services.illustrations.tasks",
    ],
)

# Celery Beat schedule — periodic tasks
celery_app.conf.beat_schedule = {
    "sync-gutenberg-catalog-nightly": {
        "task": "source_service.sync_gutenberg_catalog",
        "schedule": crontab(hour=3, minute=0),  # 3:00 AM UTC every day
        "kwargs": {"full_resync": False},
    },
}
