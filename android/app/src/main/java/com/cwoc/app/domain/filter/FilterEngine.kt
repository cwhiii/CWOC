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
        val now = Instant.now()
        return chits.filter { chit -> passesAllFilters(chit, filters, now) }
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

        // Tag filter: empty set means "any"
        if (filters.tags.isNotEmpty()) {
            val chitTags = chit.tags ?: emptyList()
            when (filters.tagMatchMode) {
                TagMatchMode.ANY -> {
                    // Chit must have at least one of the selected tags
                    if (chitTags.none { it in filters.tags }) return false
                }
                TagMatchMode.ALL -> {
                    // Chit must have every selected tag
                    if (!chitTags.containsAll(filters.tags)) return false
                }
            }
        }

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
