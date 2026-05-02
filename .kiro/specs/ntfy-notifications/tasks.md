# Tasks — Ntfy Push Notifications

## Task 1: Create Ntfy Sender Module (`src/backend/routes/ntfy.py`)

- [x] 1.1 Create `src/backend/routes/ntfy.py` with module docstring and imports (sqlite3, json, logging, urllib.request, urllib.error)
- [x] 1.2 Implement `get_ntfy_topic(user_id: str) -> str` — returns `"cwoc-"` + first 12 alphanumeric chars of user_id
- [x] 1.3 Implement `get_ntfy_config() -> dict` — reads ntfy provider row from network_access table, returns `{'enabled': bool, 'server_url': str}` with default `http://localhost:2586`
- [x] 1.4 Implement `send_ntfy_notification(user_id, title, body, click_url=None, tags=None) -> dict` — builds HTTP POST request with X-Title, X-Tags, X-Click headers; 10s timeout; graceful error handling
- [x] 1.5 Add Server URL validation in the save endpoint — reject empty/whitespace-only server_url with 400 error

## Task 2: Add Ntfy Status and Test Endpoints

- [x] 2.1 Add `GET /api/network-access/ntfy/status` endpoint — checks ntfy health via HTTP GET to `{server_url}/v1/health`, returns active/unreachable/not_configured
- [x] 2.2 Add `POST /api/network-access/ntfy/test` endpoint — sends test notification with title "CWOC Test" and body "If you see this, Ntfy is working!" to requesting user's topic; requires auth (any user)
- [x] 2.3 Register the ntfy router in `src/backend/main.py`

## Task 3: Integrate Ntfy into Alert Scheduler

- [x] 3.1 Add `_send_chit_ntfy(owner_id, chit_id, chit_title, time_label, time_value)` helper in `src/backend/weather.py` — imports and calls `send_ntfy_notification` with appropriate title/body/click_url/tags
- [x] 3.2 Call `_send_chit_ntfy()` from `_alert_push_loop()` after each `_send_chit_push()` call, wrapped in try/except so failures don't block remaining chits

## Task 4: Settings UI — Ntfy Section

- [x] 4.1 Add Ntfy HTML block to `src/frontend/html/settings.html` in the Network Access section (below Tailscale), following the same collapsible toggle-button pattern
- [x] 4.2 Add Ntfy JavaScript functions to `src/frontend/js/pages/settings.js`: toggle, status check, save config, test notification, topic display
- [x] 4.3 Wire the Ntfy section to load saved config on page init and display the user's auto-generated topic

## Task 5: Push Script — Ntfy Service Check

- [x] 5.1 Add Ntfy service check block to `cwoc-push.sh` after the Tailscale check — start ntfy if installed but not running, skip silently if not installed, log status

## Task 6: Help Page Documentation

- [x] 6.1 Add "Ntfy Notifications" section to `src/frontend/html/help.html` — setup flow, topic subscription, local vs Tailscale access modes, troubleshooting

## Task 7: Property-Based Tests

- [x] 7.1 Create `src/backend/test_ntfy.py` with property-based tests using a lightweight PBT harness (100+ iterations per property):
  - Property 1: Topic generation determinism and format
  - Property 2: Whitespace URL rejection
  - Property 3: HTTP request construction correctness
  - Property 4: Title defaulting for empty chit titles
  - Property 5: Disabled provider skip behavior

## Task 8: Update Index and Version

- [x] 8.1 Update `src/INDEX.md` with the new ntfy module, its functions, and endpoints
- [x] 8.2 Update `src/VERSION` with current timestamp (run `date "+%Y%m%d.%H%M"` to get value)
- [x] 8.3 Create release notes file for the new version
