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

# ── Restart service ───────────────────────────────────────────────────────
if [[ "$RESTART" == true ]]; then
    echo "🔄 Restarting cwoc.service..."
    ssh "$SERVER" '
        # Clear Python bytecode cache so fresh .py files are used
        find /app/src -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null

        systemctl restart cwoc.service
        if [ $? -eq 0 ]; then
            echo "   ✅ Service restarted"

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
        else
            echo "   ❌ Restart failed!"
            systemctl status cwoc.service --no-pager -l
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
