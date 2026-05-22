# Requirements Document

## Introduction

This spec defines 8 Android home screen widgets for the CWOC app. Widgets use Android's AppWidgetProvider and RemoteViews system, reading data from the local Room database. They follow the existing parchment theme and provide at-a-glance access to chits, checklists, alarms, projects, weather, and time displays without opening the full app.

## Glossary

- **Widget_Host**: The Android home screen launcher that hosts AppWidgetProvider instances
- **Widget_Provider**: An AppWidgetProvider subclass that renders and updates a specific widget type
- **Widget_Config_Activity**: An Activity launched when the user first places a widget, allowing them to select options (e.g., which checklist or project to display)
- **RemoteViews**: Android's widget rendering system for building UI outside the app process
- **Omni_View**: The unified chit list in the CWOC app that shows all chit types with user-configured sort order, category filters, and display settings
- **Chit**: A single flexible record in CWOC (task, note, calendar event, alarm, checklist, or project)
- **Checklist_Chit**: A chit containing nested checklist items with checkable sub-items
- **Project_Chit**: A chit that acts as a project container with child chits tracked for completion
- **HST**: Holeman Simplified Time — a decimal time system where the day fraction (0–1) is multiplied by 100 and displayed as "XX.XXX sd"
- **HST_Color**: The project-specific color defined by hue, saturation, and tone values
- **Quick_Menu**: The floating action menu in the app that offers creation shortcuts for Task, Note, Checklist, Project, etc.
- **Open_Meteo**: The weather API integration already used by CWOC for forecast data
- **Saved_Location**: A location stored in the user's CWOC settings for weather lookups
- **WidgetDataProvider**: The existing singleton object that reads widget data directly from the local Room database
- **Room_Database**: The local SQLite database managed by Android Room ORM
- **Widget_Update_Worker**: A WorkManager-based periodic worker that refreshes widget data on a schedule

## Requirements

### Requirement 1: Omni View Widget

**User Story:** As a user, I want a scrollable home screen widget showing my Omni View content, so that I can see my chits at a glance without opening the app.

#### Acceptance Criteria

1. THE Widget_Provider SHALL render a scrollable list of chit cards using RemoteViews with a ListView or StackView adapter, displaying a maximum of 20 chits
2. THE Widget_Provider SHALL use a default size of 4 columns × 1 row when first placed on the home screen
3. WHEN the widget is resized to a larger size, THE Widget_Provider SHALL display additional chit cards to fill the available space, recalculating visible card count based on the new widget dimensions
4. THE Widget_Provider SHALL respect the user's current Omni View settings including sort order, visible categories, and active filters
5. THE Widget_Provider SHALL render each chit card with a colored left border matching the chit's category color, matching the app's Omni View card style
6. THE Widget_Provider SHALL display visual indicators on each card consistent with the app's Omni View (status icons, due date badges, priority markers)
7. WHEN the user taps a chit card in the widget, THE Widget_Provider SHALL open the app to that chit's editor screen
8. WHEN the local database is updated via sync, THE Widget_Provider SHALL refresh its displayed content within 30 seconds
9. IF the Omni View query returns zero chits, THEN THE Widget_Provider SHALL display an empty-state message indicating no chits match the current filters
10. IF the local database is unavailable or the data fetch fails, THEN THE Widget_Provider SHALL display the most recently cached content or an empty-state message if no cache exists, without crashing
11. WHEN the widget is first placed on the home screen, THE Widget_Provider SHALL perform an initial data load and display content within 5 seconds

### Requirement 2: Quick Capture Widget

**User Story:** As a user, I want a small widget that lets me quickly create a new chit of any type, so that I can capture ideas without navigating through the app.

#### Acceptance Criteria

1. THE Widget_Provider SHALL render as a 1×1 widget displaying a "+" icon centered on a parchment-themed background
2. WHEN the user taps the widget, THE Widget_Provider SHALL launch a transparent Activity displaying a quick menu with creation options for: Task, Note, Checklist, Project, Calendar Event, and Alarm
3. WHEN the user selects a type from the quick menu, THE Widget_Provider SHALL open the chit editor with the selected type pre-assigned as the chit's primary category (equivalent to the system tag assignment for that type)
4. IF the user taps outside the quick menu without selecting an option, THEN THE Widget_Provider SHALL dismiss the Activity without creating a chit or navigating further
5. IF the user presses the system Back button while the quick menu is displayed, THEN THE Widget_Provider SHALL dismiss the Activity without creating a chit

### Requirement 3: Checklist Widget

**User Story:** As a user, I want a widget that displays a specific checklist on my home screen with interactive checkboxes, so that I can check off items without opening the app.

#### Acceptance Criteria

1. WHEN the user first places the widget, THE Widget_Config_Activity SHALL present a list of all non-deleted checklist chits for the user to select which one to display, or display an empty state message "No checklists available" if none exist
2. THE Widget_Provider SHALL display the selected checklist's title and up to 20 of its items with checkboxes, rendered via a RemoteViews ListView
3. THE Widget_Provider SHALL display nested sub-items indented by 16dp per nesting level, supporting up to 3 levels of depth
4. WHEN the user taps a checkbox on the widget, THE Widget_Provider SHALL toggle that item's checked state in the local Room_Database, mark the parent ChitEntity as dirty, and trigger a sync push within 5 seconds
5. WHEN the user taps a non-checkbox area of a checklist item on the widget, THE Widget_Provider SHALL navigate to the Chit_Editor for the associated checklist chit
6. WHEN the user long-presses the widget, THE Widget_Config_Activity SHALL allow the user to change which checklist is displayed
7. IF the sync push fails after toggling a checkbox, THEN THE Widget_Provider SHALL revert the checkbox state in the local Room_Database and display an error indicator for 3 seconds
8. IF the selected checklist chit is deleted or no longer contains checklist data, THEN THE Widget_Provider SHALL display a message indicating the checklist is unavailable and prompt the user to reconfigure
9. WHEN the checklist data changes in the local Room_Database for the selected chit, THE Widget_Provider SHALL refresh its display within 5 seconds of the change
10. THE Widget_Update_Worker SHALL include the Checklist Widget in its periodic 30-minute refresh cycle and in immediate refreshes triggered by sync pull completion or local chit edits

### Requirement 4: Upcoming Alarms Widget

**User Story:** As a user, I want a widget showing my next upcoming alarms with countdown timers, so that I can see at a glance when my next reminders will fire.

#### Acceptance Criteria

1. THE Widget_Provider SHALL display the next 3 alarms whose trigger time is in the future, sorted by trigger time ascending, using a default size of 4 columns × 2 rows
2. THE Widget_Provider SHALL display each alarm entry with the associated chit title (truncated to 30 characters with ellipsis if longer) and a countdown timer formatted as: "Xd Yh" when more than 24 hours remain, "Xh Ym" when between 1 hour and 24 hours remain, and "Xm" when less than 1 hour remains
3. WHILE the nearest alarm is less than 1 hour away, THE Widget_Provider SHALL update countdown timers every 60 seconds
4. WHILE the nearest alarm is 1 hour or more away, THE Widget_Provider SHALL update countdown timers every 15 minutes
5. WHEN an alarm's trigger time passes, THE Widget_Provider SHALL remove it from the list and display the next future alarm if one exists, or transition to the empty state if no future alarms remain
6. WHEN the user taps an alarm entry, THE Widget_Provider SHALL open the app to that alarm's associated chit editor
7. IF no alarms with a future trigger time exist, THEN THE Widget_Provider SHALL display an empty state message indicating no upcoming alarms

### Requirement 5: Project Progress Widget

**User Story:** As a user, I want a widget showing a specific project's completion progress, so that I can track project status from my home screen.

#### Acceptance Criteria

1. WHEN the user first places the widget, THE Widget_Config_Activity SHALL present a list of all non-deleted project chits for the user to select which one to display
2. THE Widget_Provider SHALL display a horizontal progress bar that fills left-to-right based on the project's completion ratio, where completion ratio equals the number of child chits with status "Complete" divided by the total number of child chits
3. THE Widget_Provider SHALL color the progress bar using the project's HST_Color (hue, saturation, tone), falling back to the default accent color (#6b4e31) if no HST_Color is set on the project
4. THE Widget_Provider SHALL display "X of Y" text indicating completed count and total count
5. THE Widget_Provider SHALL display the project title above or below the progress bar, truncated to a single line with ellipsis if it exceeds the widget width
6. WHEN the user taps the widget, THE Widget_Provider SHALL open the app to that project's view
7. WHEN the user long-presses the widget, THE Widget_Config_Activity SHALL allow the user to change which project is displayed
8. WHEN project data changes in the local database, THE Widget_Provider SHALL update its displayed progress bar and counts within 30 seconds
9. IF the selected project has zero child chits, THEN THE Widget_Provider SHALL display the progress bar at 0% with "0 of 0" text
10. IF the selected project has been deleted, THEN THE Widget_Provider SHALL display a message indicating the project is no longer available and prompt the user to select a different project

### Requirement 6: Weather Widget

**User Story:** As a user, I want a weather widget showing conditions for a chosen location, so that I can check the weather without opening the app.

#### Acceptance Criteria

1. WHEN the user first places the widget, THE Widget_Config_Activity SHALL present options to choose from saved locations or enter a custom location by typing an address or place name
2. IF the user enters a custom location that cannot be geocoded, THEN THE Widget_Config_Activity SHALL display an error message indicating the location could not be found and SHALL NOT allow widget creation to complete until a valid location is provided
3. WHILE a valid location is configured, THE Widget_Provider SHALL display current weather conditions including temperature (in the user's configured unit system from Settings), a weather icon corresponding to the WMO weather code, and a text condition description (maximum 20 characters, truncated with ellipsis if longer) for the selected location
4. THE Widget_Provider SHALL use the existing Open_Meteo integration for weather data retrieval
5. THE Widget_Provider SHALL update weather data every 30 minutes via Android's WorkManager or AlarmManager periodic scheduling
6. WHEN the user taps the widget, THE Widget_Provider SHALL open the app's weather page for the selected location
7. WHEN the user long-presses the widget, THE Widget_Config_Activity SHALL allow the user to change the selected location
8. IF weather data cannot be retrieved, THEN THE Widget_Provider SHALL display the last known data with a visible stale-data indicator showing the time of the last successful update, and SHALL retain this state until a successful refresh occurs
9. IF no last-known data exists and weather data cannot be retrieved, THEN THE Widget_Provider SHALL display a message indicating weather is unavailable for the selected location
10. IF the user has no saved locations and has not entered a custom location, THEN THE Widget_Config_Activity SHALL display the custom location entry field as the only option with a prompt to enter a location

### Requirement 7: Weekly Overview Widget

**User Story:** As a user, I want a widget showing a 7-day strip with chit counts per day, so that I can see my week's load at a glance.

#### Acceptance Criteria

1. THE Widget_Provider SHALL display a horizontal strip of 7 days (current week, Monday through Sunday or based on user's week-start preference), where each day cell shows the abbreviated day name and date number (e.g., "Mon 12")
2. THE Widget_Provider SHALL display the count of non-deleted chits whose scheduled date falls on that day as a number within or below that day's cell, showing "0" when no chits are scheduled
3. THE Widget_Provider SHALL visually distinguish today's cell from other days using the parchment theme accent color (#6b4e31) as a background or border highlight
4. WHEN the user taps a specific day in the strip, THE Widget_Provider SHALL open the app's calendar to that day's view
5. WHEN the user taps the widget header (week label area), THE Widget_Provider SHALL open the app's calendar to that week's view
6. WHEN the app completes a sync operation or a chit is created/modified/deleted locally, THE Widget_Provider SHALL refresh its displayed counts within 30 seconds
7. WHEN the current date advances past the displayed week's end day, THE Widget_Provider SHALL update the strip to show the new current week

### Requirement 8: HST Time Bar Widget

**User Story:** As a user, I want a widget displaying Holeman Simplified Time as a progress bar, so that I can see the decimal time at a glance on my home screen.

#### Acceptance Criteria

1. THE Widget_Provider SHALL calculate HST using device local time as (hours×3600 + minutes×60 + seconds) / 86400 × 100, displayed as "XX.XXX sd" with 3 decimal places
2. THE Widget_Provider SHALL render a horizontal progress bar of 8dp height, filled to (dayFraction × 100)% width using a gold-to-brown linear gradient (#d4af37 at 0%, #c8965a at 60%, #8b4513 at 100%)
3. THE Widget_Provider SHALL use a parchment background color (#f5e6cc) with a 1dp brown border (#8b4513) and rounded corners (6dp)
4. THE Widget_Provider SHALL display the HST value as bold centered text at 16sp in color #4a2c2a with a white text shadow (offset 1dp, radius 1dp) for contrast against the progress bar
5. WHEN the widget is resized horizontally, THE Widget_Provider SHALL stretch the progress bar to fill the available width while keeping the text fixed at 16sp
6. THE Widget_Provider SHALL update the displayed time every 1 second using a Handler-based timer while the device screen is on
7. THE Widget_Provider SHALL have no tap action (info-only display)
8. WHEN the widget is first placed on the home screen, THE Widget_Provider SHALL immediately calculate and display the current HST value without requiring user configuration
9. IF the device screen turns off, THEN THE Widget_Provider SHALL pause the 1-second update timer and resume it when the screen turns back on

### Requirement 9: Widget Infrastructure

**User Story:** As a developer, I want shared widget infrastructure, so that all 8 widgets follow consistent patterns for data access, theming, and refresh scheduling.

#### Acceptance Criteria

1. THE WidgetDataProvider SHALL be extended with query methods for each new widget type (checklist items, alarms, project progress, weekly counts), where each query method returns at most 50 items sorted by relevance to the widget's display purpose
2. THE Widget_Provider instances SHALL use the existing parchment theme colors (#fffaf0 background, #6b4e31 accent) and the system Serif font family as the RemoteViews fallback for Lora typography
3. THE Widget_Provider instances SHALL register in the AndroidManifest with metadata specifying: initial layout resource, resize mode (horizontal and vertical), minimum dimensions (at least 1×1 grid cells / 40dp × 40dp), and a preview image resource
4. WHEN the app completes a sync operation, THE Widget_Provider instances SHALL receive a broadcast intent to refresh their data within 5 seconds of sync completion
5. IF the user is not logged in, THEN THE Widget_Provider instances SHALL display a "Please log in" message and suppress all data queries until a valid session is detected
6. THE Widget_Config_Activity instances SHALL persist their configuration using SharedPreferences keyed by appWidgetId
7. WHEN a widget is removed from the home screen (onDeleted callback), THE Widget_Provider SHALL delete the associated SharedPreferences entry for that appWidgetId to prevent orphaned configuration data
