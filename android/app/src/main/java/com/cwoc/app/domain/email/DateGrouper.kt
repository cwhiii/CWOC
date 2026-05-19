package com.cwoc.app.domain.email

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/**
 * Temporal groups for email list section headers.
 */
enum class DateGroup {
    TODAY,
    YESTERDAY,
    LAST_WEEK,
    OLDER
}

/**
 * Pure function: assigns an email date string to a temporal group
 * for display as section headers in the email list view.
 *
 * Groups:
 * - TODAY: emails received today
 * - YESTERDAY: emails received yesterday
 * - LAST_WEEK: emails received in the past 7 days (excluding today and yesterday)
 * - OLDER: all other emails (including future dates and null/invalid inputs)
 */
object DateGrouper {

    /**
     * Assigns a date string to a DateGroup based on its temporal distance from today.
     *
     * Accepts ISO-8601 date-time strings (e.g., "2025-01-15T10:30:00",
     * "2025-01-15T10:30:00Z", "2025-01-15T10:30:00+05:00") and plain date
     * strings (e.g., "2025-01-15").
     *
     * @param dateStr An ISO date or date-time string. Null or invalid returns OLDER.
     * @return The DateGroup this date belongs to.
     */
    fun assign(dateStr: String?): DateGroup {
        if (dateStr.isNullOrBlank()) return DateGroup.OLDER

        val emailDate = parseToLocalDate(dateStr) ?: return DateGroup.OLDER
        val today = LocalDate.now()
        val yesterday = today.minusDays(1)
        val sevenDaysAgo = today.minusDays(7)

        return when {
            emailDate == today -> DateGroup.TODAY
            emailDate == yesterday -> DateGroup.YESTERDAY
            emailDate >= sevenDaysAgo && emailDate < yesterday -> DateGroup.LAST_WEEK
            else -> DateGroup.OLDER
        }
    }

    /**
     * Parses a date string into a LocalDate.
     * Handles ISO date-time formats (with or without timezone offset) and plain dates.
     */
    private fun parseToLocalDate(dateStr: String): LocalDate? {
        // Try parsing as LocalDateTime first (most common for email dates)
        try {
            return LocalDateTime.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME).toLocalDate()
        } catch (_: DateTimeParseException) { }

        // Try with offset (e.g., "2025-01-15T10:30:00+05:00" or "2025-01-15T10:30:00Z")
        try {
            return java.time.OffsetDateTime.parse(dateStr, DateTimeFormatter.ISO_OFFSET_DATE_TIME).toLocalDate()
        } catch (_: DateTimeParseException) { }

        // Try as plain date (e.g., "2025-01-15")
        try {
            return LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE)
        } catch (_: DateTimeParseException) { }

        return null
    }
}
