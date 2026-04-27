# Requirements Document

## Introduction

Version Management adds the ability to view the current CWOC version, see when it was last installed/updated, and trigger the Configurinator (build script) directly from the Settings page. The Configurinator output streams in real time to a modal so the user can monitor the update process without SSH access.

## Glossary

- **Settings_Page**: The CWOC settings page (`frontend/settings.html` + `frontend/settings.js`) where users configure application preferences
- **Backend**: The FastAPI application (`backend/main.py`) serving the CWOC API on port 3333
- **Configurinator**: The bash script (`install/configurinator.sh`) that downloads the latest CWOC release, deploys it, sets up dependencies, and restarts the service
- **Version_Info_Box**: A UI component in the Settings page displaying the current version number and last-updated timestamp
- **Update_Modal**: A modal dialog that displays real-time streaming output from the Configurinator script
- **Version_Store**: A persistent record in the database (via the `instance_meta` table) tracking the current version string and the datetime when it was last installed
- **SSE_Stream**: A Server-Sent Events connection used to push Configurinator log lines from the Backend to the frontend in real time

## Requirements

### Requirement 1: Version Tracking in the Backend

**User Story:** As a user, I want the system to persistently track which version is installed and when it was installed, so that I can see this information on the Settings page.

#### Acceptance Criteria

1. THE Backend SHALL store a `version` key and an `installed_datetime` key in the Version_Store
2. WHEN the Configurinator completes successfully, THE Backend SHALL update the `version` key with the new version string and the `installed_datetime` key with the current UTC datetime in ISO 8601 format
3. WHEN a GET request is made to `/api/version`, THE Backend SHALL return a JSON object containing the `version` string and the `installed_datetime` string
4. IF the Version_Store contains no version record, THEN THE Backend SHALL return `version` as `"unknown"` and `installed_datetime` as `null`

### Requirement 2: Version Info Box on the Settings Page

**User Story:** As a user, I want to see the current CWOC version and when it was last updated directly on the Settings page, so that I know what version I am running.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a Version_Info_Box within a setting-group section
2. THE Version_Info_Box SHALL show the current version string retrieved from `/api/version`
3. THE Version_Info_Box SHALL show the last-updated date and time formatted in the user's configured time format, labeled as "Last Updated" — this represents when the version was installed, not when the version was created
4. IF the version is `"unknown"` or the installed datetime is null, THEN THE Version_Info_Box SHALL display "No version info available" as a fallback message
5. WHEN the Settings_Page loads, THE Version_Info_Box SHALL fetch version data from `/api/version` and render it

### Requirement 3: Update Button on the Settings Page

**User Story:** As a user, I want a button on the Settings page to trigger the Configurinator, so that I can update CWOC without SSH access.

#### Acceptance Criteria

1. THE Settings_Page SHALL display an "Upgrade Omni Chits" button within the Version_Info_Box setting-group
2. WHEN the user clicks the "Upgrade Omni Chits" button, THE Settings_Page SHALL open the Update_Modal and initiate a request to the Backend to execute the Configurinator
3. WHILE the Configurinator is running, THE "Upgrade Omni Chits" button SHALL be disabled to prevent concurrent executions
4. IF the user clicks the "Upgrade Omni Chits" button while a previous update is still running, THEN THE Settings_Page SHALL not initiate a second execution

### Requirement 4: Backend Endpoint to Execute the Configurinator

**User Story:** As a user, I want the backend to execute the Configurinator script and stream its output, so that I can monitor the update in real time.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/update/run`, THE Backend SHALL execute the Configurinator script (`install/configurinator.sh`) as a subprocess
2. THE Backend SHALL stream each line of the Configurinator's stdout and stderr to the client via an SSE_Stream with `text/event-stream` content type
3. WHEN the Configurinator process completes, THE Backend SHALL send a final SSE event containing the exit code (0 for success, non-zero for failure)
4. IF the Configurinator script is not found at the expected path, THEN THE Backend SHALL return an SSE event with an error message indicating the script is missing
5. IF the Configurinator is already running (triggered by another request), THEN THE Backend SHALL return an SSE event with a message indicating an update is already in progress
6. WHEN the Configurinator completes with exit code 0, THE Backend SHALL update the Version_Store with the new version string and current datetime

### Requirement 5: Real-Time Update Modal

**User Story:** As a user, I want to see the Configurinator's console output in real time in a modal, so that I can monitor the update progress and see any errors.

#### Acceptance Criteria

1. WHEN the update is initiated, THE Update_Modal SHALL open and display a scrollable log area with a dark background styled to resemble a terminal console
2. THE Update_Modal SHALL append each new log line received from the SSE_Stream to the log area as it arrives
3. THE Update_Modal SHALL auto-scroll to the bottom as new lines are appended, keeping the latest output visible
4. WHEN the SSE_Stream sends the final completion event, THE Update_Modal SHALL display a summary line indicating success or failure based on the exit code
5. THE Update_Modal SHALL provide a "Close" button that is enabled only after the update process completes
6. WHEN the update completes successfully, THE Version_Info_Box SHALL refresh to display the newly installed version and updated timestamp
7. THE Update_Modal log area SHALL apply color styling to log lines based on their prefix: green for `[OK]`, yellow for `[WARN]`, red for `[ERROR]`, and blue for `[STEP]`

### Requirement 6: Version String Determination

**User Story:** As a user, I want the version string to accurately reflect the installed release, so that I can verify which version is running.

#### Acceptance Criteria

1. THE Backend SHALL determine the version string by reading a `VERSION` file located at `/app/VERSION` after the Configurinator completes
2. IF the `VERSION` file does not exist, THEN THE Backend SHALL set the version string to `"unknown"`
3. THE version string SHALL be a trimmed, single-line value read from the `VERSION` file

### Requirement 7: Help Page Documentation Update

**User Story:** As a user, I want the Help page to document the version management features, so that I can learn how to use them.

#### Acceptance Criteria

1. THE Help page SHALL include a "Version Management" section in the Settings documentation area
2. THE Help page "Version Management" section SHALL describe the Version_Info_Box and its displayed fields (version number, last updated date/time)
3. THE Help page "Version Management" section SHALL describe the "Upgrade Omni Chits" button and the Update_Modal behavior (real-time log streaming, color-coded output, close button)
4. THE Help page table of contents SHALL include a link to the "Version Management" section
