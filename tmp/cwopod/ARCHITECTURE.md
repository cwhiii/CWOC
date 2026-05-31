# C.W.'s O-POD — Architecture Overview

## Current State: Single-Box Deployment

Everything runs on one machine (your Proxmox LXC).

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR LOCAL SERVER (LXC)                       │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Nginx   │  │ FastAPI  │  │  Celery  │  │    AI Services   │ │
│  │(frontend)│──│(backend) │──│ (worker) │──│                  │ │
│  │          │  │          │  │          │  │  Ollama (text)   │ │
│  └──────────┘  └──────────┘  └──────────┘  │  ComfyUI (image) │ │
│                      │              │       └──────────────────┘ │
│                      │              │                             │
│               ┌──────┴──────┐  ┌────┴────┐   ┌───────────────┐  │
│               │ PostgreSQL  │  │  Redis  │   │  Local Disk   │  │
│               │   (data)    │  │ (queue) │   │  (PDFs/imgs)  │  │
│               └─────────────┘  └─────────┘   └───────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ ✗ Private IP — Lulu can't reach this
                              ▼
                    ┌───────────────────┐
                    │   The Internet    │
                    │  (Lulu, users)    │
                    └───────────────────┘
```

**Pros:** Simple, one install script, everything works together.
**Cons:** Can't scale. Lulu can't reach your PDFs. Tied to one machine's hardware.

---

## Future State: Split Deployment (3 Modes)

### Mode A — All-in-One (Current, for home/hobbyist)

Same as above but on a public-facing server (Hetzner, etc).

```
┌─────────────────────────────────────────────────────────────────┐
│                  SINGLE SERVER (Hetzner/VPS)                      │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Nginx   │  │ FastAPI  │  │  Celery  │  │  Ollama        │  │
│  │(frontend)│──│(backend) │──│ (worker) │──│  ComfyUI       │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
│                      │              │                             │
│               ┌──────┴──────┐  ┌────┴────┐  ┌───────────────┐   │
│               │ PostgreSQL  │  │  Redis  │  │  Local Disk   │   │
│               └─────────────┘  └─────────┘  └───────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ ✓ Public IP — Lulu can reach this
                              ▼
                    ┌───────────────────┐
                    │   The Internet    │
                    └───────────────────┘
```

**Cost:** ~€11-33/mo (CPU) or ~€214/mo (with GPU)
**Best for:** Someone who wants full control, generates frequently.

---

### Mode B — Split (Web + Remote Worker)

Cheap web host + on-demand compute.

```
┌─────────────────────────────────┐       ┌─────────────────────────────┐
│   WEB TIER (CrocWeb / cheap)    │       │  WORKER TIER (on-demand)    │
│                                  │       │  Hetzner / Home GPU box     │
│  ┌──────────┐  ┌──────────┐    │       │                             │
│  │  Nginx   │  │ FastAPI  │    │       │  ┌──────────┐  ┌────────┐  │
│  │(frontend)│──│(backend) │    │       │  │  Celery  │  │ Ollama │  │
│  └──────────┘  └──────────┘    │       │  │ (worker) │──│ComfyUI │  │
│                      │          │       │  └─────┬────┘  └────────┘  │
│               ┌──────┴──────┐   │       │        │                    │
│               │ PostgreSQL  │◄──┼───────┼────────┘ (connects to       │
│               └─────────────┘   │       │           remote DB+Redis)  │
│                                  │       │                             │
│               ┌─────────────┐   │       └─────────────────────────────┘
│               │    Redis    │◄──┼───────── tasks dispatched here
│               └─────────────┘   │
│                                  │       ┌─────────────────────────────┐
│               ┌─────────────┐   │       │     S3 / Object Storage     │
│               │  S3 Bucket  │◄──┼───────┤  (shared PDFs & images)     │
│               └─────────────┘   │       └─────────────────────────────┘
│                                  │
└─────────────────────────────────┘
            │
            │ ✓ Public URL
            ▼
  ┌───────────────────┐
  │   The Internet    │
  │  (Lulu, users)    │
  └───────────────────┘
```

**Cost:** Web = existing hosting (free). Worker = pay per hour only when generating.
- CPU tasks (typeset, spellcheck): ~€0.007/hr on Hetzner cloud
- GPU tasks (cover images): ~$0.03/image via Replicate, or €0.34/hr on Hetzner GEX44

**Best for:** Selling as a product. Users bring their own compute or use cloud APIs.

---

### Mode C — Cloud APIs Only (No self-hosted AI)

Simplest deployment. No GPU anywhere. All AI via paid APIs.

```
┌─────────────────────────────────┐
│   WEB TIER (any host)           │
│                                  │
│  ┌──────────┐  ┌──────────┐    │
│  │  Nginx   │  │ FastAPI  │    │       ┌─────────────────────────┐
│  │(frontend)│──│(backend) │────┼──────►│   Cloud AI APIs         │
│  └──────────┘  └──────────┘    │       │                         │
│                      │          │       │  • OpenAI (text+image)  │
│               ┌──────┴──────┐   │       │  • Anthropic (text)     │
│               │ PostgreSQL  │   │       │  • Replicate (image)    │
│               └─────────────┘   │       │                         │
│               ┌─────────────┐   │       └─────────────────────────┘
│               │    Redis    │   │
│               └─────────────┘   │
│               ┌─────────────┐   │
│               │  Local Disk │   │
│               │  (or S3)    │   │
│               └─────────────┘   │
│                                  │
└─────────────────────────────────┘
            │
            │ ✓ Public URL
            ▼
  ┌───────────────────┐
  │   The Internet    │
  └───────────────────┘
```

**Cost:** Hosting = existing. AI = pay per use.
- Text (spellcheck, prompts): ~$0.01-0.05/book via OpenAI/Anthropic
- Images (covers): ~$0.04-0.12/book via DALL-E or Replicate
- **Total: ~$0.05-0.15 per book, zero infrastructure**

**Best for:** Users who don't want to manage servers. Just paste API keys and go.

---

## What Needs to Change

```
CURRENT                              FUTURE
───────                              ──────

Storage: local disk only      →      Storage: local OR S3 (toggle in settings)
Worker: same machine          →      Worker: local OR remote (env var)
AI: per-user provider choice  →      Same (already works!)
Install: one script           →      Two profiles: "full" or "web-only"
Settings UI: AI config only   →      + Compute mode selector
```

### Key Changes:

1. ✅ AI provider switching — ALREADY DONE (Ollama/OpenAI/Anthropic/Replicate)
2. 🔲 S3 storage backend — config exists, implementation needed
3. 🔲 Remote worker config — just env vars, trivial
4. 🔲 Docker Compose profiles (web-only vs full)
5. 🔲 Settings UI: "Compute Mode" section
6. 🔲 Installer: detect mode and configure accordingly

### Estimated effort: 1-2 weeks

---

## Current Architecture Highlights

### Illustrations Feature (New)

The illustrations workflow is fully implemented with:

- **Three image pools**: Available (extracted/uploaded), Shared (user library), In-Book (placed in pages)
- **Drag-and-drop placement**: Intuitive UI for moving images between pools and onto spreads
- **Spread preview**: Canvas-based preview showing how images appear in-page
- **Text displacement feedback**: Local reflow engine approximates text movement; optional backend-verified renders
- **Full-page and plate modes**: Support for both inline images and full-page inserts
- **Undo/Redo**: In-memory action stack for all operations
- **Resolution warnings**: DPI calculator flags low-resolution images before typesetting
- **Typeset gate**: Prevents proceeding to typesetting until all in-book images are placed and locked

### Resource Tracking & Cost Estimation

Every operation records:
- CPU time (user + system)
- GPU time (if applicable)
- Peak RAM usage
- Wall-clock time
- Operation type (typo scan, typeset, cover gen, etc.)

The admin panel provides:
- Live system stats (CPU, RAM, disk, GPU)
- Historical usage by operation and per-project
- Per-book cost estimates across providers (Hetzner, AWS, GCP, etc.)
- GPU vs CPU cost projections

### Admin Dashboard

- **Resource Usage tab**: Live stats, historical data, per-project breakdown, cost estimator
- **System Settings tab**: Public registration toggle, default AI models
- **User Management tab**: Create/delete users, toggle admin status

### Print Orders & Bookshelf

- **Order History**: Full details on every order (provider, items, cost, shipping)
- **Batch Ordering**: Select multiple projects, one shipping address, single order submission
- **Bookshelf**: Paginated list with status filtering, drag-and-drop reordering, file links (source, interior PDF, cover PDF)
