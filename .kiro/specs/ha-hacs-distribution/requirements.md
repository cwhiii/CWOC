# Requirements Document

## Introduction

This spec covers the HACS (Home Assistant Community Store) distribution layer for the existing CWOC Home Assistant custom integration. The integration itself is fully functional — this is purely about packaging and repository structure so that users can discover and install the integration through HACS's GUI rather than manually SSH-ing into their HA instance and copying files.

The approach: a dedicated **public** GitHub repository (`cwoc-ha-integration`) contains only the HA integration files, HACS metadata, and documentation. A sync script in the main (private) CWOC repo copies the integration files to the public repo and tags releases. This keeps the main codebase private while giving users the full HACS click-to-install experience.

The goal: a user opens HACS in Home Assistant → adds the public `cwoc-ha-integration` repo as a custom repository → searches "CWOC" → clicks Install → restarts HA → done. No terminal, no file copying, no shell scripts.

## Glossary

- **HACS**: Home Assistant Community Store — a community-maintained integration store that provides a GUI for discovering and installing custom integrations from GitHub repositories
- **HACS_Manifest**: A `hacs.json` file in the repository root that tells HACS how to handle the integration (name, render readme, supported HA versions, etc.)
- **Public_Repo**: The dedicated public GitHub repository (`cwoc-ha-integration`) that contains only the HA integration files and HACS metadata
- **Private_Repo**: The main CWOC repository (private) containing the full application source code including the integration source at `ha_integration/custom_components/cwoc/`
- **Sync_Script**: A shell script in the Private_Repo that copies integration files to the Public_Repo and manages version tagging
- **Custom_Repository**: A GitHub repository that HACS can point to for installation — does not require being in the official HACS default registry
- **GitHub_Release**: A tagged release on GitHub that HACS uses for version management and update detection
- **Integration_Directory**: The `custom_components/cwoc/` directory structure that HACS expects to find in the Public_Repo
- **Info_File**: A markdown file (`info.md` or repository README) that HACS displays as the store listing page for the integration
- **HA_Custom_Integration**: The existing CWOC integration source at `ha_integration/custom_components/cwoc/` in the Private_Repo

## Requirements

### Requirement 1: Public Repository Structure

**User Story:** As a HACS installation process, I want to find the integration files in the expected location in the public repo, so that I can copy them to the correct `custom_components/cwoc/` path in the user's HA instance.

#### Acceptance Criteria

1. THE Public_Repo SHALL contain the integration source files at the path `custom_components/cwoc/` relative to the repository root.
2. THE `custom_components/cwoc/` directory SHALL contain all required integration files: `__init__.py`, `manifest.json`, `config_flow.py`, `const.py`, `coordinator.py`, `sensor.py`, `services.py`, `services.yaml`, `strings.json`, `icons.json`, and the `translations/` subdirectory.
3. THE Public_Repo SHALL NOT contain any CWOC backend source code, frontend code, database files, or other non-integration files from the Private_Repo.

### Requirement 2: HACS Manifest File

**User Story:** As a HACS user adding the CWOC repository, I want HACS to correctly identify and handle the integration, so that it installs to the right location with proper metadata.

#### Acceptance Criteria

1. THE Public_Repo SHALL contain a `hacs.json` file in the root directory with the following fields: `name` set to "C.W.'s Omni Chits", `render_readme` set to true, and `homeassistant` set to the minimum supported HA version string (e.g., "2024.1.0").
2. THE HACS_Manifest SHALL set the `content_in_root` field to false since the integration files are in `custom_components/cwoc/` (the HACS default location for integrations).
3. THE HACS_Manifest SHALL NOT include `zip_release` or `filename` fields (HACS will clone the repository directly).

### Requirement 3: Integration Manifest HACS Compatibility

**User Story:** As a HACS validator, I want the integration's `manifest.json` to meet all HACS requirements, so that validation passes and the integration installs cleanly.

#### Acceptance Criteria

1. THE `manifest.json` SHALL include a `version` field with a valid semantic version string (e.g., "1.0.0").
2. THE `manifest.json` SHALL include a `documentation` field with a URL pointing to the Public_Repo README on GitHub.
3. THE `manifest.json` SHALL include a non-empty `codeowners` field with at least one GitHub username in the format `["@username"]`.
4. THE `manifest.json` SHALL set `config_flow` to true.
5. THE `manifest.json` SHALL set `iot_class` to `"local_polling"`.
6. THE `manifest.json` SHALL include an `issue_tracker` field with a URL to the Public_Repo's GitHub issues page.

### Requirement 4: Store Listing Information

**User Story:** As a Home Assistant user browsing HACS, I want to see a clear description of what the CWOC integration does, so that I can decide whether to install it.

#### Acceptance Criteria

1. THE Public_Repo SHALL contain an `info.md` file in the root directory that HACS displays as the integration's store listing page.
2. THE Info_File SHALL include: a brief description of what CWOC is, what the integration provides (sensors, services, config flow), installation prerequisites (a running CWOC instance on the network), and basic setup instructions (add integration → enter URL and credentials).
3. THE Info_File SHALL list the sensors and services provided by the integration.
4. THE Info_File SHALL include a "Requirements" section stating the minimum Home Assistant version and that a CWOC server must be accessible on the local network.

### Requirement 5: Version Management via GitHub Releases

**User Story:** As a HACS user with the CWOC integration installed, I want to receive update notifications when a new version is released, so that I can keep the integration current.

#### Acceptance Criteria

1. WHEN a new version is released, THE Public_Repo SHALL have a GitHub release/tag where the tag matches the version in `manifest.json`.
2. THE GitHub release tag SHALL use the format `v{version}` (e.g., `v1.0.0`).
3. THE GitHub release SHALL include release notes describing what changed in that version.
4. WHEN HACS checks for updates, THE version comparison SHALL use the `version` field in `manifest.json` against the latest GitHub release tag.

### Requirement 6: Release Script

**User Story:** As the CWOC developer, I want a single script that builds the server release zip and uploads it to my web server, with an optional flag to also sync the HA integration to the public repo, so that I can publish server-only updates quickly and full releases when needed.

#### Acceptance Criteria

1. THE Private_Repo SHALL contain a release script at `ha_integration/cwoc-release.sh` that automates the release process.
2. THE release script SHALL read the current version from `src/VERSION` in the Private_Repo automatically (no manual version argument required).
3. THE release script SHALL by default (no flags) build a `CWOC.zip` file containing the `src/`, `install/`, `documents/`, and `ha_integration/` directories from the Private_Repo, and upload it to the web server via FTP.
4. THE release script SHALL upload the `CWOC.zip` to the web server so that the configurinator can download it from the configured RELEASE_URL (`http://cwholemaniii.com/code/cwoc/releases/CWOC.zip`).
5. WHEN the `--ha` flag is provided, THE release script SHALL additionally sync the HA integration to the Public_Repo: copy all files from `ha_integration/custom_components/cwoc/` to `custom_components/cwoc/` in the Public_Repo (overwriting existing files), update the `version` field in the Public_Repo's `manifest.json`, and copy `hacs.json` and `info.md` to the Public_Repo root.
6. WHEN the `--ha` flag is provided, THE release script SHALL print instructions for the remaining manual GitHub steps (commit, push, create GitHub release) OR offer to execute them automatically if a `--push` flag is also provided.
7. WHEN the `--ha` flag is provided, THE release script SHALL validate that the Public_Repo path exists before attempting to copy files, and exit with an error if not found.
8. THE release script SHALL read FTP credentials from a config file (not hardcoded in the script) and exit with a descriptive error if the config file is not found (e.g., "FTP config not found at ~/.cwoc-release.conf").
9. THE release script SHALL display progress messages for each phase (building zip, uploading to FTP, and if `--ha`: syncing HA integration).
10. THE release script SHALL support a `--help` flag that displays usage information including available flags.
11. IF `src/VERSION` does not exist or is empty, THEN THE release script SHALL exit with an error message identifying the missing file.
12. IF the FTP upload fails, THEN THE release script SHALL exit with an error message including the FTP host and the HTTP status or connection error.
13. IF the zip build fails (missing source directories), THEN THE release script SHALL exit with an error message identifying which directory was not found.
14. IF the `--ha` flag is provided and the Public_Repo `manifest.json` cannot be updated (file not found or not writable), THEN THE release script SHALL exit with a descriptive error.

### Requirement 7: HACS Custom Repository Installation Flow

**User Story:** As a Home Assistant user, I want to add the CWOC repository to HACS and install the integration through the GUI, so that I never need to SSH into my HA instance.

#### Acceptance Criteria

1. WHEN a user adds the Public_Repo GitHub URL as a custom repository in HACS (type: Integration), HACS SHALL successfully validate and add it.
2. WHEN the user searches for "CWOC" in HACS after adding the custom repository, THE integration SHALL appear in the search results with its name and description.
3. WHEN the user clicks Install on the CWOC integration in HACS, HACS SHALL download the integration files and place them in `config/custom_components/cwoc/`.
4. AFTER installation via HACS, THE integration SHALL be discoverable in Settings → Integrations → Add Integration → search "CWOC" (after an HA restart).

### Requirement 8: README Documentation for Public Repository

**User Story:** As a potential user visiting the public GitHub repository, I want clear instructions on how to install the integration via HACS, so that I can get started without confusion.

#### Acceptance Criteria

1. THE Public_Repo README SHALL include an "Installation via HACS" section with step-by-step instructions for adding the custom repository and installing the integration.
2. THE README SHALL include a "Manual Installation" section as a fallback for users who prefer not to use HACS.
3. THE README SHALL include a "Configuration" section explaining the config flow (enter CWOC URL, username, password).
4. THE README SHALL include a "Features" section listing sensors, services, and capabilities.
5. THE README SHALL include a "Updating" section explaining that HACS will notify when updates are available.
