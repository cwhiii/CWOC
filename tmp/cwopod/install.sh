#!/usr/bin/env bash
# ============================================================================
# CWOPOD — Automated Install Script
# Run this on a fresh Ubuntu 22.04+ LXC (or VM) as root.
# ============================================================================

set -euo pipefail
set -x

# --- Parse command-line flags ---
HARD_REFRESH=false
for arg in "$@"; do
  case "$arg" in
    --hard_refresh|--hard-refresh)
      HARD_REFRESH=true
      ;;
  esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[CWOPOD $(date '+%H:%M:%S')]${NC} $1"; }
debug(){ echo -e "${CYAN}[DEBUG $(date '+%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN $(date '+%H:%M:%S')]${NC} $1"; }
err()  { echo -e "${RED}[ERROR $(date '+%H:%M:%S')]${NC} $1"; exit 1; }

# ============================================================================
# PHASE 0: Preflight Checks
# ============================================================================

log "=========================================="
log "PHASE 0: Preflight Checks"
log "=========================================="

debug "Checking if running as root..."
debug "Current user: $(whoami)"
debug "User ID: $(id -u)"

if [ "$(id -u)" -ne 0 ]; then
  err "This script must be run as root. Try: sudo bash install.sh"
fi

log "Running as root — OK"

debug "System info:"
debug "  Hostname: $(hostname)"
debug "  Kernel: $(uname -r)"
debug "  Architecture: $(uname -m)"
debug "  OS: $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '"' || echo 'unknown')"
debug "  Uptime: $(uptime -p 2>/dev/null || uptime)"
debug "  Date: $(date)"
debug "  Disk usage:"
df -h / | tail -1 | awk '{print "    Total: "$2" Used: "$3" Available: "$4" Use%: "$5}'
debug "  Memory:"
free -h | grep Mem | awk '{print "    Total: "$2" Used: "$3" Free: "$4" Available: "$7}'
debug "  CPU cores: $(nproc)"

log "Starting CWOPOD installation..."
log "Timestamp: $(date -Iseconds)"
if [ "$HARD_REFRESH" = "true" ]; then
  warn "⚠️  --hard_refresh mode: ALL volumes (including AI models) will be wiped!"
fi

# ============================================================================
# PHASE 1: Package Repository Setup
# ============================================================================

log "=========================================="
log "PHASE 1: Package Repository Setup"
log "=========================================="

debug "Running apt-get update to test repository connectivity..."

if ! apt-get update 2>/dev/null; then
  warn "Package repos failed — checking for EOL Ubuntu release..."
  debug "Checking /etc/apt/sources.list for archive.ubuntu.com..."
  if grep -q "archive.ubuntu.com" /etc/apt/sources.list 2>/dev/null; then
    log "Found archive.ubuntu.com references — switching to old-releases.ubuntu.com..."
    debug "Before modification:"
    debug "$(cat /etc/apt/sources.list)"
    sed -i 's|http://archive.ubuntu.com/ubuntu|http://old-releases.ubuntu.com/ubuntu|g' /etc/apt/sources.list
    sed -i 's|http://security.ubuntu.com/ubuntu|http://old-releases.ubuntu.com/ubuntu|g' /etc/apt/sources.list
    debug "After modification:"
    debug "$(cat /etc/apt/sources.list)"
  fi
  if [ -d /etc/apt/sources.list.d ]; then
    debug "Checking /etc/apt/sources.list.d/ for additional repo files..."
    debug "Files found: $(ls /etc/apt/sources.list.d/ 2>/dev/null || echo 'none')"
    sed -i 's|http://archive.ubuntu.com/ubuntu|http://old-releases.ubuntu.com/ubuntu|g' /etc/apt/sources.list.d/*.list 2>/dev/null || true
    sed -i 's|http://security.ubuntu.com/ubuntu|http://old-releases.ubuntu.com/ubuntu|g' /etc/apt/sources.list.d/*.list 2>/dev/null || true
  fi
  log "Retrying apt-get update with fixed repos..."
  apt-get update
  log "apt-get update succeeded after repo fix"
else
  log "apt-get update succeeded — repos are healthy"
fi

# ============================================================================
# PHASE 2: Base System Dependencies
# ============================================================================

log "=========================================="
log "PHASE 2: Base System Dependencies"
log "=========================================="

PACKAGES="curl git ca-certificates gnupg openssl lsb-release"
debug "Required packages: $PACKAGES"

for pkg in $PACKAGES; do
  if dpkg -l "$pkg" 2>/dev/null | grep -q "^ii"; then
    debug "  $pkg — already installed ($(dpkg -l "$pkg" | grep "^ii" | awk '{print $3}'))"
  else
    debug "  $pkg — NOT installed, will be installed"
  fi
done

log "Installing base dependencies (apt-get install -y)..."
apt-get install -y \
  curl \
  git \
  ca-certificates \
  gnupg \
  openssl \
  lsb-release

log "Base dependencies installed successfully"

# ============================================================================
# PHASE 3: Docker Installation
# ============================================================================

log "=========================================="
log "PHASE 3: Docker Installation"
log "=========================================="

if command -v docker &>/dev/null; then
  log "Docker already installed — skipping installation"
  debug "Docker version: $(docker --version)"
  debug "Docker compose version: $(docker compose version 2>/dev/null || echo 'not available')"
  debug "Docker info:"
  docker info 2>/dev/null | grep -E "(Server Version|Storage Driver|Operating System|Total Memory|CPUs)" | while read -r line; do
    debug "  $line"
  done
else
  log "Docker NOT found — installing from official Docker repo..."

  debug "Creating /etc/apt/keyrings directory..."
  install -m 0755 -d /etc/apt/keyrings

  debug "Downloading Docker GPG key..."
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  debug "GPG key installed at /etc/apt/keyrings/docker.gpg"

  debug "Adding Docker apt repository..."
  debug "Architecture: $(dpkg --print-architecture)"
  debug "Ubuntu codename: $(lsb_release -cs)"
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

  debug "Running apt-get update to pick up Docker repo..."
  apt-get update

  log "Installing Docker packages..."
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  debug "Enabling Docker systemd service..."
  systemctl enable docker
  debug "Starting Docker service..."
  systemctl start docker

  log "Docker installed successfully: $(docker --version)"
  debug "Docker compose: $(docker compose version)"
fi

debug "Verifying Docker daemon is responsive..."
if ! docker info &>/dev/null; then
  err "Docker is installed but not running. Check: systemctl status docker"
fi
log "Docker daemon is running and responsive — OK"

# ============================================================================
# PHASE 4: Project Directory Setup
# ============================================================================

log "=========================================="
log "PHASE 4: Project Directory Setup"
log "=========================================="

INSTALL_DIR="/opt/cwopod"
debug "Target install directory: $INSTALL_DIR"

if [ -d "$INSTALL_DIR/.git" ]; then
  log "Project directory exists at $INSTALL_DIR (git repo detected)"
  debug "Git remote: $(git -C "$INSTALL_DIR" remote -v 2>/dev/null | head -1 || echo 'none')"
  debug "Git branch: $(git -C "$INSTALL_DIR" branch --show-current 2>/dev/null || echo 'unknown')"
  debug "Attempting git pull..."
  git -C "$INSTALL_DIR" pull || warn "Git pull failed — using existing files"
elif [ -d "$INSTALL_DIR" ]; then
  log "Project directory exists at $INSTALL_DIR (not a git repo, using as-is)"
  debug "Directory contents (top-level):"
  ls -la "$INSTALL_DIR" | head -20 | while read -r line; do
    debug "  $line"
  done

  # Handle nested directory from scp -r (e.g. /opt/cwopod/project_folder/)
  if [ ! -f "$INSTALL_DIR/docker-compose.yml" ]; then
    debug "docker-compose.yml NOT found at top level — searching for nested project..."
    NESTED=$(find "$INSTALL_DIR" -maxdepth 2 -name "docker-compose.yml" -printf '%h\n' | head -1)
    if [ -n "$NESTED" ]; then
      log "Found project files in nested directory: $NESTED"
      debug "Moving files from $NESTED to $INSTALL_DIR..."
      mv "$NESTED"/* "$INSTALL_DIR"/ 2>/dev/null || true
      mv "$NESTED"/.* "$INSTALL_DIR"/ 2>/dev/null || true
      rmdir "$NESTED" 2>/dev/null || true
      log "Files moved successfully"
    else
      debug "No nested docker-compose.yml found within 2 levels"
    fi
  else
    debug "docker-compose.yml found at $INSTALL_DIR/docker-compose.yml — good"
  fi
else
  debug "Install directory does not exist yet"
  # If this script is inside the project, copy it there
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  debug "Script is running from: $SCRIPT_DIR"
  if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
    log "Copying project from $SCRIPT_DIR to $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR"
    cp -a "$SCRIPT_DIR"/. "$INSTALL_DIR"/
    debug "Copy complete"
    debug "Files in $INSTALL_DIR: $(ls "$INSTALL_DIR" | wc -l) items"
  else
    err "No project files found. Either clone the repo to $INSTALL_DIR first, or run this script from within the project directory."
  fi
fi

cd "$INSTALL_DIR"
debug "Working directory is now: $(pwd)"

# Final check that project files are actually here
if [ ! -f "docker-compose.yml" ]; then
  err "docker-compose.yml not found in $INSTALL_DIR. The project files were not copied correctly."
fi

log "Project files verified at $INSTALL_DIR"
debug "Key files present:"
for f in docker-compose.yml docker-compose.override.yml .env.example .env backend/Dockerfile frontend/Dockerfile; do
  if [ -f "$f" ]; then
    debug "  ✓ $f ($(stat -c%s "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null || echo '?') bytes)"
  else
    debug "  ✗ $f — MISSING"
  fi
done

# ============================================================================
# PHASE 5: Environment Configuration
# ============================================================================

log "=========================================="
log "PHASE 5: Environment Configuration"
log "=========================================="

if [ -f .env ]; then
  # Check if .env has old 'bookstudio' naming — if so, regenerate it
  if grep -q "bookstudio" .env 2>/dev/null; then
    log "Old 'bookstudio' naming found in .env — regenerating..."
    rm -f .env
  else
    log ".env file already exists — preserving existing configuration"
    debug ".env file size: $(stat -c%s .env 2>/dev/null || stat -f%z .env 2>/dev/null || echo '?') bytes"
    debug ".env keys present (values hidden):"
    grep -v '^#' .env | grep -v '^$' | cut -d= -f1 | while read -r key; do
      debug "  $key=***"
    done
  fi
fi

if [ ! -f .env ]; then
  log "Creating .env from .env.example..."
  cp .env.example .env

  debug "Generating SECRET_KEY (openssl rand -hex 32)..."
  SECRET=$(openssl rand -hex 32)
  sed -i "s/change-me-to-a-random-64-char-string/$SECRET/" .env
  debug "SECRET_KEY generated (64 hex chars)"

  debug "Detecting host IP address..."
  HOST_IP=$(hostname -I | awk '{print $1}' || echo "localhost")
  debug "Detected host IP: $HOST_IP"
  sed -i "s|APP_URL=http://localhost:8080|APP_URL=http://${HOST_IP}:8080|" .env

  log ".env configured:"
  log "  SECRET_KEY: (generated, 64 hex chars)"
  log "  APP_URL: http://${HOST_IP}:8080"

  debug "Final .env keys:"
  grep -v '^#' .env | grep -v '^$' | cut -d= -f1 | while read -r key; do
    debug "  $key=***"
  done
fi

# ============================================================================
# PHASE 6: GPU & AI Services Configuration
# ============================================================================

log "=========================================="
log "PHASE 6: GPU & AI Services Configuration"
log "=========================================="

# --- NVIDIA GPU Detection & Userspace Setup ---
# Detect GPU via device nodes (works in LXC even without nvidia-smi installed yet)
GPU_AVAILABLE=false
if [ -e /dev/nvidia0 ] && [ -e /dev/nvidiactl ]; then
  GPU_AVAILABLE=true
  log "NVIDIA GPU device nodes detected (/dev/nvidia0, /dev/nvidiactl)"

  # In a Proxmox LXC, nvidia-smi and NVIDIA libs are bind-mounted from the host.
  # Do NOT install nvidia-utils packages — they cause version mismatches.
  if command -v nvidia-smi &>/dev/null; then
    log "NVIDIA GPU detected: $(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null || echo 'unknown')"
  else
    warn "nvidia-smi not available — ensure NVIDIA libs and nvidia-smi are bind-mounted from the Proxmox host in the LXC config"
    warn "GPU device nodes are present but userspace tools are missing"
  fi

  # Remove any apt-installed nvidia-utils that conflict with bind-mounted host libs
  if dpkg -l nvidia-utils-535-server 2>/dev/null | grep -q "^ii\|^iF\|^rc"; then
    log "Removing conflicting apt-installed nvidia-utils-535-server..."
    dpkg --force-remove-reinstreq --purge nvidia-utils-535-server 2>/dev/null || true
    apt-get autoremove -y 2>/dev/null || true
  fi

  # Clean up stale empty nvidia lib placeholders in /lib (left by previous bad installs)
  for f in /lib/x86_64-linux-gnu/libnvidia-*.so.* /lib/x86_64-linux-gnu/libcuda.so.* /lib/x86_64-linux-gnu/libnvcuvid.so.*; do
    if [ -f "$f" ] && [ ! -s "$f" ]; then
      debug "Removing empty placeholder: $f"
      rm -f "$f"
    fi
  done
  ldconfig 2>/dev/null || true

  # Install NVIDIA Container Toolkit (required for Docker GPU access)
  if dpkg -l nvidia-container-toolkit 2>/dev/null | grep -q "^ii"; then
    log "NVIDIA Container Toolkit already installed — skipping"
    debug "Version: $(dpkg -l nvidia-container-toolkit | grep "^ii" | awk '{print $3}')"
  else
    log "Installing NVIDIA Container Toolkit..."
    debug "Adding NVIDIA container toolkit repository..."
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
    curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
      sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
      tee /etc/apt/sources.list.d/nvidia-container-toolkit.list > /dev/null
    apt-get update
    apt-get install -y nvidia-container-toolkit
    nvidia-ctk runtime configure --runtime=docker --set-as-default
    log "NVIDIA Container Toolkit installed and Docker configured for GPU access"
  fi

  # Configure NVIDIA Container Runtime for LXC compatibility:
  # - no-cgroups=true: skip BPF cgroup device rules (LXC handles this)
  # - mode=legacy: skip CDI library version discovery (bind-mounted libs don't match expected naming)
  if [ -f /etc/nvidia-container-runtime/config.toml ]; then
    sed -i 's/^no-cgroups = false/no-cgroups = true/' /etc/nvidia-container-runtime/config.toml
    grep -q '^no-cgroups = true' /etc/nvidia-container-runtime/config.toml || \
      sed -i '/\[nvidia-container-cli\]/a no-cgroups = true' /etc/nvidia-container-runtime/config.toml
    sed -i 's/mode = "auto"/mode = "legacy"/' /etc/nvidia-container-runtime/config.toml
    debug "NVIDIA container runtime configured: no-cgroups=true, mode=legacy"
  fi

  # Create versioned symlinks for bind-mounted NVIDIA libs (host mounts .so.1, toolkit expects .so.<version>)
  NVIDIA_DRIVER_VERSION=$(cat /proc/driver/nvidia/version 2>/dev/null | grep -oP 'Kernel Module\s+\K[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  if [ -n "$NVIDIA_DRIVER_VERSION" ]; then
    debug "Creating versioned symlinks for NVIDIA driver ${NVIDIA_DRIVER_VERSION}"
    for lib in libcuda libnvidia-ml libnvidia-ptxjitcompiler libnvcuvid libnvidia-encode; do
      if [ -f "/usr/lib/x86_64-linux-gnu/${lib}.so.1" ] && [ ! -f "/usr/lib/x86_64-linux-gnu/${lib}.so.${NVIDIA_DRIVER_VERSION}" ]; then
        ln -sf "/usr/lib/x86_64-linux-gnu/${lib}.so.1" "/usr/lib/x86_64-linux-gnu/${lib}.so.${NVIDIA_DRIVER_VERSION}"
        debug "  Symlinked ${lib}.so.${NVIDIA_DRIVER_VERSION} -> ${lib}.so.1"
      fi
    done
    ldconfig 2>/dev/null || true
  fi

  systemctl restart docker
else
  warn "No NVIDIA GPU detected (no /dev/nvidia0 device node). ComfyUI will NOT work."
  warn "Ollama will run in CPU-only mode."
fi

# --- Docker Compose Override ---
# The repo ships a GPU-enabled override. If no GPU is available, replace it with
# a CPU-only version so Docker doesn't fail requesting the nvidia driver.
if [ "$GPU_AVAILABLE" = true ]; then
  log "GPU available — using GPU-enabled docker-compose.override.yml"
  debug "Services defined in override:"
  grep -E "^\s+\w+:" docker-compose.override.yml 2>/dev/null | while read -r line; do
    debug "  $line"
  done
else
  log "No GPU — generating CPU-only docker-compose.override.yml"
  debug "Backing up original GPU override to docker-compose.override.gpu.yml"
  if [ -f docker-compose.override.yml ]; then
    cp docker-compose.override.yml docker-compose.override.gpu.yml
  fi
  cat > docker-compose.override.yml <<'CPUOVERRIDE'
# CPU-only AI services (auto-generated by install.sh — no NVIDIA GPU detected)
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

  comfyui:
    build:
      context: ./comfyui
      dockerfile: Dockerfile.cpu
    ports:
      - "8188:8188"
    volumes:
      - comfyui_models:/app/models
      - comfyui_output:/app/output
    restart: unless-stopped

volumes:
  ollama_data:
  comfyui_models:
  comfyui_output:
CPUOVERRIDE
  log "CPU-only override written (using Dockerfile.cpu, no GPU reservations)"
  warn "ComfyUI will be slow without a GPU. Ollama will use CPU only."
fi

# ============================================================================
# PHASE 7: Docker Build & Start
# ============================================================================

log "=========================================="
log "PHASE 7: Docker Build & Start"
log "=========================================="

# Detect if this is a fresh install or an update
debug "Checking if services are already running..."
RUNNING_CONTAINERS=$(docker compose ps --quiet 2>/dev/null | wc -l || echo "0")
debug "Running containers from this compose: $RUNNING_CONTAINERS"

if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
  log "Existing deployment detected — stopping services (preserving data volumes)"
  docker compose down --remove-orphans 2>/dev/null || true
fi

# Clean up: stop existing containers, remove dangling resources, but keep images & build cache
log "Cleaning up old containers and dangling resources..."
docker compose down --remove-orphans 2>/dev/null || true

if [ "$HARD_REFRESH" = "true" ]; then
  warn "Hard refresh: removing ALL volumes including AI model data..."
  docker compose down --volumes --remove-orphans 2>/dev/null || true
  docker volume rm $(docker volume ls -q | grep -E "(ollama_data|comfyui_models|comfyui_output)") 2>/dev/null || true
  log "All volumes wiped (models will need to be re-downloaded)"
fi

# Remove dangling images only (untagged leftovers from previous builds)
debug "Removing dangling images..."
docker image prune -f 2>/dev/null || true

# Remove orphan containers not managed by compose
docker container prune -f 2>/dev/null || true

# Clean up unused networks
docker network prune -f 2>/dev/null || true

log "Docker cleanup complete — images, build cache, and data volumes preserved"
debug "Protected volumes (use --hard_refresh to wipe): ollama_data, comfyui_models, comfyui_output, postgres_data, storage_data"

log "Building Docker images..."
debug "Running: docker compose build"
debug "This will use cached layers where possible (Dockerfile + context unchanged = cache hit)"
debug "Services to build:"
debug "  - app (backend/Dockerfile)"
debug "  - worker (backend/Dockerfile — same image as app)"
debug "  - frontend (frontend/Dockerfile)"
debug "  - comfyui (comfyui/Dockerfile — GPU image generation)"
debug "  - db (postgres:16-alpine — pulled, not built)"
debug "  - redis (redis:7-alpine — pulled, not built)"
debug "  - ollama (ollama/ollama:latest — pulled, not built)"

BUILD_START=$(date +%s)
docker compose build 2>&1 | while read -r line; do
  echo -e "${CYAN}  [build]${NC} $line"
done
BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))
log "Docker build completed in ${BUILD_DURATION} seconds"

log "Starting all services..."
debug "Running: docker compose up -d"
docker compose up -d 2>&1 | while read -r line; do
  debug "  up: $line"
done

debug "Waiting 3 seconds for containers to initialize..."
sleep 3

debug "Container status after startup:"
docker compose ps 2>/dev/null | while read -r line; do
  debug "  $line"
done

debug "Docker volume status (your persistent data):"
docker volume ls | grep -E "(postgres_data|storage_data|ollama_data|comfyui_models|comfyui_output)" | while read -r line; do
  debug "  $line"
done

# ============================================================================
# PHASE 8: Health Check
# ============================================================================

log "=========================================="
log "PHASE 8: Health Check"
log "=========================================="

log "Waiting for services to become healthy..."
debug "Health check target: http://localhost:8080/api/health"
debug "Max attempts: 60 (2 seconds apart = 2 minute timeout)"

TRIES=0
MAX_TRIES=60
until curl -sf http://localhost:8080/api/health > /dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ $((TRIES % 5)) -eq 0 ]; then
    debug "  Attempt $TRIES/$MAX_TRIES — not ready yet..."
    debug "  Container states:"
    docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | while read -r line; do
      debug "    $line"
    done
  fi
  if [ $TRIES -ge $MAX_TRIES ]; then
    warn "Health check didn't pass after ${MAX_TRIES} attempts (${MAX_TRIES}x2 = $((MAX_TRIES*2)) seconds)."
    warn "Services may still be starting. Dumping recent logs:"
    warn "--- Backend logs (last 20 lines) ---"
    docker compose logs app --tail 20 2>/dev/null | while read -r line; do
      warn "  $line"
    done
    warn "--- Frontend logs (last 10 lines) ---"
    docker compose logs frontend --tail 10 2>/dev/null | while read -r line; do
      warn "  $line"
    done
    break
  fi
  sleep 2
done

if [ $TRIES -lt $MAX_TRIES ]; then
  log "Health check PASSED after $TRIES attempts ($((TRIES*2)) seconds)"
  debug "Health response:"
  debug "  $(curl -sf http://localhost:8080/api/health 2>/dev/null || echo 'could not fetch')"
fi

# ============================================================================
# PHASE 8.5: Seed Default Admin User
# ============================================================================

log "=========================================="
log "PHASE 8.5: Seed Default Admin User"
log "=========================================="

log "Checking if admin user already exists..."
ADMIN_EXISTS=$(docker compose exec -T db psql -U cwopod -d cwopod -tAc "SELECT count(*) FROM users WHERE email='admin' AND is_admin=true;" 2>/dev/null || echo "0")
debug "Admin user query result: '$ADMIN_EXISTS'"

# Trim whitespace
ADMIN_EXISTS=$(echo "$ADMIN_EXISTS" | tr -d '[:space:]')

if [ "$ADMIN_EXISTS" = "0" ] || [ -z "$ADMIN_EXISTS" ]; then
  log "Creating default admin user (admin / cwopod)..."
  # Use the app container to create the admin via Python to get proper bcrypt hashing
  docker compose exec -T app python3 -c "
import asyncio
import bcrypt
import uuid
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

async def seed_admin():
    from app.config import settings
    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check if admin already exists
        result = await session.execute(
            text(\"SELECT id FROM users WHERE email = 'admin'\")
        )
        if result.scalar_one_or_none():
            print('Admin user already exists, skipping')
            return
        
        # Create admin user
        password_hash = bcrypt.hashpw(b'cwopod', bcrypt.gensalt(rounds=12)).decode('utf-8')
        user_id = str(uuid.uuid4())
        await session.execute(
            text(
                \"INSERT INTO users (id, email, password_hash, display_name, is_admin, created_at, updated_at) \"
                \"VALUES (:id, 'admin', :pw, 'Admin', true, now(), now())\"
            ),
            {'id': user_id, 'pw': password_hash}
        )
        await session.commit()
        print(f'Admin user created: admin (id={user_id})')

asyncio.run(seed_admin())
" 2>&1 | while read -r line; do
    log "  $line"
  done

  if [ $? -eq 0 ]; then
    log "Default admin user seeded successfully"
    log "  Username: admin"
    log "  Password: cwopod"
    log "  ⚠️  CHANGE THIS PASSWORD after first login!"
  else
    warn "Failed to seed admin user. You can create one manually."
  fi
else
  log "Admin user already exists — skipping seed"
fi

# ============================================================================
# PHASE 8.6: Seed Gutenberg Catalog Cache
# ============================================================================

log "=========================================="
log "PHASE 8.6: Seed Gutenberg Catalog Cache"
log "=========================================="

# Check if a pre-built catalog CSV exists in the project
CATALOG_CSV="/opt/cwopod/data/gutenberg_catalog.csv"
if [ -f "$CATALOG_CSV" ]; then
  # Check if the cache is already populated (>= 10000 books)
  CACHE_COUNT=$(docker compose exec -T app python3 -c "
import asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

async def check():
    from app.config import settings
    from app.models.gutenberg_cache import GutenbergBook
    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        result = await session.execute(select(func.count(GutenbergBook.id)))
        count = result.scalar()
        print(count)
    await engine.dispose()

asyncio.run(check())
" 2>/dev/null | tail -1)

  if [ -n "$CACHE_COUNT" ] && [ "$CACHE_COUNT" -ge 10000 ] 2>/dev/null; then
    log "Gutenberg catalog cache already has $CACHE_COUNT books — skipping import"
  else
    log "Importing pre-built Gutenberg catalog from $CATALOG_CSV..."
    CATALOG_SIZE=$(du -h "$CATALOG_CSV" | cut -f1)
    log "  File size: $CATALOG_SIZE"

    # Copy the CSV into the app container and import it
    docker compose cp "$CATALOG_CSV" app:/tmp/gutenberg_catalog.csv 2>&1 | while read -r line; do
      debug "  cp: $line"
    done

    docker compose exec -T app python3 -c "
import asyncio
import csv
import io
import uuid
import time

async def import_catalog():
    from sqlalchemy import text, func, select
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.config import settings
    from app.models.gutenberg_cache import GutenbergBook

    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    start = time.time()
    with open('/tmp/gutenberg_catalog.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            try:
                gid = int(row['gutenberg_id'])
            except (ValueError, TypeError):
                continue
            title = row.get('title', '').strip()
            if not title:
                continue
            pub_year = row.get('publication_year', '').strip()
            dl_count = row.get('download_count', '').strip()
            rows.append({
                'id': uuid.uuid4(),
                'gutenberg_id': gid,
                'title': title,
                'author': row.get('author', '').strip() or None,
                'language': row.get('language', '').strip() or None,
                'publication_year': int(pub_year) if pub_year else None,
                'subjects': row.get('subjects', '').strip() or None,
                'media_type': row.get('media_type', '').strip() or None,
                'download_count': int(dl_count) if dl_count else None,
            })

    print(f'Parsed {len(rows)} books from CSV')

    async with async_session() as session:
        await session.execute(text('TRUNCATE TABLE gutenberg_books'))
        batch_size = 1000
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i+batch_size]
            stmt = pg_insert(GutenbergBook).values(batch)
            await session.execute(stmt)
        await session.commit()

        result = await session.execute(select(func.count(GutenbergBook.id)))
        count = result.scalar()
        elapsed = time.time() - start
        print(f'Imported {count} books in {elapsed:.1f}s')

    await engine.dispose()

asyncio.run(import_catalog())
" 2>&1 | while read -r line; do
      log "  $line"
    done

    if [ $? -eq 0 ]; then
      log "Gutenberg catalog seeded successfully from pre-built CSV"
    else
      warn "Catalog import failed — the background sync will populate it over time"
    fi
  fi
else
  log "No pre-built catalog CSV found at $CATALOG_CSV"
  log "  The catalog will sync from Gutendex in the background (takes 1-2 hours)"
  log "  To speed up future installs: export the cache from Settings > Book Catalog Cache"
  log "  and place the CSV at data/gutenberg_catalog.csv in the project"
fi

# ============================================================================
# PHASE 9: Ollama Model Setup
# ============================================================================

log "=========================================="
log "PHASE 9: Ollama Service Check"
log "=========================================="

log "Checking Ollama service status..."
debug "Ollama API endpoint: http://localhost:11434/api/tags"

TRIES=0
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ $((TRIES % 3)) -eq 0 ]; then
    debug "  Waiting for Ollama... attempt $TRIES/15"
  fi
  if [ $TRIES -ge 15 ]; then
    warn "Ollama not responding after 15 attempts (30 seconds)."
    warn "Ollama container status:"
    docker compose ps ollama 2>/dev/null | while read -r line; do
      warn "  $line"
    done
    warn "Ollama logs (last 10 lines):"
    docker compose logs ollama --tail 10 2>/dev/null | while read -r line; do
      warn "  $line"
    done
    break
  fi
  sleep 2
done

if [ $TRIES -lt 15 ]; then
  log "Ollama is responding"
  debug "Querying Ollama /api/tags..."
  MODELS_RESPONSE=$(curl -sf http://localhost:11434/api/tags 2>/dev/null || echo '{}')

  if echo "$MODELS_RESPONSE" | grep -q "mistral"; then
    log "Ollama has models installed"
  else
    log "No Ollama models installed yet."
    log "Download models from the admin UI: Settings → AI Configuration → Pull"
  fi
fi

# ============================================================================
# PHASE 9.5: ComfyUI Model Check
# ============================================================================

log "=========================================="
log "PHASE 9.5: ComfyUI Model Check"
log "=========================================="

log "Checking ComfyUI service status..."
debug "ComfyUI API endpoint: http://localhost:8188/system_stats"

COMFYUI_READY=false
TRIES=0
until curl -sf http://localhost:8188/system_stats > /dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ $((TRIES % 3)) -eq 0 ]; then
    debug "  Waiting for ComfyUI... attempt $TRIES/30"
  fi
  if [ $TRIES -ge 30 ]; then
    warn "ComfyUI not responding after 30 attempts (60 seconds)."
    warn "ComfyUI container status:"
    docker compose ps comfyui 2>/dev/null | while read -r line; do
      warn "  $line"
    done
    warn "ComfyUI logs (last 10 lines):"
    docker compose logs comfyui --tail 10 2>/dev/null | while read -r line; do
      warn "  $line"
    done
    break
  fi
  sleep 2
done

if [ $TRIES -lt 30 ]; then
  COMFYUI_READY=true
  log "ComfyUI is responding"
fi

# Check if SD 1.5 model is already downloaded
COMFYUI_MODEL="v1-5-pruned-emaonly.safetensors"
MODEL_DIR="/var/lib/docker/volumes/$(docker compose config --format json 2>/dev/null | python3 -c "import sys,json; c=json.load(sys.stdin); print(c.get('name','cwopod'))" 2>/dev/null || echo 'cwopod')_comfyui_models/_data/checkpoints"
MODEL_EXISTS="no"
if [ -f "$MODEL_DIR/$COMFYUI_MODEL" ] 2>/dev/null; then
  MODEL_EXISTS="yes"
fi

if [ "$MODEL_EXISTS" = "yes" ]; then
  log "ComfyUI model '$COMFYUI_MODEL' already present — skipping download"
else
  log "ComfyUI model '$COMFYUI_MODEL' NOT found."
  log "Download it from the admin UI: Settings → Admin → Download a Model"
fi

# ============================================================================
# PHASE 10: Final Summary
# ============================================================================

log "=========================================="
log "PHASE 10: Final Summary"
log "=========================================="

HOST_IP=$(hostname -I | awk '{print $1}' || echo "localhost")

debug "Final container status:"
docker compose ps 2>/dev/null | while read -r line; do
  debug "  $line"
done

debug "Final disk usage:"
df -h / | tail -1 | awk '{print "  Total: "$2" Used: "$3" Available: "$4" Use%: "$5}'

debug "Docker disk usage:"
docker system df 2>/dev/null | while read -r line; do
  debug "  $line"
done

debug "Listening ports:"
ss -tlnp 2>/dev/null | grep -E "(8080|8000|5432|6379|11434|8188)" | while read -r line; do
  debug "  $line"
done

echo ""
echo "============================================================================"
echo -e "${GREEN} CWOPOD is running!${NC}"
echo "============================================================================"
echo ""
echo "  UI:        http://${HOST_IP}:8080"
echo ""
echo "  Default admin login:"
echo "    Username: admin"
echo "    Password: cwopod"
echo "    ⚠️  Change this password after first login!"
echo ""
echo "  AI Models:"
echo "    Text (Ollama):  Download from Settings → AI Configuration → Pull"
echo "    Image (ComfyUI): Download from Settings → Admin → Download a Model"
echo ""
echo "  Project:   $INSTALL_DIR"
echo "  Logs:      docker compose -f $INSTALL_DIR/docker-compose.yml logs -f"
echo "  Stop:      docker compose -f $INSTALL_DIR/docker-compose.yml down"
echo "  Restart:   docker compose -f $INSTALL_DIR/docker-compose.yml up -d"
echo ""
echo "  Re-install (preserves AI models): bash $INSTALL_DIR/install.sh"
echo "  Full wipe (re-downloads models):  bash $INSTALL_DIR/install.sh --hard_refresh"
echo ""
echo "============================================================================"
log "Install script completed at $(date -Iseconds)"
log "Total phases completed: 10/10"
echo ""
echo "  Current time: $(date)"
