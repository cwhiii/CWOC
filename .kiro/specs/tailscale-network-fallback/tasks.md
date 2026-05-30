# Implementation Plan: Tailscale Network Fallback

## Overview

Implements automatic network fallback for the Android app. When the primary server URL is unreachable, the app transparently retries using the alternate URL (LAN ↔ Tailscale), communicates the fallback state to the user, and periodically checks to switch back.

## Tasks

- [x] 1. Create NetworkFallbackState singleton — centralized state holder tracking active URL, fallback status, and URL resolution logic. File: `android/app/src/main/java/com/cwoc/app/data/sync/NetworkFallbackState.kt`. Implements primaryUrl/fallbackUrl properties from SharedPreferences, switchToFallback()/switchToPrimary() methods, isFallback StateFlow, activeLabel StateFlow, and isSameHost() helper. (Req 5.4)
- [x] 2. Create NetworkFallbackInterceptor — OkHttp Interceptor that replaces the existing dynamicUrlInterceptor. Rewrites requests to active URL, catches ConnectException/SocketTimeoutException/UnknownHostException, retries on fallback URL with 5s connect timeout per attempt, calls fallbackState.switchToFallback() on success. File: `android/app/src/main/java/com/cwoc/app/data/remote/NetworkFallbackInterceptor.kt`. (Req 2.1–2.7)
- [x] 3. Integrate NetworkFallbackInterceptor into NetworkModule — remove inline dynamicUrlInterceptor lambda, add @Provides for NetworkFallbackState, wire NetworkFallbackInterceptor as first interceptor in OkHttpClient chain. (Req 6.1)
- [x] 4. Cache Tailscale URL from status endpoint — in SettingsViewModel.refreshTailscaleStatus(), after successful response with status="active" and IP, write `tailscale_server_url` to SharedPreferences as `http://<ip>:3333`. Also trigger on app startup when authenticated. (Req 1.1, 1.5)
- [x] 5. Cache LAN URL at login — in AuthRepository.login(), after storing server_url, compare against cached tailscale_server_url. If host doesn't match Tailscale, store as `lan_server_url`. Handle first-time setup case. (Req 1.2, 1.3, 1.4)
- [x] 6. Add reachability check job to NetworkFallbackState — coroutine that polls primary URL every 30s via GET /api/health with 5s timeout while in fallback mode. Requires 2 consecutive 2xx responses before switching back. Auto-starts on switchToFallback(), auto-stops on switchToPrimary(). (Req 5.1, 5.2)
- [x] 7. Lifecycle-aware reachability checks — observe ProcessLifecycleOwner in MainActivity/CwocApplication. Suspend reachability checks when app goes to background, resume when returning to foreground while still in fallback. (Req 5.5)
- [x] 8. Update WebSocketClientImpl for fallback — inject NetworkFallbackState, try primary URL first on connect, fall back to alternate on failure, add 60s periodic primary reconnect timer while connected via fallback, reset backoff on any successful connection. (Req 3.1–3.6)
- [x] 9. Create FallbackBanner UI component — composable showing "Connected via [Tailscale/LAN]" with amber warning styling, AnimatedVisibility for smooth show/hide, non-blocking layout. File: `android/app/src/main/java/com/cwoc/app/ui/components/FallbackBanner.kt`. (Req 4.1, 4.2, 4.3, 4.5)
- [x] 10. Integrate FallbackBanner and toasts into MainActivity — add banner between top bar and content in Scaffold, show toast on fallback transition ("Primary server unreachable — switching to [label]") and on restore ("Reconnected to primary server"), once-per-session toast guard. (Req 4.1, 4.3, 4.4, 5.3)
- [x] 11. SyncEngine logging of active URL — inject NetworkFallbackState, log which URL (primary/fallback) was used for each successful sync cycle via reportLog(). (Req 6.3)
- [x] 12. Verify SyncWorker retry behavior — confirm existing Result.retry() on NetworkError triggers WorkManager backoff when both URLs fail. No code changes needed, just verification that Req 6.2 and 6.4 are satisfied by existing infrastructure. (Req 6.2, 6.4)

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": ["1", "4", "5"], "description": "Foundation — NetworkFallbackState singleton, URL caching"},
    {"tasks": ["2", "6", "8", "9"], "description": "Core logic — interceptor, reachability, WebSocket, banner"},
    {"tasks": ["3", "7", "10", "11"], "description": "Integration — NetworkModule, lifecycle, MainActivity, logging"},
    {"tasks": ["12"], "description": "Verification — confirm SyncWorker behavior"}
  ]
}
```

## Notes

- Tasks 4 and 5 are independent and can be done in parallel with Task 1.
- Task 3 must be done after Task 2 (can't integrate what doesn't exist yet).
- Tasks 9 and 10 are UI-only and can be done after Task 1 is complete.
- Task 12 is verification-only — no code changes expected.
- The NetworkFallbackInterceptor transparently handles fallback for ALL HTTP traffic (SyncEngine, SyncPushEngine, apiService calls from ViewModels, etc.) without requiring changes to those callers.
