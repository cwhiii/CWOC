package com.cwoc.app.data.remote.dto

/**
 * Request body for PUT /api/sort-orders/{tab} — persist manual sort order for a view.
 * Used by drag-to-reorder in Notes, Checklists, Projects, and Email Bundles.
 */
data class ReorderRequest(
    val ids: List<String>
)
