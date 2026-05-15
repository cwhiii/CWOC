package com.cwoc.app.data.remote.dto

/**
 * Request body for POST /api/auth/device-token.
 * Fields use snake_case to match the server's expected JSON keys.
 */
data class DeviceTokenRequest(
    val username: String,
    val password: String,
    val device_name: String
)

/**
 * Response from POST /api/auth/device-token.
 * The raw token is returned exactly once by the server.
 */
data class DeviceTokenResponse(
    val token: String,
    val device_id: String,
    val device_name: String,
    val created_datetime: String
)
