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
log_error() { echo "[ERROR] $1" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Phase: Guards
# ---------------------------------------------------------------------------

check_root() {
    [[ "$EUID" -eq 0 ]] || log_error "This script must be run as root."
}

detect_package_manager() {
    if command -v apt-get &>/dev/null; then
        PKG_MGR="apt"
    elif command -v dnf &>/dev/null; then
        PKG_MGR="dnf"
    else
        log_error "Unsupported OS — neither apt-get nor dnf found."
    fi
}

# ---------------------------------------------------------------------------
# Phase: System packages
# ---------------------------------------------------------------------------

install_system_packages() {
    log_step "Installing system packages..."

    if [[ "$PKG_MGR" == "apt" ]]; then
        apt-get update -y || log_error "Failed to update apt package index."
        apt-get install -y python3 python3-venv python3-pip sqlite3 wget unzip \
            || log_error "Failed to install system packages via apt-get."
    elif [[ "$PKG_MGR" == "dnf" ]]; then
        dnf install -y python3 python3-pip sqlite wget unzip \
            || log_error "Failed to install system packages via dnf."
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
        || log_error "Failed to download $RELEASE_URL"
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
        || log_error "Failed to unzip release."

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
    for dir in backend frontend static; do
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
        || log_error "Failed to create virtual environment at $APP_DIR/venv."

    "$APP_DIR/venv/bin/pip" install --upgrade pip \
        || log_error "Failed to upgrade pip in virtual environment."

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
            || log_error "Failed to install from requirements.txt."
        log_ok "Installed packages from requirements.txt."
    fi

    # Always ensure the known required packages are present, even if
    # requirements.txt is missing or incomplete
    local required_pkgs="fastapi uvicorn pydantic python-dotenv python-multipart"
    "$APP_DIR/venv/bin/pip" install $required_pkgs \
        || log_error "Failed to install required Python packages."
    log_ok "Python dependencies verified: $required_pkgs"
}

# ---------------------------------------------------------------------------
# Phase: Systemd service configuration
# ---------------------------------------------------------------------------

configure_service() {
    log_step "Configuring systemd service..."

    if systemctl is-active --quiet cwoc 2>/dev/null; then
        log_step "Stopping existing cwoc service..."
        systemctl stop cwoc || log_error "Failed to stop existing cwoc service."
        log_ok "Existing cwoc service stopped."
    fi

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

    systemctl daemon-reload || log_error "Failed to run systemctl daemon-reload."
    log_ok "Systemd daemon reloaded."

    systemctl enable cwoc || log_error "Failed to enable cwoc service."
    log_ok "cwoc service enabled for boot."

    log_ok "Systemd service configured."
}

# ---------------------------------------------------------------------------
# Phase: Service startup and verification
# ---------------------------------------------------------------------------

start_and_verify() {
    if [[ ! -f "$APP_DIR/backend/main.py" ]]; then
        log_error "backend/main.py not found at $APP_DIR/backend/main.py — deploy failed."
    fi

    log_step "Starting CWOC service..."
    systemctl start cwoc || log_error "Failed to start cwoc service."
    log_ok "cwoc service started."

    log_step "Waiting 5 seconds for service to stabilize..."
    sleep 5

    log_step "Verifying cwoc service is active..."
    if systemctl is-active --quiet cwoc; then
        MACHINE_IP=$(hostname -I | awk '{print $1}')
        log_ok "CWOC service is running at http://${MACHINE_IP}:3333"
    else
        log_step "Service failed to start. Dumping journal logs..."
        journalctl -u cwoc --no-pager -n 20
        log_error "CWOC service is not active. See journal output above."
    fi
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

    install_system_packages
    deploy_from_zip
    setup_virtualenv
    install_python_deps
    configure_service
    start_and_verify

    echo "============================================="
    echo " Provisioning complete."
    echo "============================================="
}

main "$@"
