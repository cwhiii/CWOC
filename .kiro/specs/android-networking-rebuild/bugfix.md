# Bugfix Requirements Document

## Introduction

The Android app's entire networking layer is non-functional due to a fragmented, non-standard architecture. Multiple competing OkHttpClient instances are created independently across the codebase (SyncEngine builds its own inline, SyncPushEngine uses TrustedHttpClient.instance, Coil uses TrustedHttpClient.instance, login builds a one-off client, AuthRepository.fetchUserProfile builds another one-off client), while the properly-configured Hilt-provided OkHttpClient in NetworkModule goes unused. Additionally, EncryptedSharedPreferences returns NULL for `server_url` and `device_token` in components that need them, causing all network operations to abort. The result: sync (pull and push), image loading, file uploads, and profile fetching all fail 100% of the time.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN SyncEngine attempts to sync THEN the system builds a new OkHttpClient from scratch with inline SSL setup on every call, bypassing the Hilt-provided client with its dynamic URL interceptor, auth interceptor, logging, and token authenticator

1.2 WHEN SyncPushEngine attempts to push changes THEN the system uses TrustedHttpClient.instance.newBuilder() which lacks auth interceptor, dynamic URL interceptor, logging, and token authenticator

1.3 WHEN Coil attempts to load images (profile avatar, attachments) THEN the system uses TrustedHttpClient.instance which has no auth header and no dynamic URL rewriting, causing all image requests to fail with 401 or connection errors

1.4 WHEN AuthRepository.login() succeeds THEN the system persists credentials via commit() but subsequent reads from the Hilt-injected SharedPreferences instance return NULL for server_url and device_token in other components

1.5 WHEN AuthRepository.fetchUserProfile() is called THEN the system builds yet another one-off OkHttpClient with inline SSL setup instead of using the Hilt-provided client

1.6 WHEN the Hilt-provided NetworkModule OkHttpClient (with dynamic URL interceptor, auth interceptor, logging, and token authenticator) is available THEN no component in the app actually uses it for network operations — SyncEngine, SyncPushEngine, image loading, and file uploads all bypass it

1.7 WHEN any component reads server_url or device_token from SharedPreferences after login THEN the values are NULL because the EncryptedSharedPreferences instance is not being shared correctly across the app lifecycle, causing all authenticated network calls to abort before executing

1.8 WHEN file uploads are attempted THEN the system uses TrustedHttpClient.instance directly which lacks auth headers and dynamic URL rewriting, causing uploads to fail

### Expected Behavior (Correct)

2.1 WHEN SyncEngine attempts to sync THEN the system SHALL use the Hilt-injected CwocApiService (backed by the single NetworkModule OkHttpClient) which already has SSL trust-all, dynamic URL interceptor, auth interceptor, logging, and token authenticator configured

2.2 WHEN SyncPushEngine attempts to push changes THEN the system SHALL use the Hilt-injected CwocApiService (backed by the single NetworkModule OkHttpClient) instead of building its own client from TrustedHttpClient

2.3 WHEN Coil attempts to load images THEN the system SHALL use the Hilt-provided OkHttpClient which includes the auth interceptor (for Bearer token) and dynamic URL interceptor (for correct server host/port/scheme)

2.4 WHEN AuthRepository.login() succeeds THEN the system SHALL persist credentials such that all components reading from the same Hilt-injected SharedPreferences instance can immediately read back server_url and device_token without NULL values

2.5 WHEN AuthRepository.fetchUserProfile() is called THEN the system SHALL use the Hilt-injected CwocApiService rather than building a one-off client, since the dynamic URL interceptor already handles the correct base URL

2.6 WHEN the app needs to make any authenticated HTTP request THEN the system SHALL route it through the single Hilt-provided OkHttpClient (or the CwocApiService built on top of it), ensuring consistent SSL, auth, URL rewriting, logging, and timeout configuration

2.7 WHEN login persists server_url and device_token to EncryptedSharedPreferences THEN all Hilt-injected components reading from the same SharedPreferences singleton SHALL see the updated values immediately on subsequent reads

2.8 WHEN file uploads are attempted THEN the system SHALL use the Hilt-provided OkHttpClient which includes auth headers and dynamic URL rewriting

2.9 WHEN the networking rebuild is complete THEN TrustedHttpClient.kt SHALL be deleted entirely as it is replaced by the Hilt-provided singleton OkHttpClient

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the server uses a self-signed HTTPS certificate THEN the system SHALL CONTINUE TO trust all certificates (trust-all-certs SSL configuration) as currently implemented in NetworkModule

3.2 WHEN the server URL is dynamic (user-provided at login, stored in SharedPreferences) THEN the system SHALL CONTINUE TO use the dynamic URL interceptor pattern (rewrite request host/port/scheme from prefs) as currently implemented in NetworkModule

3.3 WHEN a 401 response is received THEN the system SHALL CONTINUE TO trigger token revocation via TokenAuthenticator as currently configured in NetworkModule

3.4 WHEN the login endpoint is called THEN the system SHALL CONTINUE TO work without an auth token (login is the one call that doesn't require a Bearer token), using either the same client without the auth interceptor firing or a minimal variant

3.5 WHEN sync processes chits, contacts, settings, tag renames, and profile data THEN the system SHALL CONTINUE TO handle all data types with the same business logic (upsert, delete, merge, conflict resolution) currently in SyncEngine and SyncPushEngine

3.6 WHEN the app starts and no credentials are stored (first launch or after logout) THEN the system SHALL CONTINUE TO gracefully handle the absence of server_url/device_token without crashing

3.7 WHEN EncryptedSharedPreferences encounters a corrupted Keystore key THEN the system SHALL CONTINUE TO recover by deleting the corrupted prefs file and recreating, as currently implemented in AppModule
