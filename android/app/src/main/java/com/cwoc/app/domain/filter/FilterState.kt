package com.cwoc.app.domain.filter

/**
 * Represents the current filter state for list views.
 * Empty sets mean "any" (no filtering on that dimension).
 * This state is held in-memory (not persisted to Room).
 */
data class FilterState(
    val statuses: Set<String> = emptySet(),
    val priorities: Set<String> = emptySet(),
    val tags: Set<String> = emptySet(),
    val tagMatchMode: TagMatchMode = TagMatchMode.ANY,
    val people: Set<String> = emptySet(),
    val showArchived: Boolean = false,
    val showPinned: Boolean = true,
    val showSnoozed: Boolean = false,
    val showPastDue: Boolean = true,
    // V2: Show/hide declined (rejected) items
    val showDeclined: Boolean = false,
    // V3: Color filter
    val colors: Set<String> = emptySet(),
    // V4: Date range filter
    val dateRangeStart: String? = null,
    val dateRangeEnd: String? = null
) {
    // V5: Active filter count (number of non-default filter dimensions)
    val activeFilterCount: Int get() {
        var count = 0
        if (statuses.isNotEmpty()) count++
        if (priorities.isNotEmpty()) count++
        if (tags.isNotEmpty()) count++
        if (people.isNotEmpty()) count++
        if (colors.isNotEmpty()) count++
        if (dateRangeStart != null || dateRangeEnd != null) count++
        if (showArchived) count++
        if (!showPinned) count++
        if (showSnoozed) count++
        if (!showPastDue) count++
        if (showDeclined) count++
        return count
    }
}

/**
 * Determines how multiple selected tags are matched against a chit's tags.
 * ANY = chit must have at least one of the selected tags.
 * ALL = chit must have every selected tag.
 */
enum class TagMatchMode {
    ANY,
    ALL
}
