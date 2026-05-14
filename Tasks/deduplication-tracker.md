# Deduplication Tracker

## Will Fix

*(All items moved to Fixed)*

## Gray Area

*(All items approved and moved to Fixed)*

## Left Alone

Not real duplication — with reason.

1. **DB connection boilerplate** — Every Python route opens `sqlite3.connect(DB_PATH)`. That's just how SQLite works without an ORM. Not duplication.

2. **`_formatTimestamp()` in rules-manager.js** — Only exists in one file. Not duplicated.

3. **`formatDate()` in main-calendar.js vs shared-utils.js** — Different formats: calendar uses "DD Day" for headers, shared-utils uses "YYYY-Mon-DD". Different purposes, not duplication.

4. **`_emailDetectTracking()` in main-email.js vs `detectSmartLinks()` in shared-smart-links.js** — Legacy version coexists with generalized replacement for backward compat. Migration in progress, not a consolidation target.

5. **`_row_to_dict()` in network_access.py** — Does extra JSON deserialization beyond the basic cursor→dict pattern. Genuinely different from the shared version.

6. **Audit logging pattern** — Every route that modifies data calls `insert_audit_entry()`. Intentional per-route behavior, not duplication.

7. **`CwocSaveSystem` vs `CwocEditorSaveSystem`** — The editor version extends the base with auto-listeners. Intentional inheritance, not duplication.

8. **`_require_admin()` in ha.py** — Different signature (takes `user_id` instead of `request`). Left as-is with comment noting the difference.

---

## Fixed

### Backend Python

1. **`_utcnow_iso()` (5 copies → 1)** — Consolidated to `utcnow_iso()` in `db.py`. Removed from: `middleware.py`, `routes/network_access.py`, `routes/ntfy.py`, `routes/auth.py`, `routes/users.py`.

2. **`_require_admin()` (4 copies → 1)** — Consolidated to `require_admin()` in `db.py`. Removed from: `routes/network_access.py`, `routes/admin.py`, `routes/users.py`, `routes/ntfy.py`.

3. **`_row_to_dict()` (3 copies → 1)** — Consolidated to `row_to_dict()` in `db.py`. Removed from: `routes/rules.py`, `routes/bundles.py`, `routes/custom_objects.py` (also fixed swapped arg order).

4. **`_derive_period_from_cron()` (2 copies → 1)** — Kept in `schedulers.py`, imported by `routes/rules.py`. Removed local copy from rules.py.

### Frontend JS

5. **`_escHtml()` / `_escapeHtml()` (12+ copies → 1)** — Consolidated to `_escHtml()` in `shared-utils.js`. Removed from: `shared.js`, `main-modals.js`, `main-email.js`, `main-omni.js` (`_escOmniHtml`), `main-views-indicators.js` (`_escapeHtml`), `editor-send-item.js`, `editor-prerequisites.js` (`_prereqEsc`), `editor-email.js` (`_escapeHtmlAttr`), `shared-page.js`, `people.js` (`_escapeHtml`), `settings-email.js` (`_escapeHtml`), `user-admin.js`, `rules-manager.js`, `rule-editor.js`, `weather.js` (`_wxEsc`), `maps.js` (`_mapsEsc`), `custom-objects-editor.js` (`_coEscape`).

6. **Weather icon map (4 copies → 1)** — Consolidated to `_cwocWeatherIcons` in `shared-utils.js`. Removed maps from: `editor.js` (`weatherIcons`), `main-modals.js` (`_weatherIcons`), `weather.js` (`_wxPageIcons`). Thin aliases kept for backward compat.

7. **Precipitation type/format (3 copies → 1)** — Consolidated to `_cwocGetPrecipType()` and `_cwocFormatPrecip()` in `shared-utils.js`. Removed from: `editor-location.js`, `main-modals.js`, `weather.js`.

8. **`_convertDBDateToDisplayDate()` (2 copies → 1)** — Consolidated to `shared-utils.js`. Removed from: `editor.js`, `main-modals.js`.

9. **`_contactMatchesFilter()` (2 copies → 1)** — Consolidated to `cwocContactMatchesFilter()` in `shared-utils.js`. Local wrappers in `editor-people.js` and `maps.js` now delegate to the shared version.

10. **Celsius-to-Fahrenheit wrappers (2 trivial wrappers → 0)** — Deleted `_celsiusToFahrenheit()` from `main-modals.js` and `_wxPageC2F()` from `weather.js`. Callers now use `_convertTemp()` directly.

11. **`_getHabitCycleEnd()` (2 copies → 1 shared core)** — Consolidated core logic to `_cwocGetHabitCycleEnd(freq)` in `shared-utils.js`. `editor-alerts.js` and `main-alerts.js` now delegate to it.

12. **Weather icon lookup function (3 copies → 1)** — Consolidated to `_cwocGetWeatherIcon()` in `shared-utils.js`. Local wrappers (`_getWeatherIcon`, `_wxPageGetIcon`) now delegate.

13. **`highlightMatch()` / `_highlightMatch()` (2 copies → 1)** — Consolidated to `cwocHighlightMatch()` in `shared-utils.js`. Both `main-views.js` and `people.js` now delegate.

14. **`_isLightColor()` / `_isPeopleColorLight()` wrappers (2 pass-throughs → 0)** — Deleted from `editor-people.js` and `main-sidebar.js`. Callers use `isLightColor()` directly.

15. **`_isColorLight()` in settings.js (reimplementation → 0)** — Deleted. Callers use shared `isLightColor()`.

16. **`_showToast()` in main-email.js (wrapper → 0)** — Deleted. Callers use `cwocToast()` directly.

17. **`_getHabitCycleEnd()` frontend (2 implementations → 1 shared core)** — Same as #11 above (editor-alerts.js reads from DOM, main-alerts.js reads from chit object — both now call `_cwocGetHabitCycleEnd(freq)` with the frequency extracted from their respective sources).