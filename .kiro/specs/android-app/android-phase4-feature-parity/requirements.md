# Requirements Document

## Introduction

This document specifies the requirements for Phase 4 of the CWOC Android app: Feature Parity & Polish. Phase 4 builds on the Phase 3 architecture (bidirectional sync, conflict handling, contacts/settings sync, local notifications) and adds the remaining C CAPTN views (Checklists, Projects/Kanban, Alerts/Alarms, Indicators), map integration via osmdroid/OpenStreetMap, home screen widgets via RemoteViews, pull-to-refresh, swipe actions (archive, snooze), boolean search, recurrence expansion (Kotlin port of `shared-recurrence.js`), animations/transitions, and a contact list screen. Charts are rendered via custom Compose Canvas. All code resides at `/android/`.

## Glossary

- **App**: The CWOC Android application (Kotlin, Jetpack Compose)
- **Checklists_View**: The Compose screen displaying chits that have checklist items, rendered as interactive nested checklists with toggle and reorder support
- **Projects_View**: The Compose screen displaying project master chits with their child chits arranged in a Kanban-style board with columns per status
- **Alerts_View**: The Compose screen displaying chits with alarm/notification flags as an independent alerts board
- **Indicators_View**: The Compose screen displaying health data charts for chits with indicator values, rendered via custom Compose Canvas drawing
- **Map_Screen**: The Compose screen embedding an osmdroid MapView to display chit location markers on OpenStreetMap tiles
- **Home_Widget**: An Android AppWidget implemented via RemoteViews XML that displays CWOC data on the device home screen
- **Quick_Add_Widget**: A Home_Widget variant providing a single-tap action to create a new chit
- **Today_Calendar_Widget**: A Home_Widget variant displaying today's calendar chits
- **Upcoming_Tasks_Widget**: A Home_Widget variant displaying upcoming tasks sorted by due date
- **Swipe_Action**: A gesture-driven action triggered by horizontal swipe on a chit list item (archive or snooze)
- **Boolean_Search**: The search system supporting AND, OR, NOT, and parenthesized grouping operators for filtering chits
- **Recurrence_Engine**: The Kotlin port of `shared-recurrence.js` that expands recurrence rules into concrete date instances
- **Contact_List_Screen**: The Compose screen displaying all contacts with search, filter, and navigation to the contact editor
- **Pull_To_Refresh**: The gesture-driven action triggered by pulling down on a list screen to initiate a manual sync pull
- **Kanban_Column**: A vertical lane in the Projects_View representing a chit status (ToDo, In Progress, Blocked, Complete)
- **Drag_Handle**: A touch target on a list item or Kanban card enabling drag-to-reorder
- **Canvas_Chart**: A custom Compose Canvas-drawn chart (line, bar, or sparkline) used in the Indicators_View
- **Osmdroid_MapView**: The osmdroid library's MapView component rendering OpenStreetMap tiles
- **Geocoding_Proxy**: The existing backend endpoint that proxies geocoding requests to OpenStreetMap Nominatim
- **Widget_Update_Worker**: A WorkManager job that periodically refreshes Home_Widget data from the local Room database
- **Chit_List_Item**: A single row in any chit list view representing one ChitEntity
- **Room_Database**: The local SQLite database managed by Android Room
- **ChitEntity**: The Room entity representing a chit record in the local database
- **Sync_Pull_Engine**: The component that fetches changes from the server via `GET /api/sync/changes`

## Requirements

### Requirement 1: Checklists View

**User Story:** As a user, I want to view and interact with my checklist chits in a dedicated view so that I can manage nested checklist items on my phone.

#### Acceptance Criteria

1. THE App SHALL provide a Checklists_View accessible from the bottom navigation bar as part of the C CAPTN tab set.
2. THE Checklists_View SHALL display all non-deleted ChitEntity records that contain checklist data, grouped by chit title.
3. WHEN the user taps a checklist item in the Checklists_View, THE App SHALL toggle the checked state of that item and persist the change to the Room_Database with dirty tracking.
4. THE Checklists_View SHALL render checklist items with indentation reflecting their nesting level, supporting at least three levels of depth.
5. WHEN the user long-presses a checklist item, THE App SHALL enable drag-to-reorder mode allowing the item to be moved within its parent chit's checklist.
6. WHEN a checklist item's checked state or order changes, THE App SHALL mark the parent ChitEntity as dirty with "checklist" in the dirty_fields array.

### Requirement 2: Projects/Kanban View

**User Story:** As a user, I want to view my project chits in a Kanban board layout so that I can track child chit progress across status columns.

#### Acceptance Criteria

1. THE App SHALL provide a Projects_View accessible from the bottom navigation bar as part of the C CAPTN tab set.
2. THE Projects_View SHALL display project master chits (chits with child_chits) as expandable cards, each showing a Kanban board of its child chits.
3. THE Projects_View SHALL arrange child chits into Kanban_Columns labeled "ToDo", "In Progress", "Blocked", and "Complete" based on each child chit's status field.
4. WHEN the user drags a child chit card from one Kanban_Column to another, THE App SHALL update that child chit's status field to match the destination column and mark the child ChitEntity as dirty.
5. WHEN the user taps a child chit card in the Projects_View, THE App SHALL navigate to the Chit_Editor for that child chit.
6. THE Projects_View SHALL display a count badge on each Kanban_Column header showing the number of chits in that column.

### Requirement 3: Alerts/Alarms View

**User Story:** As a user, I want a dedicated view for my alert and alarm chits so that I can see all time-sensitive items in one place.

#### Acceptance Criteria

1. THE App SHALL provide an Alerts_View accessible from the bottom navigation bar as part of the C CAPTN tab set.
2. THE Alerts_View SHALL display all non-deleted ChitEntity records that have alert data, sorted by next alert time ascending.
3. THE Alerts_View SHALL group alerts into "Upcoming" (future alert time) and "Past" (alert time has passed) sections.
4. WHEN the user taps an alert item in the Alerts_View, THE App SHALL navigate to the Chit_Editor for the associated chit.
5. THE Alerts_View SHALL display the alert type (alarm, reminder, timer), the scheduled time, and the chit title for each item.
6. WHEN an alert's scheduled time passes while the Alerts_View is visible, THE App SHALL move that alert from the "Upcoming" section to the "Past" section without requiring a manual refresh.

### Requirement 4: Indicators/Health Charts View

**User Story:** As a user, I want to view my health indicator data as charts so that I can track trends over time on my phone.

#### Acceptance Criteria

1. THE App SHALL provide an Indicators_View accessible from the bottom navigation bar as part of the C CAPTN tab set.
2. THE Indicators_View SHALL display charts for each distinct indicator type found in the user's ChitEntity records that contain indicator data.
3. THE Indicators_View SHALL render charts using custom Compose Canvas drawing (Canvas_Chart) without external charting libraries.
4. THE Canvas_Chart SHALL support line chart rendering with data points connected by lines, X-axis as dates, and Y-axis as indicator values.
5. WHEN the user taps a data point on a Canvas_Chart, THE App SHALL display a tooltip showing the exact value and date for that point.
6. THE Indicators_View SHALL allow the user to select a time range (7 days, 30 days, 90 days, all time) to filter the displayed chart data.

### Requirement 5: Map Integration

**User Story:** As a user, I want to see my location-tagged chits on a map so that I can visualize where my tasks and notes are geographically.

#### Acceptance Criteria

1. THE App SHALL provide a Map_Screen accessible from the navigation structure.
2. THE Map_Screen SHALL embed an Osmdroid_MapView rendering OpenStreetMap tiles.
3. THE Map_Screen SHALL display a marker for each non-deleted ChitEntity that has latitude and longitude values.
4. THE Map_Screen SHALL color-code markers based on the chit's color field, falling back to the primary brown (#6b4e31) when no color is set.
5. WHEN the user taps a marker on the Map_Screen, THE App SHALL display a popup showing the chit title, type, and a button to navigate to the Chit_Editor.
6. WHEN the Map_Screen loads, THE App SHALL fit the map bounds to encompass all visible markers with appropriate padding.
7. THE Map_Screen SHALL use the existing Geocoding_Proxy backend endpoint for any address-to-coordinate lookups.

### Requirement 6: Quick Add Home Screen Widget

**User Story:** As a user, I want a home screen widget that lets me quickly create a new chit so that I can capture thoughts without opening the full app.

#### Acceptance Criteria

1. THE App SHALL provide a Quick_Add_Widget implemented via RemoteViews XML that can be placed on the Android home screen.
2. WHEN the user taps the Quick_Add_Widget, THE App SHALL launch the Chit_Editor in create mode for a new chit.
3. THE Quick_Add_Widget SHALL display the CWOC logo and a "+" icon indicating its purpose.
4. THE Quick_Add_Widget SHALL use the CWOC parchment theme colors (background #fffaf0, accent #6b4e31).

### Requirement 7: Today Calendar Home Screen Widget

**User Story:** As a user, I want a home screen widget showing today's calendar items so that I can see my schedule at a glance.

#### Acceptance Criteria

1. THE App SHALL provide a Today_Calendar_Widget implemented via RemoteViews XML that can be placed on the Android home screen.
2. THE Today_Calendar_Widget SHALL display a list of ChitEntity records that have date values matching the current date, sorted by start time.
3. THE Today_Calendar_Widget SHALL show the chit title and time for each item.
4. WHEN the user taps a chit item in the Today_Calendar_Widget, THE App SHALL navigate to the Chit_Editor for that chit.
5. THE Widget_Update_Worker SHALL refresh the Today_Calendar_Widget data at midnight and whenever a sync pull completes that modifies calendar chits.
6. THE Today_Calendar_Widget SHALL display "No events today" when no chits match the current date.

### Requirement 8: Upcoming Tasks Home Screen Widget

**User Story:** As a user, I want a home screen widget showing my upcoming tasks so that I can track what needs doing without opening the app.

#### Acceptance Criteria

1. THE App SHALL provide an Upcoming_Tasks_Widget implemented via RemoteViews XML that can be placed on the Android home screen.
2. THE Upcoming_Tasks_Widget SHALL display up to five non-deleted ChitEntity records with status "ToDo" or "In Progress", sorted by due date ascending.
3. THE Upcoming_Tasks_Widget SHALL show the chit title and due date for each item.
4. WHEN the user taps a task item in the Upcoming_Tasks_Widget, THE App SHALL navigate to the Chit_Editor for that chit.
5. THE Widget_Update_Worker SHALL refresh the Upcoming_Tasks_Widget data whenever a sync pull completes that modifies task chits.
6. THE Upcoming_Tasks_Widget SHALL display "All caught up!" when no tasks match the filter criteria.

### Requirement 9: Pull-to-Refresh

**User Story:** As a user, I want to pull down on any list screen to trigger a manual sync so that I can get the latest data on demand.

#### Acceptance Criteria

1. WHEN the user performs a pull-down gesture at the top of any chit list screen, THE App SHALL initiate a sync pull via the Sync_Pull_Engine.
2. WHILE a pull-to-refresh sync is in progress, THE App SHALL display a loading indicator at the top of the list.
3. WHEN the pull-to-refresh sync completes successfully, THE App SHALL dismiss the loading indicator and update the list with any new or changed data.
4. IF the pull-to-refresh sync fails due to network unavailability, THEN THE App SHALL dismiss the loading indicator and display a brief toast message "Offline — showing cached data".
5. THE App SHALL support pull-to-refresh on the Checklists_View, Projects_View, Alerts_View, Indicators_View, Contact_List_Screen, and all existing Phase 1-3 list screens.

### Requirement 10: Swipe Actions

**User Story:** As a user, I want to swipe chit list items to quickly archive or snooze them so that I can triage my lists efficiently.

#### Acceptance Criteria

1. WHEN the user swipes a Chit_List_Item to the right, THE App SHALL execute an archive Swipe_Action that sets the chit's status to "Complete" and marks the ChitEntity as dirty.
2. WHEN the user swipes a Chit_List_Item to the left, THE App SHALL execute a snooze Swipe_Action that presents a time picker for selecting a snooze duration.
3. WHEN the user selects a snooze duration, THE App SHALL set a reminder alert on the chit for the current time plus the selected duration and mark the ChitEntity as dirty.
4. WHEN an archive or snooze Swipe_Action completes, THE App SHALL display an undo toast for five seconds allowing the user to reverse the action.
5. WHEN the user taps "Undo" on the Swipe_Action toast, THE App SHALL revert the chit to its previous state and clear the dirty flag if no other changes exist.
6. THE App SHALL display a colored background behind the swiped item indicating the action: green with a checkmark icon for archive (right swipe), orange with a clock icon for snooze (left swipe).

### Requirement 11: Boolean Search

**User Story:** As a user, I want to search my chits using boolean operators so that I can find specific items with complex criteria.

#### Acceptance Criteria

1. THE App SHALL provide a search input on the main chit list screen that accepts Boolean_Search queries.
2. THE Boolean_Search SHALL support the AND operator (explicit keyword or space-separated terms) to match chits containing all specified terms.
3. THE Boolean_Search SHALL support the OR operator to match chits containing any of the specified terms.
4. THE Boolean_Search SHALL support the NOT operator (prefix "-" or keyword "NOT") to exclude chits containing the specified term.
5. THE Boolean_Search SHALL support parenthesized grouping to control operator precedence.
6. THE Boolean_Search SHALL search across chit title, note content, tags, and checklist item text fields.
7. WHEN the user types a Boolean_Search query, THE App SHALL filter the displayed chit list in real time as the query changes, with a debounce delay of 300 milliseconds.

### Requirement 12: Recurrence Expansion

**User Story:** As a user, I want recurring chits expanded into individual date instances so that I can see all occurrences on my calendar and task views.

#### Acceptance Criteria

1. THE App SHALL include a Recurrence_Engine implemented in Kotlin that expands recurrence rules into concrete date instances.
2. THE Recurrence_Engine SHALL support daily, weekly, monthly, and yearly recurrence frequencies.
3. THE Recurrence_Engine SHALL support recurrence end conditions: end by date, end after N occurrences, and no end (infinite with a display window).
4. THE Recurrence_Engine SHALL support weekly recurrence with specific days of the week (e.g., every Monday and Wednesday).
5. THE Recurrence_Engine SHALL support monthly recurrence by day of month and by ordinal weekday (e.g., second Tuesday).
6. THE Recurrence_Engine SHALL respect recurrence exceptions stored in the ChitEntity's `recurrence_exceptions` field by excluding those dates from expansion.
7. WHEN the calendar or task views render chits, THE App SHALL use the Recurrence_Engine to generate expanded instances within the visible date range.
8. THE Recurrence_Engine SHALL produce output equivalent to the web app's `shared-recurrence.js` for identical input rules.

### Requirement 13: Animations and Transitions

**User Story:** As a user, I want smooth animations when navigating between screens and interacting with list items so that the app feels polished and responsive.

#### Acceptance Criteria

1. WHEN the user navigates between screens, THE App SHALL apply a shared-element transition or cross-fade animation with a duration between 200 and 350 milliseconds.
2. WHEN a Chit_List_Item is added to a visible list, THE App SHALL animate the item in with a fade-and-slide-up effect.
3. WHEN a Chit_List_Item is removed from a visible list (via archive, delete, or filter change), THE App SHALL animate the item out with a fade-and-slide effect.
4. WHEN the user drags a Kanban card or checklist item, THE App SHALL provide visual feedback including elevation shadow and slight scale increase on the dragged item.
5. WHEN a drag-and-drop operation completes, THE App SHALL animate the dropped item settling into its new position.
6. THE App SHALL use Compose animation APIs (animateContentSize, AnimatedVisibility, animateItemPlacement) for all list and layout transitions.

### Requirement 14: Contact List Screen

**User Story:** As a user, I want a dedicated screen to browse and search my contacts so that I can find and manage contact information on my phone.

#### Acceptance Criteria

1. THE App SHALL provide a Contact_List_Screen accessible from the navigation structure.
2. THE Contact_List_Screen SHALL display all non-deleted contacts from the Room_Database sorted alphabetically by name.
3. THE Contact_List_Screen SHALL provide a search input that filters contacts by name, email, or phone number as the user types.
4. WHEN the user taps a contact in the Contact_List_Screen, THE App SHALL navigate to a contact detail or editor screen for that contact.
5. THE Contact_List_Screen SHALL display an alphabetical section index for quick scrolling to a specific letter.
6. THE Contact_List_Screen SHALL support pull-to-refresh to trigger a sync pull for contact data.
7. WHEN no contacts match the search query, THE Contact_List_Screen SHALL display an empty state message "No contacts found".

### Requirement 15: Bottom Navigation Update

**User Story:** As a user, I want the bottom navigation bar updated to include all C CAPTN views so that I can access every view type from the main screen.

#### Acceptance Criteria

1. THE App SHALL display a bottom navigation bar with tabs for all six C CAPTN views: Calendar, Checklists, Alarms, Projects, Tasks, and Notes.
2. WHEN the user taps a bottom navigation tab, THE App SHALL switch to the corresponding view with an animated transition.
3. THE App SHALL preserve scroll position and filter state when switching between bottom navigation tabs within the same session.
4. THE App SHALL highlight the currently active tab with the primary brown color (#6b4e31) and display inactive tabs in a muted tone.

### Requirement 16: Database Migration (v3 → v4)

**User Story:** As a user upgrading from Phase 3, I want my existing data preserved when the app adds support for new view features.

#### Acceptance Criteria

1. WHEN the App launches with a Room_Database at version 3, THE App SHALL execute a migration to version 4 that adds any new index columns required for efficient Checklists_View, Projects_View, Alerts_View, and Indicators_View queries.
2. THE App SHALL preserve all existing data during the migration from version 3 to version 4.
3. WHEN the migration completes, THE App SHALL verify that all existing ChitEntity, Contact_Entity, and Settings_Entity records remain accessible and intact.

### Requirement 17: Widget Data Refresh

**User Story:** As a user, I want my home screen widgets to stay current so that the information displayed reflects my latest data.

#### Acceptance Criteria

1. THE Widget_Update_Worker SHALL run as a periodic WorkManager job at a minimum interval of 30 minutes to refresh all Home_Widget instances.
2. WHEN a sync pull completes and modifies chit data, THE App SHALL trigger an immediate widget refresh for all active Home_Widget instances.
3. WHEN the user creates, edits, or deletes a chit via the App, THE App SHALL trigger an immediate widget refresh for all active Home_Widget instances.
4. THE Widget_Update_Worker SHALL read data exclusively from the local Room_Database and not make network calls.

### Requirement 18: Osmdroid Configuration

**User Story:** As a developer, I want osmdroid properly configured so that map tiles load reliably and respect OpenStreetMap usage policies.

#### Acceptance Criteria

1. THE App SHALL configure osmdroid with a custom user-agent string identifying the CWOC app and version.
2. THE App SHALL configure osmdroid to cache map tiles locally with a maximum cache size of 100 MB.
3. THE App SHALL request the `INTERNET` and `ACCESS_FINE_LOCATION` permissions in the AndroidManifest for map functionality.
4. WHEN the user grants location permission, THE Map_Screen SHALL display a "my location" button that centers the map on the device's current GPS position.
5. IF the user denies location permission, THEN THE Map_Screen SHALL still function for viewing chit markers without the "my location" feature.
