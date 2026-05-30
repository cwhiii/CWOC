#!/bin/bash
# =============================================================================
# CWOC Push — deploy local code to the CWOC server and restart
# Uses SSH ControlMaster so you only authenticate ONCE.
# =============================================================================
clear

SERVER="root@192.168.1.111"
REMOTE_BASE="/app"
LOCAL_ROOT="/home/cwhiii/Sync/Secondary Data/Development/CWOC"

# ── SSH Multiplexing Setup ────────────────────────────────────────────────
# All ssh/rsync calls reuse a single connection via ControlMaster socket.
SSH_SOCK="/tmp/cwoc-push-ssh-$$"
SSH_OPTS="-o ControlMaster=auto -o ControlPath=$SSH_SOCK -o ControlPersist=60 -o ConnectTimeout=5"

# Open the master connection (this is the ONE password prompt)
ssh -o ControlMaster=yes -o ControlPath="$SSH_SOCK" -o ControlPersist=60 -o ConnectTimeout=10 -fN "$SERVER"
if [[ $? -ne 0 ]]; then
    echo "❌ Failed to establish SSH connection to $SERVER"
    exit 1
fi

# Cleanup: close the master connection on exit
cleanup() {
    ssh -o ControlPath="$SSH_SOCK" -O exit "$SERVER" 2>/dev/null
    rm -f "$SSH_SOCK"
}
trap cleanup EXIT

# Helper: run ssh with multiplexing
run_ssh() {
    ssh -o ControlPath="$SSH_SOCK" "$SERVER" "$@"
}

# Directories to sync to the server
SYNC_DIRS=(
    "src"
    "documents"
    "install"
)

RESTART=true
VERBOSE=false
FOLLOW=false

show_help() {
    cat << 'HELP'
Usage: cwoc-push [OPTIONS]
Options:
  -h, --help     Show this help message
  -v, --verbose  Show copied files + recent logs after restart
  --follow       Push + restart + watch live logs (Ctrl+C to stop)
  --no-restart   Push files only, skip service restart
HELP
}

for arg in "$@"; do
    case $arg in
        -h|--help) show_help; exit 0 ;;
        -v|--verbose) VERBOSE=true ;;
        --follow) FOLLOW=true ;;
        --no-restart) RESTART=false ;;
        *) echo "Unknown option: $arg"; echo "Use cwoc-push -h"; exit 1 ;;
    esac
done

echo "🚀 CWOC Push — $(date)"
echo "   Target: $SERVER:$REMOTE_BASE"
echo ""
echo "══════════════════════════════════════════════════"
echo "  STAGE: File Sync"
echo "══════════════════════════════════════════════════"
echo ""

# ── Sync directories ──────────────────────────────────────────────────────
for dir in "${SYNC_DIRS[@]}"; do
    local_path="$LOCAL_ROOT/$dir"
    if [[ -d "$local_path" ]]; then
        echo "📤 Pushing: $dir/"
        if [[ "$VERBOSE" == true ]]; then
            rsync -avzi --delete \
                --exclude='__pycache__' --exclude='.DS_Store' --exclude='*.pyc' \
                -e "ssh -o ControlPath=$SSH_SOCK" \
                "$local_path/" "$SERVER:$REMOTE_BASE/$dir/"
        else
            rsync -az --delete \
                --exclude='__pycache__' --exclude='.DS_Store' --exclude='*.pyc' \
                -e "ssh -o ControlPath=$SSH_SOCK" \
                "$local_path/" "$SERVER:$REMOTE_BASE/$dir/"
        fi
        echo "   ✅ $dir/"
    else
        echo "   ⚠️  Not found: $dir/"
    fi
done

echo ""
echo "══════════════════════════════════════════════════"
echo "  STAGE: Dependencies"
echo "══════════════════════════════════════════════════"
echo ""

# ── Ensure cryptography package is installed in server venv ───────────────
echo "📦 Ensuring cryptography package..."
run_ssh "/app/venv/bin/pip install cryptography -q" 2>/dev/null
echo "   ✅ cryptography"

# ── Restart service ───────────────────────────────────────────────────────
if [[ "$RESTART" == true ]]; then
    echo ""
    echo "══════════════════════════════════════════════════"
    echo "  STAGE: Service Restart"
    echo "══════════════════════════════════════════════════"
    echo ""

    # ── Enable upgrade page so users see "upgrading" instead of 502 ──
    echo "📋 [1/6] Enabling upgrade page..."
    run_ssh '
        if [ -f /app/src/static/upgrading.html ]; then
            cp /app/src/static/upgrading.html /app/src/static/cwoc-502.html
            echo "   ✅ Upgrade page active — users will see friendly message"
        else
            echo "   ⚠️  upgrading.html not found — skipping"
        fi
    '

    # ── Clear bytecode cache ──
    echo ""
    echo "🧹 [2/6] Clearing Python bytecode cache..."
    run_ssh '
        find /app/src -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
        echo "   ✅ Cache cleared"
    '

    # ── Stop old process ──
    echo ""
    echo "⏹️  [3/6] Stopping old process..."
    run_ssh '
        # Give it 5 seconds to stop gracefully, then force-kill
        timeout 5 systemctl stop cwoc.service 2>/dev/null
        STOP_RC=$?
        if [ $STOP_RC -eq 124 ]; then
            echo "   ⚠️  Graceful stop timed out (5s) — force killing..."
            systemctl kill -s SIGKILL cwoc.service 2>/dev/null
            sleep 1
            echo "   ✅ Process force-killed"
        elif [ $STOP_RC -ne 0 ]; then
            echo "   ⚠️  Stop returned exit code $STOP_RC"
            echo "      State: $(systemctl is-active cwoc.service 2>&1)"
        else
            echo "   ✅ Old process stopped"
        fi
    '

    # ── Start new process ──
    echo ""
    echo "▶️  [4/6] Starting new process..."
    run_ssh '
        systemctl start cwoc.service 2>&1 | while read -r line; do echo "      $line"; done
        RESTART_RC=$?

        if [ $RESTART_RC -ne 0 ]; then
            echo "   ❌ Start failed (exit code $RESTART_RC)"
            echo "   📄 systemctl status:"
            systemctl status cwoc.service --no-pager -l 2>&1 | sed "s/^/      /"
            echo "   📄 Last 15 journal lines:"
            journalctl -u cwoc.service -n 15 --no-hostname --no-pager 2>&1 | sed "s/^/      /"
            echo ""
            echo "   🔁 Retrying start in 2s..."
            sleep 2
            systemctl start cwoc.service 2>&1 | while read -r line; do echo "      $line"; done
            RESTART_RC=$?
            if [ $RESTART_RC -ne 0 ]; then
                echo "   ❌ Retry also failed (exit code $RESTART_RC)"
                echo "   📄 Last 30 journal lines:"
                journalctl -u cwoc.service -n 30 --no-hostname --no-pager 2>&1 | sed "s/^/      /"
                exit 1
            fi
        fi

        echo "   ⏳ Waiting for service to stabilize (2s)..."
        sleep 2

        SVC_STATE=$(systemctl is-active cwoc.service 2>&1)
        if [ "$SVC_STATE" = "active" ]; then
            echo "   ✅ Service running (state: $SVC_STATE)"
        else
            echo "   ❌ Service not running! (state: $SVC_STATE)"
            echo "   📄 Last 20 log lines:"
            journalctl -u cwoc.service -n 20 --no-hostname --no-pager 2>&1 | sed "s/^/      /"
            exit 1
        fi
    '
    START_RC=$?

    if [[ $START_RC -ne 0 ]]; then
        echo ""
        echo "══════════════════════════════════════════════════"
        echo "  ❌ DEPLOY FAILED — SERVICE DID NOT START"
        echo "══════════════════════════════════════════════════"
        echo "   The code was deployed but the service crashed."
        echo "   Check the logs above for the error."
        echo "--------------------------------------------------"
        echo "💀 Failed — $(date)"
        exit 1
    fi

    # ── Disable upgrade page — restore normal 502 ──
    echo ""
    echo "📋 [5/6] Disabling upgrade page..."
    run_ssh '
        if [ -f /app/src/static/502.html ]; then
            HOSTNAME_VAL=$(hostname 2>/dev/null || echo "cwoc-server")
            sed "s/__HOSTNAME__/$HOSTNAME_VAL/g" /app/src/static/502.html > /app/src/static/cwoc-502.html
            echo "   ✅ Normal 502 page restored (hostname: $HOSTNAME_VAL)"
        else
            echo "   ⚠️  502.html not found — skipping"
        fi
    '

    # ── Verify companion services ──
    echo ""
    echo "🔗 [6/6] Checking companion services..."
    run_ssh '
        # Tailscale
        if command -v tailscale &>/dev/null; then
            systemctl start tailscaled 2>/dev/null
            TS_STATUS=$(tailscale status --json 2>/dev/null)
            if [ $? -ne 0 ]; then
                echo "   ℹ️  Tailscale: daemon running, not connected"
            else
                echo "   ✅ Tailscale: connected"
            fi
        else
            echo "   ── Tailscale: not installed"
        fi

        # Ntfy
        if command -v ntfy &>/dev/null || [ -f /usr/bin/ntfy ]; then
            systemctl start ntfy 2>/dev/null
            echo "   ✅ Ntfy: running"
        else
            echo "   📦 Ntfy: not found — installing..."
            ARCH=$(uname -m)
            case "$ARCH" in
                x86_64)  ARCH="amd64" ;;
                aarch64) ARCH="arm64" ;;
                armv7l)  ARCH="armv7" ;;
                *)       ARCH="" ;;
            esac
            if [ -n "$ARCH" ]; then
                NTFY_VER="v2.11.0"
                NTFY_URL="https://github.com/binwiederhier/ntfy/releases/download/${NTFY_VER}/ntfy_${NTFY_VER#v}_linux_${ARCH}.tar.gz"
                TMP_TAR="/tmp/ntfy.tar.gz"
                TMP_DIR="/tmp/ntfy-extract"
                if timeout 30 wget -q -O "$TMP_TAR" "$NTFY_URL" 2>/dev/null; then
                    rm -rf "$TMP_DIR"
                    mkdir -p "$TMP_DIR"
                    tar -xzf "$TMP_TAR" -C "$TMP_DIR" 2>/dev/null
                    NTFY_BIN=$(find "$TMP_DIR" -name "ntfy" -type f | head -1)
                    if [ -n "$NTFY_BIN" ]; then
                        cp "$NTFY_BIN" /usr/bin/ntfy
                        chmod +x /usr/bin/ntfy
                        cat > /etc/systemd/system/ntfy.service << NTFYEOF
[Unit]
Description=Ntfy Push Notification Server
After=network.target
[Service]
Type=simple
ExecStart=/usr/bin/ntfy serve --listen-http :2586
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
NTFYEOF
                        systemctl daemon-reload
                        systemctl enable ntfy 2>/dev/null
                        systemctl start ntfy 2>/dev/null
                        echo "   ✅ Ntfy: installed and started"
                    fi
                    rm -rf "$TMP_TAR" "$TMP_DIR"
                else
                    echo "   ⚠️  Ntfy: download timed out (30s) — skipping"
                    rm -f "$TMP_TAR"
                fi
            fi
        fi

        # Nginx
        if systemctl is-active nginx &>/dev/null; then
            echo "   ✅ Nginx: running"
        else
            systemctl start nginx 2>/dev/null
            echo "   🔄 Nginx: restarted"
        fi

        # Restic
        if command -v restic &>/dev/null || [ -f /usr/bin/restic ]; then
            echo "   ✅ Restic: installed ($(restic version 2>/dev/null | head -1))"
        else
            echo "   📦 Restic: not found — installing..."
            ARCH=$(uname -m)
            case "$ARCH" in
                x86_64)  ARCH="amd64" ;;
                aarch64) ARCH="arm64" ;;
                *)       ARCH="" ;;
            esac
            if [ -n "$ARCH" ]; then
                RESTIC_VER="0.17.3"
                RESTIC_URL="https://github.com/restic/restic/releases/download/v${RESTIC_VER}/restic_${RESTIC_VER}_linux_${ARCH}.bz2"
                TMP_BZ2="/tmp/restic.bz2"
                if timeout 30 wget -q -O "$TMP_BZ2" "$RESTIC_URL" 2>/dev/null; then
                    bunzip2 -f "$TMP_BZ2" 2>/dev/null
                    if [ -f /tmp/restic ]; then
                        cp /tmp/restic /usr/bin/restic
                        chmod +x /usr/bin/restic
                        rm -f /tmp/restic
                        if restic version &>/dev/null; then
                            echo "   ✅ Restic: installed ($(restic version 2>/dev/null | head -1))"
                        else
                            echo "   ⚠️  Restic: binary installed but not working"
                        fi
                    else
                        echo "   ⚠️  Restic: decompress failed — skipping"
                        rm -f "$TMP_BZ2"
                    fi
                else
                    echo "   ⚠️  Restic: download timed out (30s) — skipping"
                    rm -f "$TMP_BZ2"
                fi
            else
                echo "   ⚠️  Restic: unsupported architecture ($ARCH) — skipping"
            fi
        fi
    '

    # ── Summary ──
    echo ""
    echo "══════════════════════════════════════════════════"
    echo "  DEPLOY COMPLETE"
    echo "══════════════════════════════════════════════════"
    echo -n "   📦 Version: "
    run_ssh 'cat /app/src/VERSION 2>/dev/null || echo "not found"'
    echo "   🌐 https://192.168.1.111"

    if [[ "$VERBOSE" == true || "$FOLLOW" == true ]]; then
        echo "--------------------------------------------------"
        if [[ "$FOLLOW" == true ]]; then
            echo "📄 Live logs (Ctrl+C to stop)..."
            ssh -o ControlPath="$SSH_SOCK" -t "$SERVER" "journalctl -u cwoc.service -f --no-hostname"
        else
            echo "📄 Recent logs:"
            run_ssh "journalctl -u cwoc.service -n 30 --no-hostname"
        fi
    fi
fi

echo "--------------------------------------------------"
PUSHED_VERSION=$(run_ssh 'cat /app/src/VERSION 2>/dev/null || echo "unknown"')
echo "🎉 Done — $(date)"
echo "   📦 Deployed version: $PUSHED_VERSION"
