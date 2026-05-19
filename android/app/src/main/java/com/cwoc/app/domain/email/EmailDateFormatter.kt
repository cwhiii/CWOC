package com.cwoc.app.domain.email

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale

/**
 * Formats email dates based on recency relative to the current date.
 *
 * - Today: time only (honoring 12h/24h preference)
 * - Yesterday: "Yesterday"
 * - This year (not today/yesterday): "Mon DD" (e.g., "May 18")
 * - Prior year: "Mon DD, YYYY" (e.g., "May 18, 2023")
 */
object EmailDateFormatter {

    /**
     * Format an ISO date string for display on an email card.
     *
     * @param dateStr ISO datetime string (e.g., "2024-05-18T14:30:00" or with timezone offset)
     * @param use24Hour Whether to use 24-hour time format (true) or 12-hour (false)
     * @return Formatted date string based on recency, or empty string if parsing fails
     */
    fun format(dateStr: String?, use24Hour: Boolean = false): String {
        if (dateStr.isNullOrBlank()) return ""

        val dateTime = parseDateTime(dateStr) ?: return ""
        val emailDate = dateTime.toLocalDate()
        val today = LocalDate.now()

        return when {
            emailDate == today -> {
                // Today: show time only
                val pattern = if (use24Hour) "HH:mm" else "h:mm a"
                dateTime.format(DateTimeFormatter.ofPattern(pattern, Locale.getDefault()))
            }
            emailDate == today.minusDays(1) -> {
                // Yesterday
                "Yesterday"
            }
            emailDate.year == today.year -> {
                // This year (not today/yesterday): "Mon DD"
                dateTime.format(DateTimeFormatter.ofPattern("MMM d", Locale.getDefault()))
            }
            else -> {
                // Prior year: "Mon DD, YYYY"
                dateTime.format(DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.getDefault()))
            }
        }
    }

    /**
     * Parse an ISO datetime string into a LocalDateTime.
     * Handles multiple formats: full ISO with offset, ISO local datetime, date-only.
     */
    private fun parseDateTime(dateStr: String): LocalDateTime? {
        // Try ISO_LOCAL_DATE_TIME first (most common: "2024-05-18T14:30:00")
        try {
            return LocalDateTime.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        } catch (_: DateTimeParseException) {}

        // Try with offset/zone info stripped (e.g., "2024-05-18T14:30:00+05:00" or "2024-05-18T14:30:00Z")
        try {
            val stripped = dateStr.substringBefore("+").substringBefore("Z").trimEnd()
            return LocalDateTime.parse(stripped, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        } catch (_: DateTimeParseException) {}

        // Try date-only (e.g., "2024-05-18") — assume start of day
        try {
            val date = LocalDate.parse(dateStr.substringBefore('T'), DateTimeFormatter.ISO_LOCAL_DATE)
            return date.atStartOfDay()
        } catch (_: DateTimeParseException) {}

        return null
    }
}
