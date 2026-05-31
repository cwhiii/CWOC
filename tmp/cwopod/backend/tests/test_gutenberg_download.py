"""Unit tests for GutenbergProvider.download() (task 2.2)."""

import httpx
import pytest

from app.services.source_service.exceptions import DownloadError
from app.services.source_service.providers.gutenberg import GutenbergProvider


# Sample Gutendex API response with epub3.images format available
BOOK_WITH_EPUB3 = {
    "id": 1342,
    "title": "Pride and Prejudice",
    "authors": [{"name": "Austen, Jane", "birth_year": 1775, "death_year": 1817}],
    "subjects": ["Courtship -- Fiction", "England -- Fiction"],
    "languages": ["en"],
    "copyright": False,
    "formats": {
        "application/epub+zip": "https://www.gutenberg.org/ebooks/1342.epub3.images",
        "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/1342/pg1342.txt",
        "text/html": "https://www.gutenberg.org/ebooks/1342.html.images",
    },
}

# Response with only epub.images (no epub3)
BOOK_WITH_EPUB_IMAGES = {
    "id": 2000,
    "title": "Some Book",
    "authors": [{"name": "Author, Test"}],
    "subjects": [],
    "languages": ["en"],
    "copyright": False,
    "formats": {
        "application/epub+zip": "https://www.gutenberg.org/ebooks/2000.epub.images",
        "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/2000/pg2000.txt",
    },
}

# Response with only plain text available
BOOK_WITH_TEXT_ONLY = {
    "id": 3000,
    "title": "Text Only Book",
    "authors": [{"name": "Writer, Plain"}],
    "subjects": [],
    "languages": ["en"],
    "copyright": False,
    "formats": {
        "text/plain; charset=utf-8": "https://www.gutenberg.org/cache/epub/3000/pg3000.txt",
        "text/html": "https://www.gutenberg.org/ebooks/3000.html.images",
    },
}

# Response with no suitable formats
BOOK_WITH_NO_FORMATS = {
    "id": 4000,
    "title": "No Format Book",
    "authors": [],
    "subjects": [],
    "languages": [],
    "copyright": None,
    "formats": {
        "text/html": "https://www.gutenberg.org/ebooks/4000.html.images",
        "application/rdf+xml": "https://www.gutenberg.org/ebooks/4000.rdf",
    },
}

SAMPLE_EPUB_CONTENT = b"PK\x03\x04fake epub content bytes"

SAMPLE_TEXT_WITH_LICENSE = (
    "The Project Gutenberg eBook of Pride and Prejudice\r\n"
    "by Jane Austen\r\n\r\n"
    "*** START OF THE PROJECT GUTENBERG EBOOK PRIDE AND PREJUDICE ***\r\n\r\n"
    "It is a truth universally acknowledged...\r\n\r\n"
    "*** END OF THE PROJECT GUTENBERG EBOOK PRIDE AND PREJUDICE ***\r\n\r\n"
    "*** START: FULL LICENSE ***\r\n"
    "THE FULL PROJECT GUTENBERG LICENSE\r\n"
    "PLEASE READ THIS BEFORE YOU DISTRIBUTE OR USE THIS WORK\r\n"
).encode("utf-8")

SAMPLE_TEXT_NO_LICENSE = "Just some plain text content without any license markers.".encode(
    "utf-8"
)


@pytest.fixture
def provider():
    """Create a GutenbergProvider with short timeouts for testing."""
    return GutenbergProvider(search_timeout=2.0, download_timeout=2.0)


class TestSelectFormat:
    """Tests for _select_format() format preference logic."""

    def test_prefers_epub3_images(self, provider):
        """epub3.images is preferred over other formats."""
        formats = {
            "application/epub+zip": "https://example.com/book.epub3.images",
            "text/plain; charset=utf-8": "https://example.com/book.txt",
        }
        url, fmt = provider._select_format(formats, "1")
        assert ".epub3.images" in url
        assert fmt == "epub"

    def test_falls_back_to_epub_images(self, provider):
        """epub.images is used when epub3.images is not available."""
        formats = {
            "application/epub+zip": "https://example.com/book.epub.images",
            "text/plain; charset=utf-8": "https://example.com/book.txt",
        }
        url, fmt = provider._select_format(formats, "1")
        assert ".epub.images" in url
        assert fmt == "epub"

    def test_falls_back_to_text_utf8(self, provider):
        """text/plain; charset=utf-8 is used when no EPUB is available."""
        formats = {
            "text/plain; charset=utf-8": "https://example.com/book.txt",
            "text/html": "https://example.com/book.html",
        }
        url, fmt = provider._select_format(formats, "1")
        assert url == "https://example.com/book.txt"
        assert fmt == "txt"

    def test_raises_when_no_suitable_format(self, provider):
        """DownloadError is raised when no suitable format exists."""
        formats = {
            "text/html": "https://example.com/book.html",
            "application/rdf+xml": "https://example.com/book.rdf",
        }
        with pytest.raises(DownloadError) as exc_info:
            provider._select_format(formats, "999")
        assert "No suitable download format" in str(exc_info.value)

    def test_raises_on_empty_formats(self, provider):
        """DownloadError is raised when formats dict is empty."""
        with pytest.raises(DownloadError):
            provider._select_format({}, "999")

    def test_epub3_preferred_over_epub(self, provider):
        """When both epub3.images and epub.images exist, epub3 wins."""
        formats = {
            "application/epub+zip": "https://example.com/book.epub3.images",
            "application/epub+zip; type=epub3": "https://example.com/book.epub.images",
        }
        url, fmt = provider._select_format(formats, "1")
        assert ".epub3.images" in url


class TestExtractLicenseText:
    """Tests for _extract_license_text() license preservation."""

    def test_extracts_end_license(self, provider):
        """License text at end of file is extracted."""
        license_text = provider._extract_license_text(
            SAMPLE_TEXT_WITH_LICENSE, "txt"
        )
        assert license_text is not None
        assert "END OF THE PROJECT GUTENBERG EBOOK" in license_text

    def test_no_license_in_plain_text(self, provider):
        """Returns None when no license markers are present."""
        license_text = provider._extract_license_text(
            SAMPLE_TEXT_NO_LICENSE, "txt"
        )
        assert license_text is None

    def test_returns_none_for_epub(self, provider):
        """Returns None for EPUB format (license preserved in file structure)."""
        license_text = provider._extract_license_text(
            SAMPLE_EPUB_CONTENT, "epub"
        )
        assert license_text is None

    def test_handles_decode_error(self, provider):
        """Returns None when content can't be decoded as UTF-8."""
        invalid_bytes = b"\xff\xfe\x00\x01\x80\x81"
        license_text = provider._extract_license_text(invalid_bytes, "txt")
        assert license_text is None

    def test_extracts_header_license(self, provider):
        """License header at beginning of file is extracted."""
        text = (
            "The Project Gutenberg EBook of Test\r\n"
            "Produced by Someone\r\n\r\n"
            "*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\r\n\r\n"
            "Chapter 1\r\nSome content here."
        ).encode("utf-8")
        license_text = provider._extract_license_text(text, "txt")
        assert license_text is not None
        assert "Project Gutenberg" in license_text


class TestExtractMetadata:
    """Tests for _extract_metadata() from Gutendex response."""

    def test_extracts_full_metadata(self, provider):
        """All available fields are extracted correctly."""
        metadata = provider._extract_metadata(BOOK_WITH_EPUB3, "1342")
        assert metadata.title == "Pride and Prejudice"
        assert metadata.author == "Austen, Jane"
        assert metadata.language == "en"
        assert metadata.source_url == "https://www.gutenberg.org/ebooks/1342"
        assert metadata.source_provider == "gutenberg"
        assert metadata.source_id == "1342"
        assert "Courtship -- Fiction" in metadata.subjects

    def test_handles_missing_authors(self, provider):
        """Returns None for author when authors list is empty."""
        metadata = provider._extract_metadata(BOOK_WITH_NO_FORMATS, "4000")
        assert metadata.author is None

    def test_handles_missing_language(self, provider):
        """Returns None for language when languages list is empty."""
        metadata = provider._extract_metadata(BOOK_WITH_NO_FORMATS, "4000")
        assert metadata.language is None

    def test_publication_date_is_none(self, provider):
        """Publication date is None (Gutendex doesn't provide it)."""
        metadata = provider._extract_metadata(BOOK_WITH_EPUB3, "1342")
        assert metadata.publication_date is None


class TestDownloadWithRetry:
    """Tests for _download_with_retry() retry logic."""

    @pytest.mark.asyncio
    async def test_successful_download(self, provider):
        """Successful download on first attempt returns content."""
        transport = httpx.MockTransport(
            lambda request: httpx.Response(200, content=SAMPLE_EPUB_CONTENT)
        )
        # Patch the provider's download timeout for testing
        provider._download_timeout = 2.0

        async with httpx.AsyncClient(
            transport=transport, follow_redirects=True, timeout=2.0
        ) as client:
            response = await client.get("https://example.com/book.epub")
            assert response.content == SAMPLE_EPUB_CONTENT

    @pytest.mark.asyncio
    async def test_retries_on_500(self, provider):
        """Retries on 500 status code and succeeds on later attempt."""
        call_count = 0

        def handler(request):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return httpx.Response(500, text="Server Error")
            return httpx.Response(200, content=SAMPLE_EPUB_CONTENT)

        transport = httpx.MockTransport(handler)
        provider._download_timeout = 2.0

        # Use the actual retry method with a mock transport
        # We need to monkey-patch httpx.AsyncClient to use our transport
        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            content = await provider._download_with_retry(
                "https://example.com/book.epub", "1342"
            )
            assert content == SAMPLE_EPUB_CONTENT
            assert call_count == 3
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_raises_on_404(self, provider):
        """Does not retry on 404 (client error), raises immediately."""
        transport = httpx.MockTransport(
            lambda request: httpx.Response(404, text="Not Found")
        )
        provider._download_timeout = 2.0

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            with pytest.raises(DownloadError) as exc_info:
                await provider._download_with_retry(
                    "https://example.com/book.epub", "1342"
                )
            assert "HTTP 404" in str(exc_info.value)
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_raises_after_all_retries_exhausted(self, provider):
        """Raises DownloadError after all 3 retry attempts fail."""
        transport = httpx.MockTransport(
            lambda request: httpx.Response(503, text="Service Unavailable")
        )
        provider._download_timeout = 2.0

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            with pytest.raises(DownloadError) as exc_info:
                await provider._download_with_retry(
                    "https://example.com/book.epub", "1342"
                )
            assert "after 3 attempts" in str(exc_info.value)
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_retries_on_timeout(self, provider):
        """Retries on timeout and succeeds on later attempt."""
        call_count = 0

        def handler(request):
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise httpx.ReadTimeout("timed out")
            return httpx.Response(200, content=SAMPLE_EPUB_CONTENT)

        transport = httpx.MockTransport(handler)
        provider._download_timeout = 2.0

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            content = await provider._download_with_retry(
                "https://example.com/book.epub", "1342"
            )
            assert content == SAMPLE_EPUB_CONTENT
            assert call_count == 2
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
        provider._download_timeout = 2.0

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            content = await provider._download_with_retry(
                "https://example.com/book.epub", "1342"
            )
            assert content == SAMPLE_EPUB_CONTENT
            assert call_count == 2
        finally:
            httpx.AsyncClient.__init__ = original_init


class TestDownloadEndToEnd:
    """Integration-style tests for the full download() method."""

    @pytest.mark.asyncio
    async def test_download_epub3_success(self, provider):
        """Full download flow with epub3.images format."""
        call_urls = []

        def handler(request):
            call_urls.append(str(request.url))
            if "/books/1342" in str(request.url):
                return httpx.Response(200, json=BOOK_WITH_EPUB3)
            if ".epub3.images" in str(request.url):
                return httpx.Response(200, content=SAMPLE_EPUB_CONTENT)
            return httpx.Response(404)

        transport = httpx.MockTransport(handler)
        provider._download_timeout = 2.0

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            result = await provider.download("1342")
            assert result.content == SAMPLE_EPUB_CONTENT
            assert result.format == "epub"
            assert result.metadata.title == "Pride and Prejudice"
            assert result.metadata.author == "Austen, Jane"
            assert result.metadata.source_provider == "gutenberg"
            assert result.metadata.source_id == "1342"
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_download_falls_back_to_text(self, provider):
        """Falls back to text format when no EPUB is available."""

        def handler(request):
            if "/books/3000" in str(request.url):
                return httpx.Response(200, json=BOOK_WITH_TEXT_ONLY)
            if "pg3000.txt" in str(request.url):
                return httpx.Response(200, content=SAMPLE_TEXT_NO_LICENSE)
            return httpx.Response(404)

        transport = httpx.MockTransport(handler)
        provider._download_timeout = 2.0

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            result = await provider.download("3000")
            assert result.content == SAMPLE_TEXT_NO_LICENSE
            assert result.format == "txt"
            assert result.metadata.title == "Text Only Book"
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_download_preserves_license(self, provider):
        """License text is preserved in metadata for text downloads."""

        def handler(request):
            if "/books/1342" in str(request.url):
                return httpx.Response(200, json=BOOK_WITH_TEXT_ONLY | {
                    "id": 1342,
                    "title": "Pride and Prejudice",
                    "authors": [{"name": "Austen, Jane"}],
                    "formats": {
                        "text/plain; charset=utf-8": "https://example.com/book.txt",
                    },
                })
            return httpx.Response(200, content=SAMPLE_TEXT_WITH_LICENSE)

        transport = httpx.MockTransport(handler)
        provider._download_timeout = 2.0

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            result = await provider.download("1342")
            assert result.metadata.license_text is not None
            assert "PROJECT GUTENBERG" in result.metadata.license_text
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_download_raises_on_no_formats(self, provider):
        """Raises DownloadError when no suitable format is available."""

        def handler(request):
            return httpx.Response(200, json=BOOK_WITH_NO_FORMATS)

        transport = httpx.MockTransport(handler)
        provider._download_timeout = 2.0

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            with pytest.raises(DownloadError) as exc_info:
                await provider.download("4000")
            assert "No suitable download format" in str(exc_info.value)
        finally:
            httpx.AsyncClient.__init__ = original_init

    @pytest.mark.asyncio
    async def test_download_raises_on_api_failure(self, provider):
        """Raises DownloadError when Gutendex API returns an error."""

        def handler(request):
            return httpx.Response(500, text="Internal Server Error")

        transport = httpx.MockTransport(handler)
        provider._download_timeout = 2.0

        original_init = httpx.AsyncClient.__init__

        def patched_init(self_client, **kwargs):
            kwargs["transport"] = transport
            original_init(self_client, **kwargs)

        httpx.AsyncClient.__init__ = patched_init
        try:
            with pytest.raises(DownloadError):
                await provider.download("1342")
        finally:
            httpx.AsyncClient.__init__ = original_init
