"""Unit tests for StandardEbooksProvider.download() (task 3.2).

Tests cover:
- Successful EPUB download from acquisition link
- Metadata extraction (title, author, published date, language, source URL)
- 30-second download timeout
- Retry logic: 3 attempts with exponential backoff for transient errors
- High-quality flag for downstream typo-skip default
- DownloadError raised on failure after retries
- Non-retryable client errors (4xx) fail immediately
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services.source_service.exceptions import DownloadError
from app.services.source_service.models import BookMetadata, SourceDocument
from app.services.source_service.providers.standard_ebooks import (
    StandardEbooksProvider,
)


# Sample OPDS feed XML with entries for testing
SAMPLE_OPDS_FEED = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:dc="http://purl.org/dc/terms/"
      xmlns:opds="http://opds-spec.org/2010/catalog">
  <title>Standard Ebooks</title>
  <entry>
    <title>Pride and Prejudice</title>
    <id>https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice</id>
    <author><name>Jane Austen</name></author>
    <dc:language>en</dc:language>
    <dc:issued>1813-01-28</dc:issued>
    <published>2014-05-25T00:00:00Z</published>
    <category term="Fiction"/>
    <category term="Romance"/>
    <link rel="http://opds-spec.org/acquisition" href="/ebooks/jane-austen/pride-and-prejudice/downloads/jane-austen_pride-and-prejudice.epub" type="application/epub+zip"/>
  </entry>
  <entry>
    <title>No EPUB Entry</title>
    <id>https://standardebooks.org/ebooks/test/no-epub</id>
    <author><name>Test Author</name></author>
    <dc:language>fr</dc:language>
    <published>2020-01-01T00:00:00Z</published>
  </entry>
</feed>
"""

SAMPLE_EPUB_CONTENT = b"PK\x03\x04fake epub content for standard ebooks"


@pytest.fixture
def provider():
    """Create a StandardEbooksProvider with pre-cached catalog."""
    p = StandardEbooksProvider(timeout=8.0)
    # Pre-populate the cache to avoid HTTP calls during tests
    p._catalog_cache = p._parse_opds_feed(SAMPLE_OPDS_FEED)
    p._cache_expires = datetime.utcnow() + timedelta(hours=24)
    return p


class TestDownloadSuccess:
    """Tests for successful download scenarios."""

    @pytest.mark.asyncio
    async def test_downloads_epub_from_acquisition_link(self, provider):
        """Successfully downloads EPUB content from the acquisition link."""
        transport = httpx.MockTransport(
            lambda request: httpx.Response(200, content=SAMPLE_EPUB_CONTENT)
        )

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            result = await provider.download("jane-austen/pride-and-prejudice")
            assert isinstance(result, SourceDocument)
            assert result.content == SAMPLE_EPUB_CONTENT
            assert result.format == "epub"
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_extracts_metadata_from_opds_entry(self, provider):
        """Metadata is correctly extracted from the OPDS catalog entry."""
        transport = httpx.MockTransport(
            lambda request: httpx.Response(200, content=SAMPLE_EPUB_CONTENT)
        )

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            result = await provider.download("jane-austen/pride-and-prejudice")
            metadata = result.metadata

            assert metadata.title == "Pride and Prejudice"
            assert metadata.author == "Jane Austen"
            assert metadata.publication_date == "1813-01-28"
            assert metadata.language == "en"
            assert metadata.source_url == "https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice"
            assert metadata.source_provider == "standard_ebooks"
            assert metadata.source_id == "jane-austen/pride-and-prejudice"
            assert "Fiction" in metadata.subjects
            assert "Romance" in metadata.subjects
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_high_quality_flag(self, provider):
        """Provider is flagged as high-quality for downstream typo-skip default."""
        assert provider.is_high_quality is True

    @pytest.mark.asyncio
    async def test_download_uses_correct_url(self, provider):
        """Download requests the correct EPUB acquisition URL."""
        requested_urls = []

        def handler(request):
            requested_urls.append(str(request.url))
            return httpx.Response(200, content=SAMPLE_EPUB_CONTENT)

        transport = httpx.MockTransport(handler)

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            await provider.download("jane-austen/pride-and-prejudice")
            assert len(requested_urls) == 1
            assert "jane-austen_pride-and-prejudice.epub" in requested_urls[0]
            assert requested_urls[0].startswith("https://standardebooks.org")
        finally:
            httpx.AsyncClient.__init__ = original_init


class TestDownloadRetryLogic:
    """Tests for retry logic with exponential backoff."""

    @pytest.mark.asyncio
    async def test_retries_on_timeout(self, provider):
        """Retries on timeout and succeeds on later attempt."""
        call_count = 0

        def handler(request):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise httpx.ReadTimeout("timed out")
            return httpx.Response(200, content=SAMPLE_EPUB_CONTENT)

        transport = httpx.MockTransport(handler)

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            result = await provider.download("jane-austen/pride-and-prejudice")
            assert result.content == SAMPLE_EPUB_CONTENT
            assert call_count == 3
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_retries_on_connect_error(self, provider):
        """Retries on connection error and succeeds on later attempt."""
        call_count = 0

        def handler(request):
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise httpx.ConnectError("connection refused")
            return httpx.Response(200, content=SAMPLE_EPUB_CONTENT)

        transport = httpx.MockTransport(handler)

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            result = await provider.download("jane-austen/pride-and-prejudice")
            assert result.content == SAMPLE_EPUB_CONTENT
            assert call_count == 2
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_retries_on_server_error_5xx(self, provider):
        """Retries on 5xx server errors and succeeds on later attempt."""
        call_count = 0

        def handler(request):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return httpx.Response(503, text="Service Unavailable")
            return httpx.Response(200, content=SAMPLE_EPUB_CONTENT)

        transport = httpx.MockTransport(handler)

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            result = await provider.download("jane-austen/pride-and-prejudice")
            assert result.content == SAMPLE_EPUB_CONTENT
            assert call_count == 3
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_raises_after_all_retries_exhausted(self, provider):
        """Raises DownloadError after all 3 retry attempts fail."""
        call_count = 0

        def handler(request):
            nonlocal call_count
            call_count += 1
            raise httpx.ReadTimeout("timed out")

        transport = httpx.MockTransport(handler)

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            with pytest.raises(DownloadError) as exc_info:
                await provider.download("jane-austen/pride-and-prejudice")
            assert "after 3 attempts" in str(exc_info.value)
            assert call_count == 3
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_does_not_retry_on_client_error_4xx(self, provider):
        """Does not retry on 4xx client errors, raises immediately."""
        call_count = 0

        def handler(request):
            nonlocal call_count
            call_count += 1
            return httpx.Response(404, text="Not Found")

        transport = httpx.MockTransport(handler)

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            with pytest.raises(DownloadError) as exc_info:
                await provider.download("jane-austen/pride-and-prejudice")
            assert "HTTP 404" in str(exc_info.value)
            assert call_count == 1  # No retries for client errors
        finally:
            httpx.AsyncClient.__init__ = original_init


class TestDownloadErrors:
    """Tests for error conditions."""

    @pytest.mark.asyncio
    async def test_raises_when_book_not_in_catalog(self, provider):
        """Raises DownloadError when source_id is not found in catalog."""
        with pytest.raises(DownloadError) as exc_info:
            await provider.download("nonexistent/book-id")
        assert "not found in catalog" in str(exc_info.value)
        assert exc_info.value.provider == "standard_ebooks"

    @pytest.mark.asyncio
    async def test_raises_when_no_epub_url(self, provider):
        """Raises DownloadError when entry has no EPUB acquisition link."""
        with pytest.raises(DownloadError) as exc_info:
            await provider.download("test/no-epub")
        assert "No EPUB acquisition link" in str(exc_info.value)
        assert exc_info.value.provider == "standard_ebooks"

    @pytest.mark.asyncio
    async def test_download_timeout_is_30_seconds(self, provider):
        """Download uses a 30-second timeout."""
        timeout_used = None

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            nonlocal timeout_used
            timeout_used = kwargs.get("timeout")
            kwargs["transport"] = httpx.MockTransport(
                lambda r: httpx.Response(200, content=SAMPLE_EPUB_CONTENT)
            )
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            await provider.download("jane-austen/pride-and-prejudice")
            assert timeout_used == 30.0
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_error_includes_provider_name(self, provider):
        """DownloadError includes the provider name for identification."""
        with pytest.raises(DownloadError) as exc_info:
            await provider.download("nonexistent/book-id")
        assert exc_info.value.provider == "standard_ebooks"


class TestDownloadMetadataEdgeCases:
    """Tests for metadata extraction edge cases during download."""

    @pytest.mark.asyncio
    async def test_publication_date_from_dcterms_issued(self, provider):
        """publication_date is extracted from dcterms:issued when available."""
        transport = httpx.MockTransport(
            lambda request: httpx.Response(200, content=SAMPLE_EPUB_CONTENT)
        )

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            result = await provider.download("jane-austen/pride-and-prejudice")
            # dcterms:issued = "1813-01-28" takes priority
            assert result.metadata.publication_date == "1813-01-28"
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_source_url_is_identifier(self, provider):
        """source_url is set to the OPDS entry identifier URL."""
        transport = httpx.MockTransport(
            lambda request: httpx.Response(200, content=SAMPLE_EPUB_CONTENT)
        )

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            result = await provider.download("jane-austen/pride-and-prejudice")
            assert result.metadata.source_url == "https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice"
        finally:
            httpx.AsyncClient.__init__ = original_init
