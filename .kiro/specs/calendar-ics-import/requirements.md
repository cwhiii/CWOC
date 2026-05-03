# Requirements Document

## Introduction

Calendar ICS Import allows CWOC users to import calendar events and tasks from Google Calendar, Apple Calendar, and Windows/Outlook via standard `.ics` files (iCalendar format, RFC 5545). A single parser handles all three sources since they all conform to the iCalendar specification. Imported VEVENT and VTODO components are mapped to CWOC chits with appropriate field mappings, recurrence rule translation, and duplicate detection.

## Glossary

- **ICS_Parser**: The backend Python module that parses iCalendar (.ics) file content into structured component data
- **ICS_Printer**: The backend Python module that serializes CWOC chit data back into valid iCalendar (.ics) format
- **Import_Endpoint**: The FastAPI route that accepts uploaded .ics file content and orchestrates parsing, mapping, duplicate detection, and chit creation
- **Import_UI**: The frontend interface (file picker, preview, and confirmation) for uploading .ics files
- **VEVENT**: An iCalendar component representing a calendar event (has DTSTART, optional DTEND, SUMMARY, etc.)
- **VTODO**: An iCalendar component representing a task/reminder (has optional DUE, SUMMARY, STATUS, etc.)
- **RRULE**: An iCalendar recurrence rule property that defines repeating patterns (frequency, interval, by-day, until/count)
- **Chit**: The core CWOC data record that can serve as a task, note, calendar event, alarm, or checklist
- **Duplicate_Detector**: The logic that identifies whether an imported event already exists in the user's chits based on title + start_datetime matching

## Requirements

### Requirement 1: ICS File Parsing

**User Story:** As a CWOC user, I want to upload an .ics file exported from Google Calendar, Apple Calendar, or Outlook, so that my external calendar events become chits in CWOC.

#### Acceptance Criteria

1. WHEN a valid .ics file containing one or more VEVENT components is provided, THE ICS_Parser SHALL parse each VEVENT into a structured dictionary containing at minimum: summary, dtstart, dtend, description, location, categories, priority, uid, and rrule fields
2. WHEN a valid .ics file containing one or more VTODO components is provided, THE ICS_Parser SHALL parse each VTODO into a structured dictionary containing at minimum: summary, due, description, status, priority, uid, and categories fields
3. IF the .ics file content does not begin with "BEGIN:VCALENDAR" or does not contain at least one VEVENT or VTODO component, THEN THE ICS_Parser SHALL return a descriptive error indicating the file is not a valid iCalendar file
4. WHEN a property value spans multiple lines via RFC 5545 line folding (continuation lines starting with a space or tab), THE ICS_Parser SHALL unfold the lines and produce the complete property value
5. WHEN a DTSTART or DTEND property includes a TZID parameter, THE ICS_Parser SHALL preserve the timezone identifier alongside the datetime value
6. WHEN a DTSTART or DTEND value is a DATE type (8 digits, no time component), THE ICS_Parser SHALL mark the event as all-day
7. FOR ALL valid iCalendar files, parsing then printing then parsing SHALL produce equivalent component data (round-trip property)

### Requirement 2: ICS Pretty Printer

**User Story:** As a developer, I want a printer that serializes CWOC chit data back into valid .ics format, so that round-trip testing can verify parser correctness.

#### Acceptance Criteria

1. WHEN a list of parsed component dictionaries is provided, THE ICS_Printer SHALL produce a valid iCalendar string beginning with "BEGIN:VCALENDAR" and ending with "END:VCALENDAR"
2. THE ICS_Printer SHALL format each VEVENT component with properly formatted DTSTART, DTEND, SUMMARY, DESCRIPTION, LOCATION, CATEGORIES, PRIORITY, and UID properties
3. THE ICS_Printer SHALL format each VTODO component with properly formatted SUMMARY, DUE, STATUS, PRIORITY, DESCRIPTION, CATEGORIES, and UID properties
4. WHEN a component has an RRULE, THE ICS_Printer SHALL serialize the recurrence rule back into valid RFC 5545 RRULE format

### Requirement 3: Field Mapping to Chits

**User Story:** As a CWOC user, I want imported calendar events to appear as properly populated chits, so that I can manage them alongside my existing data.

#### Acceptance Criteria

1. WHEN a VEVENT is imported, THE Import_Endpoint SHALL map SUMMARY to chit title, DESCRIPTION to chit note, DTSTART to chit start_datetime, DTEND to chit end_datetime, LOCATION to chit location, and CATEGORIES to chit tags
2. WHEN a VEVENT has a PRIORITY value of 1–4, THE Import_Endpoint SHALL map the priority to "High"; WHEN the value is 5, THE Import_Endpoint SHALL map to "Medium"; WHEN the value is 6–9, THE Import_Endpoint SHALL map to "Low"
3. WHEN a VEVENT has a DATE-only DTSTART (no time component), THE Import_Endpoint SHALL set the chit all_day field to true
4. WHEN a VTODO is imported, THE Import_Endpoint SHALL map SUMMARY to chit title, DESCRIPTION to chit note, DUE to chit due_datetime, and CATEGORIES to chit tags
5. WHEN a VTODO has a STATUS of "COMPLETED", THE Import_Endpoint SHALL set the chit status to "Complete"; WHEN STATUS is "IN-PROCESS", THE Import_Endpoint SHALL set chit status to "In Progress"; WHEN STATUS is "NEEDS-ACTION", THE Import_Endpoint SHALL set chit status to "ToDo"
6. WHEN a VTODO has a PRIORITY value, THE Import_Endpoint SHALL apply the same priority mapping as VEVENT (1–4 → High, 5 → Medium, 6–9 → Low)
7. THE Import_Endpoint SHALL assign the authenticated user as owner_id, owner_display_name, and owner_username on all imported chits
8. THE Import_Endpoint SHALL automatically add the system tag `cwoc_system/imported` to the tags list of every imported chit, in addition to any tags derived from CATEGORIES

### Requirement 4: Recurrence Rule Mapping

**User Story:** As a CWOC user, I want recurring calendar events to import with their repeat patterns preserved, so that I see them correctly on the CWOC calendar.

#### Acceptance Criteria

1. WHEN a VEVENT has an RRULE with FREQ=DAILY, THE Import_Endpoint SHALL create a chit recurrence_rule with freq "DAILY" and the corresponding INTERVAL value
2. WHEN a VEVENT has an RRULE with FREQ=WEEKLY and a BYDAY list, THE Import_Endpoint SHALL create a chit recurrence_rule with freq "WEEKLY", the corresponding INTERVAL, and byDay mapped from RFC 5545 day abbreviations (MO, TU, WE, TH, FR, SA, SU) to the CWOC format
3. WHEN a VEVENT has an RRULE with FREQ=MONTHLY, THE Import_Endpoint SHALL create a chit recurrence_rule with freq "MONTHLY" and the corresponding INTERVAL value
4. WHEN a VEVENT has an RRULE with FREQ=YEARLY, THE Import_Endpoint SHALL create a chit recurrence_rule with freq "YEARLY" and the corresponding INTERVAL value
5. WHEN an RRULE contains an UNTIL clause, THE Import_Endpoint SHALL set the recurrence_rule until field to the UNTIL date in ISO format
6. WHEN an RRULE contains a COUNT clause, THE Import_Endpoint SHALL compute an approximate until date by multiplying COUNT by the interval and frequency, and set the recurrence_rule until field accordingly
7. IF an RRULE contains FREQ values not supported by CWOC (SECONDLY, MINUTELY, HOURLY), THEN THE Import_Endpoint SHALL skip the recurrence rule and import the event as a single occurrence, including a note indicating the unsupported recurrence was dropped

### Requirement 5: Duplicate Detection

**User Story:** As a CWOC user, I want the import to detect events that already exist in my chits, so that I do not end up with duplicate entries when re-importing a calendar file.

#### Acceptance Criteria

1. WHEN an imported VEVENT or VTODO has a title and start_datetime (or due_datetime for VTODO) that exactly match an existing non-deleted chit owned by the authenticated user, THE Duplicate_Detector SHALL flag the component as a duplicate
2. WHEN a duplicate is detected, THE Import_Endpoint SHALL skip that component and increment a "skipped" counter in the import summary
3. THE Import_Endpoint SHALL perform duplicate detection using case-sensitive title comparison and exact datetime string matching (ISO format, to the minute)
4. WHEN all components in a file are duplicates, THE Import_Endpoint SHALL return a success response with imported count of 0 and the skipped count equal to the total component count

### Requirement 6: Import API Endpoint

**User Story:** As a CWOC user, I want a backend endpoint that accepts .ics file content and returns a summary of what was imported, so that the frontend can display results.

#### Acceptance Criteria

1. THE Import_Endpoint SHALL accept POST requests at `/api/import/ics` with the request body containing the raw .ics file text content as a JSON field
2. WHEN the import completes successfully, THE Import_Endpoint SHALL return a JSON response containing: imported count, skipped count (duplicates), errored count, and a list of error descriptions for any components that failed to parse
3. IF the provided content is not valid iCalendar data, THEN THE Import_Endpoint SHALL return HTTP 400 with a descriptive error message
4. THE Import_Endpoint SHALL process all components within a single database transaction, rolling back all inserts if an unrecoverable error occurs
5. THE Import_Endpoint SHALL scope all operations to the authenticated user (using request.state.user_id from AuthMiddleware)

### Requirement 7: Frontend Import Interface

**User Story:** As a CWOC user, I want a button in the Settings page that lets me pick an .ics file and see the import results, so that I can easily bring in my external calendar data.

#### Acceptance Criteria

1. THE Import_UI SHALL provide a button labeled "Import Calendar (.ics)" in the Data Management section of the Settings page
2. WHEN the user clicks the import button, THE Import_UI SHALL open a file picker dialog filtered to accept `.ics` files
3. WHEN a file is selected, THE Import_UI SHALL read the file content using FileReader, send it to the Import_Endpoint, and display the result summary (imported, skipped, errors) in an alert or modal
4. IF the Import_Endpoint returns an error response, THEN THE Import_UI SHALL display the error message to the user
5. WHILE the import request is in progress, THE Import_UI SHALL disable the import button and show a loading indicator to prevent duplicate submissions

### Requirement 8: Error Handling and Resilience

**User Story:** As a CWOC user, I want the import to handle malformed events gracefully, so that one bad event does not prevent the rest of my calendar from importing.

#### Acceptance Criteria

1. IF a single VEVENT or VTODO component within the file has malformed or missing required properties (no SUMMARY), THEN THE Import_Endpoint SHALL skip that component, record an error description, and continue processing remaining components
2. IF the .ics file contains components other than VEVENT and VTODO (such as VJOURNAL, VFREEBUSY, VTIMEZONE), THEN THE Import_Endpoint SHALL silently ignore those components without reporting errors
3. WHEN a VEVENT has a DTSTART but no DTEND, THE Import_Endpoint SHALL treat the event as having zero duration (end equals start) for timed events, or as a single-day event for DATE-only values
4. IF a CATEGORIES property contains multiple comma-separated values, THEN THE Import_Endpoint SHALL split them and add each as a separate tag on the chit
