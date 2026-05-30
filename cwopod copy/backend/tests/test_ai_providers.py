"""Unit tests for AI provider implementations with mocked HTTP (task 9.2).

Tests each provider's success path, timeout handling, and unsupported operations
using unittest.mock to patch httpx.AsyncClient in each provider module.

Validates: Requirements 4.1, 4.2, 4.3, 4.4, 7.1, 7.2
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.ai_engine.base import AIProviderError
from app.services.ai_engine.providers.anthropic import AnthropicProvider
from app.services.ai_engine.providers.comfyui import ComfyUIProvider
from app.services.ai_engine.providers.ollama import OllamaProvider
from app.services.ai_engine.providers.openai import OpenAIProvider
from app.services.ai_engine.providers.replicate import ReplicateProvider


def _make_httpx_response(status_code: int = 200, json_data=None, content=None):
    """Create a real httpx.Response object for mocking."""
    if json_data is not None:
        return httpx.Response(status_code, json=json_data, request=httpx.Request("GET", "http://test"))
    if content is not None:
        return httpx.Response(status_code, content=content, request=httpx.Request("GET", "http://test"))
    return httpx.Response(status_code, request=httpx.Request("GET", "http://test"))


def _make_mock_client(responses):
    """Create a mock AsyncClient that returns responses in sequence.

    Args:
        responses: A list of (method, url_contains, response) tuples, or a callable
                   that takes (method, url, kwargs) and returns a response.
    """
    mock_client = AsyncMock()

    if callable(responses):
        # Use a callable handler
        async def _post(url, **kwargs):
            return responses("POST", url, kwargs)

        async def _get(url, **kwargs):
            return responses("GET", url, kwargs)

        mock_client.post = AsyncMock(side_effect=_post)
        mock_client.get = AsyncMock(side_effect=_get)
    else:
        # Use sequential responses for post/get
        post_responses = [r for method, _, r in responses if method == "POST"]
        get_responses = [r for method, _, r in responses if method == "GET"]

        if post_responses:
            mock_client.post = AsyncMock(side_effect=post_responses)
        if get_responses:
            mock_client.get = AsyncMock(side_effect=get_responses)

    # Make it work as async context manager
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    return mock_client


# ---------------------------------------------------------------------------
# OllamaProvider Tests
# ---------------------------------------------------------------------------


class TestOllamaProvider:
    """Tests for OllamaProvider with mocked HTTP."""

    @pytest.mark.asyncio
    async def test_successful_text_generation(self):
        """OllamaProvider returns generated text from mocked HTTP response."""
        response = _make_httpx_response(json_data={"response": "Hello! I'm a helpful assistant."})
        mock_client = _make_mock_client([("POST", "/api/generate", response)])

        provider = OllamaProvider(base_url="http://mock-ollama:11434", model="llama3")

        with patch("app.services.ai_engine.providers.ollama.httpx.AsyncClient", return_value=mock_client):
            result = await provider.generate_text("Say hello")

        assert result == "Hello! I'm a helpful assistant."
        # Verify the correct endpoint was called
        mock_client.post.assert_called_once()
        call_args = mock_client.post.call_args
        assert "/api/generate" in call_args[0][0]

    @pytest.mark.asyncio
    async def test_timeout_raises_ai_provider_error(self):
        """OllamaProvider raises AIProviderError(is_timeout=True) on timeout."""
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("Connection timed out"))

        provider = OllamaProvider(base_url="http://mock-ollama:11434", model="llama3")

        with patch("app.services.ai_engine.providers.ollama.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(AIProviderError) as exc_info:
                await provider.generate_text("Say hello")

        assert exc_info.value.is_timeout is True
        assert exc_info.value.provider == "ollama"

    @pytest.mark.asyncio
    async def test_generate_image_raises_not_implemented(self):
        """OllamaProvider.generate_image raises NotImplementedError."""
        provider = OllamaProvider(base_url="http://mock-ollama:11434", model="llama3")

        with pytest.raises(NotImplementedError):
            await provider.generate_image("A landscape")


# ---------------------------------------------------------------------------
# ComfyUIProvider Tests
# ---------------------------------------------------------------------------


class TestComfyUIProvider:
    """Tests for ComfyUIProvider with mocked HTTP polling workflow."""

    @pytest.mark.asyncio
    async def test_successful_image_generation(self):
        """ComfyUIProvider returns image bytes after polling workflow completes."""
        fake_image_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        prompt_id = "test-prompt-id-123"

        # Track GET calls to simulate polling
        get_call_count = {"value": 0}

        def handler(method, url, kwargs):
            if method == "POST" and "/prompt" in url:
                return _make_httpx_response(json_data={"prompt_id": prompt_id})

            if method == "GET":
                if f"/history/{prompt_id}" in url:
                    get_call_count["value"] += 1
                    if get_call_count["value"] <= 1:
                        return _make_httpx_response(json_data={})
                    return _make_httpx_response(json_data={
                        prompt_id: {
                            "outputs": {
                                "9": {"images": [{"filename": "cwopod_00001.png"}]}
                            }
                        }
                    })
                if "/view" in url:
                    return _make_httpx_response(content=fake_image_bytes)

            return _make_httpx_response(status_code=404)

        mock_client = _make_mock_client(handler)

        provider = ComfyUIProvider(base_url="http://mock-comfyui:8188", model="sd_xl_base_1.0")

        with patch("app.services.ai_engine.providers.comfyui.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.ai_engine.providers.comfyui.asyncio.sleep", new_callable=AsyncMock):
                result = await provider.generate_image("A fantasy book cover")

        assert result == fake_image_bytes

    @pytest.mark.asyncio
    async def test_timeout_during_polling_raises_ai_provider_error(self):
        """ComfyUIProvider raises AIProviderError(is_timeout=True) when polling never completes."""
        prompt_id = "test-prompt-id-timeout"

        def handler(method, url, kwargs):
            if method == "POST" and "/prompt" in url:
                return _make_httpx_response(json_data={"prompt_id": prompt_id})

            if method == "GET" and f"/history/{prompt_id}" in url:
                # Never complete - always return empty
                return _make_httpx_response(json_data={})

            return _make_httpx_response(status_code=404)

        mock_client = _make_mock_client(handler)

        provider = ComfyUIProvider(base_url="http://mock-comfyui:8188", model="sd_xl_base_1.0")

        with patch("app.services.ai_engine.providers.comfyui.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.ai_engine.providers.comfyui.asyncio.sleep", new_callable=AsyncMock):
                with pytest.raises(AIProviderError) as exc_info:
                    await provider.generate_image("A fantasy book cover")

        assert exc_info.value.is_timeout is True
        assert exc_info.value.provider == "comfyui"

    @pytest.mark.asyncio
    async def test_generate_text_raises_not_implemented(self):
        """ComfyUIProvider.generate_text raises NotImplementedError."""
        provider = ComfyUIProvider(base_url="http://mock-comfyui:8188", model="sd_xl_base_1.0")

        with pytest.raises(NotImplementedError):
            await provider.generate_text("Write something")


# ---------------------------------------------------------------------------
# OpenAIProvider Tests
# ---------------------------------------------------------------------------


class TestOpenAIProvider:
    """Tests for OpenAIProvider with mocked HTTP."""

    @pytest.mark.asyncio
    async def test_successful_text_generation(self):
        """OpenAIProvider returns generated text from chat completions API."""
        response = _make_httpx_response(json_data={
            "choices": [
                {"message": {"content": "Here is a blurb for your book."}, "finish_reason": "stop"}
            ]
        })
        mock_client = _make_mock_client([("POST", "/chat/completions", response)])

        provider = OpenAIProvider(api_key="sk-test-key-123")

        with patch("app.services.ai_engine.providers.openai.httpx.AsyncClient", return_value=mock_client):
            result = await provider.generate_text("Write a blurb")

        assert result == "Here is a blurb for your book."

    @pytest.mark.asyncio
    async def test_successful_image_generation(self):
        """OpenAIProvider returns image bytes from images API."""
        fake_image_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50
        image_url = "https://oaidalleapiprodscus.blob.core.windows.net/test-image.png"

        call_count = {"post": 0, "get": 0}

        def handler(method, url, kwargs):
            if method == "POST" and "/images/generations" in url:
                call_count["post"] += 1
                return _make_httpx_response(json_data={"data": [{"url": image_url}]})
            if method == "GET":
                call_count["get"] += 1
                return _make_httpx_response(content=fake_image_bytes)
            return _make_httpx_response(status_code=404)

        mock_client = _make_mock_client(handler)

        provider = OpenAIProvider(api_key="sk-test-key-123")

        with patch("app.services.ai_engine.providers.openai.httpx.AsyncClient", return_value=mock_client):
            result = await provider.generate_image("A book cover with mountains")

        assert result == fake_image_bytes
        assert call_count["post"] == 1
        assert call_count["get"] == 1

    @pytest.mark.asyncio
    async def test_401_error_raises_ai_provider_error_with_auth_message(self):
        """OpenAIProvider raises AIProviderError with auth message on 401."""
        # Create a response that will trigger raise_for_status
        response = _make_httpx_response(status_code=401, json_data={"error": {"message": "Invalid API key"}})

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        async def _raise_on_post(url, **kwargs):
            raise httpx.HTTPStatusError(
                "401 Unauthorized",
                request=httpx.Request("POST", url),
                response=httpx.Response(401),
            )

        mock_client.post = AsyncMock(side_effect=_raise_on_post)

        provider = OpenAIProvider(api_key="sk-invalid-key")

        with patch("app.services.ai_engine.providers.openai.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(AIProviderError) as exc_info:
                await provider.generate_text("Hello")

        assert exc_info.value.provider == "openai"
        assert "invalid or expired" in exc_info.value.message.lower()


# ---------------------------------------------------------------------------
# AnthropicProvider Tests
# ---------------------------------------------------------------------------


class TestAnthropicProvider:
    """Tests for AnthropicProvider with mocked HTTP."""

    @pytest.mark.asyncio
    async def test_successful_text_generation(self):
        """AnthropicProvider returns generated text from messages API."""
        response = _make_httpx_response(json_data={
            "content": [{"type": "text", "text": "Here is a thoughtful response."}],
            "stop_reason": "end_turn",
        })
        mock_client = _make_mock_client([("POST", "/messages", response)])

        provider = AnthropicProvider(api_key="sk-ant-test-key")

        with patch("app.services.ai_engine.providers.anthropic.httpx.AsyncClient", return_value=mock_client):
            result = await provider.generate_text("Analyze this text")

        assert result == "Here is a thoughtful response."

    @pytest.mark.asyncio
    async def test_generate_image_raises_not_implemented(self):
        """AnthropicProvider.generate_image raises NotImplementedError."""
        provider = AnthropicProvider(api_key="sk-ant-test-key")

        with pytest.raises(NotImplementedError):
            await provider.generate_image("A landscape")


# ---------------------------------------------------------------------------
# ReplicateProvider Tests
# ---------------------------------------------------------------------------


class TestReplicateProvider:
    """Tests for ReplicateProvider with mocked HTTP polling."""

    @pytest.mark.asyncio
    async def test_successful_image_generation_with_polling(self):
        """ReplicateProvider returns image bytes after polling prediction completes."""
        fake_image_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 75
        prediction_id = "pred-abc123"
        image_output_url = "https://replicate.delivery/test-output.png"

        get_call_count = {"value": 0}

        def handler(method, url, kwargs):
            if method == "POST" and "/predictions" in url:
                return _make_httpx_response(json_data={"id": prediction_id, "status": "starting"})

            if method == "GET":
                if f"/predictions/{prediction_id}" in url:
                    get_call_count["value"] += 1
                    if get_call_count["value"] <= 1:
                        return _make_httpx_response(json_data={
                            "id": prediction_id, "status": "processing"
                        })
                    return _make_httpx_response(json_data={
                        "id": prediction_id,
                        "status": "succeeded",
                        "output": [image_output_url],
                    })
                # Image download
                return _make_httpx_response(content=fake_image_bytes)

            return _make_httpx_response(status_code=404)

        mock_client = _make_mock_client(handler)

        provider = ReplicateProvider(api_key="r8-test-key-123")

        with patch("app.services.ai_engine.providers.replicate.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.ai_engine.providers.replicate.asyncio.sleep", new_callable=AsyncMock):
                result = await provider.generate_image("A fantasy landscape")

        assert result == fake_image_bytes

    @pytest.mark.asyncio
    async def test_generate_text_raises_not_implemented(self):
        """ReplicateProvider.generate_text raises NotImplementedError."""
        provider = ReplicateProvider(api_key="r8-test-key-123")

        with pytest.raises(NotImplementedError):
            await provider.generate_text("Write something")
