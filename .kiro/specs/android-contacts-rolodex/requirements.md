# Requirements Document

## Introduction

The Android Contacts Rolodex implements the complete contacts management feature from the CWOC web app as a native Android experience using Jetpack Compose, Room database, Retrofit, and Hilt DI. The feature encompasses three primary screens — People Page (rolodex list with grouped/ungrouped views, search, import/export), Contact Editor (full CRUD with image management, multi-value fields, color theming, vault toggle, QR sharing), and Contact Trash (soft-deleted contact management with restore/purge). The Android app already has a Room database with a contacts table that syncs from the server and basic navigation infrastructure, but the current contact list display is broken (showing raw JSON, colors instead of proper data, no images). This spec covers rebuilding the entire contacts UI from scratch to achieve full parity with the web version, adapted for Android conventions (single-column phone layout, responsive tablet layout, native file pickers, camera integration, Android share intents).

## Glossary

- **People_Page**: The Jetpack Compose screen displaying the contact rolodex list with toolbar, search, grouped/ungrouped views, and contact rows.
- **Contact_Editor**: The Jetpack Compose screen for creating and editing a single contact with all field zones, image management, save system, and actions.
- **Contact_Trash_Page**: The Jetpack Compose screen listing soft-deleted contacts with restore and permanent delete capabilities.
- **Contact_Repository**: The data layer (Room DAO + Retrofit API client) responsible for contact CRUD, sync, image upload, and search operations.
- **Contact_Entity**: The Room database entity representing a contact with all fields from the data model.
- **Contact_ViewModel**: The ViewModel managing UI state, dirty tracking, save operations, and business logic for the Contact Editor.
- **People_ViewModel**: The ViewModel managing the contact list state, search, grouping, and section collapse for the People Page.
- **Trash_ViewModel**: The ViewModel managing the trash list state, selection, bulk operations, and individual restore/purge actions.
- **Contact_API_Service**: The Retrofit interface defining all contact-related API endpoints against the server at 192.168.1.111:3333.
- **QR_Generator**: The component that generates vCard 3.0 data and renders it as a QR code in a dialog.
- **VCard_Builder**: The component that constructs vCard 3.0 strings client-side from contact data for QR sharing and single-contact export.
- **Import_Handler**: The component that handles file selection (.vcf/.csv), upload to the server API, and result display.
- **Export_Handler**: The component that triggers file downloads from the server export endpoints.
- **Image_Manager**: The component handling profile image capture (camera), gallery selection, local staging, resize, and upload on save.
- **Multi_Value_Field**: A contact field type supporting multiple entries each with a label and value (phones, emails, addresses, dates, X handles, websites, call signs).
- **Color_Palette**: The 20-color preset grid plus hex input for assigning a display color to a contact.
- **Vault_System**: The mechanism for toggling contacts between Private (owner-only) and Vault (shared to all users) visibility.
- **Section_Group**: A collapsible section in grouped mode (Favorites, Users, All Contacts, Contact Vault).
- **Auto_Contrast**: The algorithm that adjusts text color (light/dark) based on the contact's background color for readability.
- **Dirty_Tracker**: The state management component that detects unsaved changes and controls save button visibility and back-navigation warnings.
- **DataStore_Preferences**: Android DataStore used for persisting local UI preferences (group/ungroup toggle, section collapse states, user favorites).

## Requirements

### Requirement 1: Contact Data Model and Room Entity

**User Story:** As a developer, I want the Room Contact entity to store all fields from the web data model with correct types and JSON serialization for multi-value fields, so that the Android app has complete data parity with the server.

#### Acceptance Criteria

1. THE Contact_Entity SHALL store the following scalar fields: id (String/UUID, primary key), given_name (String, required), surname (String, nullable), middle_names (String, nullable), prefix (String, nullable), suffix (String, nullable), nickname (String, nullable), display_name (String, computed).
2. THE Contact_Entity SHALL store the following multi-value fields as JSON-serialized strings: phones (array of label+value objects), emails (array of label+value objects), addresses (array of label+value objects), call_signs (array of label+value objects), x_handles (array of label+value objects), websites (array of label+value objects), dates (array of label+value+show_on_calendar objects).
3. THE Contact_Entity SHALL store the following flag and metadata fields: has_signal (Boolean), signal_username (String, nullable), pgp_key (String, nullable), favorite (Boolean, default false), color (String, nullable hex code), organization (String, nullable), social_context (String, nullable), image_url (String, nullable), notes (String, nullable), tags (JSON-serialized string array), shared_to_vault (Boolean, default false).
4. THE Contact_Entity SHALL store the following system fields: created_datetime (String, ISO format), modified_datetime (String, ISO format), owner_id (String/UUID), deleted (Boolean, default false), deleted_datetime (String, nullable ISO format), sync_version (Integer).
5. THE Contact_Repository SHALL provide Room TypeConverters for serializing and deserializing multi-value field JSON arrays to and from Kotlin data classes.

### Requirement 2: People Page Toolbar

**User Story:** As a user, I want a toolbar at the top of the People page with buttons for creating contacts, importing, exporting, toggling grouped view, accessing trash, and searching, so that all contact management actions are accessible from one place.

#### Acceptance Criteria

1. THE People_Page toolbar SHALL display a "New Contact" button that navigates to the Contact_Editor in create mode (no contact ID parameter).
2. THE People_Page toolbar SHALL display an "Import" button that opens the Android file picker accepting .vcf and .csv file types.
3. THE People_Page toolbar SHALL display an "Export" button that shows a dropdown menu with two options: "Export as .vcf (vCard)" and "Export as .csv".
4. THE People_Page toolbar SHALL display a "Group/Ungroup" toggle button that switches between grouped section view and flat alphabetical list view.
5. THE People_Page toolbar SHALL display a "Trash" button that navigates to the Contact_Trash_Page.
6. THE People_Page toolbar SHALL display a search input field with placeholder text "Search contacts..." that filters the contact list.

### Requirement 3: Contact Search

**User Story:** As a user, I want to search across all contact fields with instant client-side filtering and server fallback, so that I can find any contact regardless of which field contains the search term.

#### Acceptance Criteria

1. WHEN the user types in the search input, THE People_Page SHALL immediately filter the displayed contacts client-side on every keystroke.
2. THE People_Page client-side search SHALL match against: display_name, nickname, organization, social_context, email values and labels, phone values and labels, address values, call_sign values, x_handle values, website values, and date labels and values.
3. WHEN the search query is 2 or more characters and 300ms have elapsed since the last keystroke, THE People_Page SHALL also query the server API endpoint `GET /api/contacts?q={query}` as a fallback for contacts not yet synced locally.
4. WHEN the search query is cleared (empty string), THE People_Page SHALL reload the full contact list from the local Room database.
5. WHEN no contacts match the search query, THE People_Page SHALL display the empty state message "No contacts match your search."

### Requirement 4: Grouped Contact List Mode

**User Story:** As a user, I want my contacts organized into collapsible sections (Favorites, Users, All Contacts, Contact Vault) by default, so that I can quickly navigate to the category I need.

#### Acceptance Criteria

1. WHILE grouped mode is active (default), THE People_Page SHALL divide the contact list into four sections in this order: "★ Favorites", "Users", "All Contacts", "🏛️ Contact Vault".
2. THE "★ Favorites" section SHALL contain contacts with favorite=true plus users marked as favorites in local DataStore preferences.
3. THE "Users" section SHALL contain app users fetched from the switchable-users API endpoint that are not marked as local favorites.
4. THE "All Contacts" section SHALL contain non-favorite, non-vault contacts owned by the current user.
5. THE "🏛️ Contact Vault" section SHALL contain contacts with shared_to_vault=true from other users.
6. EACH section header SHALL display the section label, the count of items in parentheses, and a chevron icon indicating expand/collapse state.
7. WHEN the user taps a section header, THE People_Page SHALL toggle that section between collapsed and expanded states.
8. THE People_Page SHALL persist section collapse states locally using DataStore_Preferences so they survive app restarts.

### Requirement 5: Ungrouped Contact List Mode

**User Story:** As a user, I want an option to view all contacts and users in a single flat alphabetical list without section grouping, so that I can browse everyone in one continuous scroll.

#### Acceptance Criteria

1. WHILE ungrouped mode is active, THE People_Page SHALL display all contacts and users merged into a single flat list sorted alphabetically by display name (case-insensitive).
2. THE People_Page SHALL persist the group/ungroup toggle state locally using DataStore_Preferences so it survives app restarts.
3. WHEN the user taps the Group/Ungroup toggle button, THE People_Page SHALL immediately switch between grouped and ungrouped display modes.

### Requirement 6: Contact Row Display

**User Story:** As a user, I want each contact row to show a star toggle, thumbnail image, name, detail line, vault icon, and QR share button with proper color theming, so that I can see key information at a glance and take quick actions.

#### Acceptance Criteria

1. EACH contact row SHALL display a star toggle (★ filled for favorites, ☆ empty for non-favorites) as the leftmost element.
2. WHEN the user taps the star toggle on a contact row, THE People_Page SHALL toggle the contact's favorite status via the API endpoint `PATCH /api/contacts/{id}/favorite` and update the UI immediately.
3. EACH contact row SHALL display a circular thumbnail (32×32dp): if image_url exists, display the loaded image with object-fit cover and a 1dp solid brown border; if no image, display a placeholder circle with a person icon, dashed border, and parchment background.
4. EACH contact row SHALL display the contact's display_name (or given_name, or "(unnamed)" as fallback) with bold text weight if the contact is a favorite.
5. EACH contact row SHALL display a detail line below the name showing the first email value, first phone value, and organization joined with " · " separators, at 0.8x the base font size with reduced opacity.
6. EACH contact row SHALL display a vault icon (🏛️) if the contact has shared_to_vault=true or is a vault contact from another user.
7. EACH contact row SHALL display a QR share button (QR code icon) that triggers the QR_Generator dialog for that contact.
8. WHEN a contact has a color field set, THE People_Page SHALL apply that color as the row background tint with Auto_Contrast text color adjustment and a 3dp left border in the solid contact color.

### Requirement 7: Contact Row Navigation

**User Story:** As a user, I want to tap a contact row to open its editor, so that I can view and edit the full contact details.

#### Acceptance Criteria

1. WHEN the user taps a contact row, THE People_Page SHALL navigate to the Contact_Editor screen with the contact's ID as a parameter.
2. WHEN the user long-presses a contact row, THE People_Page SHALL provide an option to open the contact in a new context (equivalent to web's Cmd+Click new-tab behavior — implementation as Android-appropriate action such as a context menu or bottom sheet).

### Requirement 8: User Row Display

**User Story:** As a user, I want app users displayed in the Users section with their profile image, name, @username, and a local favorite toggle, so that I can distinguish users from contacts and favorite them independently.

#### Acceptance Criteria

1. EACH user row SHALL display a circular thumbnail using the user's profile_image_url or a placeholder with a users icon if no image exists.
2. EACH user row SHALL display the user's name as the primary text and @username as the detail line.
3. EACH user row SHALL display a star toggle that persists the favorite state locally in DataStore_Preferences (key pattern: user_fav_{user_id}).
4. WHEN the user taps a user row, THE People_Page SHALL navigate to the Contact_Editor in profile view mode with the user_id parameter.

### Requirement 9: Empty States

**User Story:** As a user, I want clear empty state messages when there are no contacts or no search results, so that I understand why the list is empty and what action to take.

#### Acceptance Criteria

1. WHEN the contact list is empty and no search query is active, THE People_Page SHALL display the message "No contacts yet. Click 'New Contact' to add one."
2. WHEN a search query is active and no contacts match, THE People_Page SHALL display the message "No contacts match your search."

### Requirement 10: Contact Import Flow

**User Story:** As a user, I want to import contacts from .vcf and .csv files using the Android file picker, see a progress indicator during upload, and receive a result summary showing imported/skipped/error counts, so that I can bring in contacts from other sources.

#### Acceptance Criteria

1. WHEN the user taps the "Import" button, THE People_Page SHALL open the Android system file picker filtered to accept .vcf and .csv file types.
2. WHEN a file is selected, THE Import_Handler SHALL upload the file to `POST /api/contacts/import` as multipart form data.
3. WHILE the import is in progress, THE People_Page SHALL display a loading indicator on the Import button with text "Importing...".
4. WHEN the import completes successfully, THE People_Page SHALL display an Import Result dialog showing: a title "Import Results", a count of successfully imported contacts (green badge), a count of skipped contacts (yellow badge), and a scrollable list of errors (if any) showing entry number and reason.
5. WHEN the Import Result dialog is dismissed, THE People_Page SHALL refresh the contact list from the local database (which will have synced the new contacts).
6. IF the import API returns an error response, THEN THE People_Page SHALL display an error message to the user.

### Requirement 11: Contact Export Flow

**User Story:** As a user, I want to export all my contacts as a .vcf or .csv file that downloads to my device, so that I can back up or transfer my contacts.

#### Acceptance Criteria

1. WHEN the user taps the "Export" button, THE People_Page SHALL display a dropdown menu with two options: "Export as .vcf (vCard)" and "Export as .csv".
2. WHEN the user selects "Export as .vcf", THE Export_Handler SHALL trigger a file download from `GET /api/contacts/export?format=vcf` and save it to the device's Downloads folder or prompt the user to choose a save location.
3. WHEN the user selects "Export as .csv", THE Export_Handler SHALL trigger a file download from `GET /api/contacts/export?format=csv` and save it to the device's Downloads folder or prompt the user to choose a save location.
4. THE export dropdown SHALL close when an option is selected, when the user taps elsewhere, or when the back button is pressed.

### Requirement 12: Contact Editor Layout and Responsiveness

**User Story:** As a user, I want the contact editor to use a responsive layout — 3 columns on tablet, single scrollable column on phone — so that I can efficiently edit contacts on any device size.

#### Acceptance Criteria

1. THE Contact_Editor SHALL display a single scrollable column layout on phone-sized screens (width < 600dp).
2. THE Contact_Editor SHALL display a multi-column layout on tablet-sized screens (width ≥ 600dp), distributing field zones across columns for efficient use of space.
3. THE Contact_Editor SHALL organize fields into collapsible zones: Name, Phone & Email, Social & Web, Security, Context, Color, Notes, Tags.
4. EACH zone SHALL have a tappable header that toggles the zone between expanded and collapsed states.

### Requirement 13: Contact Editor Profile Image

**User Story:** As a user, I want to set a contact's profile image by uploading from gallery or capturing with camera, preview it as a circular thumbnail, view it full-size, and remove it, so that I can visually identify contacts.

#### Acceptance Criteria

1. THE Contact_Editor SHALL display a circular profile image area (80dp diameter) showing the contact's current image or a placeholder icon if no image exists.
2. WHEN the user taps the profile image area, THE Contact_Editor SHALL open the device gallery picker for selecting an image (JPEG, PNG, GIF, WebP).
3. THE Contact_Editor SHALL provide a "Camera" button that opens the device camera for capturing a new photo.
4. WHEN the camera is opened, THE Image_Manager SHALL support switching between front and back cameras.
5. WHEN an image is selected or captured, THE Image_Manager SHALL resize non-GIF images to a maximum of 512px on the longest side while preserving GIF files as-is to maintain animation.
6. THE Image_Manager SHALL stage the selected/captured image locally (display preview) without uploading until the contact is saved.
7. THE Contact_Editor SHALL provide a "View" button (visible only when an image exists) that opens the image in a full-screen overlay dialog dismissible by tapping anywhere.
8. THE Contact_Editor SHALL provide a "Remove" button (visible only when an image exists) that removes the current image (staged for deletion on save).
9. WHEN the contact is saved and a pending image exists, THE Contact_Repository SHALL upload the image via `POST /api/contacts/{id}/image` as multipart form data.
10. WHEN the contact is saved and image removal is pending, THE Contact_Repository SHALL call `DELETE /api/contacts/{id}/image`.

### Requirement 14: Contact Editor Display Name Header

**User Story:** As a user, I want to see the computed display name update live as I type name fields, so that I can immediately see how the full name will appear.

#### Acceptance Criteria

1. THE Contact_Editor SHALL display a computed display name header that concatenates non-empty values of: prefix, given_name, middle_names, surname, suffix, separated by spaces.
2. WHEN any name field value changes, THE Contact_Editor SHALL immediately recompute and update the display name header without requiring a save.

### Requirement 15: Contact Editor Vault Toggle

**User Story:** As a user, I want a Private/Vault toggle pill on the contact editor so I can control whether a contact is visible only to me or shared to all users in the vault.

#### Acceptance Criteria

1. THE Contact_Editor SHALL display a two-value pill toggle with options "🔒 Private" and "🏛️ Vault" reflecting the contact's shared_to_vault state.
2. WHEN the user taps the vault toggle pill, THE Contact_Editor SHALL switch between Private and Vault states and mark the form as dirty.
3. WHEN creating a new contact, THE Contact_Editor SHALL check the user setting `default_share_contacts`; if the setting value is "1", the vault toggle SHALL default to "Vault", otherwise to "Private".

### Requirement 16: Contact Editor Name Zone

**User Story:** As a user, I want to edit all name parts (prefix, given, middle, surname, suffix, nickname) with dropdown+custom options for prefix and suffix, so that I can capture complete formal names.

#### Acceptance Criteria

1. THE Contact_Editor name zone SHALL provide a prefix field implemented as a dropdown with options: None, Mr., Mrs., Ms., Miss, Dr., Prof., Rev., Hon., and "Custom..." which reveals a free-text input for arbitrary prefix values.
2. THE Contact_Editor name zone SHALL provide a given name field (required) with a visual required indicator (red asterisk on label).
3. THE Contact_Editor name zone SHALL provide a middle names text field.
4. THE Contact_Editor name zone SHALL provide a surname text field.
5. THE Contact_Editor name zone SHALL provide a suffix field implemented as a dropdown with options: None, Jr., Sr., Esq., Ph.D., M.D., I, II, III, IV, V, VI, VII, VIII, IX, X, and "Custom..." which reveals a free-text input for arbitrary suffix values.
6. THE Contact_Editor name zone SHALL provide a nickname text field.

### Requirement 17: Contact Editor Phone and Email Zone

**User Story:** As a user, I want to add multiple phone numbers, email addresses, physical addresses, and dates each with a custom label, so that I can store all communication channels for a contact.

#### Acceptance Criteria

1. THE Contact_Editor phone section SHALL display dynamic multi-value rows, each containing a label input (default "Mobile", 80dp wide), a value input (placeholder "+1-555-0100", flex width), and a remove button.
2. THE Contact_Editor phone section SHALL provide an "Add Phone" button that appends a new empty phone row.
3. THE Contact_Editor email section SHALL display dynamic multi-value rows, each containing a label input (default "Home"), a value input (placeholder "user@example.com"), and a remove button.
4. THE Contact_Editor email section SHALL provide an "Add Email" button that appends a new empty email row.
5. THE Contact_Editor address section SHALL display dynamic multi-value rows, each containing a label input (default "Home"), a value input (placeholder "4 Rolling Mill Way, Canton, MA 02021"), a remove button, a map button, and a "view in context" button.
6. WHEN the user taps the map button on an address row, THE Contact_Editor SHALL open the address in the device's default maps application (Google Maps or equivalent).
7. WHEN the user taps the "view in context" button on an address row, THE Contact_Editor SHALL navigate to the CWOC maps page focused on that address.
8. THE Contact_Editor address section SHALL provide an "Add Address" button that appends a new empty address row.
9. THE Contact_Editor dates section SHALL display dynamic multi-value rows, each containing a label input (default "Date"), a value input with a date picker (format YYYY-Mon-DD), a calendar toggle checkbox (📅 icon controlling show_on_calendar), and a remove button.
10. THE Contact_Editor dates section SHALL provide an "Add Date" button that appends a new empty date row.
11. THE date picker SHALL allow both manual text entry and picker selection, storing dates as ISO format (YYYY-MM-DD) and displaying as YYYY-Mon-DD.

### Requirement 18: Contact Editor Social and Web Zone

**User Story:** As a user, I want to add multiple X handles, websites, and call signs each with labels, and have website URLs be clickable, so that I can store all social and web presence information.

#### Acceptance Criteria

1. THE Contact_Editor X handle section SHALL display dynamic multi-value rows, each containing a label input (default "X"), a value input (placeholder "@username"), and a remove button.
2. THE Contact_Editor X handle section SHALL provide an "Add X Handle" button that appends a new empty row.
3. THE Contact_Editor website section SHALL display dynamic multi-value rows, each containing a label input (default "Website"), a value input (placeholder "https://example.com"), a clickable external link icon, and a remove button.
4. WHEN a website value field contains a URL and loses focus, THE Contact_Editor SHALL display a clickable link icon that opens the URL in the device browser.
5. THE Contact_Editor website section SHALL provide an "Add Website" button that appends a new empty row.
6. THE Contact_Editor call sign section SHALL display dynamic multi-value rows, each containing a label input (default "Ham"), a value input (placeholder "KD2ABC"), and a remove button.
7. THE Contact_Editor call sign section SHALL provide an "Add Call Sign" button that appends a new empty row.

### Requirement 19: Contact Editor Security Zone

**User Story:** As a user, I want to record whether a contact uses Signal (with their username and a message button), and store their PGP public key with validation, so that I can manage secure communication channels.

#### Acceptance Criteria

1. THE Contact_Editor security zone SHALL provide a "Has Signal" toggle switch.
2. WHEN the Signal toggle is ON, THE Contact_Editor SHALL reveal a "Signal username or phone" text input field and a "Signal" message button.
3. WHEN the user taps the Signal message button, THE Contact_Editor SHALL generate and open a signal.me deep link: for phone numbers using `#p/+{number}` format, for usernames using `#u/{username}` format.
4. THE Contact_Editor security zone SHALL provide a "PGP Public Key" multi-line text area.
5. THE Contact_Editor security zone SHALL provide a "Validate Key" button next to the PGP field.
6. WHEN the user taps "Validate Key" and the PGP field contains content, THE Contact_Editor SHALL validate the key and display either "✅ Valid" with user ID and algorithm information, or "❌ Invalid" with the error message.

### Requirement 20: Contact Editor Context Zone

**User Story:** As a user, I want to record a contact's organization and how I know them (social context), so that I can remember professional and personal connections.

#### Acceptance Criteria

1. THE Contact_Editor context zone SHALL provide an "Organization" text input with placeholder "Company / org".
2. THE Contact_Editor context zone SHALL provide a "Social Context" text input with placeholder "How you know them".

### Requirement 21: Contact Editor Color Zone

**User Story:** As a user, I want to assign a color to a contact from a 20-color palette or custom hex input, see a live preview, and have the editor background tint to that color, so that contacts are visually distinctive.

#### Acceptance Criteria

1. THE Contact_Editor color zone SHALL provide a hex input field (max 7 characters) and a circular color preview swatch (24dp).
2. THE Contact_Editor color zone SHALL display a grid of 20 preset color swatches: #E3B23C, #D4764E, #D45B5B, #C2185B, #7B1FA2, #512DA8, #303F9F, #1976D2, #0097A7, #00897B, #388E3C, #689F38, #AFB42B, #F9A825, #FF8F00, #D84315, #795548, #546E7A, #8D6E63, #E91E63.
3. THE Contact_Editor color zone SHALL display a "no color" swatch (with a strikethrough/clear pattern) that removes the assigned color.
4. WHEN the user selects a color swatch or enters a valid hex value, THE Contact_Editor SHALL update the hex input, the preview circle, and tint the editor screen background with that color using Auto_Contrast for text readability.
5. THE selected color swatch SHALL be visually distinguished with a dark border and elevation/shadow.

### Requirement 22: Contact Editor Notes Zone

**User Story:** As a user, I want a markdown-capable notes field for free-form text about a contact, so that I can record additional context that doesn't fit structured fields.

#### Acceptance Criteria

1. THE Contact_Editor notes zone SHALL provide a multi-line text area with placeholder "Notes about this contact (supports markdown)..." and a minimum height of 6 lines.
2. THE Contact_Editor notes zone SHALL be collapsed by default and expandable by tapping the zone header.

### Requirement 23: Contact Editor Tags Zone

**User Story:** As a user, I want to add tags to contacts with auto-prefixing of "Contact/" and display them as removable chips, so that I can categorize and filter contacts.

#### Acceptance Criteria

1. THE Contact_Editor tags zone SHALL provide a text input with placeholder "Add tag (e.g. Contact/Family) and press Enter".
2. WHEN the user submits a tag value (via keyboard done/enter action), THE Contact_Editor SHALL auto-prepend "Contact/" if the entered text does not already start with "Contact/" and add it as a tag chip.
3. THE Contact_Editor tags zone SHALL display all current tags as inline chip elements, each with a visible remove (✕) button.
4. WHEN the user taps the remove button on a tag chip, THE Contact_Editor SHALL remove that tag from the contact's tag list.
5. THE Contact_Editor tags zone SHALL be collapsed by default and expandable by tapping the zone header.

### Requirement 24: Contact Editor Save System

**User Story:** As a user, I want the editor to track unsaved changes, show save buttons only when dirty, warn me before losing changes, and support both save-and-stay and save-and-exit actions, so that I never accidentally lose edits.

#### Acceptance Criteria

1. THE Dirty_Tracker SHALL detect any change to any field (text inputs, toggles, multi-value additions/removals, image changes, color changes, tag changes) and mark the form as dirty.
2. WHILE the form is dirty, THE Contact_Editor SHALL display "Save & Stay" and "Save & Exit" buttons in the header.
3. WHILE the form is clean (no unsaved changes), THE Contact_Editor SHALL hide the save buttons.
4. WHEN the user taps "Save & Stay", THE Contact_Editor SHALL save the contact via the API and remain on the editor screen, resetting the dirty state to clean.
5. WHEN the user taps "Save & Exit", THE Contact_Editor SHALL save the contact via the API and navigate back to the People_Page.
6. WHEN the user attempts to navigate back (system back button or exit button) while the form is dirty, THE Contact_Editor SHALL display an unsaved changes confirmation dialog with options to Save, Discard, or Cancel.
7. WHEN saving a new contact, THE Contact_Editor SHALL call `POST /api/contacts` and upon success update the screen to edit mode with the new contact's ID (enabling delete, QR, and audit buttons).
8. WHEN saving an existing contact, THE Contact_Editor SHALL call `PUT /api/contacts/{id}`.
9. IF the given_name field is empty when save is attempted, THEN THE Contact_Editor SHALL display a validation error and prevent the save.

### Requirement 25: Contact Editor Header Actions

**User Story:** As a user, I want a favorite toggle, QR share button, audit log link, and delete button in the editor header, so that I can perform common actions without scrolling through the form.

#### Acceptance Criteria

1. THE Contact_Editor header SHALL display a favorite toggle (★/☆) that reflects and toggles the contact's favorite state via the API.
2. THE Contact_Editor header SHALL display a QR share button (hidden for new unsaved contacts) that triggers the QR_Generator dialog for the current contact.
3. THE Contact_Editor header SHALL display an audit log button (hidden for new unsaved contacts) that navigates to the audit log filtered by the current contact.
4. THE Contact_Editor header SHALL display a delete button (hidden for new unsaved contacts) that initiates the delete flow.

### Requirement 26: Contact Delete

**User Story:** As a user, I want to delete a contact with a confirmation dialog that performs a soft-delete, so that I can remove contacts safely with the ability to restore them from trash.

#### Acceptance Criteria

1. WHEN the user taps the delete button, THE Contact_Editor SHALL display a confirmation dialog with the message "Are you sure you want to delete this contact?" styled with danger/destructive emphasis.
2. WHEN the user confirms deletion, THE Contact_Editor SHALL call `DELETE /api/contacts/{id}` (soft-delete) and navigate back to the People_Page.
3. WHEN the user cancels deletion, THE Contact_Editor SHALL dismiss the dialog and remain on the editor screen.

### Requirement 27: Contact Trash Page

**User Story:** As a user, I want a trash page listing all soft-deleted contacts with the ability to select, bulk restore, bulk permanently delete, or individually restore/delete contacts, so that I can manage deleted contacts.

#### Acceptance Criteria

1. THE Contact_Trash_Page SHALL display a list of soft-deleted contacts fetched from `GET /api/trash/contacts`.
2. EACH trash row SHALL display: a selection checkbox, the contact's display_name (or "(Unnamed)"), organization (or "—"), first email value (or "—"), first phone value (or "—"), deleted timestamp formatted as "Mon-DD HH:MM", and per-row action buttons.
3. EACH trash row for a vault contact SHALL display a vault badge (🏛️) next to the name.
4. THE Contact_Trash_Page SHALL provide a "Select All" checkbox in the header that toggles selection of all visible rows.
5. WHILE one or more rows are selected, THE Contact_Trash_Page SHALL display bulk action buttons: "Restore Selected" and "Delete Selected".
6. WHEN the user taps "Restore Selected", THE Trash_ViewModel SHALL call `POST /api/trash/contacts/{id}/restore` for each selected contact and refresh the list.
7. WHEN the user taps "Delete Selected", THE Contact_Trash_Page SHALL display a confirmation dialog, and upon confirmation THE Trash_ViewModel SHALL call `DELETE /api/trash/contacts/{id}/purge` for each selected contact and refresh the list.
8. EACH trash row SHALL provide a "Restore" button that restores that individual contact via `POST /api/trash/contacts/{id}/restore`.
9. EACH trash row SHALL provide a "Delete" button that, after confirmation, permanently purges that contact via `DELETE /api/trash/contacts/{id}/purge`.
10. WHEN the trash list is empty, THE Contact_Trash_Page SHALL display the message "No deleted contacts."

### Requirement 28: QR Code Sharing

**User Story:** As a user, I want to generate a QR code containing a contact's vCard data and display it in a dialog, so that I can share contact information by letting someone scan it with their phone.

#### Acceptance Criteria

1. WHEN the user triggers QR sharing for a contact, THE VCard_Builder SHALL generate a vCard 3.0 string client-side containing: N (structured name), FN (display name), TEL (phones with TYPE), EMAIL (with TYPE), ADR (with TYPE), URL (with TYPE), X-SIGNAL, X-PGP-KEY, X-CALLSIGN, X-XHANDLE, X-FAVORITE, ORG, NICKNAME, NOTE (social_context, signal_username, color as escaped newline-separated), and BDAY (first "Birthday" date entry).
2. THE QR_Generator SHALL check the UTF-8 byte length of the generated vCard string against the maximum QR capacity of 2953 bytes (error correction level L).
3. IF the vCard data fits within 2953 bytes, THEN THE QR_Generator SHALL render the QR code in a dialog showing: title "Share: {contact_name}", the QR code image, and an info line "{name} — vCard ({bytes} bytes)".
4. IF the vCard data exceeds 2953 bytes, THEN THE QR_Generator SHALL display an error message "Contact data too large for QR. Use Export instead."
5. THE QR dialog SHALL be dismissible by tapping a close button, tapping the backdrop, or pressing the system back button.

### Requirement 29: Single Contact Export

**User Story:** As a user, I want to export a single contact as a .vcf file from the editor, so that I can share individual contacts as files.

#### Acceptance Criteria

1. THE Contact_Editor SHALL provide an export action (accessible from the QR/share area or an overflow menu) that exports the current contact as a .vcf file.
2. WHEN single-contact export is triggered, THE Export_Handler SHALL download the file from `GET /api/contacts/{id}/export?format=vcf` and save it to the device or trigger the Android share sheet.

### Requirement 30: Vault System

**User Story:** As a user, I want to toggle any contact between Private (only I can see it) and Vault (all users can see it), with vault contacts from other users appearing in a separate section, so that I can share contacts across the household.

#### Acceptance Criteria

1. THE Contact_Editor vault toggle pill SHALL switch the contact between "Private" (shared_to_vault=false, only owner sees it) and "Vault" (shared_to_vault=true, all users see it).
2. THE People_Page grouped mode SHALL display vault contacts from other users in the "🏛️ Contact Vault" section, separate from the user's own contacts.
3. THE People_Page SHALL allow any user to tap and edit vault contacts from other users (vault contacts are fully editable by any user with access).
4. WHEN creating a new contact, THE Contact_Editor SHALL read the user preference `default_share_contacts` and if its value is "1", default the vault toggle to "Vault".

### Requirement 31: Contact API Service (Retrofit)

**User Story:** As a developer, I want a complete Retrofit interface defining all contact-related API endpoints, so that the Android app can communicate with the CWOC server for all contact operations.

#### Acceptance Criteria

1. THE Contact_API_Service SHALL define `POST /api/contacts` for creating a new contact (JSON body, returns created contact with ID).
2. THE Contact_API_Service SHALL define `GET /api/contacts` with optional query parameter `q` for listing and searching contacts.
3. THE Contact_API_Service SHALL define `GET /api/contacts/{id}` for fetching a single contact by ID.
4. THE Contact_API_Service SHALL define `PUT /api/contacts/{id}` for updating an existing contact (JSON body).
5. THE Contact_API_Service SHALL define `DELETE /api/contacts/{id}` for soft-deleting a contact.
6. THE Contact_API_Service SHALL define `PATCH /api/contacts/{id}/favorite` for toggling the favorite flag.
7. THE Contact_API_Service SHALL define `POST /api/contacts/{id}/image` for uploading a profile image (multipart).
8. THE Contact_API_Service SHALL define `DELETE /api/contacts/{id}/image` for removing a profile image.
9. THE Contact_API_Service SHALL define `POST /api/contacts/import` for importing a .vcf or .csv file (multipart).
10. THE Contact_API_Service SHALL define `GET /api/contacts/export` with format query parameter (vcf or csv) for exporting all contacts.
11. THE Contact_API_Service SHALL define `GET /api/contacts/{id}/export` with format query parameter for exporting a single contact.
12. THE Contact_API_Service SHALL define `GET /api/trash/contacts` for listing soft-deleted contacts.
13. THE Contact_API_Service SHALL define `POST /api/trash/contacts/{id}/restore` for restoring a deleted contact.
14. THE Contact_API_Service SHALL define `DELETE /api/trash/contacts/{id}/purge` for permanently deleting a contact.
15. THE Contact_API_Service SHALL define `GET /api/auth/switchable-users` for fetching the list of app users (used in the Users section).

### Requirement 32: Visual Design — Parchment Theme

**User Story:** As a user, I want the contacts feature to match the CWOC parchment aesthetic with proper colors, fonts, borders, and spacing, so that it feels like a cohesive part of the app.

#### Acceptance Criteria

1. THE People_Page and Contact_Editor SHALL use parchment background colors (#fffaf0 or equivalent) consistent with the existing CWOC Android theme.
2. THE contact rows SHALL use 10dp vertical and 12dp horizontal padding, a 1dp bottom border in color #d4c5a9, and a hover/pressed background of rgba(212, 196, 160, 0.2).
3. THE section dividers in grouped mode SHALL use uppercase text, 1dp letter-spacing, #e0d4b5 background, and #8b5a2b text color.
4. THE buttons SHALL use the CWOC gradient brown style (#d4a373 to #c8965a) with 1dp solid #8b5a2b border.
5. THE danger/destructive buttons (delete, purge) SHALL use a red background (#b22222).
6. THE search input SHALL use #f5e6cc background with a teal focus ring/border.
7. THE Contact_Editor zone headers SHALL be tappable to collapse/expand with a toggle icon (chevron or equivalent).
8. THE multi-value field rows SHALL use a flex/row layout with appropriate spacing, label input at 80dp width, and value input filling remaining space.

### Requirement 33: Auto-Contrast Text Color

**User Story:** As a user, I want text on colored contact rows and the colored editor background to automatically switch between light and dark for readability, so that I can always read contact information regardless of the assigned color.

#### Acceptance Criteria

1. WHEN a contact has a color assigned, THE Auto_Contrast algorithm SHALL compute the relative luminance of the background color and select either dark text (#1a1208) or light text (#fffaf0) based on a contrast threshold.
2. THE Auto_Contrast algorithm SHALL be applied to contact rows on the People_Page (text color and detail line color) and to the Contact_Editor background tint (all text elements within the editor).

### Requirement 34: Contact Data Sync

**User Story:** As a developer, I want the contacts Room database to stay synchronized with the server using the existing sync infrastructure, so that contacts created or edited on any platform appear on the Android app.

#### Acceptance Criteria

1. THE Contact_Repository SHALL use the existing sync mechanism (sync_version tracking) to fetch new and updated contacts from the server.
2. WHEN a contact is created or updated locally via the Contact_Editor, THE Contact_Repository SHALL send the change to the server API and update the local Room database upon successful response.
3. WHEN the sync process receives updated contacts from the server, THE Contact_Repository SHALL upsert them into the local Room database, preserving the server's sync_version.
4. THE Contact_Repository Room DAO SHALL provide queries for: all non-deleted contacts sorted by favorite DESC then display_name ASC, contacts filtered by search query across all text fields, contacts filtered by shared_to_vault status, and soft-deleted contacts for the trash view.

### Requirement 35: Birthday Calendar Integration

**User Story:** As a user, I want contact dates marked with show_on_calendar to generate annual calendar events (birthdays, anniversaries), so that I see important dates on my CWOC calendar.

#### Acceptance Criteria

1. THE Contact_API_Service SHALL define `GET /api/contacts/birthdays` for fetching virtual calendar entries generated from contact dates.
2. THE calendar integration SHALL generate entries for each contact date with show_on_calendar not explicitly set to false, covering previous year, current year, and next year.
3. EACH birthday/anniversary calendar entry SHALL be an all-day event with title format "{emoji} {display_name} — {label} ({age} yrs)" where emoji is 🎂 for birthday and 💍 for anniversary.
4. EACH calendar entry SHALL use the contact's color (or default #f5e6d3) and include metadata: _is_birthday, _contact_id, _contact_image_url, _date_label.

### Requirement 36: Contact Editor Prefill from Navigation

**User Story:** As a user, I want the contact editor to accept prefill parameters (email, name) from navigation so that creating a contact from another context pre-populates known fields.

#### Acceptance Criteria

1. WHEN the Contact_Editor is opened with a prefill_email navigation argument, THE Contact_Editor SHALL add that email address as the first entry in the emails multi-value field.
2. WHEN the Contact_Editor is opened with a prefill_name navigation argument, THE Contact_Editor SHALL split the value into given_name (first word) and surname (remaining words) and populate those fields.

### Requirement 37: Profile Mode (User Profile Editing)

**User Story:** As a user, I want the contact editor to double as a user profile editor when accessed in profile mode, showing account fields and hiding contact-specific actions, so that user profiles use the same familiar interface.

#### Acceptance Criteria

1. WHEN the Contact_Editor is opened with mode=profile, THE Contact_Editor SHALL display an Account zone with username (read-only) and display name fields.
2. WHEN in profile mode, THE Contact_Editor SHALL hide the following elements: favorite button, delete button, QR button, audit button, tags zone, and vault toggle.
3. WHEN in profile mode, THE Contact_Editor SHALL display a type badge of "👤 User" instead of "📇 Contact".
4. WHEN the Contact_Editor is opened with mode=profile and a different user_id, THE Contact_Editor SHALL display all fields as read-only with a banner indicating the profile belongs to another user.

### Requirement 38: Hilt Dependency Injection

**User Story:** As a developer, I want all contact-related components (repository, API service, ViewModels) wired through Hilt DI, so that the architecture follows the existing app patterns and is testable.

#### Acceptance Criteria

1. THE Contact_API_Service Retrofit interface SHALL be provided via a Hilt module as a singleton.
2. THE Contact_Repository SHALL be provided via a Hilt module, injecting the Room DAO and Contact_API_Service.
3. THE People_ViewModel, Contact_ViewModel, and Trash_ViewModel SHALL use @HiltViewModel annotation with constructor injection of the Contact_Repository.
4. THE Contact_Entity Room DAO SHALL be provided from the existing AppDatabase Hilt module.

### Requirement 39: Navigation Integration

**User Story:** As a user, I want the People page accessible from the app's main navigation and the contact editor reachable from the people list, trash, and other contexts, so that contacts are fully integrated into the app's navigation graph.

#### Acceptance Criteria

1. THE app navigation graph SHALL include routes for: People_Page, Contact_Editor (with optional id, mode, user_id, prefill_email, prefill_name parameters), and Contact_Trash_Page.
2. THE app's main navigation (sidebar or bottom nav) SHALL include a "People" entry that navigates to the People_Page.
3. THE People_Page SHALL provide navigation to: Contact_Editor (create mode via New Contact button), Contact_Editor (edit mode via row tap), and Contact_Trash_Page (via Trash button).
4. THE Contact_Editor SHALL provide navigation back to the People_Page (via exit/back with unsaved changes handling).

### Requirement 40: VCard Builder for QR and Export

**User Story:** As a developer, I want a client-side vCard 3.0 builder that constructs valid vCard strings from contact data, so that QR generation and single-contact export work without server round-trips.

#### Acceptance Criteria

1. THE VCard_Builder SHALL generate valid vCard 3.0 strings with BEGIN:VCARD, VERSION:3.0, and END:VCARD delimiters.
2. THE VCard_Builder SHALL include the N property (structured name: surname;given;middle;prefix;suffix).
3. THE VCard_Builder SHALL include the FN property (display name).
4. THE VCard_Builder SHALL include TEL properties for each phone entry with TYPE parameter from the label.
5. THE VCard_Builder SHALL include EMAIL properties for each email entry with TYPE parameter from the label.
6. THE VCard_Builder SHALL include ADR properties for each address entry with TYPE parameter from the label.
7. THE VCard_Builder SHALL include URL properties for each website entry with TYPE parameter from the label.
8. THE VCard_Builder SHALL include X-SIGNAL property if has_signal is true.
9. THE VCard_Builder SHALL include X-PGP-KEY property if pgp_key is present.
10. THE VCard_Builder SHALL include X-CALLSIGN properties for each call sign entry.
11. THE VCard_Builder SHALL include X-XHANDLE properties for each X handle entry.
12. THE VCard_Builder SHALL include X-FAVORITE property if favorite is true.
13. THE VCard_Builder SHALL include ORG property if organization is present.
14. THE VCard_Builder SHALL include NICKNAME property if nickname is present.
15. THE VCard_Builder SHALL include NOTE property containing social_context, signal_username, and color as escaped newline-separated values.
16. THE VCard_Builder SHALL include BDAY property from the first date entry with label "Birthday".

### Requirement 41: Import File Parsing (Server-Side)

**User Story:** As a developer, I want the server to correctly parse imported .vcf and .csv files handling all CWOC-specific fields and edge cases, so that contacts imported on Android have full data fidelity.

#### Acceptance Criteria

1. WHEN a .vcf file is uploaded, THE server SHALL split the file into individual vCard blocks (BEGIN:VCARD...END:VCARD) and parse each block.
2. THE server vCard parser SHALL handle line unfolding per RFC 2425 §5.8.1 (continuation lines starting with whitespace).
3. THE server vCard parser SHALL map standard properties: N, FN, TEL, EMAIL, ADR, URL, BDAY, and X-properties: X-SIGNAL, X-PGP-KEY, X-CALLSIGN, X-XHANDLE, X-FAVORITE.
4. IF a vCard entry lacks a given_name, THEN THE server SHALL skip that entry and include it in the skipped count.
5. WHEN a .csv file is uploaded, THE server SHALL parse the header row and map columns including numbered multi-value columns: phone_1_label, phone_1_value through phone_5_label, phone_5_value (and similarly for emails, addresses, call_signs, x_handles, websites up to 5 each).
6. IF a .csv row lacks a given_name column value, THEN THE server SHALL skip that row and include it in the error summary.

### Requirement 42: Export File Generation (Server-Side)

**User Story:** As a developer, I want the server to generate correct .vcf and .csv export files containing all contact data, so that exported files from Android are complete and importable elsewhere.

#### Acceptance Criteria

1. WHEN exporting as .vcf, THE server SHALL generate a vCard 3.0 block for each contact including: N, FN, TEL (with TYPE), EMAIL (with TYPE), ADR (with TYPE), URL (with TYPE), X-SIGNAL, X-PGP-KEY, X-CALLSIGN, X-XHANDLE, X-FAVORITE, BDAY, ORG, NICKNAME.
2. THE server SHALL concatenate all vCard blocks with \r\n separators into a single .vcf file.
3. WHEN exporting as .csv, THE server SHALL generate a header row with scalar fields (given_name, surname, middle_names, prefix, suffix, has_signal, pgp_key, favorite) and numbered multi-value columns (up to 5 each for phones, emails, addresses, call_signs, x_handles, websites).
4. THE server SHALL generate one data row per contact in the .csv export.

### Requirement 43: Error Handling and Offline Behavior

**User Story:** As a user, I want clear error messages when API calls fail and graceful degradation when offline, so that I understand what went wrong and can still browse cached contacts.

#### Acceptance Criteria

1. IF an API call returns an HTTP error (4xx or 5xx), THEN THE Contact_Repository SHALL propagate a descriptive error message to the ViewModel which SHALL display it to the user via a snackbar or toast.
2. IF the device is offline, THEN THE People_Page SHALL display contacts from the local Room database cache.
3. IF the device is offline and the user attempts to save, import, export, or delete, THEN THE Contact_Editor SHALL display a message indicating the operation requires network connectivity.
4. IF the favorite toggle API call fails, THEN THE People_Page SHALL revert the optimistic UI update and display an error message.
