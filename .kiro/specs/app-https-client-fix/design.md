# App HTTPS Client Fix — Bugfix Design

## Overview

The Android app has two related networking bugs: (1) 8+ places create bare `OkHttpClient()` without SSL trust-all-certs configuration, causing silent failures when communicating with the self-signed HTTPS server, and (2) the `SyncPushEngine` uses the Hilt-injected `CwocApiService` singleton whose Retrofit base URL may be stale (defaulting to `http://localhost:3333` before login).

The fix strategy is straightforward:
- Replace all bare `OkHttpClient()` calls with `TrustedHttpClient.instance` (already exists as a singleton)
- Simplify the Coil `ImageLoader` in `CwocApplication` to use `TrustedHttpClient.instance` directly (eliminating the fragile Hilt-injection-timing fallback)
- Give `SyncPushEngine` a `buildApiService()` method (same pattern as `SyncEngine`) so it always uses the current `server_url` from SharedPreferences
- Keep the Hilt-injected `OkHttpClient`/`Retrofit`/`CwocApiService` singleton in `NetworkModule` — it already has a dynamic URL interceptor that rewrites requests, and other Hilt-injected components (like `ContactEditorViewModel`) depend on it

## Glossary

- **Bug_Condition (C)**: Any HTTP call that uses a bare `OkHttpClient()` (no SSL config) to reach the self-signed HTTPS server, OR any call routed through the Hilt Retrofit singleton when `server_url` was not yet set at singleton creation time
- **Property (P)**: All HTTP calls to the CWOC server use trust-all-certs SSL and the current `server_url`
- **Preservation**: Existing working behavior — SyncEngine pull, Hilt-injected OkHttpClient with dynamic URL interceptor, ContactEditorViewModel calls — must remain unchanged
- **TrustedHttpClient**: The singleton at `data/remote/TrustedHttpClient.kt` providing a pre-configured trust-all-certs `OkHttpClient`
- **buildApiService()**: Pattern used by `SyncEngine` to create a fresh Retrofit instance with the current `server_url` and auth token on every call
- **Dynamic URL Interceptor**: The interceptor in `NetworkModule.provideOkHttpClient()` that rewrites every request's host/port/scheme to the current `server_url` from SharedPreferences

## Bug Details

### Bug Condition

The bug manifests in two forms:

**Form 1 — Bare OkHttpClient (SSL failure):** UI-layer code creates `OkHttpClient()` without SSL configuration. When these clients attempt HTTPS requests to the self-signed server, the TLS handshake fails silently.

**Form 2 — Stale Retrofit base URL:** `SyncPushEngine` is injected with `CwocApiService` (created from the Hilt Retrofit singleton). The Hilt `OkHttpClient` has a dynamic URL interceptor that should handle this, but the interceptor only rewrites host/port/scheme — it cannot fix path-routing issues if the base URL's path component differs, and on a fresh install before login, `server_url` in SharedPreferences is null, causing the interceptor to pass through the original `localhost:3333` URL.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type HttpCallSite
  OUTPUT: boolean
  
  RETURN (input.clientInstance IS bare OkHttpClient without SSL config
          AND input.targetUrl.scheme == "https"
          AND input.targetUrl.host uses self-signed certificate)
         OR (input.usesHiltRetrofitSingleton
             AND SharedPreferences["server_url"] WAS null at Retrofit creation time
             AND dynamicUrlInterceptor reads null from SharedPreferences at call time)
END FUNCTION
```

### Examples

- **WeatherModal**: Creates `val client = OkHttpClient()` then calls `$serverUrl/api/geocode` over HTTPS → SSL handshake failure, weather data never loads
- **AttachmentPreviewDialog**: Creates `val client = OkHttpClient()` for text/PDF downloads → attachments never render
- **ContactEditorScreen**: Uses `okhttp3.OkHttpClient().newCall(request).execute()` for image upload/delete → contact images never upload or delete
- **ReleaseNotesDialog**: Creates `val client = OkHttpClient()` for `/api/release-notes` → release notes never load
- **SyncPushEngine**: On fresh install, `pushAll()` uses Hilt `apiService` whose dynamic interceptor reads null `server_url` → push fails silently

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `SyncEngine.buildApiService()` continues to build a fresh Retrofit with trust-all-certs SSL and current `server_url` on every pull sync call
- `ContactEditorViewModel` continues to use the Hilt-injected `okHttpClient` (which already has trust-all-certs and dynamic URL interceptor) for profile fetch/put
- The Hilt-injected `OkHttpClient` in `NetworkModule` continues to provide trust-all-certs SSL, dynamic URL rewriting, auth interceptor, token authenticator, and logging
- `AuthRepository.fetchUserProfile()` continues to build its own fresh Retrofit (it was already fixed to use this pattern)

**Scope:**
All inputs that do NOT involve the 8 bare `OkHttpClient()` call sites or `SyncPushEngine`'s stale-URL issue should be completely unaffected by this fix. This includes:
- All Hilt-injected `OkHttpClient` consumers (they already have SSL + dynamic URL)
- SyncEngine pull operations (already uses `buildApiService()`)
- AuthRepository profile fetch (already uses fresh Retrofit)
- Any future code that correctly uses `TrustedHttpClient.instance`

## Hypothesized Root Cause

Based on the bug description, the root causes are:

1. **Copy-paste without SSL config**: Developers created HTTP calls in UI components by instantiating `OkHttpClient()` directly, not realizing the server requires trust-all-certs SSL. The `TrustedHttpClient` singleton was created later but these call sites were never updated.

2. **SyncPushEngine Hilt dependency**: `SyncPushEngineImpl` is `@Inject`-constructed with `CwocApiService` (the Hilt singleton). While the `OkHttpClient` has a dynamic URL interceptor, on a fresh install the interceptor reads null from `server_url` and passes through the stale `localhost:3333` base URL. Unlike `SyncEngine` which builds fresh on every call, `SyncPushEngine` trusts the singleton.

3. **Coil ImageLoader race condition**: `CwocApplication.newImageLoader()` checks `if (::okHttpClient.isInitialized)` for the Hilt-injected client, with a manual fallback. This is fragile — `TrustedHttpClient.instance` would be simpler and always available.

## Correctness Properties

Property 1: Bug Condition - All server HTTP calls use trust-all-certs SSL

_For any_ HTTP call site that previously used a bare `OkHttpClient()` to reach the CWOC server, the fixed code SHALL use `TrustedHttpClient.instance` (which has trust-all-certs SSL configured), allowing successful TLS handshakes with the self-signed certificate.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Bug Condition - SyncPushEngine uses current server URL

_For any_ push sync operation, the fixed `SyncPushEngine` SHALL build a fresh `CwocApiService` using the current `server_url` from SharedPreferences (via a `buildApiService()` method), ensuring pushes always target the correct server regardless of when the Hilt singleton was created.

**Validates: Requirements 2.7**

Property 3: Preservation - Existing working HTTP paths unchanged

_For any_ HTTP call that already works correctly (SyncEngine pull, Hilt-injected OkHttpClient consumers, AuthRepository fresh Retrofit), the fixed code SHALL produce the same behavior as the original code, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `android/app/src/main/java/com/cwoc/app/ui/components/WeatherModal.kt`

**Change**: Replace `val client = OkHttpClient()` with `val client = TrustedHttpClient.instance`
- Add import for `com.cwoc.app.data.remote.TrustedHttpClient`

---

**File**: `android/app/src/main/java/com/cwoc/app/ui/screens/email/AttachmentPreviewDialog.kt`

**Change**: Replace both `val client = OkHttpClient()` instances with `val client = TrustedHttpClient.instance`
- Add import for `com.cwoc.app.data.remote.TrustedHttpClient`

---

**File**: `android/app/src/main/java/com/cwoc/app/ui/screens/contacts/ContactEditorScreen.kt`

**Change**: Replace all 4 instances of `okhttp3.OkHttpClient().newCall(request).execute()` with `com.cwoc.app.data.remote.TrustedHttpClient.instance.newCall(request).execute()`
- Affects: `uploadContactImage()`, `uploadContactBitmap()`, `deleteContactImage()`, and the password-change call

---

**File**: `android/app/src/main/java/com/cwoc/app/ui/components/ReleaseNotesDialog.kt`

**Change**: Replace `val client = OkHttpClient()` with `val client = TrustedHttpClient.instance`
- Add import for `com.cwoc.app.data.remote.TrustedHttpClient`

---

**File**: `android/app/src/main/java/com/cwoc/app/CwocApplication.kt`

**Change**: Simplify `newImageLoader()` to use `TrustedHttpClient.instance` directly:
```kotlin
override fun newImageLoader(): ImageLoader {
    return ImageLoader.Builder(this)
        .okHttpClient { TrustedHttpClient.instance }
        .crossfade(true)
        .build()
}
```
- Remove the `@Inject lateinit var okHttpClient: OkHttpClient` field (no longer needed for ImageLoader)
- Add import for `com.cwoc.app.data.remote.TrustedHttpClient`

---

**File**: `android/app/src/main/java/com/cwoc/app/data/sync/SyncPushEngine.kt`

**Change**: Add a private `buildApiService()` method (same pattern as `SyncEngine`) and use it instead of the injected `apiService`:
1. Add `SharedPreferences` as a constructor parameter (already available via Hilt)
2. Add `buildApiService()` that reads `server_url` and `device_token` from prefs, builds a fresh Retrofit with `TrustedHttpClient.instance` + auth interceptor
3. Replace `apiService.pushChanges(request)` with `buildApiService()?.pushChanges(request)` (with null-check for missing URL/token)
4. Remove the `apiService: CwocApiService` constructor parameter (no longer needed)

---

**File**: `android/app/src/main/java/com/cwoc/app/di/NetworkModule.kt`

**Change**: Keep as-is. The Hilt-injected `OkHttpClient`, `Retrofit`, and `CwocApiService` remain for other consumers (`ContactEditorViewModel`, etc.) that depend on them. The dynamic URL interceptor handles the stale-URL problem for those consumers. Only `SyncPushEngine` needs its own fresh Retrofit because it runs on a schedule where timing matters.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Attempt HTTPS calls using bare `OkHttpClient()` against the self-signed server and observe SSL failures. Attempt push sync on a fresh install and observe the stale-URL failure.

**Test Cases**:
1. **Weather Fetch Test**: Call the geocode endpoint with bare `OkHttpClient()` over HTTPS (will fail with SSLHandshakeException on unfixed code)
2. **Attachment Download Test**: Fetch an attachment URL with bare `OkHttpClient()` over HTTPS (will fail with SSLHandshakeException on unfixed code)
3. **Contact Image Upload Test**: POST multipart image with bare `OkHttpClient()` over HTTPS (will fail with SSLHandshakeException on unfixed code)
4. **Push Sync Stale URL Test**: Call `pushAll()` when `server_url` was null at Hilt singleton creation time (will fail with connection refused on unfixed code)

**Expected Counterexamples**:
- `javax.net.ssl.SSLHandshakeException: java.security.cert.CertPathValidatorException` for all bare client calls
- `java.net.ConnectException: Connection refused` for push sync targeting localhost:3333

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL callSite WHERE isBugCondition(callSite) DO
  result := fixedCallSite(callSite)
  ASSERT result.sslHandshakeSucceeded == true
  ASSERT result.targetHost == currentServerUrl
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL callSite WHERE NOT isBugCondition(callSite) DO
  ASSERT originalBehavior(callSite) == fixedBehavior(callSite)
END FOR
```

**Testing Approach**: Manual verification is most appropriate here because:
- The fix is mechanical (replacing one client instance with another)
- The SSL behavior is binary (works or doesn't)
- The affected code paths are in UI components that are difficult to unit test in isolation
- Property-based testing would require mocking the entire HTTP stack

**Test Plan**: After applying the fix, verify each affected screen loads data correctly:
1. Weather modal shows forecast data
2. Attachment previews render (text and PDF)
3. Contact image upload/delete works
4. Release notes dialog shows content
5. Push sync succeeds after fresh login

### Unit Tests

- Test that `TrustedHttpClient.instance` has SSL socket factory configured
- Test that `SyncPushEngine.buildApiService()` returns null when `server_url` is missing
- Test that `SyncPushEngine.buildApiService()` creates a valid API service when `server_url` is present
- Test that `SyncPushEngine.pushAll()` handles null from `buildApiService()` gracefully

### Property-Based Tests

- Generate random server URLs and verify `SyncPushEngine.buildApiService()` always produces a Retrofit with the correct base URL
- Generate random push payloads and verify `SyncPushEngine` correctly delegates to the fresh API service

### Integration Tests

- Test full push sync flow with a configured server URL
- Test that Coil ImageLoader successfully loads an image from the HTTPS server
- Test that weather data loads end-to-end through the WeatherModal
