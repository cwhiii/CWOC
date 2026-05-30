"""Provider registry mapping task types to provider classes."""

from app.services.ai_engine.providers.ollama import OllamaProvider
from app.services.ai_engine.providers.comfyui import ComfyUIProvider
from app.services.ai_engine.providers.openai import OpenAIProvider
from app.services.ai_engine.providers.anthropic import AnthropicProvider
from app.services.ai_engine.providers.replicate import ReplicateProvider

# Maps (task_type, provider_name) to provider class
PROVIDER_REGISTRY: dict[str, dict[str, type]] = {
    "text": {
        "local": OllamaProvider,
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
    },
    "image": {
        "local": ComfyUIProvider,
        "openai": OpenAIProvider,
        "replicate": ReplicateProvider,
    },
}

VALID_TEXT_PROVIDERS = list(PROVIDER_REGISTRY["text"].keys())
VALID_IMAGE_PROVIDERS = list(PROVIDER_REGISTRY["image"].keys())
