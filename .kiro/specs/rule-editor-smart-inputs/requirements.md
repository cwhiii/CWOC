# Requirements Document

## Introduction

This feature enhances the CWOC Rule Editor with smarter, context-aware inputs for building rule conditions and actions. Currently, condition value fields use plain text inputs regardless of the field type. This feature replaces those with appropriate contextual inputs (dropdowns, autocomplete, pickers) based on the selected field. It also adds missing email fields to the condition builder, introduces a new "Create Chit" action type, and adds weather-based condition support for rules.

## Glossary

- **Rule_Editor**: The CWOC page (`rule-editor.html` + `rule-editor.js`) for creating and editing automation rules with conditions and actions
- **Condition_Builder**: The UI component within the Rule_Editor that allows users to construct condition trees (groups of leaf conditions with AND/OR logic)
- **Smart_Input**: A context-aware input widget that replaces a plain text field with an appropriate control (dropdown, autocomplete, color picker, tag picker) based on the selected condition field
- **Condition_Leaf**: A single condition node consisting of a field selector, operator selector, and value input
- **Action_Row**: A single action configuration within a rule, consisting of an action type selector and parameter inputs
- **Contact_Autocomplete**: A search-as-you-type input that queries the contacts API and displays matching contacts with their email addresses
- **Weather_Condition**: A condition type that evaluates weather forecast data for a specified location against configurable thresholds
- **Open_Meteo_API**: The external weather forecast API already integrated into CWOC for chit weather data

## Requirements

### Requirement 1: Add Missing Email Fields to Condition Builder

**User Story:** As a rule author, I want to filter by email_to, email_cc, email_bcc, and email_account_id fields, so that I can build conditions against all email metadata the backend supports.

#### Acceptance Criteria

1. WHEN the trigger type is "email_received," THE Rule_Editor SHALL display email_to, email_cc, email_bcc, and email_account_id as selectable fields in the condition field dropdown with labels "Email To," "Email CC," "Email BCC," and "Email Account" respectively
2. THE Rule_Editor SHALL position the new email fields immediately after the existing email_from entry in the EMAIL_FIELDS array, in the order: email_to, email_cc, email_bcc, email_account_id
3. WHEN a condition uses email_to, email_cc, or email_bcc, THE Rule_Editor SHALL offer the operators: equals, not_equals, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty, regex_match (the same set available for email_from)
4. WHEN a condition uses email_account_id, THE Rule_Editor SHALL offer only the operators: equals, not_equals, is_empty, is_not_empty

### Requirement 2: Smart Input for Email Address Fields

**User Story:** As a rule author, I want autocomplete suggestions from my contacts when entering email addresses, so that I can quickly select the correct address without memorizing it.

#### Acceptance Criteria

1. WHEN the selected condition field is email_from, email_to, email_cc, or email_bcc, THE Smart_Input SHALL render a Contact_Autocomplete input instead of a plain text field
2. WHEN the user types at least 2 characters into the Contact_Autocomplete, THE Smart_Input SHALL query the contacts API (matching against contact display name and email address values) and display up to 10 matching contacts with their associated email addresses
3. WHEN the user selects a contact email from the autocomplete results, THE Smart_Input SHALL populate the condition value with the selected email address and dismiss the autocomplete dropdown
4. THE Smart_Input SHALL allow manual text entry (up to 254 characters) at all times in addition to autocomplete selection, so that users can enter addresses not in their contacts, including wildcard patterns (e.g., *@gmail.com)
5. IF the contacts API is unreachable or returns an error, THEN THE Smart_Input SHALL dismiss the autocomplete dropdown and allow the user to continue with manual text entry without displaying an error
6. WHEN the Contact_Autocomplete input loses focus or the user presses Escape, THE Smart_Input SHALL dismiss the autocomplete dropdown without changing the current input value

### Requirement 3: Smart Input for Email Account ID

**User Story:** As a rule author, I want a dropdown of my configured email accounts when filtering by email_account_id, so that I can select the correct account without looking up its ID.

#### Acceptance Criteria

1. WHEN the selected condition field is email_account_id, THE Smart_Input SHALL render a dropdown populated with all configured email accounts retrieved from the settings API (email_accounts field)
2. THE Smart_Input SHALL display each email account using its nickname as the label if the nickname is a non-empty string, otherwise using the account's email address as the label, with the account ID as the underlying stored value
3. IF no email accounts are configured, THEN THE Smart_Input SHALL display an empty dropdown with a placeholder indicating no accounts are available
4. IF a condition has a previously saved email_account_id value that does not match any currently configured account, THEN THE Smart_Input SHALL still display the saved value as the selected option and visually indicate it is unrecognized

### Requirement 4: Smart Input for Priority Field

**User Story:** As a rule author, I want a dropdown of priority values when filtering by priority, so that I can select from valid options without guessing.

#### Acceptance Criteria

1. WHEN the selected condition field is priority, THE Smart_Input SHALL render a dropdown with the values: Low, Medium, High, Critical
2. THE Smart_Input SHALL pre-select the current condition value if one is already set
3. IF no condition value is currently set, THEN THE Smart_Input SHALL display a placeholder prompt without pre-selecting any value

### Requirement 5: Smart Input for Status Field

**User Story:** As a rule author, I want a dropdown of status values when filtering by status, so that I can select from valid options.

#### Acceptance Criteria

1. WHEN the selected condition field is status, THE Smart_Input SHALL render a dropdown with the values: ToDo, In Progress, Blocked, Complete, Rejected
2. THE Smart_Input SHALL pre-select the current condition value if one is already set
3. IF no condition value is currently set, THEN THE Smart_Input SHALL display a placeholder prompt without pre-selecting any value

### Requirement 6: Smart Input for Severity Field

**User Story:** As a rule author, I want a dropdown of severity values when filtering by severity, so that I can select from valid options.

#### Acceptance Criteria

1. WHEN the selected condition field is severity, THE Smart_Input SHALL render a dropdown with the values: Low, Medium, High, Critical
2. THE Smart_Input SHALL pre-select the current condition value if one is already set
3. IF no condition value is currently set, THEN THE Smart_Input SHALL display a placeholder prompt without pre-selecting any value

### Requirement 7: Smart Input for Location Field

**User Story:** As a rule author, I want to pick from my saved locations or type a custom one when filtering by location, so that I can quickly reference known places.

#### Acceptance Criteria

1. WHEN the selected condition field is location, THE Smart_Input SHALL render a combined dropdown and text input (combobox) displaying all saved locations loaded from the settings API (saved_locations field), showing each location's label as the display text and its address as the stored condition value
2. THE Smart_Input SHALL allow the user to type a custom location value (maximum 200 characters) that is not in the saved locations list, and use that text directly as the condition value
3. IF the settings API fails to return saved locations or the saved_locations field is empty, THEN THE Smart_Input SHALL render the text input with no dropdown options, allowing only manual entry

### Requirement 8: Smart Input for Color Field

**User Story:** As a rule author, I want a color picker when filtering by color, so that I can visually select the correct color value.

#### Acceptance Criteria

1. WHEN the selected condition field is color, THE Smart_Input SHALL render color swatches for each entry in the custom_colors array from settings, displaying each swatch filled with the entry's hex color value
2. WHEN the user selects a color swatch, THE Smart_Input SHALL populate the condition value with the selected color's hex string (e.g., "#8B4513")
3. WHEN a color swatch's hex value matches the current condition value, THE Smart_Input SHALL highlight that swatch with a visible border or checkmark to indicate selection
4. THE Smart_Input SHALL always display the default color palette swatches in addition to any custom_colors configured in settings

### Requirement 9: Smart Input for Tags Field

**User Story:** As a rule author, I want a tag picker when entering tag values in conditions, so that I can select from existing tags consistently.

#### Acceptance Criteria

1. WHEN the selected condition field is tags AND the operator is tag_present or tag_not_present, THE Smart_Input SHALL render the existing tag picker pattern already used in the Rule_Editor action rows
2. THE Smart_Input SHALL display all user-defined tags (excluding system tags) sorted with favorites first, then alphabetically by tag name
3. WHEN the user selects a tag, THE Smart_Input SHALL populate the condition value with the tag name

### Requirement 10: Smart Input for People Field

**User Story:** As a rule author, I want contact autocomplete when entering people values in conditions, so that I can search by name.

#### Acceptance Criteria

1. WHEN the selected condition field is people AND the operator is person_on_chit or person_not_on_chit, THE Smart_Input SHALL render a Contact_Autocomplete input that searches contacts by name
2. WHEN the user types at least 2 characters, THE Smart_Input SHALL query the contacts API and display up to 10 matching contact names using case-insensitive substring matching
3. WHEN the user selects a contact, THE Smart_Input SHALL populate the condition value with the contact's display name
4. THE Smart_Input SHALL allow manual text entry at all times regardless of API status, for names not in the contacts list
5. THE Smart_Input SHALL show autocomplete suggestions from cached results without requiring a new API call when cached data is available
6. IF the contacts API is unreachable or returns an error, THEN THE Smart_Input SHALL continue to allow manual text entry and not display autocomplete suggestions

### Requirement 11: Smart Input for Boolean Fields

**User Story:** As a rule author, I want a True/False dropdown for boolean fields, so that I do not have to type "true" or "false" manually.

#### Acceptance Criteria

1. WHEN the selected condition field is archived, pinned, all_day, habit, or email_read, THE Smart_Input SHALL render a dropdown with the values: true, false
2. THE Smart_Input SHALL pre-select the current condition value if one is already set
3. IF no condition value is currently set, THEN THE Smart_Input SHALL display a placeholder prompt without pre-selecting either value

### Requirement 12: Create Chit Action Type

**User Story:** As a rule author, I want a "Create Chit" action that creates a new chit with specified field values, so that rules can automatically generate new chits.

#### Acceptance Criteria

1. THE Rule_Editor SHALL include a "Create Chit" option in the action type dropdown
2. WHEN the user selects the "Create Chit" action, THE Rule_Editor SHALL display input fields for the new chit: title (text input), note (text input), status (status dropdown), priority (priority dropdown), tags (tag picker), start_datetime (datetime picker), due_datetime (datetime picker), location (location selector), color (color picker), and people (contact autocomplete), reusing the same Smart_Input controls defined for condition fields
3. THE Rule_Editor SHALL NOT require a title for the Create Chit action — all fields are optional
4. WHEN the rule executes the create_chit action, THE backend SHALL create a new chit record with the specified field values, the rule owner's user ID, and the current UTC timestamp as created_datetime
5. THE backend SHALL support template placeholders in all text fields (title, note, location) using double-brace syntax ({{matched_title}}, {{today}}, {{trigger_field}}) that are resolved at execution time against the triggering entity's field values and current date
6. IF a template placeholder cannot be resolved at execution time, THEN THE backend SHALL replace the unresolved placeholder with an empty string and proceed with chit creation
7. IF the create_chit action fails due to a database error, THEN THE backend SHALL roll back the entire transaction, ensuring no partial chit data remains, and return a failure result with an error message

### Requirement 13: Weather-Based Condition

**User Story:** As a rule author, I want to add weather-based conditions to my rules, so that I can trigger actions based on forecast data for a location.

#### Acceptance Criteria

1. THE Rule_Editor SHALL include weather condition fields (weather_code, weather_temperature_high, weather_temperature_low, weather_precipitation, weather_wind_speed) in the condition field dropdown only when the rule's trigger type is "scheduled"
2. WHEN a weather condition field is selected, THE Smart_Input SHALL display a location selector (using saved locations from user settings or manual text entry of an address) to specify which location's forecast to evaluate
3. WHEN the rule evaluates a weather condition, THE backend SHALL geocode the specified location, fetch the current day's daily forecast from the Open_Meteo_API for the resolved coordinates, and compare the forecast value against the condition threshold using the API's native units (Celsius for temperature, millimeters for precipitation, km/h for wind speed)
4. THE backend SHALL support numeric comparison operators (greater_than, less_than, equals) for weather_temperature_high, weather_temperature_low, weather_precipitation, and weather_wind_speed fields
5. THE backend SHALL support weather_code matching using equals and not_equals operators against WMO weather code values (e.g., 61 for slight rain, 95 for thunderstorm)
6. IF the Open_Meteo_API is unreachable or returns an error within the 15-second request timeout, THEN THE backend SHALL log the error, treat the weather condition as not met (false), and continue evaluating any remaining non-weather conditions in the rule
7. IF geocoding fails for the specified location, THEN THE backend SHALL log the error, treat the weather condition as not met (false), and continue evaluating any remaining non-weather conditions in the rule
