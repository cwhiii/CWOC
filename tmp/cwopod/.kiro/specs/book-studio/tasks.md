# Implementation Plan: C.W.'s O-POD (Orchestration)

## Overview

This is the top-level orchestration plan for C.W.'s O-POD. Each of the 8 core modules will be implemented as its own independent spec (with its own requirements.md, design.md, and tasks.md). This plan covers shared infrastructure setup, module build order based on dependencies, and final integration testing.

The technology stack is: Python/FastAPI backend, SvelteKit frontend, PostgreSQL, Redis, Celery, Docker Compose.

## Tasks

- [x] 1. Set up shared project infrastructure
  - [x] 1.1 Create project skeleton and Docker Compose stack
    - Create top-level directory structure: `backend/`, `frontend/`, `docker/`, `docs/`
    - Create `docker-compose.yml` with services: app (FastAPI), frontend (SvelteKit/Caddy), db (PostgreSQL 16), redis
    - Create `docker-compose.override.yml` for optional GPU services (ollama, comfyui)
    - Create `.env.example` with all environment variables from design (DATABASE_URL, REDIS_URL, STORAGE_BACKEND, S3_BUCKET, S3_ENDPOINT, OLLAMA_URL, COMFYUI_URL, APP_URL, SECRET_KEY)
    - _Requirements: 13.2_

  - [x] 1.2 Initialize backend project with FastAPI and dependencies
    - Create `backend/pyproject.toml` with dependencies: fastapi, uvicorn, sqlalchemy, alembic, celery, redis, bcrypt, python-jose, pycairo, python-qrcode, pillow, httpx, cryptography
    - Set up FastAPI application entry point with CORS, middleware, and router registration
    - Configure Celery with Redis broker
    - Set up SQLAlchemy async engine and session management
    - _Requirements: 13.1, 13.2_

  - [x] 1.3 Initialize frontend project with SvelteKit
    - Create SvelteKit project in `frontend/` with TypeScript
    - Configure build for static adapter (served by Caddy in production)
    - Set up API client utility for communicating with FastAPI backend
    - Set up base layout with navigation shell
    - _Requirements: 14.1, 14.5_

  - [x] 1.4 Create database schema and migrations
    - Set up Alembic for migrations
    - Create initial migration with all core tables from design: users, sessions, book_projects, corrections, cover_prompts, cover_layouts, print_orders, order_items, ai_configs, provider_credentials
    - Add indexes on user_id + status for all user-scoped tables
    - _Requirements: 13.1, 13.5_

  - [x] 1.5 Set up shared utilities and base classes
    - Create base ORM model with automatic user_id scoping (user isolation at query level)
    - Create Fernet encryption utility for credential storage (derived from SECRET_KEY + user salt)
    - Create shared error handling middleware and exception classes
    - Create shared Celery task base class with status reporting
    - _Requirements: 13.5, 12.6_

- [x] 2. Checkpoint - Verify infrastructure
  - Ensure Docker Compose stack starts successfully (docker compose up)
  - Ensure database migrations run cleanly
  - Ensure FastAPI serves health check endpoint
  - Ensure frontend builds and serves via dev server
  - Ask the user if questions arise.

- [x] 3. Build Module: Auth & Users (no dependencies)
  - [x] 3.1 Create spec at `.kiro/specs/book-studio-auth-users/`
    - Create requirements.md covering: user registration, login/logout, session management (30-min expiry), auth middleware, user profile, data isolation
    - Create design.md with AuthService and UserService components, session-based auth with bcrypt, HTTP-only cookies
    - Create tasks.md with implementation steps for the auth module
    - _Requirements: 13.1, 13.3, 13.4, 13.5, 13.6_

  - [x] 3.2 Implement the auth-users module per its spec
    - Implement all tasks defined in `.kiro/specs/book-studio-auth-users/tasks.md`
    - Deliver: registration endpoint, login/logout, session middleware, user-scoped query base, profile endpoints
    - _Requirements: 13.1, 13.3, 13.4, 13.5, 13.6_

- [x] 4. Build Module: AI Engine (depends on: Auth)
  - [x] 4.1 Create spec at `.kiro/specs/book-studio-ai-engine/`
    - Create requirements.md covering: AI provider abstraction, local model support (Ollama, ComfyUI), external API support (OpenAI, Anthropic, Replicate), per-user config, API key storage, timeout/fallback behavior
    - Create design.md with AIRouter, OllamaProvider, ComfyUIProvider, OpenAIProvider, AnthropicProvider, ReplicateProvider
    - Create tasks.md with implementation steps for the AI engine module
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 4.2 Implement the ai-engine module per its spec
    - Implement all tasks defined in `.kiro/specs/book-studio-ai-engine/tasks.md`
    - Deliver: AIRouter, provider implementations, config endpoints, encrypted key storage, timeout handling
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 5. Build Module: Source Service (depends on: Auth)
  - [x] 5.1 Create spec at `.kiro/specs/book-studio-source-service/`
    - Create requirements.md covering: search across Gutenberg + Standard Ebooks, quality labels, plugin architecture, download with metadata extraction, user uploads (EPUB, DOCX, TXT, PDF), file validation, error handling
    - Create design.md with SourceProvider interface, GutenbergProvider, StandardEbooksProvider, UploadProvider, BookProject model
    - Create tasks.md with implementation steps for the source service module
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 5.2 Implement the source-service module per its spec
    - Implement all tasks defined in `.kiro/specs/book-studio-source-service/tasks.md`
    - Deliver: search API, download/import endpoints, upload endpoint, metadata extraction, provider plugin system
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 6. Checkpoint - Verify foundation modules
  - Ensure auth registration/login flow works end-to-end
  - Ensure AI Engine responds to text and image generation requests (with mocked providers in test)
  - Ensure source search returns results from at least one provider
  - Ensure file upload accepts and processes a test EPUB
  - Ask the user if questions arise.

- [x] 7. Build Module: Quality Controller (depends on: AI Engine, Source Service)
  - [x] 7.1 Create spec at `.kiro/specs/book-studio-quality-controller/`
    - Create requirements.md covering: LLM-based typo scanning, chunked processing, strict typo-only constraints, correction review UI, accept/reject individual and bulk, apply corrections, skip for high-quality sources
    - Create design.md with TypoScanner, CorrectionReview components, system prompts, chunking strategy
    - Create tasks.md with implementation steps for the quality controller module
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 7.2 Implement the quality-controller module per its spec
    - Implement all tasks defined in `.kiro/specs/book-studio-quality-controller/tasks.md`
    - Deliver: typo scan endpoint, corrections list/review endpoints, bulk actions, apply endpoint, original text preservation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 8. Build Module: Typeset Service (depends on: Source Service)
  - [x] 8.1 Create spec at `.kiro/specs/book-studio-typeset-service/`
    - Create requirements.md covering: chapter detection, Typst template rendering, front matter (half-title, title, copyright), Info_Page, Attribution_Page with QR codes, running headers, page numbering, print provider specs, PDF generation as Celery task
    - Create design.md with ChapterDetector, TemplateRenderer, PDFGenerator, QRGenerator components
    - Create tasks.md with implementation steps for the typeset service module
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 8.2 Implement the typeset-service module per its spec
    - Implement all tasks defined in `.kiro/specs/book-studio-typeset-service/tasks.md`
    - Deliver: chapter detection, Typst templates, PDF compilation, QR generation, provider-specific formatting
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [x] 9. Build Module: Cover Service (depends on: AI Engine, Typeset Service)
  - [x] 9.1 Create spec at `.kiro/specs/book-studio-cover-service/`
    - Create requirements.md covering: AI prompt generation (10 prompts, spoiler-free), image generation (1600×2400px), regeneration (up to 20), user image upload, back cover blurb generation, Cover Builder (Fabric.js drag-and-drop), templates (5+), text customization, CMYK PDF output with bleed, spine calculation, back cover layout with QR
    - Create design.md with PromptGenerator, ImageGenerator, BlurbGenerator, CoverAssembler (backend), CoverBuilder (frontend) components
    - Create tasks.md with implementation steps for the cover service module
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 9.2 Implement the cover-service module per its spec
    - Implement all tasks defined in `.kiro/specs/book-studio-cover-service/tasks.md`
    - Deliver: prompt generation, image generation, blurb generation, cover builder frontend, cover assembly backend, template system, print-ready PDF output
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 10. Checkpoint - Verify content pipeline
  - Ensure typo scanning produces corrections for a test document
  - Ensure typesetting generates a valid PDF with correct structure (front matter, chapters, attribution)
  - Ensure cover generation produces images and assembles a cover PDF with correct dimensions
  - Ask the user if questions arise.

- [x] 11. Build Module: Print & Order Service (depends on: Typeset Service, Cover Service)
  - [x] 11.1 Create spec at `.kiro/specs/book-studio-print-order-service/`
    - Create requirements.md covering: Lulu xPress, BookVault, KDP Print adapters, pricing estimates, order submission, order status tracking, ISBN management (Lulu free, user-provided ISBN-13 validation), credential storage, retry logic (3 attempts), KDP manual export
    - Create design.md with PrintProviderAdapter interface, LuluAdapter, BookVaultAdapter, KDPAdapter, ISBNManager components
    - Create tasks.md with implementation steps for the print & order service module
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 11.2 Implement the print-order-service module per its spec
    - Implement all tasks defined in `.kiro/specs/book-studio-print-order-service/tasks.md`
    - Deliver: provider adapters, pricing endpoint, order submission, ISBN management, credential encryption, KDP export package
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 12. Build Module: Collection Manager (depends on: Print & Order Service, all project data)
  - [x] 12.1 Create spec at `.kiro/specs/book-studio-collection-manager/`
    - Create requirements.md covering: bookshelf view (50 per page, pagination), project status display, drag-and-drop reordering with persistence, batch ordering (2-20 books), multi-title shipment (Lulu) vs individual orders, error handling for batch failures
    - Create design.md with BookshelfAPI, BatchOrderService components, project status machine
    - Create tasks.md with implementation steps for the collection manager module
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 12.2 Implement the collection-manager module per its spec
    - Implement all tasks defined in `.kiro/specs/book-studio-collection-manager/tasks.md`
    - Deliver: bookshelf API with pagination, status filtering, drag-and-drop sort persistence, batch order endpoint, frontend bookshelf view
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [x] 13. Build guided workflow and UX shell
  - [x] 13.1 Implement the guided workflow orchestration
    - Create the step-by-step workflow engine in the frontend: source selection → typo correction → typesetting → cover creation → print submission
    - Implement progress indicator showing current step and remaining steps
    - Implement smart defaults at each step so user can advance with one decision per step
    - Implement skip actions for optional steps (typo correction, cover customization)
    - Implement workflow resume: persist completed step outputs, allow resuming from last completed step
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 13.2 Wire all module frontends into the unified SvelteKit app
    - Integrate search/import UI from Source Service
    - Integrate typo review UI from Quality Controller
    - Integrate typeset preview from Typeset Service
    - Integrate Cover Builder from Cover Service
    - Integrate print submission and order tracking from Print & Order Service
    - Integrate bookshelf view from Collection Manager
    - Ensure consistent navigation, auth state, and error handling across all views
    - _Requirements: 14.1, 14.2, 14.5_

- [x] 14. Checkpoint - Verify full workflow
  - Ensure a user can complete the entire happy path: search → select → (skip typo) → typeset → cover → order
  - Ensure workflow resume works after abandoning mid-flow
  - Ensure defaults allow advancing without customization
  - Ask the user if questions arise.

- [x] 15. Integration and end-to-end testing
  - [x] 15.1 Write integration tests for cross-module interactions
    - Test: Source Service output feeds correctly into Quality Controller and Typeset Service
    - Test: AI Engine is called correctly by Quality Controller and Cover Service
    - Test: Typeset Service page count is used by Cover Service for spine calculation
    - Test: Print & Order Service receives valid PDFs from Typeset and Cover services
    - Test: Collection Manager correctly aggregates project status from all modules
    - _Requirements: 14.1, 14.2_

  - [x] 15.2 Write end-to-end tests with Playwright
    - Test full happy path: register → search → select → typeset → cover → order
    - Test user isolation: user A cannot see user B's projects
    - Test session expiry and re-authentication flow
    - Test error recovery: failed AI generation → retry → success
    - Test batch ordering from bookshelf
    - Run against Docker Compose test stack with mocked external APIs
    - _Requirements: 13.1, 13.5, 13.6, 14.1, 14.6_

- [x] 16. Final checkpoint - Full system verification
  - Ensure all integration tests pass
  - Ensure all E2E tests pass against Docker Compose stack
  - Ensure Docker Compose stack starts cleanly from scratch (fresh database, migrations, seed data)
  - Ask the user if questions arise.

## Notes

- Each module (tasks 3-12) will be built as its own independent spec with full requirements.md, design.md, and tasks.md at `.kiro/specs/book-studio-{module-name}/`
- Module build order respects dependency graph: Auth → AI Engine → Source Service → Quality Controller / Typeset Service → Cover Service → Print & Order Service → Collection Manager
- The guided workflow (task 13) ties all modules together into the near-one-click UX
- Checkpoints are placed after infrastructure, after foundation modules, after content pipeline, and after full integration
- All AI provider calls should be mockable for testing — use the AI Engine's provider interface
- Property tests from the design (text integrity, user isolation, cover dimensions, idempotent operations, order atomicity) will be implemented within their respective module specs

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "1.5"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["4.1", "5.1"] },
    { "id": 5, "tasks": ["4.2", "5.2"] },
    { "id": 6, "tasks": ["7.1", "8.1"] },
    { "id": 7, "tasks": ["7.2", "8.2"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2"] },
    { "id": 10, "tasks": ["11.1"] },
    { "id": 11, "tasks": ["11.2"] },
    { "id": 12, "tasks": ["12.1"] },
    { "id": 13, "tasks": ["12.2"] },
    { "id": 14, "tasks": ["13.1", "13.2"] },
    { "id": 15, "tasks": ["15.1", "15.2"] }
  ]
}
```
