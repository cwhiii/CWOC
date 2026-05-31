"""Ollama provider: local text generation via Ollama HTTP API."""

import json
import logging
from typing import Callable

import httpx

from app.services.ai_engine.base import AIProvider, AIProviderError

logger = logging.getLogger(__name__)


class OllamaProvider(AIProvider):
    """Local text generation using Ollama."""

    def __init__(self, base_url: str = "http://ollama:11434", model: str = "llama3"):
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def generate_text(
        self, prompt: str, system_prompt: str = "", max_tokens: int = 2048
    ) -> str:
        """Generate text via Ollama's /api/generate endpoint (non-streaming)."""
        logger.debug(
            "generate_text: model=%s, prompt_len=%d, system_len=%d, max_tokens=%d",
            self.model, len(prompt), len(system_prompt), max_tokens,
        )
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "keep_alive": "30m",
            "options": {"num_predict": max_tokens},
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout=180.0)) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate", json=payload
                )
                response.raise_for_status()
                data = response.json()
                result = data.get("response", "")
                logger.debug("generate_text: completed, response_len=%d", len(result))
                return result
        except httpx.TimeoutException:
            logger.error("generate_text: timed out after 180s, model=%s", self.model)
            raise AIProviderError(
                "Ollama request timed out after 180 seconds. CPU inference can be slow — consider giving the container more RAM or using a smaller model.",
                provider="ollama",
                is_timeout=True,
            )
        except httpx.ConnectError:
            logger.error("generate_text: connection refused, base_url=%s", self.base_url)
            raise AIProviderError(
                "Local AI service (Ollama) is not available. Ensure the service is running.",
                provider="ollama",
            )
        except httpx.HTTPStatusError as e:
            logger.error("generate_text: HTTP error %d", e.response.status_code)
            raise AIProviderError(
                f"Ollama returned error: {e.response.status_code}",
                provider="ollama",
            )

    async def generate_text_streaming(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 2048,
        on_token: Callable[[int], None] | None = None,
    ) -> str:
        """Generate text via Ollama streaming — calls on_token(token_count) as tokens arrive."""
        logger.debug(
            "generate_text_streaming: model=%s, prompt_len=%d, max_tokens=%d",
            self.model, len(prompt), max_tokens,
        )
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": True,
            "keep_alive": "30m",
            "options": {"num_predict": max_tokens},
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            collected = []
            token_count = 0
            # Use a long read timeout (180s) to allow for slow CPU prompt processing,
            # but a short connect timeout (30s) to fail fast if Ollama is unreachable.
            # The "read" timeout covers time waiting for response headers AND body chunks.
            # Ollama holds response headers until the model is loaded and prompt is processed,
            # which on CPU can take a minute or two — hence the generous read timeout.
            timeout = httpx.Timeout(connect=30.0, read=180.0, write=30.0, pool=30.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                # Signal that we're about to start the request (model may need to load/process prompt)
                if on_token:
                    on_token(-1)
                async with client.stream(
                    "POST", f"{self.base_url}/api/generate", json=payload
                ) as response:
                    response.raise_for_status()
                    logger.debug("generate_text_streaming: connection established, streaming tokens...")
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line)
                        except json.JSONDecodeError:
                            logger.debug("generate_text_streaming: skipping non-JSON line")
                            continue

                        token_text = chunk.get("response", "")
                        if token_text:
                            collected.append(token_text)
                            token_count += 1
                            if on_token and token_count % 5 == 0:
                                on_token(token_count)

                        if chunk.get("done", False):
                            break

            result = "".join(collected)
            logger.debug(
                "generate_text_streaming: completed, tokens=%d, response_len=%d",
                token_count, len(result),
            )
            # Final callback with exact count
            if on_token:
                on_token(token_count)
            return result
        except httpx.TimeoutException:
            logger.error("generate_text_streaming: timed out, model=%s", self.model)
            raise AIProviderError(
                "Ollama streaming request timed out after 180s. CPU inference can be slow — the model may still be processing the prompt. Try again (the model should be warmed up now).",
                provider="ollama",
                is_timeout=True,
            )
        except httpx.ConnectError:
            logger.error("generate_text_streaming: connection refused, base_url=%s", self.base_url)
            raise AIProviderError(
                "Local AI service (Ollama) is not available. Ensure the service is running.",
                provider="ollama",
            )
        except httpx.HTTPStatusError as e:
            logger.error("generate_text_streaming: HTTP error %d", e.response.status_code)
            raise AIProviderError(
                f"Ollama returned error: {e.response.status_code}",
                provider="ollama",
            )

    async def generate_image(
        self, prompt: str, width: int = 1600, height: int = 2400
    ) -> bytes:
        raise NotImplementedError("OllamaProvider does not support image generation")
