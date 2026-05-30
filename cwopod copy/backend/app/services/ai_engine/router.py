"""AI Engine router: selects provider based on user config and manages requests."""

import asyncio
import logging
from typing import Callable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.ai_config import AIConfig
from app.models.system_settings import SystemSettings
from app.services.ai_engine.base import AIProvider, AIProviderError, AIResult
from app.services.ai_engine.registry import PROVIDER_REGISTRY
from app.utils.encryption import decrypt_value

logger = logging.getLogger(__name__)

# Timeout constants (seconds)
TEXT_TIMEOUT = 150  # Per-call timeout — task-level timeout (120s) is the real guard


class AIRouter:
    """Routes AI requests to the appropriate provider based on user config."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

    async def generate_text(
        self, prompt: str, system_prompt: str = "", max_tokens: int = 2048,
        on_token: Callable[[int], None] | None = None,
    ) -> AIResult:
        """Route a text generation request to the configured provider.

        If on_token is provided and the provider is local (Ollama), uses streaming
        mode and calls on_token(token_count) as tokens arrive.
        """
        config = await self._get_config()
        system_defaults = await self._get_system_defaults()
        provider_name = config.text_provider if config else "local"

        try:
            provider = self._get_provider("text", config, system_defaults)

            # Use streaming for local provider when on_token callback is provided
            if on_token and provider_name == "local" and hasattr(provider, "generate_text_streaming"):
                text = await asyncio.wait_for(
                    provider.generate_text_streaming(prompt, system_prompt, max_tokens, on_token=on_token),
                    timeout=TEXT_TIMEOUT,
                )
            else:
                text = await asyncio.wait_for(
                    provider.generate_text(prompt, system_prompt, max_tokens),
                    timeout=TEXT_TIMEOUT,
                )
            return AIResult(
                success=True,
                data=text,
                provider_used=provider_name,
            )
        except asyncio.TimeoutError:
            return AIResult(
                success=False,
                error=f"Text generation timed out after {TEXT_TIMEOUT} seconds (provider: {provider_name})",
                provider_used=provider_name,
                can_retry=True,
                can_fallback_local=provider_name != "local",
            )
        except NotImplementedError:
            return AIResult(
                success=False,
                error=f"Provider '{provider_name}' does not support text generation",
                provider_used=provider_name,
                can_retry=False,
                can_fallback_local=provider_name != "local",
            )
        except AIProviderError as e:
            return AIResult(
                success=False,
                error=f"{e.provider}: {e.message}",
                provider_used=e.provider,
                can_retry=True,
                can_fallback_local=provider_name != "local",
            )
        except Exception as e:
            return AIResult(
                success=False,
                error=f"{provider_name}: {str(e)}",
                provider_used=provider_name,
                can_retry=True,
                can_fallback_local=provider_name != "local",
            )

    async def generate_image(
        self, prompt: str, width: int = 1600, height: int = 2400
    ) -> AIResult:
        """Route an image generation request to the configured provider."""
        config = await self._get_config()
        system_defaults = await self._get_system_defaults()
        provider_name = config.image_provider if config else "local"

        try:
            provider = self._get_provider("image", config, system_defaults)
            # No outer timeout — the ComfyUI provider has its own progress-aware
            # polling that will die if ComfyUI stalls.  A hard ceiling here would
            # kill legitimate long-running generations on slow hardware.
            image_bytes = await provider.generate_image(prompt, width, height)
            return AIResult(
                success=True,
                data=image_bytes,
                provider_used=provider_name,
            )
        except asyncio.TimeoutError:
            return AIResult(
                success=False,
                error=f"Image generation timed out (provider: {provider_name})",
                provider_used=provider_name,
                can_retry=True,
                can_fallback_local=provider_name != "local",
            )
        except NotImplementedError:
            return AIResult(
                success=False,
                error=f"Provider '{provider_name}' does not support image generation",
                provider_used=provider_name,
                can_retry=False,
                can_fallback_local=provider_name != "local",
            )
        except AIProviderError as e:
            return AIResult(
                success=False,
                error=f"{e.provider}: {e.message}",
                provider_used=e.provider,
                can_retry=True,
                can_fallback_local=provider_name != "local",
            )
        except Exception as e:
            return AIResult(
                success=False,
                error=f"{provider_name}: {str(e)}",
                provider_used=provider_name,
                can_retry=True,
                can_fallback_local=provider_name != "local",
            )

    async def _get_config(self) -> AIConfig | None:
        """Load the user's AI configuration from the database."""
        result = await self.db.execute(
            select(AIConfig).where(AIConfig.user_id == self.user_id)
        )
        return result.scalar_one_or_none()

    async def _get_system_defaults(self) -> SystemSettings | None:
        """Load system-wide default model settings."""
        result = await self.db.execute(select(SystemSettings).limit(1))
        return result.scalar_one_or_none()

    def _get_provider(self, task_type: str, config: AIConfig | None, system_defaults: SystemSettings | None = None) -> AIProvider:
        """Resolve the provider instance for the given task type using PROVIDER_REGISTRY.

        Args:
            task_type: Either "text" or "image".
            config: The user's AIConfig, or None for defaults.
            system_defaults: System-wide settings with default model names.

        Returns:
            An instantiated AIProvider ready to handle requests.
        """
        if task_type == "text":
            provider_name = config.text_provider if config else "local"
            model = (config.text_model if config and config.text_model else None)
            encrypted_key = (config.text_api_key_encrypted if config else None)
        else:
            provider_name = config.image_provider if config else "local"
            model = (config.image_model if config and config.image_model else None)
            encrypted_key = (config.image_api_key_encrypted if config else None)

        # Look up provider class from registry, fall back to local if not found
        task_providers = PROVIDER_REGISTRY.get(task_type, {})
        provider_class = task_providers.get(provider_name)
        if provider_class is None:
            # Unknown provider name — fall back to local
            provider_class = task_providers.get("local")
            provider_name = "local"

        # Instantiate the provider with appropriate arguments
        if provider_name == "local":
            return self._create_local_provider(task_type, model, system_defaults)

        # External provider — decrypt API key
        api_key = self._decrypt_key(encrypted_key)
        return self._create_external_provider(
            provider_class, task_type, api_key, model
        )

    def _create_local_provider(self, task_type: str, model: str | None, system_defaults: SystemSettings | None = None) -> AIProvider:
        """Create a local provider instance (Ollama or ComfyUI).

        Uses system defaults from admin settings when user hasn't specified a model.
        """
        if task_type == "text":
            from app.services.ai_engine.providers.ollama import OllamaProvider

            default_model = "mistral:7b"
            if system_defaults and system_defaults.default_text_model:
                default_model = system_defaults.default_text_model
            resolved_model = model or default_model
            logger.debug("_create_local_provider: text model=%s (user=%s, system_default=%s)", resolved_model, model, default_model)

            return OllamaProvider(
                base_url=settings.ollama_url or "http://ollama:11434",
                model=resolved_model,
            )
        else:
            from app.services.ai_engine.providers.comfyui import ComfyUIProvider

            default_model = "v1-5-pruned-emaonly.safetensors"
            if system_defaults and system_defaults.default_image_model:
                default_model = system_defaults.default_image_model
            resolved_model = model or default_model
            logger.debug("_create_local_provider: image model=%s (user=%s, system_default=%s)", resolved_model, model, default_model)

            return ComfyUIProvider(
                base_url=settings.comfyui_url or "http://comfyui:8188",
                model=resolved_model,
            )

    def _create_external_provider(
        self,
        provider_class: type,
        task_type: str,
        api_key: str,
        model: str | None,
    ) -> AIProvider:
        """Create an external provider instance with the decrypted API key."""
        from app.services.ai_engine.providers.anthropic import AnthropicProvider
        from app.services.ai_engine.providers.openai import OpenAIProvider
        from app.services.ai_engine.providers.replicate import ReplicateProvider

        if provider_class is OpenAIProvider:
            if task_type == "text":
                return OpenAIProvider(
                    api_key=api_key,
                    text_model=model or "gpt-4o",
                )
            else:
                return OpenAIProvider(
                    api_key=api_key,
                    image_model=model or "dall-e-3",
                )
        elif provider_class is AnthropicProvider:
            return AnthropicProvider(
                api_key=api_key,
                model=model or "claude-sonnet-4-20250514",
            )
        elif provider_class is ReplicateProvider:
            return ReplicateProvider(
                api_key=api_key,
                model=model or "black-forest-labs/flux-1.1-pro",
            )
        else:
            # Fallback: try to instantiate with api_key
            return provider_class(api_key=api_key)

    def _decrypt_key(self, encrypted_key: str | None) -> str:
        """Decrypt an API key using the user's ID as salt.

        Returns empty string if no key is stored or decryption fails.
        """
        if not encrypted_key:
            return ""
        try:
            return decrypt_value(encrypted_key, str(self.user_id))
        except Exception:
            return ""
