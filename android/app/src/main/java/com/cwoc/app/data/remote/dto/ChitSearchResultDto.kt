package com.cwoc.app.data.remote.dto

/**
 * DTO for chit search results from GET /api/chits/search.
 * The server may return either a flat result or a nested chit object.
 */
data class ChitSearchResult(
    val chit: ChitSearchResultChit? = null,
    val id: String = "",
    val title: String = "",
    val status: String? = null,
    val due_datetime: String? = null
)

/**
 * Nested chit object within a search result (when server returns full chit data).
 */
data class ChitSearchResultChit(
    val id: String = "",
    val title: String? = null,
    val status: String? = null,
    val due_datetime: String? = null
)
