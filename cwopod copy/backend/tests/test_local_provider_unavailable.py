"""Tests for graceful handling of missing local AI providers (task 8.3).

Verifies that when Ollama or ComfyUI is unreachable (connection refused),
the system returns an AIResult with a clear error message and correct flags:
- can_retry=True
- can_fallback_local=False (already attempted local)
"""

import pytest
import httpx

from app.services.ai_engine.base import AIProviderError, AIResult
from app.services.ai_engine.providers.ollama import OllamaProvider
from app.services.ai_engine.providers.comfyui import ComfyUIProvider


class TestOllamaConnectionRefused:
    """Test Ollama provider raises correct error when service is unreachable."""

    @pytest.mark.asyncio
    async def test_generate_text_connection_refused(self):
        """When Ollama is unreachable, raises AIProviderError with clear message."""
        # Use a port that nothing is listening on
        provider = OllamaProvider(base_url="http://127.0.0.1:19999", model="llama3")

        with pytest.raises(AIProviderError) as exc_info:
            await provider.generate_text("Hello")

        assert exc_info.value.provider == "ollama"
        assert "Local AI service (Ollama) is not available" in exc_info.value.message
        assert "Ensure the service is running" in exc_info.value.message
        assert exc_info.value.is_timeout is False


class TestComfyUIConnectionRefused:
    """Test ComfyUI provider raises correct error when service is unreachable."""

    @pytest.mark.asyncio
    async def test_generate_image_connection_refused(self):
        """When ComfyUI is unreachable, raises AIProviderError with clear message."""
        # Use a port that nothing is listening on
        provider = ComfyUIProvider(base_url="http://127.0.0.1:19998", model="sd_xl_base_1.0")

        with pytest.raises(AIProviderError) as exc_info:
            await provider.generate_image("A beautiful landscape")

        assert exc_info.value.provider == "comfyui"
        assert "Local AI service (ComfyUI) is not available" in exc_info.value.message
        assert "Ensure the service is running" in exc_info.value.message
        assert exc_info.value.is_timeout is False


class TestAIRouterLocalProviderUnavailable:
    """Test that AIRouter returns correct AIResult when local providers are unreachable.

    These tests verify the full chain: provider raises AIProviderError →
    router catches it → returns AIResult with can_retry=True, can_fallback_local=False.
    """

    @pytest.mark.asyncio
    async def test_text_generation_local_unavailable_returns_correct_result(self):
        """When Ollama is unreachable, AIRouter returns AIResult with correct flags."""
        from unittest.mock import AsyncMock, MagicMock, patch
        from uuid import uuid4

        from app.services.ai_engine.router import AIRouter

        mock_db = AsyncMock()
        # Simulate no config → defaults to "local"
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        router = AIRouter(db=mock_db, user_id=uuid4())

        # Patch the local provider to simulate connection refused
        with patch.object(router, "_create_local_provider") as mock_create:
            mock_provider = AsyncMock()
            mock_provider.generate_text.side_effect = AIProviderError(
                "Local AI service (Ollama) is not available. Ensure the service is running.",
                provider="ollama",
            )
            mock_create.return_value = mock_provider

            result = await router.generate_text("Hello")

        assert result.success is False
        assert "Local AI service (Ollama) is not available" in result.error
        assert result.can_retry is True
        assert result.can_fallback_local is False

    @pytest.mark.asyncio
    async def test_image_generation_local_unavailable_returns_correct_result(self):
        """When ComfyUI is unreachable, AIRouter returns AIResult with correct flags."""
        from unittest.mock import AsyncMock, MagicMock, patch
        from uuid import uuid4

        from app.services.ai_engine.router import AIRouter

        mock_db = AsyncMock()
        # Simulate no config → defaults to "local"
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        router = AIRouter(db=mock_db, user_id=uuid4())

        # Patch the local provider to simulate connection refused
        with patch.object(router, "_create_local_provider") as mock_create:
            mock_provider = AsyncMock()
            mock_provider.generate_image.side_effect = AIProviderError(
                "Local AI service (ComfyUI) is not available. Ensure the service is running.",
                provider="comfyui",
            )
            mock_create.return_value = mock_provider

            result = await router.generate_image("A landscape")

        assert result.success is False
        assert "Local AI service (ComfyUI) is not available" in result.error
        assert result.can_retry is True
        assert result.can_fallback_local is False
