# Implementation Plan: Calendar ICS Import

## Overview

Implement iCalendar (.ics) file import for CWOC, allowing users to import events and tasks from Google Calendar, Apple Calendar, and Outlook. The implementation follows the existing vCard serializer pattern: a pure-Python parser/printer module (`ics_serializer.py`), a dedicated import route (`routes/ics_import.py`), Pydantic request/response models, and a frontend import button on the Settings page.

## Tasks

- [ ] 1. Create the ICS parser and printer module
  - [ ] 1.1 Create `src/backend/ics_serializer.py` with `ics_parse(ics_text: str) -> dict`
    - Implement RFC 5545 line unfolding (continuation lines starting with space/tab)
    - Split file into VEVENT and VTODO blocks by tracking BEGIN/END markers
    - Silently ignore other component types (VTIMEZONE, VJOURNAL, VFREEBUSY, VALARM)
    - Parse DTSTART/DTEND with TZID parameter preservation and DATE vs DATE-TIME detection
    - Parse RRULE into structured dict with freq, interval, byday, until, count fields
    - Validate each component has SUMMARY; skip components without it and record errors
    - Return error if content doesn't begin with BEGIN:VCALENDAR or contains no VEVENT/VTODO
    - Use Python stdlib only — no external libraries
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 1.2 Implement `ics_print(components: list[dict]) -> str` in the same module
    - Format each component with properly structured iCalendar properties
    - Serialize RRULE dicts back into RFC 5545 RRULE format
    - Include TZID parameters on DTSTART/DTEND when timezone info is present
    - Use DATE format for all-day events, DATE-TIME for timed events
    - Wrap output in BEGIN:VCALENDAR / END:VCALENDAR with VERSION:2.0 and PRODID
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.3 Write unit tests for the ICS parser and printer
    - Create `src/backend/test_ics.py` following the `test_vcard.py` pattern
    - Test basic VEVENT parsing (summary, dtstart, dtend, description, location)
    - Test VTODO parsing (summary, due, status, priority)
    - Test line unfolding for multi-line property values
    - Test TZID preservation on DTSTART/DTEND
    - Test all-day event detection (DATE vs DATE-TIME)
    - Test RRULE parsing (DAILY, WEEKLY with BYDAY, MONTHLY, YEARLY, UNTIL, COUNT)
    - Test round-trip: parse → print → parse produces equivalent data
    - Test error case: missing BEGIN:VCALENDAR
    - Test error case: component without SUMMARY is skipped with error recorded
    - Test that non-VEVENT/VTODO components (VTIMEZONE, VJOURNAL) are silently ignored
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4_

- [ ] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Create the import route with field mapping, recurrence translation, and duplicate detection
  - [ ] 3.1 Add Pydantic models `ICSImportRequest` and `ICSImportResponse` to `src/backend/models.py`
    - `ICSImportRequest` with `ics_content: str` field
    - `ICSImportResponse` with `imported: int`, `skipped: int`, `errors: List[str]` fields
    - _Requirements: 6.1, 6.2_

  - [ ] 3.2 Create `src/backend/routes/ics_import.py` with the field mapper, recurrence translator, duplicate detector, and POST endpoint
    - Implement `map_component_to_chit(component, user_id, display_name, username)` mapping VEVENT fields (SUMMARY→title, DESCRIPTION→note, DTSTART→start_datetime, DTEND→end_datetime, LOCATION→location, CATEGORIES→tags, PRIORITY→High/Medium/Low, all_day flag)
    - Implement VTODO mapping (SUMMARY→title, DESCRIPTION→note, DUE→due_datetime, CATEGORIES→tags, STATUS→Complete/In Progress/ToDo, PRIORITY mapping)
    - Set owner_id, owner_display_name, owner_username from authenticated user; generate new UUID for id; set created_datetime and modified_datetime to current UTC; set deleted=False
    - Automatically add `cwoc_system/imported` to the tags list of every imported chit, in addition to any CATEGORIES-derived tags
    - Implement `map_rrule_to_recurrence(rrule)` translating DAILY/WEEKLY/MONTHLY/YEARLY with interval, byDay, until; return None for unsupported frequencies (SECONDLY/MINUTELY/HOURLY)
    - Approximate COUNT to an until date using start_date + count × interval × freq_days
    - Implement `find_duplicates(cursor, user_id, components)` checking title + start_datetime (or due_datetime for VTODO) exact match against existing non-deleted chits
    - Implement POST `/api/import/ics` endpoint using `request.state.user_id` from AuthMiddleware
    - Parse ICS content, return HTTP 400 if invalid
    - Process all components in a single SQLite transaction; skip duplicates and malformed components; roll back on unrecoverable error
    - Handle missing DTEND: set end equal to start for timed events, single-day for DATE-only
    - Split comma-separated CATEGORIES into individual tags
    - Return JSON with imported count, skipped count, and error descriptions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.4_

  - [ ] 3.3 Register the ICS import router in `src/backend/main.py`
    - Import the router from `src.backend.routes.ics_import`
    - Add `app.include_router(ics_import_router)` alongside existing routers
    - _Requirements: 6.1_

  - [ ]* 3.4 Write unit tests for field mapping, recurrence translation, and duplicate detection
    - Create `src/backend/test_ics_import.py` following the existing test pattern
    - Test VEVENT field mapping (all fields including priority tiers: 1-4→High, 5→Medium, 6-9→Low)
    - Test VTODO field mapping (status mapping: COMPLETED→Complete, IN-PROCESS→In Progress, NEEDS-ACTION→ToDo)
    - Test all-day flag propagation from parser to chit
    - Test recurrence mapping for DAILY, WEEKLY+BYDAY, MONTHLY, YEARLY
    - Test RRULE UNTIL conversion to ISO date
    - Test RRULE COUNT approximation to until date
    - Test unsupported frequency (HOURLY) returns None and event imports as single occurrence
    - Test duplicate detection: matching title + start_datetime skips the component
    - Test that all-duplicate file returns imported=0, skipped=N
    - Test error handling: component without SUMMARY is skipped with error recorded
    - Test non-VEVENT/VTODO components are silently ignored
    - Test CATEGORIES splitting into separate tags
    - Test missing DTEND defaults to DTSTART
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 6.2, 6.3, 8.1, 8.2, 8.3, 8.4_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Add the frontend import UI to the Settings page
  - [ ] 5.1 Add the "Import Calendar (.ics)" button and hidden file input to `src/frontend/html/settings.html`
    - Add a new sub-section in the Data Management setting-group (after the User Data import/export buttons)
    - Add a `📅 Calendar Import` subheader label
    - Add a hint paragraph: "Import events and tasks from Google Calendar, Apple Calendar, or Outlook."
    - Add a button labeled "📅 Import Calendar (.ics)" that triggers a hidden file input
    - Add a hidden `<input type="file" accept=".ics">` element
    - _Requirements: 7.1, 7.2_

  - [ ] 5.2 Add the import handler function in `src/frontend/js/pages/settings.js`
    - Wire the button click to trigger the hidden file input
    - On file selection, read file content using FileReader as text
    - POST the content to `/api/import/ics` as JSON `{ "ics_content": "<text>" }`
    - While request is in flight, disable the button and show "Importing…" text
    - On success, display an alert with "Imported X events, skipped Y duplicates, Z errors"
    - On error, display the error message from the API response
    - Re-enable the button after completion
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [ ] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The ICS parser uses Python stdlib only — no external libraries, no pip installs
- Tests use Python's built-in unittest pattern (same as test_vcard.py) — no hypothesis, no pytest plugins
- No installation steps are included — all code is written directly
- The parser/printer follows the same architectural pattern as the existing vCard serializer in `serializers.py`
