package com.cwoc.app.domain.sort

import com.cwoc.app.data.local.entity.ChitEntity

/**
 * Available fields to sort chits by.
 */
enum class SortField {
    NONE,
    TITLE,
    DUE_DATE,
    START_DATE,
    CREATED_DATE,
    MODIFIED_DATE,
    PRIORITY,
    STATUS,
    MANUAL,
    RANDOM,
    UPCOMING
}

/**
 * Sort direction.
 */
enum class SortDirection {
    ASC,
    DESC
}

/**
 * Holds the current sort state for a view.
 * Defaults to NONE (no sorting), ascending.
 */
data class SortState(
    val field: SortField = SortField.NONE,
    val direction: SortDirection = SortDirection.ASC
) {
    /** Whether the direction toggle should be visible for this sort field. */
    val showDirectionToggle: Boolean
        get() = this.field != SortField.NONE && this.field != SortField.MANUAL &&
                this.field != SortField.RANDOM && this.field != SortField.UPCOMING
}

/**
 * Pure-function sort engine for chit lists.
 * Handles null values: nulls sort last in ASC, first in DESC.
 * Priority sort uses semantic ordinal: Critical > High > Medium > Low.
 */
object SortEngine {

    /**
     * Priority ordinal mapping. Higher value = higher priority.
     * Used so that ASC = Low→Critical, DESC = Critical→Low.
     */
    private val PRIORITY_ORDINAL: Map<String, Int> = mapOf(
        "Critical" to 4,
        "High" to 3,
        "Medium" to 2,
        "Low" to 1
    )

    /**
     * Status ordinal mapping for consistent ordering.
     * ToDo → In Progress → Blocked → Complete
     */
    private val STATUS_ORDINAL: Map<String, Int> = mapOf(
        "ToDo" to 1,
        "In Progress" to 2,
        "Blocked" to 3,
        "Complete" to 4
    )

    /**
     * Sorts a list of chits by the given field and direction.
     * Pinned chits always sort to the top regardless of sort field/direction.
     * Returns a new sorted list (does not mutate the input).
     *
     * Null handling: nulls sort last in ASC, first in DESC.
     * NONE sort preserves the original list order (but still pins to top).
     * MANUAL sort preserves the original list order (but still pins to top).
     * RANDOM shuffles the list randomly each time.
     * UPCOMING sorts by nearest future due date (nulls last).
     */
    fun sort(
        chits: List<ChitEntity>,
        field: SortField,
        direction: SortDirection
    ): List<ChitEntity> {
        if (field == SortField.NONE || field == SortField.MANUAL) {
            // Preserve existing order but pins to top
            val pinned = chits.filter { it.pinned }
            val unpinned = chits.filter { !it.pinned }
            return pinned + unpinned
        }

        if (field == SortField.RANDOM) {
            // Shuffle randomly, but pins still go to top
            val pinned = chits.filter { it.pinned }.shuffled()
            val unpinned = chits.filter { !it.pinned }.shuffled()
            return pinned + unpinned
        }

        if (field == SortField.UPCOMING) {
            // Sort by nearest upcoming due date. Nulls sort last.
            // Pinned still go to top.
            val now = java.time.LocalDateTime.now().toString()
            val comparator = Comparator<ChitEntity> { a, b ->
                val aDate = a.dueDatetime
                val bDate = b.dueDatetime
                when {
                    aDate == null && bDate == null -> 0
                    aDate == null -> 1  // null sorts last
                    bDate == null -> -1
                    else -> aDate.compareTo(bDate)
                }
            }
            val pinnedFirst = Comparator<ChitEntity> { a, b ->
                when {
                    a.pinned && !b.pinned -> -1
                    !a.pinned && b.pinned -> 1
                    else -> comparator.compare(a, b)
                }
            }
            return chits.sortedWith(pinnedFirst)
        }

        val comparator = buildComparator(field, direction)
        // Pinned chits sort to top, then apply the field comparator within each group
        val pinnedFirst = Comparator<ChitEntity> { a, b ->
            when {
                a.pinned && !b.pinned -> -1
                !a.pinned && b.pinned -> 1
                else -> comparator.compare(a, b)
            }
        }
        return chits.sortedWith(pinnedFirst)
    }

    private fun buildComparator(
        field: SortField,
        direction: SortDirection
    ): Comparator<ChitEntity> {
        return Comparator { a, b ->
            val result = compareByField(a, b, field)
            if (direction == SortDirection.DESC) -result else result
        }
    }

    /**
     * Compares two chits by the given field in ascending order.
     * Nulls are considered "greater than" any non-null value (sort last in ASC).
     */
    private fun compareByField(a: ChitEntity, b: ChitEntity, field: SortField): Int {
        return when (field) {
            SortField.TITLE -> compareNullableStrings(a.title, b.title)
            SortField.DUE_DATE -> compareNullableStrings(a.dueDatetime, b.dueDatetime)
            SortField.START_DATE -> compareNullableStrings(a.startDatetime, b.startDatetime)
            SortField.CREATED_DATE -> compareNullableStrings(a.createdDatetime, b.createdDatetime)
            SortField.MODIFIED_DATE -> compareNullableStrings(a.modifiedDatetime, b.modifiedDatetime)
            SortField.PRIORITY -> compareByOrdinal(a.priority, b.priority, PRIORITY_ORDINAL)
            SortField.STATUS -> compareByOrdinal(a.status, b.status, STATUS_ORDINAL)
            SortField.NONE, SortField.MANUAL, SortField.RANDOM, SortField.UPCOMING -> 0
        }
    }

    /**
     * Compares two nullable strings with null-last semantics (for ASC).
     * Both null = equal, one null = null is greater (sorts last).
     */
    private fun compareNullableStrings(a: String?, b: String?): Int {
        return when {
            a == null && b == null -> 0
            a == null -> 1  // null sorts last in ASC
            b == null -> -1
            else -> a.compareTo(b, ignoreCase = true)
        }
    }

    /**
     * Compares two nullable values by their ordinal in the given map.
     * Unknown values get ordinal 0 (sort before known values in ASC).
     * Null values sort last in ASC.
     */
    private fun compareByOrdinal(
        a: String?,
        b: String?,
        ordinalMap: Map<String, Int>
    ): Int {
        return when {
            a == null && b == null -> 0
            a == null -> 1  // null sorts last in ASC
            b == null -> -1
            else -> {
                val ordA = ordinalMap[a] ?: 0
                val ordB = ordinalMap[b] ?: 0
                ordA.compareTo(ordB)
            }
        }
    }
}
