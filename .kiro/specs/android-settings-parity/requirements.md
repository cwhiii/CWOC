# Requirements Document

## Introduction

This document specifies the requirements for achieving complete feature parity between the CWOC Android app's Settings screen and the web Settings page. The web implementation (settings.html + settings.js and related modules) is the authoritative reference. The Android app currently implements approximately 22% of settings functionality fully, with 49% missing entirely and 9% partially implemented. This spec covers every gap — every missing field, every mismatched option set, every absent modal, and every behavioral difference — to bring the Android Settings to 100% parity with web.

## Glossary

- **Settings_Screen**: The Android Jetpack Compose screen that hosts all settings tabs and provides save/navigation functionality
- **General_Tab**: The first settings tab containing general preferences, clocks, timezone, display options, chit options, visual indicators, and custom filters
- **Views_Tab**: The second settings tab containing Omni View, Calendar, Habits, Projects, and Maps configuration
- **Collections_Tab**: The third settings tab containing Tag Editor, Custom Colors, Saved Locations, and Default Notifications
- **Email_Tab**: The fourth settings tab containing email accounts, syncing, privacy, sending, display, bundles, and badges configuration
- **Admin_Tab**: The fifth settings tab (admin-only) containing administration, tools, data management, dependent apps, and version/updates sections
- **Settings_API**: The backend REST endpoint at `/api/settings` that persists and retrieves all user settings
- **Pill_Toggle**: A two-value segmented button control for binary choices (equivalent to web's `cwoc-2val-toggle`)
- **Dirty_Tracking**: The mechanism that detects unsaved changes and prompts the user before navigating away
- **Drag_Grid**: A grid of draggable items that can be reordered by touch-and-hold drag gestures
- **HST**: Hexadecimal Standard Time — a metric time format dividing the day into 1000 units
- **Omni_View**: The dashboard overview combining multiple data sources into a configurable layout
- **Bundle**: An email categorization group that automatically classifies emails by rules
- **Badge_Detector**: A pattern matcher that identifies actionable items in emails (tracking numbers, flights, etc.)
- **Kiosk_Mode**: A display mode showing only selected tag content, suitable for wall-mounted displays
- **Ntfy**: A push notification service used to deliver alerts to mobile devices
- **Tailscale**: A mesh VPN service enabling remote access to the CWOC server
- **Home_Assistant**: A home automation platform integrated with CWOC for bidirectional event communication

## Requirements

### Requirement 1: Save Mechanism Parity

**User Story:** As a user, I want the Android settings to have Save & Stay, Save & Exit, and unsaved changes detection, so that I never lose changes accidentally.

#### Acceptance Criteria

1. WHEN the Settings_Screen loads with no pending modifications, THE Settings_Screen SHALL display a disabled "Saved" indicator button and SHALL hide the "Save & Stay" and "Save & Exit" buttons
2. WHEN any setting value is modified from its last-saved state, THE Settings_Screen SHALL hide the "Saved" indicator, display an enabled "Save & Stay" button, display an enabled "Save & Exit" button, and change the exit button label to "Discard Changes"
3. WHEN the user taps "Save & Stay", THE Settings_Screen SHALL persist all modified settings to the server and, upon receiving a successful response, return the buttons to the disabled "Saved" state without navigating away from the screen
4. WHEN the user taps "Save & Exit", THE Settings_Screen SHALL persist all modified settings to the server and, upon receiving a successful response, navigate to the previous screen (the screen from which the user entered Settings)
5. IF a save operation fails due to a network or server error, THEN THE Settings_Screen SHALL display an error message indicating the save failed, retain all unsaved form values, and keep the save buttons in the enabled "unsaved" state
6. WHEN the user attempts to navigate away from the Settings_Screen (via system back button, back gesture, or toolbar back arrow) while modifications exist, THE Settings_Screen SHALL display a confirmation dialog offering three options: Save (persists changes then navigates back), Discard (abandons changes and navigates back), and Cancel (dismisses the dialog and remains on the Settings_Screen)
7. WHEN all current form values match the last-saved state (including after a successful save or after the user reverts a change manually), THE Settings_Screen SHALL return the buttons to the disabled "Saved" state and restore the exit button label to "Exit"

### Requirement 2: General Tab — General Section Corrections

**User Story:** As a user, I want the General section options to exactly match the web version, so that I have the same configuration choices on both platforms.

#### Acceptance Criteria

1. THE General_Tab SHALL display the Sex setting as a 2-value pill toggle with options "♂ Man" and "♀ Woman", replacing the current "Male"/"Female" labels
2. THE General_Tab SHALL display the Snooze Length setting as a dropdown with exactly four options: 1 min, 3 min, 5 min, and 10 min, replacing the current 5/10/15/30/60 min option set
3. THE General_Tab SHALL display the Calendar Snap setting as a dropdown with exactly eight options in this order: None, 5 min, 10 min, 15 min, 20 min, 25 min, 30 min, and 60 min, where "None" corresponds to a stored value of 0
4. IF a previously-saved Snooze Length or Calendar Snap value does not match any option in the corrected dropdown, THEN THE General_Tab SHALL default the displayed selection to the nearest valid option that is less than or equal to the stored value, or to the first option if no valid option is less than or equal

### Requirement 3: General Tab — Contact Vault Section

**User Story:** As a user, I want to configure default contact sharing behavior on Android, so that new contacts are shared to the vault by default when enabled.

#### Acceptance Criteria

1. THE General_Tab SHALL display a "🏛️ Contact Vault" section containing a "Default share new contacts" label paired with a toggle switch (checkbox styled as a slider)
2. THE General_Tab SHALL display hint text below the toggle stating: "When enabled, new contacts will be shared to the vault by default (visible to all users)."
3. WHEN the settings are loaded from the server, THE General_Tab SHALL set the toggle to ON if the `default_share_contacts` setting value is "1", and OFF otherwise
4. WHEN the toggle is changed, THE Settings_Screen SHALL mark the form as dirty
5. WHEN the user saves settings, THE Settings_Screen SHALL persist the toggle value as "1" (checked) or "0" (unchecked) in the `default_share_contacts` field of the settings payload

### Requirement 4: General Tab — Clocks Section

**User Story:** As a user, I want to configure world clocks on Android with the same options as web including HST, drag-reorder grid, and orientation toggle, so that I can customize my clock display identically.

#### Acceptance Criteria

1. THE General_Tab SHALL display a Time Format dropdown selector with three options: "24 Hour" (value: 24hour), "12 Hour" (value: 12hour), and "HST" (value: metric), which controls how times are displayed throughout the app
2. THE General_Tab SHALL display an "Orientation" button that toggles the clocks container between horizontal layout (active grid above inactive zone, default) and vertical layout (active grid and inactive zone side by side)
3. THE General_Tab SHALL display an Active Clocks grid showing currently enabled clocks as draggable items that can be reordered within the grid, supporting up to 4 clock types: "24 Hour", "HST", "12 Hour", and "12 Hour Analog"
4. THE General_Tab SHALL display an Inactive Clocks zone showing disabled clock types as draggable items, labeled "Inactive Clocks"
5. THE General_Tab SHALL allow clocks to be dragged between the Active grid and Inactive zone to enable or disable them, and allow reordering within the Active grid by dragging items to swap positions
6. IF the Active Clocks grid contains zero clocks, THEN THE General_Tab SHALL display an "Add Clock" button within the empty grid that, when tapped, moves the first available clock from the Inactive zone into the Active grid
7. WHEN clocks are reordered, moved between zones, or the orientation is toggled, THE Settings_Screen SHALL mark the form as dirty

### Requirement 5: General Tab — Timezone Section

**User Story:** As a user, I want to set both a default timezone and a current override on Android, so that I can control timezone behavior when traveling.

#### Acceptance Criteria

1. THE General_Tab SHALL display a "Current Override" timezone text input field with autocomplete suggestions populated from the IANA timezone database (via `Intl.supportedValuesOf('timeZone')`), positioned below the existing Default Timezone field within the Timezone subsection
2. THE General_Tab SHALL display a "✕ Clear Override" button below the Current Override field that sets the override field value to empty and marks settings as unsaved
3. THE General_Tab SHALL display hint text below the Current Override field stating that the override replaces the auto-detected timezone and that leaving it empty uses browser/device detection
4. IF the user attempts to save settings with a non-empty Current Override value that is not a valid IANA timezone name, THEN THE General_Tab SHALL display an error toast indicating the timezone is not recognized and SHALL prevent the save operation

### Requirement 6: General Tab — Display Options Section

**User Story:** As a user, I want the full set of display options on Android including all landing view choices, arrange views with hidden zone, and sort reset, so that I can configure my dashboard identically to web.

#### Acceptance Criteria

1. THE General_Tab SHALL display the Landing View dropdown with options: Omni, Calendar, Checklists, Alerts, Projects, Tasks, Notes, Email, and Indicators, with a hint indicating the selection applies only on fresh app open and not when returning from the editor or other pages
2. WHEN the user taps the "Arrange Views" button, THE General_Tab SHALL open a modal titled "Arrange Views" containing a visible tabs zone with drag-to-reorder functionality, a "Hidden" zone where tabs can be dragged to hide them, and three buttons: Cancel (reverts changes), Reset to Default (restores default order), and Done (applies the new order)
3. THE Arrange Views modal SHALL display Omni as a fixed non-draggable first item in the visible zone, followed by draggable items for each non-hidden view, and SHALL display the Hidden zone with placeholder text "Drag tabs here to hide them" when empty
4. WHEN the user taps "Reset All Sort Orders", THE General_Tab SHALL display a danger confirmation dialog stating that all saved sort preferences and manual item ordering for every view will be cleared, and SHALL only execute the reset if the user confirms
5. IF the sort order reset is confirmed, THEN THE System SHALL clear all saved sort preferences and manual drag-to-reorder positioning for every view and display a success notification indicating all sort orders have been reset

### Requirement 7: General Tab — Chit Options Section

**User Story:** As a user, I want all 11 chit option checkboxes on Android, so that I can control chit display behavior identically to web.

#### Acceptance Criteria

1. THE General_Tab SHALL display a "Chit Options" section containing 11 checkboxes in the following order: "Checklist Auto-Save", "Auto-save on Desktop", "Auto-save on Mobile", "Fade Past Chits", "Highlight Overdue", "Highlight Blocked", "Delete Past Alarms", "Show Tab Counts", "Prefer Google for Maps", "Show Map Thumbnails", "Hide declined chits"
2. WHEN the Settings_Screen loads, THE General_Tab SHALL initialize "Fade Past Chits", "Highlight Overdue", and "Highlight Blocked" as checked by default (when no prior saved value exists), and initialize the remaining 8 checkboxes as unchecked by default
3. WHEN the Settings_Screen loads with previously saved settings, THE General_Tab SHALL restore each checkbox to its last saved state
4. WHEN any checkbox in the Chit Options section is toggled, THE Settings_Screen SHALL mark the form as dirty by enabling the Save button
5. WHEN the user saves settings, THE Settings_Screen SHALL persist the state of all 11 checkboxes to the server via the settings API as part of the chit_options object (fade_past_chits, highlight_overdue_chits, highlight_blocked_chits, delete_past_alarm_chits, show_tab_counts, prefer_google_maps) and top-level fields (checklist_autosave, show_map_thumbnails, hide_declined) and the two auto-save fields (auto_save_desktop, auto_save_mobile)

### Requirement 8: General Tab — Visual Indicators Section

**User Story:** As a user, I want to configure which visual indicators appear on chit cards and their display conditions on Android, so that I can control information density identically to web.

#### Acceptance Criteria

1. THE General_Tab SHALL display a "Visual Indicators" subsection containing a "Combine Alerts" checkbox (unchecked by default) followed by indicator configuration rows in this order: Alarm, Notification, Timer, Stopwatch, Combined Alerts, Weather, People, Indicators, Custom Data
2. EACH indicator configuration row SHALL display the indicator label with its icon and a three-option selector with values "Always", "Never", and "If Space", defaulting to "Always"
3. WHEN "Combine Alerts" is checked, THE General_Tab SHALL hide the individual Alarm, Notification, Timer, and Stopwatch rows and show the Combined Alerts row
4. WHEN "Combine Alerts" is unchecked, THE General_Tab SHALL show the individual Alarm, Notification, Timer, and Stopwatch rows and hide the Combined Alerts row
5. WHEN the user saves settings, THE General_Tab SHALL persist all indicator selector values and the Combine Alerts checkbox state to the visual_indicators settings object, and restore them on next load

### Requirement 9: General Tab — Custom Filters Section

**User Story:** As a user, I want to configure per-view custom default filters on Android, so that I can set which filters auto-apply when opening each view.

#### Acceptance Criteria

1. THE General_Tab SHALL display a "Custom Filters & Sorting" section with a button for each of the 9 views: Omni, Calendar, Checklists, Tasks, Projects, Notes, Email, Indicators, and Alarms
2. WHEN a view filter button is tapped, THE General_Tab SHALL open a modal titled "[ViewName] — Custom Filters & Sort" containing filter controls organized into collapsible groups: Filter Text (free-text input), Sort (field selector with options: Title, Due Date, Start Date, Created, Modified, Priority, Status, Manual, Random, Upcoming; and direction: Asc/Desc), Status (multi-select: ToDo, In Progress, Blocked, Complete, Rejected), Priority (multi-select: Low, Medium, High), Tags (multi-select populated from user's tag list), People (multi-select populated from contacts), Project (single-select dropdown of project masters), and Display (toggle checkboxes for: Pinned, Archived, Snoozed, Unmarked, Past-Due, Complete, Declined, Habits, Email Received, Email Sent, Shared with me, Shared by me)
3. THE filter modal SHALL have a "Done" button that saves the current selections as the custom filter for that view, a "Cancel" button that discards changes and closes the modal, and a "Reset to Defaults" button that clears all custom filter state for that view back to system defaults
4. IF the user taps "Done" and the filter state matches system defaults (no text, no sort field, no statuses selected, no priorities selected, no tags selected, no people selected, no project selected, and all display toggles at their default values), THEN THE General_Tab SHALL remove the custom filter entry for that view rather than storing a redundant default state
5. THE General_Tab SHALL display a status indicator next to each view button showing "Custom" with a check icon when a custom filter is saved for that view, or "Default" with a neutral icon when no custom filter is configured
6. WHEN the user taps "Done" on the filter modal, THE General_Tab SHALL mark the settings as unsaved, requiring the user to save settings to persist the custom filter configuration

### Requirement 10: Views Tab — Omni View Section

**User Story:** As a user, I want to configure the Omni View layout, color mode, bundle toggles, and locked filters on Android, so that my Omni View displays identically to web.

#### Acceptance Criteria

1. THE Views_Tab SHALL display an "HST Bar Clock" selector with options: "Both (System + HST)", "HST Only", and "System Time Only"
2. THE Views_Tab SHALL display an "Arrange Omni Layout" button that opens a layout configurator modal
3. WHEN the layout configurator modal is open, THE modal SHALL display all Omni View sections (HST, Weather, Chrono Anchored, Reminders, On Deck, Soon, Email, Pinned Notes, Pinned Checklists, Pinned All) as draggable cards that can be moved between Full Width, Left Column, Right Column, and Unused zones
4. THE Views_Tab SHALL display "Bundle Omni View Toggles" as a checkbox list of email bundles currently configured in the user's email settings, each toggling that bundle's visibility in Omni View
5. THE Views_Tab SHALL display an "Emails to show" dropdown with options: 3, 5, 10, 15, 20
6. THE Views_Tab SHALL display a "Color mode" selector with options: Colored, Normalized, Mono
7. THE Views_Tab SHALL display the current "Locked Filter Defaults" as a text summary listing each locked filter name, or display "None" when no filters are locked
8. IF no locked filters are currently set, THEN THE Views_Tab SHALL display the "Clear Defaults" button in a disabled state
9. THE Views_Tab SHALL display a "Clear Defaults" button that, when tapped, removes all locked filters and updates the displayed text to "None"
10. WHEN the user taps "Reset Omni View to Defaults", THE Views_Tab SHALL present a confirmation dialog before restoring all Omni View settings (layout, color mode, HST clock mode, bundle toggles, emails-to-show count, and locked filters) to their default values
11. WHEN any Omni View setting is changed, THE Views_Tab SHALL persist the change via the settings sync mechanism so it takes effect on the Omni View immediately

### Requirement 11: Views Tab — Calendar Section Corrections

**User Story:** As a user, I want the full calendar configuration on Android including all 7 week-start days, view hours, scroll-to hour, X-days count, and work hours, so that my calendar behaves identically to web.

#### Acceptance Criteria

1. THE Views_Tab SHALL display the "Week Starts On" dropdown with all 7 days: Sun, Mon, Tue, Wed, Thu, Fri, Sat
2. THE Views_Tab SHALL display "View Hours" start and end dropdowns each listing hours 00:00 through 23:00 in 1-hour increments for configuring the visible hour range in Day/Week/X-Days views
3. IF the selected View Hours start value is greater than or equal to the selected end value, THEN THE Views_Tab SHALL prevent saving and display an error message indicating that the start hour must be earlier than the end hour
4. THE Views_Tab SHALL display a "Scroll to" hour dropdown listing values 00:00 through 12:00 in 1-hour increments controlling the initial scroll position when opening a Day/Week/X-Days view
5. IF the X Days period checkbox is enabled, THEN THE Views_Tab SHALL display an "X Days Count" number input accepting integer values from 2 to 30
6. THE Views_Tab SHALL display a "Work Hours" checkbox that enables work hour configuration
7. IF Work Hours is enabled, THEN THE Views_Tab SHALL display work day checkboxes (Sun through Sat) and work hour start/end dropdowns each listing hours 00:00 through 23:00 in 1-hour increments
8. IF the selected Work Hours start value is greater than or equal to the selected end value, THEN THE Views_Tab SHALL prevent saving and display an error message indicating that the work start hour must be earlier than the work end hour

### Requirement 12: Views Tab — Habits Section

**User Story:** As a user, I want to configure habit success rate window and default calendar visibility on Android, so that habits behave identically to web.

#### Acceptance Criteria

1. THE Views_Tab SHALL display a "Success rate window" dropdown with options: Last 7 days (value: 7), Last 30 days (value: 30), Last 90 days (value: 90), All time (value: all), defaulting to "Last 30 days" when no prior value is stored
2. THE Views_Tab SHALL display a "Default: show habits on calendar" checkbox that defaults to checked when no prior value is stored
3. THE Views_Tab SHALL display hint text below the calendar visibility checkbox stating: "When checked, new habits will appear on the calendar by default. Each habit can override this in its editor."
4. WHEN the user changes the success rate window or calendar visibility checkbox, THE Views_Tab SHALL include the updated values in the settings save payload as `habits_success_window` and `default_show_habits_on_calendar` (stored as "1" for checked, "0" for unchecked)

### Requirement 13: Views Tab — Projects Section

**User Story:** As a user, I want to configure project display options on Android, so that project masters show the same information as web.

#### Acceptance Criteria

1. THE Views_Tab SHALL display a "Show child chit count on project masters" checkbox that is unchecked by default and maps to the `projects_show_child_count` setting (stored as '1' when checked, '0' when unchecked)
2. THE Views_Tab SHALL display a "Show aggregate checklist progress on project masters" checkbox that is unchecked by default and maps to the `projects_show_checklist_count` setting (stored as '1' when checked, '0' when unchecked)
3. THE Views_Tab SHALL display hint text below the project checkboxes stating that these options control the progress counters displayed on project master headers in the dashboard
4. WHEN the user toggles either project checkbox, THE Views_Tab SHALL mark the settings as unsaved and persist the new values through the standard settings sync mechanism

### Requirement 14: Views Tab — Maps Section

**User Story:** As a user, I want to configure map defaults on Android including auto-zoom and default coordinates, so that the maps view initializes identically to web.

#### Acceptance Criteria

1. THE Views_Tab SHALL display an "Auto-zoom to markers on load" checkbox that is checked by default
2. THE Views_Tab SHALL display a "Default Latitude" number input that accepts decimal values in the range -90 to 90
3. THE Views_Tab SHALL display a "Default Longitude" number input that accepts decimal values in the range -180 to 180
4. THE Views_Tab SHALL display a "Default Zoom (1-18)" number input that accepts integer values in the range 1 to 18
5. WHILE auto-zoom is enabled, THE Views_Tab SHALL display the default coordinate and zoom inputs in a visually disabled state (reduced opacity, non-interactive) to indicate they serve as fallback when no markers exist
6. WHILE auto-zoom is disabled, THE Views_Tab SHALL display the default coordinate and zoom inputs in an enabled, interactive state
7. IF a latitude value outside -90 to 90, a longitude value outside -180 to 180, or a zoom value outside 1 to 18 is present at save time, THEN THE Views_Tab SHALL clear the invalid field value to empty before persisting

### Requirement 15: Collections Tab — Tag Editor Enhancements

**User Story:** As a user, I want the tag editor on Android to support hierarchical display, favorites, sharing, font color, and preview, so that tag management is identical to web.

#### Acceptance Criteria

1. THE Collections_Tab SHALL display tags in a hierarchical tree structure where the `/` character in a tag name denotes parent-child relationships, with child tags indented under their parent and each parent node having an expand/collapse toggle
2. THE tag edit dialog SHALL display a favorite star toggle (☆/★) for marking tags as favorites, and WHEN a tag is marked as favorite, THE Collections_Tab SHALL pin that tag to the top of the tag list and sidebar filter lists
3. THE tag edit dialog SHALL display a "Sharing" section with a user picker dropdown listing all users on the instance, a role selector with options "Viewer" and "Manager", and a Share button that persists the share and adds the user to the current shares list
4. THE tag edit dialog SHALL display the list of current shares with each user's name, role badge, and a remove button that immediately removes the share without a separate confirmation dialog
5. THE tag edit dialog SHALL display a "Font Color" picker section with preset color swatches matching the background color swatch set, defaulting to the tag's current font color or #5c3317 if none is set
6. THE tag edit dialog SHALL display a preview chip showing the tag name rendered with the currently selected background color and font color, updating within 100 milliseconds of any color selection change
7. THE tag edit dialog SHALL support a free-form hex color input field accepting a 6-character hexadecimal value (with or without leading `#`) for both background and font colors, and IF the entered value is not a valid 6-character hex color, THEN THE tag edit dialog SHALL display an error indication and not apply the invalid color

### Requirement 16: Collections Tab — Custom Colors Enhancements

**User Story:** As a user, I want to assign border colors for overdue and blocked indicators on Android, so that chit card borders match web behavior.

#### Acceptance Criteria

1. WHEN a custom or default color swatch is tapped, THE Collections_Tab SHALL display a popup offering "Overdue Border", "Blocked Border", and "Cancel" options, where "Overdue Border" is visible only if the highlight-overdue setting is enabled and "Blocked Border" is visible only if the highlight-blocked setting is enabled
2. WHEN a color is selected as the overdue border via the popup, THE Collections_Tab SHALL display a visible ring outline (minimum 2dp width) around that swatch using the overdue border color, with a text label reading "Overdue"
3. WHEN a color is selected as the blocked border via the popup, THE Collections_Tab SHALL display a visible ring outline (minimum 2dp width) around that swatch using the blocked border color, with a text label reading "Blocked"
4. IF the same color swatch is assigned as both the overdue and blocked border color, THEN THE Collections_Tab SHALL display a double ring (one ring per assignment) with a combined label reading "Overdue" and "Blocked"
5. WHEN a color is assigned as a border color, THE Collections_Tab SHALL remove the ring indicator from any previously assigned swatch for that role and mark the settings form as dirty
6. WHEN a new border color is assigned via the popup, THE Settings_Screen SHALL persist the assignment as `overdue_border_color` or `blocked_border_color` in the settings payload on save

### Requirement 17: Email Tab — Account Test Connection

**User Story:** As a user, I want to test email account connections on Android, so that I can verify credentials before saving.

#### Acceptance Criteria

1. THE email account edit screen SHALL display a "Test Connection" button below the SMTP configuration fields
2. WHEN the Test Connection button is tapped, THE Email_Tab SHALL send the current form field values (email, IMAP host/port/security, SMTP host/port/security, username, password) to `POST /api/email/test-connection` and display a "Testing..." loading indicator inline below the button
3. WHEN the test connection API returns a successful response, THE Email_Tab SHALL display the result for IMAP and SMTP independently (e.g., "IMAP OK" and "SMTP OK" shown separately), so that the user can identify which protocol failed if only one succeeds
4. IF the test connection API returns an error or a network failure occurs, THEN THE Email_Tab SHALL display an error message indicating the failure reason inline below the button
5. WHILE a test connection request is in progress, THE Email_Tab SHALL disable the Test Connection button to prevent duplicate requests

### Requirement 18: Email Tab — Syncing Section Corrections

**User Story:** As a user, I want the email syncing options on Android to exactly match web, so that sync behavior is configured identically.

#### Acceptance Criteria

1. THE Email_Tab SHALL display the "Max Pull" as a free-form number input that accepts integer values from 1 to 1000 inclusive, pre-populated with the current server-stored value
2. IF the user enters a Max Pull value less than 1, greater than 1000, non-numeric, or empty, THEN THE Email_Tab SHALL prevent saving and display an inline error message indicating the valid range (1–1000)
3. THE Email_Tab SHALL display the "Check Mail" interval as a dropdown with exactly these options: Manual only, Every 5 min, Every 15 min, Every 30 min, Every 1 hour
4. THE Email_Tab SHALL display a "Backfill" action button (not a toggle switch) that triggers a one-time backfill operation and displays a progress indicator while the operation is in progress

### Requirement 19: Email Tab — Privacy & Sending Corrections

**User Story:** As a user, I want the email privacy and sending options on Android to exactly match web including all option values and the signature editor, so that email behavior is configured identically.

#### Acceptance Criteria

1. THE Email_Tab SHALL display an "External Content" dropdown with exactly three options: "Allow all" (value: allow), "Block all" (value: block), and "Allow from contacts" (value: known_senders), defaulting to "Allow all"
2. THE Email_Tab SHALL display a "Read Receipts" dropdown with exactly four options: "Never send" (value: never), "Always send" (value: always), "Ask each time" (value: ask), and "Contacts only" (value: contacts_only), defaulting to "Never send"
3. THE Email_Tab SHALL display a signature inline preview that renders the stored Markdown signature as formatted HTML, or displays placeholder text "No signature set" when the signature field is empty
4. THE Email_Tab SHALL display an "Edit Signature" button that opens a modal containing a Markdown-capable text editor with a live-rendered preview below the editing area
5. THE signature editor modal SHALL support Markdown formatting including bold (wrapping selection in **), italic (wrapping selection in *), and links (wrapping selection in []() syntax)
6. WHEN the user confirms the signature editor modal, THE Email_Tab SHALL update the stored signature value and refresh the inline preview to reflect the new content
7. IF the user cancels or dismisses the signature editor modal, THEN THE Email_Tab SHALL discard any edits made in the modal and preserve the previously stored signature
8. THE Email_Tab SHALL display an "Attachments" hint text stating "Attachment limits are configured in Administration → Data Management"
9. THE Email_Tab SHALL display a "View All Attachments" button that navigates to the attachments page

### Requirement 20: Email Tab — Display & Bundles Corrections

**User Story:** As a user, I want the email display and bundle options on Android to exactly match web, so that email organization is configured identically.

#### Acceptance Criteria

1. THE Email_Tab SHALL display "Group Emails By" as a dropdown with options: "Date (Today, Yesterday, Last Week, Older)" (value: date) and "None" (value: none), persisted via the settings sync mechanism
2. THE Email_Tab SHALL display "Bundle Count Display" as a dropdown with options: "Unread / Total" (value: both), "Unread only" (value: unread), "Total only" (value: total), and "Hidden" (value: none), persisted via the settings sync mechanism
3. THE Email_Tab SHALL display "Auto-Bundles" as a list of checkboxes dynamically populated from the server's bundles list, filtered to non-removable bundles excluding "Everything Else", where each checkbox enables or disables that auto-bundle via the bundle enable/disable API endpoints
4. IF no auto-bundles exist in the server response, THEN THE Email_Tab SHALL display a placeholder message indicating that auto-bundles will appear after the first email sync
5. WHEN the user disables an auto-bundle toggle, THE Email_Tab SHALL call the bundle disable endpoint, removing the bundle from the email view without deleting it from the server

### Requirement 21: Email Tab — Badges Section Corrections

**User Story:** As a user, I want the custom badge detector editor on Android to include all fields from web, so that custom detectors are fully configurable.

#### Acceptance Criteria

1. THE custom detector dialog SHALL display a "Name" text input as the first field with placeholder text indicating an example name
2. THE custom detector dialog SHALL display a "Category" dropdown with options: Custom, Package, Flight, Hotel, Rental, Event, Restaurant, Transit, Order, defaulting to "Custom"
3. THE custom detector dialog SHALL display a "Keywords" text input for comma-separated keywords with hint text stating at least one must appear in the email text, where the field may be left empty
4. THE custom detector dialog SHALL display a "Regex Pattern" text input with monospace font, placeholder showing an example pattern, and hint text stating it must have one capture group for the code
5. THE custom detector dialog SHALL display a "URL Template" text input with monospace font, placeholder showing an example URL, and hint text stating to use {code} where the matched value goes
6. THE custom detector dialog SHALL display a "Button Label" dropdown with options: View, Track, Manage, Order, Tickets, Flight, Open, defaulting to "View"
7. IF the user attempts to save a custom detector with an empty Name, empty Regex Pattern, invalid Regex syntax, empty URL Template, or a URL Template that does not contain the literal text "{code}", THEN THE custom detector dialog SHALL display an inline error message indicating the specific validation failure and SHALL NOT save the detector

### Requirement 22: Admin Tab — Administration Section

**User Story:** As a user, I want the full admin configuration on Android including user management, instance name, welcome message, and session lifetime, so that server administration is identical to web.

#### Acceptance Criteria

1. THE Admin_Tab SHALL display a "Manage Users" button that navigates to the user administration screen
2. THE Admin_Tab SHALL display an "Instance Name" text input, pre-populated with the current value from the server settings, accepting a maximum of 100 characters
3. THE Admin_Tab SHALL display a "Welcome Message" textarea that accepts Markdown-formatted text, pre-populated with the current value from the server settings, accepting a maximum of 5000 characters
4. WHEN the user edits the Welcome Message textarea, THE Admin_Tab SHALL display a rendered Markdown preview of the current textarea content below the textarea, updating within 500 milliseconds of the last keystroke
5. THE Admin_Tab SHALL display a "Session Lifetime" dropdown with options: 1 hour, 12 hours, 24 hours, 1 week, 1 month, Never — pre-selected to the current server value
6. WHEN the user saves settings, THE Admin_Tab SHALL persist the Instance Name, Welcome Message, and Session Lifetime values to the server via the settings sync mechanism
7. IF saving the admin settings fails, THEN THE Admin_Tab SHALL display an error message indicating the save failure and retain the user's unsaved input in the form fields

### Requirement 23: Admin Tab — Tools Section (Kiosk)

**User Story:** As a user, I want to configure and launch Kiosk mode from Android settings, so that I can use a wall-mounted display showing selected tags.

#### Acceptance Criteria

1. THE Admin_Tab SHALL display a "Kiosk" section containing a hint explaining that selecting a parent tag automatically includes all child tags in the kiosk display, followed by a scrollable tag selection list (maximum height 200px) showing all user-created tags as checkboxes in a hierarchical tree structure, excluding system tags (Calendar, Checklists, Alarms, Projects, Tasks, Notes)
2. WHEN a parent tag checkbox is checked in the kiosk tag list, THE Admin_Tab SHALL visually select only that parent tag without automatically checking child tag checkboxes, because the kiosk display itself includes child tag chits when a parent is selected
3. WHEN the user presses the "Open Kiosk" button, THE Admin_Tab SHALL navigate to the kiosk display view with the selected tags passed as parameters
4. IF the user presses the "Open Kiosk" button with no tags selected, THEN THE Admin_Tab SHALL display an error toast indicating that at least one tag must be selected
5. WHEN settings are saved, THE Admin_Tab SHALL persist the kiosk tag selection so that previously selected tags are restored when the settings screen is reopened

### Requirement 24: Admin Tab — Data Management Section

**User Story:** As a user, I want the full data management capabilities on Android including separate chit/user exports, calendar import, Google Tasks/Keep import, import batches, audit log access, and attachment limits, so that data operations are identical to web.

#### Acceptance Criteria

1. THE Admin_Tab SHALL display separate "Chit Data" export and import buttons in addition to the existing "All Data" export/import
2. THE Admin_Tab SHALL display separate "User Data" export and import buttons
3. THE Admin_Tab SHALL display a "Calendar Import (.ics)" button with a user-selection dropdown for "Import as user"
4. THE Admin_Tab SHALL display an "Import Google Tasks (.json)" button
5. THE Admin_Tab SHALL display an "Import Google Keep (.json)" button
6. THE Admin_Tab SHALL display an "Import Batches" section listing previously imported batches with a delete button per batch, showing a maximum of 100 batches with the most recent first
7. THE Admin_Tab SHALL display an "Audit Log" navigation button
8. THE Admin_Tab SHALL display a "Trash" navigation button
9. THE Admin_Tab SHALL display a "Custom Objects" navigation button
10. THE Admin_Tab SHALL display "Audit Log Limits" with an "Enable Pruning" checkbox, a "Max Age (days)" number input accepting values from 1 to 9999, and a "Max Size (MB)" number input accepting values from 1 to 99999
11. THE Admin_Tab SHALL display "Attachment Limits" with a "Max File Size" dropdown (5/10/25/50 MB) and "Max Storage Per User" dropdown (100 MB/250 MB/500 MB/1 GB/2 GB/5 GB/Unlimited)
12. WHEN the user taps any import button (All Data, Chit Data, User Data, Calendar, Google Tasks, or Google Keep), THE Admin_Tab SHALL display an "Import Mode" dialog offering "Add to existing data" or "Replace all data" options before proceeding with file selection
13. WHEN "Replace all data" is selected in the Import Mode dialog, THE Admin_Tab SHALL display a confirmation dialog requiring explicit user confirmation before proceeding with the destructive import
14. WHEN the user taps any export button (All Data, Chit Data, or User Data), THE Admin_Tab SHALL invoke the Android system share sheet or file-save picker to deliver the exported file
15. IF an import operation fails due to an invalid file format or server error, THEN THE Admin_Tab SHALL display an error message indicating the reason for failure and preserve the existing data unchanged
16. THE Admin_Tab SHALL display a "Purge All Data" button that requires a two-step confirmation before permanently deleting all data

### Requirement 25: Admin Tab — Dependent Apps (Tailscale)

**User Story:** As a user, I want full Tailscale configuration on Android including enable/disable, auth key management, connect/disconnect, and status display, so that VPN management is identical to web.

#### Acceptance Criteria

1. THE Admin_Tab SHALL display a "Tailscale" toggle button with a status icon (⚪/🟡/🟢/🔴) that expands/collapses the Tailscale configuration section, defaulting to collapsed
2. THE Admin_Tab SHALL display a help icon adjacent to the Tailscale button that toggles setup instructions visibility
3. WHEN the Tailscale section is expanded, THE Admin_Tab SHALL fetch and display the connection status as one of four states: "⚪ Not Installed", "🟡 Inactive", "🟢 Connected", or "🔴 Error"
4. WHEN the status is "Connected", THE Admin_Tab SHALL display the Tailscale IP address and hostname
5. THE Admin_Tab SHALL display an "Auth Key" password input with a show/hide toggle button and a "Get Key" link that opens the Tailscale admin console (https://login.tailscale.com/admin/settings/keys) in a browser
6. THE Admin_Tab SHALL display a "Save Config" button that is disabled until the auth key or enabled state differs from the last-saved values, and that saves the Tailscale configuration independently of the main settings save
7. WHEN the status is "Inactive", THE Admin_Tab SHALL enable the "Connect" button and disable the "Disconnect" button; WHEN the status is "Connected", THE Admin_Tab SHALL enable the "Disconnect" button and disable the "Connect" button; in all other states both buttons SHALL be disabled
8. WHEN the user taps "Connect", "Disconnect", or "Save Config", THE Admin_Tab SHALL automatically refresh the displayed status after the operation completes
9. THE Admin_Tab SHALL display a "Check Status" button that fetches and refreshes the current Tailscale status on demand
10. IF a connect, disconnect, save, or status check operation fails, THEN THE Admin_Tab SHALL display an inline error message indicating the failure reason

### Requirement 26: Admin Tab — Dependent Apps (Ntfy)

**User Story:** As a user, I want full Ntfy configuration on Android including enable/disable toggle, server URLs, topic display, and status, so that push notification management is identical to web.

#### Acceptance Criteria

1. THE Admin_Tab SHALL display an "Ntfy" zone-button that expands/collapses the Ntfy configuration section, with a status icon (🟢 Active, ⚫ Disabled, 🔴 Unreachable, ⚪ Not Configured) displayed inline on the button
2. THE Admin_Tab SHALL display a help icon (circle-question) adjacent to the Ntfy button that toggles visibility of setup instructions including numbered steps and a link to the full help guide
3. WHEN the Ntfy section is expanded, THE Admin_Tab SHALL call the status endpoint and display the Ntfy service status as one of exactly four states: "🟢 Active", "⚫ Disabled", "🔴 Unreachable", or "⚪ Not Configured"
4. WHEN the Ntfy section is expanded, THE Admin_Tab SHALL display the local server URL (derived as "http://{host}:2586") as read-only monospace text with a copy-to-clipboard button that provides visual feedback on tap
5. WHEN Tailscale status returns an active IP, THE Admin_Tab SHALL display the Tailscale server URL as a second read-only row with a copy button, plus a hint that only the local URL should be subscribed to avoid duplicates
6. WHEN the Ntfy section is expanded, THE Admin_Tab SHALL display the Ntfy topic (derived as "cwoc-" plus the first 12 alphanumeric characters of the user ID) as read-only monospace text with a copy-to-clipboard button
7. THE Admin_Tab SHALL display a "🔔 Test" button that sends a test notification via POST to /api/network-access/ntfy/test and displays inline feedback indicating success with the topic name, or failure with the error reason
8. THE Admin_Tab SHALL display an "📱 Open App" button that launches the Ntfy app via the ntfy:// URI scheme
9. IF the Ntfy service is currently active, THEN THE Admin_Tab SHALL display a "⏹️ Disable" button that posts to the disable endpoint and on success updates the status icon to ⚪ and changes the button to "▶️ Enable"
10. IF the Ntfy service is currently disabled or not configured, THEN THE Admin_Tab SHALL display a "▶️ Enable" button that posts to the enable endpoint and on success refreshes the status and changes the button to "⏹️ Disable"
11. THE Admin_Tab SHALL display a "🔄 Check Status" button that re-fetches the current Ntfy status from the server and updates the status badge and header icon
12. IF any Ntfy action (test, disable, enable, status check) fails due to a network error or non-success response, THEN THE Admin_Tab SHALL display an inline feedback message indicating the failure reason without navigating away or showing a modal

### Requirement 27: Admin Tab — Dependent Apps (Home Assistant)

**User Story:** As a user, I want full Home Assistant configuration on Android including connection settings, token management, webhook URL, and poll interval, so that HA integration management is identical to web.

#### Acceptance Criteria

1. THE Admin_Tab SHALL display a "Home Assistant" toggle button with a colored circle indicator (green when enabled, red/grey when disabled) that expands the HA configuration section when enabled and collapses it when disabled
2. THE Admin_Tab SHALL display a help icon adjacent to the Home Assistant toggle button that, when tapped, toggles visibility of setup instructions listing the steps: enter base URL, generate a Long-Lived Access Token in HA, paste and save, test connection, and use the Webhook URL
3. WHEN the HA section is expanded, THE Admin_Tab SHALL display a "HA Base URL" text input with placeholder text "http://192.168.1.100:8123"
4. WHEN the HA section is expanded, THE Admin_Tab SHALL display an "Access Token" password-masked input with a show/hide toggle button that switches the field between masked and plaintext display
5. WHEN the HA section is expanded, THE Admin_Tab SHALL display a "Poll Interval (sec)" number input with minimum value 5, maximum value 3600, and default value 30
6. WHEN the user taps the "Test Connection" button, THE Admin_Tab SHALL attempt to verify connectivity to the HA instance and display a status indicator showing either a success message or an error message indicating the failure reason within 10 seconds
7. WHEN the user taps the "Save HA Config" button, THE Admin_Tab SHALL persist the HA base URL, access token, and poll interval independently of the global settings save, and display a success or failure indication
8. WHEN the HA section is expanded, THE Admin_Tab SHALL display the Webhook URL as a read-only text field with a "Copy" button that copies the URL to the clipboard and displays a brief confirmation indication
9. WHEN the user taps the "Regenerate Webhook Secret" button, THE Admin_Tab SHALL display a confirmation prompt warning that regenerating breaks existing HA automations using the old URL, and IF the user confirms, THEN THE Admin_Tab SHALL generate a new webhook secret and update the displayed Webhook URL

### Requirement 28: Admin Tab — Version & Updates Section

**User Story:** As a user, I want the full version and update information on Android including update date, disk usage, upgrade capability, and log viewing, so that server management is identical to web.

#### Acceptance Criteria

1. THE Admin_Tab SHALL display the current server version string and the "Updated" date formatted according to the user's configured time format setting (12-hour or 24-hour), fetched from `/api/version`
2. THE Admin_Tab SHALL display disk usage in the format "{used} / {total} ({percent}% used)" with a refresh button that disables during fetch and re-enables on completion, and SHALL display the text in warning color when usage is at or above 75% and in critical color when at or above 90%
3. THE Admin_Tab SHALL display "CWOC Data" storage size in the format "{size} ({percent}% of disk)", fetched as part of the `/api/disk-usage` response
4. WHEN the Upgrade button is tapped, THE Admin_Tab SHALL open a modal titled "Upgrading Omni Chits" containing a scrollable terminal-style log area and three buttons: Start (to begin the upgrade), Close (to dismiss the modal), and a Copy button (to copy log text to clipboard)
5. WHEN Start is tapped in the upgrade modal, THE Admin_Tab SHALL connect to `/api/update/run` via Server-Sent Events, append each received log line to the terminal area with auto-scroll, disable Start and Close during the upgrade, and re-enable both buttons when the stream completes or errors
6. WHEN Show Log is tapped, THE Admin_Tab SHALL open the same modal (with Start button hidden and title "Upgrade Log"), fetch the last upgrade log from `/api/update/log`, and display each line in the terminal area
7. IF the current user is an admin, THEN THE Admin_Tab SHALL display a "Restart CWOC" button; WHEN tapped, the system SHALL present a confirmation dialog warning that the service will be briefly unavailable, and only proceed with a POST to `/api/restart` if confirmed
8. WHEN the Release Notes button is tapped, THE Admin_Tab SHALL fetch daily release notes from `/api/release-notes`, render the most recent day's content as markdown, display the formatted date as a header, and provide Older/Newer navigation buttons that page through available days with a "{current} / {total}" counter

### Requirement 29: Tab Structure Alignment

**User Story:** As a user, I want the Android settings tab structure to match web's organization, so that I can find settings in the same logical locations.

#### Acceptance Criteria

1. THE Settings_Screen SHALL organize Badges settings as a collapsible section within the Email tab content area, not as a separate top-level tab
2. THE Settings_Screen SHALL display tabs in this exact left-to-right order: General, Views, Collections, Email, Administration
3. IF the current user is not an admin, THEN THE Settings_Screen SHALL hide the Administration tab, displaying only 4 tabs: General, Views, Collections, Email
4. WHEN the Settings_Screen receives a deep-link navigation intent specifying a tab identifier and optional section identifier, THE Settings_Screen SHALL select the specified tab and scroll to the specified section within 500ms of screen load
5. IF a deep-link targets a section within the Administration tab and the current user is not an admin, THEN THE Settings_Screen SHALL navigate to the General tab and ignore the section target

### Requirement 30: Test Phone Notification

**User Story:** As a user, I want a "Test Phone Notification" button on Android, so that I can verify ntfy push notifications are working on my device.

#### Acceptance Criteria

1. THE Settings_Screen SHALL display a "Test Phone Notification" button within the Dependent Apps section's Ntfy subsection of the Admin tab
2. IF ntfy is not configured (server URL or topic is empty), THEN THE Settings_Screen SHALL disable the "Test Phone Notification" button
3. WHEN the user taps the "Test Phone Notification" button, THE Settings_Screen SHALL send an authenticated POST request to `/api/network-access/ntfy/test` and display inline feedback indicating either success (notification sent) or failure (with the error reason returned by the API) within 10 seconds
4. WHILE the test notification request is in progress, THE Settings_Screen SHALL disable the "Test Phone Notification" button and display a loading indicator to prevent duplicate requests

### Requirement 31: Settings Persistence and API Parity

**User Story:** As a user, I want all new settings fields to persist correctly via the Settings API, so that changes made on Android are reflected on web and vice versa.

#### Acceptance Criteria

1. WHEN settings are saved, THE Settings_Screen SHALL send all field values to the Settings_API using identical JSON key names, value types, and structure as the web client's save payload
2. WHEN settings are loaded, THE Settings_Screen SHALL populate all supported fields from the Settings_API response, mapping each JSON key to its corresponding UI control
3. IF the Settings_API response contains missing or null fields, THEN THE Settings_Screen SHALL apply the same default values as the web client defines for those fields, without displaying an error to the user
4. IF the Settings_API response contains fields that the Android client does not yet support, THEN THE Settings_Screen SHALL preserve those fields unchanged in subsequent save operations so that unsupported web settings are not overwritten or lost
5. WHEN a settings field is saved on Android and then loaded on web, THE Settings_Screen SHALL produce a JSON payload that results in the web client displaying the same value that was entered on Android, with no data loss or type coercion differences
6. WHEN a settings field is saved on web and then loaded on Android, THE Settings_Screen SHALL display the same value that was entered on web, with no data loss or type coercion differences
7. IF the Settings_API save request fails due to network error or non-2xx response, THEN THE Settings_Screen SHALL display an error message indicating the save failed, retain the user's unsaved changes in the UI, and not revert fields to their previous server-side values

### Requirement 32: Collapsible Sections

**User Story:** As a user, I want settings sections to be collapsible on Android with state persistence, so that I can focus on relevant sections without scrolling past irrelevant ones.

#### Acceptance Criteria

1. THE Settings_Screen SHALL display a collapse/expand chevron indicator on each section header (the named groupings within each tab, such as "Clocks", "Contact Vault", "Display Options", "Visual Indicators", "Accounts & Syncing") that toggles between pointing down (expanded) and pointing right (collapsed) to indicate current state
2. WHEN a user taps a section header or its chevron indicator, THE Settings_Screen SHALL toggle the visibility of all form fields, labels, and controls belonging to that section while leaving other sections unaffected
3. THE Settings_Screen SHALL default all sections to expanded on first launch (before any user interaction has been persisted)
4. THE Settings_Screen SHALL persist each section's collapsed or expanded state in SharedPreferences keyed by a unique section identifier, and restore that state when the Settings_Screen is reopened or the app is restarted
5. WHEN a section is collapsed, THE Settings_Screen SHALL hide all content between that section's header and the next section header at the same level, reducing the section to its header row and chevron only
