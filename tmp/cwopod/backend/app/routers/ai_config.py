"""AI config router: GET/PATCH user AI configuration."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.ai_config import AIConfig
from app.models.user import User
from app.services.ai_engine.registry import VALID_TEXT_PROVIDERS, VALID_IMAGE_PROVIDERS
from app.utils.encryption import encrypt_value

router = APIRouter()


class AIConfigResponse(BaseModel):
    text_provider: str
    text_model: str | None
    text_api_key_set: bool
    image_provider: str
    image_model: str | None
    image_api_key_set: bool


class AIConfigUpdate(BaseModel):
    text_provider: str | None = None
    text_api_key: str | None = None
    text_model: str | None = None
    image_provider: str | None = None
    image_api_key: str | None = None
    image_model: str | None = None

    @field_validator("text_api_key", "image_api_key")
    @classmethod
    def validate_api_key(cls, v):
        if v is not None:
            if len(v) == 0:
                raise ValueError("API key must not be empty")
            if len(v) > 256:
                raise ValueError("API key must not exceed 256 characters")
        return v

    @field_validator("text_provider")
    @classmethod
    def validate_text_provider(cls, v):
        if v is not None and v not in VALID_TEXT_PROVIDERS:
            raise ValueError(
                f"text_provider must be one of: {', '.join(VALID_TEXT_PROVIDERS)}"
            )
        return v

    @field_validator("image_provider")
    @classmethod
    def validate_image_provider(cls, v):
        if v is not None and v not in VALID_IMAGE_PROVIDERS:
            raise ValueError(
                f"image_provider must be one of: {', '.join(VALID_IMAGE_PROVIDERS)}"
            )
        return v


@router.get("/ai-config", response_model=AIConfigResponse)
async def get_ai_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's AI configuration."""
    result = await db.execute(
        select(AIConfig).where(AIConfig.user_id == current_user.id)
    )
    config = result.scalar_one_or_none()

    if config is None:
        return AIConfigResponse(
            text_provider="local",
            text_model=None,
            text_api_key_set=False,
            image_provider="local",
            image_model=None,
            image_api_key_set=False,
        )

    return AIConfigResponse(
        text_provider=config.text_provider,
        text_model=config.text_model,
        text_api_key_set=config.text_api_key_encrypted is not None,
        image_provider=config.image_provider,
        image_model=config.image_model,
        image_api_key_set=config.image_api_key_encrypted is not None,
    )


@router.patch("/ai-config", response_model=AIConfigResponse)
async def update_ai_config(
    body: AIConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's AI configuration. Supports partial updates."""
    result = await db.execute(
        select(AIConfig).where(AIConfig.user_id == current_user.id)
    )
    config = result.scalar_one_or_none()

    # Upsert: create if doesn't exist
    if config is None:
        config = AIConfig(user_id=current_user.id)
        db.add(config)

    user_salt = str(current_user.id)

    # Apply updates — only modify fields explicitly included in the request body.
    # Use model_fields_set to distinguish "field not sent" from "field sent as null".
    fields_set = body.model_fields_set

    if "text_provider" in fields_set and body.text_provider is not None:
        config.text_provider = body.text_provider

    if "text_model" in fields_set:
        # Allow clearing model (null) when switching to local provider
        config.text_model = body.text_model

    if "text_api_key" in fields_set:
        if body.text_api_key is None:
            # Explicitly set to null — clear the stored key
            config.text_api_key_encrypted = None
        else:
            config.text_api_key_encrypted = encrypt_value(body.text_api_key, user_salt)

    if "image_provider" in fields_set and body.image_provider is not None:
        config.image_provider = body.image_provider

    if "image_model" in fields_set:
        # Allow clearing model (null) when switching to local provider
        config.image_model = body.image_model

    if "image_api_key" in fields_set:
        if body.image_api_key is None:
            # Explicitly set to null — clear the stored key
            config.image_api_key_encrypted = None
        else:
            config.image_api_key_encrypted = encrypt_value(body.image_api_key, user_salt)

    await db.flush()

    return AIConfigResponse(
        text_provider=config.text_provider,
        text_model=config.text_model,
        text_api_key_set=config.text_api_key_encrypted is not None,
        image_provider=config.image_provider,
        image_model=config.image_model,
        image_api_key_set=config.image_api_key_encrypted is not None,
    )
