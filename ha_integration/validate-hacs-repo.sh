#!/usr/bin/env bash
set -e

# ==============================================================================
# validate-hacs-repo.sh — Check that the public repo structure is HACS-compliant
# ==============================================================================

LOG_PREFIX="[hacs-validate]"
ERRORS=0

# --- Resolve public repo path -------------------------------------------------
PUBLIC_REPO="${1:-../cwoc-ha-integration}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Resolve relative to repo root
if [[ "$PUBLIC_REPO" != /* ]]; then
    PUBLIC_REPO="$REPO_ROOT/$PUBLIC_REPO"
fi

if [[ ! -d "$PUBLIC_REPO" ]]; then
    echo "$LOG_PREFIX ERROR: Public repo not found at $PUBLIC_REPO"
    echo "Usage: validate-hacs-repo.sh [path-to-public-repo]"
    exit 1
fi

echo "$LOG_PREFIX Validating HACS repo at: $PUBLIC_REPO"
echo ""

# --- Helper: check file exists ------------------------------------------------
check_file() {
    local path="$1"
    local desc="$2"
    if [[ ! -f "$PUBLIC_REPO/$path" ]]; then
        echo "  ✗ MISSING: $path ($desc)"
        ((ERRORS++))
    else
        echo "  ✓ $path"
    fi
}

# --- Helper: check JSON field exists ------------------------------------------
check_json_field() {
    local file="$1"
    local field="$2"
    local desc="$3"
    if ! grep -q "\"$field\"" "$PUBLIC_REPO/$file" 2>/dev/null; then
        echo "  ✗ $file missing field: \"$field\" ($desc)"
        ((ERRORS++))
    fi
}

# --- Directory structure ------------------------------------------------------
echo "$LOG_PREFIX Checking directory structure..."
if [[ ! -d "$PUBLIC_REPO/custom_components/cwoc" ]]; then
    echo "  ✗ MISSING: custom_components/cwoc/ directory"
    ((ERRORS++))
else
    echo "  ✓ custom_components/cwoc/"
fi

# --- Required files -----------------------------------------------------------
echo ""
echo "$LOG_PREFIX Checking required files..."
check_file "hacs.json" "HACS manifest"
check_file "info.md" "HACS store listing"
check_file "README.md" "GitHub landing page"
check_file "custom_components/cwoc/manifest.json" "Integration manifest"
check_file "custom_components/cwoc/__init__.py" "Integration init"
check_file "custom_components/cwoc/config_flow.py" "Config flow"
check_file "custom_components/cwoc/sensor.py" "Sensor platform"
check_file "custom_components/cwoc/services.yaml" "Service definitions"
check_file "custom_components/cwoc/strings.json" "UI strings"

# --- hacs.json fields ---------------------------------------------------------
echo ""
echo "$LOG_PREFIX Checking hacs.json fields..."
check_json_field "hacs.json" "name" "required"
check_json_field "hacs.json" "render_readme" "required"
check_json_field "hacs.json" "homeassistant" "minimum HA version"

# Ensure zip_release and filename are NOT present
if grep -q "\"zip_release\"" "$PUBLIC_REPO/hacs.json" 2>/dev/null; then
    echo "  ✗ hacs.json should NOT contain \"zip_release\" field"
    ((ERRORS++))
fi
if grep -q "\"filename\"" "$PUBLIC_REPO/hacs.json" 2>/dev/null; then
    echo "  ✗ hacs.json should NOT contain \"filename\" field"
    ((ERRORS++))
fi

# --- manifest.json fields -----------------------------------------------------
echo ""
echo "$LOG_PREFIX Checking manifest.json fields..."
MANIFEST="custom_components/cwoc/manifest.json"
check_json_field "$MANIFEST" "domain" "required"
check_json_field "$MANIFEST" "name" "required"
check_json_field "$MANIFEST" "version" "required for HACS"
check_json_field "$MANIFEST" "config_flow" "required"
check_json_field "$MANIFEST" "documentation" "required for HACS"
check_json_field "$MANIFEST" "codeowners" "required for HACS"
check_json_field "$MANIFEST" "iot_class" "required"
check_json_field "$MANIFEST" "issue_tracker" "recommended for HACS"

# --- Check no backend code leaked in ------------------------------------------
echo ""
echo "$LOG_PREFIX Checking no backend code present..."
if [[ -d "$PUBLIC_REPO/src" ]]; then
    echo "  ✗ src/ directory found — backend code should NOT be in public repo"
    ((ERRORS++))
else
    echo "  ✓ No src/ directory"
fi
if [[ -d "$PUBLIC_REPO/data" ]]; then
    echo "  ✗ data/ directory found — database should NOT be in public repo"
    ((ERRORS++))
else
    echo "  ✓ No data/ directory"
fi

# --- Summary ------------------------------------------------------------------
echo ""
if [[ $ERRORS -eq 0 ]]; then
    echo "$LOG_PREFIX ✓ All checks passed — repo is HACS-ready"
    exit 0
else
    echo "$LOG_PREFIX ✗ $ERRORS issue(s) found — fix before publishing"
    exit 1
fi
