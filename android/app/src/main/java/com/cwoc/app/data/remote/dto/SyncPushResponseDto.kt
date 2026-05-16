package com.cwoc.app.data.remote.dto

/**
 * Top-level response from POST /api/sync/push.
 * Contains per-chit results and the updated server version.
 */
data class SyncPushResponseDto(
    val results: PushResultsDto,
    val server_version: Int
)

/**
 * Container for per-entity push results.
 * Currently only chits are supported; nullable to handle empty responses gracefully.
 */
data class PushResultsDto(
    val chits: List<ChitPushResultDto>?
)

/**
 * Per-chit result from a push operation.
 * Status indicates how the server handled the pushed record:
 * - "accepted": server accepted the push as-is
 * - "created": server created a new record
 * - "merged": server merged with concurrent changes (merged entity returned)
 * - "error": server rejected the push (dirty state preserved for retry)
 */
data class ChitPushResultDto(
    val id: String,
    val status: String,
    val sync_version: Int?,
    val conflict_fields: List<String>?,
    val merged: ChitDto?
)
