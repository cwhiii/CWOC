#!/bin/bash
# =============================================================================
# CWOC Push + Systemd Restart Script (HTTPS Version)
# =============================================================================
SERVER="root@192.168.1.111"
REMOTE_BASE="/app"
DIRECTORIES=(
    "frontend"
    "backend"
    "config"
    "src"
    "static"
)
LOCAL_ROOT="/home/cwhiii/Sync/Secondary Data/Development/CWOC"
RESTART=true
VERBOSE=false
FOLLOW=false

show_help() {
    cat << HELP
Usage: cwoc-push [OPTIONS]
Options:
  -h, --help     Show this help message
  -v, --verbose  Show copied files + recent logs
  --follow       Push + restart + watch live logs (Ctrl+C to stop)
  --no-restart   Push files only
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

echo "🚀 CWOC Push started - $(date)"
echo "Target: $SERVER:$REMOTE_BASE (HTTPS)"
echo "--------------------------------------------------"

for dir in "${DIRECTORIES[@]}"; do
    local_path="$LOCAL_ROOT/$dir"
    if [[ -d "$local_path" ]]; then
        echo "📤 Pushing: $dir ..."
        ssh "$SERVER" "mkdir -p \"$REMOTE_BASE/$dir\""
        if [[ "$VERBOSE" == true ]]; then
            rsync -avzi \
                --rsync-path="mkdir -p \"$REMOTE_BASE/$dir\" && rsync" \
                "$local_path/" "$SERVER:$REMOTE_BASE/$dir/"
        else
            rsync -az \
                --rsync-path="mkdir -p \"$REMOTE_BASE/$dir\" && rsync" \
                "$local_path/" "$SERVER:$REMOTE_BASE/$dir/"
        fi
        echo "✅ Pushed: $dir"
    else
        echo "⚠️ Directory not found: $dir"
    fi
done

# Push root-level files (VERSION, release_notes, etc.)
echo "📤 Pushing: VERSION ..."
rsync -az "$LOCAL_ROOT/VERSION" "$SERVER:$REMOTE_BASE/VERSION"
echo "✅ Pushed: VERSION"

echo "📤 Pushing: release_notes.md ..."
rsync -az "$LOCAL_ROOT/release_notes.md" "$SERVER:$REMOTE_BASE/release_notes.md"
echo "✅ Pushed: release_notes.md"

echo "--------------------------------------------------"

if [[ "$RESTART" == true ]]; then
    echo "🔄 Restarting cwoc.service with HTTPS..."
    ssh "$SERVER" '
        systemctl restart cwoc.service
        if [[ $? -eq 0 ]]; then
            echo "✅ Service restarted successfully (HTTPS)"
            echo "🌐 App should now be at: https://192.168.1.111"
            systemctl status cwoc.service --no-pager -l
        else
            echo "❌ Restart failed"
        fi
    '
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

echo "🎉 All done! - $(date)"
