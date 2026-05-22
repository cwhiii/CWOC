# Requirements Document

## Introduction

This spec achieves Android parity for Spec 4 of the Function Index Fixes – Final Push: "Email, Bundles & Data Management." It covers 22 web functions (W135–W137, W140–W147, W208–W209, W126–W128, W230–W232, W221–W222) that were originally flagged as missing or partial.

**After investigation, most of these are already fully implemented on Android:**
- ✅ Bundle Reorder (W140–W147) — drag-to-reorder exists in `BundleToolbar.kt` with `BundleViewModel.reorderBundles()`
- ✅ Add to Bundle Modal (W208–W209) — `EmailContextMenu.kt` → `BundlePickerDialog.kt` / `AddToBundleSheet` with full rule creation
- ✅ Password Management (W230–W232) — `PasswordChangeZone()` in `ContactEditorScreen.kt` with full current/new/confirm flow
- ✅ Badge Custom Modal (W221–W222) — `CustomDetectorsSection` + `CustomDetectorDialog` in `BadgesSettingsTab.kt`

**Two gaps remain and are the focus of this spec:**
1. **Email Nesting Editor UI (W135–W137)** — Nested chits render correctly in email threads, but there is no editor UI to SET `nestThreadId` on a non-email chit (the thread picker is missing)
2. **Export Data Buttons (W126–W128)** — API endpoints are defined in `CwocApiService.kt` and buttons exist in `AdminSettingsTab.kt`, but the onClick handlers are TODO stubs — not wired to actual export + share logic

## Glossary

- **App**: The CWOC Android mobile application built with Kotlin, Jetpack Compose, Room, and Hilt
- **Chit**: A flexible record in CWOC that can serve as a task, note, calendar event, alarm, checklist, or project
- **Nest_Thread_Id**: A field on a non-email chit that associates it with an email thread, causing it to display inline within that thread
- **Thread_Picker**: A modal/sheet that lists email chits and allows the user to select one as the nest target
- **Export_Button**: A button in the Admin settings tab that triggers a data export (chits, user data, or all)
- **Share_Sheet**: The Android system share intent that allows the user to save/send the exported file
- **AdminSettingsTab**: The Compose screen for admin settings including data management (export/import)
- **ChitEditorScreen**: The Compose screen for editing a single chit's properties
- **ChitEditorViewModel**: The ViewModel managing chit editor state and save logic
- **CwocApiService**: The Retrofit interface defining all server API endpoints

## Requirements

### Requirement 1: Nest Thread Picker in Chit Editor

**User Story:** As a user, I want to associate any non-email chit with an email thread from the editor, so that the chit appears inline within that email thread's expanded view.

#### Acceptance Criteria

1. WHEN the user is editing a non-email chit (no `emailMessageId` and no `emailStatus`), THE App SHALL display a "Nest" button in the editor title/metadata area that opens the Thread_Picker
2. WHEN the user taps the "Nest" button and no nest is currently set, THE App SHALL open a Thread_Picker bottom sheet or dialog listing all email chits (chits with `emailMessageId` or `emailStatus` set, not deleted), sorted by `emailDate` descending (most recent first)
3. THE Thread_Picker SHALL include a search field that filters the email list by subject (`emailSubject` or `title`) and sender (`emailFrom`), updating results as the user types
4. WHEN the user taps an email chit in the Thread_Picker, THE App SHALL set `nestThreadId` on the current chit to the selected email's `id`, close the picker, display the thread subject as a label/chip next to the Nest button, and mark the editor as having unsaved changes
5. WHEN a chit already has a `nestThreadId` set, THE App SHALL display the associated thread's subject as a tappable chip/label in the metadata row, and tapping it SHALL show a confirmation dialog asking whether to remove the nest association
6. WHEN the user confirms removal of the nest association, THE App SHALL clear `nestThreadId` to null, remove the thread label, and mark the editor as having unsaved changes
7. WHEN the user saves the chit after setting or clearing `nestThreadId`, THE App SHALL persist the change to the local Room database and sync it to the server via the existing PUT /api/chits/{id} endpoint with `nest_thread_id` in the changed fields
8. THE Nest button SHALL be hidden for email chits (chits that have `emailMessageId` or `emailStatus` set), since email chits already belong to threads natively
9. IF the Thread_Picker cannot load email chits (network error or empty result), THEN THE App SHALL display an appropriate empty state message ("No email chits found" or "Failed to load emails") within the picker

### Requirement 2: Export Data Buttons (Chits, User Data, All)

**User Story:** As a user, I want to export my data (chits, user data, or everything) from the Android app's settings, so that I can back up or transfer my data.

#### Acceptance Criteria

1. WHEN the user taps the "📤 Export" button in the "Chit Data" section of Admin settings, THE App SHALL call `GET /api/export/chits`, save the response body to a temporary JSON file named `cwoc-chits-export-{YYYYMMDD}.json`, and open the Android share sheet with the file
2. WHEN the user taps the "📤 Export" button in the "User Data" section of Admin settings, THE App SHALL call `GET /api/export/userdata`, save the response body to a temporary JSON file named `cwoc-userdata-export-{YYYYMMDD}.json`, and open the Android share sheet with the file
3. WHEN the user taps the "📤 Export" button in the "All Data" section (if present, or add one), THE App SHALL call `GET /api/export/all`, save the response body to a temporary JSON file named `cwoc-all-export-{YYYYMMDD}.json`, and open the Android share sheet with the file
4. WHILE an export is in progress, THE App SHALL display a loading indicator on the tapped button and disable all export buttons to prevent concurrent exports
5. WHEN the export API call succeeds and the share sheet is opened, THE App SHALL display a success toast ("Export ready — choose where to save")
6. IF the export API call fails (network error, server error, or non-2xx response), THEN THE App SHALL display an error toast with the failure reason and re-enable the export buttons
7. THE App SHALL use the `@Streaming` annotation on the Retrofit calls to handle potentially large export responses without loading the entire body into memory at once
8. AFTER the share sheet is dismissed (regardless of whether the user shared/saved or cancelled), THE App SHALL clean up the temporary file from the app's cache directory


