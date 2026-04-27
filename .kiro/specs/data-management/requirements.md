# Requirements Document

## Introduction

Data Management provides a unified JSON-based export and import system for CWOC, replacing the existing CSV export/import in the Chit Options box. It introduces a new "Data Management" settings box on the Settings page with separate controls for Chit data and User data (settings, tags, custom colors, visual indicators, chit options, active clocks, saved locations, and contacts). Exported files are self-contained and portable between CWOC instances. Import supports two modes: Add to existing data or Replace existing data, with a confirmation dialog for Replace mode.

## Glossary

- **CWOC**: C.W.'s Omni Chits — the application
- **Settings_Page**: The CWOC settings page (`frontend/settings.html`) containing `.setting-group` boxes in a `.settings-grid`
- **Data_Management_Box**: A new `.setting-group` box on the Settings_Page dedicated to export/import controls
- **Chit_Data**: All records from the `chits` database table, including soft-deleted chits
- **User_Data**: All records from the `settings` and `contacts` database tables, encompassing tags, custom colors, visual indicators, chit options, active clocks, saved locations, and contacts
- **Export_File**: A JSON file downloaded by the user containing either Chit_Data or User_Data in a self-contained, portable format
- **Import_Mode**: The user's choice when importing — either "Add" (merge with existing data) or "Replace" (overwrite existing data)
- **Add_Mode**: Import mode that merges imported records with existing records without removing any current data
- **Replace_Mode**: Import mode that deletes all existing records of the relevant type and replaces them with imported records
- **Confirmation_Dialog**: A modal dialog styled after the existing delete chit pattern, requiring explicit user confirmation before destructive operations
- **Backend_API**: The FastAPI backend (`backend/main.py`) serving REST endpoints under `/api/`
- **Export_Envelope**: The top-level JSON structure of an Export_File, containing metadata (version, export date, instance ID, data type) and the data payload

## Requirements

### Requirement 1: Data Management Settings Box

**User Story:** As a CWOC user, I want a dedicated Data Management section on the Settings page, so that I have a clear, organized place to export and import my data.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a Data_Management_Box as a separate `.setting-group` box in the `.settings-grid` with the heading "📦 Data Management"
2. THE Data_Management_Box SHALL contain two visually distinct subsections: one for Chit_Data and one for User_Data
3. WHEN the Data_Management_Box is rendered, THE Settings_Page SHALL remove the existing "Export / Import" section from the "Chit Options" setting group
4. THE Data_Management_Box SHALL follow the existing parchment/1940s visual theme using styles from `shared-page.css`

### Requirement 2: Chit Data Export

**User Story:** As a CWOC user, I want to export all my chit data as a JSON file, so that I can back up my chits or transfer them to another CWOC instance.

#### Acceptance Criteria

1. THE Data_Management_Box SHALL display an "Export" button in the Chit_Data subsection
2. WHEN the user clicks the Chit_Data export button, THE Backend_API SHALL return all records from the `chits` table as JSON
3. WHEN the Chit_Data export completes, THE Settings_Page SHALL trigger a browser download of the Export_File with the filename format `cwoc-chits-YYYY-MM-DD.json`
4. THE Export_File for Chit_Data SHALL contain an Export_Envelope with fields: `type` ("chits"), `version` (current CWOC version), `exported_at` (ISO 8601 timestamp), `instance_id` (the CWOC instance identifier), and a `data` array of chit records
5. THE Export_File SHALL preserve all chit fields including JSON-serialized fields (tags, checklist, people, child_chits, alerts, recurrence_rule, recurrence_exceptions) in their deserialized form

### Requirement 3: User Data Export

**User Story:** As a CWOC user, I want to export all my user data (settings, tags, colors, locations, contacts) as a JSON file, so that I can back up my configuration or replicate it on another CWOC instance.

#### Acceptance Criteria

1. THE Data_Management_Box SHALL display an "Export" button in the User_Data subsection
2. WHEN the user clicks the User_Data export button, THE Backend_API SHALL return all records from the `settings` table and the `contacts` table as JSON
3. WHEN the User_Data export completes, THE Settings_Page SHALL trigger a browser download of the Export_File with the filename format `cwoc-userdata-YYYY-MM-DD.json`
4. THE Export_File for User_Data SHALL contain an Export_Envelope with fields: `type` ("userdata"), `version` (current CWOC version), `exported_at` (ISO 8601 timestamp), `instance_id` (the CWOC instance identifier), and a `data` object containing `settings` (array of settings records) and `contacts` (array of contact records)
5. THE Export_File SHALL preserve all settings fields with JSON-serialized fields (tags, default_filters, custom_colors, visual_indicators, chit_options, active_clocks, saved_locations) in their deserialized form
6. THE Export_File SHALL preserve all contact fields including JSON-serialized fields (phones, emails, addresses) in their deserialized form

### Requirement 4: Chit Data Import with Add Mode

**User Story:** As a CWOC user, I want to import chit data from a JSON file and add it to my existing chits, so that I can merge data from another CWOC instance without losing my current chits.

#### Acceptance Criteria

1. THE Data_Management_Box SHALL display an "Import" button in the Chit_Data subsection
2. WHEN the user clicks the Chit_Data import button, THE Settings_Page SHALL open a file picker accepting `.json` files
3. WHEN a valid Chit_Data Export_File is selected, THE Settings_Page SHALL present the user with a choice between Add_Mode and Replace_Mode
4. WHEN the user selects Add_Mode for Chit_Data, THE Backend_API SHALL insert each imported chit as a new record with a newly generated ID, preserving all other field values
5. WHEN the Add_Mode import completes, THE Settings_Page SHALL display a summary message indicating the number of chits imported
6. IF the selected file does not contain a valid Export_Envelope with `type` equal to "chits", THEN THE Settings_Page SHALL display an error message "Invalid file: expected a CWOC chit data export"

### Requirement 5: Chit Data Import with Replace Mode

**User Story:** As a CWOC user, I want to import chit data and replace all my existing chits, so that I can restore from a backup or fully migrate from another instance.

#### Acceptance Criteria

1. WHEN the user selects Replace_Mode for Chit_Data, THE Settings_Page SHALL display a Confirmation_Dialog with the text "This will override and replace all chit data. Are you sure?"
2. THE Confirmation_Dialog SHALL include a confirm button and a cancel button, styled consistently with the existing delete chit modal pattern
3. WHEN the user confirms the Replace_Mode dialog, THE Backend_API SHALL delete all existing records from the `chits` table and insert all records from the Export_File
4. WHEN the user cancels the Replace_Mode dialog, THE Settings_Page SHALL close the dialog and take no import action
5. WHEN the Replace_Mode import completes, THE Settings_Page SHALL display a summary message indicating the number of chits replaced

### Requirement 6: User Data Import with Add Mode

**User Story:** As a CWOC user, I want to import user data and merge it with my existing settings and contacts, so that I can incorporate configuration from another instance.

#### Acceptance Criteria

1. THE Data_Management_Box SHALL display an "Import" button in the User_Data subsection
2. WHEN the user clicks the User_Data import button, THE Settings_Page SHALL open a file picker accepting `.json` files
3. WHEN a valid User_Data Export_File is selected, THE Settings_Page SHALL present the user with a choice between Add_Mode and Replace_Mode
4. WHEN the user selects Add_Mode for User_Data, THE Backend_API SHALL merge imported settings by combining array fields (tags, custom_colors, saved_locations) with existing values, deduplicating where applicable
5. WHEN the user selects Add_Mode for User_Data, THE Backend_API SHALL insert each imported contact as a new record with a newly generated ID, skipping contacts whose display_name and given_name match an existing contact
6. WHEN the Add_Mode import completes, THE Settings_Page SHALL display a summary message indicating the number of contacts added and settings fields merged
7. IF the selected file does not contain a valid Export_Envelope with `type` equal to "userdata", THEN THE Settings_Page SHALL display an error message "Invalid file: expected a CWOC user data export"

### Requirement 7: User Data Import with Replace Mode

**User Story:** As a CWOC user, I want to import user data and replace all my existing settings and contacts, so that I can fully restore my configuration from a backup.

#### Acceptance Criteria

1. WHEN the user selects Replace_Mode for User_Data, THE Settings_Page SHALL display a Confirmation_Dialog with the text "This will override and replace all user data. Are you sure?"
2. THE Confirmation_Dialog SHALL include a confirm button and a cancel button, styled consistently with the existing delete chit modal pattern
3. WHEN the user confirms the Replace_Mode dialog, THE Backend_API SHALL delete all existing records from the `settings` and `contacts` tables and insert all records from the Export_File
4. WHEN the user cancels the Replace_Mode dialog, THE Settings_Page SHALL close the dialog and take no import action
5. WHEN the Replace_Mode import completes, THE Settings_Page SHALL display a summary message indicating the number of settings and contacts replaced
6. WHEN the Replace_Mode import for User_Data completes, THE Settings_Page SHALL reload the current settings from the Backend_API to reflect the imported values

### Requirement 8: Export File Portability

**User Story:** As a CWOC user, I want exported files to be self-contained and portable, so that I can import them into any CWOC instance regardless of its current state.

#### Acceptance Criteria

1. THE Export_File SHALL contain all data needed to reconstruct the exported records without requiring any external references
2. THE Export_Envelope SHALL include a `version` field indicating the CWOC version that produced the export
3. THE Export_File SHALL use UTF-8 encoding
4. THE Backend_API SHALL serialize the Export_File with human-readable JSON formatting (indented)
5. FOR ALL valid Export_Files, exporting data and then importing it in Replace_Mode SHALL produce a dataset equivalent to the original exported data (round-trip property)

### Requirement 9: Backend Export API Endpoints

**User Story:** As a developer, I want dedicated API endpoints for data export, so that the frontend can request export data cleanly.

#### Acceptance Criteria

1. THE Backend_API SHALL expose a `GET /api/export/chits` endpoint that returns all chit records wrapped in an Export_Envelope
2. THE Backend_API SHALL expose a `GET /api/export/userdata` endpoint that returns all settings and contacts records wrapped in an Export_Envelope
3. WHEN the `GET /api/export/chits` endpoint is called, THE Backend_API SHALL deserialize all JSON-serialized fields before including them in the response
4. WHEN the `GET /api/export/userdata` endpoint is called, THE Backend_API SHALL deserialize all JSON-serialized fields in settings and contacts before including them in the response

### Requirement 10: Backend Import API Endpoints

**User Story:** As a developer, I want dedicated API endpoints for data import, so that the frontend can submit import data with the chosen mode.

#### Acceptance Criteria

1. THE Backend_API SHALL expose a `POST /api/import/chits` endpoint accepting a JSON body with fields `mode` ("add" or "replace") and `data` (the Export_Envelope)
2. THE Backend_API SHALL expose a `POST /api/import/userdata` endpoint accepting a JSON body with fields `mode` ("add" or "replace") and `data` (the Export_Envelope)
3. IF the `mode` field is not "add" or "replace", THEN THE Backend_API SHALL return HTTP 400 with an error message
4. IF the `data` field does not contain a valid Export_Envelope, THEN THE Backend_API SHALL return HTTP 400 with a descriptive error message
5. WHEN the import succeeds, THE Backend_API SHALL return a JSON response with a `summary` object containing counts of records processed

### Requirement 11: Remove Legacy CSV Export/Import

**User Story:** As a CWOC user, I want the old CSV export/import to be removed, so that there is a single, consistent data management interface.

#### Acceptance Criteria

1. WHEN the Data_Management_Box is implemented, THE Settings_Page SHALL remove the "Export / Import" subsection from the "Chit Options" setting group
2. THE Settings_Page SHALL remove the CSV file input element and its associated `exportCSV` and `importCSV` function calls from the HTML
3. THE `exportCSV`, `importCSV`, and `_parseCSVLine` functions in `settings.js` SHALL be removed

### Requirement 12: Help Documentation Update

**User Story:** As a CWOC user, I want the help page to document the new Data Management feature, so that I can understand how to export and import my data.

#### Acceptance Criteria

1. WHEN the Data Management feature is implemented, THE help page SHALL include a new "Data Management" section describing the export and import functionality
2. THE help page SHALL document the two data categories (Chit Data and User Data) and what each contains
3. THE help page SHALL document the two import modes (Add and Replace) and their behavior
4. THE help page SHALL update the Settings section to reference "Data Management" instead of "Export / Import — CSV export and import"
