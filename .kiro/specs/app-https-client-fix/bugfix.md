# Bugfix Requirements Document

## Introduction

The Android app has two related networking bugs that cause most server communication to silently fail:

1. **Bare OkHttpClient instances** — 8+ places in the UI layer create `OkHttpClient()` without SSL trust-all-certs configuration. Since the CWOC server uses HTTPS with a self-signed certificate, these bare clients reject the cert, causing image loading (profile pictures, contact images), file attachments (upload/download), weather data, release notes, and contact image management to all fail silently.

2. **Stale Retrofit singleton base URL** — The Hilt-injected Retrofit singleton is created at app startup with whatever `server_url` is in SharedPreferences at that moment. On a fresh install (before login), this defaults to `http://localhost:3333` and never updates, causing `fetchUserProfile()` and `SyncPushEngine` to fail permanently.

The SyncEngine (pull) is unaffected because it builds a fresh Retrofit instance on every call via `buildApiService()`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the app attempts to load server images (profile pictures, contact images) using bare `OkHttpClient()` instances THEN the system silently fails because the self-signed HTTPS certificate is rejected

1.2 WHEN the app attempts to upload or download file attachments using bare `OkHttpClient()` instances THEN the system silently fails because the self-signed HTTPS certificate is rejected

1.3 WHEN the app attempts to fetch weather data using a bare `OkHttpClient()` instance THEN the system silently fails because the self-signed HTTPS certificate is rejected

1.4 WHEN the app attempts to load release notes using a bare `OkHttpClient()` instance THEN the system silently fails because the self-signed HTTPS certificate is rejected

1.5 WHEN the app attempts to upload or delete contact images using bare `OkHttpClient()` instances THEN the system silently fails because the self-signed HTTPS certificate is rejected

1.6 WHEN the app process starts before login (fresh install) and `fetchUserProfile()` is called via the Hilt-injected Retrofit singleton THEN the system fails because the singleton's base URL is `http://localhost:3333` (stale default) and never updates to the actual server URL

1.7 WHEN `SyncPushEngine.pushAll()` uses the Hilt-injected Retrofit singleton after a fresh install THEN the system fails because the singleton's base URL is stale and points to `http://localhost:3333` instead of the configured server

### Expected Behavior (Correct)

2.1 WHEN the app attempts to load server images (profile pictures, contact images) THEN the system SHALL use `TrustedHttpClient.instance` (which trusts all certs) and successfully load images over HTTPS with the self-signed certificate

2.2 WHEN the app attempts to upload or download file attachments THEN the system SHALL use `TrustedHttpClient.instance` and successfully complete the transfer over HTTPS with the self-signed certificate

2.3 WHEN the app attempts to fetch weather data THEN the system SHALL use `TrustedHttpClient.instance` and successfully retrieve weather data over HTTPS with the self-signed certificate

2.4 WHEN the app attempts to load release notes THEN the system SHALL use `TrustedHttpClient.instance` and successfully load release notes over HTTPS with the self-signed certificate

2.5 WHEN the app attempts to upload or delete contact images THEN the system SHALL use `TrustedHttpClient.instance` and successfully complete the operation over HTTPS with the self-signed certificate

2.6 WHEN `fetchUserProfile()` is called THEN the system SHALL use the current `server_url` from SharedPreferences (not the stale singleton URL) to make the request, using the same fresh-Retrofit pattern as `SyncEngine.buildApiService()`

2.7 WHEN `SyncPushEngine.pushAll()` is called THEN the system SHALL use the current `server_url` from SharedPreferences (not the stale singleton URL) to make the request, using the same fresh-Retrofit pattern as `SyncEngine.buildApiService()`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `SyncEngine` performs a pull sync via `buildApiService()` THEN the system SHALL CONTINUE TO build a fresh Retrofit instance with the correct server URL and trust-all-certs SSL on every call

3.2 WHEN the Coil ImageLoader loads images from the server THEN the system SHALL CONTINUE TO use a trust-all-certs OkHttpClient (now reliably via `TrustedHttpClient.instance` rather than depending on Hilt injection timing)

3.3 WHEN the Hilt-injected OkHttpClient is used by other components (via the dynamic URL interceptor in NetworkModule) THEN the system SHALL CONTINUE TO rewrite request URLs to the current `server_url` from SharedPreferences

3.4 WHEN the app communicates with the server over HTTPS for any purpose THEN the system SHALL CONTINUE TO accept the self-signed certificate without errors
