package com.cwoc.app.data.remote.dto

/**
 * Top-level response from POST /api/sync/push.
 * Contains per-entity results and the updated server version.
 */
data class SyncPushResponseDto(
    val results: PushResultsDto,
    val server_version: Int
)

/**
 * Container for per-entity push results.
 * Each list is nullable to handle cases where that entity type wasn't included in the push.
 */
data class PushResultsDto(
    val chits: List<ChitPushResultDto>? = null,
    val contacts: List<ContactPushResultDto>? = null,
    val settings: SettingsPushResultDto? = null
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

/**
 * Per-contact result from a push operation.
 * Status values mirror chit push results:
 * - "accepted": server accepted the push as-is
 * - "created": server created a new contact record
 * - "merged": server merged with concurrent changes (merged contact returned)
 * - "error": server rejected the push (dirty state preserved for retry)
 */
data class ContactPushResultDto(
    val id: String,
    val status: String,
    val sync_version: Int?,
    val conflict_fields: List<String>?,
    val merged: ContactDto?
)

/**
 * Settings push result from the server.
 * Status values:
 * - "accepted": server accepted the settings push as-is
 * - "merged": server merged with concurrent changes (LWW — merged settings returned)
 */
data class SettingsPushResultDto(
    val status: String,
    val sync_version: Int?,
    val merged: SettingsDto?
)
