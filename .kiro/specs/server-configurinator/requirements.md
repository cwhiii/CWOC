# Requirements Document

## Introduction

The Server Configurinator is a standalone shell script that automates the complete provisioning of a bare Linux machine (Debian/Ubuntu or Fedora/RHEL-based) into a fully functional CWOC (C.W.'s Omni Chits) production server. The script lives in a new `/configurinator/` directory at the project root and handles everything from system package installation through Python environment setup, directory structure creation, application file deployment, and systemd service configuration — producing a running CWOC instance accessible on port 3333.

## Glossary

- **Configurinator_Script**: The main shell script (`configurinator/build.sh`) that orchestrates the full server provisioning process
- **Target_Machine**: The bare Linux machine (Debian/Ubuntu or Fedora/RHEL-based) being provisioned (e.g., a Proxmox LXC container)
- **Package_Manager**: The system package manager detected on the Target_Machine — either `apt-get` (Debian/Ubuntu) or `dnf` (Fedora/RHEL)
- **CWOC_Application**: The C.W.'s Omni Chits FastAPI web application consisting of a Python backend and vanilla JS/HTML/CSS frontend
- **App_Root**: The root directory for the deployed application on the Target_Machine, located at `/app`
- **Virtual_Environment**: The Python virtual environment created at `/app/venv` used to isolate CWOC_Application dependencies
- **CWOC_Service**: The systemd service unit named `cwoc` that manages the Uvicorn process serving the CWOC_Application
- **Database_Directory**: The directory at `/app/data` where the SQLite3 database file (`app.db`) is stored

## Requirements

### Requirement 1: System Package Installation

**User Story:** As a server administrator, I want the Configurinator_Script to install all required system-level packages, so that the Target_Machine has the necessary tools and libraries to run the CWOC_Application.

#### Acceptance Criteria

1. WHEN executed on a Target_Machine, THE Configurinator_Script SHALL detect the Package_Manager by checking for the presence of `apt-get` or `dnf`
2. IF neither `apt-get` nor `dnf` is found, THEN THE Configurinator_Script SHALL print an error message stating the operating system is unsupported and exit with a non-zero status code
3. WHEN the Package_Manager is `apt-get`, THE Configurinator_Script SHALL update the package index using `apt-get update` and install Python 3, python3-venv, python3-pip, and sqlite3 via `apt-get`
4. WHEN the Package_Manager is `dnf`, THE Configurinator_Script SHALL install Python 3, python3-pip, and sqlite via `dnf install`
5. IF a required system package fails to install, THEN THE Configurinator_Script SHALL print an error message identifying the failed package and exit with a non-zero status code

### Requirement 2: Application Directory Structure

**User Story:** As a server administrator, I want the Configurinator_Script to create the correct directory layout, so that the CWOC_Application files have a proper home on the Target_Machine.

#### Acceptance Criteria

1. THE Configurinator_Script SHALL create the App_Root directory at `/app` if the directory does not already exist
2. THE Configurinator_Script SHALL create the following subdirectories under App_Root: `backend`, `frontend`, `static`, `data`
3. THE Configurinator_Script SHALL set ownership of the App_Root directory and all subdirectories to the `root` user
4. IF the App_Root directory already exists, THEN THE Configurinator_Script SHALL preserve existing contents and only create missing subdirectories

### Requirement 3: Python Virtual Environment Setup

**User Story:** As a server administrator, I want the Configurinator_Script to create and configure a Python virtual environment, so that the CWOC_Application dependencies are isolated from the system Python.

#### Acceptance Criteria

1. THE Configurinator_Script SHALL create a Python 3 virtual environment at `/app/venv`
2. WHEN the Virtual_Environment is created, THE Configurinator_Script SHALL upgrade pip within the Virtual_Environment to the latest version
3. IF the Virtual_Environment already exists at `/app/venv`, THEN THE Configurinator_Script SHALL skip creation and proceed to dependency installation
4. IF virtual environment creation fails, THEN THE Configurinator_Script SHALL print an error message and exit with a non-zero status code

### Requirement 4: Python Dependency Installation

**User Story:** As a server administrator, I want the Configurinator_Script to install all Python dependencies, so that the CWOC_Application backend can run without missing modules.

#### Acceptance Criteria

1. WHEN the Virtual_Environment is ready, THE Configurinator_Script SHALL install `fastapi`, `uvicorn`, `pydantic`, and `python-dotenv` using pip from the Virtual_Environment
2. THE Configurinator_Script SHALL install dependencies using `/app/venv/bin/pip` to ensure packages go into the Virtual_Environment
3. IF any Python dependency fails to install, THEN THE Configurinator_Script SHALL print an error message identifying the failed dependency and exit with a non-zero status code

### Requirement 5: Systemd Service Configuration

**User Story:** As a server administrator, I want the Configurinator_Script to set up a systemd service, so that the CWOC_Application starts automatically on boot and can be managed with standard systemd commands.

#### Acceptance Criteria

1. THE Configurinator_Script SHALL create a systemd unit file at `/etc/systemd/system/cwoc.service`
2. THE Configurinator_Script SHALL configure the CWOC_Service unit file with `WorkingDirectory` set to `/app`
3. THE Configurinator_Script SHALL configure the CWOC_Service `ExecStart` to run `/app/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 3333 --log-level debug`
4. THE Configurinator_Script SHALL configure the CWOC_Service with `Restart=always` and `RestartSec=3`
5. WHEN the unit file is written, THE Configurinator_Script SHALL run `systemctl daemon-reload`
6. WHEN the daemon is reloaded, THE Configurinator_Script SHALL enable the CWOC_Service to start on boot using `systemctl enable cwoc`
7. IF the systemd unit file already exists at `/etc/systemd/system/cwoc.service`, THEN THE Configurinator_Script SHALL overwrite the existing file with the current configuration

### Requirement 6: Database Directory Initialization

**User Story:** As a server administrator, I want the Configurinator_Script to prepare the database directory, so that the CWOC_Application can create and access the SQLite3 database on first run.

#### Acceptance Criteria

1. THE Configurinator_Script SHALL create the Database_Directory at `/app/data` if the directory does not already exist
2. THE Configurinator_Script SHALL set read and write permissions on the Database_Directory for the `root` user
3. IF the Database_Directory already contains an existing `app.db` file, THEN THE Configurinator_Script SHALL preserve the existing database file without modification

### Requirement 7: Script Execution Guards

**User Story:** As a server administrator, I want the Configurinator_Script to validate its execution environment, so that the script only runs under safe and expected conditions.

#### Acceptance Criteria

1. WHEN the Configurinator_Script is executed, THE Configurinator_Script SHALL verify that the current user is `root` and exit with an error message if the user is not `root`
2. WHEN the Configurinator_Script is executed, THE Configurinator_Script SHALL verify that a supported Package_Manager (`apt-get` or `dnf`) is available and exit with an error message if neither is found
3. THE Configurinator_Script SHALL use `set -e` to exit immediately on any command failure

### Requirement 8: Service Startup and Verification

**User Story:** As a server administrator, I want the Configurinator_Script to start the CWOC_Application and verify it is running, so that I can confirm the provisioning was successful.

#### Acceptance Criteria

1. WHEN all provisioning steps are complete, THE Configurinator_Script SHALL start the CWOC_Service using `systemctl start cwoc`
2. WHEN the CWOC_Service is started, THE Configurinator_Script SHALL wait up to 5 seconds and then check the service status using `systemctl is-active cwoc`
3. WHEN the CWOC_Service status is `active`, THE Configurinator_Script SHALL print a success message including the URL `http://<machine-ip>:3333`
4. IF the CWOC_Service fails to reach `active` status within 5 seconds, THEN THE Configurinator_Script SHALL print an error message and display the last 20 lines of the CWOC_Service journal log

### Requirement 9: Idempotent Execution

**User Story:** As a server administrator, I want to run the Configurinator_Script multiple times safely, so that I can re-provision or update a server without breaking an existing installation.

#### Acceptance Criteria

1. THE Configurinator_Script SHALL check for the existence of each directory before creating the directory
2. THE Configurinator_Script SHALL check for the existence of the Virtual_Environment before creating the Virtual_Environment
3. WHEN run on a Target_Machine that already has a running CWOC_Service, THE Configurinator_Script SHALL stop the CWOC_Service before making changes and restart the CWOC_Service after changes are complete
4. THE Configurinator_Script SHALL produce the same end state regardless of how many times the Configurinator_Script is executed on the same Target_Machine

### Requirement 10: Progress Logging

**User Story:** As a server administrator, I want the Configurinator_Script to provide clear progress output, so that I can follow along and diagnose issues during provisioning.

#### Acceptance Criteria

1. THE Configurinator_Script SHALL print a labeled status message before each major provisioning step (package installation, directory creation, virtual environment setup, dependency installation, service configuration, service startup)
2. THE Configurinator_Script SHALL print a completion message after each major provisioning step succeeds
3. IF any step fails, THEN THE Configurinator_Script SHALL print an error message identifying the failed step before exiting
