# Implementation Plan: Network Access

## Overview

Add a "Network Access" administration block to the CWOC settings page with Tailscale VPN configuration, status monitoring, and service control. Implementation follows data layer → backend API → frontend UI → configurinator → tests ordering. The architecture uses a generic `network_access` table with a `provider` discriminator column for future extensibility.

## Tasks

- [x] 1. Database migration and registration
  - [x] 1.1 Add `migrate_add_network_access()` function to `src/backend/migrations.py`
    - Create `network_access` table with columns: `id` (TEXT PRIMARY KEY), `provider` (TEXT NOT NULL UNIQUE), `enabled` (BOOLEAN DEFAULT 0), `config` (TEXT), `created_datetime` (TEXT), `modified_datetime` (TEXT)
    - Use `CREATE TABLE IF NOT EXISTS` pattern consistent with existing migrations (e.g., `migrate_add_audit_log`, `migrate_add_standalone_alerts`)
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 1.2 Register the migration in `src/backend/main.py`
    - Import `migrate_add_network_access` from `src.backend.migrations`
    - Call it after `migrate_add_kiosk_users()` in the migration sequence
    - _Requirements: 1.2_

- [x] 2. Backend route module — `src/backend/routes/network_access.py`
  - [x] 2.1 Create the route file with admin guard and CRUD endpoints
    - Create `src/backend/routes/network_access.py` with an `APIRouter`
    - Implement `_require_admin(request)` helper that checks `is_admin` in the users table (same pattern as `routes/users.py`), returns 403 if not admin
    - Implement `GET /api/network-access` — list all provider configs from `network_access` table, deserialize `config` JSON for each row
    - Implement `GET /api/network-access/{provider}` — return single provider config, or default `{ provider, enabled: false, config: {} }` if not found
    - Implement `POST /api/network-access/{provider}` — create/update provider config using `INSERT OR REPLACE`, serialize config to JSON, generate UUID on first insert, audit log the change
    - Register static Tailscale routes (`/tailscale/status`, `/tailscale/up`, `/tailscale/down`) BEFORE the `/{provider}` catch-all to avoid path parameter conflicts
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 8.4_
  - [x] 2.2 Implement Tailscale status endpoint
    - Implement `GET /api/network-access/tailscale/status` — check Tailscale installation and service state via `subprocess.run()`
    - Check `which tailscale` first; if not found return `{ status: "not_installed" }`
    - Run `tailscale status --json`, parse output for `TailscaleIPs[0]` and `Self.HostName`
    - Return appropriate status: `not_installed`, `installed_inactive`, `active` (with ip/hostname), or `error` (with message)
    - Use `subprocess.run()` with `capture_output=True, text=True, timeout=10`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x] 2.3 Implement Tailscale service control endpoints
    - Implement `POST /api/network-access/tailscale/up` — load saved config, extract `auth_key`, run `tailscale up --authkey=<key>` via subprocess, return result, audit log the action
    - Return 400 if no auth key is saved with descriptive message
    - Return 500 with stderr if subprocess fails
    - Implement `POST /api/network-access/tailscale/down` — run `tailscale down` via subprocess, return result, audit log the action
    - Use `timeout=30` for up, `timeout=15` for down
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  - [x] 2.4 Register the router in `src/backend/main.py`
    - Import `router as network_access_router` from `src.backend.routes.network_access`
    - Add `app.include_router(network_access_router)` in the router registration section
    - _Requirements: 8.4_

- [x] 3. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend — Settings page HTML additions
  - [x] 4.1 Add the Network Access block to `src/frontend/html/settings.html`
    - Add a new `setting-group` div with `id="network-access-block"` inside the `#admin-section` `.settings-grid`, placed before the "🔄 Version & Updates" group
    - Include Tailscale sub-section with: status indicator row, IP/hostname info row (hidden by default), error message row (hidden by default), auth key password input with visibility toggle, enabled checkbox, and Save Config / Connect / Disconnect buttons
    - Use existing CSS classes (`setting-group`, `setting-subheader`, `setting-inline`, `standard-button`) for consistent styling
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.6, 5.7_

- [x] 5. Frontend — Settings page JavaScript additions
  - [x] 5.1 Add Network Access functions to `src/frontend/js/pages/settings.js`
    - Add a clearly marked `// ── Network Access ──` section
    - Implement `refreshTailscaleStatus()` — fetch `GET /api/network-access/tailscale/status`, update status badge with colored emoji indicators (⚪ Not Installed, 🟡 Inactive, 🟢 Connected, 🔴 Error), show/hide IP+hostname and error rows
    - Implement `loadTailscaleConfig()` — fetch `GET /api/network-access/tailscale`, populate auth key input and enabled checkbox
    - Implement `saveTailscaleConfig()` — collect auth key and enabled state, POST to `/api/network-access/tailscale`, show success/error feedback
    - Implement `tailscaleUp()` — POST to `/api/network-access/tailscale/up`, show result, refresh status on success
    - Implement `tailscaleDown()` — POST to `/api/network-access/tailscale/down`, show result, refresh status on success
    - Implement `toggleAuthKeyVisibility()` — toggle auth key input between `type="password"` and `type="text"`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - [x] 5.2 Wire initialization into the admin section load flow
    - After `waitForAuth()` resolves and user is confirmed admin, call `loadTailscaleConfig()` and `refreshTailscaleStatus()`
    - Ensure the network-access-block is hidden for non-admin users (leveraging existing admin-section visibility logic)
    - _Requirements: 4.2, 4.3_

- [x] 6. Checkpoint — Ensure frontend renders correctly and API calls work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Configurinator — Tailscale install phase
  - [x] 7.1 Add `install_tailscale()` function to `install/configurinator.sh`
    - Add a standalone `install_tailscale()` function that checks if Tailscale is already installed (`command -v tailscale`), skips if present
    - Use the official Tailscale install script (`curl -fsSL https://tailscale.com/install.sh | bash`) for installation
    - Use `log_step`, `log_ok`, `log_warn` helpers for progress logging
    - On failure: `log_warn` and `return 0` (non-fatal — do not abort provisioning)
    - Do NOT attempt `tailscale up` or `tailscale login` — authentication is deferred to the settings UI
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6, 8.5_
  - [x] 7.2 Call `install_tailscale` in both fresh-install and upgrade paths of `main()`
    - Add the call after `configure_https` and before `start_and_verify` in both the fresh-install and upgrade code paths
    - Also add it in the mixed-layout fixup path
    - _Requirements: 6.3_

- [x] 8. Backend tests
  - [x] 8.1 Write property test for provider config API round-trip
    - Create `src/backend/test_network_access.py` using `unittest` + `random` (no external libraries)
    - **Property 1: Provider config API round-trip** — Generate random provider names (alphanumeric, 1-50 chars) and random config dicts, simulate POST then GET via direct DB operations (inline production logic to avoid FastAPI import), assert `provider`, `enabled`, and `config` fields match. Minimum 100 iterations.
    - **Validates: Requirements 1.3, 2.2, 2.4**
  - [x] 8.2 Write property test for GET all returns all stored providers
    - **Property 2: GET all returns all stored providers** — Generate random sets of 1-10 distinct provider names, insert configs for each, query all rows, assert the returned list contains exactly the stored providers with no missing entries and no duplicates. Minimum 100 iterations.
    - **Validates: Requirements 2.1, 8.2**
  - [x] 8.3 Write property test for auth key in tailscale up command
    - **Property 3: Auth key included in tailscale up command** — Generate random auth key strings, save them as Tailscale config, mock `subprocess.run`, call the up logic, assert the command args contain `--authkey=` followed by the exact saved key. Minimum 100 iterations.
    - **Validates: Requirements 7.4**
  - [x] 8.4 Write unit tests for edge cases and admin enforcement
    - Test migration idempotency — run `migrate_add_network_access()` twice, verify no errors
    - Test default config for missing provider — GET a provider that doesn't exist, verify default response shape
    - Test admin-only enforcement — verify non-admin requests return 403
    - Test no-auth-key error — call tailscale/up with no saved config, verify 400
    - Test provider uniqueness — POST two configs for same provider, verify only one row exists
    - _Requirements: 1.2, 1.4, 2.3, 2.5, 2.6, 7.3_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use Python's built-in `random` and `unittest` modules (no external PBT libraries)
- All JS is vanilla — no modules, no imports, just script tags
- The backend uses Python with FastAPI; the frontend uses vanilla JS/HTML/CSS
- The configurinator uses bash
