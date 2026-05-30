# Technical Design Document

## Overview

The AI Engine module provides a unified abstraction layer over multiple AI providers for text and image generation within C.W.'s O-POD. It routes requests to the appropriate provider based on per-user configuration, handles timeouts and errors gracefully, and stores API keys securely using Fernet encryption. The module is designed with a plugin-style provider interface so that new AI services can be added without modifying the core routing logic.

The module integrates with the existing backend infrastructure: FastAPI for API endpoints, SQLAlchemy for persistence, and the shared encryption utility (`app/utils/encryption.py`) for secure key storage.

## Architecture

The AI Engine follows a strategy pattern where the AIRouter selects the appropriate provider implementation based on user configuration and task type. All providers implement a common interface, making them interchangeable from the caller's perspective.

```
┌─────────────────────────────────────────────────────────────┐
│              Calling Code (Cover Service, Quality Controller) │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       AIRouter                               │
│  - Reads user AIConfig from database                        │
│  - Selects provider based on task type + config             │
│  - Decrypts API key at request time                         │
│  - Enforces timeouts (30s text, 120s image)                 │
│  - Returns structured result or error with retry/fallback   │
└────┬──────────┬──────────┬──────────┬──────────┬────────────┘
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
│ Ollama │ │ComfyUI │ │ OpenAI │ │Anthropic│ │ Replicate  │
│Provider│ │Provider│ │Provider│ │Provider │ │ Provider   │
│(local) │ │(local) │ │(ext)   │ │(ext)    │ │ (ext)      │
│text    │ │image   │ │text+img│ │text     │ │ image      │
└────────┘ └────────┘ └────────┘ └────────┘ └────────────┘
```

## Components and Interfaces

### AIProvider (Abstract Base Class)

The common interface that all providers implement. A provider may support text generation, image generation, or both.

```python
from abc import ABC, abstractmethod


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    @abstractmethod
    async def generate_text(
        self, prompt: str, system_prompt: str = "", max_tokens: int = 2048
    ) -> str:
        """Generate text from a prompt.

        Args:
            prompt: The user prompt / instruction.
            system_prompt: Optional system-level instruction for the model.
            max_tokens: Maximum number of tokens to generate.

        Returns:
            Generated text as a string.

        Raises:
            AIProviderError: On timeout, network failure, or provider error.
            NotImplementedError: If this provider does not support text generation.
        """
        ...

    @abstractmethod
    async def generate_image(
        self, prompt: str, width: int = 1600, height: int = 2400
    ) -> bytes:
        """Generate an image from a prompt.

        Args:
            prompt: Description of the image to generate.
            width: Image width in pixels.
            height: Image height in pixels.

        Returns:
            Image data as bytes (PNG format).

        Raises:
            AIProviderError: On timeout, network failure, or provider error.
            NotImplementedError: If this provider does not support image generation.
        """
        ...
```

### AIRouter

The central orchestrator that determines which provider to use and manages the request lifecycle.

```python
class AIRouter:
    """Routes AI requests to the appropriate provider based on user config."""

    def __init__(self, db_session, user_id: UUID):
        self.db_session = db_session
        self.user_id = user_id

    async def generate_text(
        self, prompt: str, system_prompt: str = "", max_tokens: int = 2048
    ) -> AIResult:
        """Route a text generation request to the configured provider."""
        ...

    async def generate_image(
        self, prompt: str, width: int = 1600, height: int = 2400
    ) -> AIResult:
        """Route an image generation request to the configured provider."""
        ...

    def _get_provider(self, task_type: str, config: AIConfig) -> AIProvider:
        """Resolve the provider instance for the given task type."""
        ...
```

**AIResult** is a structured response:

```python
@dataclass
class AIResult:
    success: bool
    data: str | bytes | None  # text string or image bytes
    error: str | None = None
    provider_used: str | None = None
    can_retry: bool = True
    can_fallback_local: bool = True
```

### OllamaProvider

Local text generation via the Ollama HTTP API.

```python
class OllamaProvider(AIProvider):
    """Local text generation using Ollama."""

    def __init__(self, base_url: str = "http://ollama:11434", model: str = "llama3"):
        self.base_url = base_url
        self.model = model

    async def generate_text(self, prompt, system_prompt="", max_tokens=2048) -> str:
        # POST {base_url}/api/generate
        # Body: {"model": self.model, "prompt": prompt, "system": system_prompt}
        # Timeout: 30 seconds
        ...

    async def generate_image(self, prompt, width=1600, height=2400) -> bytes:
        raise NotImplementedError("OllamaProvider does not support image generation")
```

- Connects to Ollama's REST API at the configured URL (default: `http://ollama:11434`)
- Uses the `/api/generate` endpoint with non-streaming mode for simplicity
- Model is configurable per user (defaults to system-configured model)

### ComfyUIProvider

Local image generation via the ComfyUI HTTP API.

```python
class ComfyUIProvider(AIProvider):
    """Local image generation using ComfyUI."""

    def __init__(self, base_url: str = "http://comfyui:8188", workflow: str = "cover_art"):
        self.base_url = base_url
        self.workflow = workflow

    async def generate_text(self, prompt, system_prompt="", max_tokens=2048) -> str:
        raise NotImplementedError("ComfyUIProvider does not support text generation")

    async def generate_image(self, prompt, width=1600, height=2400) -> bytes:
        # POST {base_url}/prompt with workflow JSON
        # Poll {base_url}/history/{prompt_id} until complete
        # GET {base_url}/view?filename={output} to retrieve image
        # Timeout: 120 seconds total
        ...
```

- Submits a workflow JSON to ComfyUI's `/prompt` endpoint
- Polls for completion via the `/history` endpoint
- Retrieves the generated image via the `/view` endpoint
- Workflow templates are stored as JSON files, parameterized with prompt, width, and height

### OpenAIProvider

External text generation (GPT-4o) and image generation (DALL-E 3).

```python
class OpenAIProvider(AIProvider):
    """External text and image generation using OpenAI API."""

    def __init__(self, api_key: str, text_model: str = "gpt-4o", image_model: str = "dall-e-3"):
        self.api_key = api_key
        self.text_model = text_model
        self.image_model = image_model

    async def generate_text(self, prompt, system_prompt="", max_tokens=2048) -> str:
        # POST https://api.openai.com/v1/chat/completions
        # Headers: Authorization: Bearer {api_key}
        # Body: {"model": "gpt-4o", "messages": [...], "max_tokens": max_tokens}
        # Timeout: 30 seconds
        ...

    async def generate_image(self, prompt, width=1600, height=2400) -> bytes:
        # POST https://api.openai.com/v1/images/generations
        # Body: {"model": "dall-e-3", "prompt": prompt, "size": "1024x1792", ...}
        # Timeout: 120 seconds
        # Note: DALL-E 3 has fixed sizes; closest match selected
        ...
```

- Uses the OpenAI Chat Completions API for text
- Uses the OpenAI Images API for image generation
- DALL-E 3 supports fixed sizes (1024×1024, 1024×1792, 1792×1024); the closest match to requested dimensions is selected

### AnthropicProvider

External text generation using Claude.

```python
class AnthropicProvider(AIProvider):
    """External text generation using Anthropic Claude API."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.api_key = api_key
        self.model = model

    async def generate_text(self, prompt, system_prompt="", max_tokens=2048) -> str:
        # POST https://api.anthropic.com/v1/messages
        # Headers: x-api-key: {api_key}, anthropic-version: 2023-06-01
        # Body: {"model": model, "messages": [...], "system": system_prompt, "max_tokens": max_tokens}
        # Timeout: 30 seconds
        ...

    async def generate_image(self, prompt, width=1600, height=2400) -> bytes:
        raise NotImplementedError("AnthropicProvider does not support image generation")
```

- Uses the Anthropic Messages API
- Only supports text generation; image requests raise NotImplementedError

### ReplicateProvider

External image generation via Replicate API.

```python
class ReplicateProvider(AIProvider):
    """External image generation using Replicate API."""

    def __init__(self, api_key: str, model: str = "black-forest-labs/flux-1.1-pro"):
        self.api_key = api_key
        self.model = model

    async def generate_text(self, prompt, system_prompt="", max_tokens=2048) -> str:
        raise NotImplementedError("ReplicateProvider does not support text generation")

    async def generate_image(self, prompt, width=1600, height=2400) -> bytes:
        # POST https://api.replicate.com/v1/predictions
        # Headers: Authorization: Bearer {api_key}
        # Body: {"model": model, "input": {"prompt": prompt, "width": width, "height": height}}
        # Poll GET /v1/predictions/{id} until status is "succeeded"
        # Download output image URL
        # Timeout: 120 seconds total
        ...
```

- Creates a prediction via the Replicate API
- Polls for completion and downloads the resulting image
- Supports configurable model (defaults to Flux 1.1 Pro)

### Provider Registry

```python
PROVIDER_REGISTRY = {
    "text": {
        "local": OllamaProvider,
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
    },
    "image": {
        "local": ComfyUIProvider,
        "openai": OpenAIProvider,
        "replicate": ReplicateProvider,
    },
}
```

New providers are added by implementing `AIProvider` and registering in this dict.

### API Endpoints

#### GET /api/user/ai-config

Returns the current user's AI configuration (without decrypted keys).

```json
{
  "text_provider": "local",
  "text_model": null,
  "text_api_key_set": false,
  "image_provider": "openai",
  "image_model": "dall-e-3",
  "image_api_key_set": true
}
```

- `*_api_key_set` is a boolean indicating whether a key is stored (never returns the actual key)

#### PATCH /api/user/ai-config

Updates the user's AI configuration. Supports partial updates.

```json
{
  "text_provider": "anthropic",
  "text_api_key": "sk-ant-...",
  "text_model": "claude-sonnet-4-20250514",
  "image_provider": "local",
  "image_api_key": null
}
```

- Setting `*_api_key` to `null` clears the stored key
- Setting `*_api_key` to a string value encrypts and stores it
- Validates: key is non-empty string, max 256 characters
- Returns 422 with validation error details on invalid input

## Data Models

### AIConfig (SQLAlchemy Model)

```python
class AIConfig(Base, TimestampMixin, UserScopedMixin):
    __tablename__ = "ai_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    text_provider: Mapped[str] = mapped_column(String(50), default="local")
    text_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    image_provider: Mapped[str] = mapped_column(String(50), default="local")
    image_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
```

### Pydantic Schemas

```python
class AIConfigResponse(BaseModel):
    text_provider: str
    text_model: str | None
    text_api_key_set: bool
    image_provider: str
    image_model: str | None
    image_api_key_set: bool


class AIConfigUpdate(BaseModel):
    text_provider: str | None = None
    text_api_key: str | None = None  # plaintext, will be encrypted before storage
    text_model: str | None = None
    image_provider: str | None = None
    image_api_key: str | None = None  # plaintext, will be encrypted before storage
    image_model: str | None = None

    @field_validator("text_api_key", "image_api_key")
    @classmethod
    def validate_api_key(cls, v):
        if v is not None and v != "":
            if len(v) > 256:
                raise ValueError("API key must not exceed 256 characters")
        return v

    @field_validator("text_provider")
    @classmethod
    def validate_text_provider(cls, v):
        if v is not None and v not in ("local", "openai", "anthropic"):
            raise ValueError("text_provider must be one of: local, openai, anthropic")
        return v

    @field_validator("image_provider")
    @classmethod
    def validate_image_provider(cls, v):
        if v is not None and v not in ("local", "openai", "replicate"):
            raise ValueError("image_provider must be one of: local, openai, replicate")
        return v
```

### AIProviderError

```python
class AIProviderError(Exception):
    """Raised when an AI provider request fails."""

    def __init__(self, message: str, provider: str, is_timeout: bool = False):
        self.message = message
        self.provider = provider
        self.is_timeout = is_timeout
        super().__init__(message)
```

## Correctness Properties

### Property 1: Local Default Routing

When a user has no external API key configured for a task type, the AIRouter must always route to the local provider (Ollama for text, ComfyUI for images). No request should be sent to an external provider without an explicit user configuration.

**Validates: Requirements 1.1, 1.2**

### Property 2: Independent Task Configuration

Changing the provider configuration for text generation must not affect image generation routing, and vice versa. The two task types are fully independent in their provider selection.

**Validates: Requirements 2.1, 2.2, 2.5, 2.6**

### Property 3: API Key Boundary Validation

Every API key submitted through the PATCH endpoint must be validated as a non-empty string of at most 256 characters before being persisted. Invalid keys must be rejected without modifying the stored configuration.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: Timeout Enforcement

Every text generation request must complete or abort within 30 seconds. Every image generation request must complete or abort within 120 seconds. No request may exceed its timeout regardless of provider.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 5: No Automatic Provider Switching

When a provider fails (timeout or error), the system must report the failure and offer retry/fallback options but must never automatically route the request to a different provider without explicit user action.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 6: Key Isolation and Encryption

API keys must be encrypted at rest using Fernet encryption with a per-user derived key. Decrypted keys must only exist in memory during the scope of a single request. No API endpoint may return a decrypted key. One user's keys must never be accessible to another user.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 7: Provider Interface Consistency

All providers must implement the same `generate_text` and `generate_image` interface. Providers that do not support a task type must raise `NotImplementedError`. The AIRouter must never call a method on a provider that does not support the requested task type.

**Validates: Requirements 7.1, 7.2, 7.3**

## Error Handling

### Timeout Errors

- Text generation requests that exceed 30 seconds are aborted via `httpx` timeout configuration
- Image generation requests that exceed 120 seconds are aborted similarly
- Timeout errors are wrapped in `AIProviderError(is_timeout=True)` and surfaced to the caller
- The AIRouter returns an `AIResult` with `success=False`, the error message, and `can_retry=True` + `can_fallback_local=True`

### Provider Errors

- HTTP 4xx errors (invalid key, rate limit, bad request) are captured and reported with the provider's error message
- HTTP 5xx errors (provider outage) are reported as transient failures with retry option
- Network errors (connection refused, DNS failure) indicate the provider is unreachable
- All errors include the provider name and a human-readable failure reason

### Configuration Errors

- Invalid provider names in PATCH requests return 422 with allowed values
- Invalid API key format returns 422 with specific validation error
- Attempting to use an external provider without a configured key returns an error suggesting the user configure their key or fall back to local

### Local Provider Unavailability

- If Ollama or ComfyUI is not running (connection refused), the error message indicates the local service is unavailable
- The system suggests checking that the local AI services are running (relevant for self-hosted deployments)

## Testing Strategy

### Unit Tests

- **AIRouter tests:** Verify correct provider selection based on various AIConfig states (local default, external configured, mixed configurations)
- **Provider tests:** Each provider tested with mocked HTTP responses (success, timeout, error cases)
- **Validation tests:** Verify API key validation rules (empty, too long, valid)
- **Encryption tests:** Verify keys are encrypted before storage and decrypted correctly at use time

### Mock Providers

A `MockProvider` implementing `AIProvider` is used in all tests outside the AI Engine module:

```python
class MockTextProvider(AIProvider):
    async def generate_text(self, prompt, system_prompt="", max_tokens=2048) -> str:
        return "Mock generated text response"

    async def generate_image(self, prompt, width=1600, height=2400) -> bytes:
        raise NotImplementedError

class MockImageProvider(AIProvider):
    async def generate_text(self, prompt, system_prompt="", max_tokens=2048) -> str:
        raise NotImplementedError

    async def generate_image(self, prompt, width=1600, height=2400) -> bytes:
        return b"\x89PNG..."  # minimal PNG bytes
```

### Integration Tests

- **Config endpoint tests:** Verify GET/PATCH /api/user/ai-config with authenticated requests
- **User isolation tests:** Verify user A cannot read or modify user B's AI config
- **Round-trip encryption tests:** Store a key via PATCH, verify it's encrypted in DB, verify it decrypts correctly when used by the router
- **Timeout simulation tests:** Use `httpx` mock to simulate slow responses and verify timeout enforcement

### Test Configuration

Tests use environment variables to point at mock services:
- `OLLAMA_URL=http://mock-ollama:11434`
- `COMFYUI_URL=http://mock-comfyui:8188`
- External provider tests mock HTTP calls via `respx` or `httpx.MockTransport`
