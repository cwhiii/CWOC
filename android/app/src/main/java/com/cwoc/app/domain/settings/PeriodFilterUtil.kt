package com.cwoc.app.domain.settings

/**
 * Pure utility functions for filtering and resolving time period options
 * based on user settings. No Android framework dependencies.
 */
object PeriodFilterUtil {

    /** Fixed display order for all valid period identifiers. */
    val DISPLAY_ORDER = listOf("Itinerary", "Day", "Work", "Week", "SevenDay", "Month", "Year")

    /** The set of recognized period identifiers. */
    private val VALID_PERIODS = DISPLAY_ORDER.toSet()

    /**
     * Parses a comma-separated enabledPeriods string and returns the intersection
     * with valid periods, maintaining display order.
     *
     * Falls back to all periods (DISPLAY_ORDER) if the input is null, empty,
     * or contains no recognized identifiers — per Requirement 20.3.
     */
    fun filterEnabledPeriods(allPeriods: List<String>, enabledPeriodsRaw: String?): List<String> {
        if (enabledPeriodsRaw.isNullOrBlank()) return DISPLAY_ORDER

        val enabledSet = enabledPeriodsRaw
            .split(",")
            .map { it.trim() }
            .filter { it in VALID_PERIODS }
            .toSet()

        if (enabledSet.isEmpty()) return DISPLAY_ORDER

        // Return periods in display order, filtered to only those enabled
        return DISPLAY_ORDER.filter { it in enabledSet }
    }

    /**
     * If the current selection is not in the enabled periods list, returns the first
     * enabled period in display order. Otherwise returns the current selection unchanged.
     */
    fun resolveSelectedPeriod(
        currentSelection: String,
        enabledPeriods: List<String>,
        displayOrder: List<String> = DISPLAY_ORDER
    ): String {
        if (currentSelection in enabledPeriods) return currentSelection

        // Find the first enabled period in display order
        return displayOrder.firstOrNull { it in enabledPeriods }
            ?: "Day" // Ultimate fallback
    }

    /**
     * Returns the user-facing label for a period identifier.
     * "SevenDay" is rendered as "{customDaysCount} Days"; "Work" as "Work Hours";
     * all others use their identifier as-is.
     */
    fun formatPeriodLabel(periodId: String, customDaysCount: Int): String {
        return when (periodId) {
            "SevenDay" -> "$customDaysCount Days"
            "Work" -> "Work Hours"
            else -> periodId
        }
    }
}
