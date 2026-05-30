"""Replicate provider: external image generation via Replicate API."""

import asyncio

import httpx

from app.services.ai_engine.base import AIProvider, AIProviderError


class ReplicateProvider(AIProvider):
    """External image generation using Replicate API."""

    API_BASE = "https://api.replicate.com/v1"

    def __init__(self, api_key: str, model: str = "black-forest-labs/flux-1.1-pro"):
        self.api_key = api_key
        self.model = model

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate_text(
        self, prompt: str, system_prompt: str = "", max_tokens: int = 2048
    ) -> str:
        raise NotImplementedError("ReplicateProvider does not support text generation")

    async def generate_image(
        self, prompt: str, width: int = 1600, height: int = 2400
    ) -> bytes:
        """Generate an image via Replicate's predictions API.

        1. Create prediction
        2. Poll until succeeded/failed
        3. Download output image
        """
        payload = {
            "model": self.model,
            "input": {
                "prompt": prompt,
                "width": width,
                "height": height,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout=120.0)) as client:
                # Create prediction
                response = await client.post(
                    f"{self.API_BASE}/predictions",
                    headers=self._headers(),
                    json=payload,
                )
                response.raise_for_status()
                prediction = response.json()
                prediction_id = prediction["id"]

                # Poll for completion
                output_url = await self._poll_prediction(client, prediction_id)

                # Download image
                img_response = await client.get(output_url)
                img_response.raise_for_status()
                return img_response.content

        except httpx.TimeoutException:
            raise AIProviderError(
                "Replicate request timed out after 120 seconds",
                provider="replicate",
                is_timeout=True,
            )
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 401:
                msg = "Replicate API key is invalid or expired"
            elif status == 422:
                msg = "Replicate rejected the request. Check model and parameters."
            else:
                msg = f"Replicate returned error: {status}"
            raise AIProviderError(msg, provider="replicate")

    async def _poll_prediction(self, client: httpx.AsyncClient, prediction_id: str) -> str:
        """Poll Replicate prediction until complete. Returns output URL."""
        for _ in range(240):  # 120s at 0.5s intervals
            await asyncio.sleep(0.5)
            response = await client.get(
                f"{self.API_BASE}/predictions/{prediction_id}",
                headers=self._headers(),
            )
            response.raise_for_status()
            data = response.json()
            status = data["status"]

            if status == "succeeded":
                output = data.get("output")
                if isinstance(output, list) and output:
                    return output[0]
                elif isinstance(output, str):
                    return output
                raise AIProviderError(
                    "Replicate returned no output image", provider="replicate"
                )
            elif status == "failed":
                error = data.get("error", "Unknown error")
                raise AIProviderError(
                    f"Replicate generation failed: {error}", provider="replicate"
                )

        raise AIProviderError(
            "Replicate generation did not complete within timeout",
            provider="replicate",
            is_timeout=True,
        )
