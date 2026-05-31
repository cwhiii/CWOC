"""OpenAI provider: external text (GPT-4o) and image (DALL-E 3) generation."""

import httpx

from app.services.ai_engine.base import AIProvider, AIProviderError


class OpenAIProvider(AIProvider):
    """External text and image generation using OpenAI API."""

    API_BASE = "https://api.openai.com/v1"

    def __init__(self, api_key: str, text_model: str = "gpt-4o", image_model: str = "dall-e-3"):
        self.api_key = api_key
        self.text_model = text_model
        self.image_model = image_model

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate_text(
        self, prompt: str, system_prompt: str = "", max_tokens: int = 2048
    ) -> str:
        """Generate text via OpenAI Chat Completions API."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.text_model,
            "messages": messages,
            "max_tokens": max_tokens,
        }

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout=90.0)) as client:
                response = await client.post(
                    f"{self.API_BASE}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
        except httpx.TimeoutException:
            raise AIProviderError(
                "OpenAI text request timed out after 90 seconds",
                provider="openai",
                is_timeout=True,
            )
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 401:
                msg = "OpenAI API key is invalid or expired"
            elif status == 429:
                msg = "OpenAI rate limit exceeded. Please try again later."
            else:
                msg = f"OpenAI returned error: {status}"
            raise AIProviderError(msg, provider="openai")

    async def generate_image(
        self, prompt: str, width: int = 1600, height: int = 2400
    ) -> bytes:
        """Generate an image via OpenAI Images API (DALL-E 3).

        DALL-E 3 supports fixed sizes; closest portrait match is 1024x1792.
        """
        # Select closest supported size
        size = "1024x1792"  # portrait, closest to 1600x2400 ratio

        payload = {
            "model": self.image_model,
            "prompt": prompt,
            "n": 1,
            "size": size,
            "response_format": "url",
        }

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout=120.0)) as client:
                response = await client.post(
                    f"{self.API_BASE}/images/generations",
                    headers=self._headers(),
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                image_url = data["data"][0]["url"]

                # Download the generated image
                img_response = await client.get(image_url)
                img_response.raise_for_status()
                return img_response.content
        except httpx.TimeoutException:
            raise AIProviderError(
                "OpenAI image request timed out after 120 seconds",
                provider="openai",
                is_timeout=True,
            )
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 401:
                msg = "OpenAI API key is invalid or expired"
            elif status == 429:
                msg = "OpenAI rate limit exceeded. Please try again later."
            else:
                msg = f"OpenAI image generation error: {status}"
            raise AIProviderError(msg, provider="openai")
