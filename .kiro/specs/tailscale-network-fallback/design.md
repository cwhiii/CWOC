# Design Document: Tailscale Network Fallback

## Overview

This design adds automatic network fallback to the Android app so that when the primary server URL is unreachable, the app transparently retries using the alternate URL (LAN ↔ Tailscale). The implementation leverages the existing dynamic URL interceptor pattern in `NetworkModule` and the `ConnectivityMonitor` infrastructure.

## Components and Interfaces

## Architecture

### New Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        NetworkModule                              │
│                                                                   │
│  OkHttpClient interceptor chain:                                  │
│    1. NetworkFallbackInterceptor  ← NEW (replaces dynamicUrl)    │
│    2. AuthInterceptor                                             │
│    3. LoggingInterceptor                                          │
│    + TokenAuthenticator                                           │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────────┐          ┌─────────────────────────┐
│ NetworkFallbackState │◄────────►│ FallbackReachabilityJob │
│  (Singleton)         │          │  (coroutine, 30s poll)  │
│                      │          └─────────────────────────┘
│  - activeUrl: Flow   │
│  - isFallback: Flow  │
│  - primaryUrl        │
│  - fallbackUrl       │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ WebSocketClientImpl  │
│  (updated)           │
│  - tries primary     │
│  - falls back        │
│  - periodic primary  │
│    reconnect (60s)   │
└─────────────────────┘
```

### Component Details

#### 1. `NetworkFallbackState` (new singleton)

**File:** `android/app/src/main/java/com/cwoc/app/data/sync/NetworkFallbackState.kt`

Centralized state holder for the current active URL and fallback configuration.

```kotlin
@Singleton
class NetworkFallbackState @Inject constructor(
    private val prefs: SharedPreferences
) {
    // Current active URL (primary or fallback)
    private val _activeUrl = MutableStateFlow<String?>(null)
    val activeUrl: StateFlow<String?> = _activeUrl.asStateFlow()

    // Whether currently operating on fallback
    private val _isFallback = MutableStateFlow(false)
    val isFallback: StateFlow<Boolean> = _isFallback.asStateFlow()

    // Label for the active connection ("LAN" or "Tailscale")
    private val _activeLabel = MutableStateFlow("LAN")
    val activeLabel: StateFlow<String> = _activeLabel.asStateFlow()

    val primaryUrl: String?
        get() = prefs.getString("server_url", null)

    val fallbackUrl: String?
        get() {
            val primary = primaryUrl ?: return null
            val tailscaleUrl = prefs.getString("tailscale_server_url", null)
            val lanUrl = prefs.getString("lan_server_url", null)
            // If primary is the tailscale URL, fallback is LAN, and vice versa
            return when {
                tailscaleUrl != null && isSameHost(primary, tailscaleUrl) -> lanUrl
                lanUrl != null && isSameHost(primary, lanUrl) -> tailscaleUrl
                tailscaleUrl != null -> tailscaleUrl  // primary is unknown, try tailscale
                else -> null  // no fallback available
            }
        }

    fun switchToFallback() { ... }
    fun switchToPrimary() { ... }
    fun hasFallback(): Boolean = fallbackUrl != null
}
```

#### 2. `NetworkFallbackInterceptor` (new interceptor, replaces `dynamicUrlInterceptor`)

**File:** `android/app/src/main/java/com/cwoc/app/data/remote/NetworkFallbackInterceptor.kt`

OkHttp `Interceptor` that:
1. Rewrites the request URL to the current active URL (same as existing `dynamicUrlInterceptor`)
2. On `ConnectException`, `SocketTimeoutException`, or `UnknownHostException`: retries the request on the fallback URL
3. On successful fallback: updates `NetworkFallbackState`

```kotlin
class NetworkFallbackInterceptor(
    private val fallbackState: NetworkFallbackState
) : Interceptor {

    override fun intercept(chain: Chain): Response {
        val originalRequest = chain.request()
        val activeUrl = fallbackState.resolveActiveUrl() ?: return chain.proceed(originalRequest)

        // Rewrite URL to active server
        val request = rewriteUrl(originalRequest, activeUrl)

        return try {
            // Use a shorter connect timeout for the primary attempt
            val response = chain.withConnectTimeout(5, TimeUnit.SECONDS)
                .proceed(request)
            response
        } catch (e: Exception) {
            if (!isConnectionFailure(e)) throw e

            // Try fallback URL
            val fallbackUrl = fallbackState.fallbackUrl
                ?: throw e  // No fallback configured

            val fallbackRequest = rewriteUrl(originalRequest, fallbackUrl)
            try {
                val response = chain.withConnectTimeout(5, TimeUnit.SECONDS)
                    .proceed(fallbackRequest)
                // Fallback succeeded — update state
                fallbackState.switchToFallback()
                response
            } catch (fallbackEx: Exception) {
                // Both failed — throw the fallback error
                throw fallbackEx
            }
        }
    }

    private fun isConnectionFailure(e: Exception): Boolean {
        return e is java.net.ConnectException ||
               e is java.net.SocketTimeoutException ||
               e is java.net.UnknownHostException
    }
}
```

#### 3. `FallbackReachabilityJob` (new, managed by NetworkFallbackState)

**File:** Part of `NetworkFallbackState.kt`

A coroutine that runs while in fallback mode, checking primary URL reachability every 30 seconds. Requires 2 consecutive successes before switching back.

```kotlin
// Inside NetworkFallbackState
private var reachabilityJob: Job? = null
private var consecutiveSuccesses = 0

fun startReachabilityChecks(scope: CoroutineScope) {
    reachabilityJob?.cancel()
    reachabilityJob = scope.launch {
        while (isActive && _isFallback.value) {
            delay(30_000)
            if (checkPrimaryReachable()) {
                consecutiveSuccesses++
                if (consecutiveSuccesses >= 2) {
                    switchToPrimary()
                }
            } else {
                consecutiveSuccesses = 0
            }
        }
    }
}
```

#### 4. Updated `WebSocketClientImpl`

Modify `establishConnection()` to:
1. Try primary URL first (5s timeout)
2. On failure, try fallback URL
3. While connected via fallback, attempt primary reconnect every 60s

```kotlin
// In WebSocketClientImpl
private fun establishConnection() {
    val primaryWsUrl = buildWebSocketUrl(fallbackState.primaryUrl)
    val fallbackWsUrl = fallbackState.fallbackUrl?.let { buildWebSocketUrl(it) }

    // Try primary first
    attemptConnection(primaryWsUrl) { success ->
        if (!success && fallbackWsUrl != null) {
            attemptConnection(fallbackWsUrl) { fallbackSuccess ->
                if (fallbackSuccess) {
                    fallbackState.switchToFallback()
                    startPrimaryReconnectTimer()
                } else {
                    scheduleReconnect()
                }
            }
        }
    }
}
```

#### 5. Updated `NetworkModule`

Replace the inline `dynamicUrlInterceptor` lambda with the new `NetworkFallbackInterceptor`:

```kotlin
@Provides
@Singleton
fun provideNetworkFallbackInterceptor(
    fallbackState: NetworkFallbackState
): NetworkFallbackInterceptor {
    return NetworkFallbackInterceptor(fallbackState)
}

@Provides
@Singleton
fun provideOkHttpClient(
    fallbackInterceptor: NetworkFallbackInterceptor,
    authInterceptor: AuthInterceptor,
    tokenAuthenticator: TokenAuthenticator,
    loggingInterceptor: HttpLoggingInterceptor
): OkHttpClient {
    // ... SSL setup ...
    return OkHttpClient.Builder()
        .sslSocketFactory(...)
        .hostnameVerifier { _, _ -> true }
        .addInterceptor(fallbackInterceptor)  // replaces dynamicUrlInterceptor
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .authenticator(tokenAuthenticator)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()
}
```

#### 6. UI: Fallback Banner

**File:** `android/app/src/main/java/com/cwoc/app/ui/components/FallbackBanner.kt`

A thin composable bar displayed below the top app bar when `NetworkFallbackState.isFallback` is true.

```kotlin
@Composable
fun FallbackBanner(fallbackState: NetworkFallbackState) {
    val isFallback by fallbackState.isFallback.collectAsState()
    val label by fallbackState.activeLabel.collectAsState()

    AnimatedVisibility(visible = isFallback) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFFFF3CD))  // Amber warning
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.SwapHoriz, contentDescription = null, tint = Color(0xFF856404))
            Spacer(Modifier.width(8.dp))
            Text(
                "Connected via $label",
                color = Color(0xFF856404),
                fontSize = 13.sp
            )
        }
    }
}
```

Placed in `MainActivity`'s Scaffold, between the top bar and content.

#### 7. URL Caching (Requirement 1)

**Where Tailscale URL gets cached:**

The existing `SettingsViewModel.refreshTailscaleStatus()` already calls `GET /api/network-access/tailscale/status`. After a successful response showing `status: "active"` with an IP, we add:

```kotlin
// In SettingsViewModel or a dedicated TailscaleUrlCacher
if (status.status == "active" && status.ip != null) {
    prefs.edit()
        .putString("tailscale_server_url", "http://${status.ip}:3333")
        .apply()
}
```

**Where LAN URL gets cached:**

At login time, if the login URL doesn't match the cached Tailscale IP, store it as `lan_server_url`:

```kotlin
// In AuthRepository.login()
val tailscaleUrl = prefs.getString("tailscale_server_url", null)
if (tailscaleUrl == null || !isSameHost(serverUrl, tailscaleUrl)) {
    prefs.edit().putString("lan_server_url", serverUrl).apply()
}
```

## Data Flow

### Normal Operation (Primary URL works)
```
Request → NetworkFallbackInterceptor → rewrite to primary → proceed → Response
```

### Fallback Triggered
```
Request → NetworkFallbackInterceptor → rewrite to primary → ConnectException
        → retry with fallback URL → proceed → Response
        → update NetworkFallbackState (isFallback=true)
        → show toast "Primary server unreachable — switching to Tailscale"
        → show FallbackBanner
        → start reachability checks (30s interval)
```

### Primary Restored
```
ReachabilityJob → HEAD primary → 2xx (2 consecutive)
        → update NetworkFallbackState (isFallback=false)
        → show toast "Reconnected to primary server"
        → dismiss FallbackBanner
        → stop reachability checks
```

## SharedPreferences Keys

| Key | Purpose | Set By |
|-----|---------|--------|
| `server_url` | Primary URL (set at login) | AuthRepository.login() |
| `lan_server_url` | Cached LAN URL | AuthRepository.login() |
| `tailscale_server_url` | Cached Tailscale URL | SettingsViewModel (from status endpoint) |

## Error Handling

- If no fallback URL is configured (Tailscale never activated), the interceptor behaves identically to the current `dynamicUrlInterceptor` — no retry, error propagates normally.
- The interceptor only retries on connection-level failures (`ConnectException`, `SocketTimeoutException`, `UnknownHostException`). HTTP errors (4xx, 5xx) are NOT retried — they indicate the server is reachable but returned an error.
- The 5-second connect timeout for the primary attempt is applied per-request via `chain.withConnectTimeout()`. The overall OkHttpClient timeout (30s) remains as a safety net.

## Lifecycle & Battery

- Reachability checks only run while the app is in the foreground (observed via `ProcessLifecycleOwner`).
- When the app goes to background, the reachability job is cancelled.
- When the app returns to foreground while in fallback mode, the reachability job resumes immediately.
- The WebSocket's 60-second primary reconnect timer follows the same lifecycle rules.

## Files Changed

| File | Change |
|------|--------|
| `di/NetworkModule.kt` | Replace inline dynamicUrlInterceptor with NetworkFallbackInterceptor |
| `data/remote/NetworkFallbackInterceptor.kt` | NEW — OkHttp interceptor with fallback retry |
| `data/sync/NetworkFallbackState.kt` | NEW — centralized fallback state + reachability job |
| `data/sync/WebSocketClientImpl.kt` | Add fallback URL support to connection logic |
| `data/repository/AuthRepository.kt` | Cache `lan_server_url` at login |
| `ui/components/FallbackBanner.kt` | NEW — UI banner composable |
| `MainActivity.kt` | Add FallbackBanner to Scaffold, observe state for toasts |
| `ui/screens/settings/SettingsViewModel.kt` | Cache `tailscale_server_url` from status response |
| `di/SyncModule.kt` | Add binding for NetworkFallbackState if needed (or rely on @Inject constructor) |

## Traceability

| Requirement | Component |
|-------------|-----------|
| Req 1: Fallback URL Configuration | AuthRepository, SettingsViewModel, NetworkFallbackState |
| Req 2: HTTP Fallback | NetworkFallbackInterceptor |
| Req 3: WebSocket Fallback | WebSocketClientImpl |
| Req 4: User Communication | FallbackBanner, MainActivity (toasts) |
| Req 5: State Management | NetworkFallbackState, FallbackReachabilityJob |
| Req 6: Sync Integration | NetworkFallbackInterceptor (transparent to SyncEngine/SyncWorker) |

## Data Models

### SharedPreferences Keys

| Key | Type | Purpose |
|-----|------|---------|
| `server_url` | String | Primary URL set at login |
| `lan_server_url` | String | Cached LAN URL (stored at login if not Tailscale) |
| `tailscale_server_url` | String | Cached Tailscale URL (from status endpoint) |
| `device_token` | String | Auth token (existing) |

### NetworkFallbackState Properties

| Property | Type | Description |
|----------|------|-------------|
| `activeUrl` | `StateFlow<String?>` | Currently active server URL |
| `isFallback` | `StateFlow<Boolean>` | Whether operating on fallback |
| `activeLabel` | `StateFlow<String>` | "LAN" or "Tailscale" label for UI |
| `primaryUrl` | `String?` | Read from `server_url` pref |
| `fallbackUrl` | `String?` | Computed alternate URL |

## Correctness Properties

### Property 1: Idempotent Fallback
The interceptor retries the exact same request (same method, headers, body, path) — only the host/port/scheme changes. No request mutation.

**Validates: Requirements 2.6**

### Property 2: Single Retry
Each request is retried at most once on the fallback URL. No infinite retry loops.

**Validates: Requirements 2.1**

### Property 3: State Consistency
`NetworkFallbackState` is the single source of truth. All components (interceptor, WebSocket, UI) read from the same state.

**Validates: Requirements 5.4**

### Property 4: No False Positives
Fallback only triggers on connection-level failures (unreachable host), never on HTTP errors (server responded but with an error code).

**Validates: Requirements 2.7**

### Property 5: Graceful Degradation
If no fallback URL is configured, the system behaves identically to the current implementation — no retry, error propagates normally.

**Validates: Requirements 1.5**

### Property 6: Two-Success Threshold
Primary URL must respond successfully twice consecutively before switching back, preventing flapping on unstable connections.

**Validates: Requirements 5.2**

## Testing Strategy

Since this is a single-user app without a test framework requirement, testing is manual:

1. **LAN → Tailscale fallback**: Log in with LAN IP, disconnect from WiFi (simulate leaving home), verify app switches to Tailscale and shows banner/toast.
2. **Tailscale → LAN fallback**: Log in with Tailscale IP, stop Tailscale on server, verify app switches to LAN and shows banner/toast.
3. **Auto-restore**: While in fallback, restore primary connectivity, verify app switches back within ~60s and shows "Reconnected" toast.
4. **No fallback configured**: Remove Tailscale URL from prefs, verify app behaves normally (no retry, errors propagate).
5. **WebSocket fallback**: Verify WebSocket reconnects via fallback when primary drops, and real-time sync continues.
6. **Background behavior**: Verify reachability checks stop when app is backgrounded and resume on foreground.
