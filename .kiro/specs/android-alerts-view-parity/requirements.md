# Requirements Document

## Introduction

The Android Alerts view is completely broken — it has four mode chips (List, Independent, Notifications, Reminders) but none display correct content. All modes currently render the same flat list of ClassifiedAlert objects parsed from chit alert JSON. This feature rewrites the Alerts view to achieve full parity with the web mobile browser version, implementing four distinct modes with proper data sources, CRUD operations, real-time timer/stopwatch runtimes, and server-backed notifications.

## Glossary

- **Alerts_View**: The Android Compose screen that displays alert-related content across four modes
- **Mode_Toggle**: A row of four FilterChip components allowing the user to switch between Chits, Independent, Notifications, and Reminders modes
- **Independent_Board**: A three-column layout displaying standalone Alarms, Timers, and Stopwatches not attached to any chit
- **Standalone_Alert**: An alarm, timer, or stopwatch entity managed via `/api/standalone-alerts` that exists independently of any chit
- **Alarm_Card**: A UI card displaying an editable alarm with name, time, day-of-week checkboxes, and enabled toggle
- **Timer_Card**: A UI card displaying a countdown timer with duration input, progress bar, and start/pause/reset controls
- **Stopwatch_Card**: A UI card displaying an elapsed-time stopwatch with start/pause/lap/reset controls and laps list
- **Timer_Runtime**: In-memory state management for active timer countdowns that persists across navigation
- **Stopwatch_Runtime**: In-memory state management for active stopwatch elapsed tracking that persists across navigation
- **Notification**: A server-side notification object fetched from `/api/notifications` with status and action capabilities
- **Reminder**: A chit that has both `notification=true` and a `point_in_time` value set
- **Chit_Alert**: A chit that has any alert data (alarm, notification, timer, or stopwatch) in its alerts JSON field
- **Settings_Repository**: The repository providing user preferences including `time_format` and `week_start_day`
- **Standalone_Alert_Repository**: The repository wrapping the standalone-alerts API and local Room cache
- **Alerts_ViewModel**: The ViewModel managing state for all four alert modes, timer/stopwatch runtimes, and mode persistence

## Requirements

### Requirement 1: Mode Toggle and Persistence

**User Story:** As a user, I want to switch between four alert modes and have my selection remembered, so that I return to my preferred view each time I open the Alerts screen.

#### Acceptance Criteria

1. THE Alerts_View SHALL display a Mode_Toggle row with four FilterChips labeled "📋 Chits", "🛎️ Independent", "🔔 Notifs", and "📢 Reminders", with exactly one chip visually marked as selected at all times
2. WHEN the user taps a FilterChip, THE Alerts_View SHALL mark that chip as selected, deselect all other chips, and replace the content area below the Mode_Toggle row with the content for the corresponding mode within 300 milliseconds
3. WHEN the user taps a FilterChip, THE Alerts_View SHALL persist the selected mode value (one of "list", "independent", "notifications", "reminders") in SharedPreferences under the key `alerts_view_mode`
4. WHEN the Alerts_View is opened and no persisted mode exists, THE Alerts_View SHALL default to the "Independent" mode
5. WHEN the Alerts_View is opened and a persisted mode exists, THE Alerts_View SHALL restore the previously selected mode
6. IF the persisted `alerts_view_mode` value is not one of the four valid mode strings, THEN THE Alerts_View SHALL discard the invalid value and default to the "Independent" mode

### Requirement 2: Chits List Mode

**User Story:** As a user, I want to see all chits that have any alert attached, so that I can quickly find and navigate to alert-bearing chits.

#### Acceptance Criteria

1. WHEN the "Chits" mode is active, THE Alerts_View SHALL query all chits where the alerts JSON field is not null and not an empty string and not '[]', OR the alarm flag is true, OR the notification flag is true
2. WHEN the "Chits" mode is active, THE Alerts_View SHALL render each matching chit as a standard chit card with the chit title (tappable), chit color applied to the card background, and an alert summary row showing only non-zero counts by type (📢 N, 🔔 N, ⏱️ N, ⏲️ N), where N is the count of matching entries in the alerts array for that type, or 1 if the corresponding boolean flag (notification, alarm) is true but no matching array entries exist
3. WHEN the user taps a chit card in Chits mode, THE Alerts_View SHALL navigate to the chit editor for that chit
4. WHEN the user long-presses a chit card in Chits mode, THE Alerts_View SHALL display the ChitActionMenu with pin, archive, snooze, edit, and delete actions
5. WHEN no chits with alerts exist after filtering, THE Alerts_View SHALL display the empty state message "No chits with alerts found."
6. WHILE the "Chits" mode is active, THE Alerts_View SHALL apply FilterSortViewModel filters (tags, status) and the current sort order to the chit list, with pinned chits displayed before unpinned chits regardless of sort order

### Requirement 3: Independent Board Layout

**User Story:** As a user, I want to see my standalone alarms, timers, and stopwatches in a three-column board, so that I can manage them independently of chits.

#### Acceptance Criteria

1. WHEN the "Independent" mode is active, THE Alerts_View SHALL display the Independent_Board with three columns labeled "🔔 Alarms", "⏱️ Timers", and "⏲️ Stopwatches", rendered as vertically stacked sections on mobile
2. WHEN the Independent_Board is first displayed or pull-to-refresh is triggered, THE Alerts_View SHALL fetch standalone alerts from `GET /api/standalone-alerts`, cache them in the local Room database via Standalone_Alert_Repository, and render from cache
3. IF the fetch from `GET /api/standalone-alerts` fails, THEN THE Independent_Board SHALL display previously cached data from the local Room database and show a brief error indication
4. WHEN the Independent_Board is displayed, THE Alerts_View SHALL group standalone alerts by their `_type` field into the corresponding column and preserve the user's drag-to-reorder sort order within each column
5. WHEN a column has no items, THE Independent_Board SHALL display the empty state "No independent {alarms/timers/stopwatches} yet."
6. THE Independent_Board SHALL include a "+" button in each column header that creates a new standalone alert of that column's type via `POST /api/standalone-alerts` with defaults: alarm uses current time rounded up to next minute with today's day selected and enabled=true; timer uses 0 duration; stopwatch starts immediately upon creation

### Requirement 4: Independent Alarm Cards

**User Story:** As a user, I want to create and manage standalone alarms with editable names, times, day selections, and on/off toggles, so that I can set recurring alarms without creating chits.

#### Acceptance Criteria

1. EACH Alarm_Card SHALL display an editable name text field (placeholder "Alarm name"), a time display formatted per criterion 10, day-of-week checkboxes for all 7 days (Sun, Mon, Tue, Wed, Thu, Fri, Sat), an on/off toggle button showing "On" or "Off" text, and a delete button (❌)
2. WHEN the user edits the alarm name and the field loses focus or the user confirms input, THE Alarm_Card SHALL save the updated name via `PUT /api/standalone-alerts/{id}`
3. WHEN the user taps the time display, THE Alarm_Card SHALL open a time picker dialog pre-populated with the alarm's current time in HH:MM 24-hour format
4. WHEN the user selects a new time in the time picker, THE Alarm_Card SHALL update the time display, store the time internally as "HH:MM" in 24-hour format, auto-select today's day-of-week if no days are currently selected, and save via `PUT /api/standalone-alerts/{id}`
5. THE Alarm_Card SHALL display day-of-week checkboxes ordered starting from the day index specified by the user's `week_start_day` setting (0=Sunday through 6=Saturday) from Settings_Repository, wrapping through all 7 days
6. WHEN the user toggles a day-of-week checkbox, THE Alarm_Card SHALL add or remove that day abbreviation (e.g., "Mon", "Tue") from the days array and save the updated array via `PUT /api/standalone-alerts/{id}`
7. WHEN the user taps the on/off toggle, THE Alarm_Card SHALL update the enabled state, change the toggle text to "On" or "Off" accordingly, visually dim the name field, time display, and day checkboxes to reduced opacity when disabled, and save via `PUT /api/standalone-alerts/{id}`
8. WHEN the user taps the delete button, THE Alarm_Card SHALL call `DELETE /api/standalone-alerts/{id}` and remove the card from the column without requiring confirmation
9. WHEN the user taps the "+" button in the Alarms column header, THE Independent_Board SHALL create a new alarm via `POST /api/standalone-alerts` with default values: time set to current time plus 1 minute (formatted as "HH:MM"), days array containing only today's day abbreviation, enabled=true, and name as empty string
10. THE Alarm_Card SHALL format the time display according to the user's `time_format` setting (12-hour with AM/PM suffix or 24-hour with no suffix) from Settings_Repository
11. IF a `PUT`, `POST`, or `DELETE` call to `/api/standalone-alerts` fails (network error or non-2xx response), THEN THE Alarm_Card SHALL retain the previous local state and display an error indication to the user

### Requirement 5: Independent Timer Cards

**User Story:** As a user, I want to create and manage countdown timers with configurable durations, loop options, and visual progress, so that I can track timed activities.

#### Acceptance Criteria

1. EACH Timer_Card SHALL display an editable name text field, a loop checkbox, a delete button, duration inputs (HH:MM:SS), a countdown progress bar, and start/pause/reset controls
2. WHILE a timer is stopped or reset, THE Timer_Card SHALL display HH:MM:SS number input fields for setting the duration, where HH accepts values 0 or greater and MM and SS each accept values from 0 to 59
3. WHILE a timer is running, THE Timer_Card SHALL display a horizontal progress bar showing remaining time as a percentage of total duration (calculated as remaining divided by total times 100), with remaining time text in HH:MM:SS format
4. WHILE a timer is running and remaining time is less than 10 seconds, THE Timer_Card SHALL display time text in HH:MM:SS.T format (tenths of a second)
5. WHEN the user taps the Start button, THE Timer_Runtime SHALL begin decrementing the remaining time every 100 milliseconds
6. WHEN the user taps the Start button and the configured total duration is zero seconds, THE Timer_Runtime SHALL not start the countdown and SHALL remain in the stopped state showing duration inputs
7. WHEN the user taps the Pause button, THE Timer_Runtime SHALL stop decrementing and preserve the remaining time, and THE Timer_Card SHALL continue displaying the progress bar with the frozen remaining value
8. WHEN the user taps the paused progress bar, THE Timer_Card SHALL hide the progress bar and display the duration input fields
9. WHEN the user taps the Reset button, THE Timer_Runtime SHALL stop the countdown and restore remaining time to the configured total duration, and THE Timer_Card SHALL display the duration input fields
10. WHEN the remaining time reaches zero, THE Timer_Runtime SHALL play the timer alarm sound and display "✓ DONE" text on the progress bar
11. WHEN the remaining time reaches zero and loop is enabled, THE Timer_Runtime SHALL restart the countdown from the configured total duration after 1.5 seconds
12. WHEN the remaining time reaches zero and loop is not enabled, THE Timer_Card SHALL return to displaying the duration input fields after 2.5 seconds
13. WHEN the user edits the timer name or toggles loop, THE Timer_Card SHALL save the change via `PUT /api/standalone-alerts/{id}`
14. WHEN the user taps the delete button, THE Timer_Card SHALL call `DELETE /api/standalone-alerts/{id}` and remove the card
15. WHEN the user taps the "+" button in the Timers column header, THE Independent_Board SHALL create a new timer via `POST /api/standalone-alerts` with zero duration
16. WHEN the user taps the progress bar while the timer is running, THE Timer_Card SHALL pause the running timer

### Requirement 6: Independent Stopwatch Cards

**User Story:** As a user, I want to create and manage stopwatches with elapsed time tracking and lap recording, so that I can time activities with precision.

#### Acceptance Criteria

1. EACH Stopwatch_Card SHALL display an editable name text field, a delete button, an elapsed time display in HH:MM:SS.cs format (centiseconds, initially "00:00:00.00"), a single Start/Pause toggle button, a Lap button, a Reset button, and a laps list
2. WHILE a stopwatch is running, THE Stopwatch_Runtime SHALL update the elapsed time display every 50 milliseconds
3. WHEN the user taps the Start/Pause button while the stopwatch is stopped, THE Stopwatch_Runtime SHALL begin incrementing elapsed time from the current value and change the button label to "⏸ Pause"
4. WHEN the user taps the Start/Pause button while the stopwatch is running, THE Stopwatch_Runtime SHALL stop incrementing, preserve the elapsed time, and change the button label to "▶ Start"
5. WHEN the user taps the Lap button while the stopwatch is running, THE Stopwatch_Runtime SHALL record the current elapsed time as a new lap entry appended to the laps list, formatted as "Lap N: HH:MM:SS.cs" where N increments from 1; IF the stopwatch is not running, THEN THE Stopwatch_Runtime SHALL ignore the tap
6. WHEN the user taps the Reset button, THE Stopwatch_Runtime SHALL stop the stopwatch, reset elapsed time to "00:00:00.00", clear the laps list, and change the button label to "▶ Start"
7. WHEN the user edits the stopwatch name, THE Stopwatch_Card SHALL save the change via `PUT /api/standalone-alerts/{id}`
8. WHEN the user taps the delete button, THE Stopwatch_Card SHALL stop any running interval, call `DELETE /api/standalone-alerts/{id}`, and remove the card from the board
9. WHEN the user taps the "+" button in the Stopwatches column header, THE Independent_Board SHALL create a new stopwatch via `POST /api/standalone-alerts` and auto-start the stopwatch immediately
10. WHILE a stopwatch is running and the user navigates away from the alerts screen, THE Stopwatch_Runtime SHALL continue incrementing elapsed time in the ViewModel and resume updating the display when the user returns

### Requirement 7: Timer and Stopwatch Lifecycle

**User Story:** As a user, I want my running timers and stopwatches to continue when I navigate away from the Alerts screen, so that I do not lose progress.

#### Acceptance Criteria

1. THE Alerts_ViewModel SHALL maintain Timer_Runtime and Stopwatch_Runtime state in memory for the duration of the ViewModel lifecycle, updating timer countdowns every 100 milliseconds and stopwatch elapsed values every 50 milliseconds while running
2. WHEN the user navigates away from the Alerts_View and returns, THE Alerts_View SHALL resume displaying the current elapsed/remaining values from the ViewModel within 100 milliseconds of recomposition, reflecting accurate accumulated time without requiring user action to restart
3. WHEN a timer completes while the user is on a different screen, THE Alerts_ViewModel SHALL trigger a local notification via the existing NotificationScheduler pattern, including the timer name in the notification content
4. IF the app process is terminated by the system while timers or stopwatches are running, THEN THE Alerts_ViewModel SHALL treat the runtime state as lost, and upon next launch the timers and stopwatches SHALL display in their stopped/reset state

### Requirement 8: Notifications Mode

**User Story:** As a user, I want to view and act on server notifications split into Unread and Addressed sections, so that I can manage invitations, reminders, and system messages.

#### Acceptance Criteria

1. WHEN the "Notifications" mode is active, THE Alerts_View SHALL fetch notifications from `GET /api/notifications?device=mobile` and display results within 10 seconds or show an error indication
2. THE Alerts_View SHALL split notifications into two sections: "📬 Unread" (status = "pending") sorted by created_datetime descending, and "📭 Addressed" (status != "pending") sorted by created_datetime descending
3. EACH notification card SHALL display the chit title (tappable to navigate to editor if chit_id exists), type information ("Assigned by: {name}" for notification_type "assigned", or "{delivery_target} reminder" for notification_type "reminder"), sent date, due date (if present), and start date (if present)
4. IF a notification has notification_type "reminder" AND status "pending", THEN THE notification card SHALL display a Snooze button (labeled "Snooze {N}m" where N is the user's snooze_length setting, default 5 minutes) and a Dismiss button
5. IF a notification has notification_type other than "reminder", THEN THE notification card SHALL display Accept and Decline action buttons as a pill toggle, with the current status visually indicated if already acted upon
6. WHEN the user taps Accept, THE Alerts_View SHALL call `PATCH /api/notifications/{id}` with body `{status: "accepted"}` and upon success move the card to the Addressed section
7. WHEN the user taps Decline, THE Alerts_View SHALL call `PATCH /api/notifications/{id}` with body `{status: "declined"}` and upon success move the card to the Addressed section
8. WHEN the user taps Dismiss, THE Alerts_View SHALL call `PATCH /api/notifications/{id}` with body `{status: "dismissed"}` and upon success move the card to the Addressed section
9. WHEN the user taps Snooze, THE Alerts_View SHALL call `POST /api/notifications/{id}/snooze` with body `{minutes: N}` where N is the integer value parsed from the user's snooze_length setting (default 5), and upon success remove the card from the Unread section
10. EACH addressed notification card SHALL render with 0.7 opacity and display a status badge showing the action taken (accepted, declined, dismissed, or snoozed)
11. THE "Addressed" section header SHALL include a "Clear Addressed" button that, after user confirmation, bulk-deletes all addressed notifications via `DELETE /api/notifications/{id}` for each
12. EACH notification card in the Addressed section SHALL include a Delete button that calls `DELETE /api/notifications/{id}` and upon success removes the card from the list
13. WHEN no notifications exist, THE Alerts_View SHALL display the empty state "No notifications."
14. IF an API call (PATCH, POST, or DELETE) for a notification action fails, THEN THE Alerts_View SHALL display an error toast and retain the notification card in its current section and state

### Requirement 9: Reminders Mode

**User Story:** As a user, I want to see chits that are reminders (notification flag + point_in_time) split into Upcoming and Past sections with quick actions, so that I can manage time-sensitive reminders.

#### Acceptance Criteria

1. WHEN the "Reminders" mode is active, THE Alerts_View SHALL query local chits where notification = true AND point_in_time is not null, sorted by point_in_time ascending
2. WHILE the "Reminders" mode is active, THE Alerts_View SHALL split reminders into two sections: "⏰ Upcoming ({count})" containing reminders where point_in_time >= device current time, and "📭 Past ({count})" containing reminders where point_in_time < device current time
3. WHILE the "Reminders" mode is active, THE Alerts_View SHALL display each reminder card with: a pin toggle button (filled bookmark icon if pinned, outline if not), the chit title (tappable to navigate to editor), action buttons (Complete, Archive, Delete) visible without hover, and a meta row showing "📢 {YYYY-Mon-DD HH:MM}" using the chit's point_in_time
4. WHEN a reminder's point_in_time is earlier than device current time AND the chit status is not Complete, THE reminder card SHALL display a red "past" badge adjacent to the date in the meta row
5. WHEN a reminder's chit status is Complete, THE reminder card SHALL display a green "✓ done" badge adjacent to the date in the meta row and render the card at reduced opacity
6. WHEN the user taps the Pin button, THE Alerts_View SHALL toggle the chit's pinned state via the ChitRepository and update the pin icon between filled and outline
7. WHEN the user taps Complete, THE Alerts_View SHALL immediately fade the card visually, display an undo toast with countdown, and upon countdown expiry set the chit status to "Complete" and archived to true via the ChitRepository
8. IF the user taps Undo on the Complete undo toast before expiry, THEN THE Alerts_View SHALL restore the card to its original visual state without modifying the chit
9. WHEN the user taps Archive, THE Alerts_View SHALL toggle the chit's archived state via the ChitRepository
10. WHEN the user taps Delete, THE Alerts_View SHALL present a confirmation dialog, and upon confirmation soft-delete the chit via the ChitRepository
11. WHEN no reminders exist (no chits match notification = true AND point_in_time is not null), THE Alerts_View SHALL display the empty state message "No reminders."

### Requirement 10: Pull-to-Refresh

**User Story:** As a user, I want to pull down to refresh the current mode's data, so that I can see the latest information without restarting the app.

#### Acceptance Criteria

1. WHEN the user performs a pull-to-refresh gesture in Independent mode, THE Alerts_View SHALL re-fetch standalone alerts from `GET /api/standalone-alerts` and update the displayed list with the response data
2. WHEN the user performs a pull-to-refresh gesture in Notifications mode, THE Alerts_View SHALL re-fetch notifications from `GET /api/notifications?device=mobile` and update the displayed list with the response data
3. WHEN the user performs a pull-to-refresh gesture in Chits mode, THE Alerts_View SHALL trigger a sync pull to refresh local chit data and re-render the chit alerts list from the updated local database
4. WHEN the user performs a pull-to-refresh gesture in Reminders mode, THE Alerts_View SHALL trigger a sync pull to refresh local chit data and re-render the reminders list from the updated local database
5. WHILE a pull-to-refresh operation is in progress, THE Alerts_View SHALL display the platform pull-to-refresh loading indicator until the data fetch completes or fails
6. IF a pull-to-refresh network request fails, THEN THE Alerts_View SHALL dismiss the loading indicator and continue displaying the previously loaded data without clearing the view

### Requirement 11: Standalone Alerts Data Layer

**User Story:** As a user, I want standalone alerts to be cached locally so that I can view them offline, and synced with the server for persistence.

#### Acceptance Criteria

1. THE Standalone_Alert_Repository SHALL store fetched standalone alerts in a Room database table `standalone_alerts` with columns: id (TEXT PRIMARY KEY), type (TEXT NOT NULL), name (TEXT), data (TEXT NOT NULL), createdDatetime (TEXT), modifiedDatetime (TEXT)
2. WHEN the Independent mode is activated, THE Standalone_Alert_Repository SHALL fetch from `GET /api/standalone-alerts` and replace all rows in the local `standalone_alerts` table with the API response
3. WHEN a create, update, or delete operation succeeds against the API, THE Standalone_Alert_Repository SHALL apply the corresponding insert, update, or delete to the matching row in the local Room cache
4. THE CwocApiService SHALL include endpoints for `GET /api/standalone-alerts`, `POST /api/standalone-alerts`, `PUT /api/standalone-alerts/{id}`, and `DELETE /api/standalone-alerts/{id}`
5. IF the API fetch on mode activation fails, THEN THE Standalone_Alert_Repository SHALL return the existing locally cached data and the Alerts_View SHALL display it without an error state

### Requirement 12: Time Format and Week Start Day

**User Story:** As a user, I want the Alerts view to respect my time format and week start day preferences, so that times and day ordering match my other views.

#### Acceptance Criteria

1. THE Alerts_View SHALL format all time displays (alarm times, notification dates, reminder dates) according to the `time_format` setting from Settings_Repository (12-hour with AM/PM suffix or 24-hour with no suffix)
2. THE Alarm_Card SHALL order day-of-week checkboxes starting from the day index specified by the `week_start_day` setting (0=Sunday through 6=Saturday) from Settings_Repository, wrapping through all 7 days
