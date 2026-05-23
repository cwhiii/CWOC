# Android Networking Rebuild — Bugfix Design

## Overview

The Android app has a fragmented networking layer where 6+ independent OkHttpClient instances are created across the codebase, each with its own SSL setup, auth handling, and URL configuration. Meanwhile, the properly-configured Hilt singleton OkHttpClient in NetworkModule (with trust-all SSL, dynamic URL interceptor, auth interceptor, logging, and token authenticator) goes unused. Additionally, EncryptedSharedPreferences may be instantiated multiple times (diagnostic code creates its own instance), and login writes use `commit()` but other components reading from the Hilt-injected singleton see NULL values.

The fix consolidates ALL HTTP traffic through the single Hilt-provided OkHttpClient, removes all competing client instances (including TrustedHttpClient.kt), fixes the EncryptedSharedPreferences singleton guarantee, and removes all diagnostic code added during debugging.

## Glossary

- **Bug_Condition (C)**: Any HTTP request routed through a non-Hilt OkHttpClient (SyncEngine's inline client, SyncPushEngine's TrustedHttpClient-based client, AuthRepository's one-off clients, Coil's TrustedHttpClient, file upload/download direct TrustedHttpClient usage), OR any SharedPreferences read that returns NULL due to multiple EncryptedSharedPreferences instances
- **Property (P)**: All HTTP requests route through the single Hilt-provided OkHttpClient with consistent SSL, auth, URL rewriting, logging, and timeout configuration; all SharedPreferences reads return the correct persisted values
- **Preservation**: Self-signed cert trust, dynamic URL rewriting, token revocation on 401, login working without Bearer token, sync business logic (upsert/delete/merge/conflict), graceful handling of missing credentials on first launch, Keystore corruption recovery
- **NetworkModule**: The Hilt DI module (`di/NetworkModule.kt`) that provides the singleton OkHttpClient, Retrofit, and CwocApiService
- **TrustedHttpClient**: A static singleton (`data/remote/TrustedHttpClient.kt`) that provides a trust-all-certs OkHttpClient without auth, URL rewriting, or logging — to be deleted
- **Dynamic URL Interceptor**: The interceptor in NetworkModule that rewrites every request's host/port/scheme to match the current `server_url` from SharedPreferences
- **AuthInterceptor**: The interceptor that adds `Bearer <token>` to all requests except `/api/auth/device-token`

## Bug Details

### Bug Condition

The bug manifests when any component makes an HTTP request using a client other than the Hilt-provided OkHttpClient, or when any component reads from an EncryptedSharedPreferences instance that is not the Hilt singleton. The result is: requests lack auth headers (401), requests go to wrong URL (connection errors), requests lack SSL trust (cert errors), or credential reads return NULL (operations abort).

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type {component: String, action: String}
  OUTPUT: boolean
  
  RETURN (input.action == "HTTP_REQUEST" 
          AND input.clientSource NOT IN ["Hilt OkHttpClient", "Hilt CwocApiService"])
         OR (input.action == "PREFS_READ"
             AND input.prefsInstance != HiltSingletonPrefsInstance)
         OR (input.action == "PREFS_WRITE"
             AND input.prefsInstance != HiltSingletonPrefsInstance)
END FUNCTION
```

### Examples

- SyncEngine.buildApiService() creates a new OkHttpClient with inline SSL + manual auth header → lacks dynamic URL interceptor, logging, token authenticator. Expected: uses Hilt-injected CwocApiService.
- SyncPushEngine.buildApiService() uses TrustedHttpClient.instance.newBuilder() + manual auth interceptor → lacks dynamic URL interceptor, logging, token authenticator. Expected: uses Hilt-injected CwocApiService.
- CwocApplication.newImageLoader() uses TrustedHttpClient.instance for Coil → lacks auth header and dynamic URL rewriting, all image loads fail with 401. Expected: uses Hilt-provided OkHttpClient.
- AuthRepository.fetchUserProfile() builds a one-off client with inline SSL + manual auth → duplicates NetworkModule logic. Expected: uses Hilt-injected CwocApiService (dynamic URL interceptor handles correct base URL).
- AttachmentsZone, ContactEditorScreen, WeatherModal, ReleaseNotesDialog, AttachmentPreviewDialog all use TrustedHttpClient.instance directly → no auth, no URL rewriting. Expected: use Hilt-provided OkHttpClient.
- CwocApplication diagnostic code creates a second EncryptedSharedPreferences instance → potential file-level contention with the Hilt singleton. Expected: no second instance exists.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Self-signed HTTPS certificate trust (trust-all-certs X509TrustManager) must continue to work
- Dynamic URL interceptor must continue to rewrite request host/port/scheme from SharedPreferences `server_url`
- AuthInterceptor must continue to skip adding Bearer token to `/api/auth/device-token` (login endpoint)
- TokenAuthenticator must continue to clear token and emit revocation event on 401
- Dynamic URL interceptor must gracefully pass through requests when `server_url` is null (pre-login state)
- All sync business logic (chit/contact/settings upsert, delete, merge, conflict resolution, tag renames, alarm scheduling) must remain identical
- Keystore corruption recovery in AppModule must continue to work
- Login must continue to work without a pre-existing Bearer token
- App must not crash when credentials are absent (first launch, post-logout)

**Scope:**
All inputs that do NOT involve creating a new OkHttpClient or reading from a non-singleton SharedPreferences instance should be completely unaffected by this fix. This includes:
- All Room database operations
- All UI rendering and state management
- All WorkManager scheduling
- All notification channel management
- All business logic within sync engines (only the HTTP transport layer changes)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Historical Stale-URL Workaround**: SyncEngine and SyncPushEngine were written before the dynamic URL interceptor existed in NetworkModule. They built their own clients to ensure the correct `server_url` was used. Now that NetworkModule has the dynamic URL interceptor, these workarounds are unnecessary and harmful (they bypass auth, logging, and token revocation).

2. **TrustedHttpClient as a Crutch**: TrustedHttpClient.kt was created as a quick way to get trust-all SSL without understanding that NetworkModule already provides this. Components adopted it because it was easy to reference statically, but it lacks all the interceptors that make requests actually work.

3. **EncryptedSharedPreferences Multiple Instantiation**: The diagnostic code in CwocApplication creates its own EncryptedSharedPreferences instance (calling `EncryptedSharedPreferences.create()` directly). While EncryptedSharedPreferences should handle concurrent access at the file level, having multiple instances can cause read-after-write visibility issues and unnecessary Keystore operations.

4. **Login One-Off Client**: AuthRepository.login() correctly needs a client without the auth interceptor (no token exists yet), but the current AuthInterceptor already handles this case — it skips `/api/auth/device-token`. So the one-off client is unnecessary; the Hilt-provided client already does the right thing for login.

5. **Coil Not Wired to Hilt Client**: CwocApplication.newImageLoader() uses TrustedHttpClient.instance because at the time it was written, there was no easy way to inject the Hilt OkHttpClient into the Application class. But since CwocApplication is `@HiltAndroidApp`, it CAN inject the OkHttpClient.

## Correctness Properties

Property 1: Bug Condition - All HTTP Requests Use Hilt Client

_For any_ HTTP request made by any component in the app (sync pull, sync push, image loading, file upload, file download, profile fetch, weather fetch, release notes fetch, attachment operations), the system SHALL route that request through the single Hilt-provided OkHttpClient (or CwocApiService built on it), ensuring consistent SSL trust, dynamic URL rewriting, auth token injection (except login), request logging, and token revocation handling.

**Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.6, 2.8**

Property 2: Preservation - Login Without Token and Graceful Null URL

_For any_ request to the login endpoint (`/api/auth/device-token`), the AuthInterceptor SHALL NOT add a Bearer token header. For any request made when `server_url` is null in SharedPreferences, the dynamic URL interceptor SHALL pass the request through unchanged (no crash, no rewrite). All existing sync business logic, token revocation, Keystore recovery, and credential persistence SHALL produce identical results to the pre-fix code.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `android/app/src/main/java/com/cwoc/app/di/NetworkModule.kt`

**Changes**:
1. **Expose OkHttpClient for non-Retrofit usage**: The OkHttpClient is already `@Provides @Singleton` — no change needed. Components that need raw OkHttpClient (Coil, file uploads) can inject it directly.

---

**File**: `android/app/src/main/java/com/cwoc/app/data/sync/SyncEngine.kt`

**Function**: `buildApiService()` and all callers

**Specific Changes**:
1. **Remove `buildApiService()` entirely**: Delete the private function that builds an inline OkHttpClient + Retrofit + CwocApiService
2. **Inject CwocApiService via Hilt**: Add `private val apiService: CwocApiService` to the constructor (Hilt-injected)
3. **Remove all OkHttp/Retrofit/SSL imports** that are no longer needed
4. **Update `performSync()`**: Replace `val apiService = buildApiService()` with a null-check on credentials (if `server_url` or `device_token` is null, return early with error) then use the injected `apiService` directly
5. **Update `reportLog()`**: Same pattern — use injected `apiService` instead of `buildApiService()`

---

**File**: `android/app/src/main/java/com/cwoc/app/data/sync/SyncPushEngine.kt`

**Function**: `buildApiService()` in `SyncPushEngineImpl`

**Specific Changes**:
1. **Remove `buildApiService()` entirely**: Delete the private function that uses TrustedHttpClient.instance.newBuilder()
2. **Inject CwocApiService via Hilt**: Add `private val apiService: CwocApiService` to the constructor
3. **Remove TrustedHttpClient import**
4. **Update all methods**: Replace `buildApiService()` calls with credential null-checks then use injected `apiService`

---

**File**: `android/app/src/main/java/com/cwoc/app/data/repository/AuthRepository.kt`

**Function**: `login()` and `fetchUserProfile()`

**Specific Changes**:
1. **Remove one-off client in `login()`**: The Hilt-injected `apiService` already has the AuthInterceptor which skips `/api/auth/device-token`. Use the injected `apiService.authenticate(request)` directly. Remove all inline SSL/OkHttpClient/Retrofit code from login().
2. **Remove one-off client in `fetchUserProfile()`**: Use the injected `apiService.getMe()` directly. The dynamic URL interceptor handles the correct base URL. Remove all inline SSL/OkHttpClient/Retrofit code.
3. **Remove all inline SSL imports** (javax.net.ssl.*, java.security.*)

---

**File**: `android/app/src/main/java/com/cwoc/app/CwocApplication.kt`

**Specific Changes**:
1. **Inject OkHttpClient for Coil**: Add `@Inject lateinit var okHttpClient: OkHttpClient` and use it in `newImageLoader()` instead of `TrustedHttpClient.instance`
2. **Remove ALL diagnostic code**: Delete the entire `runHttpDiagnostic()` method, the diagnostic coroutine in `onCreate()` that polls for credentials, the `copyToClipboard()` helper, and the direct EncryptedSharedPreferences creation in the diagnostic block
3. **Remove TrustedHttpClient import**
4. **Remove diagnostic-related imports** (EncryptedSharedPreferences, MasterKeys, etc. that are only used by diagnostic code)

---

**File**: `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/AttachmentsZone.kt`

**Specific Changes**:
1. **Accept OkHttpClient as a parameter** (passed from the parent composable which can access it via the Hilt ViewModel or LocalContext)
2. **Remove `TrustedHttpClient.instance` usage**

---

**File**: `android/app/src/main/java/com/cwoc/app/ui/screens/email/AttachmentPreviewDialog.kt`

**Specific Changes**:
1. **Accept OkHttpClient as a parameter** or access via ViewModel
2. **Remove `TrustedHttpClient.instance` usage**

---

**File**: `android/app/src/main/java/com/cwoc/app/ui/screens/contacts/ContactEditorScreen.kt`

**Specific Changes**:
1. **Use Hilt-provided OkHttpClient** (via ViewModel injection) for all HTTP calls (image upload, image delete, password change)
2. **Remove `TrustedHttpClient.instance` usage** (4 call sites)

---

**File**: `android/app/src/main/java/com/cwoc/app/ui/components/WeatherModal.kt`

**Specific Changes**:
1. **Accept OkHttpClient as a parameter** or access via ViewModel
2. **Remove `TrustedHttpClient.instance` usage**

---

**File**: `android/app/src/main/java/com/cwoc/app/ui/components/ReleaseNotesDialog.kt`

**Specific Changes**:
1. **Accept OkHttpClient as a parameter** or access via ViewModel
2. **Remove `TrustedHttpClient.instance` usage**

---

**File**: `android/app/src/main/java/com/cwoc/app/data/remote/TrustedHttpClient.kt`

**Specific Changes**:
1. **Delete the entire file** — it is fully replaced by the Hilt-provided OkHttpClient

---

**File**: `android/app/src/main/java/com/cwoc/app/di/AppModule.kt`

**Specific Changes**:
1. **Verify singleton guarantee**: The `@Provides @Singleton` annotation already ensures one instance. No code change needed here, but verify no other code calls `EncryptedSharedPreferences.create()` directly (the diagnostic code in CwocApplication does — removing that diagnostic code fixes this).

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Trace the code paths for each component's HTTP requests and verify they bypass the Hilt client. Run the app on unfixed code and observe failures via client-log and clipboard diagnostics.

**Test Cases**:
1. **SyncEngine Bypass Test**: Verify SyncEngine.buildApiService() creates its own OkHttpClient that lacks the dynamic URL interceptor (will fail on unfixed code — requests may go to wrong host or lack proper auth handling)
2. **SyncPushEngine Bypass Test**: Verify SyncPushEngineImpl.buildApiService() uses TrustedHttpClient without dynamic URL interceptor (will fail on unfixed code)
3. **Coil Image Load Test**: Verify Coil uses TrustedHttpClient.instance which has no auth header (will fail with 401 on unfixed code)
4. **AuthRepository fetchUserProfile Test**: Verify fetchUserProfile builds a one-off client (redundant but functional — may work on unfixed code if credentials are present, but is wasteful)
5. **File Upload Test**: Verify AttachmentsZone uses TrustedHttpClient.instance without auth (will fail with 401 on unfixed code)

**Expected Counterexamples**:
- Image loads return HTTP 401 (no auth header on TrustedHttpClient)
- Sync requests may succeed but lack logging and token revocation handling
- File uploads fail with 401 or connection errors

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL component IN [SyncEngine, SyncPushEngine, Coil, AuthRepository, 
                      AttachmentsZone, ContactEditor, WeatherModal, 
                      ReleaseNotesDialog, AttachmentPreview] DO
  request := component.makeHttpRequest(input)
  ASSERT request.client == HiltProvidedOkHttpClient
  ASSERT request.headers.contains("Authorization: Bearer <token>") OR request.isLoginEndpoint
  ASSERT request.url.host == serverUrlFromPrefs.host
  ASSERT request.url.scheme == serverUrlFromPrefs.scheme
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT syncEngine_fixed.performSync(input) == syncEngine_original.performSync(input)
  ASSERT syncPushEngine_fixed.pushAll(input) == syncPushEngine_original.pushAll(input)
  ASSERT authRepository_fixed.login(input) == authRepository_original.login(input)
END FOR
```

**Testing Approach**: Manual integration testing is the primary approach for this fix because:
- The bug is architectural (wrong client used) not algorithmic (wrong computation)
- The fix is structural refactoring (dependency injection wiring) not logic changes
- Verification is: "does the app sync, load images, upload files after the fix?" — observable end-to-end behavior
- Property-based testing would require mocking the entire OkHttp/Retrofit stack which adds complexity without proportional value for a wiring fix

**Test Plan**: After applying the fix, perform a full app lifecycle test:
1. Fresh install → login → verify credentials persist
2. Verify sync pull works (chits appear)
3. Verify sync push works (edit a chit, confirm it syncs)
4. Verify image loading works (profile avatar, attachments)
5. Verify file upload works (attach a file to a chit)
6. Verify logout/token revocation still works (simulate 401)
7. Verify app doesn't crash on first launch (no credentials yet)

**Test Cases**:
1. **Login Preservation**: Verify login still works without Bearer token (AuthInterceptor skips `/api/auth/device-token`)
2. **Sync Business Logic Preservation**: Verify chit upsert, delete, merge, conflict resolution produce same results
3. **Token Revocation Preservation**: Verify 401 still triggers logout flow via TokenAuthenticator
4. **Graceful Null URL**: Verify app doesn't crash when `server_url` is null (pre-login state, dynamic URL interceptor passes through)
5. **Keystore Recovery**: Verify corrupted Keystore still triggers recovery path in AppModule

### Unit Tests

- Verify AuthInterceptor skips token for `/api/auth/device-token` path
- Verify AuthInterceptor adds token for all other paths when token exists
- Verify AuthInterceptor passes through when token is null (no crash)
- Verify dynamic URL interceptor passes through when `server_url` is null
- Verify dynamic URL interceptor rewrites host/port/scheme when `server_url` is set

### Property-Based Tests

- Not applicable for this fix — the bug is architectural (wrong wiring) not algorithmic. The fix is verified by structural inspection (all TrustedHttpClient references removed, all buildApiService() methods removed) and integration testing.

### Integration Tests

- Full login → sync → image load → file upload → logout flow on physical device
- Verify no regressions in sync conflict resolution
- Verify Coil loads profile images with auth header
- Verify weather modal and release notes dialog fetch data correctly
