# Requirements Document

## Introduction

The Contacts Rolodex adds a full-featured contact management system to CWOC. Users can create, edit, browse, import, export, and share contacts — each with structured fields (name parts, addresses, phones, emails, call signs, social handles, etc.). Contacts are stored as vCard (.vcf) files on disk and exposed through a dedicated "People" page that follows the existing CWOC parchment aesthetic. The People page is accessible from a new sidebar button placed directly above Settings. Each contact opens in its own editor page (similar to the chit editor) built on a shared editor framework that extracts common patterns (header row, zones, save logic, layout) into reusable `shared-editor.css` and `shared-editor.js` files used by both the Contact Editor and the Chit Editor. The feature also integrates with the existing chit editor People picker so users can select from their Rolodex, and contacts listed on a chit appear as compact chips in the quick-edit modal. Contacts support a "favorite" flag (like tags), and the dashboard sidebar gains a People filter panel (mirroring the existing Tag filter) so users can filter chits by associated person. Where existing tag-related code (tree view, favorites, search, sidebar filtering) can be generalized to work for both tags and people, it is extracted into shared filter/picker components.

## Glossary

- **Contact_Manager**: The backend service (FastAPI routes) responsible for CRUD operations on contacts, import/export, and search.
- **People_Page**: The frontend list/browse page (`people.html`) showing all contacts in a searchable, scrollable Rolodex view.
- **Contact_Editor**: The frontend editor page (`contact-editor.html`) for creating and editing a single contact, built on the Shared_Editor_Framework.
- **Contact**: A single person record containing name parts, communication fields, flags (including favorite), and metadata.
- **VCard_Serializer**: The component that converts Contact objects to and from vCard 3.0 (.vcf) format.
- **VCard_Printer**: The component that formats a Contact object back into a valid .vcf string.
- **CSV_Serializer**: The component that converts Contact objects to and from CSV format.
- **QR_Generator**: The component that encodes a contact's vCard data into a QR code image for sharing.
- **People_Picker**: The existing autocomplete/selection widget in the chit editor's People zone that allows associating people with a chit.
- **Quick_Editor**: The shift-click modal on the dashboard that shows a compact summary of a chit's fields.
- **Multi_Value_Field**: A contact field type that supports multiple entries, each with a user-defined label (e.g., "Work", "Home", "Mobile").
- **Prefix_Dropdown**: A select input prepopulated with common name prefixes (Mr., Mrs., Ms., Dr., etc.) that also allows custom values.
- **Suffix_Dropdown**: A select input prepopulated with common name suffixes (Jr., Sr., III, Esq., Ph.D., etc.) that also allows custom values.
- **Shared_Editor_Framework**: The shared CSS (`shared-editor.css`) and JS (`shared-editor.js`) files that extract common editor patterns (header row, zone containers, zone toggle, save button logic, layout grid) used by both the Chit Editor and Contact Editor.
- **People_Filter**: The dashboard sidebar filter panel for filtering chits by associated person, mirroring the existing Tag filter panel pattern (search, favorites, click-to-toggle).
- **Sidebar_Filter_Component**: A generalized filter/picker UI pattern extracted from the existing tag filter code, parameterized to work for both tags and people (search input, favorites-first sorting, click-to-toggle selection, numbered hotkeys).

## Requirements

### Requirement 1: Contact Data Model

**User Story:** As a user, I want each contact to store structured personal information with multiple communication channels and a favorite flag, so that I have a complete digital Rolodex entry for every person and can mark my most-used contacts for quick access.

#### Acceptance Criteria

1. THE Contact_Manager SHALL store each contact with the following name fields: given name, surname, middle names, prefix, and suffix.
2. THE Prefix_Dropdown SHALL be prepopulated with common values (Mr., Mrs., Ms., Dr., Prof., Rev., Hon.) and allow the user to type a custom value.
3. THE Suffix_Dropdown SHALL be prepopulated with common values (Jr., Sr., II, III, IV, Esq., Ph.D., M.D.) and allow the user to type a custom value.
4. THE Contact_Manager SHALL support multiple entries with user-defined labels for each of the following Multi_Value_Field types: address, phone, email, call sign, X handle (x@), and website/social.
5. THE Contact_Manager SHALL store a boolean flag indicating whether the contact has Signal.
6. THE Contact_Manager SHALL store a text field for the contact's PGP public key.
7. THE Contact_Manager SHALL assign a unique identifier to each contact upon creation.
8. THE Contact_Manager SHALL record created and modified timestamps on each contact.
9. THE Contact_Manager SHALL store a boolean `favorite` flag on each contact, defaulting to false.

### Requirement 2: Contact Storage

**User Story:** As a user, I want my contacts stored as individual .vcf files on disk, so that they are portable, human-readable, and easy to back up.

#### Acceptance Criteria

1. THE Contact_Manager SHALL store each contact as an individual .vcf file in a dedicated directory on the server (`/app/data/contacts/`).
2. THE Contact_Manager SHALL name each .vcf file using the contact's unique identifier (e.g., `{uuid}.vcf`).
3. THE Contact_Manager SHALL also maintain a SQLite `contacts` table as an index for fast search, list, and filter operations.
4. WHEN a contact is created or updated, THE Contact_Manager SHALL write the .vcf file to disk and update the SQLite index in a single operation.
5. WHEN a contact is deleted, THE Contact_Manager SHALL remove the .vcf file from disk and delete the corresponding SQLite index row.
6. THE SQLite `contacts` table SHALL include a `favorite` boolean column for fast filtering and sort-ordering of favorite contacts.

### Requirement 3: Contact CRUD API

**User Story:** As a developer, I want RESTful API endpoints for contact management, so that the frontend can create, read, update, delete, list, and search contacts.

#### Acceptance Criteria

1. THE Contact_Manager SHALL expose a `POST /api/contacts` endpoint that creates a new contact and returns the created contact with its assigned identifier.
2. THE Contact_Manager SHALL expose a `GET /api/contacts` endpoint that returns a list of all contacts with support for a `q` query parameter for text search across name and communication fields.
3. THE Contact_Manager SHALL expose a `GET /api/contacts/{id}` endpoint that returns a single contact by identifier.
4. THE Contact_Manager SHALL expose a `PUT /api/contacts/{id}` endpoint that updates an existing contact.
5. THE Contact_Manager SHALL expose a `DELETE /api/contacts/{id}` endpoint that permanently deletes a contact.
6. IF a request references a contact identifier that does not exist, THEN THE Contact_Manager SHALL return an HTTP 404 response with a descriptive error message.
7. IF a create or update request is missing the given name field, THEN THE Contact_Manager SHALL return an HTTP 422 response with a validation error message.
8. THE `GET /api/contacts` endpoint SHALL return contacts sorted with favorites first, then alphabetically by display name.
9. THE Contact_Manager SHALL expose a `PATCH /api/contacts/{id}/favorite` endpoint that toggles the favorite flag on a contact and returns the updated contact.

### Requirement 4: People Page (Rolodex Browse View)

**User Story:** As a user, I want a dedicated People page to browse, search, and manage all my contacts in one place, so that I can quickly find and access any person in my Rolodex.

#### Acceptance Criteria

1. THE People_Page SHALL be accessible from a new "People" sidebar button placed directly above the Settings button on the dashboard.
2. THE People_Page SHALL use the existing CWOC page template (`_template.html`), `shared-page.css`, and `shared-page.js` for consistent parchment styling and header/footer injection.
3. THE People_Page SHALL display contacts in a scrollable list showing each contact's full display name (prefix + given name + middle names + surname + suffix).
4. THE People_Page SHALL provide a search input that filters the contact list in real time as the user types, matching against name fields, email, phone, and call sign.
5. WHEN the user clicks a contact in the list, THE People_Page SHALL navigate to the Contact_Editor page for that contact.
6. THE People_Page SHALL provide a "New Contact" button that navigates to a blank Contact_Editor page.
7. THE People_Page SHALL provide a "Share" button on each contact row that triggers the QR_Generator to display a scannable QR code of that contact's vCard data.
8. THE People_Page SHALL display favorite contacts at the top of the list, each marked with a star indicator (★) consistent with the tag favorites pattern.
9. THE People_Page SHALL provide a clickable star toggle on each contact row to mark or unmark a contact as a favorite.

### Requirement 5: Contact Editor Page

**User Story:** As a user, I want to open each contact in its own full editor page (like the chit editor), so that I can view and edit all fields for a single person.

#### Acceptance Criteria

1. THE Contact_Editor SHALL open in its own page (`contact-editor.html`) following the same page-per-record pattern as the chit editor.
2. THE Contact_Editor SHALL load `shared-editor.css` and `shared-editor.js` from the Shared_Editor_Framework for its header row, zone containers, zone toggle behavior, save button logic, and layout grid.
3. THE Contact_Editor SHALL display editable fields for: prefix, given name, middle names, surname, suffix.
4. THE Contact_Editor SHALL display Multi_Value_Field editors for: address, phone, email, call sign, X handle, and website/social — each entry having a label input and a value input, with an "Add" button to append more entries.
5. THE Contact_Editor SHALL display a toggle for "Has Signal" and a text area for "PGP Public Key."
6. THE Contact_Editor SHALL use the CwocSaveSystem (Save & Stay / Save & Exit / Cancel) pattern from `shared-page.js`.
7. WHEN the user saves a contact, THE Contact_Editor SHALL send the data to the Contact_Manager API and display a success or error indication.
8. THE Contact_Editor SHALL provide a "Share Contact" button that triggers the QR_Generator for the current contact.
9. THE Contact_Editor SHALL provide a "Delete" button that, after confirmation, permanently deletes the contact and returns to the People_Page.
10. THE Contact_Editor SHALL provide a clickable star toggle in the header row to mark or unmark the contact as a favorite.

### Requirement 6: Contact Import

**User Story:** As a user, I want to import contacts from .vcf and .csv files, so that I can bring in contacts from other applications.

#### Acceptance Criteria

1. THE Contact_Manager SHALL expose a `POST /api/contacts/import` endpoint that accepts file uploads.
2. WHEN a .vcf file containing one or more vCard entries is uploaded, THE Contact_Manager SHALL parse each vCard and create a corresponding contact.
3. WHEN a .csv file is uploaded, THE Contact_Manager SHALL parse each row and create a corresponding contact, mapping columns by header name.
4. IF a .vcf file contains malformed vCard data, THEN THE Contact_Manager SHALL skip the malformed entry, continue processing remaining entries, and return a summary indicating how many contacts were imported and how many were skipped with reasons.
5. IF a .csv file contains rows with missing required fields (given name), THEN THE Contact_Manager SHALL skip those rows and include them in the error summary.
6. THE People_Page SHALL provide an "Import" button that opens a file picker accepting `.vcf` and `.csv` files and uploads the selected file to the import endpoint.

### Requirement 7: Contact Export

**User Story:** As a user, I want to export my contacts to .vcf and .csv formats, so that I can back them up or transfer them to other applications.

#### Acceptance Criteria

1. THE Contact_Manager SHALL expose a `GET /api/contacts/export?format=vcf` endpoint that returns all contacts as a single multi-entry .vcf file download.
2. THE Contact_Manager SHALL expose a `GET /api/contacts/export?format=csv` endpoint that returns all contacts as a .csv file download with a header row.
3. THE Contact_Manager SHALL expose a `GET /api/contacts/{id}/export?format=vcf` endpoint that returns a single contact as a .vcf file download.
4. THE People_Page SHALL provide an "Export" button with options to export all contacts as .vcf or .csv.

### Requirement 8: vCard Serialization Round-Trip

**User Story:** As a developer, I want vCard serialization and deserialization to be lossless, so that importing and exporting contacts preserves all data.

#### Acceptance Criteria

1. THE VCard_Serializer SHALL parse vCard 3.0 formatted strings into Contact objects, mapping standard vCard properties (N, FN, TEL, EMAIL, ADR, URL, NOTE, X-* extensions) to the corresponding Contact fields.
2. THE VCard_Printer SHALL format Contact objects into valid vCard 3.0 strings.
3. FOR ALL valid Contact objects, parsing the output of VCard_Printer and then printing again SHALL produce an equivalent vCard string (round-trip property).
4. THE VCard_Serializer SHALL map the "Has Signal" flag and PGP public key to vCard X-properties (X-SIGNAL and X-PGP-KEY).
5. THE VCard_Serializer SHALL preserve Multi_Value_Field labels as vCard TYPE parameters.

### Requirement 9: QR Code Sharing

**User Story:** As a user, I want to generate a QR code for any contact, so that I can quickly share contact information by letting someone scan it with their phone.

#### Acceptance Criteria

1. WHEN the user clicks the "Share" button for a contact, THE QR_Generator SHALL encode the contact's vCard data into a QR code and display it in a modal overlay.
2. THE QR_Generator SHALL use a client-side JavaScript QR code library loaded via CDN (no npm dependencies).
3. THE QR_Generator SHALL size the QR code to fit within the modal while remaining scannable.
4. IF the contact's vCard data exceeds the QR code capacity, THEN THE QR_Generator SHALL display a message indicating the contact has too much data for a single QR code and suggest exporting as a file instead.

### Requirement 10: People Picker Integration

**User Story:** As a user, I want the chit editor's People picker to suggest contacts from my Rolodex, so that I can quickly associate known people with chits without retyping names.

#### Acceptance Criteria

1. WHEN the user types in the chit editor's People field, THE People_Picker SHALL query the Contact_Manager search endpoint and display matching contacts as autocomplete suggestions.
2. WHEN the user selects a contact from the autocomplete suggestions, THE People_Picker SHALL insert the contact's display name into the People field.
3. THE People_Picker SHALL continue to allow free-text entry of names that are not in the Rolodex.
4. THE People_Picker SHALL debounce search requests to avoid excessive API calls (minimum 250ms between requests).
5. THE People_Picker autocomplete dropdown SHALL display favorite contacts first (marked with ★), followed by non-favorites, both sorted alphabetically.

### Requirement 11: Quick Editor Contact Display

**User Story:** As a user, I want to see the people associated with a chit displayed as compact chips in the quick-edit modal, so that I can see at a glance who is involved.

#### Acceptance Criteria

1. WHEN a chit has associated people, THE Quick_Editor SHALL display each person's name as a compact chip element in the modal.
2. WHILE the number of people chips exceeds the available horizontal space in a single row, THE Quick_Editor SHALL truncate the visible chips and display a "+N more" indicator.
3. WHEN the user hovers over the "+N more" indicator, THE Quick_Editor SHALL display a tooltip showing the full list of all associated people names.

### Requirement 12: Dashboard Navigation

**User Story:** As a user, I want to access the People page from the dashboard sidebar, so that it is always one click away alongside Settings.

#### Acceptance Criteria

1. THE dashboard sidebar SHALL display a "People" button directly above the existing Settings button in the `section-settings` area.
2. THE "People" button SHALL use an icon consistent with the CWOC aesthetic (e.g., a people/contacts icon from the static assets or Font Awesome).
3. WHEN the user clicks the "People" button, THE dashboard SHALL navigate to the People_Page (`/frontend/people.html`).
4. THE People_Page header navigation SHALL include buttons to return to Chits and to access Settings, consistent with other secondary pages.

### Requirement 13: Shared Editor Framework

**User Story:** As a developer, I want common editor patterns (header row, zone containers, zone toggle, save buttons, layout grid) extracted into shared `shared-editor.css` and `shared-editor.js` files, so that the Contact Editor and Chit Editor share a single source of truth for editor UI and behavior, reducing duplication and ensuring visual consistency.

#### Acceptance Criteria

1. THE Shared_Editor_Framework SHALL provide a `shared-editor.css` file containing styles for: the header row (logo, title, left/right button groups), the zone container pattern (zone-header, zone-body, zone-toggle-icon), the main zones grid layout (two-column grid with responsive breakpoints), and common form field styling within zones.
2. THE Shared_Editor_Framework SHALL provide a `shared-editor.js` file containing JavaScript for: zone toggle behavior (expand/collapse zones by clicking zone headers), the save button state management pattern (saved/unsaved toggle between single Save button and Save & Stay / Save & Exit pair), and the cancel-or-exit logic with unsaved-changes confirmation.
3. THE Chit Editor (`editor.html`) SHALL load `shared-editor.css` and `shared-editor.js` and remove the equivalent duplicated styles and logic from `editor.css` and `editor.js`.
4. THE Contact_Editor (`contact-editor.html`) SHALL load `shared-editor.css` and `shared-editor.js` for its editor layout, zone behavior, and save button management.
5. THE Shared_Editor_Framework SHALL be loaded via `<link>` and `<script>` tags in HTML (no ES modules), consistent with the existing CWOC frontend architecture.
6. THE Shared_Editor_Framework SHALL not break any existing Chit Editor functionality — the refactor SHALL be purely structural, extracting existing patterns without changing behavior.
7. THE `shared-editor.css` header-row styles SHALL support a configurable logo image, title text, and both left-side action buttons (save/cancel) and right-side action buttons (QR, archive, delete, or editor-specific actions).
8. THE `shared-editor.js` zone toggle function SHALL accept zone section and content element IDs as parameters, making it reusable across any editor page with zone containers.

### Requirement 14: Dashboard People Filter

**User Story:** As a user, I want to filter chits on the dashboard by associated person (from the People field), so that I can quickly see all chits related to a specific person — just like I can filter by tag.

#### Acceptance Criteria

1. THE dashboard sidebar SHALL display a "People" filter group in the filters section, positioned after the existing "Label" (tag) filter group.
2. THE People_Filter panel SHALL display a search input that filters the people list in real time as the user types, matching against contact display names.
3. THE People_Filter panel SHALL list contacts sorted with favorites first (marked with ★), then alphabetically — mirroring the tag filter panel's favorites-first sorting.
4. WHEN the user clicks a person in the People_Filter panel, THE dashboard SHALL toggle that person's selection and re-filter the displayed chits to show only chits whose People field contains at least one selected person.
5. THE People_Filter panel SHALL support numbered hotkey selection (1–9) for the visible list items, consistent with the tag filter panel behavior.
6. THE People_Filter panel SHALL visually indicate selected people with bold text and an outline, consistent with the tag filter panel's selected-tag styling.
7. WHEN the user clicks "Clear Filters" on the dashboard, THE People_Filter SHALL clear all selected people along with other active filters.
8. THE People_Filter SHALL query the `GET /api/contacts` endpoint to populate its list, using the `q` parameter when the user types in the search input.

### Requirement 15: Contact Favorites

**User Story:** As a user, I want to mark contacts as favorites so that my most-used people appear at the top of people lists, pickers, and filter panels — just like tag favorites.

#### Acceptance Criteria

1. WHEN the user clicks the star toggle on a contact (in the People_Page, Contact_Editor, or People_Picker), THE Contact_Manager SHALL update the contact's favorite flag via the `PATCH /api/contacts/{id}/favorite` endpoint.
2. THE People_Page SHALL display favorite contacts at the top of the contact list, each with a filled star (★) indicator, and non-favorites below with an empty star (☆).
3. THE People_Picker autocomplete dropdown in the chit editor SHALL display favorite contacts before non-favorites in the suggestion list.
4. THE People_Filter panel on the dashboard sidebar SHALL display favorite contacts before non-favorites, each marked with a star indicator.
5. THE Contact_Editor header row SHALL display a clickable star that reflects and toggles the current contact's favorite state, visually matching the chit editor's pinned-button pattern.

### Requirement 16: Generalized Sidebar Filter Component

**User Story:** As a developer, I want the sidebar filter/picker pattern (search input, favorites-first sorting, click-to-toggle, numbered hotkeys, selected-state styling) extracted into a reusable component, so that the Tag filter and People filter share the same code and any future filter types can reuse it.

#### Acceptance Criteria

1. THE Sidebar_Filter_Component SHALL be implemented as a parameterized JavaScript function (or class) in `main.js` (or a shared file loaded by the dashboard) that accepts configuration for: the container element ID, the data source (array of items with `name`, `favorite`, and optional `color` properties), the current selection array, and a callback invoked when selection changes.
2. THE Sidebar_Filter_Component SHALL render a search input that filters the item list in real time.
3. THE Sidebar_Filter_Component SHALL sort items with favorites first (marked with ★), then alphabetically.
4. THE Sidebar_Filter_Component SHALL support click-to-toggle selection with visual feedback (bold text, outline on selected items).
5. THE Sidebar_Filter_Component SHALL support numbered hotkey selection (1–9) for visible items.
6. THE Sidebar_Filter_Component SHALL cap the visible list at 9 items (matching the current tag filter panel behavior) and filter via the search input to access more.
7. THE existing tag filter panel (`_buildTagFilterPanel`) SHALL be refactored to use the Sidebar_Filter_Component, preserving all current tag filter behavior (color badges, star indicators, hotkey support).
8. THE People_Filter panel SHALL use the Sidebar_Filter_Component with contact data, using a neutral background color for people items (since contacts do not have individual colors like tags).
