package com.cwoc.app.data.remote.dto

/**
 * Top-level response from GET /api/sync/changes.
 * Contains the server_version (high-water mark) and optional lists of changed entities.
 */
data class SyncResponseDto(
    val server_version: Int,
    val chits: List<ChitDto>?,
    val contacts: List<ContactDto>?,
    val settings: SettingsDto?
)
