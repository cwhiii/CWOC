"""Provider registry: manages source provider plugins.

The registry discovers and loads all registered SourceProvider implementations
at startup. Individual providers can be enabled or disabled via the
SOURCE_PROVIDERS_DISABLED environment variable (comma-separated list of
provider IDs to disable).

Requirements: 2.2, 2.3, 2.5
"""

from __future__ import annotations

import os
from typing import Optional

from .base import SourceProvider


class ProviderRegistry:
    """Registry for source provider plugins. Manages provider lifecycle and discovery.

    Providers are registered via `register()` and can be enabled/disabled at runtime
    or via configuration. Disabled providers are excluded from federated search but
    remain registered (can be re-enabled without re-registering).
    """

    def __init__(self, disabled_providers: Optional[set[str]] = None) -> None:
        self._providers: dict[str, SourceProvider] = {}
        self._disabled: set[str] = disabled_providers if disabled_providers is not None else set()

    def register(self, provider: SourceProvider) -> None:
        """Register a provider instance.

        Raises ValueError if a provider with the same provider_id is already registered.
        """
        if provider.provider_id in self._providers:
            raise ValueError(f"Provider '{provider.provider_id}' already registered")
        self._providers[provider.provider_id] = provider

    def get_enabled_providers(self) -> list[SourceProvider]:
        """Return all currently enabled providers."""
        return [
            p for pid, p in self._providers.items() if pid not in self._disabled
        ]

    def get_provider(self, provider_id: str) -> Optional[SourceProvider]:
        """Get a specific provider by ID. Returns None if not found or disabled."""
        if provider_id in self._disabled:
            return None
        return self._providers.get(provider_id)

    def get_all_providers(self) -> dict[str, SourceProvider]:
        """Return all registered providers (including disabled ones)."""
        return dict(self._providers)

    def is_registered(self, provider_id: str) -> bool:
        """Check if a provider is registered (regardless of enabled/disabled state)."""
        return provider_id in self._providers

    def is_enabled(self, provider_id: str) -> bool:
        """Check if a provider is registered and enabled."""
        return provider_id in self._providers and provider_id not in self._disabled

    def enable(self, provider_id: str) -> None:
        """Enable a provider by ID. No-op if already enabled or not registered."""
        self._disabled.discard(provider_id)

    def disable(self, provider_id: str) -> None:
        """Disable a provider by ID (excluded from search, still registered)."""
        self._disabled.add(provider_id)


def _load_disabled_providers_from_config() -> set[str]:
    """Load the set of disabled provider IDs from configuration.

    Reads the SOURCE_PROVIDERS_DISABLED environment variable (via app settings),
    which should be a comma-separated list of provider IDs to disable.

    Example:
        SOURCE_PROVIDERS_DISABLED=gutenberg,standard_ebooks
    """
    try:
        from app.config import settings
        raw = settings.source_providers_disabled
    except Exception:
        # Fallback to direct env var read if settings aren't available yet
        raw = os.environ.get("SOURCE_PROVIDERS_DISABLED", "")

    if not raw.strip():
        return set()
    return {pid.strip() for pid in raw.split(",") if pid.strip()}


def create_provider_registry() -> ProviderRegistry:
    """Create and configure a ProviderRegistry with config-driven disabled state.

    This factory function reads the SOURCE_PROVIDERS_DISABLED environment variable
    to determine which providers should be disabled at startup.
    """
    disabled = _load_disabled_providers_from_config()
    return ProviderRegistry(disabled_providers=disabled)


# Global registry instance, configured from environment at import time.
provider_registry = create_provider_registry()
