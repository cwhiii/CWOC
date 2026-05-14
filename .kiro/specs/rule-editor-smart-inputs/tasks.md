# Implementation Plan: Rule Editor Smart Inputs

## Overview

This plan implements context-aware smart inputs for the Rule Editor's condition builder, adds missing email fields, a "Create Chit" action type, and weather-based conditions. The work spans the frontend (`rule-editor.js`, `rule-editor.html`, `shared-page.css`) and backend (`rules_engine.py`). All code uses existing patterns — no new dependencies.

## Tasks

- [ ] 1. Add missing email fields and operator filtering
  - [-] 1.1 Add email_to, email_cc, email_bcc, email_account_id to EMAIL_FIELDS array in `rule-editor.js`
    - Insert after email_from in order: email_to ("Email To"), email_cc ("Email CC"), email_bcc ("Email BCC"), email_account_id ("Email Account")
    - Add operator filtering: email_to/cc/bcc get text comparison set (equals, not_equals, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty, regex_match)
    - Add operator filtering: email_account_id gets only equals, not_equals, is_empty, is_not_empty
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Implement smart input factory and simple dropdowns
  - [~] 2.1 Create `_renderSmartInput(leaf, onChange)` factory function in `rule-editor.js`
    - Inspect `leaf.field` and `leaf.operator` to determine widget type
    - Return appropriate DOM element based on field-to-widget mapping
    - Replace the plain text input in `_renderLeaf()` with a call to `_renderSmartInput`
    - Fall back to plain text input for unmapped fields
    - _Requirements: 2.1, 4.1, 5.1, 6.1, 11.1_

  - [~] 2.2 Implement priority, status, severity, and boolean dropdown widgets
    - Priority dropdown: Low, Medium, High, Critical
    - Status dropdown: ToDo, In Progress, Blocked, Complete, Rejected
    - Severity dropdown: Low, Medium, High, Critical
    - Boolean dropdown (archived, pinned, all_day, habit, email_read): true, false
    - All dropdowns pre-select current value if set, show placeholder if not
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 11.1, 11.2, 11.3_

  - [~] 2.3 Implement email account dropdown widget
    - Populate from `getCachedSettings()` → `email_accounts`
    - Display nickname if non-empty, otherwise email address as label
    - Store account ID as value
    - Show placeholder if no accounts configured
    - Show unrecognized indicator for saved values not matching current accounts
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 2.4 Write property tests for smart input type mapping and operator filtering
    - **Property 1: Smart Input Type Mapping** — verify factory returns correct widget type for all field/operator combinations
    - **Property 2: Operator Filtering by Field** — verify operator sets match spec for each field type
    - **Validates: Requirements 1.3, 1.4, 2.1, 4.1, 5.1, 6.1, 11.1**

- [ ] 3. Implement contact autocomplete widget
  - [~] 3.1 Create `_renderContactAutocomplete(options)` reusable component in `rule-editor.js`
    - Support `mode` param: 'email' (shows name + email, stores email) or 'name' (shows name, stores name)
    - Query `/api/contacts?q={input}` when input >= 2 characters
    - Display up to 10 results with case-insensitive substring matching
    - Cache most recent API response to avoid redundant calls
    - Dismiss dropdown on blur, Escape, or selection
    - Allow manual text entry at all times (254 char max for email mode)
    - On API error: silently dismiss dropdown, continue with manual entry
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [~] 3.2 Wire contact autocomplete for email fields and people field
    - email_from, email_to, email_cc, email_bcc → autocomplete in email mode
    - people (with person_on_chit/person_not_on_chit operator) → autocomplete in name mode
    - _Requirements: 2.1, 10.1_

  - [ ]* 3.3 Write property test for autocomplete filtering
    - **Property 3: Autocomplete Filtering** — verify at most 10 results, case-insensitive substring match against name/email
    - **Validates: Requirements 2.2, 10.2**

- [ ] 4. Implement location combobox and color swatches
  - [~] 4.1 Create location combobox widget (dropdown + text input)
    - Load saved locations from `getCachedSettings()` → `saved_locations`
    - Display location label as text, store address as value
    - Allow custom text entry (max 200 chars) for locations not in list
    - Fall back to text-only input if settings fail or saved_locations is empty
    - _Requirements: 7.1, 7.2, 7.3_

  - [~] 4.2 Create color swatches widget
    - Display default palette swatches plus custom_colors from settings
    - On swatch click, populate condition value with hex string
    - Highlight selected swatch with visible border/checkmark
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [~] 4.3 Wire tag picker for tags field (reuse existing pattern)
    - When field is tags AND operator is tag_present/tag_not_present, render existing tag picker
    - Display non-system tags sorted: favorites first (alphabetically), then non-favorites alphabetically
    - On selection, populate condition value with tag name
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 4.4 Write property tests for dropdown pre-selection, account labels, and tag sorting
    - **Property 4: Dropdown Pre-Selection** — verify pre-selection logic for all dropdown types
    - **Property 5: Email Account Label Computation** — verify nickname vs email address label logic
    - **Property 6: Tag List Sorting and Filtering** — verify sort order and system tag exclusion
    - **Validates: Requirements 3.2, 4.2, 4.3, 5.2, 5.3, 6.2, 6.3, 9.2, 11.2, 11.3**

- [~] 5. Checkpoint
  - Ensure all smart input widgets render correctly for their respective fields. Ensure operator filtering works. Ask the user if questions arise.

- [ ] 6. Implement weather condition fields (frontend)
  - [~] 6.1 Add WEATHER_FIELDS array and conditional display in field dropdown
    - Define weather_code, weather_temperature_high, weather_temperature_low, weather_precipitation, weather_wind_speed
    - Only show weather fields when trigger type is "scheduled"
    - Add operator filtering: numeric weather fields get greater_than, less_than, equals; weather_code gets equals, not_equals
    - _Requirements: 13.1, 13.4, 13.5_

  - [~] 6.2 Create weather smart input (numeric input + location selector)
    - Render numeric input for threshold value
    - Render location combobox (reuse from 4.1) for weather_location
    - Store weather_location as additional property on the leaf node
    - Serialize/deserialize weather_location in condition save/load
    - _Requirements: 13.2_

- [ ] 7. Implement Create Chit action (frontend)
  - [~] 7.1 Add "Create Chit" to CHIT_ACTION_TYPES and implement `_renderCreateChitAction` panel
    - Add `{ value: 'create_chit', label: 'Create Chit', params: null }` to action types
    - Render custom panel with smart input controls for: title, note, status, priority, tags, start_datetime, due_datetime, location, color, people
    - All fields optional, text fields support `{{placeholder}}` template syntax
    - Reuse same smart input widgets from condition builder
    - _Requirements: 12.1, 12.2, 12.3_

- [ ] 8. Add CSS styles for smart input widgets
  - [~] 8.1 Add `.smart-input-*` CSS classes to `shared-page.css`
    - Style autocomplete dropdown (positioned below input, scrollable, max 10 items)
    - Style color swatches (grid of clickable circles with selection indicator)
    - Style location combobox (dropdown + text input combination)
    - Style weather input (numeric + location side by side)
    - Style Create Chit action panel (field grid layout)
    - Ensure mobile-friendly sizing and touch targets
    - _Requirements: 2.1, 7.1, 8.1, 12.2, 13.2_

- [ ] 9. Add HTML templates for smart input widgets
  - [~] 9.1 Add `<template>` elements to `rule-editor.html`
    - Template for contact autocomplete (input + results dropdown)
    - Template for color swatches grid
    - Template for location combobox
    - Template for weather input (numeric + location)
    - Template for Create Chit action panel
    - _Requirements: 2.1, 7.1, 8.1, 12.2, 13.2_

- [~] 10. Checkpoint
  - Ensure all frontend smart inputs, weather fields, and Create Chit action render and function correctly. Ask the user if questions arise.

- [ ] 11. Implement weather condition evaluation (backend)
  - [~] 11.1 Add weather condition evaluation to `evaluate_leaf()` in `rules_engine.py`
    - Detect weather field in leaf condition
    - Extract weather_location from leaf
    - Geocode location using existing `_geocode_address()` from `schedulers.py`
    - Fetch today's daily forecast from Open-Meteo API (temperature_2m_max, temperature_2m_min, precipitation_sum, wind_speed_10m_max, weather_code)
    - Compare forecast value against condition threshold using specified operator
    - On geocode failure or API error/timeout (15s): log error, return False, continue evaluating other conditions
    - _Requirements: 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ]* 11.2 Write property test for weather numeric comparison
    - **Property 8: Weather Condition Numeric Comparison** — verify greater_than, less_than, equals return mathematically correct results for numeric values; equals/not_equals perform exact integer comparison for weather_code
    - **Validates: Requirements 13.4, 13.5**

- [ ] 12. Implement Create Chit action executor (backend)
  - [~] 12.1 Add `create_chit` action handler to `execute_action()` in `rules_engine.py`
    - Build chit dict from action params
    - Resolve template placeholders (`{{matched_title}}`, `{{today}}`, `{{trigger_field}}`, etc.) against triggering entity
    - Replace unresolved placeholders with empty string
    - Insert new chit with rule owner's user_id and current UTC timestamp as created_datetime
    - Wrap in transaction; on DB error: rollback, return `{"success": false, "message": "..."}`
    - _Requirements: 12.4, 12.5, 12.6, 12.7_

  - [ ]* 12.2 Write property test for template placeholder resolution
    - **Property 7: Template Placeholder Resolution** — verify all `{{...}}` patterns resolved (to field value or empty string), no unresolved patterns remain
    - **Validates: Requirements 12.5, 12.6**

  - [ ]* 12.3 Write property test for Create Chit record validity
    - **Property 9: Create Chit Action Produces Valid Record** — verify output chit has correct field values, owner_id, and created_datetime
    - **Validates: Requirements 12.4**

- [~] 13. Final checkpoint
  - Ensure all backend weather evaluation and create_chit action work correctly. Ensure frontend and backend are wired together (conditions serialize/deserialize, actions execute). Ask the user if questions arise.

- [ ] 14. Update Mega Index, version, and release notes
  - [~] 14.1 Update `src/INDEX.md` with all new functions, templates, and CSS sections
    - Document _renderSmartInput, _renderContactAutocomplete, _renderCreateChitAction, weather evaluation, create_chit executor, new CSS classes, new templates
    - _Requirements: all_

  - [~] 14.2 Update version number in `src/VERSION` and create release notes
    - Run `date "+%Y%m%d.%H%M"` to get current timestamp
    - Write version to `src/VERSION`
    - Create release notes file summarizing the feature
    - _Requirements: all_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- No software installation required — all code uses existing patterns and libraries already in the project
- Property tests are optional per project conventions (no test framework installation allowed)
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The Mega Index, version number, and release notes are updated only once at the very end (task 14)
- All frontend code is vanilla JS with `<template>` elements per project conventions
- Backend code follows existing `rules_engine.py` patterns for condition evaluation and action execution

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["2.4", "3.2", "4.1", "4.2", "4.3"] },
    { "id": 4, "tasks": ["3.3", "4.4", "6.1", "9.1"] },
    { "id": 5, "tasks": ["6.2", "7.1", "8.1"] },
    { "id": 6, "tasks": ["11.1", "12.1"] },
    { "id": 7, "tasks": ["11.2", "12.2", "12.3"] },
    { "id": 8, "tasks": ["14.1"] },
    { "id": 9, "tasks": ["14.2"] }
  ]
}
```
