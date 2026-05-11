# Requirements Document

## Introduction

Auto-save provides automatic persistence of chit edits in the editor without requiring the user to manually click Save. It is a per-user setting with independent toggles for mobile and desktop platforms, allowing users to opt in on one platform while keeping manual save on the other. When enabled, the editor automatically saves changes after a debounce period following user input, providing visual feedback of save status.

## Glossary

- **Editor**: The chit editor page (`editor.html`) where users create and modify chits
- **Auto_Save_System**: The frontend component responsible for detecting changes, debouncing, and triggering automatic saves
- **Settings_API**: The backend endpoint (`/api/settings/{user_id}`) that stores and retrieves user preferences
- **Settings_Page**: The settings page (`settings.html`) where users configure their preferences
- **Debounce_Timer**: A delay period after the last user input before an auto-save is triggered
- **Mobile_Platform**: A device with viewport width ≤ 768px (matching the existing `_isMobileOverlay()` threshold)
- **Desktop_Platform**: A device with viewport width > 768px
- **Save_Indicator**: A visual element in the editor UI that communicates the current save state to the user
- **CwocSaveSystem**: The existing shared save/cancel button system in `shared-page.js`

## Requirements

### Requirement 1: Auto-Save Setting Storage

**User Story:** As a user, I want my auto-save preference stored per-platform in my settings, so that I can enable auto-save on desktop but keep manual save on mobile (or vice versa).

#### Acceptance Criteria

1. THE Settings_API SHALL store an `autosave_desktop` field with values `"1"` (enabled) or `"0"` (disabled), defaulting to `"0"`
2. THE Settings_API SHALL store an `autosave_mobile` field with values `"1"` (enabled) or `"0"` (disabled), defaulting to `"0"`
3. WHEN settings are requested via GET `/api/settings/{user_id}`, THE Settings_API SHALL return both `autosave_desktop` and `autosave_mobile` fields
4. WHEN settings are saved via POST `/api/settings`, THE Settings_API SHALL persist both `autosave_desktop` and `autosave_mobile` fields to the database

### Requirement 2: Auto-Save Settings UI

**User Story:** As a user, I want toggle controls on the settings page to independently enable or disable auto-save for mobile and desktop, so that I can configure my preferred save behavior per platform.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a toggle for "Auto-save on Desktop" within the editor behavior settings section
2. THE Settings_Page SHALL display a toggle for "Auto-save on Mobile" within the editor behavior settings section
3. WHEN the settings page loads, THE Settings_Page SHALL reflect the current stored values of `autosave_desktop` and `autosave_mobile`
4. WHEN the user changes either auto-save toggle and saves settings, THE Settings_Page SHALL persist the updated values via the Settings_API

### Requirement 3: Auto-Save Trigger on Editor Changes

**User Story:** As a user, I want my chit edits to be saved automatically after I stop typing, so that I don't lose work if I forget to save or navigate away.

#### Acceptance Criteria

1. WHILE auto-save is enabled for the current platform, THE Auto_Save_System SHALL start a Debounce_Timer after each change detected in the editor
2. WHILE auto-save is enabled for the current platform, WHEN the Debounce_Timer expires (2 seconds after the last change), THE Auto_Save_System SHALL trigger a save operation equivalent to "Save & Stay"
3. WHILE auto-save is enabled for the current platform, WHEN a new change occurs before the Debounce_Timer expires, THE Auto_Save_System SHALL reset the Debounce_Timer
4. WHILE auto-save is disabled for the current platform, THE Auto_Save_System SHALL not trigger any automatic saves and the editor SHALL behave with the existing manual save pattern

### Requirement 4: Platform Detection for Auto-Save

**User Story:** As a user, I want the app to automatically apply the correct auto-save setting based on whether I'm using a mobile or desktop device, so that I get the right behavior without manual switching.

#### Acceptance Criteria

1. WHEN the editor page loads, THE Auto_Save_System SHALL determine the current platform using the viewport width threshold (≤ 768px = Mobile_Platform, > 768px = Desktop_Platform)
2. WHEN the current platform is Mobile_Platform, THE Auto_Save_System SHALL use the `autosave_mobile` setting value
3. WHEN the current platform is Desktop_Platform, THE Auto_Save_System SHALL use the `autosave_desktop` setting value
4. WHEN the viewport is resized across the 768px boundary, THE Auto_Save_System SHALL re-evaluate which platform setting applies and adjust behavior accordingly

### Requirement 5: Save Status Indicator

**User Story:** As a user, I want clear visual feedback about the auto-save state, so that I know whether my changes have been saved, are pending save, or encountered an error.

#### Acceptance Criteria

1. WHILE auto-save is enabled and no unsaved changes exist, THE Save_Indicator SHALL display a "Saved" state (matching the existing `CwocSaveSystem` saved appearance)
2. WHILE auto-save is enabled and changes are pending (Debounce_Timer running), THE Save_Indicator SHALL display a "Saving soon..." or equivalent pending state
3. WHILE auto-save is enabled and a save operation is in progress, THE Save_Indicator SHALL display a "Saving..." state
4. IF an auto-save operation fails, THEN THE Save_Indicator SHALL display an error state and THE Auto_Save_System SHALL retain the unsaved changes for retry
5. WHILE auto-save is enabled, THE Editor SHALL hide the manual "Save & Stay" and "Save & Exit" buttons and show only the Save_Indicator and an "Exit" button

### Requirement 6: Auto-Save and Exit Behavior

**User Story:** As a user, I want to be able to exit the editor cleanly when auto-save is active, so that I don't lose any in-flight changes.

#### Acceptance Criteria

1. WHILE auto-save is enabled and changes are pending, WHEN the user clicks Exit, THE Auto_Save_System SHALL perform an immediate save before navigating away
2. WHILE auto-save is enabled and a save is in progress, WHEN the user clicks Exit, THE Auto_Save_System SHALL wait for the save to complete before navigating away
3. WHILE auto-save is enabled and all changes are saved, WHEN the user clicks Exit, THE Editor SHALL navigate away immediately without prompting
4. IF an immediate save on exit fails, THEN THE Editor SHALL show the unsaved-changes confirmation modal (Discard / Retry)

### Requirement 7: Auto-Save Conflict Prevention

**User Story:** As a user, I want auto-save to avoid saving incomplete or invalid data, so that I don't end up with broken chits.

#### Acceptance Criteria

1. WHILE auto-save is enabled, THE Auto_Save_System SHALL only trigger a save when the chit passes the existing validation rules (at minimum: title, note, date, tag, checklist item, or child chit present)
2. WHILE auto-save is enabled, WHEN validation fails, THE Auto_Save_System SHALL skip the save silently and retry on the next change
3. WHILE auto-save is enabled, THE Auto_Save_System SHALL not trigger a new save while a previous save operation is still in progress
4. WHILE auto-save is enabled, WHEN a save completes and new changes occurred during the save, THE Auto_Save_System SHALL schedule another save after the Debounce_Timer

### Requirement 8: Database Migration for Auto-Save Settings

**User Story:** As a developer, I want the auto-save setting columns added to the database schema, so that the feature can persist user preferences.

#### Acceptance Criteria

1. WHEN the application starts, THE migration system SHALL add an `autosave_desktop` column (TEXT, default `"0"`) to the `settings` table if it does not already exist
2. WHEN the application starts, THE migration system SHALL add an `autosave_mobile` column (TEXT, default `"0"`) to the `settings` table if it does not already exist
3. THE migration system SHALL not modify existing data in the `settings` table when adding the new columns
