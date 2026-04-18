#!/bin/bash
# =============================================================================
# CWOC Push Script - Multiple Directories (Local → Server)
# Password entered only ONCE
# =============================================================================

SERVER="root@192.168.1.111"
REMOTE_BASE="/app"

# === DIRECTORIES TO PUSH (edit this list) ===
DIRECTORIES=(
    "data"
    "config"
    "src"
    "static"
    # Add more here:
    # "models"
    # "logs"
)

LOCAL_ROOT="/home/cwhiii/Sync/Secondary Data/Development/CWOC"

echo "🚀 CWOC Push started - $(date)"
echo "Target: $SERVER:$REMOTE_BASE"
echo "Pushing: ${DIRECTORIES[*]}"
echo "--------------------------------------------------"

# Enable SSH connection reuse (password only once)
ssh -o ControlMaster=auto -o ControlPersist=10m -o ControlPath=~/.ssh/cm-%r@%h:%p "$SERVER" "echo 'SSH connection established'" || {
    echo "❌ Failed to connect to server"
    exit 1
}

for dir in "${DIRECTORIES[@]}"; do
    local_path="$LOCAL_ROOT/$dir"

    if [[ -d "$local_path" ]]; then
        echo "📤 Pushing: $dir ..."

        rsync -avz --delete \
            -e "ssh -o ControlPath=~/.ssh/cm-%r@%h:%p" \
            "$local_path/" "$SERVER:$REMOTE_BASE/$dir/"

        if [[ $? -eq 0 ]]; then
            echo "✅ Successfully pushed: $dir"
        else
            echo "❌ Failed to push: $dir"
        fi
    else
        echo "⚠️  Warning: Directory not found locally: $dir"
    fi
done

echo "--------------------------------------------------"
echo "✅ All pushes completed - $(date)"
