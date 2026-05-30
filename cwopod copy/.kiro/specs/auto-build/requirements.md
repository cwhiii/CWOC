# Requirements Document

## Introduction

The "Cross Your Fingers Mode" (auto-build) is a feature for C.W.'s O-POD that allows users to automatically run through all book production steps after source import, using sensible defaults, without manual interaction at each step. The user kicks off the process with a single button click, optionally enables AI typo correction, and returns later to find a print-ready book. The orchestration runs entirely on the backend via a Celery task chain, so it continues even if the browser is closed. The process stops at PRINT_READY status — it never auto-orders.

## Glossary

- **Auto_Build_Orchestrator**: The backend Celery task that chains through all book production steps automatically using default settings
- **Auto_Build_Banner**: A persistent UI element displayed below the header on all pages while an auto-build is in progress, showing real-time status
- **Auto_Build_Modal**: The confirmation dialog presented when the user clicks the Cross Your Fingers button, containing the AI Autofix checkbox
- **Auto_Build_Summary**: The final status page shown when the orchestrator completes, displaying per-step results and retry controls for any failed steps
- **CWOPOD**: The complete C.W.'s O-POD web application system
- **Orchestrator_Task**: The single Celery task that coordinates execution of all sub-steps in sequence
- **Step_Result**: A record of whether an individual auto-build step succeeded or failed, including error details if applicable
- **Dependency_Chain**: The set of relationships between steps where a downstream step requires the output of an upstream step (typo fix → typeset, typeset → cover build)
- **Lucky_Mode**: A fast cover prompt generation mode that analyzes 1 random text section instead of all chapters
- **Classic_Template**: The default cover builder template with centered title and author text positioning

## Requirements

### Requirement 1: Auto-Build Launch

**User Story:** As a user, I want to start an automatic book build with one click after importing a source, so that I can produce a print-ready book without manually advancing through each wizard step.

#### Acceptance Criteria

1. WHEN a project has status DRAFT and a source has been successfully imported (original_text_path is set), THE CWOPOD SHALL display a "🤞 Cross Your Fingers" button on the project wizard page
2. WHEN the user clicks the Cross Your Fingers button, THE CWOPOD SHALL display the Auto_Build_Modal containing a single checkbox labeled "AI Autofix typos" (unchecked by default), a "Start" button, and a close/cancel control that dismisses the modal without starting the build
3. WHEN the user clicks Start in the Auto_Build_Modal, THE CWOPOD SHALL close the modal, disable the Cross Your Fingers button on the current project, dispatch the Orchestrator_Task to the Celery queue with the project ID, user ID, and the AI Autofix preference, and display the Auto_Build_Banner indicating the build has started
4. IF the user already has an auto-build in progress for any project, THEN THE CWOPOD SHALL disable the Cross Your Fingers button on all other projects and display a message indicating that only one auto-build may run at a time per user
5. WHEN the Orchestrator_Task is dispatched, THE CWOPOD SHALL record the task ID and mark the project as having an active auto-build in the database
6. IF the dispatch of the Orchestrator_Task to the Celery queue fails, THEN THE CWOPOD SHALL re-enable the Cross Your Fingers button, not mark the project as having an active auto-build, and display an error message indicating that the build could not be started

### Requirement 2: Orchestrator Step Execution

**User Story:** As a user, I want the auto-build to run through all production steps in the correct order using sensible defaults, so that I get a complete book without making decisions at each step.

#### Acceptance Criteria

1. THE Auto_Build_Orchestrator SHALL execute steps in the following order: set print size, typo scan (conditional), typeset, cover prompts, cover image generation, cover build
2. WHEN executing the print size step, THE Auto_Build_Orchestrator SHALL apply the user's default trim size from their settings, or 5.5×8.5 inches if no default is configured
3. WHEN AI Autofix is enabled, THE Auto_Build_Orchestrator SHALL run the typo scan task, mark all returned corrections as accepted, and apply the accepted corrections to produce the working text before proceeding to the typeset step
4. WHEN AI Autofix is disabled, THE Auto_Build_Orchestrator SHALL skip the typo scan step entirely and proceed to the typeset step using the original text
5. WHEN executing the typeset step, THE Auto_Build_Orchestrator SHALL invoke the generate_pdf_task with the user's default print provider (or "lulu" as fallback)
6. WHEN executing the cover prompts step, THE Auto_Build_Orchestrator SHALL invoke generate_prompts_task in "lucky" mode with num_prompts set to 1
7. WHEN executing the cover image step, THE Auto_Build_Orchestrator SHALL generate 1 image from the first returned prompt
8. WHEN executing the cover build step, THE Auto_Build_Orchestrator SHALL apply the Classic_Template with centered title and author text, using the generated cover image, the page count from typesetting to calculate spine width, and "standard_white" as the paper stock
9. WHEN all steps complete successfully, THE Auto_Build_Orchestrator SHALL set the project status to PRINT_READY
10. WHEN a step completes, THE Auto_Build_Orchestrator SHALL pass its output (page count from typeset, prompt text from cover prompts, image path from cover image generation) as input to the subsequent dependent step

### Requirement 3: Failure Handling and Recovery

**User Story:** As a user, I want the auto-build to handle failures gracefully and let me retry individual failed steps, so that a single failure does not force me to restart the entire process.

#### Acceptance Criteria

1. IF a step fails and no downstream step depends on its output, THEN THE Auto_Build_Orchestrator SHALL record the failure with error details, mark that step as failed, and proceed to the next independent step
2. IF the typeset step fails, THEN THE Auto_Build_Orchestrator SHALL skip the cover build step (spine width depends on page count) and record both as failed with an explanation that cover build was skipped due to typeset failure
3. IF the typo scan step fails, THEN THE Auto_Build_Orchestrator SHALL skip the typeset step (corrected text is needed) and record both typeset and cover build as skipped due to the dependency chain
4. THE Auto_Build_Orchestrator SHALL store a Step_Result for each step containing: step name, status (success, failed, or skipped), error message if failed, and skip reason if skipped
5. WHEN the orchestrator finishes with at least one failed or skipped step, THE Auto_Build_Orchestrator SHALL leave the project status unchanged from its pre-build state (not set to PRINT_READY) and THE CWOPOD SHALL display the Auto_Build_Summary page showing per-step results with a status indicator (success, failed, or skipped) for each step
6. WHEN a step has status failed, THE Auto_Build_Summary SHALL display a retry button for that step; WHEN a step has status skipped, THE Auto_Build_Summary SHALL display a retry button only on the root-cause failed step that caused the skip, not on the skipped step itself
7. WHEN the user clicks a retry button for a failed step, THE CWOPOD SHALL dispatch a new Orchestrator_Task that re-runs that step and all downstream dependent steps in dependency-chain order, preserving results from previously successful independent steps and updating the stored Step_Results upon completion of each re-run step

### Requirement 4: Progress Reporting

**User Story:** As a user, I want to see real-time progress of the auto-build from any page in the application, so that I know what step it is on and how far along it is.

#### Acceptance Criteria

1. WHILE an auto-build is in progress for the current user, THE CWOPOD SHALL display the Auto_Build_Banner below the header on all pages
2. THE Auto_Build_Banner SHALL display: the 🤞 emoji, the text "Auto-build in progress:", the project title (truncated to 40 characters with ellipsis if longer), the current step number out of total steps (e.g., "Step 3/6"), the current step label, the overall percent complete as a whole integer (0–100), and a "Watch →" link
3. WHEN the user clicks the "Watch →" link in the Auto_Build_Banner, THE CWOPOD SHALL navigate to the project wizard page for the auto-building project
4. THE Auto_Build_Orchestrator SHALL report progress via Celery task.update_state() with the current step number, total step count, step label, and overall percent complete calculated as (completed_steps / total_steps) × 100 rounded down to a whole integer, where skipped steps count as completed
5. WHILE an auto-build is in progress for the current user, THE CWOPOD SHALL poll the auto-build status endpoint every 2 seconds to update the Auto_Build_Banner with current progress data from the server
6. WHEN the auto-build completes (success or partial failure), THE Auto_Build_Banner SHALL be removed and the project page SHALL display the Auto_Build_Summary
7. WHEN any page loads, THE CWOPOD SHALL check for an active auto-build for the current user and display the Auto_Build_Banner with the latest progress data if one is found

### Requirement 5: Concurrency Control

**User Story:** As a user, I want the system to prevent multiple simultaneous auto-builds, so that server resources are not overwhelmed and I do not accidentally start conflicting builds.

#### Acceptance Criteria

1. THE CWOPOD SHALL allow a maximum of one active auto-build per user at any time, where "active" means the Orchestrator_Task has been dispatched and has not yet completed all steps or failed terminally
2. WHEN a user attempts to start an auto-build while another is already in progress, THE CWOPOD SHALL reject the request and display a message indicating the title of the project currently being auto-built
3. WHEN the Orchestrator_Task starts, THE Auto_Build_Orchestrator SHALL atomically verify no other auto-build is active for the same user before proceeding
4. IF another auto-build is already active when the Orchestrator_Task performs its verification, THEN THE Auto_Build_Orchestrator SHALL abort without executing any steps and SHALL record the task as failed with an error indicating a concurrent build conflict
5. WHEN the Orchestrator_Task completes all steps or encounters an unrecoverable error that prevents further step execution (e.g., worker crash, unhandled exception in the orchestrator itself), THE Auto_Build_Orchestrator SHALL clear the active auto-build record for the user so a new auto-build can be started
6. IF two auto-build requests for the same user arrive simultaneously, THEN THE CWOPOD SHALL ensure only one proceeds by using an atomic check-and-set operation on the active auto-build record, rejecting the other

### Requirement 6: Backend Resilience

**User Story:** As a user, I want the auto-build to continue running on the server even if I close my browser, so that I can kick it off and come back later.

#### Acceptance Criteria

1. THE Auto_Build_Orchestrator SHALL execute entirely as a server-side Celery task that does not depend on an active browser connection or WebSocket
2. THE Auto_Build_Orchestrator SHALL persist each Step_Result to the database immediately after that step completes, so that if the Celery worker is terminated, the user can see which steps succeeded before the interruption
3. IF the Celery worker process is terminated during an auto-build and the auto-build task has not reported progress for more than 90 seconds, THEN THE CWOPOD SHALL mark the auto-build as failed with a message indicating the worker was interrupted, and SHALL preserve all previously persisted Step_Results
4. WHEN the user loads any page in the application after an auto-build has completed or been marked as failed, THE CWOPOD SHALL display the Auto_Build_Summary showing the final per-step results
5. IF the Celery worker restarts after being terminated during an auto-build, THEN THE Auto_Build_Orchestrator SHALL NOT automatically resume the interrupted build; the user must manually retry failed steps via the Auto_Build_Summary

### Requirement 7: Auto-Build Does Not Order

**User Story:** As a user, I want the auto-build to stop at print-ready status and never automatically place a print order, so that I can review the results before spending money.

#### Acceptance Criteria

1. THE Auto_Build_Orchestrator SHALL NOT invoke any print ordering, payment, or submission API as part of the auto-build process
2. WHEN the auto-build reaches PRINT_READY status, THE Auto_Build_Summary SHALL display a clickable thumbnail of the first page of the generated interior PDF, the generated cover image at a maximum display size of 400×400 pixels, and a text label instructing the user to review the results before placing an order
3. IF the project status is PRINT_READY, THEN THE Auto_Build_Summary SHALL display a "Proceed to Print" button that navigates the user to the standard print step of the wizard for manual order placement
4. IF the project status is not PRINT_READY (due to step failures), THEN THE Auto_Build_Summary SHALL NOT display the "Proceed to Print" button
