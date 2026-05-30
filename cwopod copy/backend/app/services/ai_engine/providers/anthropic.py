"""Anthropic provider: external text generation using Claude."""

import httpx

from app.services.ai_engine.base import AIProvider, AIProviderError


class AnthropicProvider(AIProvider):
    """External text generation using Anthropic Claude API."""

    API_BASE = "https://api.anthropic.com/v1"

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.api_key = api_key
        self.model = model

    def _headers(self) -> dict:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

    async def generate_text(
        self, prompt: str, system_prompt: str = "", max_tokens: int = 2048
    ) -> str:
        """Generate text via Anthropic Messages API."""
        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout=90.0)) as client:
                response = await client.post(
                    f"{self.API_BASE}/messages",
                    headers=self._headers(),
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                # Extract text from content blocks
                content = data.get("content", [])
                return "".join(
                    block["text"] for block in content if block.get("type") == "text"
                )
        except httpx.TimeoutException:
            raise AIProviderError(
                "Anthropic request timed out after 90 seconds",
                provider="anthropic",
                is_timeout=True,
            )
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 401:
                msg = "Anthropic API key is invalid or expired"
            elif status == 429:
                msg = "Anthropic rate limit exceeded. Please try again later."
            else:
                msg = f"Anthropic returned error: {status}"
            raise AIProviderError(msg, provider="anthropic")

    async def generate_image(
        self, prompt: str, width: int = 1600, height: int = 2400
    ) -> bytes:
        raise NotImplementedError("AnthropicProvider does not support image generation")
