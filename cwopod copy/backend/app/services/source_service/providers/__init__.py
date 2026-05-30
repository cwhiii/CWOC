"""Source service provider implementations.

This package contains concrete SourceProvider implementations for each
supported book source:

- GutenbergProvider: Project Gutenberg via Gutendex API
- StandardEbooksProvider: Standard Ebooks via OPDS catalog feed
- UploadProvider: User file uploads (EPUB, DOCX, TXT, PDF)
"""

from .gutenberg import GutenbergProvider
from .standard_ebooks import StandardEbooksProvider
from .upload import UploadProvider

__all__ = [
    "GutenbergProvider",
    "StandardEbooksProvider",
    "UploadProvider",
]
