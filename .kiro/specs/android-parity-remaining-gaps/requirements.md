# Requirements Document

## Introduction

This specification addresses all remaining parity gaps between the CWOC Android mobile app (Kotlin + Jetpack Compose) and the web mobile browser version. These gaps were identified during user verification of the parity checklist and represent the final set of discrepancies preventing full feature parity. The gaps span calendar views, tasks/habits, drag-to-reorder across multiple views, email features, people/contact images, and several standalone screens and modals.

## Glossary

- **Android_App**: The CWOC Android application built with Kotlin and Jetpack Compose, located in `android/app/src/main/java/com/cwoc/app/`
- **Web_App**: The CWOC web application (vanilla JavaScript + HTML + CSS) served by FastAPI, accessed via mobile browser
- **CalendarTimeGrid**: The Compose composable in `CalendarTimeGrid.kt` responsible for rendering timed events in day and week calendar views
- **Point_In_Time_Event**: A calendar event with zero duration (start time equals end time), rendered as a diamond/hexagon shape on the web
- **Snap_Grid**: Visual overlay lines shown during drag operations on the calendar to indicate time snap intervals
- **Masonry_Layout**: A staggered grid layout used for notes and checklists cards where items fill available vertical space
- **Rule_Habit**: A habit automatically tracked by the rules engine based on chit creation/completion patterns
- **Success_Window**: A configurable number of days used to calculate habit success rates
- **Bundle**: An email organizational grouping that collects related emails together
- **Condition_Tree**: A nested AND/OR logical structure used in the rule editor to define complex trigger conditions
- **Coil**: The image loading library already available in `build.gradle.kts` (`io.coil-kt:coil-compose:2.6.0`)
- **osmdroid**: The OpenStreetMap library already available in `build.gradle.kts` (`org.osmdroid:osmdroid-android:6.1.18`)
- **Platform_Limitation**: A gap that cannot be addressed due to hardware or OS constraints on Android touch devices (e.g., no hover state)
- **Dependency_Constraint**: A gap that cannot be addressed because it requires installing new packages not already in `build.gradle.kts`

## Requirements

### Requirement 1: Point-in-Time Event Shape Rendering

**User Story:** As a user, I want point-in-time events on the calendar to render with a diamond/hexagon clip-path shape, so that I can visually distinguish zero-duration events from regular timed events.

#### Acceptance Criteria

1. WHEN a calendar event has zero duration (start time equals end time), THE Android_App SHALL render the event card using a diamond or hexagon clip-path shape matching the web CSS `.timed-event.point-in-time` clip-path
2. THE Android_App SHALL apply the point-in-time shape in the Day view (`DayEventCard` composable)
3. THE Android_App SHALL apply the point-in-time shape in the Week view (`WeekEventChip` composable)
4. THE Android_App SHALL apply the point-in-time shape in the Work Hours view (same `WeekTimeGrid` composable as Week)
5. THE Android_App SHALL apply the point-in-time shape in the X-Day/SevenDay view (same `WeekTimeGrid` composable as Week)
6. WHEN a point-in-time event is rendered with the clip-path shape, THE Android_App SHALL preserve the event title text, color, and tap interaction

### Requirement 2: Birthday Event Concave-Notch Chip Shape

**User Story:** As a user, I want birthday events on the week calendar to render with a concave-notch chip shape, so that I can visually distinguish birthday events from other all-day events.

#### Acceptance Criteria

1. WHEN a calendar event is a birthday event, THE Android_App SHALL render the all-day chip using a concave-notch clip-path shape matching the web CSS `.birthday-chip` clip-path
2. THE Android_App SHALL apply the birthday chip shape in the Week view (`AllDayEventChip` composable)
3. THE Android_App SHALL apply the birthday chip shape in the Work Hours view (same composable)
4. THE Android_App SHALL apply the birthday chip shape in the X-Day/SevenDay view (same composable)
5. WHEN a birthday chip is rendered with the concave-notch shape, THE Android_App SHALL display the birthday cake icon and contact name matching the web rendering from `calendarEventTitle()` birthday branch

### Requirement 3: Snap Grid Visual Overlay During Drag

**User Story:** As a user, I want to see visual grid lines during calendar event drag operations, so that I can accurately position events at snap intervals.

#### Acceptance Criteria

1. WHEN a user begins dragging a calendar event, THE Android_App SHALL display horizontal overlay lines at each snap interval across the time grid
2. WHILE a drag operation is in progress, THE Android_App SHALL keep the snap grid lines visible
3. WHEN the user releases the drag, THE Android_App SHALL hide the snap grid overlay lines
4. THE Android_App SHALL render snap grid lines in the Day view during drag operations
5. THE Android_App SHALL render snap grid lines in the Week view during drag operations
6. THE Android_App SHALL render snap grid lines in the Work Hours view during drag operations
7. THE Android_App SHALL render snap grid lines in the X-Day/SevenDay view during drag operations
8. THE Android_App SHALL use the configured snap interval (from settings) to determine line spacing

### Requirement 4: Week View Horizontal Drag Between Day Columns

**User Story:** As a user, I want to drag events horizontally between day columns in the week calendar view, so that I can move events to a different day without opening the editor.

#### Acceptance Criteria

1. WHEN a user drags a `WeekEventChip` horizontally past a day column boundary, THE Android_App SHALL detect the target day column
2. WHEN the drag crosses into a different day column, THE Android_App SHALL visually indicate the target day (e.g., highlight the column)
3. WHEN the user releases the drag in a different day column, THE Android_App SHALL update the event date to the target day while preserving the event time
4. THE Android_App SHALL support horizontal drag in the Week view
5. THE Android_App SHALL support horizontal drag in the Work Hours view
6. THE Android_App SHALL support horizontal drag in the X-Day/SevenDay view
7. WHEN a user drags both horizontally and vertically simultaneously, THE Android_App SHALL update both the date (column) and time (vertical position)

### Requirement 5: Profile Images on People Chips (Tasks View)

**User Story:** As a user, I want to see contact profile images on people chips in the Tasks view, so that I can quickly identify assigned people visually.

#### Acceptance Criteria

1. WHEN a chit has assigned people with profile images, THE Android_App SHALL display the contact image in the `PeopleChipsRow` composable on task cards
2. WHEN a contact has no profile image, THE Android_App SHALL fall back to displaying text initials
3. THE Android_App SHALL load profile images using the Coil image loading library (already in dependencies)
4. THE Android_App SHALL display profile images as circular thumbnails matching the web rendering in `_buildChitHeader()` people section

### Requirement 6: Rule Habits from API

**User Story:** As a user, I want to see rule-based habits in the Tasks Habits sub-mode, so that I can track automatically-generated habits alongside manual ones.

#### Acceptance Criteria

1. THE Android_App SHALL fetch rule habits from the API endpoint used by the web app's `_fetchAndRenderRuleHabits()`
2. THE Android_App SHALL display rule habits in a dedicated section within the `HabitsView` composable
3. THE Android_App SHALL render each rule habit with its name, success rate, and streak information matching the web rendering
4. WHEN no rule habits exist, THE Android_App SHALL hide the rule habits section

### Requirement 7: Aggregate Habits Success Rate Bar

**User Story:** As a user, I want to see a combined success rate bar that includes both manual and rule habits, so that I can see my overall habit performance at a glance.

#### Acceptance Criteria

1. THE Android_App SHALL calculate an aggregate success rate combining both chit-based habits and rule habits
2. THE Android_App SHALL display the aggregate success rate as a visual bar in the `HabitsView` composable matching the web rendering
3. WHEN only chit-based habits exist (no rule habits), THE Android_App SHALL display the aggregate bar using only chit habit data
4. WHEN only rule habits exist (no chit habits), THE Android_App SHALL display the aggregate bar using only rule habit data

### Requirement 8: Habits Success Window Setting

**User Story:** As a user, I want the habits view to respect my configured success window setting, so that habit success rates are calculated over my preferred time period.

#### Acceptance Criteria

1. THE Android_App SHALL read the `habits_success_window` value from user settings
2. WHEN calculating habit success rates, THE Android_App SHALL use the `habits_success_window` value as the number of days to evaluate
3. WHEN the `habits_success_window` setting changes, THE Android_App SHALL recalculate displayed success rates using the new window

### Requirement 9: Masonry Drag-to-Reorder for Checklists

**User Story:** As a user, I want to drag checklist cards to reorder them in the masonry layout, so that I can organize my checklists in my preferred order.

#### Acceptance Criteria

1. WHEN a user long-presses a checklist card in the staggered grid, THE Android_App SHALL enter drag-to-reorder mode
2. WHILE dragging a checklist card, THE Android_App SHALL show a visual indicator of the card being moved (elevation, opacity change)
3. WHEN the user drops the card at a new position, THE Android_App SHALL persist the new sort order via the API
4. THE Android_App SHALL implement drag-to-reorder within the Compose `StaggeredGrid` or `LazyStaggeredGrid` layout without requiring new library dependencies

### Requirement 10: Masonry Drag-to-Reorder for Notes

**User Story:** As a user, I want to drag note cards to reorder them in the masonry layout, so that I can organize my notes in my preferred order.

#### Acceptance Criteria

1. WHEN a user long-presses a note card in the staggered grid, THE Android_App SHALL enter drag-to-reorder mode
2. WHILE dragging a note card, THE Android_App SHALL show a visual indicator of the card being moved (elevation, opacity change)
3. WHEN the user drops the card at a new position, THE Android_App SHALL persist the new sort order via the API
4. THE Android_App SHALL implement drag-to-reorder within the Compose `StaggeredGrid` or `LazyStaggeredGrid` layout without requiring new library dependencies

### Requirement 11: Projects Drag-to-Reorder

**User Story:** As a user, I want to drag project cards to reorder them, so that I can organize my projects in my preferred order.

#### Acceptance Criteria

1. WHEN a user long-presses a project card, THE Android_App SHALL enter drag-to-reorder mode
2. WHILE dragging a project card, THE Android_App SHALL show a visual indicator of the card being moved
3. WHEN the user drops the card at a new position, THE Android_App SHALL persist the new sort order via the API
4. THE Android_App SHALL implement drag-to-reorder using Compose gesture APIs without requiring new library dependencies

### Requirement 12: Email Contact Image Lookup

**User Story:** As a user, I want to see contact profile images in email cards, so that I can quickly identify senders visually.

#### Acceptance Criteria

1. WHEN an email card is rendered and the sender matches a contact with a profile image, THE Android_App SHALL display the contact image as an avatar
2. THE Android_App SHALL implement a contact-by-email repository method to look up contacts by email address
3. THE Android_App SHALL cache contact image lookups to avoid repeated queries for the same email address
4. WHEN no matching contact image is found, THE Android_App SHALL fall back to displaying initials or a default avatar

### Requirement 13: Email Bundle Tab Drag-to-Reorder

**User Story:** As a user, I want to drag email bundle tabs to reorder them, so that I can arrange my bundles in my preferred order.

#### Acceptance Criteria

1. WHEN a user long-presses a bundle tab in the scrollable tab row, THE Android_App SHALL enter drag-to-reorder mode
2. WHILE dragging a bundle tab, THE Android_App SHALL show a visual indicator of the tab being moved
3. WHEN the user drops the tab at a new position, THE Android_App SHALL persist the new bundle order via the API
4. THE Android_App SHALL implement the drag gesture on the scrollable tab row using Compose gesture APIs without new dependencies

### Requirement 14: Email Attachment Tap-to-Preview

**User Story:** As a user, I want to tap email attachments to preview them inline, so that I can view attached files without leaving the email screen.

#### Acceptance Criteria

1. WHEN a user taps an email attachment, THE Android_App SHALL open a file preview modal
2. THE Android_App SHALL support preview for common MIME types: images (JPEG, PNG, GIF), PDF, and plain text
3. WHEN the attachment MIME type is not supported for inline preview, THE Android_App SHALL offer to open the file with an external application via Android Intent
4. THE Android_App SHALL display the attachment filename, size, and type in the preview modal header

### Requirement 15: Email "Add to Bundle" Context Menu Action

**User Story:** As a user, I want an "Add to Bundle" option in the email context menu, so that I can quickly organize emails into bundles.

#### Acceptance Criteria

1. WHEN a user opens the context menu on an email card, THE Android_App SHALL include an "Add to Bundle" action
2. WHEN the user selects "Add to Bundle", THE Android_App SHALL display a bundle selection picker showing all available bundles
3. WHEN the user selects a bundle from the picker, THE Android_App SHALL add the email to that bundle via the API
4. WHEN the email is already in a bundle, THE Android_App SHALL indicate the current bundle in the picker

### Requirement 16: Profile Images on People Chips (Editor People Zone)

**User Story:** As a user, I want to see contact profile images on people chips in the chit editor People zone, so that I can visually confirm the correct contacts are assigned.

#### Acceptance Criteria

1. WHEN a contact with a profile image is added to the People zone, THE Android_App SHALL display the contact image in the people chip
2. THE Android_App SHALL pass image URLs through the composable chain from data layer to `PeopleZone` UI
3. WHEN a contact has no profile image, THE Android_App SHALL fall back to displaying text initials
4. THE Android_App SHALL load profile images using the Coil image loading library (already in dependencies)

### Requirement 17: Full-Field Search in People Zone

**User Story:** As a user, I want the People zone search to search across all contact fields, so that I can find contacts by any piece of information (phone, email, address, notes) not just name.

#### Acceptance Criteria

1. WHEN a user types in the People zone search field, THE Android_App SHALL search across all contact fields (name, email, phone, address, organization, notes)
2. THE Android_App SHALL expand the contact data model to include all searchable fields in the search query
3. THE Android_App SHALL display matching contacts regardless of which field matched the search term
4. THE Android_App SHALL match the web behavior from `editor-people.js` which searches across all contact fields

### Requirement 18: Contact Editor Address Map Preview

**User Story:** As a user, I want to see an inline map preview of a contact's address in the contact editor, so that I can visually confirm the location without leaving the editor.

#### Acceptance Criteria

1. WHEN a contact has an address with geocoded coordinates, THE Android_App SHALL display an inline map preview using osmdroid (already in dependencies)
2. THE Android_App SHALL render the map as an embedded `MapView` composable within the contact editor address section
3. THE Android_App SHALL place a marker on the map at the contact's geocoded coordinates
4. WHEN the user taps the map preview, THE Android_App SHALL open the full maps application (existing "Open in Maps" behavior preserved as secondary action)
5. WHEN a contact has no geocoded coordinates for the address, THE Android_App SHALL hide the map preview

### Requirement 19: Rule Editor Condition Tree Builder

**User Story:** As a user, I want to build nested AND/OR condition trees in the rule editor, so that I can create complex trigger conditions matching the web app's rule editor capabilities.

#### Acceptance Criteria

1. THE Android_App SHALL render condition groups as nested visual blocks showing AND/OR logical operators
2. WHEN a user taps "Add Condition", THE Android_App SHALL add a new condition to the current group
3. WHEN a user taps "Add Group", THE Android_App SHALL create a nested condition group with its own AND/OR toggle
4. THE Android_App SHALL allow toggling between AND and OR for each condition group
5. THE Android_App SHALL allow removing individual conditions and entire groups
6. THE Android_App SHALL support arbitrary nesting depth matching the web recursive condition tree UI
7. WHEN saving a rule, THE Android_App SHALL serialize the condition tree to the same JSON structure used by the web app and API

### Requirement 20: Clock Modal Analog Face Rendering

**User Story:** As a user, I want to see an analog clock face in the clock modal, so that the clock display matches the web app's visual presentation.

#### Acceptance Criteria

1. THE Android_App SHALL render an analog clock face using Compose Canvas drawing APIs
2. THE Android_App SHALL draw hour markers, minute markers, hour hand, minute hand, and second hand
3. THE Android_App SHALL animate the second hand in real-time
4. THE Android_App SHALL match the visual style of the web canvas-drawn analog face (colors, proportions, line weights)
5. THE Android_App SHALL display the analog clock face alongside or above the existing digital time display

### Requirement 21: Weather as Overlay Modal

**User Story:** As a user, I want weather to appear as an overlay modal on the dashboard, so that I can check weather without navigating away from my current view.

#### Acceptance Criteria

1. WHEN the user triggers the weather action from the dashboard, THE Android_App SHALL display weather information as a modal overlay rather than navigating to a full-screen destination
2. THE Android_App SHALL render the weather modal with current conditions, forecast, and location information matching the web modal content
3. WHEN the user dismisses the modal (tap outside, back gesture, or close button), THE Android_App SHALL return to the dashboard view without navigation
4. THE Android_App SHALL preserve the existing full-screen weather page as accessible from other navigation paths (e.g., sidebar)

### Requirement 22: Platform Limitations Documentation (Tooltips on Hover)

**User Story:** As a developer, I want platform limitations formally documented, so that the parity checklist accurately reflects what cannot be implemented on Android.

#### Acceptance Criteria

1. THE Android_App SHALL NOT implement hover tooltips for calendar events (checklist items 1.3, 2.5, 3.5, 4.5) because Android touch devices have no hover state
2. THE Android_App documentation SHALL record these items as platform limitations that are inherent to touch-based devices

### Requirement 23: Dependency Constraint Documentation (Marker Clustering)

**User Story:** As a developer, I want dependency constraints formally documented, so that the parity checklist accurately reflects what is blocked by project rules.

#### Acceptance Criteria

1. THE Android_App SHALL NOT implement marker clustering on the Maps screen (checklist item 44.1) because it requires the osmdroid-bonuspack dependency which is not in `build.gradle.kts`
2. THE Android_App documentation SHALL record this item as blocked by the project constraint against installing new dependencies
