# Requirements Document

## Introduction

When a user taps the "Create Chit" FAB from a specific C CAPTN view, the chit editor should pre-open the full zone content most relevant to that view. This eliminates the extra step of manually expanding zones and places the cursor or focus where the user most likely wants to start typing. The feature applies to all platforms: web desktop, mobile web, and Android app.

## Glossary

- **Editor**: The chit editor screen where users create or modify a chit
- **Zone**: A collapsible section within the Editor that contains a specific type of content (e.g., Dates, Checklist, Notes, Task, Alerts, Indicators, Projects)
- **FAB**: The Floating Action Button used to create a new chit
- **Source_View**: The C CAPTN view (Calendar, Checklists, Alarms, Projects, Tasks, Notes, Indicators) the user was viewing when they tapped the FAB
- **Title_Zone**: The always-visible top section of the Editor containing the chit title field
- **Full_Zone_Content**: The complete expanded zone UI as it appears when editing an existing chit, including all inputs, buttons, and controls — not a collapsed preview or summary
- **Zone_Prefill_Map**: The mapping from Source_View to the set of zones that should be pre-opened in the Editor
- **Auto_Focus**: Programmatically placing the cursor in a specific input field and opening the on-screen keyboard (on touch devices)
- **Web_Platform**: The desktop browser and mobile browser versions of CWOC served by FastAPI
- **Android_Platform**: The native Android app built with Kotlin and Jetpack Compose

## Requirements

### Requirement 1: Source View Propagation

**User Story:** As a user, I want the editor to know which view I came from when I tap the FAB, so that it can pre-open the relevant zones for me.

#### Acceptance Criteria

1. WHEN the user taps the FAB from any C CAPTN view on the Web_Platform, THE Editor SHALL receive the Source_View identifier before zone initialization begins
2. WHEN the user taps the FAB from any C CAPTN view on the Android_Platform, THE Editor SHALL receive the Source_View identifier via navigation arguments
3. IF the Source_View identifier is null, empty, missing from the navigation parameters, or does not match one of the seven C CAPTN view names (Calendar, Checklists, Alarms, Projects, Tasks, Notes, Indicators), THEN THE Editor SHALL default to the Calendar zone mapping
4. WHEN the user taps the FAB from a non-C CAPTN view (Settings, People, Maps, Weather, Trash, or Audit Log), THE Editor SHALL apply the Calendar zone mapping

### Requirement 2: Zone Prefill Mapping

**User Story:** As a user, I want the correct zones pre-opened based on where I came from, so that I can immediately start entering the type of content I intended.

#### Acceptance Criteria

1. WHEN the Source_View is Calendar, THE Editor SHALL display the Title_Zone and the Dates zone as Full_Zone_Content
2. WHEN the Source_View is Checklists, THE Editor SHALL display the Title_Zone and the Checklist zone as Full_Zone_Content
3. WHEN the Source_View is Notes, THE Editor SHALL display the Title_Zone and the Notes zone as Full_Zone_Content
4. WHEN the Source_View is Tasks, THE Editor SHALL display the Title_Zone, the Task zone, and the Dates zone as Full_Zone_Content, in top-to-bottom order matching the Editor's standard zone layout
5. WHEN the Source_View is Projects, THE Editor SHALL display the Title_Zone, the Projects zone, and the Checklist zone as Full_Zone_Content, in top-to-bottom order matching the Editor's standard zone layout
6. WHEN the Source_View is Alarms, THE Editor SHALL display the Title_Zone and the Alerts zone as Full_Zone_Content
7. WHEN the Source_View is Indicators, THE Editor SHALL display the Title_Zone and the Indicators zone as Full_Zone_Content
8. WHEN the Source_View does not have a specific Auto_Focus rule (Calendar, Projects, Alarms, or Indicators), THE Editor SHALL place the cursor in the Title_Zone text input field

### Requirement 3: Non-Mapped Zones Collapsed

**User Story:** As a user, I want only the relevant zones open so the editor is not cluttered with zones I do not need for this type of chit.

#### Acceptance Criteria

1. WHEN the Editor opens for a new chit with a valid Source_View, THE Editor SHALL render all zones that are not in the Zone_Prefill_Map for that Source_View in collapsed state on initial display, with no flash of expanded content
2. THE Editor SHALL display collapsed zones as their header-only representation with no visible content area
3. WHEN the user taps or clicks the header of a collapsed zone, THE Editor SHALL expand that zone to show its Full_Zone_Content

### Requirement 4: Auto-Focus for Notes View

**User Story:** As a user creating a new chit from the Notes view, I want the cursor placed in the notes text input with the keyboard open, so that I can start typing my note immediately.

#### Acceptance Criteria

1. WHEN the Source_View is Notes and the Editor finishes rendering the Notes zone, THE Editor SHALL place the cursor in the notes text input field within 300ms of render completion and scroll the viewport so the focused input is fully visible
2. WHEN the Source_View is Notes and the Editor finishes rendering the Notes zone on the Web_Platform mobile browser or the Android_Platform, THE Editor SHALL trigger the on-screen keyboard to open automatically as part of the focus action
3. IF the Editor is unable to programmatically focus the notes text input field, THEN THE Editor SHALL leave the notes text input field visible and unfocused without displaying an error

### Requirement 5: Auto-Focus for Checklists View

**User Story:** As a user creating a new chit from the Checklists view, I want the cursor placed in the first checklist item input with the keyboard open, so that I can start adding items immediately.

#### Acceptance Criteria

1. WHEN the Source_View is Checklists and the Editor finishes rendering the Checklist zone, THE Editor SHALL place the cursor in the first checklist item input field within 300ms of zone render completion
2. WHEN the Source_View is Checklists on a touch device, THE Editor SHALL trigger the on-screen keyboard to open automatically
3. IF the on-screen keyboard cannot be programmatically opened due to platform restrictions, THEN THE Editor SHALL ensure the first checklist item input field is focused so that the keyboard appears on the user's first tap of that field without requiring additional interaction

### Requirement 6: Due Date Pre-Selection for Tasks View

**User Story:** As a user creating a new chit from the Tasks view, I want the due date field highlighted and ready for input, so that I can quickly assign a deadline without extra taps.

#### Acceptance Criteria

1. WHEN the Source_View is Tasks and the Editor finishes rendering the Dates zone, THE Editor SHALL set the date mode to "Due" and apply a visible focus indicator (distinct border or outline differentiable from the field's default state) to the due date input field
2. WHEN the Source_View is Tasks, THE Editor SHALL leave the due date field value empty (no date pre-filled)
3. WHEN the Source_View is Tasks and the user taps the highlighted due date field, THE Editor SHALL open the Flatpickr date picker on that single tap without requiring a prior tap to focus the field
4. WHEN the user selects a date from the picker or taps any other input field, THE Editor SHALL remove the focus indicator from the due date field

### Requirement 7: Full Zone Content Display

**User Story:** As a user, I want pre-opened zones to show the complete editing interface, so that I have full access to all zone controls without additional expansion steps.

#### Acceptance Criteria

1. THE Editor SHALL render pre-opened zones with the identical UI as zones displayed when editing an existing chit, including empty-state controls such as blank input fields, add-item buttons, and placeholder text
2. THE Editor SHALL display all input fields, buttons, and controls within a pre-opened zone without requiring additional user interaction to reveal them
3. WHEN the Editor finishes its initial render for a new chit, THE Editor SHALL display all pre-opened zones in their fully expanded state before the user performs any interaction
4. IF multiple zones are pre-opened per the Zone_Prefill_Map, THEN THE Editor SHALL scroll the view so that the first pre-opened zone below the Title_Zone is visible on screen

### Requirement 8: Cross-Platform Consistency

**User Story:** As a user who uses CWOC on multiple platforms, I want the zone prefill behavior to be consistent regardless of which platform I use.

#### Acceptance Criteria

1. THE Web_Platform SHALL produce the same Zone_Prefill_Map Source_View-to-zone mappings and the same Auto_Focus or highlight target field on both desktop and mobile browsers
2. THE Android_Platform SHALL produce the same Zone_Prefill_Map Source_View-to-zone mappings and the same Auto_Focus or highlight target field as the Web_Platform for every Source_View
3. WHEN the Source_View is Notes on the Android_Platform and the Editor finishes rendering the Notes zone, THE Editor SHALL Auto_Focus the notes input field
4. WHEN the Source_View is Checklists on the Android_Platform and the Editor finishes rendering the Checklist zone, THE Editor SHALL Auto_Focus the first checklist item input field
5. WHEN the Source_View is Tasks on the Android_Platform and the Editor finishes rendering the Dates zone, THE Editor SHALL visually highlight the due date field as the active input target with no value pre-filled
6. IF the Android_Platform is unable to open the on-screen keyboard due to an OS-level restriction, THEN THE Editor SHALL still place the cursor in the target input field without the keyboard visible
