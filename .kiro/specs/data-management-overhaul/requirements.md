# Requirements Document — Data Management Overhaul

## Introduction

This feature overhauls the Data Management section in CWOC Settings to provide granular, modal-driven export/import controls organized into two tiers: a per-user section visible to all users in the general Settings area, and an admin-only section visible only to administrators in the Administration area. The existing flat export/import buttons are replaced by a multi-step modal flow that lets users select data categories, apply filters (by tag, by owner), and then execute the export or import. Admin users gain additional capabilities: cross-user exports with owner and tag filters, raw SQLite backup, and full database restore.

### Key Design Decisions

- **Two-tier architecture**: Per-user data management lives in the general Settings area (scoped to the current user's data only, even if the user is an admin). Admin data management lives in the Administration section (cross-user scope, backup/restore).
- **Modal-driven flow**: Export and import actions open a multi-step modal rather than triggering immediate downloads. This allows category selection, filter configuration, and confirmation before action.
- **OR logic for filters**: Selecting multiple owners or multiple tags exports the union of matching records.
- **Admin tag picker groups by user**: Tags in the admin export modal are displayed as a tree with user names as top-level nodes.
- **Backup/Restore is admin-only**: Raw SQLite `.db` file download and upload with full wipe-and-replace semantics.
- **ICS calendar import stays as-is**: The existing calendar import button remains in the per-user section unchanged.
- **Settings export filter limitation**: Settings only support "All" and "By Owner" filters (no tag filter), because settings are not tagged. Settings include both personal user settings and universal settings (instance name, kiosk options, etc.).

---

## Glossary

- **CWOC**: C.W.'s Omni Chits — the host application
- **Settings_Page**: The CWOC settings page (`frontend/html/settings.html`)
- **Data_Management_Section**: The per-user data management UI block in the general Settings area, visible to all authenticated users
- **Admin_Data_Management_Section**: The admin-only data management UI block in the Administration area, visible only to admin users
- **Export_Modal**: A multi-step modal dialog that guides the user through category selection, filter configuration, and export execution
- **Import_Modal**: A multi-step modal dialog that guides the user through category selection, file upload, and import mode selection
- **Data_Category**: One of three exportable/importable data types: Chits, People (contacts), or Settings
- **Filter_Option**: A filter applied to an export: All (no filter), By Tag, or By Owner (admin only)
- **Tag_Picker**: A multi-select UI component that displays available tags for filtering exports
- **Owner_Picker**: A multi-select UI component (admin only) that displays all system users for filtering exports by data ownership
- **Admin_Tag_Tree**: A tag picker variant (admin only) that groups tags under user-name top-level nodes
- **Export_Envelope**: The top-level JSON structure of an export file, containing metadata (version, export date, instance ID, data type, filters applied) and the data payload
- **Import_Mode**: The user's choice when importing — either "Add" (merge with existing data) or "Replace" (overwrite existing data)
- **Backup_File**: A raw SQLite `.db` file representing the complete database state
- **Restore_Operation**: An admin-only action that replaces the entire database with an uploaded `.db` file
- **Backend_API**: The FastAPI backend serving REST endpoints under `/api/`
- **OR_Logic**: Filter combination semantics where selecting multiple values returns the union of all matching records

---

## Requirements

### Requirement 1: Per-User Data Management Section Layout

**User Story:** As a CWOC user, I want a reorganized Data Management section in my general Settings, so that I have clear export, import, and calendar import controls scoped to my own data.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a Data_Management_Section in the general settings area with the heading "📦 Data Management"
2. THE Data_Management_Section SHALL contain three controls: an "Export" button, an "Import" button, and the existing "📅 Import Calendar (.ics)" button
3. WHEN the Data_Management_Section is rendered, THE Settings_Page SHALL remove the existing flat export/import buttons (Export All, Import All, Export Chits, Import Chits, Export User Data, Import User Data) from the old Data Management layout
4. THE Data_Management_Section SHALL retain the existing Calendar Import (.ics) button and its functionality without modification
5. THE Data_Management_Section SHALL follow the existing parchment/1940s visual theme using styles from `shared-page.css`

---

### Requirement 2: Per-User Export Modal — Category Selection

**User Story:** As a CWOC user, I want to choose which data categories to export, so that I can export only the data I need.

#### Acceptance Criteria

1. WHEN the user clicks the "Export" button in the Data_Management_Section, THE Settings_Page SHALL open an Export_Modal
2. THE Export_Modal SHALL display a multi-select list of Data_Categories: Chits, People, and Settings, each with a checkbox
3. THE Export_Modal SHALL include a "Next" button that is enabled only when at least one Data_Category is selected
4. THE Export_Modal SHALL include a "Cancel" button that closes the modal without taking any action
5. THE Export_Modal SHALL be mobile-friendly, using full-width layout on small screens

---

### Requirement 3: Per-User Export Modal — Filter Selection

**User Story:** As a CWOC user, I want to filter my export by tag, so that I can export a targeted subset of my data.

#### Acceptance Criteria

1. WHEN the user clicks "Next" after selecting categories, THE Export_Modal SHALL display a filter selection screen with multi-select options: "All" and "By Tag"
2. WHEN the user selects "All", THE Export_Modal SHALL include all records for the selected categories without filtering
3. WHEN the user selects "By Tag", THE Export_Modal SHALL display a Tag_Picker showing the current user's tags as a multi-select list
4. WHEN multiple tags are selected in the Tag_Picker, THE Export_Modal SHALL apply OR_Logic, exporting records that match any of the selected tags
5. THE Export_Modal SHALL include a "Back" button to return to the category selection screen
6. THE Export_Modal SHALL include an "Export" button that triggers the export with the configured categories and filters
7. WHEN the "Settings" Data_Category is selected without "Chits" or "People", THE Export_Modal SHALL skip the filter selection screen and proceed directly to export, because settings are not tagged

---

### Requirement 4: Per-User Export Scoping

**User Story:** As a CWOC user, I want my exports to contain only my own data, so that I do not inadvertently export other users' data.

#### Acceptance Criteria

1. WHEN a per-user export is executed, THE Backend_API SHALL return only records owned by the authenticated user, regardless of whether the user has admin privileges
2. WHEN exporting Chits with a tag filter, THE Backend_API SHALL return only chits owned by the authenticated user that have at least one of the selected tags
3. WHEN exporting People with a tag filter, THE Backend_API SHALL return only contacts owned by the authenticated user that have at least one of the selected tags
4. WHEN exporting Settings, THE Backend_API SHALL return only the authenticated user's settings record

---

### Requirement 5: Per-User Import Modal — Category and Mode Selection

**User Story:** As a CWOC user, I want to import data by selecting a category and choosing add or replace mode, so that I have control over how imported data merges with my existing data.

#### Acceptance Criteria

1. WHEN the user clicks the "Import" button in the Data_Management_Section, THE Settings_Page SHALL open an Import_Modal
2. THE Import_Modal SHALL display a single-select list of Data_Categories: Chits, People, and Settings
3. WHEN the user selects a Data_Category, THE Import_Modal SHALL display a file picker accepting `.json` files
4. WHEN a valid export file is selected, THE Import_Modal SHALL display the existing Add/Replace mode dialog with "Add" and "Replace" options
5. WHEN the user selects "Replace" mode, THE Import_Modal SHALL display a confirmation dialog warning that existing data of the selected category will be permanently replaced
6. IF the selected file does not contain a valid Export_Envelope matching the selected Data_Category, THEN THE Import_Modal SHALL display an error message indicating the file type mismatch
7. WHEN the import completes, THE Import_Modal SHALL display a summary message indicating the number of records processed
8. THE Import_Modal SHALL be mobile-friendly, using full-width layout on small screens

---

### Requirement 6: Admin Data Management Section Layout

**User Story:** As an admin user, I want a dedicated Data Management section in the Administration area, so that I can manage data across all users and perform system-level backup/restore.

#### Acceptance Criteria

1. THE Settings_Page SHALL display an Admin_Data_Management_Section inside the existing `admin-section` div, visible only to admin users
2. THE Admin_Data_Management_Section SHALL have the heading "📦 Admin Data Management"
3. THE Admin_Data_Management_Section SHALL contain four controls: an "Export" button, an "Import" button, a "Backup" button, and a "Restore" button
4. WHILE the authenticated user is not an admin, THE Admin_Data_Management_Section SHALL remain hidden

---

### Requirement 7: Admin Export Modal — Category Selection

**User Story:** As an admin user, I want to choose which data categories to export across all users, so that I can create targeted cross-user exports.

#### Acceptance Criteria

1. WHEN the admin clicks the "Export" button in the Admin_Data_Management_Section, THE Settings_Page SHALL open an Export_Modal
2. THE Export_Modal SHALL display a multi-select list of Data_Categories: Chits, People, and Settings, each with a checkbox
3. THE Export_Modal SHALL include a "Next" button that is enabled only when at least one Data_Category is selected
4. THE Export_Modal SHALL include a "Cancel" button that closes the modal without taking any action

---

### Requirement 8: Admin Export Modal — Filter Selection

**User Story:** As an admin user, I want to filter exports by owner and/or tag across all users, so that I can export precisely the data I need.

#### Acceptance Criteria

1. WHEN the admin clicks "Next" after selecting categories, THE Export_Modal SHALL display a filter selection screen with multi-select options: "All", "By Owner", and "By Tag"
2. WHEN the admin selects "By Owner", THE Export_Modal SHALL display an Owner_Picker showing all system users as a multi-select list
3. WHEN multiple owners are selected, THE Export_Modal SHALL apply OR_Logic, exporting records owned by any of the selected users
4. WHEN the admin selects "By Tag", THE Export_Modal SHALL display an Admin_Tag_Tree showing tags grouped by user (user display name as the top-level node), with individual tags as multi-select checkboxes beneath each user
5. WHEN multiple tags are selected in the Admin_Tag_Tree, THE Export_Modal SHALL apply OR_Logic, exporting records that match any of the selected tags
6. WHEN both "By Owner" and "By Tag" are selected, THE Export_Modal SHALL combine the filters using OR_Logic, exporting records that match any selected owner OR any selected tag
7. WHEN the "Settings" Data_Category is selected, THE Export_Modal SHALL show only "All" and "By Owner" filter options for Settings (no tag filter), because settings are not tagged
8. THE Export_Modal SHALL include a "Back" button to return to the category selection screen
9. THE Export_Modal SHALL include an "Export" button that triggers the export with the configured categories and filters

---

### Requirement 9: Admin Export Scoping

**User Story:** As an admin user, I want admin exports to span all users' data based on my filter selections, so that I can create comprehensive cross-user backups.

#### Acceptance Criteria

1. WHEN an admin export is executed with the "All" filter, THE Backend_API SHALL return all records across all users for the selected categories
2. WHEN an admin export is executed with a "By Owner" filter, THE Backend_API SHALL return records owned by any of the selected users
3. WHEN an admin export is executed with a "By Tag" filter, THE Backend_API SHALL return records across all users that have at least one of the selected tags
4. WHEN an admin export is executed with both "By Owner" and "By Tag" filters, THE Backend_API SHALL return records that match any selected owner OR any selected tag (union)
5. WHEN exporting Settings with the "All" filter, THE Backend_API SHALL return settings records for all users plus any universal settings (instance name, kiosk options)
6. WHEN exporting Settings with the "By Owner" filter, THE Backend_API SHALL return settings records for the selected users only

---

### Requirement 10: Admin Import

**User Story:** As an admin user, I want to import data into the system from the admin section, so that I can restore or merge cross-user data.

#### Acceptance Criteria

1. WHEN the admin clicks the "Import" button in the Admin_Data_Management_Section, THE Settings_Page SHALL open an Import_Modal
2. THE Import_Modal SHALL display a single-select list of Data_Categories: Chits, People, and Settings
3. WHEN the admin selects a Data_Category and uploads a valid export file, THE Import_Modal SHALL display the Add/Replace mode dialog
4. WHEN the admin selects "Replace" mode, THE Import_Modal SHALL display a confirmation dialog warning that existing data of the selected category across all users will be permanently replaced
5. WHEN the admin import completes, THE Import_Modal SHALL display a summary message indicating the number of records processed
6. IF the uploaded file does not contain a valid Export_Envelope matching the selected Data_Category, THEN THE Import_Modal SHALL display an error message indicating the file type mismatch

---

### Requirement 11: Admin Backup — Raw Database Download

**User Story:** As an admin user, I want to download the raw SQLite database file, so that I have a complete system backup including all data, schema, and state.

#### Acceptance Criteria

1. THE Admin_Data_Management_Section SHALL display a "Backup" button
2. WHEN the admin clicks the "Backup" button, THE Backend_API SHALL return the raw SQLite `.db` file as a binary download
3. WHEN the backup download is triggered, THE Settings_Page SHALL save the file with the filename format `cwoc-backup-YYYY-MM-DD.db`
4. THE Backend_API SHALL verify that the requesting user has admin privileges before serving the backup file
5. IF a non-admin user attempts to access the backup endpoint, THEN THE Backend_API SHALL return HTTP 403 with the message "Admin access required"

---

### Requirement 12: Admin Restore — Full Database Replace

**User Story:** As an admin user, I want to upload a database backup file and restore the entire system to that state, so that I can recover from catastrophic failures or migrate between instances.

#### Acceptance Criteria

1. THE Admin_Data_Management_Section SHALL display a "Restore" button
2. WHEN the admin clicks the "Restore" button, THE Settings_Page SHALL open a file picker accepting `.db` files
3. WHEN a `.db` file is selected, THE Settings_Page SHALL display a confirmation dialog with a prominent warning: "This will completely replace ALL data in the system with the uploaded backup. This action cannot be undone. All current data will be permanently lost."
4. THE confirmation dialog SHALL require the admin to type "RESTORE" to confirm, preventing accidental execution
5. WHEN the admin confirms the restore, THE Backend_API SHALL replace the current database file with the uploaded `.db` file
6. WHEN the restore completes, THE Settings_Page SHALL display a success message and prompt the admin to reload the page
7. IF a non-admin user attempts to access the restore endpoint, THEN THE Backend_API SHALL return HTTP 403 with the message "Admin access required"
8. IF the uploaded file is not a valid SQLite database, THEN THE Backend_API SHALL return HTTP 400 with a descriptive error message and leave the current database unchanged

---

### Requirement 13: Backend Export API Endpoints

**User Story:** As a developer, I want dedicated API endpoints for the new granular export system, so that the frontend can request filtered exports cleanly.

#### Acceptance Criteria

1. THE Backend_API SHALL expose a `POST /api/export` endpoint that accepts a JSON body with fields: `categories` (array of "chits", "people", "settings"), `filters` (object with optional `tags` array and optional `owners` array), and `scope` ("user" or "admin")
2. WHEN `scope` is "user", THE Backend_API SHALL restrict results to the authenticated user's data only, ignoring any `owners` filter
3. WHEN `scope` is "admin", THE Backend_API SHALL verify admin privileges and return cross-user data based on the provided filters
4. IF a non-admin user sends a request with `scope` "admin", THEN THE Backend_API SHALL return HTTP 403
5. THE Backend_API SHALL return the export data wrapped in an Export_Envelope with fields: `type`, `version`, `exported_at`, `instance_id`, `categories`, `filters_applied`, and `data`
6. THE Backend_API SHALL deserialize all JSON-serialized fields (tags, checklist, people, child_chits, alerts, recurrence_rule, recurrence_exceptions, phones, emails, addresses) before including them in the response
7. THE Backend_API SHALL expose `GET /api/admin/backup` to serve the raw database file (admin only)
8. THE Backend_API SHALL expose `POST /api/admin/restore` to accept a `.db` file upload and replace the database (admin only)

---

### Requirement 14: Backend Import API Endpoints

**User Story:** As a developer, I want dedicated API endpoints for the new import system, so that the frontend can submit categorized imports with the chosen mode.

#### Acceptance Criteria

1. THE Backend_API SHALL expose a `POST /api/import` endpoint accepting a JSON body with fields: `category` (one of "chits", "people", "settings"), `mode` ("add" or "replace"), `scope` ("user" or "admin"), and `data` (the Export_Envelope)
2. WHEN `scope` is "user", THE Backend_API SHALL import data scoped to the authenticated user only
3. WHEN `scope` is "admin", THE Backend_API SHALL verify admin privileges and import data across users as contained in the export file
4. IF the `mode` field is not "add" or "replace", THEN THE Backend_API SHALL return HTTP 400 with an error message
5. IF the `data` field does not contain a valid Export_Envelope, THEN THE Backend_API SHALL return HTTP 400 with a descriptive error message
6. WHEN the import succeeds, THE Backend_API SHALL return a JSON response with a `summary` object containing counts of records processed
7. IF a non-admin user sends a request with `scope` "admin", THEN THE Backend_API SHALL return HTTP 403

---

### Requirement 15: Admin User List and Tag List Endpoints

**User Story:** As a developer, I want API endpoints that provide the list of users and per-user tags, so that the admin export modal can populate the owner picker and tag tree.

#### Acceptance Criteria

1. THE Backend_API SHALL expose a `GET /api/admin/users` endpoint that returns a list of all users with their `id`, `display_name`, and `username` (admin only)
2. THE Backend_API SHALL expose a `GET /api/admin/tags` endpoint that returns tags grouped by user, with each entry containing the user's `id`, `display_name`, and their `tags` array (admin only)
3. IF a non-admin user attempts to access either endpoint, THEN THE Backend_API SHALL return HTTP 403 with the message "Admin access required"

---

### Requirement 16: Export File Format and Portability

**User Story:** As a CWOC user, I want exported files to be self-contained and portable, so that I can import them into any CWOC instance.

#### Acceptance Criteria

1. THE Export_Envelope SHALL include fields: `type` (string identifying the export type), `version` (CWOC version that produced the export), `exported_at` (ISO 8601 timestamp), `instance_id` (the CWOC instance identifier), `categories` (array of included categories), `filters_applied` (object describing filters used), and `data` (object keyed by category name)
2. THE Export_File SHALL use UTF-8 encoding
3. THE Backend_API SHALL serialize the Export_File with human-readable JSON formatting (indented with 2 spaces)
4. FOR ALL valid Export_Files, exporting data and then importing it in Replace_Mode SHALL produce a dataset equivalent to the original exported data (round-trip property)

---

### Requirement 17: Remove Legacy Export/Import Buttons

**User Story:** As a CWOC user, I want the old flat export/import buttons removed, so that there is a single, consistent data management interface.

#### Acceptance Criteria

1. WHEN the Data_Management_Section is implemented, THE Settings_Page SHALL remove the existing "Export All" / "Import All", "Export" / "Import" (Chit Data), and "Export" / "Import" (User Data) buttons and their associated hidden file inputs
2. THE Settings_Page SHALL remove the `exportAllData`, `importAllData`, `exportChitData`, `importChitData`, `exportUserData`, and `importUserData` function calls from the HTML
3. THE legacy `GET /api/export/chits` and `GET /api/export/userdata` endpoints SHALL remain functional for backward compatibility but are no longer referenced by the UI

---

### Requirement 18: Help Documentation Update

**User Story:** As a CWOC user, I want the help page to document the new Data Management features, so that I can understand how to use the export, import, backup, and restore functionality.

#### Acceptance Criteria

1. WHEN the Data Management Overhaul is implemented, THE help page SHALL update the "Data Management" section to describe the new modal-driven export and import flows
2. THE help page SHALL document the per-user export flow: category selection, filter options (All, By Tag), and tag picker behavior
3. THE help page SHALL document the admin export flow: category selection, filter options (All, By Owner, By Tag), owner picker, and admin tag tree behavior
4. THE help page SHALL document the admin Backup and Restore features, including the warning about Restore being a full system wipe
5. THE help page SHALL document that export filters use OR logic when multiple values are selected
