# Requirements Document

## Introduction

This feature introduces a generic, extensible "Custom Objects" registry system to CWOC. Custom Objects are first-class data entities stored independently of any specific zone or view. The registry stores object *definitions* only — it has no knowledge of where or how objects are displayed. Consumers (zones, views, graphs) maintain their own configuration for which objects they use via zone assignments. The system includes a dedicated management page and a pre-seeded library of common trackable items.

## Glossary

- **Custom_Object**: A registered object definition in the system. Has a type (free-text), sub-type, category, name, value type (integer, decimal, boolean, or string), optional units, and optional acceptable range. The generic building block of the registry — it knows nothing about where it is displayed.
- **Registry**: The SQLite-backed store of all Custom_Object definitions, independent of any specific UI zone or chit. Types are not constrained — any string is valid.
- **Custom_Objects_Editor**: A dedicated page for browsing, creating, editing, and managing Custom_Objects — similar in structure to the contacts editor page. Also manages zone assignments.
- **Zone_Assignment**: A record that assigns a specific Custom_Object to a specific consumer zone. Stored separately from the Custom_Object definition itself. Includes a zone-specific config JSON blob that the registry passes through opaquely.
- **Seed_Library**: The pre-seeded set of standard Custom_Objects that ship with the system, organized by category. Includes types like "Symptom", "Vital", "Measurement", and "Activity" — but these are just initial seed values, not a closed set.
- **Active_Object**: A Custom_Object that is toggled on (exists and is usable in the system). Inactive objects are hidden from all zone queries.
- **Acceptable_Range**: An optional min/max numeric boundary on a Custom_Object that defines "normal" values. Consumers decide how to use this information (color-coding, alerts, etc.).
- **Conditional_Display**: An optional JSON rule on a Custom_Object that consumers evaluate against user settings to decide visibility. The registry stores the rule but does not evaluate it.

## Requirements

### Requirement 1: Custom Object Data Model

**User Story:** As a user, I want trackable items to be stored as structured, typed objects in a generic registry, so that the system is extensible and not hardcoded to specific fields.

#### Acceptance Criteria

1. THE Registry SHALL store each Custom_Object with the following attributes: unique ID, type (free-text string), sub-type (optional free-text string), category (optional free-text string), name, value type (one of: integer, decimal, boolean, string), units (optional), metric_units (optional), acceptable range min (optional), acceptable range max (optional), active status, sort_order, is_standard flag, and conditional_display rule (optional).
2. WHEN a Custom_Object has value type "integer" or "decimal", THE Registry SHALL permit optional units, metric_units, and optional acceptable range (min and max) fields.
3. WHEN a Custom_Object has value type "boolean", THE Registry SHALL store only true/false semantics with no units or range.
4. WHEN a Custom_Object has value type "string", THE Registry SHALL store free-text semantics with no units or range.
5. THE Registry SHALL enforce unique names within the same type and category combination per owner.
6. THE Registry SHALL store Custom_Objects in a dedicated SQLite table independent of any other data tables.
7. THE Registry SHALL treat the type field as a free-text string with no hardcoded enum — any string value is valid, enabling new types to be added without schema changes.
8. THE Registry SHALL constrain the value_type field to exactly one of: "integer", "decimal", "boolean", "string".
9. THE Registry SHALL NOT store any zone-specific display preferences on the Custom_Object itself — these belong to Zone_Assignments.

### Requirement 2: Zone Assignment Model

**User Story:** As a user, I want to independently control which Custom Objects appear in which zones, so that the registry stays generic and each consumer manages its own configuration.

#### Acceptance Criteria

1. THE System SHALL store Zone_Assignments in a separate SQLite table that maps a Custom_Object ID to a zone identifier string.
2. EACH Zone_Assignment SHALL include: Custom_Object ID, zone identifier (free-text string), config (JSON blob for zone-specific settings), and sort_order within that zone.
3. THE System SHALL allow a single Custom_Object to be assigned to multiple zones simultaneously.
4. THE System SHALL allow a Custom_Object to exist in the Registry with no Zone_Assignments (not displayed anywhere, but available for future assignment).
5. WHEN a Custom_Object is deactivated (active = false), THE System SHALL exclude it from all zone queries regardless of its Zone_Assignments.
6. THE Zone_Assignment config field SHALL be an opaque JSON blob — the registry stores and returns it without interpretation or validation. Each consumer zone defines its own config schema.

### Requirement 3: Pre-Seeded Library

**User Story:** As a user, I want a standard library of common trackable items available out of the box, so that I don't have to manually create common entries.

#### Acceptance Criteria

1. WHEN the database is initialized for the first time, THE Registry SHALL seed standard Custom_Objects organized into categories: Illnesses, Injuries, Allergies, Vitals, Body, and Activity.
2. THE Seed SHALL include the following Illnesses category Custom_Objects (type "Symptom", value type "boolean"): Cough, Fatigue/Tiredness, Fever/Chills, Headache, Runny or Stuffy Nose, Sore Throat, Sneezing, Muscle/Body Aches, Nausea/Vomiting/Diarrhea, Shortness of Breath.
3. THE Seed SHALL include the following Injuries category Custom_Objects (type "Symptom", value type "boolean"): Pain (localized), Swelling, Bruising/Redness, Limited Movement/Stiffness, Bleeding, Tenderness, Headache (head injuries), Nausea/Dizziness (concussion), Numbness/Tingling, Fatigue (trauma/blood loss).
4. THE Seed SHALL include the following Allergies category Custom_Objects (type "Symptom", value type "boolean"): Sneezing, Runny or Stuffy Nose, Itchy/Watery Eyes, Itching/Rash/Hives, Cough/Post-nasal Drip, Fatigue, Headache/Sinus Pressure, Swelling (lips, face, throat), Shortness of Breath/Wheezing, Redness/Skin Irritation.
5. THE Registry SHALL mark all seeded entries with is_standard = true to distinguish them from user-created Custom_Objects.
6. THE Seed SHALL include standard vital-sign Custom_Objects (type "Vital", category "Vitals") with value type "integer" or "decimal" as appropriate, with units and acceptable ranges: Heart Rate (integer, bpm), Blood Pressure Systolic (integer, mmHg), Blood Pressure Diastolic (integer, mmHg), Oxygen Saturation (integer, %), Temperature (decimal, °F/°C).
7. THE Seed SHALL include standard body-measurement Custom_Objects (type "Measurement", category "Body") with appropriate value types and units: Weight (decimal, lbs/kg), Height (decimal, in/cm), Glucose (integer, mg/dL / mmol/L).
8. THE Seed SHALL include standard activity Custom_Objects (type "Activity", category "Activity"): Distance (decimal, mi/km), Calories (integer, kcal).
9. THE Seed SHALL include a "Period Active" Custom_Object (type "Vital", category "Vitals", value type "boolean") with a conditional_display rule of `{"setting": "sex", "equals": "Woman"}`.
10. THE Seed SHALL NOT create any Zone_Assignments — zone setup is the responsibility of each consumer zone's own initialization/migration.

### Requirement 4: Custom Objects Editor Page

**User Story:** As a user, I want a dedicated page to browse, filter, create, edit, and manage my Custom Objects and their zone assignments, so that I have full control over what gets tracked and where it appears.

#### Acceptance Criteria

1. THE Custom_Objects_Editor SHALL provide a browsable list of all Custom_Objects grouped by type.
2. THE Custom_Objects_Editor SHALL provide filter controls to show only a specific type or search by name.
3. THE Custom_Objects_Editor SHALL allow the user to create a fully custom Custom_Object by specifying: name, type, sub-type, category, value type (integer, decimal, boolean, or string), units, metric units, and acceptable range.
4. THE Custom_Objects_Editor SHALL allow the user to toggle any Custom_Object between active and inactive states.
5. THE Custom_Objects_Editor SHALL display zone assignment badges on each object row showing which zones it is currently assigned to.
6. THE Custom_Objects_Editor SHALL provide a zone management interface (modal or inline) for each object where the user can add/remove zone assignments and configure per-zone settings.
7. THE Custom_Objects_Editor SHALL allow the user to remove (soft-delete) standard Custom_Objects from the library and restore them later.
8. THE Custom_Objects_Editor SHALL allow the user to edit the name, sub-type, category, units, metric units, and acceptable range of user-created Custom_Objects.
9. THE Custom_Objects_Editor SHALL follow the existing secondary page pattern using shared-page.css, shared-page.js, and the _template.html structure.
10. THE Custom_Objects_Editor SHALL be accessible from the main navigation and function correctly on both desktop and mobile viewports.

### Requirement 5: API Endpoints for Custom Objects

**User Story:** As a developer, I want RESTful API endpoints for managing Custom Objects and their zone assignments, so that the frontend can perform all CRUD operations through a consistent interface.

#### Acceptance Criteria

1. THE System SHALL provide a GET /api/custom-objects endpoint that returns all Custom_Objects for the user, with optional type and category filter query parameters.
2. THE System SHALL provide a POST /api/custom-objects endpoint that creates a new Custom_Object and returns the created object with its generated ID.
3. THE System SHALL provide a PUT /api/custom-objects/{id} endpoint that updates an existing Custom_Object's mutable fields.
4. THE System SHALL provide a DELETE /api/custom-objects/{id} endpoint that soft-deletes a Custom_Object (sets active = false and deleted = true).
5. THE System SHALL provide a POST /api/custom-objects/{id}/restore endpoint that restores a soft-deleted standard Custom_Object.
6. THE System SHALL provide a GET /api/custom-objects/zone/{zone_id} endpoint that returns all active Custom_Objects assigned to the specified zone, including their zone-specific config from the assignment.
7. THE System SHALL provide a POST /api/custom-objects/{id}/assign endpoint that creates a Zone_Assignment for the specified object and zone, accepting zone_id, config, and sort_order.
8. THE System SHALL provide a PUT /api/custom-objects/{id}/assign/{zone_id} endpoint that updates an existing Zone_Assignment's config and sort_order.
9. THE System SHALL provide a DELETE /api/custom-objects/{id}/assign/{zone_id} endpoint that removes a Zone_Assignment.
10. IF a request attempts to create a Custom_Object with a duplicate name within the same type and category, THEN THE System SHALL return a 409 Conflict response with a descriptive error message.

### Requirement 6: Extensibility and Decoupling

**User Story:** As a developer, I want the Custom Objects system to be generic and decoupled from any specific zone, so that any area of the app can consume Custom Objects in the future.

#### Acceptance Criteria

1. THE Registry SHALL expose Custom_Objects through a generic API that does not reference any specific consumer zone in its interface contract.
2. THE Registry SHALL use a type field that is a free-text string with no validation against a fixed set of values, allowing new types to be introduced at any time by simply using a new string.
3. THE Zone_Assignment table SHALL use a zone identifier that is a free-text string, allowing new zones to be added without schema changes.
4. THE Zone_Assignment config field SHALL be an opaque JSON blob that the registry passes through without interpretation, allowing each consumer to define its own configuration schema.
5. THE System SHALL not embed consumer-specific logic (rendering, display evaluation, data storage) in the Registry API layer — all such logic belongs to the consuming zone or page.
6. THE Registry API SHALL return conditional_display rules as stored data — evaluation of these rules is the exclusive responsibility of the consuming zone/page.
