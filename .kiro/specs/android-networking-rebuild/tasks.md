# Implementation Plan

## Overview
Consolidate ALL HTTP traffic through the single Hilt-provided OkHttpClient/CwocApiService. Remove all competing client instances (TrustedHttpClient, inline buildApiService() methods, one-off clients in AuthRepository). Remove diagnostic code from CwocApplication. Delete TrustedHttpClient.kt entirely. This fixes sync, image loading, file uploads, and profile fetching — all of which currently fail 100% of the time due to missing auth headers, wrong URLs, or absent interceptors.

## Tasks

- [x] 1. Verify/fix NetworkModule OkHttpClient configuration
  - Confirm AuthInterceptor skips adding Bearer token for `/api/auth/device-token` (login endpoint)
  - Confirm dynamic URL interceptor handles null `server_url` gracefully (passes request through unchanged, no crash)
  - If either behavior is missing or broken, fix it now — all downstream tasks depend on this
  - _Bug_Condition: isBugCondition(input) where clientSource NOT IN ["Hilt OkHttpClient", "Hilt CwocApiService"]_
  - _Preservation: AuthInterceptor skips login endpoint; dynamic URL interceptor passes through when server_url is null_
  - _Requirements: 2.6, 3.1, 3.2, 3.3, 3.4, 3.6_

- [x] 2. Refactor SyncEngine — remove buildApiService(), inject CwocApiService
  - Delete the private `buildApiService()` method entirely (lines that create inline OkHttpClient + Retrofit + CwocApiService)
  - Add `private val apiService: CwocApiService` to the `@Inject constructor`
  - Update `performSync()`: replace `val apiService = buildApiService()` with a null-check on credentials (`server_url`/`device_token` from prefs — if null, return early with error), then use the injected `apiService` directly
  - Update `reportLog()`: same pattern — use injected `apiService` instead of `buildApiService()`
  - Remove all OkHttp/Retrofit/SSL imports that are no longer needed (`javax.net.ssl.*`, `java.security.*`, `OkHttpClient`, `Retrofit`, `GsonConverterFactory`, `TimeUnit`)
  - _Bug_Condition: SyncEngine creates its own OkHttpClient bypassing Hilt's dynamic URL interceptor, auth interceptor, logging, and token authenticator_
  - _Expected_Behavior: SyncEngine uses Hilt-injected CwocApiService for all HTTP calls_
  - _Preservation: All sync business logic (chit/contact/settings upsert, delete, merge, conflict resolution, tag renames, alarm scheduling) remains identical_
  - _Requirements: 1.1, 2.1, 3.5_

- [x] 3. Refactor SyncPushEngine — remove buildApiService(), inject CwocApiService
  - Delete the private `buildApiService()` method in `SyncPushEngineImpl`
  - Add `private val apiService: CwocApiService` to the `@Inject constructor`
  - Remove `TrustedHttpClient` import
  - Remove `Retrofit` and `GsonConverterFactory` imports
  - Update `pushAll()`: replace `val apiService = buildApiService()` with a null-check on credentials from prefs, then use injected `apiService`
  - Update `pushChitEntities()`: same pattern
  - _Bug_Condition: SyncPushEngine uses TrustedHttpClient.instance.newBuilder() which lacks dynamic URL interceptor, logging, and token authenticator_
  - _Expected_Behavior: SyncPushEngine uses Hilt-injected CwocApiService for all HTTP calls_
  - _Preservation: All push business logic (accepted/created/merged/error handling, conflict resolution, dirty state management) remains identical_
  - _Requirements: 1.2, 2.2, 3.5_

- [x] 4. Refactor AuthRepository — remove one-off clients in login() and fetchUserProfile()
  - In `login()`: remove the entire inline SSL/OkHttpClient/Retrofit block; use the injected `apiService.authenticate(request)` directly (AuthInterceptor already skips `/api/auth/device-token`)
  - In `fetchUserProfile()`: remove the entire inline SSL/OkHttpClient/Retrofit block; use the injected `apiService.getMe()` directly (dynamic URL interceptor handles correct base URL)
  - Remove all inline SSL imports (`javax.net.ssl.*`, `java.security.*`, `okhttp3.OkHttpClient`, `retrofit2.Retrofit`, `retrofit2.converter.gson.GsonConverterFactory`, `java.util.concurrent.TimeUnit`)
  - Keep all error handling, credential persistence, and StateFlow updates unchanged
  - _Bug_Condition: AuthRepository builds one-off clients that duplicate NetworkModule logic and bypass logging/token authenticator_
  - _Expected_Behavior: AuthRepository uses Hilt-injected CwocApiService for login and profile fetch_
  - _Preservation: Login still works without pre-existing Bearer token; credential persistence unchanged; error handling unchanged_
  - _Requirements: 1.4, 1.5, 2.4, 2.5, 3.4_

- [x] 5. Fix CwocApplication — inject OkHttpClient for Coil, remove all diagnostic code
  - Add `@Inject lateinit var okHttpClient: OkHttpClient` field
  - Update `newImageLoader()`: replace `TrustedHttpClient.instance` with the injected `okHttpClient`
  - Delete the entire diagnostic coroutine in `onCreate()` (the `CoroutineScope(Dispatchers.IO).launch` block that polls for credentials and calls `runHttpDiagnostic()`)
  - Delete the entire `runHttpDiagnostic()` private method
  - Delete the `copyToClipboard()` helper method
  - Remove `TrustedHttpClient` import
  - Remove diagnostic-only imports (`androidx.security.crypto.EncryptedSharedPreferences`, `androidx.security.crypto.MasterKeys`, `okhttp3.Request`, `java.io.PrintWriter`, `java.io.StringWriter`)
  - Keep: CursorWindow size hack, crash handler, notification channels, SyncOrchestrator start, rescheduleAll, WorkManager config
  - _Bug_Condition: Coil uses TrustedHttpClient.instance which has no auth header and no dynamic URL rewriting; diagnostic code creates second EncryptedSharedPreferences instance_
  - _Expected_Behavior: Coil uses Hilt-provided OkHttpClient with auth + URL rewriting; no diagnostic code exists_
  - _Preservation: All non-diagnostic Application behavior unchanged_
  - _Requirements: 1.3, 1.7, 2.3, 2.7_

- [x] 6. Refactor UI components — pass Hilt OkHttpClient instead of TrustedHttpClient

  - [x] 6.1 WeatherModal.kt
    - Accept `OkHttpClient` as a parameter (passed from caller)
    - Replace `TrustedHttpClient.instance` usage with the passed client
    - Remove `TrustedHttpClient` import
    - _Requirements: 2.6_

  - [x] 6.2 ReleaseNotesDialog.kt
    - Accept `OkHttpClient` as a parameter (passed from caller)
    - Replace `TrustedHttpClient.instance` usage with the passed client
    - Remove `TrustedHttpClient` import
    - _Requirements: 2.6_

  - [x] 6.3 AttachmentPreviewDialog.kt
    - Accept `OkHttpClient` as a parameter (passed from caller or ViewModel)
    - Replace `TrustedHttpClient.instance` usage with the passed client
    - Remove `TrustedHttpClient` import
    - _Requirements: 2.6_

  - [x] 6.4 ContactEditorScreen.kt
    - Use Hilt-provided OkHttpClient via ViewModel injection for all HTTP calls (image upload, image delete, password change — 4 call sites)
    - Replace all `TrustedHttpClient.instance` usages
    - Remove `TrustedHttpClient` import
    - _Requirements: 2.6, 2.8_

- [x] 7. Delete TrustedHttpClient.kt
  - Delete `android/app/src/main/java/com/cwoc/app/data/remote/TrustedHttpClient.kt` entirely
  - This file is fully replaced by the Hilt-provided OkHttpClient singleton in NetworkModule
  - _Requirements: 2.9_

- [x] 8. Remove all remaining TrustedHttpClient imports across codebase
  - Search entire `android/` tree for any remaining `import com.cwoc.app.data.remote.TrustedHttpClient` or `TrustedHttpClient` references
  - Remove any found (should be none if tasks 2-6 were done correctly, but verify)
  - Confirm clean compile with no unresolved references
  - _Requirements: 2.9_

- [x] 9. Version bump
  - Run `date "+%Y%m%d.%H%M"` to get the current timestamp
  - Update `versionName` in `android/app/build.gradle.kts` to `mYYYYMMDD.HHMM` using the real timestamp
  - Increment `versionCode` by 1
  - _Requirements: versioning_

- [x] 10. Checkpoint — Verify all changes are consistent
  - Confirm no `TrustedHttpClient` references remain anywhere in the codebase
  - Confirm no `buildApiService()` methods remain in SyncEngine or SyncPushEngine
  - Confirm no inline OkHttpClient/Retrofit creation in AuthRepository
  - Confirm CwocApplication has no diagnostic code
  - Confirm all components route HTTP through Hilt-provided OkHttpClient/CwocApiService
  - Confirm no new dependencies were added
  - Deployment: **Mobile: clean build → uninstall + reinstall**


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3", "4", "5"] },
    { "id": 2, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 3, "tasks": ["7"] },
    { "id": 4, "tasks": ["8"] },
    { "id": 5, "tasks": ["9"] },
    { "id": 6, "tasks": ["10"] }
  ]
}
```

## Notes

- Platform: App only (Android)
- No new dependencies
- No tests required
- Deployment: Mobile: clean build → uninstall + reinstall
