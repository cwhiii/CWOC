"""Unit tests for AIConfigUpdate Pydantic model validation.

Validates: Requirements 3.1, 3.2, 3.3
"""

import pytest
from pydantic import ValidationError

from app.routers.ai_config import AIConfigUpdate


class TestApiKeyValidation:
    """Tests for API key length and emptiness validation."""

    def test_api_key_with_256_characters_passes(self):
        """API key at the maximum allowed length (256 chars) should be accepted."""
        key = "a" * 256
        config = AIConfigUpdate(text_api_key=key)
        assert config.text_api_key == key

    def test_api_key_with_257_characters_fails(self):
        """API key exceeding 256 characters should be rejected."""
        key = "a" * 257
        with pytest.raises(ValidationError) as exc_info:
            AIConfigUpdate(text_api_key=key)
        assert "256 characters" in str(exc_info.value)

    def test_empty_string_api_key_fails(self):
        """Empty string API key should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AIConfigUpdate(text_api_key="")
        assert "must not be empty" in str(exc_info.value)

    def test_null_api_key_passes(self):
        """Setting API key to None (clearing) should be accepted."""
        config = AIConfigUpdate(text_api_key=None)
        assert config.text_api_key is None


class TestProviderNameValidation:
    """Tests for provider name validation."""

    def test_invalid_provider_name_fails(self):
        """An unrecognized provider name should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AIConfigUpdate(text_provider="invalid_provider")
        assert "text_provider must be one of" in str(exc_info.value)

    def test_invalid_image_provider_name_fails(self):
        """An unrecognized image provider name should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AIConfigUpdate(image_provider="invalid_provider")
        assert "image_provider must be one of" in str(exc_info.value)

    @pytest.mark.parametrize("provider", ["local", "openai", "anthropic"])
    def test_valid_text_providers_pass(self, provider: str):
        """All valid text provider names should be accepted."""
        config = AIConfigUpdate(text_provider=provider)
        assert config.text_provider == provider

    @pytest.mark.parametrize("provider", ["local", "openai", "replicate"])
    def test_valid_image_providers_pass(self, provider: str):
        """All valid image provider names should be accepted."""
        config = AIConfigUpdate(image_provider=provider)
        assert config.image_provider == provider
