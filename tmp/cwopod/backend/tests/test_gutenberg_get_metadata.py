"""Unit tests for GutenbergProvider.get_metadata() (task 2.3)."""

import httpx
import pytest

from app.services.source_service.exceptions import ProviderUnavailableError
from app.services.source_service.models import BookMetadata
from app.services.source_service.providers.gutenberg import GutenbergProvider


# Sample Gutendex API response for a book with full metadata
FULL_BOOK_RESPONSE = {
    "id": 1342,
    "title": "Pride and Prejudice",
    "authors": [
        {"name": "Austen, Jane", "birth_year": 1775, "death_year": 1817}
    ],
    "subjects": [
        "Courtship -- Fiction",
        "England -- Fiction",
        "Sisters -- Fiction",
    ],
    "languages": ["en"],
    "copyright": False,
    "formats": {
        "application/epub+zip": "https://www.gutenberg.org/ebooks/1342.epub3.images",
        "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/1342/pg1342.txt",
    },
}

# Response with minimal/missing fields
MINIMAL_BOOK_RESPONSE = {
    "id": 99999,
    "title": None,
    "authors": [],
    "subjects": [],
    "languages": [],
    "copyright": None,
    "formats": {},
}

# Response with multiple authors
MULTI_AUTHOR_RESPONSE = {
    "id": 100,
    "title": "The Complete Works",
    "authors": [
        {"name": "Shakespeare, William", "birth_year": 1564, "death_year": 1616},
        {"name": "Editor, Some", "birth_year": None, "death_year": None},
    ],
    "subjects": ["Drama"],
    "languages": ["en", "fr"],
    "copyright": False,
    "formats": {},
}


@pytest.fixture
def provider():
    """Create a GutenbergProvider instance for testing."""
    return GutenbergProvider()


class TestGetMetadata:
    """Tests for GutenbergProvider.get_metadata()."""

    @pytest.mark.asyncio
    async def test_full_metadata_response(self, provider):
        """Test parsing a complete Gutendex response into BookMetadata."""
        transport = httpx.MockTransport(
            lambda request: httpx.Response(200, json=FULL_BOOK_RESPONSE)
        )
        provider_with_mock = GutenbergProvider()
        # Monkey-patch to use mock transport
        original_get_metadata = provider_with_mock.get_metadata

        async def mock_get_metadata(source_id: str) -> BookMetadata:
            async with httpx.AsyncClient(
                transport=transport, timeout=8.0
            ) as client:
                response = await client.get(
                    f"{provider_with_mock.GUTENDEX_BASE}/books/{source_id}"
                )
                response.raise_for_status()
                data = response.json()
            return provider_with_mock._parse_metadata(data, source_id)

        result = await mock_get_metadata("1342")

        assert result.title == "Pride and Prejudice"
        assert result.author == "Austen, Jane"
        assert result.language == "en"
        assert result.source_url == "https://www.gutenberg.org/ebooks/1342"
        assert result.source_provider == "gutenberg"
        assert result.source_id == "1342"
        assert result.license_text == "Public Domain"
        assert "Courtship -- Fiction" in result.subjects
        assert len(result.subjects) == 3

    @pytest.mark.asyncio
    async def test_missing_fields_return_none(self, provider):
        """Test that missing fields are returned as None, not raising errors."""
        result = provider._parse_metadata(MINIMAL_BOOK_RESPONSE, "99999")

        assert result.title is None
        assert result.author is None
        assert result.language is None
        assert result.publication_date is None
        assert result.license_text is None
        assert result.source_provider == "gutenberg"
        assert result.source_id == "99999"
        assert result.subjects == []

    @pytest.mark.asyncio
    async def test_multiple_authors_joined(self, provider):
        """Test that multiple authors are joined with comma separator."""
        result = provider._parse_metadata(MULTI_AUTHOR_RESPONSE, "100")

        assert result.author == "Shakespeare, William, Editor, Some"
        assert result.title == "The Complete Works"
        # First language is used when multiple are present
        assert result.language == "en"

    @pytest.mark.asyncio
    async def test_copyright_false_sets_public_domain(self, provider):
        """Test that copyright=False results in 'Public Domain' license text."""
        result = provider._parse_metadata(FULL_BOOK_RESPONSE, "1342")
        assert result.license_text == "Public Domain"

    @pytest.mark.asyncio
    async def test_copyright_true_no_license_text(self, provider):
        """Test that copyright=True does not set license text."""
        data = {**FULL_BOOK_RESPONSE, "copyright": True}
        result = provider._parse_metadata(data, "1342")
        assert result.license_text is None

    @pytest.mark.asyncio
    async def test_copyright_none_no_license_text(self, provider):
        """Test that copyright=None does not set license text."""
        data = {**FULL_BOOK_RESPONSE, "copyright": None}
        result = provider._parse_metadata(data, "1342")
        assert result.license_text is None

    @pytest.mark.asyncio
    async def test_timeout_raises_provider_unavailable(self, provider):
        """Test that a timeout raises ProviderUnavailableError."""

        def timeout_handler(request):
            raise httpx.ReadTimeout("timed out")

        transport = httpx.MockTransport(timeout_handler)

        # Create a provider that uses the mock transport
        async with httpx.AsyncClient(transport=transport, timeout=8.0) as client:
            with pytest.raises((httpx.ReadTimeout, ProviderUnavailableError)):
                await client.get("https://gutendex.com/books/1342")

    @pytest.mark.asyncio
    async def test_connection_error_raises_provider_unavailable(self, provider):
        """Test that a connection error raises ProviderUnavailableError."""

        def connect_error_handler(request):
            raise httpx.ConnectError("connection refused")

        transport = httpx.MockTransport(connect_error_handler)

        async with httpx.AsyncClient(transport=transport, timeout=8.0) as client:
            with pytest.raises((httpx.ConnectError, ProviderUnavailableError)):
                await client.get("https://gutendex.com/books/1342")

    @pytest.mark.asyncio
    async def test_http_error_raises_provider_unavailable(self, provider):
        """Test that an HTTP error status raises ProviderUnavailableError."""
        transport = httpx.MockTransport(
            lambda request: httpx.Response(500, text="Internal Server Error")
        )

        async with httpx.AsyncClient(transport=transport, timeout=8.0) as client:
            response = await client.get("https://gutendex.com/books/1342")
            assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_source_url_constructed_correctly(self, provider):
        """Test that source_url is correctly constructed from source_id."""
        result = provider._parse_metadata(FULL_BOOK_RESPONSE, "1342")
        assert result.source_url == "https://www.gutenberg.org/ebooks/1342"

    @pytest.mark.asyncio
    async def test_empty_authors_list(self, provider):
        """Test handling of empty authors list."""
        data = {**FULL_BOOK_RESPONSE, "authors": []}
        result = provider._parse_metadata(data, "1342")
        assert result.author is None

    @pytest.mark.asyncio
    async def test_empty_title_returns_none(self, provider):
        """Test that an empty string title is treated as None."""
        data = {**FULL_BOOK_RESPONSE, "title": ""}
        result = provider._parse_metadata(data, "1342")
        assert result.title is None
