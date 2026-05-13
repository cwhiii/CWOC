# Requirements Document

## Introduction

Custom Zones extends the CWOC Custom Objects (CO) system to let users create named collections of Custom Objects that render as additional collapsible zones in the chit editor. Currently, only the built-in "Health Indicators" zone exists (querying objects assigned to `indicators_zone`). This feature allows users to define arbitrary zones, assign COs to them, reorder items within zones, and have those zones appear automatically on all chits in the editor — using the same data-driven rendering and UUID-keyed `health_data` storage as the indicators zone.

## Glossary

- **CO_Editor**: The Custom Objects editor page (`custom-objects-editor.html`) where users manage their Custom Object registry and zone assignments
- **Custom_Zone**: A user-created named zone that groups Custom Objects for display in the chit editor; stored as a record in the `custom_zones` metadata table with zone assignments linking objects to it
- **Chit_Editor**: The chit editing page (`editor.html`) where users view and edit individual chits, including collapsible data zones
- **Zone_Assignment**: A record in the `zone_assignments` table linking a Custom Object to a specific zone with optional config and sort_order
- **Health_Data**: The JSON field on each chit (`health_data`) that stores UUID-keyed values for all Custom Object inputs across all zones
- **Multi_Select_Picker**: A searchable multi-select component that allows selecting multiple Custom Objects from the registry (checkboxes, search by name/type/sub_type)
- **Zone_Panel**: A collapsible section in the chit editor that renders input fields for all Custom Objects assigned to a given zone
- **Main_Zones_Grid**: The 2-column CSS grid layout (`.main-zones-grid`) in the chit editor that arranges zone panels
- **Custom_Zones_Table**: A new metadata table (`custom_zones`) storing zone name, zone_id, sort_order, and owner_id

## Requirements

### Requirement 1: Custom Zone Listing in CO Editor

**User Story:** As a user, I want to see all my custom zones listed at the top of the CO editor page, so that I can quickly access and manage my zone configurations.

#### Acceptance Criteria

1. WHEN the CO_Editor page loads, THE CO_Editor SHALL display a "Custom Zones" section at the top of the page, above the filter bar and object list
2. WHEN custom zones exist, THE CO_Editor SHALL list each Custom_Zone by name with its object count, and edit/delete action buttons
3. WHEN no custom zones exist, THE CO_Editor SHALL display a brief message indicating no custom zones have been created yet
4. THE CO_Editor SHALL display custom zones in their configured sort_order

### Requirement 2: Custom Zone Creation

**User Story:** As a user, I want to create new custom zones with a name, so that I can organize Custom Objects into meaningful groups for the chit editor.

#### Acceptance Criteria

1. THE CO_Editor SHALL display a "Create Custom Zone" button in the Custom Zones section
2. WHEN the user clicks the "Create Custom Zone" button, THE CO_Editor SHALL open a modal dialog with a text input for the zone name and Cancel/Create buttons
3. WHEN the user submits a valid zone name, THE CO_Editor SHALL create a new Custom_Zone record in the Custom_Zones_Table with a generated zone_id (slugified from the name, prefixed with `cz_`)
4. IF the user submits an empty zone name, THEN THE CO_Editor SHALL display a validation error and prevent creation
5. IF a Custom_Zone with the same zone_id already exists, THEN THE CO_Editor SHALL display an error indicating the name is taken
6. WHEN a new Custom_Zone is created, THE CO_Editor SHALL immediately open the zone editor for that zone

### Requirement 3: Custom Zone Editing — Object Assignment

**User Story:** As a user, I want to add and remove Custom Objects from a custom zone, so that I can control which fields appear in that zone in the chit editor.

#### Acceptance Criteria

1. WHEN the user opens a Custom_Zone for editing, THE CO_Editor SHALL display the list of Custom Objects currently assigned to that zone, grouped by sub_type and sorted by sort_order
2. THE CO_Editor SHALL provide a Multi_Select_Picker (with search by name, type, and sub_type) to add Custom Objects to the zone
3. WHEN the user confirms selections from the picker, THE CO_Editor SHALL create Zone_Assignments linking each selected object to the Custom_Zone with incremental sort_order values
4. WHEN the user clicks the remove button on an assigned object, THE CO_Editor SHALL delete the Zone_Assignment for that object
5. THE CO_Editor SHALL display assigned objects using the same 3-column grid layout used by the indicators zone (1 column on mobile)

### Requirement 4: Custom Zone Editing — Drag-to-Reorder

**User Story:** As a user, I want to drag items within a custom zone to reorder them, so that I can control the display order of fields in the chit editor.

#### Acceptance Criteria

1. WHEN a Custom_Zone contains assigned objects, THE CO_Editor SHALL allow the user to drag items to reorder them within the zone
2. WHEN the user completes a drag-to-reorder operation, THE CO_Editor SHALL persist the new sort_order values via the bulk reorder API endpoint
3. THE CO_Editor SHALL maintain sub_type grouping during reorder operations (items reorder within their sub_type group)
4. THE CO_Editor SHALL support both desktop drag (HTML5 drag events) and mobile drag (touch hold + move)

### Requirement 5: Drag-to-Reorder for Indicators Zone

**User Story:** As a user, I want to drag items within the indicators zone to reorder them, so that I can control the display order of health indicator fields.

#### Acceptance Criteria

1. WHEN the indicators_zone section is displayed in the CO_Editor, THE CO_Editor SHALL allow the user to drag items to reorder them
2. WHEN the user completes a drag-to-reorder operation in the indicators_zone, THE CO_Editor SHALL persist the new sort_order values via the bulk reorder API endpoint
3. THE CO_Editor SHALL support both desktop drag and mobile drag for the indicators zone

### Requirement 6: Custom Zone Preview

**User Story:** As a user, I want to preview what a custom zone will look like in the chit editor, so that I can verify the layout before navigating away.

#### Acceptance Criteria

1. WHEN a Custom_Zone is being edited, THE CO_Editor SHALL display a "Preview" button
2. WHEN the user clicks the "Preview" button, THE CO_Editor SHALL render a preview of the zone using the same collapsible Zone_Panel layout, 3-column field grid, and input types as the Chit_Editor
3. THE preview SHALL display fields grouped by sub_type with appropriate input types (numeric for integer/decimal, checkbox for boolean, text for string)
4. THE preview SHALL apply range highlighting (red/blue borders for out-of-range values) and unit labels matching the user's unit system setting

### Requirement 7: Custom Zones Rendering in Chit Editor

**User Story:** As a user, I want my custom zones to appear as collapsible zones in the chit editor on all chits, so that I can record data for my custom fields alongside built-in zones.

#### Acceptance Criteria

1. WHEN the Chit_Editor loads, THE Chit_Editor SHALL query all Custom_Zones for the user and render each non-empty zone as a collapsible Zone_Panel
2. THE Chit_Editor SHALL display custom Zone_Panels on all chits without requiring per-chit configuration
3. EACH custom Zone_Panel SHALL use the same 3-column grid layout for fields as the indicators zone (1 column on mobile)
4. EACH custom Zone_Panel SHALL group fields by sub_type within the zone, sorted alphabetically
5. EACH custom Zone_Panel SHALL render input fields based on value_type: numeric input for integer/decimal, checkbox for boolean, text input for string
6. EACH custom Zone_Panel SHALL evaluate conditional_display rules against user settings (same behavior as indicators zone)
7. EACH custom Zone_Panel SHALL apply range highlighting on numeric fields (same behavior as indicators zone)
8. EACH custom Zone_Panel SHALL display unit labels based on the user's unit_system setting (metric or imperial)
9. IF a Custom_Zone has zero assigned objects (or all are hidden by conditional_display), THEN THE Chit_Editor SHALL NOT render a Zone_Panel for that zone
10. Custom Zone_Panels SHALL render in the order defined by the Custom_Zones_Table sort_order

### Requirement 8: Custom Zone Column Placement

**User Story:** As a user, I want custom zones to alternate between left and right columns in the chit editor grid, so that both columns remain roughly equal in length.

#### Acceptance Criteria

1. WHEN multiple custom zones exist, THE Chit_Editor SHALL alternate their placement between the left column and right column of the Main_Zones_Grid
2. THE Chit_Editor SHALL place the first custom zone in the next available grid cell after the built-in zones, then alternate subsequent zones naturally via CSS grid auto-placement (single-column items fill left then right)
3. ON mobile viewports (≤768px), THE Chit_Editor SHALL stack all custom zones vertically in a single column (matching existing responsive behavior)

### Requirement 9: Custom Zone Data Storage

**User Story:** As a user, I want data entered in custom zone fields to be saved with the chit, so that my custom field values persist across sessions.

#### Acceptance Criteria

1. WHEN the user enters a value in a custom zone field, THE Chit_Editor SHALL store the value in the chit's Health_Data field keyed by the Custom Object's UUID
2. WHEN the Chit_Editor loads a chit with existing Health_Data, THE Chit_Editor SHALL populate custom zone fields with their stored values
3. THE Chit_Editor SHALL use the same UUID-keyed storage format for custom zone data as the indicators zone uses
4. WHEN saving a chit, THE Chit_Editor SHALL gather values from all custom zone fields and merge them into the health_data payload alongside indicators zone values

### Requirement 10: Custom Zone Deletion

**User Story:** As a user, I want to delete a custom zone I no longer need, so that it stops appearing in the chit editor.

#### Acceptance Criteria

1. WHEN the user clicks the delete button on a Custom_Zone, THE CO_Editor SHALL display a confirmation dialog
2. WHEN the user confirms deletion, THE CO_Editor SHALL remove all Zone_Assignments for that Custom_Zone AND delete the Custom_Zone record from the Custom_Zones_Table
3. WHEN a Custom_Zone is deleted, THE Chit_Editor SHALL no longer render a Zone_Panel for that zone on subsequent loads
4. WHEN a Custom_Zone is deleted, THE Chit_Editor SHALL retain any previously stored Health_Data values (data is not purged from chits)

### Requirement 11: Custom Zone Rename

**User Story:** As a user, I want to rename a custom zone, so that I can fix typos or update the name without recreating the zone and losing assignments.

#### Acceptance Criteria

1. WHEN the user is editing a Custom_Zone, THE CO_Editor SHALL display the zone name as an editable field
2. WHEN the user changes the zone name and saves, THE CO_Editor SHALL update the name in the Custom_Zones_Table
3. THE zone_id SHALL NOT change when the zone is renamed (only the display name changes)

### Requirement 12: Custom Zone Ordering

**User Story:** As a user, I want to reorder my custom zones, so that I can control which zones appear first in the chit editor.

#### Acceptance Criteria

1. THE CO_Editor SHALL allow the user to drag custom zones in the listing to reorder them
2. WHEN the user reorders zones, THE CO_Editor SHALL persist the new sort_order values to the Custom_Zones_Table
3. THE Chit_Editor SHALL render custom Zone_Panels in the order defined by the Custom_Zones_Table sort_order

### Requirement 13: Custom Zone API — Metadata Table

**User Story:** As a developer, I need a database table to store custom zone metadata (name, zone_id, sort_order), so that zones have persistent identity independent of their assignments.

#### Acceptance Criteria

1. THE backend SHALL create a `custom_zones` table with columns: id (TEXT PK), zone_id (TEXT UNIQUE per owner), name (TEXT), sort_order (INTEGER), owner_id (TEXT), created_datetime (TEXT)
2. THE backend SHALL provide GET `/api/custom-zones` returning all custom zones for the authenticated user, ordered by sort_order
3. THE backend SHALL provide POST `/api/custom-zones` to create a new zone (accepts name, generates zone_id)
4. THE backend SHALL provide PUT `/api/custom-zones/{zone_id}` to update name and/or sort_order
5. THE backend SHALL provide DELETE `/api/custom-zones/{zone_id}` to delete the zone record and all its zone_assignments

### Requirement 14: Custom Zone API — Bulk Reorder Assignments

**User Story:** As a developer, I want an API endpoint to update sort_order for multiple zone assignments at once, so that drag-to-reorder can persist in a single request.

#### Acceptance Criteria

1. THE API SHALL provide a PUT endpoint `/api/custom-objects/zone/{zone_id}/reorder` that accepts an ordered list of custom_object_ids
2. WHEN the endpoint is called, THE API SHALL update the sort_order for each Zone_Assignment sequentially (first item = 1, second = 2, etc.)
3. IF a Zone_Assignment does not exist for a given object and zone, THEN THE API SHALL skip that item and continue processing the rest
