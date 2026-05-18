# Requirements Document — Phase 5c: Advanced Features

## Introduction

Phase 5c adds the remaining advanced features to bring the Android app to complete functional parity with the web app. This includes the audit log, attachments, quick-edit modal, import/export, contact QR/vCard sharing, proper location UI with geocoding, and read-only email view.

## Glossary

- **Quick_Edit_Modal**: Long-press overlay for inline field editing without opening the full editor
- **Geocoding**: Converting a text address into latitude/longitude coordinates via the server's Nominatim proxy
- **vCard**: Standard contact interchange format (.vcf files)
- **Attachment**: A file (image, document, etc.) associated with a chit, stored on the server

## Requirements

### Requirement 1: Audit Log

**User Story:** As a user, I want to view the audit log on the Android app, so that I can see change history.

#### Acceptance Criteria

1. THE App SHALL provide an Audit Log screen accessible from the sidebar/menu.
2. THE Audit Log SHALL display recent changes with: timestamp, action type, chit title, and changed fields.
3. THE Audit Log SHALL support scrolling/pagination for large histories.
4. THE Audit Log SHALL show a diff summary for each change (field name, old value → new value).

### Requirement 2: Attachments

**User Story:** As a user, I want to view and manage file attachments on chits from the Android app.

#### Acceptance Criteria

1. THE Editor SHALL display existing attachments as a list with filename, size, and type icon.
2. THE Editor SHALL allow downloading/viewing attachments (open in system viewer).
3. THE Editor SHALL allow uploading new attachments (photo picker or file picker).
4. THE Editor SHALL allow deleting attachments with confirmation.
5. THE Editor SHALL show upload progress for large files.
6. THE Editor SHALL enforce the max file size limit from settings.

### Requirement 3: Quick-Edit Modal

**User Story:** As a user, I want to quickly edit common chit fields without opening the full editor, so that I can make fast changes from the list view.

#### Acceptance Criteria

1. WHEN the user long-presses a chit card, THE App SHALL display a Quick-Edit modal overlay.
2. THE Quick-Edit modal SHALL allow editing: title, status, priority, due date, and tags.
3. THE Quick-Edit modal SHALL save changes immediately on confirm (single save button).
4. THE Quick-Edit modal SHALL be dismissible by tapping outside or pressing back.
5. THE Quick-Edit modal SHALL sync changes to the server via dirty tracking.

### Requirement 4: Import/Export

**User Story:** As a user, I want to import and export data from the Android app.

#### Acceptance Criteria

1. THE App SHALL support exporting all chits as JSON (via share intent or file save).
2. THE App SHALL support importing chits from JSON files (via file picker or share intent receive).
3. THE App SHALL support exporting contacts as vCard (.vcf) files.
4. THE App SHALL support importing contacts from vCard (.vcf) files.
5. THE App SHALL show a summary of imported items (count, any errors) after import completes.

### Requirement 5: Contact QR/vCard Sharing

**User Story:** As a user, I want to share contacts via QR code or vCard from the Android app.

#### Acceptance Criteria

1. THE Contact Editor/Detail SHALL provide a "Share" button that generates a QR code containing the contact's vCard data.
2. THE App SHALL display the QR code in a modal overlay for scanning.
3. THE App SHALL allow sharing the vCard file via Android's share intent system.
4. THE QR modal SHALL be dismissible by tapping outside or pressing back.

### Requirement 6: Proper Location UI in Editor

**User Story:** As a user, I want a proper location picker in the editor with geocoding search and saved locations.

#### Acceptance Criteria

1. THE Editor location zone SHALL provide a text input with geocoding autocomplete (via server proxy at `/api/geocode`).
2. THE Editor SHALL display a dropdown of saved locations (from settings) for quick selection.
3. THE Editor SHALL show a small map preview of the selected location (static map tile or embedded mini-map).
4. THE Editor SHALL allow clearing the location.
5. THE Editor SHALL store both the display name and lat/lon coordinates.

### Requirement 7: Email View (Read-Only)

**User Story:** As a user, I want to view my synced emails in the Android app, so that I can read email chits.

#### Acceptance Criteria

1. THE App SHALL display email chits in a dedicated Email tab or section within the C CAPTN views.
2. THE App SHALL render email content (plain text and HTML) in a readable format.
3. THE App SHALL display email metadata: from, to, cc, date, subject.
4. THE App SHALL support email thread view (grouped by conversation, sorted by date).
5. THE App SHALL mark emails as read/unread with visual distinction.
6. THE App SHALL NOT support composing or sending emails (read-only in this phase).
