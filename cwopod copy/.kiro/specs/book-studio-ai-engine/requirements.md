# Requirements Document

## Introduction

The AI Engine module provides a configurable abstraction layer over local and external AI providers for text generation and image generation within C.W.'s O-POD. It enables the system to use local models (Ollama for text, ComfyUI for images) by default while allowing each user to independently configure external API providers (OpenAI, Anthropic, Replicate) for either or both task types. The module handles provider routing, API key management, timeout enforcement, and error reporting.

## Glossary

- **AI_Engine**: The configurable subsystem providing LLM and image generation capabilities via local models or external API keys
- **AIRouter**: Component that determines which provider to use based on user configuration and task type
- **Provider**: An AI service (local or external) that can generate text or images
- **Task_Type**: Either `text_generation` or `image_generation`, configured independently per user
- **Local_Model**: A self-hosted AI model (Ollama for text, ComfyUI for images) running alongside the application
- **External_Provider**: A third-party AI API service requiring an API key (OpenAI, Anthropic, Replicate)
- **Fernet_Encryption**: Symmetric encryption scheme used for storing API keys at rest, derived from the application SECRET_KEY and a per-user salt

## Requirements

### Requirement 1: Default Local Model Usage

**User Story:** As a user, I want the system to use local AI models by default, so that I can generate text and images without needing external API subscriptions.

#### Acceptance Criteria

1.1 WHEN no external API key is configured for text generation, THE AI_Engine SHALL route all text generation requests to the local Ollama provider

1.2 WHEN no external API key is configured for image generation, THE AI_Engine SHALL route all image generation requests to the local ComfyUI provider

1.3 THE AI_Engine SHALL function for text generation tasks when only Ollama is available and no external text provider is configured

1.4 THE AI_Engine SHALL function for image generation tasks when only ComfyUI is available and no external image provider is configured

### Requirement 2: Per-User External Provider Configuration

**User Story:** As a user, I want to configure my own external API keys for text and image generation independently, so that I can use premium AI services for one task type while keeping local models for the other.

#### Acceptance Criteria

2.1 THE AI_Engine SHALL allow each user to configure an external API key for text generation independently from image generation

2.2 THE AI_Engine SHALL allow each user to configure an external API key for image generation independently from text generation

2.3 THE AI_Engine SHALL support OpenAI and Anthropic as external providers for text generation

2.4 THE AI_Engine SHALL support OpenAI and Replicate as external providers for image generation

2.5 WHEN an external API key is configured for text generation, THE AI_Engine SHALL use the configured external provider for text generation while continuing to use the existing configuration for image generation

2.6 WHEN an external API key is configured for image generation, THE AI_Engine SHALL use the configured external provider for image generation while continuing to use the existing configuration for text generation

### Requirement 3: API Key Validation

**User Story:** As a user, I want the system to validate my API keys before saving them, so that I don't accidentally save invalid configuration.

#### Acceptance Criteria

3.1 WHEN a user submits an API key configuration, THE AI_Engine SHALL validate that the key is a non-empty string before saving

3.2 WHEN a user submits an API key configuration, THE AI_Engine SHALL validate that the key does not exceed 256 characters before saving

3.3 IF a submitted API key is empty or exceeds 256 characters, THEN THE AI_Engine SHALL reject the configuration and return an error message indicating the validation failure

### Requirement 4: Timeout Handling

**User Story:** As a user, I want the system to enforce reasonable timeouts on AI requests, so that I'm not left waiting indefinitely when a provider is unresponsive.

#### Acceptance Criteria

4.1 THE AI_Engine SHALL enforce a maximum timeout of 30 seconds for text generation requests to any provider

4.2 THE AI_Engine SHALL enforce a maximum timeout of 120 seconds for image generation requests to any provider

4.3 IF a text generation request does not complete within 30 seconds, THEN THE AI_Engine SHALL abort the request and report a timeout error to the caller

4.4 IF an image generation request does not complete within 120 seconds, THEN THE AI_Engine SHALL abort the request and report a timeout error to the caller

### Requirement 5: Error Notification and Recovery

**User Story:** As a user, I want to be notified when an AI request fails and given options to retry or fall back to local models, so that I can recover from failures without losing my workflow progress.

#### Acceptance Criteria

5.1 IF a configured AI provider does not respond within the timeout or returns an error, THEN THE AI_Engine SHALL notify the caller with a message indicating the failure reason

5.2 WHEN an AI provider fails, THE AI_Engine SHALL offer the option to retry the request with the same provider

5.3 WHEN an AI provider fails, THE AI_Engine SHALL offer the option to fall back to the local model for the current request

5.4 THE AI_Engine SHALL NOT automatically switch providers on failure without explicit user action

### Requirement 6: Encrypted Key Storage

**User Story:** As a user, I want my API keys stored securely, so that they cannot be read by other users or exposed in plaintext.

#### Acceptance Criteria

6.1 THE AI_Engine SHALL encrypt all API keys before storing them in the database using Fernet symmetric encryption

6.2 THE AI_Engine SHALL derive encryption keys using the application SECRET_KEY combined with a per-user salt

6.3 THE AI_Engine SHALL decrypt API keys only at the moment of use for an AI request and SHALL NOT log or cache decrypted keys

6.4 THE AI_Engine SHALL store API key configurations per user such that no user can access another user's keys through any interface or API endpoint

### Requirement 7: Provider Interface Abstraction

**User Story:** As a developer, I want a consistent interface for all AI providers, so that new providers can be added without modifying the routing or calling code.

#### Acceptance Criteria

7.1 THE AI_Engine SHALL define a common provider interface with a `generate_text(prompt, system_prompt, max_tokens) -> str` method for text generation

7.2 THE AI_Engine SHALL define a common provider interface with a `generate_image(prompt, width, height) -> bytes` method for image generation

7.3 THE AI_Engine SHALL allow new providers to be added by implementing the provider interface without requiring changes to the AIRouter or calling code

7.4 THE AI_Engine SHALL expose AI configuration via GET /api/user/ai-config and PATCH /api/user/ai-config endpoints for reading and updating user AI settings
