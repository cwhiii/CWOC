#!/bin/bash
# =============================================================================
# CWOC Push — deploy local code to the CWOC server and restart
# =============================================================================
clear

SERVER="root@192.168.1.111"
REMOTE_BASE="/app"
LOCAL_ROOT="/home/cwhiii/Sync/Secondary Data/Development/CWOC"

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
echo "--------------------------------------------------"

# ── Sync directories ──────────────────────────────────────────────────────
for dir in "${SYNC_DIRS[@]}"; do
    local_path="$LOCAL_ROOT/$dir"
    if [[ -d "$local_path" ]]; then
        echo "📤 Pushing: $dir/"
        if [[ "$VERBOSE" == true ]]; then
            rsync -avzi --delete \
                --exclude='__pycache__' --exclude='.DS_Store' --exclude='*.pyc' \
                "$local_path/" "$SERVER:$REMOTE_BASE/$dir/"
        else
            rsync -az --delete \
                --exclude='__pycache__' --exclude='.DS_Store' --exclude='*.pyc' \
                "$local_path/" "$SERVER:$REMOTE_BASE/$dir/"
        fi
        echo "   ✅ $dir/"
    else
        echo "   ⚠️  Not found: $dir/"
    fi
done

echo "--------------------------------------------------"

# ── Ensure cryptography package is installed in server venv ───────────────
echo "📦 Ensuring cryptography package..."
ssh -o ConnectTimeout=5 "$SERVER" "/app/venv/bin/pip install cryptography -q" 2>/dev/null
echo "   ✅ cryptography"

# ── Restart service ───────────────────────────────────────────────────────
if [[ "$RESTART" == true ]]; then
    echo "🔄 Restarting cwoc.service..."
    ssh -o ConnectTimeout=5 "$SERVER" '
        # Clear Python bytecode cache so fresh .py files are used
        echo "   🧹 Clearing __pycache__..."
        find /app/src -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
        echo "   ✅ Cache cleared"

        echo "   🔄 Issuing systemctl restart..."
        echo "   ⏳ Stopping old process..."
        systemctl stop cwoc.service 2>&1 | while read -r line; do echo "      $line"; done
        STOP_RC=$?
        if [ $STOP_RC -ne 0 ]; then
            echo "   ⚠️  Stop returned exit code $STOP_RC"
            echo "      $(systemctl is-active cwoc.service 2>&1)"
        else
            echo "   ✅ Old process stopped"
        fi

        echo "   ⏳ Starting new process..."
        systemctl start cwoc.service 2>&1 | while read -r line; do echo "      $line"; done
        RESTART_RC=$?

        if [ $RESTART_RC -ne 0 ]; then
            echo "   ❌ Start failed (exit code $RESTART_RC)"
            echo "   📄 systemctl status:"
            systemctl status cwoc.service --no-pager -l 2>&1 | sed 's/^/      /'
            echo "   📄 Last 15 journal lines:"
            journalctl -u cwoc.service -n 15 --no-hostname --no-pager 2>&1 | sed 's/^/      /'
            echo ""
            echo "   🔁 Retrying start in 2s..."
            sleep 2
            systemctl start cwoc.service 2>&1 | while read -r line; do echo "      $line"; done
            RESTART_RC=$?
            if [ $RESTART_RC -ne 0 ]; then
                echo "   ❌ Retry also failed (exit code $RESTART_RC)"
                echo "   📄 Last 30 journal lines:"
                journalctl -u cwoc.service -n 30 --no-hostname --no-pager 2>&1 | sed 's/^/      /'
                exit 1
            fi
        fi

        if [ $RESTART_RC -eq 0 ]; then
            echo "   ⏳ Waiting for service to stabilize (2s)..."
            sleep 2

            # Check if it actually stayed running
            SVC_STATE=$(systemctl is-active cwoc.service 2>&1)
            if [ "$SVC_STATE" = "active" ]; then
                echo "   ✅ Service running (state: $SVC_STATE)"
            else
                echo "   ❌ Service not running! (state: $SVC_STATE)"
                echo "   📄 Last 20 log lines:"
                journalctl -u cwoc.service -n 20 --no-hostname --no-pager 2>&1 | sed 's/^/      /'
                exit 1
            fi

            # If tailscaled is installed and was active, ensure it stays up
            if command -v tailscale &>/dev/null; then
                systemctl start tailscaled 2>/dev/null
                TS_STATUS=$(tailscale status --json 2>/dev/null)
                if [ $? -ne 0 ]; then
                    echo "   ℹ️  tailscaled running, Tailscale not connected"
                else
                    echo "   ✅ Tailscale still connected"
                fi
            fi

            # If ntfy is installed, ensure it stays running — install if missing
            if command -v ntfy &>/dev/null || [ -f /usr/bin/ntfy ]; then
                systemctl start ntfy 2>/dev/null
                echo "   ✅ Ntfy service running"
            else
                echo "   📦 Ntfy not found — installing..."
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
                            echo "   ✅ Ntfy installed and started"
                        fi
                        rm -rf "$TMP_TAR" "$TMP_DIR"
                    else
                        echo "   ⚠️  Ntfy download timed out (30s) — skipping"
                        rm -f "$TMP_TAR"
                    fi
                fi
            fi
        fi
    '

    # Show deployed version
    echo ""
    echo -n "   📦 Version: "
    ssh "$SERVER" 'cat /app/src/VERSION 2>/dev/null || echo "not found"'
    echo "   🌐 https://192.168.1.111"

    if [[ "$VERBOSE" == true || "$FOLLOW" == true ]]; then
        echo "--------------------------------------------------"
        if [[ "$FOLLOW" == true ]]; then
            echo "📄 Live logs (Ctrl+C to stop)..."
            ssh -t "$SERVER" "journalctl -u cwoc.service -f --no-hostname"
        else
            echo "📄 Recent logs:"
            ssh "$SERVER" "journalctl -u cwoc.service -n 30 --no-hostname"
        fi
    fi
fi

echo "--------------------------------------------------"
echo "🎉 Done — $(date)"
