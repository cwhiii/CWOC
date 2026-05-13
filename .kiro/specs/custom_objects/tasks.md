# Implementation Plan: Custom Objects

## Overview

Implement the generic Custom Objects registry system — database tables, seed data, Pydantic models, API routes, and a dedicated editor page. This spec covers only the registry infrastructure; consumer-zone-specific logic is handled by separate specs.

## Tasks

- [x] 1. Database migration and seed data
  - [x] 1.1 Create migration function for custom_objects and zone_assignments tables
    - Add `migrate_create_custom_objects_tables()` to `src/backend/migrations.py`
    - Create `custom_objects` table with all columns per design (id, type, sub_type, category, name, value_type, units, metric_units, range_min, range_max, active, deleted, sort_order, is_standard, conditional_display, owner_id, created_datetime, modified_datetime)
    - Create `zone_assignments` table (id, custom_object_id, zone_id, config, sort_order, owner_id)
    - Add UNIQUE constraints: `(type, category, name, owner_id)` on custom_objects, `(custom_object_id, zone_id, owner_id)` on zone_assignments
    - Register the migration call in `src/backend/main.py` startup
    - _Requirements: 1.1, 1.5, 1.6, 2.1, 2.2_

  - [x] 1.2 Create seed data function
    - Add `seed_custom_objects(owner_id)` function in `src/backend/migrations.py` (or a new `src/backend/seeds.py` if cleaner)
    - Seed Illnesses (10 items): Cough, Fatigue/Tiredness, Fever/Chills, Headache, Runny or Stuffy Nose, Sore Throat, Sneezing, Muscle/Body Aches, Nausea/Vomiting/Diarrhea, Shortness of Breath — type="Symptom", category="Illnesses", value_type="boolean"
    - Seed Injuries (10 items): Pain (localized), Swelling, Bruising/Redness, Limited Movement/Stiffness, Bleeding, Tenderness, Headache (head injuries), Nausea/Dizziness (concussion), Numbness/Tingling, Fatigue (trauma/blood loss) — type="Symptom", category="Injuries", value_type="boolean"
    - Seed Allergies (10 items): Sneezing, Runny or Stuffy Nose, Itchy/Watery Eyes, Itching/Rash/Hives, Cough/Post-nasal Drip, Fatigue, Headache/Sinus Pressure, Swelling (lips, face, throat), Shortness of Breath/Wheezing, Redness/Skin Irritation — type="Symptom", category="Allergies", value_type="boolean"
    - Seed Vitals (6 items): Heart Rate (integer, bpm, 60-100), Blood Pressure Systolic (integer, mmHg, 90-120), Blood Pressure Diastolic (integer, mmHg, 60-80), Oxygen Saturation (integer, %, 95-100), Temperature (decimal, °F/°C, 97.0-99.0), Period Active (boolean, conditional_display: {"setting": "sex", "equals": "Woman"})
    - Seed Body (3 items): Weight (decimal, lbs/kg), Height (decimal, in/cm), Glucose (integer, mg/dL / mmol/L)
    - Seed Activity (2 items): Distance (decimal, mi/km), Calories (integer, kcal)
    - All seeded entries: is_standard=1, no zone_assignments created
    - Call seed function after migration if no custom_objects exist for the user
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 2. Pydantic models and API route module
  - [x] 2.1 Add Pydantic models to `src/backend/models.py`
    - Add `CustomObjectCreate` model (type, sub_type, category, name, value_type, units, metric_units, range_min, range_max, conditional_display)
    - Add `CustomObjectUpdate` model (all optional: name, sub_type, category, units, metric_units, range_min, range_max, active, sort_order, conditional_display)
    - Add `ZoneAssignmentCreate` model (zone_id, config, sort_order)
    - Add `ZoneAssignmentUpdate` model (config, sort_order)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8_

  - [x] 2.2 Create route module `src/backend/routes/custom_objects.py` with CRUD endpoints
    - GET `/api/custom-objects` — list all objects for user, optional `?type=` and `?category=` filters
    - POST `/api/custom-objects` — create new object, validate value_type is one of integer/decimal/boolean/string, enforce unique constraint (409 on duplicate), generate UUID, set timestamps
    - PUT `/api/custom-objects/{id}` — update mutable fields, update modified_datetime
    - DELETE `/api/custom-objects/{id}` — soft-delete (active=0, deleted=1)
    - POST `/api/custom-objects/{id}/restore` — restore soft-deleted standard object (400 if not standard)
    - Return zone_assignments as nested array in GET responses
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.10, 1.5, 1.7, 1.8, 1.9_

  - [x] 2.3 Add zone assignment endpoints to the route module
    - GET `/api/custom-objects/zone/{zone_id}` — return active objects assigned to zone, include zone-specific config from assignment
    - POST `/api/custom-objects/{id}/assign` — create zone assignment, 409 if already exists
    - PUT `/api/custom-objects/{id}/assign/{zone_id}` — update assignment config/sort_order
    - DELETE `/api/custom-objects/{id}/assign/{zone_id}` — remove assignment
    - Zone query must exclude inactive objects (active=0)
    - _Requirements: 5.6, 5.7, 5.8, 5.9, 2.3, 2.4, 2.5, 2.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 2.4 Register the router in `src/backend/main.py`
    - Import and include the custom_objects router with appropriate prefix
    - _Requirements: 5.1_

- [x] 3. Checkpoint
  - Ensure all backend code is wired together and consistent. Ask the user if questions arise.

- [x] 4. Custom Objects Editor page — HTML and base structure
  - [x] 4.1 Create `src/frontend/html/custom-objects-editor.html`
    - Use `_template.html` as starting point, set `data-page-title="Custom Objects"`
    - Load `shared-page.css`, `shared-editor.css`, and a new `custom-objects-editor.css` if needed
    - Load `shared-page.js`, then `custom-objects-editor.js`
    - Add filter bar (type dropdown, search input)
    - Add "Create Custom Object" button
    - Add container for object list grouped by type
    - Add Create/Edit modal template (name, type, sub_type, category, value_type, units, metric_units, range_min, range_max, conditional_display)
    - Add Zone Management modal template (zone list with toggles, per-zone config, sort_order)
    - _Requirements: 4.1, 4.2, 4.3, 4.9, 4.10_

  - [x] 4.2 Create `src/frontend/js/pages/custom-objects-editor.js`
    - Fetch all custom objects on page load (GET /api/custom-objects)
    - Render objects grouped by type, each row showing: name, zone badges, active toggle, edit button, zone management button, delete button
    - Implement type filter dropdown (populated from existing types)
    - Implement name search filter
    - Implement Create/Edit modal: open, validate, submit (POST or PUT), refresh list
    - Implement active/inactive toggle (PUT to update active status)
    - Implement soft-delete (DELETE endpoint) with confirmation modal
    - Implement restore for standard objects (POST restore endpoint)
    - Show/hide units and range fields based on value_type selection
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 4.8_

  - [x] 4.3 Implement zone management UI in the editor page
    - Zone management modal: list known zone identifiers (derived from existing assignments)
    - Toggle to assign/unassign object to each zone (POST assign / DELETE assign)
    - Per-zone config editor (raw JSON textarea for unknown zones)
    - Sort order field per zone
    - Display zone assignment badges on each object row
    - _Requirements: 4.5, 4.6, 2.3_

- [x] 5. Navigation and integration
  - [x] 5.1 Add navigation link to Custom Objects Editor
    - Add link in the shared navigation (header/sidebar) pointing to `custom-objects-editor.html`
    - Ensure it appears on both desktop and mobile navigation
    - _Requirements: 4.10_

- [x] 6. Final checkpoint
  - Ensure all code is consistent, all endpoints are wired, the editor page loads and functions. Ask the user if questions arise.

- [x]* 7. Property-based tests (optional)
  - [x]* 7.1 Write property test for Custom Object serialization round-trip
    - **Property 1: Custom Object Serialization Round-Trip**
    - **Validates: Requirements 1.1**

  - [x]* 7.2 Write property test for value_type field constraints
    - **Property 2: Value Type Determines Valid Fields**
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [x]* 7.3 Write property test for free-text type field
    - **Property 3: Type Field Accepts Any String**
    - **Validates: Requirements 1.7, 6.2**

  - [x]* 7.4 Write property test for value_type validation
    - **Property 4: Value Type Validation**
    - **Validates: Requirements 1.8**

  - [x]* 7.5 Write property test for name uniqueness
    - **Property 5: Name Uniqueness Within Type and Category**
    - **Validates: Requirements 1.5, 5.10**

  - [x]* 7.6 Write property test for inactive object zone exclusion
    - **Property 6: Inactive Objects Hidden From Zone Queries**
    - **Validates: Requirements 2.5**

  - [x]* 7.7 Write property test for zone config passthrough
    - **Property 7: Zone Assignment Config Passthrough**
    - **Validates: Requirements 2.6, 6.4**

  - [x]* 7.8 Write property test for zone identifier flexibility
    - **Property 8: Zone Identifier Accepts Any String**
    - **Validates: Requirements 6.3**

  - [x]* 7.9 Write property test for multi-zone assignment
    - **Property 9: Multi-Zone Assignment**
    - **Validates: Requirements 2.3, 6.3**

  - [x]* 7.10 Write property test for soft delete preservation
    - **Property 10: Soft Delete Preserves Data**
    - **Validates: Requirements 4.7, 4.8**

  - [x]* 7.11 Write property test for conditional display rule storage
    - **Property 11: Conditional Display Rule Storage**
    - **Validates: Requirements 6.1, 6.6**

## Notes

- Tasks marked with `*` are optional and can be skipped
- No installs required — all dependencies (FastAPI, Pydantic, SQLite) already exist in the project
- No server running tasks — all verification is structural
- This spec covers ONLY the generic registry infrastructure — no consumer-zone-specific logic
- The seed function does NOT create zone assignments; that is each consumer zone's responsibility
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "5.1"] },
    { "id": 6, "tasks": ["4.3"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "7.10", "7.11"] }
  ]
}
```
