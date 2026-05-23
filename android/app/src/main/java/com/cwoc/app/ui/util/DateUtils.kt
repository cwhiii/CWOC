package com.cwoc.app.ui.util

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/**
 * Date formatting helpers for displaying dates and times in the UI.
 * Handles ISO datetime strings from the Room database.
 */
object DateUtils {

    private val isoFormatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME
    private val dateDisplayFormatter = DateTimeFormatter.ofPattern("yyyy-MMM-dd")
    private val timeDisplayFormatter = DateTimeFormatter.ofPattern("h:mm a")
    private val dateTimeDisplayFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a")
    private val overviewDateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MMM-dd HH:mm")
    private val shortDateFormatter = DateTimeFormatter.ofPattern("MMM d")
    private val dayOfWeekFormatter = DateTimeFormatter.ofPattern("EEE, MMM d")

    /**
     * Strip timezone offset/suffix from an ISO datetime string so it can be parsed
     * as a LocalDateTime. Handles "+HH:MM", "-HH:MM", "Z" suffixes.
     */
    private fun stripTimezone(isoDatetime: String): String {
        // Remove trailing Z
        var s = isoDatetime.trimEnd()
        if (s.endsWith("Z", ignoreCase = true)) {
            s = s.dropLast(1)
        } else {
            // Remove +HH:MM or -HH:MM offset at end (e.g., "+05:00", "-06:00")
            val offsetRegex = Regex("[+-]\\d{2}:\\d{2}$")
            s = s.replace(offsetRegex, "")
        }
        return s
    }

    /**
     * Parse an ISO datetime string, stripping any timezone offset first.
     * Returns null if parsing fails.
     */
    private fun parseDateTime(isoDatetime: String): LocalDateTime? {
        val stripped = stripTimezone(isoDatetime)
        return try {
            LocalDateTime.parse(stripped, isoFormatter)
        } catch (_: DateTimeParseException) {
            null
        }
    }

    /**
     * Format an ISO datetime string to a display-friendly date (e.g., "Jan 15, 2025").
     * Returns the original string if parsing fails.
     */
    fun formatDisplayDate(isoDatetime: String): String {
        val dateTime = parseDateTime(isoDatetime)
        if (dateTime != null) return dateTime.format(dateDisplayFormatter)
        // Try parsing as date-only
        return try {
            val date = LocalDate.parse(isoDatetime.substringBefore("T"), DateTimeFormatter.ISO_LOCAL_DATE)
            date.format(dateDisplayFormatter)
        } catch (_: DateTimeParseException) {
            isoDatetime
        }
    }

    /**
     * Format an ISO datetime string to a display-friendly time (e.g., "2:30 PM").
     * Returns the original string if parsing fails.
     */
    fun formatDisplayTime(isoDatetime: String): String {
        val dateTime = parseDateTime(isoDatetime)
        if (dateTime != null) return dateTime.format(timeDisplayFormatter)
        return isoDatetime
    }

    /**
     * Format an ISO datetime string to full date and time (e.g., "Jan 15, 2025 2:30 PM").
     */
    fun formatDisplayDateTime(isoDatetime: String): String {
        val dateTime = parseDateTime(isoDatetime)
        if (dateTime != null) return dateTime.format(dateTimeDisplayFormatter)
        return isoDatetime
    }

    /**
     * Format an ISO datetime string for the editor overview zone (e.g., "2025-Jan-15 14:30").
     * If the time component is midnight (00:00), returns date only.
     */
    fun formatOverviewDateTime(isoDatetime: String): String {
        val dateTime = parseDateTime(isoDatetime)
        if (dateTime != null) {
            return if (dateTime.hour == 0 && dateTime.minute == 0) {
                dateTime.format(dateDisplayFormatter)
            } else {
                dateTime.format(overviewDateTimeFormatter)
            }
        }
        // Try parsing as date-only
        return try {
            val date = LocalDate.parse(isoDatetime.substringBefore("T"), DateTimeFormatter.ISO_LOCAL_DATE)
            date.format(dateDisplayFormatter)
        } catch (_: DateTimeParseException) {
            isoDatetime
        }
    }

    /**
     * Extract just the date portion formatted for overview (e.g., "2025-Jan-15").
     * Returns null if parsing fails.
     */
    fun formatOverviewDateOnly(isoDatetime: String): String? {
        val dateTime = parseDateTime(isoDatetime)
        if (dateTime != null) return dateTime.format(dateDisplayFormatter)
        return try {
            val date = LocalDate.parse(isoDatetime.substringBefore("T"), DateTimeFormatter.ISO_LOCAL_DATE)
            date.format(dateDisplayFormatter)
        } catch (_: DateTimeParseException) {
            null
        }
    }

    /**
     * Extract just the time portion formatted as HH:mm (e.g., "14:30").
     * Returns null if parsing fails or time is midnight.
     */
    fun formatOverviewTimeOnly(isoDatetime: String): String? {
        val dateTime = parseDateTime(isoDatetime)
        if (dateTime != null && (dateTime.hour != 0 || dateTime.minute != 0)) {
            return String.format("%02d:%02d", dateTime.hour, dateTime.minute)
        }
        return null
    }

    /**
     * Format to short date (e.g., "Jan 15").
     */
    fun formatShortDate(isoDatetime: String): String {
        val dateTime = parseDateTime(isoDatetime)
        if (dateTime != null) return dateTime.format(shortDateFormatter)
        return isoDatetime
    }

    /**
     * Format to day of week with date (e.g., "Mon, Jan 15").
     */
    fun formatDayOfWeek(isoDatetime: String): String {
        val dateTime = parseDateTime(isoDatetime)
        if (dateTime != null) return dateTime.format(dayOfWeekFormatter)
        return isoDatetime
    }

    /**
     * Check if an ISO datetime string represents today's date.
     */
    fun isToday(isoDatetime: String): Boolean {
        val dateTime = parseDateTime(isoDatetime) ?: return false
        return dateTime.toLocalDate() == LocalDate.now()
    }

    /**
     * Check if an ISO datetime is in the past.
     */
    fun isPast(isoDatetime: String): Boolean {
        val dateTime = parseDateTime(isoDatetime) ?: return false
        return dateTime.isBefore(LocalDateTime.now())
    }
}
