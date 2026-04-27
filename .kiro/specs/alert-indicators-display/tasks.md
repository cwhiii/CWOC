# Implementation Plan: Alert Indicators Display

## Overview

Add visual alert indicator icons to chit displays across all CWOC views (except Projects). Implement shared helper functions for alert detection and indicator rendering, update the settings page with a "Combine Alerts" toggle and new timer/stopwatch dropdowns, wire indicators into calendar and card-style view renderers, and update help documentation.

## Tasks

- [ ] 1. Implement alert detection and indicator helpers in `frontend/shared.js`
  - [ ] 1.1 Add `_chitHasAlerts(chit)` function to `frontend/shared.js`
    - Returns `true` if chit has at least one real alert entry (`_type` in alarm, timer, stopwatch, notification) in its `alerts` array, OR if legacy `alarm`/`notification` boolean flags are true
    - Excludes `_notify_flags` entries from detection
    - Handles `null`/`undefined`/non-array `alerts` gracefully by falling back to legacy flags
    - _Requirements: 1.3, 2.1_

  - [ ] 1.2 Add `_getAlertIndicators(chit, settings, context)` function to `frontend/shared.js`
    - `settings` is the `visual_indicators` object; `context` is `'calendar-month'` | `'calendar-slot'` | `'card'`
    - Returns empty string if chit has no alerts (via `_chitHasAlerts`)
    - If `combine_alerts` is true OR context is `'calendar-month'`/`'calendar-slot'`: check `combined_alert` display mode (default `"always"`), return `"⚠️ "` if permitted
    - If `combine_alerts` is false and context is `'card'`: for each alert type present on the chit, check its individual display mode and return concatenated icons (🔔 alarm, 📢 notification, ⏱️ timer, ⏲️ stopwatch)
    - "If Space" (`"space"`) resolves to show for `'card'` and `'calendar-slot'` contexts; only month cells may conditionally hide
    - Default missing keys: `combine_alerts` → `false`, `timer` → `"always"`, `stopwatch` → `"always"`, `combined_alert` → `"always"`
    - Treat invalid display mode values as `"always"` (fail-open)
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 6.1, 6.2_

  - [ ]* 1.3 Write property test: Alert detection with legacy flags (Property 3)
    - **Property 3: Alert detection with legacy flags**
    - Use fast-check (loaded via CDN `<script>` tag) to generate random chits with varying `alerts` arrays and legacy boolean flags
    - Assert `_chitHasAlerts` returns true iff chit has a real alert entry or a true legacy flag
    - **Validates: Requirements 1.3, 2.1**

  - [ ]* 1.4 Write property test: Backward-compatible defaults (Property 7)
    - **Property 7: Backward-compatible defaults**
    - Generate random `visual_indicators` objects with random subsets of keys missing
    - Assert `_getAlertIndicators` applies correct defaults (`combine_alerts`→false, `timer`→"always", `stopwatch`→"always", `combined_alert`→"always") and preserves existing `alarm`/`notification` values
    - **Validates: Requirements 4.5, 6.1, 6.2**

  - [ ]* 1.5 Write property test: Calendar display mode correctness (Property 1)
    - **Property 1: Calendar display mode correctness**
    - Generate random chits and random display mode settings; assert calendar indicator output contains the universal icon iff chit has alerts AND mode is not "never"
    - **Validates: Requirements 1.1, 1.4, 1.5**

  - [ ]* 1.6 Write property test: Calendar icon uniqueness (Property 2)
    - **Property 2: Calendar icon uniqueness**
    - Generate chits with 1–20 alerts of mixed types; assert calendar output contains at most one `⚠️` character
    - **Validates: Requirements 1.2**

  - [ ]* 1.7 Write property test: Combined mode single icon on cards (Property 4)
    - **Property 4: Combined mode shows single universal icon on cards**
    - Generate chits with mixed alert types, set `combine_alerts=true`; assert card output is exactly the universal icon
    - **Validates: Requirements 2.4**

  - [ ]* 1.8 Write property test: Individual mode per-type icons on cards (Property 5)
    - **Property 5: Individual mode shows correct per-type icons on cards**
    - Generate chits with random alert types and random per-type display modes, `combine_alerts=false`; assert each icon appears iff its type is present and permitted
    - **Validates: Requirements 2.5, 2.6**

  - [ ]* 1.9 Write property test: "If Space" resolves to show for non-month contexts (Property 6)
    - **Property 6: "If Space" resolves to show for non-month contexts**
    - Generate chits with alerts, set mode to `"space"`, test with `'card'` and `'calendar-slot'` contexts; assert output equals the `"always"` mode output
    - **Validates: Requirements 5.2, 5.3**

- [ ] 2. Checkpoint — Verify helpers
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Wire alert indicators into calendar views via `calendarEventTitle` in `frontend/shared.js`
  - [ ] 3.1 Modify `calendarEventTitle(chit, isDueOnly, info)` to accept a `settings` parameter and a `context` parameter
    - Call `_getAlertIndicators(chit, settings, context)` and prepend the result before the chit title in the returned HTML span
    - Existing callers that don't pass settings should still work (default to no indicators)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 3.2 Update all calendar view renderers in `frontend/main.js` to pass cached settings and context to `calendarEventTitle`
    - Week, Day, Month, Year, Itinerary, Seven-Day, X-Day renderers
    - Month cells pass `'calendar-month'` context; all other calendar views pass `'calendar-slot'` context
    - Retrieve settings from `getCachedSettings()` and pass `visual_indicators` object
    - _Requirements: 1.5, 5.1, 5.3_

- [ ] 4. Wire alert indicators into card-style views via `_buildChitHeader` in `frontend/main.js`
  - [ ] 4.1 Modify `_buildChitHeader(chit, titleHtml)` to accept a `settings` parameter
    - Call `_getAlertIndicators(chit, settings, 'card')` and insert the result as a span element in the `chit-header-left` div, after pinned/archived icons and before the title
    - Existing callers that don't pass settings should still work (no indicators shown)
    - _Requirements: 2.1, 2.4, 2.5, 2.6_

  - [ ] 4.2 Update `displayChecklists()`, `displayTasks()`, `displayNotes()`, and `displayAlarms()` in `frontend/main.js` to pass cached `visual_indicators` settings to `_buildChitHeader`
    - Retrieve settings from `getCachedSettings()` and pass `visual_indicators` object
    - Do NOT modify `displayProjects()` — no alert indicators on Projects view
    - _Requirements: 2.2, 2.3_

- [ ] 5. Checkpoint — Verify dashboard rendering
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add Combine Alerts toggle and new dropdowns to Settings page
  - [ ] 6.1 Add HTML elements to `frontend/settings.html` in the Visual Indicators section
    - Add a "Combine Alerts" checkbox (`id="combine-alerts-toggle"`) above the indicator dropdowns
    - Wrap existing alarm and notification dropdowns plus new timer and stopwatch dropdowns in a `<div id="individual-alert-rows">`
    - Add a `<div id="combined-alert-row">` with a single "Combined Alerts" dropdown (`name="combined_alert_indicator"`, options: Always/Never/If Space)
    - Add `<select name="timer_indicator">` and `<select name="stopwatch_indicator">` dropdowns with Always/Never/If Space options inside `individual-alert-rows`
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3_

  - [ ] 6.2 Add `_toggleCombineAlerts()` function to `frontend/settings.js`
    - On checkbox change, show `combined-alert-row` and hide `individual-alert-rows` when checked, and vice versa
    - Wire to `monitorChanges()` for unsaved-state tracking
    - _Requirements: 3.5_

  - [ ] 6.3 Update `SettingsManager.updateForm()` in `frontend/settings.js` to load new settings
    - Read `combine_alerts`, `timer`, `stopwatch`, `combined_alert` from loaded `visual_indicators`
    - Set checkbox state, show/hide appropriate rows, set dropdown values
    - Default missing `timer`/`stopwatch` to `"always"`, `combine_alerts` to `false`, `combined_alert` to `"always"`
    - _Requirements: 4.5, 6.1, 6.2_

  - [ ] 6.4 Update `SettingsManager.gatherSettings()` in `frontend/settings.js` to include new keys
    - Add `combine_alerts` (boolean from checkbox), `timer`, `stopwatch`, and `combined_alert` to the `visual_indicators` object
    - Preserve existing `weather`, `people`, `indicators` keys untouched
    - _Requirements: 3.4, 4.4, 6.3_

- [ ] 7. Checkpoint — Verify settings round-trip
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Update help documentation and version
  - [ ] 8.1 Update `frontend/help.html` with documentation for the new alert indicators feature
    - Document the Combine Alerts toggle behavior
    - Document the new Timer and Stopwatch indicator dropdowns
    - Document that calendar views always show a single universal alert icon
    - Document the individual vs combined display modes on card views

  - [ ] 8.2 Update the `VERSION` file at project root with the current date/time stamp
    - Format: `YYYYMMDD.HHMM`

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use fast-check loaded via CDN `<script>` tag — no npm install needed
- The Projects view is explicitly excluded from alert indicator rendering
- No backend changes are needed — the existing `visual_indicators` JSON field accommodates new keys
