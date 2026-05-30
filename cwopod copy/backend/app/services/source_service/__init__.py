"""Source service module: federated book search, download, and upload.

This module provides a plugin-based architecture for source providers.
Each provider (Gutenberg, Standard Ebooks, user uploads) implements the
SourceProvider interface and is registered in the global provider_registry.

Built-in providers are registered at application startup via
`register_builtin_providers()`.
"""

from .base import SourceProvider
from .exceptions import (
    DownloadError,
    ProviderUnavailableError,
    ValidationError,
)
from .models import (
    BookMetadata,
    ExtractedImage,
    SearchResult,
    SourceDocument,
)
from .registry import ProviderRegistry, provider_registry

__all__ = [
    "BookMetadata",
    "DownloadError",
    "ExtractedImage",
    "ProviderRegistry",
    "ProviderUnavailableError",
    "SearchResult",
    "SourceDocument",
    "SourceProvider",
    "ValidationError",
    "provider_registry",
    "register_builtin_providers",
]


def register_builtin_providers() -> None:
    """Register all built-in source providers with the global registry.

    This function should be called once at application startup (e.g., in the
    FastAPI app module). It imports and registers each built-in provider
    implementation.

    Providers registered here:
    - GutenbergProvider (provider_id: "gutenberg")
    - StandardEbooksProvider (provider_id: "standard_ebooks")

    New providers can be added by:
    1. Creating a new module in `providers/` that implements SourceProvider
    2. Importing and registering it in this function

    The UploadProvider is not registered here as it is not a search provider —
    it handles file uploads directly via the UploadService.
    """
    from .providers.gutenberg import GutenbergProvider
    from .providers.standard_ebooks import StandardEbooksProvider

    if not provider_registry.is_registered("gutenberg"):
        provider_registry.register(GutenbergProvider())

    if not provider_registry.is_registered("standard_ebooks"):
        provider_registry.register(StandardEbooksProvider())
