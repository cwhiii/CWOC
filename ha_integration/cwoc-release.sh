#!/usr/bin/env bash
set -e

# ==============================================================================
# cwoc-release.sh — Build & upload CWOC server zip, optionally sync HA integration
# ==============================================================================

LOG_PREFIX="[cwoc-release]"

# --- Argument defaults --------------------------------------------------------
FLAG_HA=false
FLAG_PUSH=false
FLAG_HELP=false

# --- Argument parsing ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --ha)
            FLAG_HA=true
            shift
            ;;
        --push)
            FLAG_PUSH=true
            shift
            ;;
        --help)
            FLAG_HELP=true
            shift
            ;;
        *)
            echo "$LOG_PREFIX ERROR: Unknown option: $1"
            echo "Run with --help for usage information."
            exit 1
            ;;
    esac
done

# --- Help output --------------------------------------------------------------
if [[ "$FLAG_HELP" == true ]]; then
    cat <<EOF
Usage: cwoc-release.sh [OPTIONS]

Options:
  --ha          Sync HA integration to public repo after zip upload
  --push        (requires --ha) Auto-commit, push, and tag the public repo
  --help        Show this help message

Environment:
  Reads FTP credentials from ~/.cwoc-release.conf
  Reads version from src/VERSION (used for both CWOC zip and HA integration)
  Public repo path: ../cwoc-ha-integration (sibling directory)
EOF
    exit 0
fi

# --- Validate flag combinations -----------------------------------------------
if [[ "$FLAG_PUSH" == true && "$FLAG_HA" == false ]]; then
    echo "$LOG_PREFIX ERROR: --push requires --ha"
    exit 1
fi

# --- Resolve script directory (repo root) -------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ==============================================================================
# Phase 1: Validation
# ==============================================================================

# --- Check src/VERSION exists and is non-empty --------------------------------
VERSION_FILE="$REPO_ROOT/src/VERSION"
if [[ ! -f "$VERSION_FILE" ]] || [[ ! -s "$VERSION_FILE" ]]; then
    echo "$LOG_PREFIX ERROR: src/VERSION not found or empty"
    exit 1
fi
VERSION=$(cat "$VERSION_FILE")

# --- Check FTP config exists and source it ------------------------------------
CONFIG_FILE="$HOME/.cwoc-release.conf"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "$LOG_PREFIX ERROR: FTP config not found at ~/.cwoc-release.conf"
    exit 1
fi
source "$CONFIG_FILE"

# --- Check required source directories exist ----------------------------------
REQUIRED_DIRS=("src" "install" "documents" "ha_integration")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [[ ! -d "$REPO_ROOT/$dir" ]]; then
        echo "$LOG_PREFIX ERROR: Required directory not found: $dir"
        exit 1
    fi
done

# --- If --ha: check public repo path exists -----------------------------------
PUBLIC_REPO_PATH="${PUBLIC_REPO_PATH:-../cwoc-ha-integration}"
if [[ "$FLAG_HA" == true ]]; then
    # Resolve relative to repo root
    PUBLIC_REPO_RESOLVED="$(cd "$REPO_ROOT" && cd "$(dirname "$PUBLIC_REPO_PATH")" 2>/dev/null && pwd)/$(basename "$PUBLIC_REPO_PATH")" 2>/dev/null || PUBLIC_REPO_RESOLVED="$REPO_ROOT/$PUBLIC_REPO_PATH"
    if [[ ! -d "$PUBLIC_REPO_RESOLVED" ]]; then
        echo "$LOG_PREFIX ERROR: Public repo not found at $PUBLIC_REPO_PATH"
        exit 1
    fi
fi

# ==============================================================================
# Phase 2: Build zip
# ==============================================================================
echo "$LOG_PREFIX Building CWOC.zip..."

# Clean up any previous CWOC.zip
rm -f "$REPO_ROOT/CWOC.zip"

# Create CWOC.zip containing src/, install/, documents/, ha_integration/
(cd "$REPO_ROOT" && zip -r CWOC.zip src/ install/ documents/ ha_integration/)

# ==============================================================================
# Phase 3: FTP upload
# ==============================================================================
echo "$LOG_PREFIX Uploading to FTP..."

UPLOAD_OUTPUT=$(curl -T "$REPO_ROOT/CWOC.zip" \
    --user "$FTP_USER:$FTP_PASS" \
    "ftp://$FTP_HOST$FTP_PATH" 2>&1) || {
    echo "$LOG_PREFIX ERROR: FTP upload failed to $FTP_HOST — $UPLOAD_OUTPUT"
    exit 1
}

echo "$LOG_PREFIX ✓ Upload complete"

# Clean up local zip after successful upload
rm -f "$REPO_ROOT/CWOC.zip"

# ==============================================================================
# Phase 4: HA sync (--ha flag)
# ==============================================================================
if [[ "$FLAG_HA" == true ]]; then
    echo "$LOG_PREFIX Syncing HA integration..."

    # --- Use CWOC version from src/VERSION ------------------------------------
    HA_VERSION="$VERSION"

    # --- Copy integration files to public repo --------------------------------
    mkdir -p "$PUBLIC_REPO_RESOLVED/custom_components/cwoc"
    cp -R "$REPO_ROOT/ha_integration/custom_components/cwoc/"* "$PUBLIC_REPO_RESOLVED/custom_components/cwoc/"

    # --- Copy metadata files to public repo root ------------------------------
    cp "$REPO_ROOT/ha_integration/hacs.json" "$PUBLIC_REPO_RESOLVED/hacs.json"
    cp "$REPO_ROOT/ha_integration/info.md" "$PUBLIC_REPO_RESOLVED/info.md"
    cp "$REPO_ROOT/ha_integration/README.md" "$PUBLIC_REPO_RESOLVED/README.md"

    # --- Validate manifest.json is writable -----------------------------------
    MANIFEST_PATH="$PUBLIC_REPO_RESOLVED/custom_components/cwoc/manifest.json"
    if [[ ! -w "$MANIFEST_PATH" ]]; then
        echo "$LOG_PREFIX ERROR: Cannot update manifest.json at $MANIFEST_PATH"
        exit 1
    fi

    # --- Update version in manifest.json using sed ----------------------------
    sed -i'' -e "s/\"version\": *\"[^\"]*\"/\"version\": \"$HA_VERSION\"/" "$MANIFEST_PATH"

    echo "$LOG_PREFIX ✓ HA sync complete (v$HA_VERSION)"
fi

# ==============================================================================
# Phase 5: Git operations (--ha --push)
# ==============================================================================
if [[ "$FLAG_HA" == true ]]; then
    if [[ "$FLAG_PUSH" == true ]]; then
        # --- Auto-commit, tag, and push to origin -----------------------------
        echo "$LOG_PREFIX Committing and pushing to public repo..."
        (cd "$PUBLIC_REPO_RESOLVED" && git add -A && git commit -m "Release $HA_VERSION") || {
            echo "$LOG_PREFIX ERROR: Git commit failed in $PUBLIC_REPO_RESOLVED"
            exit 1
        }
        (cd "$PUBLIC_REPO_RESOLVED" && git tag "$HA_VERSION") || {
            echo "$LOG_PREFIX ERROR: Git tag $HA_VERSION failed (tag may already exist)"
            exit 1
        }
        (cd "$PUBLIC_REPO_RESOLVED" && git push origin && git push origin "$HA_VERSION") || {
            echo "$LOG_PREFIX ERROR: Git push failed — local changes are committed, retry with 'git push origin && git push origin $HA_VERSION'"
            exit 1
        }
        echo "$LOG_PREFIX ✓ Pushed $HA_VERSION to origin"
    else
        # --- Print manual git instructions ------------------------------------
        echo ""
        echo "$LOG_PREFIX Files synced. To publish, run these commands manually:"
        echo ""
        echo "  cd $PUBLIC_REPO_RESOLVED"
        echo "  git add -A"
        echo "  git commit -m \"Release $HA_VERSION\""
        echo "  git tag $HA_VERSION"
        echo "  git push origin"
        echo "  git push origin $HA_VERSION"
        echo ""
    fi
fi

echo "$LOG_PREFIX Done."
