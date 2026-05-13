# Implementation Plan: HACS Distribution for CWOC HA Integration

## Overview

This plan implements the HACS distribution layer: metadata files for the public repo, documentation, and a release script that handles both server zip deployment and HA integration syncing. All work is bash scripts and static files — no software installation required.

## Tasks

- [x] 1. Update manifest.json for HACS compatibility
  - [x] 1.1 Update `ha_integration/custom_components/cwoc/manifest.json` with HACS-required fields
    - Add `"documentation": "https://github.com/cwhiii/cwoc-ha-integration"`
    - Add `"codeowners": ["@cwhiii"]`
    - Add `"issue_tracker": "https://github.com/cwhiii/cwoc-ha-integration/issues"`
    - Verify `version`, `config_flow`, and `iot_class` fields are present and correct
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 2. Create HACS metadata and documentation files
  - [x] 2.1 Create `ha_integration/hacs.json` (HACS manifest for the public repo)
    - Set `name` to "C.W.'s Omni Chits"
    - Set `render_readme` to true
    - Set `homeassistant` to "2024.1.0"
    - Set `content_in_root` to false
    - Do NOT include `zip_release` or `filename` fields
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.2 Create `ha_integration/info.md` (HACS store listing)
    - Brief description of CWOC and what the integration provides
    - List sensors (upcoming chits, overdue count, etc.) and services (create_chit, add_checklist_item, update_chit, set_chit_status, add_tag, remove_tag)
    - Installation prerequisites (running CWOC instance on local network)
    - Basic setup instructions (add integration → enter URL + credentials)
    - Requirements section: minimum HA version (2024.1.0), CWOC server accessible on network
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.3 Create `ha_integration/README.md` (public repo GitHub landing page)
    - "Features" section listing sensors, services, and capabilities
    - "Installation via HACS" section with step-by-step instructions (add custom repo → search CWOC → install → restart)
    - "Manual Installation" section (copy `custom_components/cwoc/` to HA config dir)
    - "Configuration" section explaining config flow (URL, username, password)
    - "Updating" section explaining HACS update notifications
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 3. Create the release script
  - [x] 3.1 Create `ha_integration/cwoc-release.sh` with argument parsing and help
    - Parse `--ha`, `--push`, `--version X.Y.Z`, and `--help` flags
    - Implement `--help` output showing usage, flags, and environment info
    - Set `#!/usr/bin/env bash` and `set -e`
    - Define consistent log prefix `[cwoc-release]`
    - _Requirements: 6.1, 6.10_

  - [x] 3.2 Implement validation phase in the release script
    - Check `src/VERSION` exists and is non-empty; exit with descriptive error if not
    - Check `~/.cwoc-release.conf` exists; exit with descriptive error including the expected path
    - Source the config file to load FTP_HOST, FTP_USER, FTP_PASS, FTP_PATH
    - Check required source directories exist (`src/`, `install/`, `documents/`, `ha_integration/`); exit with error identifying which directory is missing
    - If `--ha` flag: check PUBLIC_REPO_PATH (default `../cwoc-ha-integration`) exists; exit with error if not
    - _Requirements: 6.2, 6.7, 6.8, 6.11, 6.13_

  - [x] 3.3 Implement zip build phase in the release script
    - Create `CWOC.zip` containing `src/`, `install/`, `documents/`, `ha_integration/` directories
    - Use `zip -r` from the repo root
    - Print progress message: `[cwoc-release] Building CWOC.zip...`
    - Clean up any previous `CWOC.zip` before building
    - _Requirements: 6.3, 6.9_

  - [x] 3.4 Implement FTP upload phase in the release script
    - Upload `CWOC.zip` to configured FTP host/path using `curl -T`
    - Print progress: `[cwoc-release] Uploading to FTP...` and `[cwoc-release] ✓ Upload complete`
    - On failure: exit with error including FTP host and curl error message
    - Clean up local `CWOC.zip` after successful upload
    - _Requirements: 6.4, 6.8, 6.9, 6.12_

  - [x] 3.5 Implement HA sync phase (--ha flag) in the release script
    - Copy all files from `ha_integration/custom_components/cwoc/` to `<PUBLIC_REPO>/custom_components/cwoc/` (overwrite existing)
    - Copy `ha_integration/hacs.json` to `<PUBLIC_REPO>/hacs.json`
    - Copy `ha_integration/info.md` to `<PUBLIC_REPO>/info.md`
    - Copy `ha_integration/README.md` to `<PUBLIC_REPO>/README.md`
    - Prompt for new semver version (or use `--version X.Y.Z` if provided)
    - Update `version` field in `<PUBLIC_REPO>/custom_components/cwoc/manifest.json` using `sed`
    - Validate manifest.json is writable; exit with descriptive error if not
    - Print progress: `[cwoc-release] Syncing HA integration...` and `[cwoc-release] ✓ HA sync complete (vX.Y.Z)`
    - _Requirements: 6.5, 6.7, 6.9, 6.14_

  - [ ] 3.6 Implement git operations (--ha --push) and manual instructions in the release script
    - If `--ha` without `--push`: print manual instructions (git add, commit, tag, push commands)
    - If `--ha --push`: auto-commit with message "Release vX.Y.Z", create tag `vX.Y.Z`, push to origin
    - On git push failure: exit with error, leave local changes committed so user can retry
    - _Requirements: 5.1, 5.2, 5.3, 6.6_

- [ ] 4. Checkpoint
  - Ensure all files are created and the release script is executable. Ask the user if questions arise.

- [x] 5. Integration and wiring
  - [x] 5.1 Verify end-to-end file layout matches HACS expectations
    - Confirm `ha_integration/` contains: `custom_components/cwoc/` (all integration files), `hacs.json`, `info.md`, `README.md`, `cwoc-release.sh`
    - Confirm manifest.json has all required HACS fields
    - Confirm hacs.json does NOT contain `zip_release` or `filename`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1–3.6_

  - [ ]* 5.2 Write a validation script to check public repo structure
    - Script checks: hacs.json fields, manifest.json required fields, directory structure, no backend code present
    - _Requirements: 1.1, 1.2, 1.3, 7.1_

- [ ] 6. Final checkpoint
  - Ensure all files are complete and consistent. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped
- No software installation is required — all tools used (bash, zip, curl, sed, cp, git) are standard system utilities
- The release script lives in the private repo at `ha_integration/cwoc-release.sh`
- HACS metadata files (`hacs.json`, `info.md`, `README.md`) live in `ha_integration/` in the private repo and get copied to the public repo root by the release script
- The public repo (`cwoc-ha-integration`) is expected as a sibling directory; the release script handles the sync
- Version in manifest.json is independent semver (1.0.0 style), not the CWOC date-based version
- Do NOT update `src/VERSION` as part of this spec — these are packaging/distribution files only
