# Implementation Plan: Indicators Zone

## Overview

Re-implement the Indicators Zone as a consumer of the generic Custom Objects registry. This replaces the hardcoded `_healthFields` array in `editor-health.js` with a data-driven approach querying `GET /api/custom-objects/zone/indicators_zone`. Includes backend migrations (zone init + legacy data), rebuilt frontend editor and dashboard views, Quick-Log, graph filtering, and imperial/metric unit switching.

**Prerequisite:** The `custom_objects` spec must be fully implemented before starting this spec. All tasks assume the `custom_objects` and `zone_assignments` tables, seed data, and API endpoints already exist.

## Tasks

- [x] 1. Backend migrations
  - [x] 1.1 Implement `migrate_indicators_zone_init(owner_id)` in `src/backend/migrations.py`
    - Check if any zone_assignments exist with `zone_id = "indicators_zone"` for this owner
    - If none exist, query all seeded Vital, Measurement, Activity objects (`is_standard = 1, deleted = 0`)
    - Create zone_assignments for each with `config = {"is_default": true}` and incremental sort_order
    - Include "Period Active" object in the initialization
    - Wire the call into `src/backend/main.py` startup, after `seed_custom_objects()`
    - Must be idempotent — skip if assignments already exist
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 1.2 Implement `migrate_health_data_to_uuids(owner_id)` in `src/backend/migrations.py`
    - Define `LEGACY_KEY_MAP` dict mapping legacy strings to Custom Object names
    - Build runtime mapping from legacy keys → UUIDs by querying seeded objects
    - Scan all chits with non-null `health_data` for this owner
    - For each legacy key found, add a UUID-keyed entry with the same value
    - Preserve original legacy key entries (non-destructive)
    - Idempotent — skip if UUID key already exists in that chit's health_data
    - Handle blood pressure special case (`bp_systolic`, `bp_diastolic`)
    - Log warning for unknown legacy keys
    - Wire the call into `src/backend/main.py` startup, after zone initialization
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 1.3 Write property tests for zone initialization idempotence
    - **Property 15: Zone Initialization Idempotence**
    - **Validates: Requirements 10.5**

  - [x] 1.4 Write property tests for legacy migration
    - **Property 13: Legacy Key Migration Mapping**
    - **Property 14: Legacy Migration Idempotence**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 2. Rebuild `editor-health.js` — core rendering
  - [x] 2.1 Rewrite `editor-health.js` with data-driven architecture
    - Remove hardcoded `_healthFields` array entirely
    - Implement `_fetchIndicatorObjects()` — calls `GET /api/custom-objects/zone/indicators_zone`, caches in `window._indicatorObjects`
    - Implement `_evaluateConditionalDisplay(rule, settings)` — returns boolean based on cached user settings
    - Implement `_getUnitLabel(obj, unitSystem)` — returns metric_units when metric, units when imperial
    - Implement `_getRangeHighlightClass(value, rangeMin, rangeMax)` — returns CSS class string
    - Implement `_renderIndicatorField(obj, value)` — creates DOM for one indicator input (numeric, checkbox, or text based on value_type)
    - Implement `_loadHealthData(chit)` — orchestrates fetch, evaluate, render
    - Implement `_gatherHealthData()` — collects current values into UUID-keyed object
    - Render fields in sort_order from zone_assignments
    - Mark chit dirty on any input change
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [x] 2.2 Implement default vs per-chit indicator logic
    - Filter objects by `config.is_default` for default rendering
    - On chit load, check `chit.health_data` for UUID keys not in default set — render those as per-chit indicators
    - Persist per-chit indicator UUIDs in health_data on save so they reappear on reload
    - Visually separate default indicators from per-chit indicators (divider line)
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

  - [x] 2.3 Implement "Add Indicator" picker
    - Add "+ Add Indicator" button below indicator fields
    - On click, open a modal listing all non-default Custom Objects assigned to indicators_zone
    - Exclude objects already added as per-chit indicators on the current chit
    - On selection, render that object's input field on the current chit
    - Follow existing CWOC modal pattern (parchment theme, no browser prompts)
    - _Requirements: 2.3, 2.4_

  - [x] 2.4 Write property tests for conditional display evaluation
    - **Property 1: Conditional Display Evaluation**
    - **Validates: Requirements 1.2**

  - [x] 2.5 Write property tests for unit label selection
    - **Property 3: Unit Label Selection**
    - **Validates: Requirements 1.6, 9.2, 9.3, 9.4**

  - [x] 2.6 Write property tests for default vs non-default filtering
    - **Property 6: Default vs Non-Default Indicator Filtering**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 3. Range highlighting and unit switching
  - [x] 3.1 Implement range highlighting CSS and real-time updates
    - Add `.indicator-range-high` (red border/background tint) and `.indicator-range-low` (blue border/background tint) CSS classes to `shared-editor.css`
    - Apply range highlight on initial render and update in real-time as user types
    - No highlight when range is undefined or value is empty
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Implement imperial/metric unit switching
    - Read `unit_system` from cached user settings
    - Display `metric_units` when metric, `units` when imperial
    - Store raw numeric values without conversion — unit label is display-only
    - Handle identical units/metric_units gracefully
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 3.3 Write property tests for range highlight classification
    - **Property 8: Range Highlight Classification**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Quick-Log button
  - [x] 5.1 Add Quick-Log button to Custom Objects Editor page
    - Add "⚡ Quick Log" button in the page header area of `custom-objects-editor.html`
    - On click: `POST /api/chits` with `{point_in_time: now, status: "Complete"}`
    - On success: navigate to `/editor?id={new_chit_id}`
    - On failure: show toast "Failed to create Quick Log chit"
    - The editor loads with indicators zone showing all default indicators
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 6. Dashboard Indicators View — Calendar Mode
  - [x] 6.1 Implement Calendar Mode year-view grid in `main-views-indicators.js`
    - Create `_indicatorsRenderCalendar(data, objects)` function
    - Render a year-view grid with one cell per day (12 rows × 31 cols max)
    - Query chits with health_data to determine which days have readings
    - Implement `_classifyDayColor(dayReadings, objects)` — returns "green", "amber", or "none"
    - Color-code cells: green (all in range), amber (any out of range), unmarked (no data)
    - On day cell click, navigate to or display the chit(s) for that day
    - Mobile-friendly layout
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x]* 6.2 Write property tests for calendar day color classification
    - **Property 9: Calendar Day Color Classification**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

- [x] 7. Dashboard Indicators View — Log Mode
  - [x] 7.1 Implement Log Mode reverse-chronological list in `main-views-indicators.js`
    - Create `_indicatorsRenderLog(data, objects)` function
    - Display chits containing health_data in reverse-chronological order
    - Implement `_buildLogSummary(healthData, objects)` — resolves UUID keys to display names
    - Show date and summary of readings (indicator names and values) for each entry
    - On entry click, open that chit in the editor
    - Mobile-friendly layout
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x]* 7.2 Write property tests for log mode ordering
    - **Property 10: Log Mode Reverse-Chronological Ordering**
    - **Validates: Requirements 6.1**

  - [x]* 7.3 Write property tests for UUID-to-name resolution
    - **Property 11: UUID-to-Name Resolution in Log Summary**
    - **Validates: Requirements 6.2, 6.3**

- [x] 8. Mode toggle and view integration
  - [x] 8.1 Implement mode toggle between Calendar/Log/Charts on dashboard
    - Add a pill toggle (Calendar | Log | Charts) at the top of the indicators view area
    - Use the standard CWOC pill toggle pattern
    - Persist selected mode to localStorage
    - Show/hide the appropriate view based on selection
    - Wire into existing dashboard tab/view system
    - _Requirements: 6.5_

- [x] 9. Graph filtering additions
  - [x] 9.1 Implement graph filter dropdown and "Add Graph" option
    - Populate filter dropdown from `GET /api/custom-objects/zone/graphs`
    - On selection, display graph of that object's readings over time using UUID as key
    - Add "Add Graph" option that opens a picker for any Custom Object not in the graphs zone
    - Persist filter selections to `localStorage` key `cwoc_ind_selection` (UUID array)
    - Restore selections on next visit
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x]* 9.2 Write property tests for graph filter persistence round-trip
    - **Property 12: Graph Filter Persistence Round-Trip**
    - **Validates: Requirements 7.4**

- [x] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- **This spec depends on the `custom_objects` spec being fully implemented first** — all tasks assume the registry tables, seed data, and API endpoints exist
- No installs (no pip, no npm) — all code is vanilla JS frontend and Python backend using existing dependencies
- No server-running tasks — all validation is through automated tests or manual verification

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.1", "3.2"] },
    { "id": 4, "tasks": ["2.4", "2.5", "2.6", "3.3"] },
    { "id": 5, "tasks": ["5.1", "6.1", "7.1"] },
    { "id": 6, "tasks": ["6.2", "7.2", "7.3", "8.1"] },
    { "id": 7, "tasks": ["9.1"] },
    { "id": 8, "tasks": ["9.2"] }
  ]
}
```
