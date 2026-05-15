# Requirements Document

## Introduction

Timezone support for CWOC's chit system, introducing the concept of "floating" vs "anchored" chits. Floating chits (the default) have times that move with the user — 8am is always 8am wherever they are. Anchored chits have times locked to a specific IANA timezone — a noon meeting in San Diego is always noon Pacific, displayed converted to the user's current local time. The feature adds timezone storage, detection, display conversion, and correct alarm/recurrence behavior with no external dependencies (Python `zoneinfo` + browser `Intl` APIs).

## Glossary

- **CWOC**: C.W.'s Omni Chits — the host application
- **Chit**: The core data record in CWOC (task, note, event, alarm, etc.)
- **Floating_Chit**: A chit with no explicit timezone set (`timezone` field is null). Times are interpreted relative to the user's current timezone.
- **Anchored_Chit**: A chit with an explicit IANA timezone set. Times are locked to that timezone and displayed converted to the user's local time.
- **Current_Timezone**: The user's active timezone, determined by manual override (if set) or browser auto-detection (fallback).
- **IANA_Timezone**: A timezone identifier from the IANA Time Zone Database (e.g., "America/Denver", "Europe/London").
- **Timezone_Picker**: A searchable dropdown UI component for selecting an IANA timezone.
- **Editor**: The chit editor page (`editor.html`) where users create and modify chits.
- **Settings_Page**: The settings page where user preferences are configured.
- **Scheduler**: The backend component (`schedulers.py`) responsible for firing alerts and alarms.
- **Recurrence_Engine**: The backend/frontend logic that expands recurring chits into individual occurrences.
- **ICS_Serializer**: The backend component (`ics_serializer.py`) that exports chits to iCalendar format.
- **Dashboard**: The main CWOC page (`index.html`) showing calendar, tasks, and other views.

## Requirements

### Requirement 1: User Timezone Settings

**User Story:** As a user, I want to configure my default timezone and optionally override my current timezone, so that CWOC displays and triggers times correctly regardless of my physical location or device settings.

#### Acceptance Criteria

1. THE Settings_Page SHALL provide a "Default Timezone" field that accepts a valid IANA timezone value selected from the list returned by `Intl.supportedValuesOf('timeZone')`.
2. THE Settings_Page SHALL provide a "Current Timezone Override" field that accepts a valid IANA timezone value selected from the list returned by `Intl.supportedValuesOf('timeZone')`, or an empty value to clear the override.
3. IF the user submits a timezone value that is not present in the IANA timezone list, THEN THE Settings_Page SHALL reject the input and display an error message indicating the value is not a recognized timezone.
4. WHEN the Current Timezone Override is set to a valid IANA timezone, THE CWOC system SHALL use that value as the Current_Timezone.
5. IF the Current Timezone Override is empty, THEN THE CWOC system SHALL use the browser-detected timezone as the Current_Timezone.
6. THE CWOC system SHALL detect the browser timezone using `Intl.DateTimeFormat().resolvedOptions().timeZone`.
7. IF browser timezone detection returns an undefined or empty value, THEN THE CWOC system SHALL fall back to the user's stored Default Timezone as the Current_Timezone.
8. WHEN the user saves the settings form, THE Settings_Page SHALL persist the Default Timezone and Current Timezone Override values to the backend settings table.
9. IF no Default Timezone has been previously saved for the user, THEN THE Settings_Page SHALL pre-populate the Default Timezone field with the browser-detected timezone on first load.

### Requirement 2: Chit Timezone Storage

**User Story:** As a user, I want each chit to optionally store a timezone, so that I can anchor specific events to a location's timezone while leaving routine chits floating.

#### Acceptance Criteria

1. THE Chit data model SHALL include a `timezone` field that stores a valid IANA_Timezone string (maximum 64 characters) or null.
2. WHEN the `timezone` field is null, THE CWOC system SHALL classify the chit as a Floating_Chit, meaning its datetime fields are interpreted in the viewer's local timezone.
3. WHEN the `timezone` field contains a valid IANA_Timezone string, THE CWOC system SHALL classify the chit as an Anchored_Chit, meaning its datetime fields are interpreted in the stored timezone regardless of the viewer's local timezone.
4. THE backend SHALL add a nullable `timezone` text column to the chits table via a migration in `migrations.py`.
5. THE backend SHALL accept and persist the `timezone` field on chit create and update API calls.
6. IF the `timezone` field on a create or update request contains a non-null value that is not a recognized IANA timezone identifier, THEN THE backend SHALL reject the request with an error response indicating the timezone value is invalid.
7. THE backend SHALL treat all existing chits (with null timezone) as Floating_Chits without requiring a data migration prompt.

### Requirement 3: Timezone Picker in Editor

**User Story:** As a user, I want a timezone picker in the chit editor that stays hidden until I need it, so that the common case remains uncluttered while I can still anchor chits when needed.

#### Acceptance Criteria

1. WHILE a date mode other than "None" is active, THE Editor SHALL display a "Set timezone" link in the dates zone.
2. WHEN the user clicks the "Set timezone" link, THE Editor SHALL reveal the Timezone_Picker and hide the "Set timezone" link.
3. THE Timezone_Picker SHALL display a searchable dropdown populated with IANA timezone names from `Intl.supportedValuesOf('timeZone')`.
4. WHEN the user selects a timezone from the Timezone_Picker, THE Editor SHALL store that value in the chit's `timezone` field and display the selected timezone name adjacent to the picker.
5. WHEN an Anchored_Chit is opened in the Editor, THE Editor SHALL reveal the Timezone_Picker pre-filled with the chit's stored timezone (the "Set timezone" link is not shown).
6. THE Timezone_Picker SHALL provide a clear button that removes the timezone value from the chit's `timezone` field, reverts the chit to floating, and collapses the picker back to the "Set timezone" link.
7. IF the date mode is changed to "None" while the Timezone_Picker is visible, THEN THE Editor SHALL hide the Timezone_Picker and the "Set timezone" link.

### Requirement 4: Location-Based Timezone Suggestion

**User Story:** As a user, I want CWOC to suggest a timezone when my chit's location is in a different timezone, so that I can quickly anchor travel events without manually searching for the timezone.

#### Acceptance Criteria

1. WHEN a chit's location geocode completes and the resolved timezone differs from the Current_Timezone, THE Editor SHALL display a suggestion prompt indicating the detected IANA timezone and offering accept/dismiss actions.
2. WHEN the user accepts the timezone suggestion, THE Editor SHALL set the chit's `timezone` field to the detected IANA timezone and dismiss the suggestion prompt.
3. WHEN the user dismisses the timezone suggestion, THE Editor SHALL leave the chit's `timezone` field unchanged and hide the suggestion prompt.
4. WHEN a location-based timezone is detected, THE Timezone_Picker SHALL pre-select that detected timezone.
5. IF the chit already has an explicit timezone set, THEN THE Editor SHALL NOT display the location-based timezone suggestion.
6. IF timezone detection fails due to geocoding error or unavailable data, THEN THE Editor SHALL not display any suggestion prompt and SHALL leave the chit's `timezone` field unchanged.

### Requirement 5: Time Display Conversion

**User Story:** As a user, I want all displayed times converted to my current local timezone, so that I always see "when do I need to be ready" rather than the time in a remote timezone.

#### Acceptance Criteria

1. THE Dashboard SHALL display all Anchored_Chit times converted from the chit's stored timezone to the Current_Timezone.
2. THE Dashboard SHALL display all Floating_Chit times as-is without timezone conversion (they are already in the user's current timezone by definition).
3. THE CWOC system SHALL use `Intl.DateTimeFormat` with the `timeZone` option for all time display conversions.
4. THE Calendar view SHALL render Anchored_Chit events at the time slot corresponding to their converted Current_Timezone value, so that the event's vertical or temporal position reflects the local equivalent time.
5. THE CWOC system SHALL resolve Current_Timezone using the following precedence: manual timezone override setting (if set) takes priority, otherwise the browser-detected timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` is used as fallback.
6. IF an Anchored_Chit's stored timezone is invalid or unrecognized by the browser's Intl API, THEN THE CWOC system SHALL fall back to displaying the chit's time unconverted (as if it were a Floating_Chit) and SHALL display a visual indicator that the timezone could not be resolved.
7. WHEN the resolved Current_Timezone changes (due to manual override update or browser timezone shift), THEN THE Dashboard SHALL re-render all displayed Anchored_Chit times using the new Current_Timezone without requiring a full page reload.

### Requirement 6: Alert and Alarm Scheduling

**User Story:** As a user, I want floating chit alarms to fire at my local wall-clock time and anchored chit alarms to fire at the correct absolute moment, so that I am alerted at the right time regardless of timezone semantics.

#### Acceptance Criteria

1. WHEN the scheduled wall-clock time arrives for a Floating_Chit alert, THE Scheduler SHALL trigger the alert at that wall-clock time interpreted in the user's Current_Timezone.
2. WHEN the scheduled time arrives for an Anchored_Chit alert, THE Scheduler SHALL trigger the alert at the wall-clock time in the chit's stored timezone, representing the correct absolute moment regardless of the user's Current_Timezone.
3. WHEN the user's Current_Timezone changes, THE Scheduler SHALL recalculate all pending alert times for Floating_Chits based on the new Current_Timezone within 60 seconds of the change being detected.
4. WHEN the user's Current_Timezone changes, THE Scheduler SHALL NOT recalculate alert times for Anchored_Chits.
5. IF a timezone change causes a Floating_Chit alert's recalculated wall-clock time to fall in the past (earlier than the current moment), THEN THE Scheduler SHALL fire that alert immediately upon recalculation.
6. THE Scheduler SHALL use Python `zoneinfo` for all timezone-aware datetime calculations.
7. IF a Floating_Chit alert is scheduled for a wall-clock time that does not exist due to a DST spring-forward transition, THEN THE Scheduler SHALL fire the alert at the next valid minute after the transition (e.g., 3:00 AM if 2:00–2:59 AM is skipped).

### Requirement 7: Recurrence Expansion with Timezone Awareness

**User Story:** As a user, I want recurring chits to expand correctly in their timezone, handling DST transitions properly, so that a "daily 9am Pacific" event stays at 9am Pacific even across daylight saving changes.

#### Acceptance Criteria

1. WHEN expanding occurrences for an Anchored_Chit, THE Recurrence_Engine SHALL compute each occurrence in the chit's stored IANA timezone, producing wall-clock times that reflect that timezone's UTC offset at each occurrence date.
2. WHEN expanding occurrences for a Floating_Chit, THE Recurrence_Engine SHALL compute each occurrence in the Current_Timezone (manual override if set, otherwise browser-detected timezone).
3. WHEN expanding occurrences for an Anchored_Chit whose stored timezone observes DST, THE Recurrence_Engine SHALL produce each occurrence at the same wall-clock time in that timezone regardless of whether the occurrence falls in standard time or daylight saving time.
4. IF an occurrence's wall-clock time falls within a spring-forward DST gap (e.g., 2:30 AM when clocks skip from 2:00 AM to 3:00 AM), THEN THE Recurrence_Engine SHALL shift that occurrence forward to the first valid instant after the gap in that timezone (e.g., 3:00 AM).
5. IF an occurrence's wall-clock time is ambiguous due to a fall-back DST transition (e.g., 1:30 AM occurs twice), THEN THE Recurrence_Engine SHALL select the first occurrence of that wall-clock time (the pre-transition/standard-time instance).
6. IF a chit's stored timezone value is not a recognized IANA timezone identifier, THEN THE Recurrence_Engine SHALL fall back to the user's default timezone for expansion and treat the chit as Floating.
7. WHEN expanding occurrences for a sub-daily frequency (MINUTELY or HOURLY) across a DST transition, THE Recurrence_Engine SHALL maintain uniform elapsed-time intervals between occurrences (absolute duration) rather than preserving wall-clock alignment.

### Requirement 8: ICS Export with Timezone Support

**User Story:** As a user, I want exported ICS files to include proper timezone information, so that imported events in other calendar applications display at the correct time.

#### Acceptance Criteria

1. WHEN exporting an Anchored_Chit, THE ICS_Serializer SHALL emit a `VTIMEZONE` component for the chit's timezone and use `DTSTART;TZID=[timezone]` and `DTEND;TZID=[timezone]` format for its start_datetime and end_datetime properties.
2. WHEN exporting a Floating_Chit, THE ICS_Serializer SHALL emit date-time properties as naive local times without a TZID parameter and without a UTC "Z" suffix.
3. WHEN exporting a chit where all_day is true, THE ICS_Serializer SHALL emit `DTSTART;VALUE=DATE` and `DTEND;VALUE=DATE` using the `YYYYMMDD` format without time components or timezone references.
4. WHEN exporting an Anchored_Chit that has a recurrence_rule, THE ICS_Serializer SHALL emit the `RRULE` property and expand recurrence exceptions (`EXDATE`) using the chit's timezone as the TZID context.
5. IF a chit has no start_datetime and no due_datetime, THEN THE ICS_Serializer SHALL omit that chit from the exported ICS output.
6. THE ICS_Serializer SHALL produce output that conforms to RFC 5545, including a `VCALENDAR` wrapper with `VERSION:2.0`, one `VEVENT` per exported chit, and at most one `VTIMEZONE` component per unique timezone referenced in the file.

### Requirement 9: Frontend Timezone Detection Utility

**User Story:** As a developer, I want a shared frontend utility that resolves the user's current timezone (override → browser fallback), so that all frontend components use a single consistent timezone source.

#### Acceptance Criteria

1. THE CWOC frontend SHALL provide a shared utility function that returns the Current_Timezone as a valid IANA_Timezone string (e.g., "America/Denver").
2. THE shared utility SHALL return a Promise that resolves to the Current_Timezone, since the user's settings are loaded asynchronously via the settings cache.
3. THE shared utility SHALL check the cached settings for a Current Timezone Override field, treating any non-empty string value as a configured override.
4. WHEN no override is configured (field is null, undefined, or empty string), THE shared utility SHALL fall back to the browser-detected timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
5. IF the settings cache fails to load, THEN THE shared utility SHALL fall back to the browser-detected timezone without throwing an error.
6. THE shared utility SHALL reside in `shared-utils.js` and be available to all frontend pages via the shared script loading order.
