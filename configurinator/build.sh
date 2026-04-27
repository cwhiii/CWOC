#!/usr/bin/env bash
set -e

# =============================================================================
# CWOC Server Configurinator — build.sh
#
# Provisions a bare Linux machine (Debian/Ubuntu or Fedora/RHEL) into a fully
# running CWOC (C.W.'s Omni Chits) production server. Handles system package
# installation, directory structure creation, Python virtual environment setup,
# dependency installation, systemd service configuration, and service startup
# with verification.
#
# Usage:  sudo ./build.sh
#
# NOTE: This script does NOT deploy application files (backend/, frontend/,
#       static/ contents). File deployment is handled by cwoc-push.sh.
# =============================================================================

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------

log_step() {
    echo "[STEP] $1"
}

log_ok() {
    echo "[OK]   $1"
}

log_error() {
    echo "[ERROR] $1" >&2
    exit 1
}

# ---------------------------------------------------------------------------
# Phase: Guards
# ---------------------------------------------------------------------------

check_root() {
    if [[ "$EUID" -ne 0 ]]; then
        log_error "This script must be run as root."
    fi
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
        apt-get install -y python3 python3-venv python3-pip sqlite3 \
            || log_error "Failed to install system packages via apt-get."
    elif [[ "$PKG_MGR" == "dnf" ]]; then
        dnf install -y python3 python3-pip sqlite \
            || log_error "Failed to install system packages via dnf."
    fi

    log_ok "System packages installed."
}

# ---------------------------------------------------------------------------
# Phase: Directory structure
# ---------------------------------------------------------------------------

create_directories() {
    log_step "Creating directory structure..."

    mkdir -p /app /app/backend /app/frontend /app/static /app/data \
        || log_error "Failed to create /app directory structure."

    chown -R root:root /app \
        || log_error "Failed to set ownership on /app."

    chmod 700 /app/data \
        || log_error "Failed to set permissions on /app/data."

    log_ok "Directory structure created."
}

# ---------------------------------------------------------------------------
# Phase: Virtual environment
# ---------------------------------------------------------------------------

setup_virtualenv() {
    log_step "Setting up Python virtual environment..."

    if [[ -f /app/venv/bin/python ]]; then
        log_ok "Virtual environment already exists — skipping creation."
        return
    fi

    python3 -m venv /app/venv \
        || log_error "Failed to create virtual environment at /app/venv."

    /app/venv/bin/pip install --upgrade pip \
        || log_error "Failed to upgrade pip in virtual environment."

    log_ok "Virtual environment created and pip upgraded."
}

# ---------------------------------------------------------------------------
# Phase: Python dependencies
# ---------------------------------------------------------------------------

install_python_deps() {
    log_step "Installing Python dependencies..."

    /app/venv/bin/pip install fastapi uvicorn pydantic python-dotenv \
        || log_error "Failed to install Python dependencies via pip."

    log_ok "Python dependencies installed."
}

# ---------------------------------------------------------------------------
# Phase: Systemd service configuration
# ---------------------------------------------------------------------------

configure_service() {
    log_step "Configuring systemd service..."

    # Stop existing service if running (idempotent)
    if systemctl is-active --quiet cwoc 2>/dev/null; then
        log_step "Stopping existing cwoc service..."
        systemctl stop cwoc \
            || log_error "Failed to stop existing cwoc service."
        log_ok "Existing cwoc service stopped."
    fi

    # Write systemd unit file (overwrites if present)
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

    # Reload systemd and enable service
    systemctl daemon-reload \
        || log_error "Failed to run systemctl daemon-reload."
    log_ok "Systemd daemon reloaded."

    systemctl enable cwoc \
        || log_error "Failed to enable cwoc service."
    log_ok "cwoc service enabled for boot."

    log_ok "Systemd service configured."
}

# ---------------------------------------------------------------------------
# Phase: Service startup and verification
# ---------------------------------------------------------------------------

start_and_verify() {
    # Skip service start if application code hasn't been deployed yet
    if [[ ! -f /app/backend/main.py ]]; then
        log_step "Application code not yet deployed (backend/main.py missing)."
        log_ok "Skipping service start. Run cwoc-push.sh to deploy code, then: systemctl start cwoc"
        return
    fi

    log_step "Starting CWOC service..."

    systemctl start cwoc \
        || log_error "Failed to start cwoc service."
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

    # Guards
    check_root
    detect_package_manager
    log_ok "Running as root. Package manager: $PKG_MGR"

    # Provisioning phases
    install_system_packages
    create_directories
    setup_virtualenv
    install_python_deps
    configure_service
    start_and_verify

    echo "============================================="
    echo " Provisioning complete."
    echo "============================================="
}

main "$@"
