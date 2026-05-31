"""Custom exceptions for the source service module."""


class ProviderUnavailableError(Exception):
    """Raised when a source provider cannot be reached."""

    def __init__(self, provider: str, message: str):
        self.provider = provider
        self.message = message
        super().__init__(f"{provider}: {message}")


class DownloadError(Exception):
    """Raised when a download fails after retries."""

    def __init__(self, provider: str, message: str):
        self.provider = provider
        self.message = message
        super().__init__(f"{provider}: {message}")


class ValidationError(Exception):
    """Raised when file validation fails (format, size, or content issues)."""

    def __init__(self, message: str, error_code: str = "VALIDATION_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(message)


class StorageError(Exception):
    """Raised when a storage operation fails (disk full, permission denied, etc.)."""

    def __init__(self, message: str, error_code: str = "STORAGE_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(message)


class NormalizationError(Exception):
    """Raised when Pandoc format normalization fails."""

    def __init__(self, message: str, stderr: str = ""):
        self.message = message
        self.stderr = stderr
        super().__init__(message)
