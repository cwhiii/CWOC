"""Unit tests for StandardEbooksProvider.get_metadata() (task 3.3)."""

import pytest

from app.services.source_service.models import BookMetadata
from app.services.source_service.providers.standard_ebooks import (
    StandardEbooksProvider,
)


# Sample OPDS feed XML with a complete entry
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
    <title>A Tale of Two Cities</title>
    <id>https://standardebooks.org/ebooks/charles-dickens/a-tale-of-two-cities</id>
    <author><name>Charles Dickens</name></author>
    <dc:language>en</dc:language>
    <published>2015-01-01T00:00:00Z</published>
    <category term="Fiction"/>
    <category term="Historical"/>
    <link rel="http://opds-spec.org/acquisition" href="/ebooks/charles-dickens/a-tale-of-two-cities/downloads/charles-dickens_a-tale-of-two-cities.epub" type="application/epub+zip"/>
  </entry>
  <entry>
    <title>Minimal Entry</title>
    <id>https://standardebooks.org/ebooks/unknown/minimal</id>
    <author><name>Unknown Author</name></author>
  </entry>
</feed>
"""


@pytest.fixture
def provider():
    """Create a StandardEbooksProvider with pre-cached catalog."""
    p = StandardEbooksProvider(timeout=8.0)
    # Pre-populate the cache to avoid HTTP calls
    from datetime import datetime, timedelta

    p._catalog_cache = p._parse_opds_feed(SAMPLE_OPDS_FEED)
    p._cache_expires = datetime.utcnow() + timedelta(hours=24)
    return p


class TestGetMetadata:
    """Tests for StandardEbooksProvider.get_metadata()."""

    @pytest.mark.asyncio
    async def test_full_metadata_from_catalog(self, provider):
        """Test that get_metadata returns complete BookMetadata for a known book."""
        result = await provider.get_metadata("jane-austen/pride-and-prejudice")

        assert isinstance(result, BookMetadata)
        assert result.title == "Pride and Prejudice"
        assert result.author == "Jane Austen"
        assert result.language == "en"
        assert result.source_provider == "standard_ebooks"
        assert result.source_id == "jane-austen/pride-and-prejudice"
        assert result.source_url == "https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice"
        assert "Fiction" in result.subjects
        assert "Romance" in result.subjects

    @pytest.mark.asyncio
    async def test_publication_date_from_dcterms_issued(self, provider):
        """Test that publication_date is extracted from dcterms:issued when available."""
        result = await provider.get_metadata("jane-austen/pride-and-prejudice")
        # dcterms:issued takes priority over atom:published
        assert result.publication_date == "1813-01-28"

    @pytest.mark.asyncio
    async def test_publication_date_fallback_to_published(self, provider):
        """Test that publication_date falls back to atom:published when dcterms:issued is absent."""
        result = await provider.get_metadata("charles-dickens/a-tale-of-two-cities")
        # No dcterms:issued, so falls back to atom:published
        assert result.publication_date == "2015-01-01T00:00:00Z"

    @pytest.mark.asyncio
    async def test_missing_book_returns_minimal_metadata(self, provider):
        """Test that a non-existent source_id returns minimal BookMetadata gracefully."""
        result = await provider.get_metadata("nonexistent/book-id")

        assert isinstance(result, BookMetadata)
        assert result.title is None
        assert result.author is None
        assert result.publication_date is None
        assert result.language is None
        assert result.source_url is None
        assert result.source_provider == "standard_ebooks"
        assert result.source_id == "nonexistent/book-id"
        assert result.subjects == []

    @pytest.mark.asyncio
    async def test_entry_with_no_publication_date(self, provider):
        """Test graceful handling when entry has no publication date at all."""
        result = await provider.get_metadata("unknown/minimal")
        assert result.publication_date is None

    @pytest.mark.asyncio
    async def test_subjects_extracted(self, provider):
        """Test that subjects are correctly extracted from category elements."""
        result = await provider.get_metadata("charles-dickens/a-tale-of-two-cities")
        assert "Fiction" in result.subjects
        assert "Historical" in result.subjects

    @pytest.mark.asyncio
    async def test_metadata_does_not_include_content(self, provider):
        """Test that get_metadata returns metadata only, not book content."""
        result = await provider.get_metadata("jane-austen/pride-and-prejudice")
        # BookMetadata should not have a content field
        assert not hasattr(result, "content")

    @pytest.mark.asyncio
    async def test_multiple_calls_use_cache(self, provider):
        """Test that multiple get_metadata calls use the cached catalog."""
        result1 = await provider.get_metadata("jane-austen/pride-and-prejudice")
        result2 = await provider.get_metadata("jane-austen/pride-and-prejudice")

        assert result1.title == result2.title
        assert result1.author == result2.author
        # Cache should still be valid
        assert provider._catalog_cache is not None
