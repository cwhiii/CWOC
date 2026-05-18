# Requirements Document

## Introduction

Bring the Android app to 100% visual-state parity with the mobile web version. Every page, tab, sub-mode, modal, and navigable state that exists on the web must be accessible and functional on Android in the same way. This spec covers all gaps identified in the Android-vs-Web parity audit, organized by priority tier (P0 through P3).

## Glossary

- **Android_App**: The Jetpack Compose Android application for CWOC
- **Web_App**: The vanilla JS/HTML/CSS mobile web version of CWOC served by FastAPI
- **NavGraph**: The Navigation Compose graph (`CwocNavGraph.kt`) that registers composable destinations for routes
- **CCaptn_Tab_Row**: The horizontal tab bar component (`CCaptnTabRow.kt`) providing access to Calendar, Checklists, Alarms, Projects, Tasks, Notes, and other dashboard tabs
- **Sidebar**: The navigation drawer (`SidebarContent.kt`) providing links to secondary screens
- **Chit**: The core data record in CWOC that can serve as a task, note, calendar event, alarm, checklist, or project
- **Editor**: The full-screen chit editing interface with collapsible zones for each data category
- **Sync_API**: The server endpoint (`/api/sync`) that provides all data to the Android app
- **Composable**: A Jetpack Compose UI function registered as a navigation destination
- **Sub_Mode**: A view toggle within a tab that shows a filtered or alternative presentation of the same data
- **Omni_View**: A dashboard-style screen showing aggregated sections (chronological, reminders, weather, email, pinned items)

## Requirements

### Requirement 1: Fix Broken Navigation — Indicators Accessibility

**User Story:** As a user, I want to access the Indicators screen from the tab row or sidebar, so that I can view my health and habit indicator charts without needing to know the direct route.

#### Acceptance Criteria

1. WHEN the Android_App displays the CCaptn_Tab_Row, THE CCaptn_Tab_Row SHALL include an Indicators tab matching the web access pattern
2. WHEN a user taps the Indicators tab, THE NavGraph SHALL navigate to the Indicators composable screen
3. THE Indicators screen SHALL be reachable without the user manually entering a route URL

### Requirement 2: Fix Broken Navigation — Audit Log Crash

**User Story:** As a user, I want to tap the Audit Log sidebar link without the app crashing, so that I can view system audit entries.

#### Acceptance Criteria

1. WHEN a user taps the Audit Log link in the Sidebar, THE NavGraph SHALL navigate to a registered Audit Log composable
2. THE Android_App SHALL NOT crash or display a blank screen when navigating to the Audit Log route
3. IF the Audit Log composable is not registered in the NavGraph, THEN THE Android_App SHALL register it before the navigation graph is built

### Requirement 3: Fix Broken Navigation — Custom Objects Crash

**User Story:** As a user, I want to tap the Custom Objects sidebar link without the app crashing, so that I can manage custom object definitions.

#### Acceptance Criteria

1. WHEN a user taps the Custom Objects link in the Sidebar, THE NavGraph SHALL navigate to a registered Custom Objects Editor composable
2. THE Android_App SHALL NOT crash or display a blank screen when navigating to the Custom Objects route
3. IF the Custom Objects composable is not registered in the NavGraph, THEN THE Android_App SHALL register it before the navigation graph is built

### Requirement 4: Email Client — Full Feature Implementation

**User Story:** As a user, I want a complete email client within the Android app, so that I can read, compose, and manage emails the same way I do on the web.

#### Acceptance Criteria

1. WHEN the Android_App displays the CCaptn_Tab_Row, THE CCaptn_Tab_Row SHALL include an Email tab
2. WHEN a user taps the Email tab, THE Android_App SHALL display the email inbox with folder navigation (Inbox, Sent, Drafts, Scheduled, Trash, Archived)
3. WHEN a user selects a folder, THE Android_App SHALL display the list of emails in that folder
4. WHEN a user taps an email thread, THE Android_App SHALL expand the thread showing all messages in chronological order
5. WHEN a user taps Compose, THE Android_App SHALL display a compose screen with To, CC, BCC, Subject, and Body fields
6. WHEN a user taps Reply or Forward on an email, THE Android_App SHALL pre-populate the compose screen with the appropriate context
7. WHEN a user configures email bundles, THE Android_App SHALL display bundle tabs for categorized email grouping
8. WHEN a user taps Send, THE Android_App SHALL submit the email via the Sync_API and move it to the Sent folder

### Requirement 5: Tasks Tab — Habits Sub-Mode

**User Story:** As a user, I want a dedicated Habits view within the Tasks tab, so that I can see and manage my habit-tracking chits in a focused interface.

#### Acceptance Criteria

1. WHEN the Tasks tab is active, THE Android_App SHALL display sub-mode toggles including a Habits option
2. WHEN a user selects the Habits sub-mode, THE Android_App SHALL display only chits with habit data in a dedicated habits layout matching the Web_App presentation
3. WHILE the Habits sub-mode is active, THE Android_App SHALL show habit streak information, completion status, and scheduling details for each habit chit

### Requirement 6: Tasks Tab — Assigned-to-Me Sub-Mode

**User Story:** As a user, I want an Assigned-to-Me view within the Tasks tab, so that I can quickly see tasks assigned to me across all projects.

#### Acceptance Criteria

1. WHEN the Tasks tab is active, THE Android_App SHALL display sub-mode toggles including an Assigned-to-Me option
2. WHEN a user selects the Assigned-to-Me sub-mode, THE Android_App SHALL display only chits where the current user is listed in the people/assignee field
3. WHILE the Assigned-to-Me sub-mode is active, THE Android_App SHALL group and sort tasks matching the Web_App presentation

### Requirement 7: Settings — Collections Tab

**User Story:** As a user, I want a Collections tab in Settings, so that I can manage tags, custom colors, saved locations, and default notifications.

#### Acceptance Criteria

1. WHEN a user opens Settings, THE Android_App SHALL display a Collections tab alongside existing tabs (General, Views, Email, Badges, Admin)
2. WHEN a user selects the Collections tab, THE Android_App SHALL display sections for Tag Editor, Custom Colors, Saved Locations, and Default Notifications
3. WHEN a user interacts with the Tag Editor section, THE Android_App SHALL allow creating, editing, deleting, and reordering tags
4. WHEN a user interacts with the Custom Colors section, THE Android_App SHALL allow defining and managing custom color values
5. WHEN a user interacts with the Saved Locations section, THE Android_App SHALL allow adding, editing, and removing saved location entries
6. WHEN a user interacts with the Default Notifications section, THE Android_App SHALL allow configuring default notification preferences for new chits

### Requirement 8: Settings — Email Tab Real Implementation

**User Story:** As a user, I want the Settings Email tab to be fully functional, so that I can configure email accounts, signatures, and preferences.

#### Acceptance Criteria

1. WHEN a user selects the Email tab in Settings, THE Android_App SHALL display the full email configuration interface matching the Web_App
2. WHEN a user adds or edits an email account, THE Android_App SHALL provide fields for server settings, credentials, and sync preferences
3. WHEN a user edits their email signature, THE Android_App SHALL provide a rich text editor for signature content
4. THE Settings Email tab SHALL NOT display placeholder text or "coming soon" content

### Requirement 9: Maps — People and Both Mode Toggle

**User Story:** As a user, I want to toggle between Chits, People, and Both modes on the Maps screen, so that I can see contact locations alongside chit locations.

#### Acceptance Criteria

1. WHEN the Maps screen is displayed, THE Android_App SHALL show a mode toggle with Chits, People, and Both options
2. WHEN a user selects People mode, THE Android_App SHALL display markers for contacts with saved locations
3. WHEN a user selects Both mode, THE Android_App SHALL display both chit markers and people markers simultaneously
4. WHILE any map mode is active, THE Android_App SHALL match the marker styling and info display of the Web_App

### Requirement 10: People Page — Grouped Mode

**User Story:** As a user, I want a Grouped mode on the People page, so that I can view contacts organized into Favorites, Users, Contacts, and Vault sections.

#### Acceptance Criteria

1. WHEN the People page is displayed, THE Android_App SHALL provide a toggle between Grouped and Ungrouped (flat alphabetical) modes
2. WHEN a user selects Grouped mode, THE Android_App SHALL display contacts organized into Favorites, Users, Contacts, and Vault sections
3. WHILE Grouped mode is active, THE Android_App SHALL display section headers and allow collapsing/expanding each group

### Requirement 11: Audit Log — Full Screen Implementation

**User Story:** As a user, I want a fully functional Audit Log screen, so that I can review system changes with filters and pagination.

#### Acceptance Criteria

1. WHEN a user navigates to the Audit Log screen, THE Android_App SHALL display audit log entries in reverse chronological order
2. WHEN a user applies filters, THE Android_App SHALL filter entries by date range, action type, and entity type
3. WHEN the entry list exceeds one page, THE Android_App SHALL provide pagination controls
4. WHEN a user taps an audit entry, THE Android_App SHALL display the full entry details including before/after diff data

### Requirement 12: Custom Objects Editor — Full Screen Implementation

**User Story:** As a user, I want a fully functional Custom Objects Editor screen, so that I can define and manage custom object schemas.

#### Acceptance Criteria

1. WHEN a user navigates to the Custom Objects Editor, THE Android_App SHALL display the list of defined custom objects
2. WHEN a user creates or edits a custom object, THE Android_App SHALL provide a schema editor matching the Web_App functionality
3. WHEN a user saves a custom object definition, THE Android_App SHALL persist it via the Sync_API

### Requirement 13: User Admin Screen

**User Story:** As a user with admin privileges, I want a User Admin screen, so that I can manage user accounts from the Android app.

#### Acceptance Criteria

1. THE Android_App SHALL register a User Admin composable in the NavGraph
2. THE Android_App SHALL provide a navigation link to User Admin in the Sidebar for admin users
3. WHEN a user navigates to User Admin, THE Android_App SHALL display the user management interface matching the Web_App

### Requirement 14: Rules Manager and Rule Editor Screens

**User Story:** As a user, I want Rules Manager and Rule Editor screens, so that I can create and manage automation rules from the Android app.

#### Acceptance Criteria

1. THE Android_App SHALL register Rules Manager and Rule Editor composables in the NavGraph
2. THE Android_App SHALL provide a navigation link to Rules Manager in the Sidebar
3. WHEN a user navigates to Rules Manager, THE Android_App SHALL display the list of defined rules with status indicators
4. WHEN a user creates or edits a rule, THE Android_App SHALL display the Rule Editor with condition and action configuration matching the Web_App

### Requirement 15: Contact Trash Screen

**User Story:** As a user, I want a Contact Trash screen, so that I can view and restore deleted contacts separately from deleted chits.

#### Acceptance Criteria

1. THE Android_App SHALL register a Contact Trash composable in the NavGraph
2. THE Android_App SHALL provide a navigation link to Contact Trash (accessible from the People page or Sidebar)
3. WHEN a user navigates to Contact Trash, THE Android_App SHALL display deleted contacts with restore and permanent delete options

### Requirement 16: Attachments Browser Screen

**User Story:** As a user, I want a standalone Attachments browser screen, so that I can browse and manage all attachments across chits.

#### Acceptance Criteria

1. THE Android_App SHALL register an Attachments Browser composable in the NavGraph
2. THE Android_App SHALL provide a navigation link to the Attachments Browser in the Sidebar
3. WHEN a user navigates to the Attachments Browser, THE Android_App SHALL display all attachments with preview thumbnails, file names, and associated chit references

### Requirement 17: Admin Chits Screen

**User Story:** As an admin user, I want an Admin Chits screen, so that I can manage chits across all users from a single administrative view.

#### Acceptance Criteria

1. THE Android_App SHALL define a route for Admin Chits in the navigation system
2. THE Android_App SHALL register an Admin Chits composable in the NavGraph
3. THE Android_App SHALL provide a navigation link to Admin Chits in the Sidebar for admin users
4. WHEN a user navigates to Admin Chits, THE Android_App SHALL display the administrative chit management interface matching the Web_App

### Requirement 18: Alarms Tab — Notifications and Reminders Sub-Modes

**User Story:** As a user, I want Notifications and Reminders sub-modes in the Alarms tab, so that I can view alarm-type chits filtered by their notification category.

#### Acceptance Criteria

1. WHEN the Alarms tab is active, THE Android_App SHALL display sub-mode toggles for List, Independent, Notifications, and Reminders
2. WHEN a user selects the Notifications sub-mode, THE Android_App SHALL display only notification-type alarm chits
3. WHEN a user selects the Reminders sub-mode, THE Android_App SHALL display only reminder-type alarm chits

### Requirement 19: Projects Tab — List/Tree View

**User Story:** As a user, I want a List/Tree view in the Projects tab, so that I can see project hierarchies in a tree structure alongside the Kanban view.

#### Acceptance Criteria

1. WHEN the Projects tab is active, THE Android_App SHALL display a view toggle between Kanban and List/Tree modes
2. WHEN a user selects List/Tree mode, THE Android_App SHALL display projects and their child chits in a hierarchical tree layout matching the Web_App

### Requirement 20: Indicators — Calendar and Log Sub-Modes

**User Story:** As a user, I want Calendar and Log sub-modes on the Indicators screen, so that I can view indicator data in year-grid and reverse-chronological formats.

#### Acceptance Criteria

1. WHEN the Indicators screen is active, THE Android_App SHALL display sub-mode toggles for Charts, Calendar, and Log
2. WHEN a user selects the Calendar sub-mode, THE Android_App SHALL display indicator data in a year-grid calendar format
3. WHEN a user selects the Log sub-mode, THE Android_App SHALL display indicator entries in reverse chronological order

### Requirement 21: Month Calendar — Compress/Scroll Toggle

**User Story:** As a user, I want a Compress/Scroll toggle on the Month calendar view, so that I can choose between a fixed-height compressed layout and a scrollable expanded layout.

#### Acceptance Criteria

1. WHEN the Month calendar view is active, THE Android_App SHALL display a Compress/Scroll toggle
2. WHEN a user selects Compress mode, THE Android_App SHALL display the month grid in a fixed-height layout with truncated event lists
3. WHEN a user selects Scroll mode, THE Android_App SHALL display the month grid in a scrollable layout showing all events per day

### Requirement 22: Contact Editor — Profile Mode

**User Story:** As a user, I want a Profile mode in the Contact Editor, so that I can view and edit user profile information distinct from contact records.

#### Acceptance Criteria

1. WHEN the Contact Editor is opened for a user-type contact, THE Android_App SHALL provide a mode toggle between Contact and Profile views
2. WHEN a user selects Profile mode, THE Android_App SHALL display user profile fields and editing capabilities matching the Web_App

### Requirement 23: Omni View — Missing Sections and Layout Configuration

**User Story:** As a user, I want the Omni View to include HST Bar, Weather, Email, and Pinned All sections with layout configuration, so that the Android Omni View matches the web version completely.

#### Acceptance Criteria

1. WHEN the Omni View is displayed, THE Android_App SHALL render HST Bar, Weather, Email, and Pinned All sections in addition to existing sections
2. WHEN a user opens the layout configuration modal, THE Android_App SHALL allow reordering, showing, and hiding Omni View sections
3. WHILE the Omni View is active, THE Android_App SHALL display all configured sections in the user-defined order

### Requirement 24: Calculator Popover

**User Story:** As a user, I want a Calculator popover accessible from the app, so that I can perform quick calculations without leaving CWOC.

#### Acceptance Criteria

1. THE Android_App SHALL provide a Calculator access point matching the Web_App trigger location
2. WHEN a user activates the Calculator, THE Android_App SHALL display a calculator interface as a popover or bottom sheet
3. WHILE the Calculator is open, THE Android_App SHALL support basic arithmetic operations and display results

### Requirement 25: QR Code Sharing for Contacts

**User Story:** As a user, I want to generate and display QR codes for contacts, so that I can quickly share contact information with others.

#### Acceptance Criteria

1. WHEN a user views a contact, THE Android_App SHALL provide a QR code sharing action
2. WHEN a user activates QR code sharing, THE Android_App SHALL generate and display a QR code encoding the contact's vCard data

### Requirement 26: Camera Capture for Contact Photos

**User Story:** As a user, I want to capture photos using the device camera for contact profiles, so that I can take and assign contact photos directly.

#### Acceptance Criteria

1. WHEN a user edits a contact photo, THE Android_App SHALL offer a camera capture option alongside gallery selection
2. WHEN a user captures a photo via camera, THE Android_App SHALL crop and assign the captured image as the contact photo

### Requirement 27: Release Notes Viewer

**User Story:** As a user, I want a Release Notes viewer in the Android app, so that I can see what changed in each version.

#### Acceptance Criteria

1. THE Android_App SHALL provide access to a Release Notes viewer from Settings or an appropriate location
2. WHEN a user opens the Release Notes viewer, THE Android_App SHALL display release notes fetched from the server API with date navigation (Older/Newer)

### Requirement 28: Tag Create/Edit Modal

**User Story:** As a user, I want a Tag create/edit modal, so that I can create new tags and edit existing ones inline without navigating to Settings.

#### Acceptance Criteria

1. WHEN a user triggers tag creation from any tag picker context, THE Android_App SHALL display a tag creation modal with name, color, and parent fields
2. WHEN a user triggers tag editing, THE Android_App SHALL display a tag editing modal pre-populated with the existing tag data
3. WHEN a user saves a tag, THE Android_App SHALL persist the tag via the Sync_API and update all tag pickers immediately

### Requirement 29: Attachment Upload in Editor

**User Story:** As a user, I want to upload attachments from the chit editor on Android, so that I can attach files to chits without needing the web editor.

#### Acceptance Criteria

1. WHEN a user opens the Attachments zone in the Editor, THE Android_App SHALL display an upload action (not read-only)
2. WHEN a user triggers attachment upload, THE Android_App SHALL allow selecting files from device storage
3. WHEN a file is selected, THE Android_App SHALL upload the attachment via the Sync_API and display it in the Attachments zone

### Requirement 30: Omni Layout Configuration Modal

**User Story:** As a user, I want an Omni layout configuration modal, so that I can drag-to-arrange, show, and hide Omni View sections.

#### Acceptance Criteria

1. WHEN a user triggers layout configuration from the Omni View, THE Android_App SHALL display a modal with all available sections listed
2. WHEN a user drags sections in the configuration modal, THE Android_App SHALL reorder sections accordingly
3. WHEN a user toggles section visibility, THE Android_App SHALL show or hide the corresponding section in the Omni View
4. WHEN a user confirms the layout configuration, THE Android_App SHALL persist the layout preference and immediately update the Omni View display
