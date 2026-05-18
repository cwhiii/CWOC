package com.cwoc.app.domain.filter

/**
 * Represents the current filter state for list views.
 * Empty sets mean "any" (no filtering on that dimension).
 * This state is held in-memory (not persisted to Room).
 *
 * Display toggle defaults match the web sidebar:
 *   Pinned=true, Archived=false, Snoozed=false, Unmarked=true,
 *   PastDue=true, Complete=true, Declined=true, Habits=true,
 *   EmailReceived=false, EmailSent=false, SharedWithMe=false, SharedByMe=false
 */
data class FilterState(
    val statuses: Set<String> = emptySet(),
    val priorities: Set<String> = emptySet(),
    val tags: Set<String> = emptySet(),
    val tagMatchMode: TagMatchMode = TagMatchMode.ANY,
    val people: Set<String> = emptySet(),
    // Display toggles — group 1 (pin/archive state)
    val showPinned: Boolean = true,
    val showArchived: Boolean = false,
    val showSnoozed: Boolean = false,
    val showUnmarked: Boolean = true,
    // Display toggles — group 2 (status/type visibility)
    val showPastDue: Boolean = true,
    val showComplete: Boolean = true,
    val showDeclined: Boolean = true,
    val showHabits: Boolean = true,
    val showEmailReceived: Boolean = false,
    val showEmailSent: Boolean = false,
    // Display toggles — group 3 (sharing)
    val sharedWithMe: Boolean = false,
    val sharedByMe: Boolean = false,
    // Color filter
    val colors: Set<String> = emptySet(),
    // Date range filter
    val dateRangeStart: String? = null,
    val dateRangeEnd: String? = null,
    // Text search filter
    val searchText: String = "",
    // Project filter: null=no filter, "__any__"=has project, "__none__"=no project, or specific ID
    val projectFilter: String? = null
) {
    /**
     * Count of non-default filter dimensions. Used to show/hide the "Clear" button.
     */
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
        if (!showUnmarked) count++
        if (!showPastDue) count++
        if (!showComplete) count++
        if (!showDeclined) count++
        if (!showHabits) count++
        if (showEmailReceived) count++
        if (showEmailSent) count++
        if (sharedWithMe) count++
        if (sharedByMe) count++
        if (searchText.isNotEmpty()) count++
        if (projectFilter != null) count++
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
