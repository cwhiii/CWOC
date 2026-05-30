# Requirements Document

## Introduction

The Android app currently stores a single `server_url` in SharedPreferences (set at login) and uses it for all API, sync, and WebSocket calls via a dynamic URL interceptor in OkHttpClient. A Tailscale IP is already available in the app settings (fetched from the server's Tailscale status endpoint). When the user leaves their home network, the primary server URL (typically a LAN IP like `192.168.1.111:3333`) becomes unreachable, and the app cannot communicate with the server.

This feature adds automatic network fallback: when the primary URL is unreachable, the app transparently retries the request using the alternate URL (Tailscale IP or LAN IP, depending on which was used at login). The fallback works bidirectionally — LAN fails over to Tailscale, and Tailscale fails over to LAN. The user is informed when fallback is in use.

## Glossary

- **App**: The Android mobile application (Kotlin, Jetpack Compose, Hilt DI)
- **Primary_URL**: The `server_url` stored in SharedPreferences, set at login time
- **Fallback_URL**: The alternate server URL used when Primary_URL is unreachable. If Primary_URL is the LAN IP, Fallback_URL is the Tailscale IP (with port), and vice versa
- **Network_Fallback_Interceptor**: An OkHttp Interceptor that catches connection failures on the Primary_URL and retries the request against the Fallback_URL
- **Tailscale_IP**: The IP address of the server on the Tailscale network, retrieved from the server's `/api/network-access/tailscale/status` endpoint and cached locally
- **LAN_IP**: The local network IP address of the server (e.g., `192.168.1.111:3333`)
- **Connection_Failure**: A network error indicating the server is unreachable — specifically `ConnectException`, `SocketTimeoutException`, or `UnknownHostException` from OkHttp
- **Fallback_Banner**: A persistent UI element displayed to the user when the app is operating on the Fallback_URL
- **SyncEngine**: The component responsible for periodic data synchronization between the app and server
- **WebSocketClient**: The component maintaining a persistent WebSocket connection for real-time push sync
- **SharedPreferences**: Android key-value storage where `server_url`, `device_token`, and cached Tailscale IP are persisted

## Requirements

### Requirement 1: Fallback URL Configuration

**User Story:** As a user, I want the app to know both my LAN and Tailscale server addresses, so that it can switch between them automatically.

#### Acceptance Criteria

1. WHEN the Tailscale status is "active" and an IP is returned from the server, THE App SHALL cache the Tailscale_IP in SharedPreferences as `tailscale_server_url` (formatted as `http://<ip>:3333`)
2. WHEN the user logs in with a server URL, THE App SHALL store it as the Primary_URL and compare the URL's host portion against the cached Tailscale_IP host and the cached LAN_IP host to identify the Fallback_URL as whichever one the Primary_URL does not match
3. WHEN the user logs in with a server URL whose host matches neither the cached Tailscale_IP nor the cached LAN_IP, THE App SHALL store the login URL as both the Primary_URL and the LAN_IP, and set no Fallback_URL until a Tailscale_IP is cached
4. WHEN the App successfully connects to the server during login or Tailscale status check, THE App SHALL store the server URL in SharedPreferences as `lan_server_url` if the connection was made over LAN (i.e., the URL host does not match the cached Tailscale_IP host)
5. IF the Tailscale_IP has never been cached or Tailscale status is not "active", THEN THE App SHALL operate without fallback and use only the Primary_URL
6. WHEN the user changes the server URL in settings, THE App SHALL update the Primary_URL and re-derive the Fallback_URL by comparing the new URL's host against the cached Tailscale_IP host and LAN_IP host

### Requirement 2: Automatic Network Fallback for HTTP Requests

**User Story:** As a user, I want the app to automatically try the alternate server address when my primary address is unreachable, so that I maintain connectivity without manual intervention.

#### Acceptance Criteria

1. WHEN an HTTP request to the Primary_URL results in a Connection_Failure (connect timeout, socket timeout, DNS resolution failure, or connection refused), THE Network_Fallback_Interceptor SHALL retry the same request exactly once against the Fallback_URL
2. THE Network_Fallback_Interceptor SHALL apply a connect timeout of 5 seconds for the initial attempt to the Primary_URL, after which the request is treated as a Connection_Failure and fallback is triggered
3. THE Network_Fallback_Interceptor SHALL apply a connect timeout of 5 seconds for the fallback attempt to the Fallback_URL
4. WHEN the fallback request succeeds, THE App SHALL return the successful response to the caller with no modification to the response headers or body
5. IF both the Primary_URL and Fallback_URL are unreachable, THEN THE App SHALL propagate the error from the Fallback_URL attempt to the caller
6. THE Network_Fallback_Interceptor SHALL preserve all original request properties (method, headers, body, path) when retrying on the Fallback_URL
7. THE Network_Fallback_Interceptor SHALL only trigger fallback on Connection_Failure errors (connect timeout, socket timeout, DNS resolution failure, connection refused), not on HTTP error responses (4xx, 5xx) or successful connections that return error status codes

### Requirement 3: WebSocket Fallback

**User Story:** As a user, I want the real-time sync WebSocket to also fall back to the alternate address, so that push notifications continue working regardless of which network I'm on.

#### Acceptance Criteria

1. WHEN the WebSocketClient fails to establish a connection to the Primary_URL within 5 seconds (timeout, refused, or DNS failure), THE WebSocketClient SHALL attempt connection to the Fallback_URL before entering backoff retry
2. WHEN the WebSocket connection drops due to a network change, THE WebSocketClient SHALL attempt reconnection to the Primary_URL with a 5-second timeout, and IF the Primary_URL attempt fails, THEN THE WebSocketClient SHALL attempt connection to the Fallback_URL
3. WHILE the WebSocket is connected via the Fallback_URL, THE WebSocketClient SHALL continue normal operation (receiving push events, sending acknowledgments)
4. WHEN the WebSocket reconnects successfully on either URL, THE WebSocketClient SHALL reset its backoff timer to the initial backoff duration
5. IF both the Primary_URL and Fallback_URL fail to connect, THEN THE WebSocketClient SHALL enter exponential backoff retry, attempting the full Primary_URL-then-Fallback_URL sequence on each retry cycle
6. WHILE the WebSocket is connected via the Fallback_URL, THE WebSocketClient SHALL attempt to reconnect to the Primary_URL every 60 seconds, and WHEN the Primary_URL connection succeeds, THE WebSocketClient SHALL close the Fallback_URL connection and use the Primary_URL connection

### Requirement 4: User Communication

**User Story:** As a user, I want to know when the app is using the fallback connection, so that I understand my connectivity status.

#### Acceptance Criteria

1. WHEN the App successfully falls back to the Fallback_URL, THE App SHALL display a Fallback_Banner within 2 seconds indicating which URL is currently in use
2. THE Fallback_Banner SHALL display a message identifying whether the app is using the Tailscale or LAN connection (e.g., "Connected via Tailscale" or "Connected via LAN")
3. WHEN the Primary_URL becomes reachable again and the app switches back, THE App SHALL dismiss the Fallback_Banner within 2 seconds
4. WHEN the first fallback occurs in a session (defined as a single app launch lifecycle), THE App SHALL show a toast notification for 4 seconds stating "Primary server unreachable — switching to [Tailscale/LAN]"
5. THE Fallback_Banner SHALL remain visible without overlaying or obscuring interactive elements, shall not require user dismissal, and shall not prevent interaction with any app controls beneath or around it

### Requirement 5: Fallback State Management

**User Story:** As a user, I want the app to periodically check if my primary connection is restored, so that it switches back automatically.

#### Acceptance Criteria

1. WHILE the App is operating on the Fallback_URL, THE App SHALL check reachability of the Primary_URL every 30 seconds by issuing an HTTP request and considering the Primary_URL reachable if a response with status 2xx is received within 5 seconds
2. WHEN the Primary_URL returns a 2xx response on 2 consecutive periodic checks, THE App SHALL switch all subsequent new requests to the Primary_URL
3. WHEN the App switches back to the Primary_URL, THE App SHALL show a toast notification for 3 seconds stating "Reconnected to primary server"
4. THE App SHALL track the current active URL (primary or fallback) in a centralized state holder accessible to all network components
5. IF the App is in the background, THEN THE App SHALL suspend periodic reachability checks, and resume them immediately when the App returns to the foreground

### Requirement 6: SyncEngine and SyncWorker Integration

**User Story:** As a user, I want all sync operations to use the fallback mechanism, so that background sync continues working when I change networks.

#### Acceptance Criteria

1. THE SyncEngine SHALL inject the Network_Fallback_Interceptor into the OkHttpClient instance used for all sync HTTP requests, so that fallback behavior applies to every sync network call without per-call configuration
2. WHEN a SyncWorker execution encounters a Connection_Failure (connection timeout, socket timeout, DNS resolution failure, or IOException) on both the primary and fallback URLs, THE SyncWorker SHALL schedule a retry using WorkManager's exponential backoff policy with an initial delay of 30 seconds, up to a maximum of 5 retry attempts before marking the sync cycle as failed
3. THE SyncEngine SHALL log which URL was used for each successful sync cycle (primary or fallback) to the client log via the existing reporting mechanism
4. IF a SyncWorker execution fails on both URLs and retries are exhausted, THEN THE SyncWorker SHALL preserve any partial sync progress (the sync cursor for successfully completed entity types) so that the next sync cycle resumes from the last successful point rather than restarting from the beginning
