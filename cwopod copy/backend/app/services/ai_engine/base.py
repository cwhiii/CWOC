"""AI Engine base classes: provider interface, errors, and result types."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


class AIProviderError(Exception):
    """Raised when an AI provider request fails."""

    def __init__(self, message: str, provider: str, is_timeout: bool = False):
        self.message = message
        self.provider = provider
        self.is_timeout = is_timeout
        super().__init__(message)


@dataclass
class AIResult:
    """Structured result from an AI generation request."""

    success: bool
    data: str | bytes | None = None
    error: str | None = None
    provider_used: str | None = None
    can_retry: bool = True
    can_fallback_local: bool = True


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    @abstractmethod
    async def generate_text(
        self, prompt: str, system_prompt: str = "", max_tokens: int = 2048
    ) -> str:
        """Generate text from a prompt.

        Returns generated text as a string.
        Raises AIProviderError on failure or NotImplementedError if unsupported.
        """
        ...

    @abstractmethod
    async def generate_image(
        self, prompt: str, width: int = 1600, height: int = 2400
    ) -> bytes:
        """Generate an image from a prompt.

        Returns image data as bytes (PNG format).
        Raises AIProviderError on failure or NotImplementedError if unsupported.
        """
        ...
