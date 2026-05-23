# Implementation Plan

## Overview
Replace all bare `OkHttpClient()` calls with `TrustedHttpClient.instance`, simplify the Coil ImageLoader, add `buildApiService()` to SyncPushEngine, remove debugging diagnostics, and bump the version.

## Tasks

- [ ] 1. Replace bare OkHttpClient() in WeatherModal.kt
  - Replace `val client = OkHttpClient()` with `val client = TrustedHttpClient.instance`
  - Add import for `com.cwoc.app.data.remote.TrustedHttpClient`
  - Remove unused `okhttp3.OkHttpClient` import if no longer needed
  - _Requirements: 2.3_

- [ ] 2. Replace bare OkHttpClient() in AttachmentPreviewDialog.kt
  - Replace both `val client = OkHttpClient()` instances with `val client = TrustedHttpClient.instance`
  - Add import for `com.cwoc.app.data.remote.TrustedHttpClient`
  - Remove unused `okhttp3.OkHttpClient` import if no longer needed
  - _Requirements: 2.2_

- [ ] 3. Replace bare OkHttpClient() in ContactEditorScreen.kt
  - Replace all 4 instances of `okhttp3.OkHttpClient().newCall(request).execute()` with `TrustedHttpClient.instance.newCall(request).execute()`
  - Affects: `uploadContactImage()`, `uploadContactBitmap()`, `deleteContactImage()`, and the password-change call
  - Add import for `com.cwoc.app.data.remote.TrustedHttpClient`
  - Remove unused bare `okhttp3.OkHttpClient` import if no longer needed
  - _Requirements: 2.1, 2.5_

- [ ] 4. Replace bare OkHttpClient() in ReleaseNotesDialog.kt
  - Replace `val client = OkHttpClient()` with `val client = TrustedHttpClient.instance`
  - Add import for `com.cwoc.app.data.remote.TrustedHttpClient`
  - Remove unused `okhttp3.OkHttpClient` import if no longer needed
  - _Requirements: 2.4_

- [ ] 5. Simplify CwocApplication.newImageLoader() to use TrustedHttpClient.instance
  - Replace the `newImageLoader()` body with: `ImageLoader.Builder(this).okHttpClient { TrustedHttpClient.instance }.crossfade(true).build()`
  - Remove the `@Inject lateinit var okHttpClient: OkHttpClient` field (no longer needed for ImageLoader)
  - Remove the `if (::okHttpClient.isInitialized)` fallback logic
  - Add import for `com.cwoc.app.data.remote.TrustedHttpClient`
  - _Requirements: 3.2_

- [ ] 6. Add buildApiService() to SyncPushEngine
  - Add a private `buildApiService()` method following the same pattern as `SyncEngine.buildApiService()`
  - Reads `server_url` and `device_token` from SharedPreferences
  - Builds a fresh Retrofit with `TrustedHttpClient.instance` + auth interceptor
  - Returns null if `server_url` or `device_token` is missing
  - Replace `apiService.pushChanges(request)` with `buildApiService()?.pushChanges(request)` (with null-check)
  - Remove the `apiService: CwocApiService` constructor parameter if no longer needed
  - Add `SharedPreferences` as constructor parameter if not already present
  - _Requirements: 2.7_

- [ ] 7. Remove diagnostic/logging code added during debugging
  - Remove the clipboard diagnostic paste in `MainActivity` (the startup diagnostic report)
  - Remove any `LaunchedEffect` diagnostics added for debugging
  - Remove any other temporary logging/diagnostic code added while investigating this bug
  - _Requirements: cleanup_

- [ ] 8. Version bump
  - Run `date "+%Y%m%d.%H%M"` to get the current timestamp
  - Update `versionName` in `android/app/build.gradle.kts` to `mYYYYMMDD.HHMM` using the real timestamp
  - Increment `versionCode` by 1
  - _Requirements: versioning_

- [ ] 9. Checkpoint — Verify all changes are consistent
  - Confirm all 8 bare OkHttpClient() call sites across 5 files have been replaced
  - Confirm SyncPushEngine uses buildApiService() pattern
  - Confirm CwocApplication.newImageLoader() uses TrustedHttpClient.instance directly
  - Confirm all diagnostic/debug code is removed
  - Confirm no new dependencies were added
  - Deployment: **Mobile: clean build → update**

## Task Dependency Graph

```json
{
  "waves": [
    ["1", "2", "3", "4", "5", "6", "7"],
    ["8"],
    ["9"]
  ]
}
```

## Notes
- Tasks 1-4 are independent and can be done in any order (all are the same mechanical replacement)
- Task 5 (CwocApplication) is independent of 1-4
- Task 6 (SyncPushEngine) is independent of 1-5
- Task 7 (cleanup) is independent of 1-6
- Task 8 (version bump) should be done last before the checkpoint
- No tests required per project rules
- No new dependencies — TrustedHttpClient already exists in the codebase
- Platform: App only (Android)
