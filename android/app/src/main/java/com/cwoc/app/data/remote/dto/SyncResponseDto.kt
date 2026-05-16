package com.cwoc.app.data.remote.dto

/**
 * Top-level response from GET /api/sync/changes.
 * Contains the server_version (high-water mark) and optional lists of changed entities.
 * Phase 3 adds tag_renames for propagating server-side tag rename operations.
 */
data class SyncResponseDto(
    val server_version: Int = 0,
    val chits: List<ChitDto>?,
    val contacts: List<ContactDto>?,
    val settings: SettingsDto?,
    val tag_renames: List<TagRenameDto>?
)

/**
 * DTO representing a tag rename operation from the server.
 * When received during a pull, the app should update all local chits
 * that contain the old tag, replacing it with the new tag name,
 * without marking those chits as dirty (since the rename is server-originated).
 */
data class TagRenameDto(
    val old_tag: String,
    val new_tag: String
)
