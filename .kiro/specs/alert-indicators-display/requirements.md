# Requirements Document

## Introduction

This feature adds visual alert indicators to chit displays across all CWOC views (Calendar, Checklists, Tasks, Notes, Alarms) except Projects. A single universal alert icon character is used on space-constrained views like the calendar, while the settings page gains a "Combine Alerts" toggle that controls whether alert indicator visibility is configured per-type or as a single combined setting. The feature integrates with the existing Visual Indicators settings section and honors the existing Always/Never/If Space display logic.

## Glossary

- **Alert_Indicator**: A visual icon character displayed alongside a chit title to signal that the chit has one or more alerts (alarm, timer, stopwatch, or notification).
- **Universal_Alert_Icon**: A single, unique icon character (e.g. `⚠` or `🔔`) used to represent any and all alert types in a combined fashion, occupying only one character width.
- **Combine_Alerts_Toggle**: A checkbox in the Visual Indicators settings section that switches between individual per-type alert dropdowns and a single combined alert dropdown.
- **Alert_Type**: One of the four alert categories stored in a chit's alerts array: alarm, timer, stopwatch, or notification.
- **Display_Mode**: The visibility setting for an indicator: Always (always show), Never (never show), or If Space (show only when space permits).
- **Settings_Page**: The CWOC settings page at `frontend/settings.html` managed by `frontend/settings.js`.
- **Dashboard**: The main CWOC dashboard at `frontend/index.html` managed by `frontend/main.js` and `frontend/shared.js`.
- **Chit_Header**: The header row rendered by `_buildChitHeader` for card-style views (Checklists, Tasks, Notes, Alarms).
- **Calendar_Event_Title**: The inline title rendered by `calendarEventTitle` in `frontend/shared.js` for calendar view entries.

## Requirements

### Requirement 1: Universal Alert Icon on Calendar Views

**User Story:** As a user, I want to see a single universal alert icon on calendar entries that have alerts, so that I can quickly identify chits with alerts without the icon consuming excessive space.

#### Acceptance Criteria

1. WHEN a chit has one or more alerts in its alerts array (with `_type` of alarm, timer, stopwatch, or notification) and the alert indicator Display_Mode permits display, THE Calendar_Event_Title SHALL prepend a single Universal_Alert_Icon character before the chit title.
2. THE Calendar_Event_Title SHALL display at most one Universal_Alert_Icon per chit regardless of how many alerts or alert types the chit contains.
3. WHEN a chit has legacy alarm or notification boolean flags set to true but no entries in the alerts array, THE Calendar_Event_Title SHALL treat the chit as having alerts for indicator purposes.
4. WHEN the alert indicator Display_Mode is set to Never, THE Calendar_Event_Title SHALL not display the Universal_Alert_Icon.
5. WHEN the alert indicator Display_Mode is set to Always, THE Calendar_Event_Title SHALL display the Universal_Alert_Icon on all calendar views (Week, Day, Month, Year, Itinerary, Seven-Day, X-Day).

### Requirement 2: Alert Indicator on Non-Calendar Views

**User Story:** As a user, I want to see alert indicators on chit entries in Checklists, Tasks, Notes, and Alarms views, so that I can identify chits with alerts regardless of which view I am using.

#### Acceptance Criteria

1. WHEN a chit has one or more alerts and the alert indicator Display_Mode permits display, THE Chit_Header SHALL display an alert indicator icon adjacent to the chit title.
2. THE Dashboard SHALL display alert indicators on the Checklists view, Tasks view, Notes view, and Alarms view.
3. THE Dashboard SHALL NOT display alert indicators on the Projects view.
4. WHEN the Combine_Alerts_Toggle is enabled, THE Chit_Header SHALL display a single Universal_Alert_Icon for any chit with alerts.
5. WHEN the Combine_Alerts_Toggle is disabled and individual alert type Display_Modes are configured, THE Chit_Header SHALL display separate icons for each alert type whose Display_Mode permits display (alarm: 🔔, notification: 📢, timer: ⏱️, stopwatch: ⏲️).
6. WHEN the alert indicator Display_Mode is set to Never for all applicable alert types, THE Chit_Header SHALL not display any alert indicator icons.

### Requirement 3: Combine Alerts Toggle in Settings

**User Story:** As a user, I want a "Combine Alerts" checkbox in the Visual Indicators settings, so that I can choose between seeing one combined alert indicator or individual per-type indicators.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a "Combine Alerts" checkbox within the Visual Indicators section.
2. WHEN the Combine_Alerts_Toggle is enabled, THE Settings_Page SHALL hide the individual alert-type dropdowns (alarm, timer, stopwatch, notification) and display a single "Combined Alerts" dropdown with options Always, Never, and If Space.
3. WHEN the Combine_Alerts_Toggle is disabled, THE Settings_Page SHALL display individual dropdowns for each of the four alert types: alarm, timer, stopwatch, and notification, each with options Always, Never, and If Space.
4. THE Settings_Page SHALL persist the Combine_Alerts_Toggle state and the selected Display_Mode values as part of the `visual_indicators` object in the settings API.
5. WHEN the Combine_Alerts_Toggle state changes, THE Settings_Page SHALL immediately show or hide the appropriate dropdowns without requiring a page reload.

### Requirement 4: New Alert Type Indicator Dropdowns

**User Story:** As a user, I want individual visibility controls for timer and stopwatch alert indicators in addition to the existing alarm and notification controls, so that I can fine-tune which alert types show indicators.

#### Acceptance Criteria

1. WHEN the Combine_Alerts_Toggle is disabled, THE Settings_Page SHALL display a "Timer" indicator dropdown with options Always, Never, and If Space.
2. WHEN the Combine_Alerts_Toggle is disabled, THE Settings_Page SHALL display a "Stopwatch" indicator dropdown with options Always, Never, and If Space.
3. THE Settings_Page SHALL preserve the existing alarm and notification indicator dropdowns when the Combine_Alerts_Toggle is disabled.
4. THE Settings_Page SHALL save timer and stopwatch Display_Mode values as `timer` and `stopwatch` keys within the `visual_indicators` settings object.
5. WHEN the settings are loaded and the timer or stopwatch keys are absent from `visual_indicators`, THE Settings_Page SHALL default the timer and stopwatch Display_Modes to "always".

### Requirement 5: If Space Display Logic for Alert Indicators

**User Story:** As a user, I want the "If Space" option to intelligently show or hide alert indicators based on available display space, so that indicators appear when there is room and are hidden when space is tight.

#### Acceptance Criteria

1. WHEN the Display_Mode for an alert indicator is set to If Space and the rendering context is a calendar month cell, THE Dashboard SHALL display the alert indicator only when the chit title plus indicator fits within the cell width without truncation of the title.
2. WHEN the Display_Mode for an alert indicator is set to If Space and the rendering context is a card-style view (Checklists, Tasks, Notes, Alarms), THE Dashboard SHALL always display the alert indicator because card views have sufficient space.
3. WHEN the Display_Mode for an alert indicator is set to If Space and the rendering context is a calendar day or week time-slot, THE Dashboard SHALL display the alert indicator because day and week slots have sufficient width.

### Requirement 6: Settings Backward Compatibility

**User Story:** As a user upgrading from a previous version, I want my existing alarm and notification indicator settings to be preserved, so that the upgrade does not change my current indicator behavior.

#### Acceptance Criteria

1. WHEN the `visual_indicators` object in saved settings does not contain a `combine_alerts` key, THE Dashboard SHALL default to combine_alerts disabled (individual mode).
2. WHEN the `visual_indicators` object contains existing `alarm` and `notification` values but no `timer`, `stopwatch`, or `combine_alerts` keys, THE Dashboard SHALL use the existing alarm and notification values and default timer and stopwatch to "always".
3. THE Settings_Page SHALL read and write all alert indicator settings within the existing `visual_indicators` object structure without altering the weather, people, or indicators (health) keys.
