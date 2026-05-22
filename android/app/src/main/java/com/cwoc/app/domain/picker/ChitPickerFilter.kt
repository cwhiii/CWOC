package com.cwoc.app.domain.picker

import com.cwoc.app.data.local.entity.ChitEntity

/**
 * Pure filtering and search functions for the Chit Picker sheet.
 * No Android framework dependencies — operates solely on ChitEntity lists.
 */
object ChitPickerFilter {

    /**
     * Filters chits by excluding project masters, specific IDs (e.g., the current chit),
     * and optionally email-sourced chits. Returns results sorted alphabetically by title
     * (case-insensitive).
     *
     * @param allChits The full list of chits to filter.
     * @param excludeIds Set of chit IDs to exclude (e.g., the current project chit itself).
     * @param excludeProjectMasters If true, excludes chits where isProjectMaster is true.
     * @param excludeEmails If true, excludes email-sourced chits (identified by non-null emailMessageId).
     * @return Filtered and alphabetically sorted list of chits.
     */
    fun filterChits(
        allChits: List<ChitEntity>,
        excludeIds: Set<String>,
        excludeProjectMasters: Boolean,
        excludeEmails: Boolean
    ): List<ChitEntity> {
        return allChits
            .filter { chit ->
                // Exclude specific IDs (current chit, already-assigned, etc.)
                chit.id !in excludeIds &&
                // Exclude project masters if requested
                (!excludeProjectMasters || !chit.isProjectMaster) &&
                // Exclude email chits if requested (email chits have a non-null emailMessageId)
                (!excludeEmails || chit.emailMessageId.isNullOrBlank())
            }
            .sortedBy { it.title?.lowercase() ?: "" }
    }

    /**
     * Searches chits by case-insensitive substring match against multiple fields.
     * If the query starts with '#', only the tags field is searched (with the '#' stripped).
     *
     * Searchable fields: title, note, checklist (JSON text), people, location,
     * priority, severity, status, tags.
     *
     * @param chits The list of chits to search within.
     * @param query The search query string. Empty/blank returns all chits unchanged.
     * @return Chits matching the search query.
     */
    fun searchChits(chits: List<ChitEntity>, query: String): List<ChitEntity> {
        if (query.isBlank()) return chits

        // '#' prefix triggers tag-only search
        if (query.startsWith("#")) {
            val tagQuery = query.removePrefix("#").lowercase().trim()
            if (tagQuery.isEmpty()) return chits
            return chits.filter { chit ->
                chit.tags?.any { tag -> tag.lowercase().contains(tagQuery) } == true
            }
        }

        val lowerQuery = query.lowercase()
        return chits.filter { chit ->
            matchesQuery(chit, lowerQuery)
        }
    }

    /**
     * Filters chits by status. A null status means "All" (no filtering).
     *
     * @param chits The list of chits to filter.
     * @param status The status to filter by, or null for all statuses.
     * @return Chits matching the specified status, or all chits if status is null.
     */
    fun applyStatusFilter(chits: List<ChitEntity>, status: String?): List<ChitEntity> {
        if (status == null) return chits
        return chits.filter { it.status.equals(status, ignoreCase = true) }
    }

    /**
     * Filters chits by priority. A null priority means "All" (no filtering).
     *
     * @param chits The list of chits to filter.
     * @param priority The priority to filter by, or null for all priorities.
     * @return Chits matching the specified priority, or all chits if priority is null.
     */
    fun applyPriorityFilter(chits: List<ChitEntity>, priority: String?): List<ChitEntity> {
        if (priority == null) return chits
        return chits.filter { it.priority.equals(priority, ignoreCase = true) }
    }

    /**
     * Checks if a chit matches the given lowercase query against all searchable fields.
     */
    private fun matchesQuery(chit: ChitEntity, lowerQuery: String): Boolean {
        // Title
        if (chit.title?.lowercase()?.contains(lowerQuery) == true) return true

        // Notes
        if (chit.note?.lowercase()?.contains(lowerQuery) == true) return true

        // Checklist (JSON string — search the raw text for substring matches)
        if (chit.checklist?.lowercase()?.contains(lowerQuery) == true) return true

        // People (List<String>)
        if (chit.people?.any { it.lowercase().contains(lowerQuery) } == true) return true

        // Location
        if (chit.location?.lowercase()?.contains(lowerQuery) == true) return true

        // Priority
        if (chit.priority?.lowercase()?.contains(lowerQuery) == true) return true

        // Severity
        if (chit.severity?.lowercase()?.contains(lowerQuery) == true) return true

        // Status
        if (chit.status?.lowercase()?.contains(lowerQuery) == true) return true

        // Tags (List<String>)
        if (chit.tags?.any { it.lowercase().contains(lowerQuery) } == true) return true

        return false
    }
}
