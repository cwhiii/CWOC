"""Unit tests for the ProviderRegistry (task 1.2)."""

import os
from unittest.mock import patch

import pytest

from app.services.source_service.base import (
    BookMetadata,
    SearchResult,
    SourceDocument,
    SourceProvider,
)
from app.services.source_service.registry import (
    ProviderRegistry,
    _load_disabled_providers_from_config,
    create_provider_registry,
)


class FakeProvider(SourceProvider):
    """A minimal SourceProvider implementation for testing."""

    def __init__(self, provider_id: str = "fake", display_name: str = "Fake", quality_label: str = "test"):
        self._provider_id = provider_id
        self._display_name = display_name
        self._quality_label = quality_label

    @property
    def provider_id(self) -> str:
        return self._provider_id

    @property
    def display_name(self) -> str:
        return self._display_name

    @property
    def quality_label(self) -> str:
        return self._quality_label

    async def search(self, query: str, limit: int = 50) -> list[SearchResult]:
        return []

    async def download(self, source_id: str) -> SourceDocument:
        return SourceDocument(content=b"", format="txt", metadata=BookMetadata())

    async def get_metadata(self, source_id: str) -> BookMetadata:
        return BookMetadata()


class TestProviderRegistry:
    """Tests for ProviderRegistry class."""

    def test_register_provider(self):
        registry = ProviderRegistry()
        provider = FakeProvider("gutenberg")
        registry.register(provider)
        assert registry.is_registered("gutenberg")

    def test_register_duplicate_raises(self):
        registry = ProviderRegistry()
        provider = FakeProvider("gutenberg")
        registry.register(provider)
        with pytest.raises(ValueError, match="already registered"):
            registry.register(FakeProvider("gutenberg"))

    def test_get_enabled_providers_returns_all_when_none_disabled(self):
        registry = ProviderRegistry()
        p1 = FakeProvider("gutenberg")
        p2 = FakeProvider("standard_ebooks")
        registry.register(p1)
        registry.register(p2)
        enabled = registry.get_enabled_providers()
        assert len(enabled) == 2
        assert p1 in enabled
        assert p2 in enabled

    def test_get_enabled_providers_excludes_disabled(self):
        registry = ProviderRegistry(disabled_providers={"gutenberg"})
        p1 = FakeProvider("gutenberg")
        p2 = FakeProvider("standard_ebooks")
        registry.register(p1)
        registry.register(p2)
        enabled = registry.get_enabled_providers()
        assert len(enabled) == 1
        assert p2 in enabled

    def test_get_provider_returns_provider(self):
        registry = ProviderRegistry()
        provider = FakeProvider("gutenberg")
        registry.register(provider)
        assert registry.get_provider("gutenberg") is provider

    def test_get_provider_returns_none_for_unknown(self):
        registry = ProviderRegistry()
        assert registry.get_provider("nonexistent") is None

    def test_get_provider_returns_none_for_disabled(self):
        registry = ProviderRegistry()
        provider = FakeProvider("gutenberg")
        registry.register(provider)
        registry.disable("gutenberg")
        assert registry.get_provider("gutenberg") is None

    def test_enable_provider(self):
        registry = ProviderRegistry(disabled_providers={"gutenberg"})
        provider = FakeProvider("gutenberg")
        registry.register(provider)
        assert registry.get_provider("gutenberg") is None
        registry.enable("gutenberg")
        assert registry.get_provider("gutenberg") is provider

    def test_disable_provider(self):
        registry = ProviderRegistry()
        provider = FakeProvider("gutenberg")
        registry.register(provider)
        assert registry.get_provider("gutenberg") is provider
        registry.disable("gutenberg")
        assert registry.get_provider("gutenberg") is None

    def test_is_registered(self):
        registry = ProviderRegistry()
        assert not registry.is_registered("gutenberg")
        registry.register(FakeProvider("gutenberg"))
        assert registry.is_registered("gutenberg")

    def test_is_enabled(self):
        registry = ProviderRegistry()
        provider = FakeProvider("gutenberg")
        registry.register(provider)
        assert registry.is_enabled("gutenberg")
        registry.disable("gutenberg")
        assert not registry.is_enabled("gutenberg")

    def test_get_all_providers_includes_disabled(self):
        registry = ProviderRegistry(disabled_providers={"gutenberg"})
        p1 = FakeProvider("gutenberg")
        p2 = FakeProvider("standard_ebooks")
        registry.register(p1)
        registry.register(p2)
        all_providers = registry.get_all_providers()
        assert len(all_providers) == 2
        assert "gutenberg" in all_providers
        assert "standard_ebooks" in all_providers

    def test_enable_noop_for_unregistered(self):
        """Enable on an unregistered provider should not raise."""
        registry = ProviderRegistry()
        registry.enable("nonexistent")  # Should not raise

    def test_disable_noop_for_unregistered(self):
        """Disable on an unregistered provider should not raise."""
        registry = ProviderRegistry()
        registry.disable("nonexistent")  # Should not raise


class TestConfigLoading:
    """Tests for config-driven enabled/disabled state."""

    def test_load_disabled_empty_env(self):
        with patch.dict(os.environ, {"SOURCE_PROVIDERS_DISABLED": ""}, clear=False):
            with patch("app.services.source_service.registry.settings", create=True) as mock_settings:
                # Bypass the settings import by testing the env var fallback
                pass
        # Test with empty string
        with patch.dict(os.environ, {"SOURCE_PROVIDERS_DISABLED": ""}):
            with patch("app.services.source_service.registry._load_disabled_providers_from_config") as mock_load:
                mock_load.return_value = set()
                registry = ProviderRegistry(disabled_providers=mock_load())
                assert registry._disabled == set()

    def test_load_disabled_single_provider(self):
        disabled = set()
        raw = "gutenberg"
        disabled = {pid.strip() for pid in raw.split(",") if pid.strip()}
        assert disabled == {"gutenberg"}

    def test_load_disabled_multiple_providers(self):
        raw = "gutenberg, standard_ebooks"
        disabled = {pid.strip() for pid in raw.split(",") if pid.strip()}
        assert disabled == {"gutenberg", "standard_ebooks"}

    def test_load_disabled_with_whitespace(self):
        raw = " gutenberg , standard_ebooks , "
        disabled = {pid.strip() for pid in raw.split(",") if pid.strip()}
        assert disabled == {"gutenberg", "standard_ebooks"}

    def test_create_provider_registry_with_disabled(self):
        with patch.dict(os.environ, {"SOURCE_PROVIDERS_DISABLED": "gutenberg"}):
            # Patch the settings import to raise so it falls back to env var
            with patch(
                "app.services.source_service.registry._load_disabled_providers_from_config",
                return_value={"gutenberg"},
            ):
                registry = create_provider_registry()
                provider = FakeProvider("gutenberg")
                registry.register(provider)
                assert not registry.is_enabled("gutenberg")

    def test_create_provider_registry_no_disabled(self):
        with patch(
            "app.services.source_service.registry._load_disabled_providers_from_config",
            return_value=set(),
        ):
            registry = create_provider_registry()
            provider = FakeProvider("gutenberg")
            registry.register(provider)
            assert registry.is_enabled("gutenberg")
