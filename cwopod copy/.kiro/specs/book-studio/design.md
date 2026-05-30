# Technical Design Document

## Overview

This document describes the technical architecture for C.W.'s O-POD, a multi-user web application that transforms public domain texts into professionally formatted, printed physical books. The design addresses all 14 requirements from the requirements document and provides the blueprint for implementation.

## Architecture

C.W.'s O-POD follows a modular monolith architecture deployed as a single containerized application. The frontend is a single-page application communicating with a Python backend via REST API. Background processing (typesetting, AI generation) is handled by a task queue. All persistent state lives in a PostgreSQL database with file assets stored on disk (or S3-compatible object storage for cloud deployments).

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit SPA)                  │
├────────────┬────────────┬─────────────┬─────────────────────┤
│  Search &  │   Cover    │   Book      │   Bookshelf &       │
│  Import    │   Studio   │   Preview   │   Orders            │
└─────┬──────┴─────┬──────┴──────┬──────┴──────────┬──────────┘
      │            │             │                  │
      ▼            ▼             ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  REST API (FastAPI)                          │
├────────────┬────────────┬─────────────┬─────────────────────┤
│  Source    │  Cover     │  Typeset    │   Print & Order     │
│  Service   │  Service   │  Service    │   Service           │
└─────┬──────┴─────┬──────┴──────┬──────┴──────────┬──────────┘
      │            │             │                  │
      ▼            ▼             ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Shared Infrastructure                           │
├────────────┬────────────┬─────────────┬─────────────────────┤
│  AI Engine │  Task Queue│  Database   │   File Storage      │
│ (Ollama/API)│ (Celery)  │ (PostgreSQL)│   (Local/S3)       │
└────────────┴────────────┴─────────────┴─────────────────────┘
```

## Technology Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | SvelteKit | Lightweight, fast, excellent DX for interactive UIs (cover builder canvas). Compiles to minimal JS. |
| Backend | Python / FastAPI | Async-native, excellent ecosystem for PDF/text processing, AI libraries, and API integrations. |
| Task Queue | Celery + Redis | Handles long-running jobs (typesetting, AI generation) without blocking the API. |
| Database | PostgreSQL | Robust, supports JSONB for flexible metadata, good for multi-tenant isolation. |
| File Storage | Local filesystem (self-hosted) / S3-compatible (cloud) | Configurable via environment variable. Stores PDFs, images, source texts. |
| Typesetting | Pandoc + Typst | Typst preferred over LaTeX for speed and simpler templating. Pandoc handles format conversion. |
| Cover Rendering | PyCairo (backend) + Fabric.js (frontend) | Cairo produces print-ready CMYK PDFs. Fabric.js provides the interactive canvas editor. |
| AI - Text (local) | Ollama | Runs local LLMs, easy to deploy, supports many models. |
| AI - Image (local) | ComfyUI / Stable Diffusion via API | Self-hosted image generation with GPU support. |
| AI - External | OpenAI / Anthropic / Replicate APIs | Configurable per-user as alternative to local. |
| QR Codes | python-qrcode + Pillow | Lightweight, no external dependencies. |
| Auth | Session-based with bcrypt | Simple, secure, no external auth provider dependency. Optional OAuth later. |
| Containerization | Docker / Docker Compose | Single `docker compose up` for full stack including Ollama, Redis, PostgreSQL. |

## Components and Interfaces

### Module 1: Source Service

**Responsibility:** Search, discovery, download, and upload of book texts.
**Addresses:** Requirements 1, 2

#### Components

- **SourceProvider (abstract base):** Interface that all source providers implement.
  - `search(query: str) -> list[SearchResult]`
  - `download(identifier: str) -> SourceDocument`
  - `get_metadata(identifier: str) -> BookMetadata`

- **GutenbergProvider:** Implements SourceProvider for Project Gutenberg.
  - Uses Gutenberg's catalog (available as RDF/XML or via their search endpoint)
  - Downloads `.epub3.images` or `.txt.utf-8` variants
  - Parses metadata from RDF catalog entries

- **StandardEbooksProvider:** Implements SourceProvider for Standard Ebooks.
  - Uses their OPDS catalog feed (Atom/XML)
  - Downloads EPUB with full formatting and illustrations
  - Marks results with "professionally curated" quality label

- **UploadProvider:** Handles user-uploaded documents.
  - Accepts EPUB, DOCX, TXT, PDF
  - Uses Pandoc for format normalization to internal representation
  - Extracts metadata via python-docx, ebooklib, or PyPDF2

#### Data Model

```
BookProject {
  id: UUID
  user_id: UUID
  title: str
  author: str
  source_type: enum (gutenberg, standard_ebooks, upload)
  source_url: str | null
  source_metadata: JSONB  // all available provenance info
  original_text_path: str  // path to stored original
  working_text_path: str   // path after typo corrections
  status: enum (draft, typeset, cover_ready, print_ready, ordered, shipped)
  created_at: timestamp
  updated_at: timestamp
}
```

#### Source Provider Plugin Architecture

New sources are added by:
1. Creating a class implementing `SourceProvider`
2. Registering it in a provider registry (dict mapping)
3. No changes to API routes or frontend search component needed

---

### Module 2: Quality Controller

**Responsibility:** Optional LLM-based typo detection with user review.
**Addresses:** Requirement 3

#### Components

- **TypoScanner:** Sends text chunks to the AI Engine with a strict system prompt constraining output to typo-only suggestions.
  - Chunks text into ~2000-word segments (with overlap for context)
  - System prompt explicitly forbids grammar, style, or meaning changes
  - Returns structured list: `{original, suggested, sentence_context, position}`

- **CorrectionReview:** API endpoints for presenting and resolving corrections.
  - `GET /projects/{id}/corrections` — returns full list
  - `PATCH /projects/{id}/corrections` — accept/reject individual or bulk
  - On confirmation, applies accepted changes to working_text_path

#### Behavior

- Skipped by default for Standard Ebooks sources (configurable)
- Always preserves original_text_path unchanged
- Corrections stored in database for audit trail

---

### Module 3: Typeset Service

**Responsibility:** Convert book text into print-ready interior PDF.
**Addresses:** Requirements 4, 8

#### Components

- **ChapterDetector:** Identifies chapter boundaries in source text.
  - Pattern matching for common formats: "CHAPTER I", "Chapter 1", "I.", numbered headings
  - Falls back to structural markers in EPUB (nav/toc)
  - Returns ordered list of chapter titles and byte offsets

- **TemplateRenderer:** Assembles the full book structure.
  - Generates Typst source from a parameterized template
  - Inserts: Info_Page (front), half-title, title page, copyright page, body chapters, Attribution_Page (back)
  - Calculates page count for spine width

- **PDFGenerator:** Executes Typst compilation.
  - Runs as Celery task (can take 10-60 seconds for long books)
  - Embeds fonts (EB Garamond or similar serif)
  - Validates output against Print_Provider trim size specs

- **QRGenerator:** Creates QR code images for embedding.
  - Source URL QR for Attribution_Page
  - C.W.'s O-POD URL QR for Info_Page and back cover

#### Print Provider Specs (built-in)

```
PROVIDER_SPECS = {
  "lulu": {"trim": "5.5x8.5in", "bleed": "3.175mm", "gutter_min": "16mm", ...},
  "bookvault": {"trim": "5.5x8.5in", "bleed": "3mm", "gutter_min": "15mm", ...},
  "kdp": {"trim": "5.5x8.5in", "bleed": "3.175mm", "gutter_min": "based_on_pages", ...},
}
```

---

### Module 4: Cover Service

**Responsibility:** AI prompt generation, image generation, cover assembly, and back cover copy.
**Addresses:** Requirements 5, 6, 7

#### Components

- **PromptGenerator:** Uses AI Engine to analyze text and produce cover prompts.
  - Sends a condensed summary (first/last chapters excluded from spoiler risk) to LLM
  - System prompt: "Produce 10 image generation prompts for a book cover. Focus on settings, atmosphere, and non-spoiler moments. Each prompt should describe a distinct visual concept."
  - Returns structured list of 10 prompts with brief descriptions

- **ImageGenerator:** Sends prompts to AI Engine for image generation.
  - Requests 1600×2400px minimum
  - Stores generated images in file storage
  - Tracks prompt-to-image mapping for regeneration

- **BlurbGenerator:** Produces spoiler-free back cover copy.
  - System prompt constrains to 100-250 words, no spoilers, enticing tone
  - User can edit result

- **CoverAssembler (backend):** Renders final print-ready cover PDF.
  - Input: front image, back image/color, spine color, text overlays, page count
  - Uses PyCairo for CMYK PDF output
  - Calculates full wrap dimensions: front + spine + back + bleed
  - Spine width formula: `pages * paper_thickness + cover_board_thickness`

- **CoverBuilder (frontend):** Interactive canvas editor.
  - Built with Fabric.js on a Svelte component
  - Drag-and-drop image placement
  - Text overlay with template presets
  - Live preview at correct aspect ratio
  - Sends final layout spec to backend CoverAssembler for PDF rendering

#### Cover Templates (data structure)

```
CoverTemplate {
  id: str
  name: str
  title_position: {x_pct, y_pct, anchor}
  title_style: {font, size_range, color, effects}
  author_position: {x_pct, y_pct, anchor}
  author_style: {font, size_range, color, effects}
  spine_style: {font, color}
  thumbnail: str  // preview image path
}
```

---

### Module 5: Print & Order Service

**Responsibility:** Integration with print-on-demand providers, pricing, ISBN, and order submission.
**Addresses:** Requirements 9, 10

#### Components

- **PrintProviderAdapter (abstract base):**
  - `get_pricing(page_count, trim_size, paper_type) -> PriceEstimate`
  - `submit_order(interior_pdf, cover_pdf, shipping_address, options) -> OrderResult`
  - `get_order_status(order_id) -> OrderStatus`

- **LuluAdapter:** Implements PrintProviderAdapter for Lulu xPress API.
  - OAuth2 authentication with stored credentials
  - Supports multi-title orders (batch shipping)
  - ISBN request via Lulu's API

- **BookVaultAdapter:** Implements PrintProviderAdapter for BookVault API.
  - API key authentication
  - Single-title orders

- **KDPAdapter:** Manual export adapter.
  - Does not submit orders via API
  - Generates a download package (interior PDF + cover PDF + instructions document)
  - Instructions include step-by-step KDP upload guide

- **ISBNManager:**
  - Toggle per project
  - Validates ISBN-13 format (check digit algorithm)
  - Requests free ISBN from Lulu when selected

#### Credential Storage

- API keys/tokens encrypted at rest (Fernet symmetric encryption)
- Decrypted only at request time, never logged
- Per-user isolation enforced at database query level

---

### Module 6: Collection Manager

**Responsibility:** Bookshelf view, project lifecycle, and batch ordering.
**Addresses:** Requirement 11

#### Components

- **BookshelfAPI:** CRUD for book projects with filtering and pagination.
  - `GET /bookshelf?page=1&status=ready_to_print`
  - `PATCH /bookshelf/order` — persist custom sort order

- **BatchOrderService:** Aggregates multiple books into a single print order.
  - Validates all selected books are in `print_ready` status
  - Routes to appropriate PrintProviderAdapter
  - For Lulu: single API call with multiple line items
  - For others: sequential individual orders with consolidated status reporting

#### Project Status Machine

```
draft → typeset → cover_ready → print_ready → ordered → shipped
                                     ↑
                              (can return here if re-editing)
```

---

### Module 7: AI Engine

**Responsibility:** Abstraction layer over local and external AI providers.
**Addresses:** Requirement 12

#### Components

- **AIRouter:** Determines which provider to use based on user config and task type.
  - Task types: `text_generation`, `image_generation`
  - Checks user config → falls back to system default (local)

- **OllamaProvider:** Local text generation via Ollama HTTP API.
  - Default model: configurable (e.g., llama3, mistral)
  - Streaming support for long responses

- **ComfyUIProvider:** Local image generation via ComfyUI API.
  - Workflow templates for cover art generation
  - Configurable model (SDXL, Flux, etc.)

- **OpenAIProvider:** External text + image generation.
  - GPT-4o for text tasks
  - DALL-E 3 for image tasks

- **AnthropicProvider:** External text generation.
  - Claude for text tasks (typo detection, prompts, blurbs)

- **ReplicateProvider:** External image generation.
  - Flux, SDXL, or other models via Replicate API

#### Configuration Schema (per user)

```
AIConfig {
  user_id: UUID
  text_provider: enum (local, openai, anthropic) default "local"
  text_api_key: encrypted_str | null
  text_model: str | null  // override default model
  image_provider: enum (local, openai, replicate) default "local"
  image_api_key: encrypted_str | null
  image_model: str | null
}
```

---

### Module 8: Auth & User Management

**Responsibility:** User registration, authentication, session management, data isolation.
**Addresses:** Requirement 13

#### Components

- **AuthService:**
  - Registration with email + password (bcrypt hashed)
  - Login returns session token (stored in HTTP-only cookie)
  - Session expiry: 30 minutes of inactivity
  - All API routes protected by auth middleware

- **UserService:**
  - Profile management
  - Default preferences (print provider, AI config)
  - All database queries scoped by `user_id` — enforced at ORM level

#### Database Isolation

Every table with user data includes a `user_id` foreign key. A base query class automatically filters by the authenticated user's ID, making cross-user data access impossible at the ORM layer.

---

## Data Models

```sql
-- Core tables
users (id, email, password_hash, display_name, created_at)
sessions (id, user_id, token, expires_at, last_active)

-- Book projects
book_projects (id, user_id, title, author, source_type, source_url,
               source_metadata, original_text_path, working_text_path,
               interior_pdf_path, cover_pdf_path, status, sort_order,
               isbn, print_provider, created_at, updated_at)

-- Typo corrections
corrections (id, project_id, original_text, suggested_text,
             context_sentence, position, status, created_at)

-- Cover data
cover_prompts (id, project_id, prompt_text, image_path, selected, created_at)
cover_layouts (id, project_id, template_id, layout_json, created_at)

-- Orders
print_orders (id, user_id, provider, provider_order_id, status,
              total_price, shipping_address, created_at)
order_items (id, order_id, project_id)

-- AI configuration
ai_configs (id, user_id, text_provider, text_api_key_encrypted,
            text_model, image_provider, image_api_key_encrypted,
            image_model)

-- Print provider credentials
provider_credentials (id, user_id, provider, credentials_encrypted, created_at)
```

## API Design (Key Endpoints)

```
# Source & Search
GET    /api/search?q={query}
POST   /api/projects/upload
POST   /api/projects/import   {source, identifier}

# Project lifecycle
GET    /api/projects
GET    /api/projects/{id}
DELETE /api/projects/{id}

# Quality control
POST   /api/projects/{id}/scan-typos
GET    /api/projects/{id}/corrections
PATCH  /api/projects/{id}/corrections   {actions: [{id, accept: bool}]}
POST   /api/projects/{id}/corrections/apply

# Typesetting
POST   /api/projects/{id}/typeset
GET    /api/projects/{id}/interior-pdf

# Cover
POST   /api/projects/{id}/generate-prompts
POST   /api/projects/{id}/generate-images
POST   /api/projects/{id}/generate-blurb
POST   /api/projects/{id}/upload-cover-image
POST   /api/projects/{id}/assemble-cover   {layout_json}
GET    /api/projects/{id}/cover-pdf

# Print & Orders
GET    /api/projects/{id}/pricing?provider={provider}
POST   /api/orders   {project_ids: [], provider, shipping_address}
GET    /api/orders
GET    /api/orders/{id}

# User & Config
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/user/profile
PATCH  /api/user/ai-config
PATCH  /api/user/preferences
```

## Deployment Architecture

### Docker Compose Stack

```yaml
services:
  app:        # FastAPI backend + Celery worker
  frontend:   # SvelteKit (built static, served by Caddy)
  db:         # PostgreSQL 16
  redis:      # Task queue broker + session store
  ollama:     # Local LLM (optional, GPU passthrough)
  comfyui:    # Local image gen (optional, GPU passthrough)
```

### Deployment Modes

1. **Self-hosted (full):** All services including Ollama + ComfyUI. Requires GPU for local AI.
2. **Self-hosted (API-only):** No local AI containers. Users must configure external API keys.
3. **LXC on Proxmox:** Same as self-hosted, deployed as unprivileged container with GPU passthrough if available.
4. **Public website:** Frontend on CDN, backend on cloud VM, managed PostgreSQL, S3 for storage. Local AI disabled; external APIs required.

### Environment Configuration

All deployment-specific settings via environment variables:
- `DATABASE_URL`, `REDIS_URL`, `STORAGE_BACKEND` (local/s3), `S3_BUCKET`, `S3_ENDPOINT`
- `OLLAMA_URL`, `COMFYUI_URL` (empty = disabled)
- `APP_URL` (for QR codes in books)
- `SECRET_KEY` (session + encryption)

## Workflow Sequence (Happy Path)

```
User searches "The Railway Children"
  → Source Service queries Gutenberg + Standard Ebooks
  → Results displayed with quality labels
  → User selects Standard Ebooks version

Source Service downloads EPUB + metadata
  → Stores original text, extracts metadata
  → Creates BookProject in "draft" status

Typo correction skipped (Standard Ebooks = high quality)

Typeset Service triggered
  → ChapterDetector finds chapters
  → TemplateRenderer builds Typst source (with Info_Page, Attribution_Page)
  → PDFGenerator compiles to interior PDF
  → Project status → "typeset"

Cover Service triggered
  → PromptGenerator produces 10 prompts
  → ImageGenerator creates 10 candidate images
  → BlurbGenerator writes back cover copy
  → User opens Cover Builder, drags favorite image, picks template
  → CoverAssembler renders final cover PDF
  → Project status → "cover_ready" → "print_ready"

User clicks "Print"
  → Print Service shows Lulu pricing estimate
  → User confirms → order submitted via Lulu API
  → Project status → "ordered"
  → (Later, webhook or polling updates to "shipped")
```

## Key Design Decisions

1. **Typst over LaTeX:** Faster compilation (seconds vs minutes for long books), simpler template syntax, modern tooling. Pandoc converts source to Typst-compatible markup.

2. **Modular monolith over microservices:** Single deployment unit keeps ops simple for self-hosted users. Internal module boundaries are clean enough to split later if needed.

3. **Celery for background tasks:** Typesetting and AI generation can take 30-120 seconds. Celery with Redis provides reliable async execution with status polling from the frontend.

4. **PyCairo for cover PDF:** Only tool that produces proper CMYK PDF with bleed marks from code. Alternatives (ReportLab, WeasyPrint) lack CMYK support or bleed control.

5. **Fabric.js for cover editor:** Mature canvas library with built-in drag-and-drop, text editing, and serialization. Layout saved as JSON, sent to backend for final PDF rendering.

6. **Plugin architecture for sources:** New book sources (Internet Archive, HathiTrust, etc.) can be added by implementing a single interface. No core changes needed.

7. **Encryption for credentials:** User API keys and print provider tokens encrypted with Fernet (symmetric, derived from SECRET_KEY + user salt). Never stored in plaintext.

## Non-Functional Requirements Addressed

- **Performance:** Background tasks prevent UI blocking. Frontend is static/cached. Database queries indexed on user_id + status.
- **Security:** Auth middleware on all routes, encrypted credentials, session expiry, bcrypt passwords, user-scoped queries.
- **Scalability:** Horizontal scaling via multiple Celery workers. Stateless API (sessions in Redis). Database connection pooling.
- **Portability:** Docker Compose works on any Linux host, Proxmox LXC, or cloud VM. No vendor lock-in.

## Correctness Properties

### Property 1: Text Integrity
The original_text_path is never modified. All corrections produce a separate working_text_path. Users can always revert to the original.

**Validates: Requirements 3.6**

### Property 2: User Isolation
Every database query is scoped by user_id at the ORM base class level. No endpoint can return data belonging to another user.

**Validates: Requirements 13.5**

### Property 3: Cover Dimensional Accuracy
Cover PDF dimensions are calculated from page count + provider specs. The system validates that the assembled cover matches the expected full-wrap size before allowing print submission.

**Validates: Requirements 6.4, 6.5**

### Property 4: Idempotent Operations
Typesetting and cover assembly can be re-run without side effects. Previous outputs are overwritten, not duplicated.

**Validates: Requirements 8.1, 14.6**

### Property 5: Order Atomicity
Batch orders either fully succeed or fully fail per provider. Partial submissions are not left in an ambiguous state.

**Validates: Requirements 11.3, 11.7**

## Error Handling

- **AI failures:** All AI calls have timeouts (30s text, 120s image). On failure, the user is notified with the reason and offered retry or fallback options. No silent failures.
- **Typesetting failures:** If Typst compilation fails, the error output is parsed and presented to the user. The source text is preserved unchanged.
- **Network failures (sources):** Source searches degrade gracefully — if one provider is unreachable, results from others are still shown with a warning.
- **Print API failures:** Order submissions retry up to 3 times with exponential backoff. Failures are logged and surfaced to the user with actionable next steps.
- **File corruption:** Uploaded files are validated (magic bytes, format parsing) before acceptance. Corrupt files are rejected with a clear message.
- **Session expiry:** Expired sessions return 401. The frontend redirects to login and preserves the intended destination for post-login redirect.

## Testing Strategy

- **Unit tests:** Each service module (Source, Quality, Typeset, Cover, Print, AI Engine) tested in isolation with mocked dependencies. pytest + pytest-asyncio.
- **Integration tests:** API endpoint tests with a test database. Verify full request/response cycles including auth, validation, and error cases.
- **AI mocking:** All AI provider calls are behind interfaces. Tests use deterministic mock providers returning fixture data.
- **Cover rendering tests:** Validate PDF output dimensions, color space (CMYK), and bleed margins using PyPDF2 inspection.
- **E2E tests:** Playwright tests for critical frontend flows: search → select → typeset → cover builder → order. Run against a Docker Compose test stack.
- **Security tests:** Verify user isolation (user A cannot access user B's projects), session expiry, and credential encryption.
