#!/usr/bin/env bash
# ============================================================================
# CWOPOD — Quick Update Script (run from your Mac)
# Usage: ./update.sh <LXC_IP>
# 
# This syncs your local code to the server and rebuilds only what changed.
# Your database, stored books, and AI models are preserved.
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[CWOPOD $(date '+%H:%M:%S')]${NC} $1"; }
debug(){ echo -e "${CYAN}[DEBUG $(date '+%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN $(date '+%H:%M:%S')]${NC} $1"; }
err()  { echo -e "${RED}[ERROR $(date '+%H:%M:%S')]${NC} $1"; exit 1; }

if [ -z "${1:-}" ]; then
  err "Usage: ./update.sh <LXC_IP>\n  Example: ./update.sh 192.168.1.50"
fi

TARGET="$1"
REMOTE_DIR="/opt/cwopod"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_SOCKET="/tmp/cwopod-ssh-${TARGET}"

log "Update configuration:"
debug "  Target: root@${TARGET}"
debug "  Remote: ${REMOTE_DIR}"
debug "  Local:  ${SCRIPT_DIR}"

# ============================================================================
# Set up SSH multiplexing — one password prompt for the entire session
# ============================================================================

log "Establishing SSH connection (enter password once)..."

# Start a persistent SSH master connection
ssh -o ControlMaster=yes \
    -o ControlPath="$SSH_SOCKET" \
    -o ControlPersist=300 \
    -o ConnectTimeout=10 \
    -fN "root@${TARGET}" || err "Cannot connect to root@${TARGET} via SSH."

log "SSH connection established — reusing for all operations"

# Use this socket for all subsequent SSH/rsync/scp calls
SSH_OPTS="-o ControlPath=$SSH_SOCKET"

# Clean up the SSH socket on exit
cleanup() {
  ssh -o ControlPath="$SSH_SOCKET" -O exit "root@${TARGET}" 2>/dev/null || true
}
trap cleanup EXIT

# ============================================================================
# Quick remote checks
# ============================================================================

debug "Remote disk: $(ssh $SSH_OPTS "root@${TARGET}" "df -h / | tail -1")"

# ============================================================================
# File Sync (rsync)
# ============================================================================

log "Syncing code to ${TARGET}:${REMOTE_DIR}..."

SYNC_START=$(date +%s)

rsync -avz --delete \
  -e "ssh $SSH_OPTS" \
  --exclude '.env' \
  --exclude '.cwopod_migrated' \
  --exclude 'node_modules/' \
  --exclude '__pycache__/' \
  --exclude '.git/' \
  --exclude '*.pyc' \
  --exclude '.venv/' \
  --exclude '.kiro/' \
  --exclude '.vscode/' \
  "$SCRIPT_DIR/" "root@${TARGET}:${REMOTE_DIR}/" 2>&1 | tail -3

SYNC_END=$(date +%s)
log "File sync completed in $((SYNC_END - SYNC_START)) seconds"

# ============================================================================
# Run install script on server
# ============================================================================

log "Running install script on ${TARGET}..."
ssh $SSH_OPTS "root@${TARGET}" "chmod +x ${REMOTE_DIR}/install.sh && bash ${REMOTE_DIR}/install.sh"

# ============================================================================
# Post-update verification
# ============================================================================

log "Verifying deployment..."
ssh $SSH_OPTS "root@${TARGET}" "docker compose -f ${REMOTE_DIR}/docker-compose.yml ps --format 'table {{.Name}}\t{{.Status}}'"

sleep 3
if curl -sf "http://${TARGET}:8080/api/health" > /dev/null 2>&1; then
  log "Health check — PASSED"
else
  warn "Health check failed — service may still be starting"
fi

echo ""
echo "============================================================================"
echo -e "${GREEN} Update complete!${NC}"
echo "============================================================================"
echo ""
echo "  Web UI: http://${TARGET}:8080"
echo ""
