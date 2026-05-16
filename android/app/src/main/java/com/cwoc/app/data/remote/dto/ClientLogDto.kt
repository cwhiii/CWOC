package com.cwoc.app.data.remote.dto

/**
 * Request body for POST /api/client-log.
 */
data class ClientLogRequest(
    val message: String,
    val level: String = "error",
    val source: String = "android",
    val timestamp: String? = null
)

/**
 * Response from POST /api/client-log.
 */
data class ClientLogResponse(
    val ok: Boolean,
    val error: String? = null
)
