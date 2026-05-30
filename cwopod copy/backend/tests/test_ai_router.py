"""Unit tests for AIRouter provider routing and error handling."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.ai_config import AIConfig
from app.services.ai_engine.base import AIProviderError, AIResult
from app.services.ai_engine.router import AIRouter


@pytest.fixture
def user_id():
    return uuid.uuid4()


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def router(mock_db, user_id):
    return AIRouter(db=mock_db, user_id=user_id)


def _make_config(
    text_provider="local",
    image_provider="local",
    text_api_key_encrypted=None,
    image_api_key_encrypted=None,
    text_model=None,
    image_model=None,
    user_id=None,
):
    """Helper to create a mock AIConfig."""
    config = MagicMock(spec=AIConfig)
    config.text_provider = text_provider
    config.image_provider = image_provider
    config.text_api_key_encrypted = text_api_key_encrypted
    config.image_api_key_encrypted = image_api_key_encrypted
    config.text_model = text_model
    config.image_model = image_model
    config.user_id = user_id
    return config


@pytest.mark.asyncio
async def test_routes_to_ollama_when_text_provider_is_local(router):
    """Routes to OllamaProvider when text_provider is 'local' (no key configured)."""
    config = _make_config(text_provider="local", text_api_key_encrypted=None)

    with patch.object(router, "_get_config", return_value=config):
        with patch(
            "app.services.ai_engine.router.AIRouter._create_local_provider"
        ) as mock_create_local:
            mock_provider = AsyncMock()
            mock_provider.generate_text = AsyncMock(return_value="Hello from Ollama")
            mock_create_local.return_value = mock_provider

            result = await router.generate_text("test prompt")

            mock_create_local.assert_called_once_with("text", None)
            assert result.success is True
            assert result.data == "Hello from Ollama"
            assert result.provider_used == "local"


@pytest.mark.asyncio
async def test_routes_to_comfyui_when_image_provider_is_local(router):
    """Routes to ComfyUIProvider when image_provider is 'local' (no key configured)."""
    config = _make_config(image_provider="local", image_api_key_encrypted=None)

    with patch.object(router, "_get_config", return_value=config):
        with patch(
            "app.services.ai_engine.router.AIRouter._create_local_provider"
        ) as mock_create_local:
            mock_provider = AsyncMock()
            mock_provider.generate_image = AsyncMock(return_value=b"\x89PNG fake")
            mock_create_local.return_value = mock_provider

            result = await router.generate_image("a book cover")

            mock_create_local.assert_called_once_with("image", None)
            assert result.success is True
            assert result.data == b"\x89PNG fake"
            assert result.provider_used == "local"


@pytest.mark.asyncio
async def test_routes_to_openai_when_text_provider_is_openai(router, user_id):
    """Routes to OpenAIProvider when text_provider is 'openai' and key is configured."""
    config = _make_config(
        text_provider="openai",
        text_api_key_encrypted="encrypted_openai_key",
    )

    with patch.object(router, "_get_config", return_value=config):
        with patch(
            "app.services.ai_engine.router.AIRouter._create_external_provider"
        ) as mock_create_ext:
            mock_provider = AsyncMock()
            mock_provider.generate_text = AsyncMock(return_value="Hello from OpenAI")
            mock_create_ext.return_value = mock_provider

            with patch(
                "app.services.ai_engine.router.AIRouter._decrypt_key",
                return_value="sk-openai-key",
            ):
                result = await router.generate_text("test prompt")

            assert result.success is True
            assert result.data == "Hello from OpenAI"
            assert result.provider_used == "openai"


@pytest.mark.asyncio
async def test_routes_to_anthropic_when_text_provider_is_anthropic(router, user_id):
    """Routes to AnthropicProvider when text_provider is 'anthropic' and key is configured."""
    config = _make_config(
        text_provider="anthropic",
        text_api_key_encrypted="encrypted_anthropic_key",
    )

    with patch.object(router, "_get_config", return_value=config):
        with patch(
            "app.services.ai_engine.router.AIRouter._create_external_provider"
        ) as mock_create_ext:
            mock_provider = AsyncMock()
            mock_provider.generate_text = AsyncMock(return_value="Hello from Claude")
            mock_create_ext.return_value = mock_provider

            with patch(
                "app.services.ai_engine.router.AIRouter._decrypt_key",
                return_value="sk-ant-key",
            ):
                result = await router.generate_text("test prompt")

            assert result.success is True
            assert result.data == "Hello from Claude"
            assert result.provider_used == "anthropic"


@pytest.mark.asyncio
async def test_routes_to_replicate_when_image_provider_is_replicate(router, user_id):
    """Routes to ReplicateProvider when image_provider is 'replicate' and key is configured."""
    config = _make_config(
        image_provider="replicate",
        image_api_key_encrypted="encrypted_replicate_key",
    )

    with patch.object(router, "_get_config", return_value=config):
        with patch(
            "app.services.ai_engine.router.AIRouter._create_external_provider"
        ) as mock_create_ext:
            mock_provider = AsyncMock()
            mock_provider.generate_image = AsyncMock(return_value=b"\x89PNG replicate")
            mock_create_ext.return_value = mock_provider

            with patch(
                "app.services.ai_engine.router.AIRouter._decrypt_key",
                return_value="r8_replicate_key",
            ):
                result = await router.generate_image("a fantasy cover")

            assert result.success is True
            assert result.data == b"\x89PNG replicate"
            assert result.provider_used == "replicate"


@pytest.mark.asyncio
async def test_changing_text_provider_does_not_affect_image_routing(router, user_id):
    """Changing text provider does not affect image provider routing."""
    # Config: text=anthropic, image=local
    config = _make_config(
        text_provider="anthropic",
        text_api_key_encrypted="encrypted_key",
        image_provider="local",
        image_api_key_encrypted=None,
    )

    with patch.object(router, "_get_config", return_value=config):
        with patch(
            "app.services.ai_engine.router.AIRouter._create_local_provider"
        ) as mock_create_local:
            mock_provider = AsyncMock()
            mock_provider.generate_image = AsyncMock(return_value=b"\x89PNG local")
            mock_create_local.return_value = mock_provider

            result = await router.generate_image("a cover image")

            # Image should still route to local despite text being anthropic
            mock_create_local.assert_called_once_with("image", None)
            assert result.success is True
            assert result.provider_used == "local"


@pytest.mark.asyncio
async def test_changing_image_provider_does_not_affect_text_routing(router, user_id):
    """Changing image provider does not affect text provider routing."""
    # Config: text=local, image=replicate
    config = _make_config(
        text_provider="local",
        text_api_key_encrypted=None,
        image_provider="replicate",
        image_api_key_encrypted="encrypted_key",
    )

    with patch.object(router, "_get_config", return_value=config):
        with patch(
            "app.services.ai_engine.router.AIRouter._create_local_provider"
        ) as mock_create_local:
            mock_provider = AsyncMock()
            mock_provider.generate_text = AsyncMock(return_value="Local text")
            mock_create_local.return_value = mock_provider

            result = await router.generate_text("test prompt")

            # Text should still route to local despite image being replicate
            mock_create_local.assert_called_once_with("text", None)
            assert result.success is True
            assert result.provider_used == "local"


@pytest.mark.asyncio
async def test_returns_ai_result_with_error_on_provider_failure_no_auto_switch(router):
    """Returns AIResult with error on provider failure (no auto-switch)."""
    config = _make_config(
        text_provider="openai",
        text_api_key_encrypted="encrypted_key",
    )

    with patch.object(router, "_get_config", return_value=config):
        with patch(
            "app.services.ai_engine.router.AIRouter._create_external_provider"
        ) as mock_create_ext:
            mock_provider = AsyncMock()
            mock_provider.generate_text = AsyncMock(
                side_effect=AIProviderError(
                    message="Rate limit exceeded",
                    provider="openai",
                )
            )
            mock_create_ext.return_value = mock_provider

            with patch(
                "app.services.ai_engine.router.AIRouter._decrypt_key",
                return_value="sk-key",
            ):
                result = await router.generate_text("test prompt")

            # Should return error, not auto-switch to another provider
            assert result.success is False
            assert "openai" in result.error
            assert "Rate limit exceeded" in result.error
            assert result.provider_used == "openai"
            assert result.can_retry is True


@pytest.mark.asyncio
async def test_returns_ai_result_with_can_fallback_local_for_external_failures(router):
    """Returns AIResult with can_fallback_local=True for external provider failures."""
    config = _make_config(
        text_provider="anthropic",
        text_api_key_encrypted="encrypted_key",
    )

    with patch.object(router, "_get_config", return_value=config):
        with patch(
            "app.services.ai_engine.router.AIRouter._create_external_provider"
        ) as mock_create_ext:
            mock_provider = AsyncMock()
            mock_provider.generate_text = AsyncMock(
                side_effect=AIProviderError(
                    message="Service unavailable",
                    provider="anthropic",
                )
            )
            mock_create_ext.return_value = mock_provider

            with patch(
                "app.services.ai_engine.router.AIRouter._decrypt_key",
                return_value="sk-ant-key",
            ):
                result = await router.generate_text("test prompt")

            assert result.success is False
            assert result.can_fallback_local is True
            assert result.provider_used == "anthropic"
