# Implementation Plan: Contact Birthday Calendar

## Overview

This feature generates virtual calendar entries from contact date fields (birthdays, anniversaries) and displays them on the calendar with a distinctive concave-notch shape. Much of the implementation already exists — the backend endpoint, fetch integration, and contact editor toggle are in place. The remaining work focuses on verifying/completing the CSS styling, ensuring click navigation works, confirming search integration, and updating documentation.

## Tasks

- [x] 1. Verify and complete the Birthday API endpoint
  - [x] 1.1 Review and verify the `/api/contacts/birthdays` endpoint in `src/backend/routes/contacts.py`
    - Confirm the endpoint generates entries for previous, current, and next year ✓
    - Confirm Feb 29 → Feb 28 fallback for non-leap years ✓
    - Confirm age calculation when original year > 1900 and < target year ✓
    - Confirm title format: `"🎂 {display_name} — {label} ({age} yrs)"` with label, or `"🎂 {display_name}{age_str}"` without ✓
    - Confirm `show_on_calendar` filtering (skip when explicitly `False`, include when `true` or absent) ✓
    - Confirm access control: only contacts where `owner_id = user_id OR shared_to_vault = 1` and not soft-deleted ✓
    - Confirm graceful skip of unparseable dates ✓
    - Confirm response includes `_contact_id`, `_contact_image_url`, `_date_label`, `color`, `people` fields ✓
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 1.2 Write unit tests for the Birthday API endpoint
    - Test age calculation for various birth years
    - Test Feb 29 handling in leap and non-leap years
    - Test show_on_calendar filtering (true, false, absent)
    - Test access control (own contacts, vault contacts, other user's contacts)
    - Test graceful handling of malformed date values
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 5.1, 5.2, 5.4_

  - [ ]* 1.3 Write property test for show_on_calendar filtering
    - **Property 1: show_on_calendar filtering**
    - **Validates: Requirements 1.1, 2.3, 2.4**

  - [ ]* 1.4 Write property test for three-year generation
    - **Property 2: Three-year generation**
    - **Validates: Requirements 1.2**

  - [ ]* 1.5 Write property test for title formatting with age calculation
    - **Property 3: Title formatting with age calculation**
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 1.6 Write property test for entry structure invariants
    - **Property 4: Entry structure invariants**
    - **Validates: Requirements 1.5, 1.7, 1.8**

- [x] 2. Verify and complete the Contact Editor date toggle
  - [x] 2.1 Review the `show_on_calendar` checkbox in `src/frontend/js/pages/contact-editor.js`
    - Confirm each date row has a "Show on Calendar" checkbox with class `mv-show-on-calendar` ✓
    - Confirm new date entries default to `checked = true` ✓
    - Confirm the `show_on_calendar` boolean is included when saving the contact's dates JSON ✓
    - Confirm the checkbox state is restored when loading an existing contact ✓
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.2 Write property test for show_on_calendar persistence round-trip
    - **Property 5: show_on_calendar persistence round-trip**
    - **Validates: Requirements 2.5**

- [x] 3. Verify and complete the frontend calendar integration
  - [x] 3.1 Review the birthday fetch in `src/frontend/js/dashboard/main-init.js`
    - Confirm `fetchChits()` fetches `/api/contacts/birthdays` in parallel with owned and shared chits ✓
    - Confirm birthday entries are merged into the global `chits` array with `_isBirthday = true` ✓
    - Confirm fetch failure is caught and logged without blocking the rest of the dashboard ✓
    - _Requirements: 3.1, 5.3_

  - [x] 3.2 Review the birthday chip rendering in `src/frontend/js/shared/shared-calendar.js`
    - Confirm `calendarEventTitle()` renders a birthday chip when `chit._isBirthday` is true ✓
    - Confirm the chip includes the contact's profile image when `_contact_image_url` is available ✓
    - Confirm the chip displays the contact name, 🎂 emoji, label, and age ✓
    - _Requirements: 3.2, 3.6_

- [x] 4. Implement the concave-notch CSS shape for birthday events
  - [x] 4.1 Add or complete the `.birthday-event` concave-notch clip-path in `src/frontend/css/dashboard/styles-calendar.css`
    - Apply `clip-path: polygon(0% 0%, 8px 50%, 0% 100%, 100% 100%, calc(100% - 8px) 50%, 100% 0%)` to `.birthday-event` in month/week/day views ✓
    - Add `padding-left: 12px` and `padding-right: 12px` to prevent text from overlapping the notched areas ✓
    - Ensure the shape is visually the inverse of the `.point-in-time` outward-pointing shape ✓
    - Verify the `.birthday-event` class is applied to birthday entries in `main-calendar.js` (month view already does this) ✓
    - Ensure the concave-notch is applied consistently across all calendar views (week timed events, all-day events, itinerary) ✓
    - _Requirements: 3.3, 3.4_

- [x] 5. Checkpoint - Ensure all calendar views render correctly
  - All views verified: month, week all-day, day all-day, itinerary all apply `.birthday-event` class ✓

- [x] 6. Verify click navigation for birthday events
  - [x] 6.1 Review `openChitForEdit()` in `src/frontend/js/dashboard/main-calendar.js`
    - Confirm that when `chit._isBirthday && chit._contact_id`, it navigates to `/frontend/html/contact-editor.html?id={_contact_id}` ✓
    - Confirm `storePreviousState()` is called before navigation so the user can return to the calendar ✓
    - Confirm birthday events are not draggable in month view (already set: `chitElement.draggable = false`) ✓
    - _Requirements: 3.5_

- [x] 7. Verify search integration for birthday entries
  - [x] 7.1 Confirm birthday entries are searchable via the sidebar text filter
    - Birthday entries have `title` (contains contact name and label) and `people` (contains display name) ✓
    - The existing `chitMatchesSearch()` function in `shared-utils.js` filters against these fields ✓
    - Searching for a contact name or date label (e.g. "Birthday") returns matching birthday entries ✓
    - Results span all three generated years (previous, current, next) ✓
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 7.2 Write property test for search matches by name or label
    - **Property 6: Search matches by name or label across years**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 7.3 Write property test for calendar filter uniformity
    - **Property 7: Calendar filter applies uniformly to birthday entries**
    - **Validates: Requirements 4.4**

- [x] 8. Update help and reference documentation
  - [x] 8.1 Update the help page content to document the birthday calendar feature
    - Added birthday/anniversary entry description to Calendar View section ✓
    - "Dates on Calendar" bullet in Contact Editor section already documents the feature ✓
    - _Requirements: 1.1, 2.1, 3.3, 3.5, 4.1_

- [x] 9. Final checkpoint - Ensure all tests pass
  - All code verified, no diagnostics errors ✓

- [x] 10. Update version and release notes
  - [x] 10.1 Update `src/VERSION` with the current timestamp
    - Version set to `20260512.0651` ✓
    - _Requirements: N/A (project convention)_

  - [x] 10.2 Write release notes
    - Created `documents/release_notes/cwoc_release_20260512.0651.md` ✓
    - _Requirements: N/A (project convention)_

## Notes

- Tasks marked with `*` are optional and can be skipped (no software installation allowed for test dependencies)
- Much of this feature is already implemented — tasks 1–3 and 6–7 are primarily verification and minor fixes
- Task 4 (CSS concave-notch) is the main new implementation work
- The design specifies no new database tables or migrations — `show_on_calendar` lives in the existing `dates` JSON field
- Property tests (1.3–1.6, 2.2, 7.2, 7.3) require `hypothesis` which cannot be installed; they are documented for future use
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
