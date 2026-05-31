# Implementation Guide

How to get C.W.'s O-POD running on a blank Linux machine from scratch.

This guide assumes you're starting with a fresh Ubuntu 22.04+ installation (server or LXC container) with root access and internet connectivity.

---

## Overview

O-POD is fully containerized with Docker. You don't need to install Python, Node.js, PostgreSQL, or Redis on the host — Docker handles all of that. The only things the host machine needs are:

1. Git (to clone the repo)
2. Docker + Docker Compose (to run everything)
3. The project files
4. A `.env` file with your configuration

---

## Step 1: System Requirements

**Minimum hardware:**
- 2 CPU cores (4 preferred for local AI)
- 4 GB RAM (8 GB if you want comfortable local AI inference)
- 32 GB disk (Ollama models are 2-8 GB each, plus your stored books/PDFs)
- Internet access (for pulling Docker images, searching Gutenberg/Standard Ebooks)

**Operating system:**
- Ubuntu 22.04+ (recommended)
- Debian 11+ also works
- Any Linux distro that supports Docker CE

If running inside an LXC container, make sure nesting and keyctl are enabled on the host.

---

## Step 2: Install Base Dependencies

Update the system and install the handful of packages needed to get Docker installed:

```bash
apt-get update
apt-get install -y curl git ca-certificates gnupg openssl lsb-release
```

That's it for host-level packages. Everything else runs inside containers.

---

## Step 3: Install Docker

If Docker isn't already installed:

```bash
# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Add the Docker apt repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine + Compose plugin
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
systemctl enable docker
systemctl start docker
```

Verify it works:
```bash
docker --version
docker compose version
```

---

## Step 4: Get the Project Files

Clone the repo or copy the project files to the server:

```bash
# Option A: Clone from the repository
git clone <REPO_URL> /opt/cwopod

# Option B: Copy from another machine
scp -r /path/to/cwopod root@<SERVER_IP>:/opt/cwopod
```

The project should live at `/opt/cwopod`. Note: if using `scp -r`, the destination must NOT already exist — otherwise files will nest inside it.

---

## Step 5: Configure Environment Variables

```bash
cd /opt/cwopod
cp .env.example .env
```

Edit `.env` and set at minimum:

| Variable | What to set | Notes |
|----------|-------------|-------|
| `SECRET_KEY` | A random 64-character hex string | Generate with: `openssl rand -hex 32` |
| `APP_URL` | `http://<YOUR_SERVER_IP>:8080` | Used for QR codes printed in books |

The rest of the defaults are fine for a standard deployment. The full list:

```
DATABASE_URL          — Leave as-is (points to the Docker Postgres container)
REDIS_URL             — Leave as-is (points to the Docker Redis container)
STORAGE_BACKEND       — "local" (default) or "s3"
STORAGE_PATH          — /app/storage (default, inside the container volume)
OLLAMA_URL            — http://ollama:11434 (default, points to the Ollama container)
COMFYUI_URL           — http://comfyui:8188 (leave empty if no GPU)
APP_URL               — Your server's URL (for QR codes)
SECRET_KEY            — Random string for encryption
SESSION_EXPIRY_MINUTES — 1440 (24 hours, default)
```

---

## Step 6: Configure Local AI (Ollama)

The project includes a `docker-compose.override.yml` for local AI services. For CPU-only (no GPU), make sure it looks like this:

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

volumes:
  ollama_data:
```

If you have an NVIDIA GPU and want faster inference, you can add GPU passthrough:

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

volumes:
  ollama_data:
```

If you don't want local AI at all (you'll use cloud API keys instead), just delete or empty the override file:
```bash
echo "" > docker-compose.override.yml
```

---

## Step 7: Build and Start

```bash
cd /opt/cwopod
docker compose build
docker compose up -d
```

First build takes 3-5 minutes (downloading base images, compiling Python packages, installing Typst and Pandoc inside the container).

What gets started:
| Service | Purpose | Port |
|---------|---------|------|
| `frontend` | Caddy web server (serves UI + reverse proxies API) | 8080 |
| `app` | FastAPI backend | 8000 (internal) |
| `worker` | Celery task worker (PDF generation, typo scanning) | — |
| `db` | PostgreSQL 16 | 5432 (internal) |
| `redis` | Redis (task queue + sessions) | 6379 (internal) |
| `ollama` | Local LLM for text generation | 11434 |

The backend container automatically runs database migrations (`alembic upgrade head`) on every start.

---

## Step 8: Pull the AI Model

Once Ollama is running, pull the default text model:

```bash
docker compose exec ollama ollama pull llama3.2:3b
```

This downloads ~2 GB. The model is used for typo scanning and cover art prompt generation. On CPU, expect ~1-2 minutes per chapter for typo scanning.

If you'd rather skip local AI entirely and use OpenAI/Anthropic API keys, you can skip this step and configure cloud providers in the app's Settings page after logging in.

---

## Step 9: Verify Everything Works

Check the health endpoint:
```bash
curl http://localhost:8080/api/health
```

You should get a JSON response confirming the API is up.

Open a browser and navigate to `http://<SERVER_IP>:8080`. You should see the O-POD login page. Register your first account — the first user created becomes the admin.

---

## Step 10: (Optional) HTTPS with a Reverse Proxy

If you want HTTPS with a real domain, put a reverse proxy in front. Example with Caddy on the host:

```bash
apt install caddy
```

`/etc/caddy/Caddyfile`:
```
books.yourdomain.com {
    reverse_proxy localhost:8080
}
```

Then update `APP_URL` in your `.env` to `https://books.yourdomain.com` and restart:
```bash
docker compose down && docker compose up -d
```

---

## The Easy Way: Just Run install.sh

All of the above (steps 2-9) is automated by the install script:

```bash
chmod +x /opt/cwopod/install.sh
bash /opt/cwopod/install.sh
```

The script is idempotent — safe to re-run. It handles:
- Package installation
- Docker installation
- Environment configuration (auto-generates secrets, detects IP)
- Docker image builds
- Service startup
- Health checks
- AI model pulling

---

## What's Running Inside the Containers

For reference, here's what each container actually does:

**Backend (`app`)** — Python 3.11 + FastAPI. The Dockerfile installs:
- PyCairo (for CMYK cover PDF generation)
- Typst (for interior book typesetting)
- Pandoc (for EPUB/DOCX conversion)
- All Python dependencies from `pyproject.toml`

**Worker** — Same image as `app`, but runs Celery instead of Uvicorn. Handles background tasks: typo scanning, PDF generation, cover art generation.

**Frontend** — Caddy 2 (Alpine). Serves static HTML/JS/CSS and reverse-proxies `/api/*` to the backend. No build step — it's vanilla JS.

**Database** — PostgreSQL 16 Alpine. Schema managed by Alembic migrations (run automatically on backend start).

**Redis** — Redis 7 Alpine. Used as Celery broker and for session storage.

**Ollama** — Runs LLM inference. CPU-only by default. Models stored in a Docker volume.

---

## Persistent Data

All persistent data lives in Docker volumes:
- `postgres_data` — Database (users, projects, corrections, orders)
- `storage_data` — Book files, generated PDFs, cover images
- `ollama_data` — Downloaded AI models

To back up:
```bash
# Database
docker compose exec db pg_dump -U cwopod cwopod > backup.sql

# Storage files
docker compose cp app:/app/storage ./storage-backup
```

---

## Updating

```bash
cd /opt/cwopod
git pull
docker compose up --build -d
```

Database migrations apply automatically on container start.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Docker won't start in container | Enable nesting + keyctl on the host if running in LXC |
| Health check fails | Wait 30 seconds, check `docker compose logs app` |
| Celery not processing | Check `docker compose logs worker` — usually Redis not ready yet (auto-recovers) |
| Out of disk space | `docker system prune -a` then rebuild |
| Ollama not responding | `docker compose logs ollama` — may need more RAM |
| Typst fails | `docker compose build --no-cache app` to rebuild |
| Port 8080 in use | Change the frontend port mapping in `docker-compose.yml` |

---

## Resource Usage (Typical)

| Component | RAM (idle) | RAM (active) | Disk |
|-----------|-----------|--------------|------|
| Backend | ~120MB | ~120MB | Minimal |
| Worker | ~150MB | ~200MB | Minimal |
| Frontend | ~15MB | ~15MB | Minimal |
| Postgres | ~60MB | ~60MB | Grows with use |
| Redis | ~30MB | ~30MB | Minimal |
| Ollama | ~200MB | ~3-5GB | 4-8GB per model |
| **Total** | **~600MB** | **~3.5-5.5GB** | — |

Ollama loads the model into RAM when processing a request, then unloads after idle timeout. With 4GB RAM + swap, a quantized 3B model works fine.

---

## Using Cloud AI Instead of Local

Local AI (Ollama on CPU) is the default — slow but private and free. For faster responses:

1. Log in to O-POD
2. Go to Settings → AI Configuration
3. Set text provider to "openai" or "anthropic" and paste your API key
4. Set image provider to "openai" or "replicate" and paste your API key

API keys are encrypted at rest using Fernet encryption derived from the SECRET_KEY.

You can run both — use local for experimentation and switch to cloud when you want speed.

---

## Summary

The minimal path from blank Linux box to running O-POD:

```bash
# 1. Install Docker
apt-get update && apt-get install -y curl git ca-certificates gnupg openssl lsb-release
curl -fsSL https://get.docker.com | sh

# 2. Get the project
git clone <REPO_URL> /opt/cwopod
cd /opt/cwopod

# 3. Configure
cp .env.example .env
sed -i "s/change-me-to-a-random-64-char-string/$(openssl rand -hex 32)/" .env

# 4. Run
docker compose up --build -d

# 5. Pull AI model (optional)
docker compose exec ollama ollama pull llama3.2:3b
```

That's five commands. Open `http://<server-ip>:8080` and start making books.
