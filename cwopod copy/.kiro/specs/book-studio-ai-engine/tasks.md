# Implementation Plan: AI Engine Module

## Overview

This plan covers the implementation of the AI Engine module, which provides a unified abstraction layer over local (Ollama, ComfyUI) and external (OpenAI, Anthropic, Replicate) AI providers for text and image generation. The module includes provider routing, per-user configuration with encrypted key storage, timeout enforcement, and error handling.

Technology: Python/FastAPI, httpx for async HTTP, SQLAlchemy for persistence, Fernet for encryption, pytest for testing.

## Tasks

- [x] 1. Define AIProvider abstract base class and AIRouter
  - [x] 1.1 Create AIProvider ABC with generate_text and generate_image abstract methods
    - Create `backend/app/services/ai_engine/__init__.py`
    - Create `backend/app/services/ai_engine/base.py` with `AIProvider` ABC defining `generate_text(prompt, system_prompt, max_tokens) -> str` and `generate_image(prompt, width, height) -> bytes`
    - Create `AIProviderError` exception class with message, provider name, and is_timeout flag
    - Create `AIResult` dataclass with success, data, error, provider_used, can_retry, can_fallback_local fields
    - _Requirements: 7.1, 7.2_

  - [x] 1.2 Create AIRouter with provider resolution and timeout enforcement
    - Create `backend/app/services/ai_engine/router.py` with `AIRouter` class
    - Implement `_get_provider(task_type, config)` that resolves provider from PROVIDER_REGISTRY based on user's AIConfig
    - Implement `generate_text()` that loads user config, resolves provider, decrypts API key if needed, calls provider with 30s timeout, returns AIResult
    - Implement `generate_image()` that loads user config, resolves provider, decrypts API key if needed, calls provider with 120s timeout, returns AIResult
    - Handle AIProviderError and return structured AIResult with retry/fallback options (never auto-switch)
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4_

  - [x] 1.3 Create provider registry
    - Create `backend/app/services/ai_engine/registry.py` with PROVIDER_REGISTRY dict mapping task_type + provider_name to provider classes
    - Register: text → {local: OllamaProvider, openai: OpenAIProvider, anthropic: AnthropicProvider}
    - Register: image → {local: ComfyUIProvider, openai: OpenAIProvider, replicate: ReplicateProvider}
    - _Requirements: 7.3_

- [x] 2. Implement OllamaProvider
  - [x] 2.1 Create OllamaProvider class with generate_text implementation
    - Create `backend/app/services/ai_engine/providers/ollama.py`
    - Implement `generate_text()` using httpx async POST to `{base_url}/api/generate` with model, prompt, and system fields
    - Configure 30-second timeout on the httpx client
    - Parse response JSON and return generated text
    - Raise `AIProviderError` on timeout (httpx.TimeoutException) or HTTP errors
    - Implement `generate_image()` to raise NotImplementedError
    - Read base_url from settings.OLLAMA_URL (default: http://ollama:11434)
    - _Requirements: 1.1, 1.3, 4.1, 4.3_

- [x] 3. Implement ComfyUIProvider
  - [x] 3.1 Create ComfyUIProvider class with generate_image implementation
    - Create `backend/app/services/ai_engine/providers/comfyui.py`
    - Implement `generate_image()` using httpx async: POST workflow to `{base_url}/prompt`, poll `{base_url}/history/{prompt_id}` for completion, GET `{base_url}/view?filename={output}` for image bytes
    - Configure 120-second total timeout across the polling loop
    - Create a workflow template JSON parameterized with prompt, width, height
    - Raise `AIProviderError` on timeout or HTTP errors
    - Implement `generate_text()` to raise NotImplementedError
    - Read base_url from settings.COMFYUI_URL (default: http://comfyui:8188)
    - _Requirements: 1.2, 1.4, 4.2, 4.4_

- [x] 4. Implement OpenAIProvider
  - [x] 4.1 Create OpenAIProvider class with generate_text and generate_image
    - Create `backend/app/services/ai_engine/providers/openai.py`
    - Implement `generate_text()` using httpx async POST to `https://api.openai.com/v1/chat/completions` with Authorization Bearer header, model gpt-4o, messages array, max_tokens
    - Implement `generate_image()` using httpx async POST to `https://api.openai.com/v1/images/generations` with model dall-e-3, prompt, and closest supported size (1024x1792 for portrait)
    - Download the generated image from the returned URL
    - Configure 30s timeout for text, 120s timeout for image
    - Raise `AIProviderError` on timeout, auth errors (401), rate limits (429), or other HTTP errors
    - _Requirements: 2.3, 2.4, 4.1, 4.2_

- [x] 5. Implement AnthropicProvider
  - [x] 5.1 Create AnthropicProvider class with generate_text implementation
    - Create `backend/app/services/ai_engine/providers/anthropic.py`
    - Implement `generate_text()` using httpx async POST to `https://api.anthropic.com/v1/messages` with x-api-key header, anthropic-version header, model, messages, system, max_tokens
    - Configure 30-second timeout
    - Parse response to extract text content from the messages response format
    - Raise `AIProviderError` on timeout, auth errors, or HTTP errors
    - Implement `generate_image()` to raise NotImplementedError
    - _Requirements: 2.3, 4.1, 4.3_

- [x] 6. Implement ReplicateProvider
  - [x] 6.1 Create ReplicateProvider class with generate_image implementation
    - Create `backend/app/services/ai_engine/providers/replicate.py`
    - Implement `generate_image()` using httpx async: POST to `https://api.replicate.com/v1/predictions` with Authorization Bearer header, model, and input (prompt, width, height)
    - Poll GET `https://api.replicate.com/v1/predictions/{id}` until status is "succeeded" or "failed"
    - Download the output image from the returned URL
    - Configure 120-second total timeout across creation + polling + download
    - Raise `AIProviderError` on timeout, auth errors, or generation failures
    - Implement `generate_text()` to raise NotImplementedError
    - _Requirements: 2.4, 4.2, 4.4_

- [x] 7. Implement AI config endpoints (GET/PATCH)
  - [x] 7.1 Create AI config router with GET /api/user/ai-config endpoint
    - Create `backend/app/routers/ai_config.py` with FastAPI router
    - Implement GET endpoint that loads the authenticated user's AIConfig from database
    - Return AIConfigResponse schema with provider names, model names, and boolean `*_api_key_set` flags (never return actual keys)
    - If no AIConfig exists for the user, return defaults (text_provider: "local", image_provider: "local", no keys set)
    - Require authentication via session middleware
    - _Requirements: 7.4, 6.4_

  - [x] 7.2 Create PATCH /api/user/ai-config endpoint with validation
    - Implement PATCH endpoint accepting AIConfigUpdate schema (partial updates)
    - Validate API keys: reject empty strings and strings exceeding 256 characters with 422 response
    - Validate provider names: reject unknown providers with 422 response listing valid options
    - Encrypt API keys using `encrypt_value(key, user_salt)` from shared encryption utility before storing
    - Setting api_key to null clears the stored encrypted key
    - Create AIConfig record if none exists for the user (upsert behavior)
    - Return updated AIConfigResponse
    - _Requirements: 3.1, 3.2, 3.3, 6.1, 6.2, 7.4_

  - [x] 7.3 Register AI config router in FastAPI app
    - Add the ai_config router to the FastAPI application in `backend/app/main.py`
    - Ensure the router is protected by the auth middleware
    - _Requirements: 7.4_

- [x] 8. Implement timeout and error handling
  - [x] 8.1 Add timeout configuration to all provider HTTP calls
    - Ensure all httpx clients in providers use `httpx.Timeout(timeout=30.0)` for text providers
    - Ensure all httpx clients in providers use `httpx.Timeout(timeout=120.0)` for image providers
    - Catch `httpx.TimeoutException` and wrap in `AIProviderError(is_timeout=True)`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 8.2 Implement structured error responses in AIRouter
    - On AIProviderError, construct AIResult with success=False, error message including provider name and failure reason
    - Set can_retry=True for all failures (timeout, network, server errors)
    - Set can_fallback_local=True when the failed provider is external (not already local)
    - Set can_fallback_local=False when the failed provider is already local
    - Never automatically retry or switch providers
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 8.3 Handle missing local provider gracefully
    - When Ollama or ComfyUI is unreachable (connection refused), return AIResult with clear error message: "Local AI service (Ollama/ComfyUI) is not available. Ensure the service is running."
    - Set can_retry=True, can_fallback_local=False (already attempted local)
    - _Requirements: 5.1_

- [x] 9. Write unit tests with mock providers
  - [x] 9.1 Write AIRouter unit tests
    - Test: routes to OllamaProvider when text_provider is "local" (no key configured)
    - Test: routes to ComfyUIProvider when image_provider is "local" (no key configured)
    - Test: routes to OpenAIProvider when text_provider is "openai" and key is configured
    - Test: routes to AnthropicProvider when text_provider is "anthropic" and key is configured
    - Test: routes to ReplicateProvider when image_provider is "replicate" and key is configured
    - Test: changing text provider does not affect image provider routing
    - Test: changing image provider does not affect text provider routing
    - Test: returns AIResult with error on provider failure (no auto-switch)
    - Test: returns AIResult with can_fallback_local=True for external provider failures
    - _Requirements: 1.1, 1.2, 2.5, 2.6, 5.4_

  - [x] 9.2 Write provider unit tests with mocked HTTP
    - Test OllamaProvider: successful text generation with mocked HTTP response
    - Test OllamaProvider: timeout raises AIProviderError(is_timeout=True)
    - Test OllamaProvider: generate_image raises NotImplementedError
    - Test ComfyUIProvider: successful image generation with mocked polling workflow
    - Test ComfyUIProvider: timeout during polling raises AIProviderError(is_timeout=True)
    - Test ComfyUIProvider: generate_text raises NotImplementedError
    - Test OpenAIProvider: successful text generation
    - Test OpenAIProvider: successful image generation
    - Test OpenAIProvider: 401 error raises AIProviderError with auth message
    - Test AnthropicProvider: successful text generation
    - Test AnthropicProvider: generate_image raises NotImplementedError
    - Test ReplicateProvider: successful image generation with polling
    - Test ReplicateProvider: generate_text raises NotImplementedError
    - Use respx or httpx.MockTransport for HTTP mocking
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.1, 7.2_

  - [x] 9.3 Write validation unit tests
    - Test: API key with 256 characters passes validation
    - Test: API key with 257 characters fails validation
    - Test: empty string API key fails validation
    - Test: null API key (clearing) passes validation
    - Test: invalid provider name fails validation
    - Test: valid provider names pass validation
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 10. Write integration tests for config endpoints
  - [x] 10.1 Write GET /api/user/ai-config integration tests
    - Test: returns default config (local/local, no keys) for new user
    - Test: returns stored config after PATCH
    - Test: api_key_set flags correctly reflect stored key presence
    - Test: never returns actual API key values in response
    - Test: requires authentication (401 without session)
    - Test: user A cannot see user B's config
    - _Requirements: 6.3, 6.4, 7.4_

  - [x] 10.2 Write PATCH /api/user/ai-config integration tests
    - Test: successfully updates text_provider and stores encrypted key
    - Test: successfully updates image_provider independently
    - Test: partial update only modifies specified fields
    - Test: setting api_key to null clears the stored key
    - Test: rejects API key exceeding 256 characters with 422
    - Test: rejects empty API key with 422
    - Test: rejects invalid provider name with 422
    - Test: creates AIConfig on first PATCH for user (upsert)
    - Test: requires authentication (401 without session)
    - Test: encrypted key in database is not plaintext
    - _Requirements: 3.1, 3.2, 3.3, 6.1, 6.2, 6.4_

## Notes

- All HTTP calls use `httpx.AsyncClient` for async compatibility with FastAPI
- Provider implementations are intentionally thin wrappers around HTTP calls — business logic lives in the AIRouter
- The existing `app/utils/encryption.py` (Fernet-based) is reused for key encryption; no new encryption code needed
- The existing `app/models/ai_config.py` SQLAlchemy model is already defined and matches the design
- Tests should use `pytest-asyncio` for async test support and `respx` for HTTP mocking
- The AIRouter is instantiated per-request with the current user's ID and database session

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["7.1", "7.2"] },
    { "id": 4, "tasks": ["7.3", "8.1", "8.2", "8.3"] },
    { "id": 5, "tasks": ["9.1", "9.2", "9.3"] },
    { "id": 6, "tasks": ["10.1", "10.2"] }
  ]
}
```
