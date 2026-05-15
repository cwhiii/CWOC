# Implementation Plan: Timezone Support

## Overview

Implement timezone awareness for CWOC's chit system through the "floating" vs "anchored" model. Floating chits (timezone = null) have times that move with the user. Anchored chits (timezone = IANA string) have times locked to a specific timezone, displayed converted to the user's local time. Uses Python `zoneinfo` on the backend and browser `Intl` APIs on the frontend — no external dependencies.

## Tasks

- [x] 1. Backend data layer and validation
  - [x] 1.1 Add timezone column migration in `src/backend/migrations.py`
    - Add `migrate_add_timezone_column()` function with column-existence check
    - `ALTER TABLE chits ADD COLUMN timezone TEXT DEFAULT NULL`
    - Register the migration call in `src/backend/main.py` startup sequence
    - _Requirements: 2.4, 2.7_

  - [x] 1.2 Add timezone field to Chit model in `src/backend/models.py`
    - Add `timezone: Optional[str] = None` to the `Chit` class
    - _Requirements: 2.1_

  - [x] 1.3 Add timezone settings fields to Settings model in `src/backend/models.py`
    - Add `default_timezone: Optional[str] = None` to `Settings` class
    - Add `timezone_override: Optional[str] = None` to `Settings` class
    - _Requirements: 1.8_

  - [x] 1.4 Add timezone validation in `src/backend/routes/chits.py`
    - Import `zoneinfo.available_timezones`
    - Create `validate_timezone(tz_value)` helper that checks against `available_timezones()`
    - Call validation on chit create and update — return 400 if invalid non-null timezone
    - Pass timezone field through on create/update SQL operations
    - _Requirements: 2.5, 2.6_

  - [x] 1.5 Add timezone validation to settings save in `src/backend/routes/settings.py`
    - Validate `default_timezone` and `timezone_override` against `available_timezones()` on save
    - Return 400 with error message if invalid timezone submitted
    - _Requirements: 1.3, 1.8_

  - [x] 1.6 Write property tests for timezone validation (Property 1)
    - **Property 1: Invalid timezone rejection**
    - Generate random strings and verify non-IANA values are rejected; valid IANA values are accepted
    - Test file: `src/backend/test_timezone.py`
    - **Validates: Requirements 1.3, 2.6**

  - [x] 1.7 Write property tests for timezone persistence round-trip (Property 3)
    - **Property 3: Timezone persistence round-trip**
    - Save random valid IANA timezone strings to chit and settings, read back, verify identical
    - Test file: `src/backend/test_timezone.py`
    - **Validates: Requirements 1.8, 2.5**

- [x] 2. Checkpoint - Backend data layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Frontend timezone detection utility
  - [x] 3.1 Implement `getCurrentTimezone()` in `src/frontend/js/shared/shared-utils.js`
    - Returns a Promise resolving to the user's current IANA timezone string
    - Precedence: `timezone_override` from settings cache → browser `Intl.DateTimeFormat().resolvedOptions().timeZone` → `default_timezone` from settings → `'UTC'` fallback
    - Catches settings cache failures gracefully (falls back to browser detection)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 3.2 Implement `convertTimezoneForDisplay()` in `src/frontend/js/shared/shared-utils.js`
    - Converts a naive datetime string from one IANA timezone to another using `Intl.DateTimeFormat` with `timeZone` option
    - Used by dashboard and calendar for anchored chit time display
    - _Requirements: 5.3_

  - [x] 3.3 Implement `getChitDisplayTime()` in `src/frontend/js/shared/shared-utils.js`
    - For floating chits (timezone == null): returns time as-is
    - For anchored chits: converts from chit.timezone to currentTz
    - Handles invalid/unrecognized timezone gracefully (display unconverted with ⚠️ indicator)
    - _Requirements: 5.1, 5.2, 5.6_

  - [x] 3.4 Write property tests for timezone resolution precedence (Property 2)
    - **Property 2: Timezone resolution precedence**
    - Verify override always wins over browser detection and default
    - Test file: `src/backend/test_timezone.py` (backend equivalent of the resolution logic)
    - **Validates: Requirements 1.4, 5.5, 9.1**

- [x] 4. Settings page timezone UI
  - [x] 4.1 Add timezone fields to settings page HTML (`src/frontend/html/settings.html`)
    - Add "Default Timezone" searchable dropdown in the General tab
    - Add "Current Timezone Override" searchable dropdown with clear option in the General tab
    - Populate both with `Intl.supportedValuesOf('timeZone')`
    - _Requirements: 1.1, 1.2_

  - [x] 4.2 Wire timezone settings logic in `src/frontend/js/pages/settings.js`
    - Pre-populate Default Timezone with browser-detected timezone on first load (if no saved value)
    - Validate selections against IANA list before save
    - Display error message for invalid timezone values
    - Save both fields to backend via existing settings save flow
    - _Requirements: 1.3, 1.8, 1.9_

- [x] 5. Editor timezone picker
  - [x] 5.1 Add timezone picker UI to editor dates zone (`src/frontend/js/editor/editor-dates.js`)
    - Add "Set timezone" link visible when date mode is not "None"
    - Clicking link reveals searchable timezone dropdown, hides the link
    - Dropdown populated with `Intl.supportedValuesOf('timeZone')`
    - Selected timezone stored in chit's `timezone` field
    - Display selected timezone name adjacent to picker
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.2 Handle pre-filled timezone and clear behavior in editor
    - When opening an anchored chit: show picker pre-filled with stored timezone (no "Set timezone" link)
    - Clear button: removes timezone, reverts to floating, collapses picker back to link
    - Hide picker and link when date mode changes to "None"
    - _Requirements: 3.5, 3.6, 3.7_

  - [x] 5.3 Add timezone picker CSS styles
    - Add styles to `src/frontend/css/editor/editor.css` for the timezone picker
    - Searchable dropdown styling consistent with parchment theme
    - Mobile-friendly layout
    - _Requirements: 3.3_

- [x] 6. Location-based timezone suggestion
  - [x] 6.1 Add timezone detection from geocode in `src/frontend/js/shared/shared-geocoding.js`
    - Implement `_detectTimezoneFromCoords(lat, lon, country)` function
    - Use longitude-band heuristic combined with country/region data to determine IANA timezone
    - Return null on failure
    - _Requirements: 4.6_

  - [x] 6.2 Add suggestion prompt in editor when location timezone differs from current
    - After geocode completes, compare detected timezone to `getCurrentTimezone()`
    - If different and chit has no explicit timezone: show suggestion prompt with accept/dismiss
    - Accept: set chit.timezone to detected value, dismiss prompt
    - Dismiss: leave timezone unchanged, hide prompt
    - Do not show if chit already has explicit timezone
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. Checkpoint - Frontend editor and settings
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Dashboard and calendar time display conversion
  - [x] 8.1 Update dashboard time rendering to use timezone conversion
    - Call `getCurrentTimezone()` on page load
    - For each chit displayed: use `getChitDisplayTime()` to get correct display time
    - Anchored chits: convert from chit.timezone to currentTz
    - Floating chits: display as-is
    - Show ⚠️ indicator for unrecognized timezone values
    - _Requirements: 5.1, 5.2, 5.4, 5.6_

  - [x] 8.2 Update calendar view to render anchored events at converted time slots
    - Calendar events for anchored chits positioned at their converted local time
    - Ensure recurrence display shows correct converted times
    - _Requirements: 5.4_

  - [x] 8.3 Re-render on timezone change without full page reload
    - When `getCurrentTimezone()` result changes (override update or browser shift), re-render displayed times
    - _Requirements: 5.7_

  - [x] 8.4 Write property tests for time display conversion (Property 5)
    - **Property 5: Time display conversion correctness**
    - Verify anchored chit times are correctly converted; floating chit times unchanged
    - Test file: `src/backend/test_timezone.py`
    - **Validates: Requirements 5.1, 5.2, 5.4**

- [x] 9. Alert and alarm scheduling
  - [x] 9.1 Update scheduler for timezone-aware alert computation in `src/backend/schedulers.py`
    - Implement `compute_alert_utc(wall_clock_naive, tz_name)` — converts wall-clock to UTC
    - Implement `get_user_current_timezone(user_id)` — resolves user's current timezone from settings
    - Floating chits: compute fire time using user's current timezone
    - Anchored chits: compute fire time using chit's stored timezone
    - Handle DST spring-forward gaps (advance to first valid minute after gap)
    - Handle DST fall-back ambiguity (select first occurrence, fold=0)
    - _Requirements: 6.1, 6.2, 6.6, 6.7_

  - [x] 9.2 Implement timezone change detection and alert recalculation
    - When user's current timezone changes: recalculate all pending floating chit alerts within 60 seconds
    - Do NOT recalculate anchored chit alerts on timezone change
    - If recalculated time falls in the past: fire alert immediately
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 9.3 Write property tests for alert fire-time computation (Property 6)
    - **Property 6: Alert fire-time computation**
    - Verify anchored alerts compute correctly from chit timezone; floating from user timezone
    - Verify changing user timezone does not affect anchored alert times
    - Test file: `src/backend/test_timezone.py`
    - **Validates: Requirements 6.1, 6.2, 6.4**

  - [x] 9.4 Write property tests for DST gap alert handling (Property 7)
    - **Property 7: DST gap alert handling**
    - Verify alerts in spring-forward gaps advance to first valid minute
    - Test file: `src/backend/test_timezone.py`
    - **Validates: Requirements 6.7**

- [x] 10. Recurrence engine timezone awareness
  - [x] 10.1 Update recurrence expansion for timezone-aware computation
    - Anchored chits: expand occurrences in chit's stored timezone
    - Floating chits: expand in user's current timezone
    - Daily+ frequencies: preserve wall-clock time across DST transitions
    - Sub-daily frequencies (HOURLY/MINUTELY): maintain uniform elapsed-time intervals (UTC-based)
    - Handle DST gap (shift forward) and fall-back ambiguity (first instance, fold=0)
    - Fall back to user's default timezone if chit's timezone is unrecognized
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 10.2 Write property tests for recurrence wall-clock preservation (Property 8)
    - **Property 8: Recurrence wall-clock preservation across DST**
    - Verify daily+ anchored recurrences maintain same wall-clock time across DST boundaries
    - Test file: `src/backend/test_timezone.py`
    - **Validates: Requirements 7.1, 7.3**

  - [x] 10.3 Write property tests for recurrence DST gap handling (Property 9)
    - **Property 9: Recurrence DST gap shift-forward**
    - Verify occurrences in spring-forward gaps shift to first valid instant
    - Test file: `src/backend/test_timezone.py`
    - **Validates: Requirements 7.4**

  - [x] 10.4 Write property tests for recurrence fall-back handling (Property 10)
    - **Property 10: Recurrence fall-back first-instance selection**
    - Verify ambiguous fall-back times select first occurrence (fold=0)
    - Test file: `src/backend/test_timezone.py`
    - **Validates: Requirements 7.5**

  - [x] 10.5 Write property tests for sub-daily recurrence intervals (Property 11)
    - **Property 11: Sub-daily recurrence uniform elapsed-time intervals**
    - Verify HOURLY/MINUTELY recurrences maintain exact UTC duration between occurrences across DST
    - Test file: `src/backend/test_timezone.py`
    - **Validates: Requirements 7.7**

- [x] 11. Checkpoint - Scheduler and recurrence
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. ICS export with timezone support
  - [x] 12.1 Update ICS serializer in `src/backend/ics_serializer.py`
    - Implement `_build_vtimezone(tz_name, year)` — generates VTIMEZONE component using `zoneinfo`
    - Anchored chits: emit `DTSTART;TZID=...` and `DTEND;TZID=...` with VTIMEZONE component
    - Floating chits: emit naive local times (no TZID, no Z suffix)
    - All-day chits: emit `DTSTART;VALUE=DATE:YYYYMMDD` format
    - Anchored chits with recurrence: emit RRULE and EXDATE with timezone TZID context
    - Omit chits with no start_datetime and no due_datetime
    - One VTIMEZONE per unique timezone in the file
    - Conform to RFC 5545 (VCALENDAR wrapper, VERSION:2.0)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 12.2 Write property tests for ICS timezone annotation (Property 12)
    - **Property 12: ICS timezone annotation correctness**
    - Verify anchored → VTIMEZONE + TZID; floating → naive; all-day → VALUE=DATE
    - Test file: `src/backend/test_timezone.py`
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [x] 12.3 Write property tests for ICS omitting dateless chits (Property 14)
    - **Property 14: ICS omits dateless chits**
    - Verify chits without start_datetime or due_datetime produce no VEVENT
    - Test file: `src/backend/test_timezone.py`
    - **Validates: Requirements 8.5**

- [x] 13. Documentation and finalization
  - [x] 13.1 Create help documentation for timezone support
    - Create `src/help/timezones.md` covering floating vs anchored concept, timezone picker usage, location suggestions, settings configuration, and display behavior
    - Include deep-links to Settings page timezone fields and Editor
    - _Requirements: 1.1, 1.2, 2.2, 2.3, 3.1, 5.1_

  - [x] 13.2 Update `src/help/index.md` to include timezones entry
    - Add "Timezones" entry to the help index with appropriate description
    - _Requirements: 1.1_

  - [x] 13.3 Update `src/help/editor.md` to document timezone picker
    - Add section about the "Set timezone" link and timezone picker in the dates zone
    - Document location-based timezone suggestion behavior
    - _Requirements: 3.1, 3.2, 4.1_

  - [x] 13.4 Update `src/help/recurrence.md` to document timezone behavior
    - Document how anchored recurring chits preserve wall-clock time across DST
    - Document floating recurrence behavior
    - _Requirements: 7.1, 7.3_

  - [x] 13.5 Update `src/INDEX.md` with new functions and components
    - Add all new backend functions (migration, validation, scheduler helpers, recurrence helpers, ICS helpers)
    - Add all new frontend functions (getCurrentTimezone, convertTimezoneForDisplay, getChitDisplayTime, timezone picker, suggestion prompt)
    - _Requirements: all_

  - [x] 13.6 Update version number in `src/VERSION`
    - Run `date "+%Y%m%d.%H%M"` and write result to `src/VERSION`
    - This is the FINAL step — do not update version until all other tasks are complete
    - _Requirements: all_

- [x] 14. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- NO installs required — Python `zoneinfo` (stdlib) and browser `Intl` APIs only
- All frontend code is vanilla JS with script tags, no modules
- Database migrations use inline column-existence checks (existing pattern in `migrations.py`)
- Version update (`src/VERSION`) happens ONCE at the very end via `date "+%Y%m%d.%H%M"`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "1.5"] },
    { "id": 2, "tasks": ["1.6", "1.7", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 4, "tasks": ["3.4", "4.2", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 6, "tasks": ["6.2", "8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3", "9.4"] },
    { "id": 10, "tasks": ["10.1"] },
    { "id": 11, "tasks": ["10.2", "10.3", "10.4", "10.5"] },
    { "id": 12, "tasks": ["12.1"] },
    { "id": 13, "tasks": ["12.2", "12.3", "13.1", "13.2"] },
    { "id": 14, "tasks": ["13.3", "13.4"] },
    { "id": 15, "tasks": ["13.5"] },
    { "id": 16, "tasks": ["13.6"] }
  ]
}
```
