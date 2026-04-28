#!/usr/bin/env bash
set -e

# =============================================================================
# CWOC Server Configurinator — build.sh
#
# Provisions a bare Linux machine (Debian/Ubuntu or Fedora/RHEL) into a fully
# running CWOC (C.W.'s Omni Chits) production server. Installs system packages,
# downloads the app zip, extracts it, sets up a Python venv, installs deps,
# configures systemd, and starts the service.
#
# Usage:  sudo ./build.sh
# =============================================================================

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

RELEASE_URL="http://cwholemaniii.com/code/cwoc/releases/CWOC.zip"
APP_DIR="/app"

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------

log_step() { echo "[STEP] $1"; }
log_ok()   { echo "[OK]   $1"; }
log_warn() { echo "[WARN] $1"; }
log_error() { echo "[ERROR] $1" >&2; if [[ -n "$2" ]]; then echo "[HINT]  $2" >&2; fi; exit 1; }

# ---------------------------------------------------------------------------
# Phase: Guards
# ---------------------------------------------------------------------------

check_root() {
    [[ "$EUID" -eq 0 ]] || log_error "This script must be run as root." \
        "Run with: sudo bash configurinator.sh"
}

detect_package_manager() {
    if command -v apt-get &>/dev/null; then
        PKG_MGR="apt"
    elif command -v dnf &>/dev/null; then
        PKG_MGR="dnf"
    else
        log_error "Unsupported OS — neither apt-get nor dnf found." \
            "This script requires a Debian/Ubuntu (apt) or Fedora/RHEL (dnf) system."
    fi
}

# ---------------------------------------------------------------------------
# Phase: System packages
# ---------------------------------------------------------------------------

apt_update_safe() {
    # Try normal apt-get update first
    if apt-get update -y 2>/dev/null; then
        return 0
    fi

    # If it failed, check if this is an EOL release with dead repos
    log_warn "apt-get update failed — checking for end-of-life release..."

    if grep -q "archive.ubuntu.com" /etc/apt/sources.list 2>/dev/null; then
        log_step "Switching apt sources to old-releases.ubuntu.com..."
        sed -i 's|http://archive.ubuntu.com/ubuntu|http://old-releases.ubuntu.com/ubuntu|g' /etc/apt/sources.list
        sed -i 's|http://security.ubuntu.com/ubuntu|http://old-releases.ubuntu.com/ubuntu|g' /etc/apt/sources.list
        log_ok "Apt sources updated for EOL release."

        if apt-get update -y; then
            return 0
        fi
    fi

    log_error "Failed to update apt package index." \
        "Check /etc/apt/sources.list and internet connectivity. If your Ubuntu release is EOL, sources should point to old-releases.ubuntu.com."
}

install_system_packages() {
    log_step "Installing system packages..."

    if [[ "$PKG_MGR" == "apt" ]]; then
        apt_update_safe
        apt-get install -y python3 python3-venv python3-pip sqlite3 wget unzip nginx openssl \
            || log_error "Failed to install system packages via apt-get." \
                "Check internet connectivity and that your apt sources are valid."
    elif [[ "$PKG_MGR" == "dnf" ]]; then
        dnf install -y python3 python3-pip sqlite wget unzip nginx openssl \
            || log_error "Failed to install system packages via dnf." \
                "Check internet connectivity and that your dnf repos are configured correctly."
    fi

    log_ok "System packages installed."
}

# ---------------------------------------------------------------------------
# Phase: Download and extract release
# ---------------------------------------------------------------------------

deploy_from_zip() {
    log_step "Downloading CWOC release from $RELEASE_URL..."

    local tmp_zip="/tmp/cwoc-release.zip"

    wget -q -O "$tmp_zip" "$RELEASE_URL" \
        || log_error "Failed to download $RELEASE_URL" \
            "Check internet connectivity and that the release URL is reachable: curl -I $RELEASE_URL"
    log_ok "Downloaded release zip."

    log_step "Extracting to $APP_DIR..."

    # Preserve the data directory (database) across deploys
    if [[ -d "$APP_DIR/data" ]]; then
        log_ok "Preserving existing $APP_DIR/data directory."
    fi

    # Extract into a temp dir first to figure out the zip structure
    local tmp_extract="/tmp/cwoc-extract"
    rm -rf "$tmp_extract"
    mkdir -p "$tmp_extract"
    unzip -qo "$tmp_zip" -d "$tmp_extract" \
        || log_error "Failed to unzip release." \
            "The downloaded file may be corrupt. Try downloading manually: wget -O /tmp/cwoc.zip $RELEASE_URL && file /tmp/cwoc.zip"

    # Detect if zip has a top-level wrapper folder (e.g. CWOC/) or is flat
    local src_dir="$tmp_extract"
    local subdirs
    subdirs=$(find "$tmp_extract" -maxdepth 1 -mindepth 1 -type d)
    local subdir_count
    subdir_count=$(echo "$subdirs" | wc -l)

    # If there's exactly one top-level dir containing backend/, use it
    if [[ "$subdir_count" -eq 1 ]] && [[ -d "$(echo "$subdirs")/backend" ]]; then
        src_dir="$(echo "$subdirs")"
        log_ok "Detected wrapper folder: $(basename "$src_dir")"
    fi

    # Copy app directories into /app (skip data/ to preserve DB)
    for dir in backend frontend static install; do
        if [[ -d "$src_dir/$dir" ]]; then
            rm -rf "$APP_DIR/$dir"
            cp -r "$src_dir/$dir" "$APP_DIR/$dir"
            log_ok "Deployed $dir/"
        else
            log_warn "$dir/ not found in zip — skipping."
        fi
    done

    # Create data dir if it doesn't exist
    mkdir -p "$APP_DIR/data"
    chmod 700 "$APP_DIR/data"

    # Copy requirements.txt if present
    if [[ -f "$src_dir/requirements.txt" ]]; then
        cp "$src_dir/requirements.txt" "$APP_DIR/requirements.txt"
        log_ok "Copied requirements.txt"
    fi

    # Copy VERSION file if present
    if [[ -f "$src_dir/VERSION" ]]; then
        cp "$src_dir/VERSION" "$APP_DIR/VERSION"
        log_ok "Copied VERSION file ($(cat "$APP_DIR/VERSION" | head -1))"
    fi

    # Cleanup
    rm -rf "$tmp_zip" "$tmp_extract"

    log_ok "Application code deployed."
}

# ---------------------------------------------------------------------------
# Phase: Virtual environment
# ---------------------------------------------------------------------------

setup_virtualenv() {
    log_step "Setting up Python virtual environment..."

    if [[ -f "$APP_DIR/venv/bin/python" ]]; then
        log_ok "Virtual environment already exists — skipping creation."
        return
    fi

    python3 -m venv "$APP_DIR/venv" \
        || log_error "Failed to create virtual environment at $APP_DIR/venv." \
            "Ensure python3-venv is installed: apt-get install -y python3-venv"

    "$APP_DIR/venv/bin/pip" install --upgrade pip \
        || log_error "Failed to upgrade pip in virtual environment." \
            "Check internet connectivity. The venv may be corrupt — try: rm -rf $APP_DIR/venv && re-run."

    log_ok "Virtual environment created and pip upgraded."
}

# ---------------------------------------------------------------------------
# Phase: Python dependencies
# ---------------------------------------------------------------------------

install_python_deps() {
    log_step "Installing Python dependencies..."

    "$APP_DIR/venv/bin/pip" install --upgrade pip 2>/dev/null

    # Install from requirements.txt if present
    if [[ -f "$APP_DIR/requirements.txt" ]]; then
        "$APP_DIR/venv/bin/pip" install --upgrade -r "$APP_DIR/requirements.txt" \
            || log_error "Failed to install from requirements.txt." \
                "Check internet connectivity. Review $APP_DIR/requirements.txt for invalid package names."
        log_ok "Installed packages from requirements.txt."
    fi

    # Always ensure the known required packages are present, even if
    # requirements.txt is missing or incomplete
    local required_pkgs="fastapi uvicorn pydantic python-dotenv python-multipart websockets"
    "$APP_DIR/venv/bin/pip" install $required_pkgs \
        || log_error "Failed to install required Python packages." \
            "Check internet connectivity. Try manually: $APP_DIR/venv/bin/pip install $required_pkgs"
    log_ok "Python dependencies verified: $required_pkgs"
}

# ---------------------------------------------------------------------------
# Phase: Systemd service configuration
# ---------------------------------------------------------------------------

configure_service() {
    log_step "Configuring systemd service..."

    # Don't stop the service here — it will be restarted at the end.
    # Stopping it now would kill the SSE stream if running from the web UI.

    cat > /etc/systemd/system/cwoc.service <<'EOF'
[Unit]
Description=CWOC FastAPI Backend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/app
Environment="PATH=/app/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/app/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 3333 --log-level debug
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    log_ok "Unit file written to /etc/systemd/system/cwoc.service."

    systemctl daemon-reload || log_error "Failed to run systemctl daemon-reload." \
        "Check that systemd is running. This script requires a systemd-based Linux system."
    log_ok "Systemd daemon reloaded."

    systemctl enable cwoc || log_error "Failed to enable cwoc service." \
        "Check /etc/systemd/system/cwoc.service for syntax errors."
    log_ok "cwoc service enabled for boot."

    log_ok "Systemd service configured."
}

# ---------------------------------------------------------------------------
# Phase: HTTPS reverse proxy (nginx + self-signed cert)
# ---------------------------------------------------------------------------

configure_https() {
    log_step "Configuring HTTPS reverse proxy..."

    # Install nginx if not present
    if ! command -v nginx &>/dev/null; then
        log_step "Installing nginx..."
        if [[ "$PKG_MGR" == "apt" ]]; then
            apt_update_safe
            DEBIAN_FRONTEND=noninteractive apt-get install -y nginx \
                || log_error "Failed to install nginx." \
                    "Try manually: apt-get install -y nginx"
        elif [[ "$PKG_MGR" == "dnf" ]]; then
            dnf install -y nginx \
                || log_error "Failed to install nginx." \
                    "Try manually: dnf install -y nginx"
        fi
        log_ok "nginx installed."
    else
        log_ok "nginx already installed."
    fi

    # Generate self-signed cert if not present
    local cert_dir="/etc/ssl/cwoc"
    if [[ ! -f "$cert_dir/cwoc.crt" ]] || [[ ! -f "$cert_dir/cwoc.key" ]]; then
        log_step "Generating self-signed SSL certificate..."
        mkdir -p "$cert_dir"
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout "$cert_dir/cwoc.key" \
            -out "$cert_dir/cwoc.crt" \
            -subj "/CN=cwoc/O=CWOC/C=US" 2>/dev/null \
            || log_error "Failed to generate self-signed certificate." \
                "Ensure openssl is installed: apt-get install -y openssl"
        log_ok "Self-signed certificate created (valid 10 years)."
    else
        log_ok "SSL certificate already exists — keeping it."
    fi

    # Write nginx config
    cat > /etc/nginx/sites-available/cwoc <<'NGINX_EOF'
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate     /etc/ssl/cwoc/cwoc.crt;
    ssl_certificate_key /etc/ssl/cwoc/cwoc.key;

    # WebSocket endpoint — needs upgrade headers
    location /ws/ {
        proxy_pass http://127.0.0.1:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3333;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }
}
NGINX_EOF

    log_ok "nginx config written."

    # Enable the site
    ln -sf /etc/nginx/sites-available/cwoc /etc/nginx/sites-enabled/cwoc 2>/dev/null
    # Remove default site if it exists
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null

    # Test and reload nginx
    nginx -t 2>/dev/null \
        || log_error "nginx config test failed." \
            "Check: nginx -t for details."

    systemctl enable nginx 2>/dev/null
    systemctl reload nginx 2>/dev/null || systemctl start nginx \
        || log_error "Failed to start nginx." \
            "Check: systemctl status nginx and journalctl -u nginx"

    log_ok "HTTPS reverse proxy configured (https://$(hostname -I | awk '{print $1}'))."
}

# ---------------------------------------------------------------------------
# Phase: Service startup and verification
# ---------------------------------------------------------------------------

start_and_verify() {
    if [[ ! -f "$APP_DIR/backend/main.py" ]]; then
        log_error "backend/main.py not found at $APP_DIR/backend/main.py — deploy failed." \
            "The release zip may not contain the expected file structure. Check: ls -la $APP_DIR/backend/"
    fi

    log_ok "Upgrade complete — service will restart automatically."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
    echo "============================================="
    echo " CWOC Server Configurinator"
    echo "============================================="

    check_root
    detect_package_manager
    log_ok "Running as root. Package manager: $PKG_MGR"

    # If CWOC is already installed, skip system packages and venv creation
    if [[ -f "$APP_DIR/backend/main.py" ]] && [[ -f "$APP_DIR/venv/bin/python" ]]; then
        log_ok "Existing CWOC installation detected — running upgrade only."

        # Ensure required tools are available (they may be missing if the
        # original install was done on a different image)
        local missing=""
        for cmd in wget unzip nginx openssl; do
            if ! command -v "$cmd" &>/dev/null; then
                missing="$missing $cmd"
            fi
        done
        if [[ -n "$missing" ]]; then
            log_step "Installing missing tools:$missing"
            if [[ "$PKG_MGR" == "apt" ]]; then
                apt_update_safe && apt-get install -y $missing \
                    || log_error "Failed to install missing tools:$missing" \
                        "Try manually: apt-get install -y$missing"
            elif [[ "$PKG_MGR" == "dnf" ]]; then
                dnf install -y $missing \
                    || log_error "Failed to install missing tools:$missing" \
                        "Try manually: dnf install -y$missing"
            fi
        fi

        deploy_from_zip
        install_python_deps
        configure_service
        configure_https
        start_and_verify
    else
        log_step "No existing installation found — running full provisioning."
        install_system_packages
        deploy_from_zip
        setup_virtualenv
        install_python_deps
        configure_service
        configure_https
        start_and_verify
    fi

    echo "============================================="
    echo " Provisioning complete."
    echo "============================================="
}

main "$@"
