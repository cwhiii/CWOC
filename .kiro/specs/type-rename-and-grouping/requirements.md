# Requirements Document

## Introduction

This feature adds two capabilities to CWOC's Custom Objects system: (1) the ability to rename a type across all objects of that type from the Custom Objects Editor page, and (2) visual grouping of indicators by their `type` field in both the chit editor's Indicators Zone and the dashboard's Indicators view.

## Glossary

- **Custom_Objects_Editor**: The secondary page (`custom-objects-editor.html`) for browsing, creating, editing, and managing Custom Objects.
- **Type_Group_Header**: The collapsible header element in the Custom Objects Editor that labels a group of objects sharing the same `type` value.
- **Rename_Type_Modal**: A custom styled modal dialog for entering a new type name when renaming a type.
- **Rename_Type_Endpoint**: The backend API endpoint `PUT /api/custom-objects/rename-type` that updates the `type` field on all matching objects for a given owner.
- **Indicators_Zone**: The health indicators section in the chit editor (`editor-health.js`) that renders input fields for Custom Objects assigned to `zone_id = "indicators_zone"`.
- **Dashboard_Indicators_View**: The indicators tab on the main dashboard (`main-views-indicators.js`) that displays charts, log entries, and calendar views for tracked indicators.
- **Type_Group**: A visual grouping of indicators sharing the same `type` field value, rendered with a collapsible header.
- **Owner**: The authenticated user whose `owner_id` scopes all Custom Object operations.

## Requirements

### Requirement 1: Rename Type Action in Editor

**User Story:** As a user, I want to rename a type from the Custom Objects Editor, so that I can reorganize my objects without editing each one individually.

#### Acceptance Criteria

1.1 WHEN the Custom_Objects_Editor renders a Type_Group_Header, THE Custom_Objects_Editor SHALL display a rename button (icon) within that header.

1.2 WHEN the user clicks the rename button on a Type_Group_Header, THE Custom_Objects_Editor SHALL open the Rename_Type_Modal pre-populated with the current type name.

1.3 WHEN the user confirms the Rename_Type_Modal with a non-empty new name, THE Custom_Objects_Editor SHALL send a request to the Rename_Type_Endpoint with the old type name and the new type name.

1.4 WHEN the Rename_Type_Endpoint receives a valid request, THE Rename_Type_Endpoint SHALL update the `type` field to the new value on all Custom Objects matching the old type string for that Owner.

1.5 WHEN the Rename_Type_Endpoint completes successfully, THE Custom_Objects_Editor SHALL refresh the object list to reflect the updated type grouping.

1.6 IF the user submits the Rename_Type_Modal with an empty string, THEN THE Custom_Objects_Editor SHALL prevent submission and display an inline validation message.

1.7 IF the user cancels the Rename_Type_Modal or presses ESC, THEN THE Custom_Objects_Editor SHALL close the modal without making changes.

1.8 WHEN the Rename_Type_Endpoint receives a request where the new type name equals the old type name, THE Rename_Type_Endpoint SHALL return a success response without modifying any records.

### Requirement 2: Rename Type Backend Endpoint

**User Story:** As a developer, I want a dedicated endpoint for bulk-renaming a type, so that the operation is atomic and consistent.

#### Acceptance Criteria

2.1 THE Rename_Type_Endpoint SHALL accept a PUT request at `/api/custom-objects/rename-type` with a JSON body containing `old_type` (string) and `new_type` (string).

2.2 WHEN the Rename_Type_Endpoint processes a valid request, THE Rename_Type_Endpoint SHALL update all rows in the `custom_objects` table where `type` matches `old_type` and `owner_id` matches the requesting Owner.

2.3 WHEN the Rename_Type_Endpoint completes the update, THE Rename_Type_Endpoint SHALL return a JSON response containing the count of objects updated.

2.4 IF the `old_type` or `new_type` field is missing or empty, THEN THE Rename_Type_Endpoint SHALL return a 422 status with a descriptive error message.

2.5 IF no objects match the `old_type` for the given Owner, THEN THE Rename_Type_Endpoint SHALL return a success response with an updated count of zero.

### Requirement 3: Indicators Zone Type Grouping in Chit Editor

**User Story:** As a user, I want indicators in the chit editor grouped by type with collapsible headers, so that I can quickly find and focus on specific categories of indicators.

#### Acceptance Criteria

3.1 WHEN the Indicators_Zone renders its indicator fields, THE Indicators_Zone SHALL group indicators by their `type` field and display a Type_Group header above each group.

3.2 THE Indicators_Zone SHALL render all Type_Groups in the expanded state by default on each page load.

3.3 WHEN the user clicks a Type_Group header in the Indicators_Zone, THE Indicators_Zone SHALL toggle the visibility of that group's indicator fields between collapsed and expanded.

3.4 THE Indicators_Zone SHALL NOT persist the collapsed or expanded state of Type_Groups between page loads.

3.5 WHEN a Type_Group contains zero visible indicators (all filtered by conditional display rules), THE Indicators_Zone SHALL hide that Type_Group header entirely.

### Requirement 4: Dashboard Indicators View Type Grouping

**User Story:** As a user, I want indicators on the dashboard grouped by type with headers, so that the charts, log, and calendar views are organized by category.

#### Acceptance Criteria

4.1 WHEN the Dashboard_Indicators_View renders indicators in chart mode, THE Dashboard_Indicators_View SHALL group charts by the indicator's `type` field with a visible Type_Group header above each group.

4.2 WHEN the Dashboard_Indicators_View renders indicators in log mode, THE Dashboard_Indicators_View SHALL group log entries by the indicator's `type` field with a visible Type_Group header above each group.

4.3 WHEN the Dashboard_Indicators_View renders indicators in calendar mode, THE Dashboard_Indicators_View SHALL group calendar displays by the indicator's `type` field with a visible Type_Group header above each group.

4.4 THE Dashboard_Indicators_View SHALL render all Type_Groups in the expanded state by default on each page load.

4.5 WHEN the user clicks a Type_Group header in the Dashboard_Indicators_View, THE Dashboard_Indicators_View SHALL toggle the visibility of that group's content between collapsed and expanded.

4.6 THE Dashboard_Indicators_View SHALL NOT persist the collapsed or expanded state of Type_Groups between page loads.

### Requirement 5: Type Group Visual Styling

**User Story:** As a user, I want type group headers to be visually distinct and consistent with the CWOC parchment theme, so that the grouping is clear and aesthetically cohesive.

#### Acceptance Criteria

5.1 THE Type_Group headers in the Indicators_Zone and Dashboard_Indicators_View SHALL display the type name as the header text.

5.2 THE Type_Group headers SHALL include a visual indicator (caret or chevron icon) showing the current expanded or collapsed state.

5.3 THE Type_Group headers SHALL use styling consistent with the existing CWOC parchment theme (brown tones, Lora font, appropriate contrast).

5.4 THE Type_Group headers SHALL be touch-friendly with a minimum tap target height suitable for mobile interaction.
