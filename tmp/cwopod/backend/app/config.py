from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: str = "postgresql+asyncpg://cwopod:cwopod@db:5432/cwopod"
    redis_url: str = "redis://redis:6379/0"

    storage_backend: str = "local"  # "local" or "s3"
    storage_path: str = "/app/storage"
    s3_bucket: str = ""
    s3_endpoint: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_region: str = ""

    # Source service provider configuration
    source_providers_disabled: str = ""  # Comma-separated provider IDs to disable

    ollama_url: str = ""
    comfyui_url: str = ""

    app_url: str = "http://localhost:8080"
    secret_key: str = "change-me-to-a-random-64-char-string"
    session_expiry_minutes: int = 43200  # 30 days

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
