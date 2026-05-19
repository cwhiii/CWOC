package com.cwoc.app.domain.filter

import com.cwoc.app.data.local.entity.ChitEntity
import java.time.Instant
import java.time.format.DateTimeParseException

/**
 * Pure filtering engine that applies FilterState predicates to a list of chits.
 * Each predicate is applied conjunctively (all must pass for a chit to be included).
 * Empty sets in FilterState mean "no filter on that dimension" (pass all).
 */
object FilterEngine {

    fun applyFilters(
        chits: List<ChitEntity>,
        filters: FilterState
    ): List<ChitEntity> {
        // Auto-build project child IDs from the chit list for project filter support
        val projectChildIds = if (filters.projectFilter != null) {
            chits.filter { it.isProjectMaster }
                .associate { it.id to (it.childChits?.toSet() ?: emptySet()) }
        } else {
            emptyMap()
        }
        return applyFilters(chits, filters, projectChildIds)
    }

    /**
     * Apply filters with project membership context.
     * @param projectChildIds Map of project master ID → set of child chit IDs belonging to that project.
     *                        Used for project filter (__any__, __none__, specific ID).
     */
    fun applyFilters(
        chits: List<ChitEntity>,
        filters: FilterState,
        projectChildIds: Map<String, Set<String>>
    ): List<ChitEntity> {
        val now = Instant.now()
        // Build a set of all chit IDs that belong to any project (for __any__/__none__ filters)
        val allProjectChildIds = projectChildIds.values.flatten().toSet()

        return chits.filter { chit ->
            passesAllFilters(chit, filters, now) &&
            passesProjectFilter(chit, filters, allProjectChildIds, projectChildIds)
        }
    }

    /**
     * Check project filter separately since it needs external context.
     * Includes the project master itself in results for specific project and __any__ filters.
     * When no project context is available (empty map), the filter is skipped to avoid
     * incorrectly hiding all chits in views that don't load project masters.
     */
    private fun passesProjectFilter(
        chit: ChitEntity,
        filters: FilterState,
        allProjectChildIds: Set<String>,
        projectChildIds: Map<String, Set<String>>
    ): Boolean {
        if (filters.projectFilter == null) return true
        // If no project context is available, skip filtering to avoid hiding everything
        if (projectChildIds.isEmpty() && allProjectChildIds.isEmpty()) return true
        return when (filters.projectFilter) {
            "__any__" -> chit.id in allProjectChildIds || chit.isProjectMaster
            "__none__" -> chit.id !in allProjectChildIds && !chit.isProjectMaster
            else -> {
                val children = projectChildIds[filters.projectFilter] ?: emptySet()
                chit.id == filters.projectFilter || chit.id in children
            }
        }
    }

    private fun passesAllFilters(
        chit: ChitEntity,
        filters: FilterState,
        now: Instant
    ): Boolean {
        // Status filter: empty set means "any"
        if (filters.statuses.isNotEmpty()) {
            val chitStatus = chit.status ?: return false
            if (chitStatus !in filters.statuses) return false
        }

        // Priority filter: empty set means "any"
        if (filters.priorities.isNotEmpty()) {
            val chitPriority = chit.priority ?: return false
            if (chitPriority !in filters.priorities) return false
        }

        // Tag filter: handled below with descendant matching logic
        // (moved to end of function for proper descendant support)

        // People filter: empty set means "any"
        if (filters.people.isNotEmpty()) {
            val chitPeople = chit.people ?: emptyList()
            if (chitPeople.none { it in filters.people }) return false
        }

        // Archive toggle: if showArchived is false, exclude archived chits
        if (!filters.showArchived && chit.archived) return false

        // Pinned toggle: if showPinned is false, exclude pinned chits
        if (!filters.showPinned && chit.pinned) return false

        // Snoozed toggle: if showSnoozed is false, exclude snoozed chits
        if (!filters.showSnoozed && isSnoozed(chit, now)) return false

        // Past-due toggle: if showPastDue is false, exclude past-due chits
        if (!filters.showPastDue && isPastDue(chit, now)) return false

        // V2: Show declined toggle — if showDeclined is false, exclude Rejected status
        if (!filters.showDeclined && chit.status == "Rejected") return false

        // Show complete toggle — if false, exclude Complete status
        if (!filters.showComplete && chit.status == "Complete") return false

        // Show unmarked toggle — if false, exclude chits that are neither pinned nor archived nor snoozed
        if (!filters.showUnmarked && !chit.pinned && !chit.archived && !isSnoozed(chit, now)) return false

        // Show habits toggle — if false, exclude habit chits
        if (!filters.showHabits && chit.habit) return false

        // Email visibility in non-email views
        // showEmailReceived/showEmailSent: when false (default), email chits are hidden in non-email views
        // Email chits are identified by having a non-null emailMessageId.
        // Direction is determined by emailFolder: "inbox" = received, "sent" = sent.
        val isEmailChit = !chit.emailMessageId.isNullOrBlank()
        if (isEmailChit) {
            val isReceived = chit.emailFolder == "inbox"
            val isSent = chit.emailFolder == "sent"
            if (!filters.showEmailReceived && isReceived) return false
            if (!filters.showEmailSent && isSent) return false
        }

        // Sharing filters — when checked, show ONLY shared chits
        // Sharing info is in the `shares` JSON field. Non-null/non-empty means shared.
        if (filters.sharedWithMe) {
            val hasShares = !chit.shares.isNullOrBlank() && chit.shares != "[]" && chit.shares != "{}"
            if (!hasShares) return false
        }
        if (filters.sharedByMe) {
            // Shared by me = chit has shares AND current user is the owner
            // For now, check if shares is non-empty (owner check requires user context)
            val hasShares = !chit.shares.isNullOrBlank() && chit.shares != "[]" && chit.shares != "{}"
            if (!hasShares) return false
        }

        // V3: Color filter — empty set means "any"
        if (filters.colors.isNotEmpty()) {
            val chitColor = chit.color ?: return false
            if (chitColor !in filters.colors) return false
        }

        // V4: Date range filter — exclude chits outside the date range
        if (filters.dateRangeStart != null || filters.dateRangeEnd != null) {
            val chitDate = chit.startDatetime ?: chit.dueDatetime ?: chit.pointInTime
            if (chitDate == null) return false
            val dateStr = chitDate.take(10) // Extract YYYY-MM-DD
            if (filters.dateRangeStart != null && dateStr < filters.dateRangeStart) return false
            if (filters.dateRangeEnd != null && dateStr > filters.dateRangeEnd) return false
        }

        // Text search filter — case-insensitive match on title and notes
        if (filters.searchText.isNotEmpty()) {
            val query = filters.searchText.lowercase()
            val titleMatch = chit.title?.lowercase()?.contains(query) == true
            val notesMatch = chit.note?.lowercase()?.contains(query) == true
            if (!titleMatch && !notesMatch) return false
        }

        // Project filter — handled by passesProjectFilter() which has access to project context

        // Tag filter with descendant matching
        if (filters.tags.isNotEmpty()) {
            val chitTags = chit.tags ?: emptyList()
            when (filters.tagMatchMode) {
                TagMatchMode.ANY -> {
                    // Chit must have at least one of the selected tags (including descendants)
                    val matches = chitTags.any { chitTag ->
                        filters.tags.any { filterTag ->
                            chitTag == filterTag || chitTag.startsWith("$filterTag/")
                        }
                    }
                    if (!matches) return false
                }
                TagMatchMode.ALL -> {
                    // Chit must match every selected tag (including descendants)
                    val allMatch = filters.tags.all { filterTag ->
                        chitTags.any { chitTag ->
                            chitTag == filterTag || chitTag.startsWith("$filterTag/")
                        }
                    }
                    if (!allMatch) return false
                }
            }
        }

        return true
    }

    /**
     * A chit is considered snoozed if snoozedUntil is non-null and in the future.
     */
    private fun isSnoozed(chit: ChitEntity, now: Instant): Boolean {
        val snoozedUntil = chit.snoozedUntil ?: return false
        return try {
            val snoozedInstant = Instant.parse(snoozedUntil)
            snoozedInstant.isAfter(now)
        } catch (e: DateTimeParseException) {
            false
        }
    }

    /**
     * A chit is past-due if it has a dueDatetime that is before now.
     */
    private fun isPastDue(chit: ChitEntity, now: Instant): Boolean {
        val dueDatetime = chit.dueDatetime ?: return false
        return try {
            val dueInstant = Instant.parse(dueDatetime)
            dueInstant.isBefore(now)
        } catch (e: DateTimeParseException) {
            false
        }
    }
}
