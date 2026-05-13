# Requirements Document

## Introduction

This feature re-implements the Indicators Zone (health tracking on chits) as a consumer of the generic Custom Objects registry. The current implementation in `editor-health.js` uses a hardcoded `_healthFields` array with fixed keys. This spec replaces that with a data-driven approach where the Indicators Zone queries the Custom Objects registry for its assigned objects, renders inputs dynamically based on value_type, evaluates conditional_display rules, and stores readings keyed by Custom Object UUID.

The feature also introduces a Quick-Log shortcut for rapid data entry, a Dashboard Indicators View with calendar and log modes, graph filtering by Custom Objects assigned to a "graphs" zone, legacy data migration from old keys to UUIDs, imperial/metric unit switching, and zone initialization that seeds default assignments for out-of-the-box functionality.

## Glossary

- **Indicators_Zone**: The zone within the chit editor that displays input fields for Custom Objects assigned to the "indicators_zone" zone identifier. It is a consumer of the Custom Objects registry.
- **Chit**: The core data record in CWOC — a flexible entity that can serve as a task, note, event, or health log. Health readings are stored in the chit's `health_data` JSON field.
- **Custom_Object**: A registered object definition in the Custom Objects registry. Has a type, name, value_type, units, acceptable_range, and optional conditional_display rule.
- **Zone_Assignment**: A record in the Custom Objects registry that maps a Custom_Object to a consumer zone (e.g., "indicators_zone") with a zone-specific config JSON blob.
- **Default_Indicator**: A Custom_Object whose indicators_zone Zone_Assignment has `config.is_default = true`. Default indicators appear on every chit automatically without user action.
- **Per_Chit_Indicator**: A non-default Custom_Object that a user adds to a specific chit via the "Add Indicator" picker. Stored in the chit's `health_data` alongside default indicator readings.
- **Acceptable_Range**: The min/max numeric boundary defined on a Custom_Object. The Indicators_Zone uses this for visual range highlighting.
- **Quick_Log**: A shortcut button on the Custom Objects Editor page that creates a new chit pre-configured for health data entry (point_in_time = now, status = "Complete").
- **Dashboard_Indicators_View**: A section on the main dashboard that displays health readings in two modes: Calendar Mode (year-view grid) and Log Mode (reverse-chronological list).
- **Calendar_Mode**: A year-view grid in the Dashboard Indicators View showing days that have health readings, color-coded by whether values fall within acceptable ranges.
- **Log_Mode**: A reverse-chronological list in the Dashboard Indicators View showing chits that contain health readings.
- **Graph_Filter**: A dropdown on the graphs view listing Custom Objects assigned to the "graphs" zone, allowing the user to select which objects to graph.
- **Legacy_Key**: The old string keys used in `chit.health_data` before migration (e.g., "heart_rate", "weight", "bp_systolic"). These are replaced by Custom Object UUIDs.
- **Unit_System**: The user's preference for imperial or metric units, stored in user settings as `unit_system`.
- **Conditional_Display**: A JSON rule on a Custom_Object (e.g., `{"setting": "sex", "equals": "Woman"}`) that the Indicators_Zone evaluates against cached user settings to determine visibility.

## Requirements

### Requirement 1: Indicators Zone Rendering

**User Story:** As a user, I want the health indicators zone on the chit editor to dynamically render input fields based on Custom Objects assigned to the "indicators_zone" zone, so that I can track any custom health metric without hardcoded fields.

#### Acceptance Criteria

1. WHEN the chit editor loads, THE Indicators_Zone SHALL query GET /api/custom-objects/zone/indicators_zone to retrieve all active Custom Objects assigned to the indicators zone.
2. FOR EACH Custom_Object returned by the zone query, THE Indicators_Zone SHALL evaluate the conditional_display rule against cached user settings and render the input field only when the rule evaluates to true or no rule is defined.
3. WHEN a Custom_Object has value_type "integer" or "decimal", THE Indicators_Zone SHALL render a numeric input field.
4. WHEN a Custom_Object has value_type "boolean", THE Indicators_Zone SHALL render a checkbox input.
5. WHEN a Custom_Object has value_type "string", THE Indicators_Zone SHALL render a text input field.
6. THE Indicators_Zone SHALL display the Custom_Object name as the field label and the appropriate unit string (based on the user's Unit_System setting) beside the input.
7. THE Indicators_Zone SHALL store all readings in `chit.health_data` as a JSON object keyed by Custom_Object UUID.
8. WHEN the user modifies any indicator input value, THE Indicators_Zone SHALL mark the chit as having unsaved changes.
9. THE Indicators_Zone SHALL render fields in the sort_order defined by each object's Zone_Assignment sort_order.

### Requirement 2: Default vs. Per-Chit Indicators

**User Story:** As a user, I want certain indicators to appear on every chit automatically while allowing me to add additional indicators on specific chits, so that I have a consistent baseline with flexibility for one-off tracking.

#### Acceptance Criteria

1. WHEN a Custom_Object's indicators_zone Zone_Assignment has `config.is_default = true`, THE Indicators_Zone SHALL display that object's input field on every chit without user action.
2. WHEN a Custom_Object's indicators_zone Zone_Assignment has `config.is_default = false` or `config.is_default` is absent, THE Indicators_Zone SHALL NOT display that object's input field unless the user explicitly adds it to the current chit.
3. THE Indicators_Zone SHALL provide an "Add Indicator" button that opens a picker showing all non-default Custom Objects assigned to the indicators zone.
4. WHEN the user selects an indicator from the "Add Indicator" picker, THE Indicators_Zone SHALL render that object's input field on the current chit.
5. WHEN a chit is saved with a reading for a Per_Chit_Indicator, THE Indicators_Zone SHALL persist that indicator's UUID in the chit's health_data so it reappears when the chit is reopened.
6. WHEN a chit is reopened and its health_data contains readings for Per_Chit_Indicators, THE Indicators_Zone SHALL render those indicators alongside the default indicators.

### Requirement 3: Range Highlighting

**User Story:** As a user, I want numeric values outside the acceptable range to be visually highlighted, so that I can immediately see when a reading is abnormal.

#### Acceptance Criteria

1. WHEN a numeric input value exceeds the Custom_Object's acceptable_range max, THE Indicators_Zone SHALL apply a red visual highlight to that input field.
2. WHEN a numeric input value is below the Custom_Object's acceptable_range min, THE Indicators_Zone SHALL apply a blue visual highlight to that input field.
3. WHEN a numeric input value is within the acceptable_range (inclusive of min and max), THE Indicators_Zone SHALL display the input field with no range highlight.
4. WHEN a Custom_Object has no acceptable_range defined (both min and max are null), THE Indicators_Zone SHALL display the input field with no range highlight regardless of value.
5. THE Indicators_Zone SHALL update the range highlight in real time as the user types a value.

### Requirement 4: Quick-Log Chit Creation

**User Story:** As a user, I want a "Quick Log" button on the Custom Objects Editor page that instantly creates a health-tracking chit, so that I can rapidly log readings without navigating through the full chit creation flow.

#### Acceptance Criteria

1. THE Custom_Objects_Editor SHALL display a "Quick Log" button in a visible location on the page.
2. WHEN the user clicks the "Quick Log" button, THE System SHALL create a new chit with point_in_time set to the current date and time.
3. WHEN the user clicks the "Quick Log" button, THE System SHALL set the new chit's status to "Complete".
4. WHEN the new Quick_Log chit is created, THE System SHALL open the chit editor with the Indicators_Zone pre-populated and ready for data entry.
5. THE Quick_Log chit SHALL include all Default_Indicators pre-rendered in the Indicators_Zone upon opening.

### Requirement 5: Dashboard Indicators View — Calendar Mode

**User Story:** As a user, I want a year-view calendar grid on the dashboard showing which days have health readings and whether values are in range, so that I can see long-term health patterns at a glance.

#### Acceptance Criteria

1. THE Dashboard_Indicators_View SHALL provide a Calendar_Mode that displays a year-view grid with one cell per day.
2. WHEN a day has at least one chit containing health_data readings, THE Calendar_Mode SHALL visually mark that day's cell as having data.
3. WHEN all numeric readings for a day fall within their respective Custom_Object acceptable_ranges, THE Calendar_Mode SHALL color-code that day's cell with a positive color (green).
4. WHEN any numeric reading for a day falls outside its Custom_Object acceptable_range, THE Calendar_Mode SHALL color-code that day's cell with a warning color (amber or red).
5. WHEN a day has no chits with health_data, THE Calendar_Mode SHALL leave that day's cell unmarked.
6. WHEN the user clicks a marked day cell, THE Calendar_Mode SHALL navigate to or display the chit(s) for that day.

### Requirement 6: Dashboard Indicators View — Log Mode

**User Story:** As a user, I want a reverse-chronological list of chits with health readings on the dashboard, so that I can review my recent health entries in detail.

#### Acceptance Criteria

1. THE Dashboard_Indicators_View SHALL provide a Log_Mode that displays chits containing health_data in reverse-chronological order.
2. FOR EACH chit in the Log_Mode list, THE Dashboard_Indicators_View SHALL display the chit's date, and a summary of the readings (indicator names and values).
3. THE Dashboard_Indicators_View SHALL resolve Custom_Object UUIDs in health_data to their display names when rendering the log.
4. WHEN the user clicks a chit entry in the Log_Mode list, THE Dashboard_Indicators_View SHALL open that chit in the editor.
5. THE Dashboard_Indicators_View SHALL provide a toggle to switch between Calendar_Mode and Log_Mode.

### Requirement 7: Graph Filtering

**User Story:** As a user, I want to filter graphs by Custom Objects assigned to the "graphs" zone, so that I can visualize trends for specific health metrics over time.

#### Acceptance Criteria

1. THE Graphs_View SHALL display a filter dropdown listing all active Custom Objects assigned to the "graphs" zone.
2. WHEN the user selects a Custom_Object from the filter dropdown, THE Graphs_View SHALL display a graph of that object's readings over time.
3. THE Graphs_View SHALL provide an "Add Graph" option that allows the user to create a one-off graph for any Custom_Object not currently in the filter list.
4. WHEN the user selects filter options, THE Graphs_View SHALL persist those selections so they are restored on the next visit.
5. THE Graphs_View SHALL query chit health_data across all chits to extract readings for the selected Custom_Object, using the object's UUID as the key.

### Requirement 8: Legacy Data Migration

**User Story:** As a user, I want my existing health data (stored with legacy keys like "heart_rate", "weight") to be automatically migrated to Custom Object UUIDs, so that the new system works seamlessly with my historical data.

#### Acceptance Criteria

1. WHEN the migration runs, THE System SHALL scan all chits with health_data containing Legacy_Keys and map each legacy key to the corresponding seeded Custom_Object UUID.
2. WHEN a legacy key is found in a chit's health_data, THE System SHALL add a new entry keyed by the Custom_Object UUID with the same value, preserving the original legacy key entry.
3. THE Migration SHALL be idempotent — running it multiple times SHALL produce the same result as running it once, with no duplicate entries or data corruption.
4. THE Migration SHALL create indicators_zone Zone_Assignments (with config.is_default = true) for all seeded Vital, Body, and Activity Custom_Objects that have corresponding legacy keys.
5. IF a chit's health_data contains a legacy key that does not map to any seeded Custom_Object, THEN THE Migration SHALL leave that entry unchanged and log a warning.
6. THE Migration SHALL handle the blood pressure special case by mapping legacy keys "bp_systolic" and "bp_diastolic" to their respective Custom_Object UUIDs.

### Requirement 9: Imperial/Metric Unit Switching

**User Story:** As a user, I want health indicators to display in my preferred unit system (imperial or metric), so that readings are shown in units I understand.

#### Acceptance Criteria

1. THE Indicators_Zone SHALL read the user's unit_system setting from cached settings to determine which unit labels to display.
2. WHEN the user's unit_system is "imperial", THE Indicators_Zone SHALL display the Custom_Object's `units` field value as the unit label.
3. WHEN the user's unit_system is "metric", THE Indicators_Zone SHALL display the Custom_Object's `metric_units` field value as the unit label.
4. WHEN a Custom_Object has identical units and metric_units values (e.g., "bpm"), THE Indicators_Zone SHALL display that unit regardless of the unit_system setting.
5. THE Indicators_Zone SHALL store raw numeric values without unit conversion — the unit label is display-only and does not transform the stored value.

### Requirement 10: Zone Initialization

**User Story:** As a user, I want the indicators zone to come pre-configured with standard vital signs, body measurements, and activity metrics assigned as defaults, so that health tracking works out of the box without manual setup.

#### Acceptance Criteria

1. WHEN the indicators zone consumer is initialized for the first time, THE System SHALL create Zone_Assignments for all seeded Vital-type Custom_Objects (Heart Rate, Blood Pressure Systolic, Blood Pressure Diastolic, Oxygen Saturation, Temperature) with zone_id = "indicators_zone" and config = {"is_default": true}.
2. WHEN the indicators zone consumer is initialized for the first time, THE System SHALL create Zone_Assignments for all seeded Measurement-type Custom_Objects (Weight, Height, Glucose) with zone_id = "indicators_zone" and config = {"is_default": true}.
3. WHEN the indicators zone consumer is initialized for the first time, THE System SHALL create Zone_Assignments for all seeded Activity-type Custom_Objects (Distance, Calories) with zone_id = "indicators_zone" and config = {"is_default": true}.
4. WHEN the indicators zone consumer is initialized for the first time, THE System SHALL create Zone_Assignments for the "Period Active" Custom_Object with zone_id = "indicators_zone" and config = {"is_default": true}.
5. THE Zone_Initialization SHALL be idempotent — running it multiple times SHALL NOT create duplicate Zone_Assignments.
6. THE Zone_Initialization SHALL run as a startup migration, after the Custom Objects seed data has been created.
