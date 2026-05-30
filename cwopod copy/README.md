# C.W.'s O-POD

**O-POD** — Open Print-On-Demand.

Created by [C.W. Holeman III](https://www.cwholemaniii.com/cwopod).

C.W.'s O-POD is a self-hosted web application that turns public domain texts into beautiful, print-ready physical books. It provides a guided workflow from source selection through typesetting, cover design, illustration placement, and print-on-demand ordering — with the goal of making the entire process nearly one-click.

---

## What It Does

1. **Find a Book** — Search Project Gutenberg and Standard Ebooks for public domain texts, or upload your own (EPUB, DOCX, TXT, PDF).

2. **Typo Correction** (optional) — An LLM scans the text chapter by chapter for typographical errors. If a chapter is too long, it gets split into smaller pieces automatically. You review and accept/reject each suggestion. High-quality sources (Standard Ebooks) skip this step by default.

3. **Illustrations** (optional) — Place and size images within your book before typesetting. Features include:
   - Three image pools: Available (extracted/uploaded), Shared (user library), In-Book (placed in pages)
   - Drag-and-drop image placement on spread preview
   - Full-page and plate insertion modes with text displacement feedback
   - Undo/Redo for all operations
   - Resolution warnings for low-DPI images
   - Lock images to prevent accidental moves

4. **Typesetting** — Generates a print-ready interior PDF using Typst. Includes proper front matter (half-title, title page, copyright), chapter detection, running headers, page numbers, and back matter with attribution and QR codes.

5. **Cover Design** — AI generates 10 spoiler-free cover art prompts from the book's text. Generate images, pick one (or upload your own), then use the interactive Cover Builder (Fabric.js) to position text, choose templates, and customize. Outputs a CMYK PDF with correct bleed and spine width.

6. **Print & Ship** — Submit orders to Lulu xPress, BookVault, or export for KDP Print. Supports multi-title batch ordering, ISBN management (Lulu free ISBN or user-provided), and order tracking.

7. **Bookshelf** — Manage your collection with pagination, status filtering, drag-and-drop reordering, and batch operations.

8. **Admin** — System-wide resource tracking, cost estimation, user management, and system settings.

---

## Architecture

- **Backend**: Python 3.11 / FastAPI (async)
- **Frontend**: Vanilla JavaScript (ES6+) + jQuery, served by Caddy
- **Database**: PostgreSQL 16
- **Task Queue**: Celery with Redis broker
- **Typesetting**: Typst (compiled via subprocess)
- **Cover PDF**: PyCairo (CMYK color space)
- **AI**: Pluggable provider system — local (Ollama for text, ComfyUI for images) or cloud (OpenAI, Anthropic, Replicate)
- **Storage**: Local filesystem or S3-compatible object storage
- **Deployment**: Docker Compose

---

## Key Design Decisions

- **User isolation** — All data is scoped per-user at the ORM level. Users cannot see each other's projects.
- **Session-based auth** — bcrypt password hashing, HTTP-only cookies, 30-minute sliding window expiry.
- **AI provider abstraction** — Switch between local and cloud AI without changing application code. Per-user API key storage with Fernet encryption.
- **No vendor lock-in** — Supports multiple print providers, multiple AI providers, and pluggable storage backends.
- **Background processing** — PDF generation, typo scanning, and illustration reflow run as Celery tasks so the UI stays responsive.
- **Resource tracking** — Every operation records CPU, GPU, RAM, and wall-clock time for cost estimation and usage analytics.
- **Client-side reflow** — Illustration placement includes local text displacement approximation with optional backend-verified renders.

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Pydantic settings from env vars
│   │   ├── database.py          # Async SQLAlchemy engine
│   │   ├── worker.py            # Celery configuration
│   │   ├── middleware/          # Auth dependencies
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── routers/             # FastAPI route handlers
│   │   │   ├── admin.py         # Admin endpoints (resources, settings, users)
│   │   │   ├── ai_config.py     # AI provider configuration
│   │   │   ├── auth.py          # Authentication
│   │   │   ├── bookshelf.py     # Bookshelf list, batch order, reorder
│   │   │   ├── cover.py         # Cover generation, PDF assembly
│   │   │   ├── illustrations.py # Illustration management
│   │   │   ├── print_orders.py  # Print orders, shipping addresses
│   │   │   ├── projects.py      # Project CRUD, typo scanning, typesetting
│   │   │   ├── quality_controller.py # Typo scanning
│   │   │   ├── search.py        # Source search (Gutenberg, SE)
│   │   │   ├── typeset.py       # Typesetting, interior PDF
│   │   │   └── user.py          # User profile
│   │   ├── services/            # Business logic
│   │   │   ├── ai_engine/       # AI provider abstraction (Ollama, OpenAI, Anthropic, Replicate)
│   │   │   ├── source_service/  # Search, download, upload, storage
│   │   │   ├── quality_controller/  # Typo scanning + correction
│   │   │   ├── typeset/         # Chapter detection, Typst rendering, PDF
│   │   │   ├── cover/           # Prompt gen, blurb gen, PDF assembly
│   │   │   ├── illustrations/   # Image pools, placement, reflow
│   │   │   ├── print_service/   # Provider adapters, ISBN, orders
│   │   │   ├── resource_tracker.py # Usage tracking & cost estimation
│   │   │   └── scoped_query.py  # Per-user data isolation
│   │   └── utils/               # Encryption, exceptions
│   ├── alembic/                 # Database migrations
│   ├── tests/                   # pytest test suite
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── index.html               # SPA entry point
│   ├── css/styles.css           # Design system
│   ├── js/                      # ES6 modules
│   │   ├── app.js               # Entry point
│   │   ├── api.js               # API client (fetch wrapper)
│   │   ├── router.js            # History API router
│   │   ├── auth.js              # Auth state management
│   │   ├── dom.js               # DOM helpers
│   │   ├── progress.js          # Progress tracking utilities
│   │   ├── address-picker.js    # Shared shipping address UI
│   │   ├── pages/               # Page modules
│   │   │   ├── admin.js         # Admin dashboard
│   │   │   ├── bookshelf.js     # Project list, batch order
│   │   │   ├── cover.js         # Cover builder
│   │   │   ├── home.js          # Landing page
│   │   │   ├── login.js         # Auth
│   │   │   ├── orders.js        # Order history
│   │   │   ├── project.js       # Project wizard (5-step)
│   │   │   ├── project-illustrations.js # Illustrations step
│   │   │   ├── search.js        # Source search
│   │   │   └── settings.js      # User settings
│   │   └── components/          # Reusable UI components
│   │       ├── spread-preview.js    # Spread canvas
│   │       ├── available-pool.js    # Available images
│   │       ��── shared-pool.js       # Shared images
│   │       ├── in-book-pool.js      # Placed images
│   │       ├── drag-drop-handler.js # Drag-and-drop
│   │       ├── context-menu.js      # Right-click menu
│   │       ├── local-reflow.js      # Text displacement
│   │       └── dpi-calculator.js    # Resolution warnings
│   ├── lib/                     # jQuery local fallback
│   ├── assets/                  # Static assets (favicon, images)
│   ├── Dockerfile               # Single-stage: caddy:2-alpine + COPY
│   └── Caddyfile                # Reverse proxy + SPA fallback
├── docker-compose.yml           # Core stack (app, worker, frontend, db, redis)
├── docker-compose.override.yml  # Optional GPU services (Ollama, ComfyUI)
└── .env.example                 # Environment variable template
```

---

## Quick Start

```bash
cp .env.example .env
# Edit .env — at minimum change SECRET_KEY to a random string

docker compose up --build
```

O-POD will be available at `http://localhost:8080`.

---

## AI Configuration

O-POD defaults to local AI via Ollama for text generation. It runs on CPU without a GPU — completely private and free. The typo scanner works chapter by chapter (one AI call per chapter, sub-chunking only if a chapter is unusually long). A typical 20-chapter novel means ~20 AI calls. On CPU that's about 1-2 minutes per chapter, so a full scan takes 20-40 minutes as a background task. You kick it off and come back.

For image generation (cover art), you'll need either:
- A cloud API key (OpenAI DALL-E or Replicate) configured in Settings
- Or upload your own cover images manually

To use cloud providers for faster text generation, go to Settings → AI Configuration and add your API key. Supported providers:
- **Text**: Ollama (local, default), OpenAI, Anthropic
- **Image**: ComfyUI (local, needs GPU), OpenAI (DALL-E 3), Replicate (Flux)

---

## Deployment

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for full step-by-step instructions on getting O-POD running on a blank Linux machine.

The deploy flow is:
1. Copy the project to your server
2. Run `install.sh`

That's it. The install script handles everything: disk cleanup, Docker, database migrations, service startup, and AI model pulling.

---

## Support / Buy Me a Coffee

Enjoying this tool? Getting a lot of value from it? I'd love to hear from you. I also wouldn't complain if you bought me a coffee (or a car).

**[Support via PayPal](https://www.paypal.me/cwhiii)**

---

## Contact

- **About this tool**: [www.cwholemaniii.com/cwopod](https://www.cwholemaniii.com/cwopod)
- **Email**: cwopod@cwholemaniii.com

---

## License

MIT — see [LICENSE](LICENSE).
