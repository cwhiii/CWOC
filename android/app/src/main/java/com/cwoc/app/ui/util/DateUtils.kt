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
    private val dateDisplayFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy")
    private val timeDisplayFormatter = DateTimeFormatter.ofPattern("h:mm a")
    private val dateTimeDisplayFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a")
    private val shortDateFormatter = DateTimeFormatter.ofPattern("MMM d")
    private val dayOfWeekFormatter = DateTimeFormatter.ofPattern("EEE, MMM d")

    /**
     * Format an ISO datetime string to a display-friendly date (e.g., "Jan 15, 2025").
     * Returns the original string if parsing fails.
     */
    fun formatDisplayDate(isoDatetime: String): String {
        return try {
            val dateTime = LocalDateTime.parse(isoDatetime, isoFormatter)
            dateTime.format(dateDisplayFormatter)
        } catch (_: DateTimeParseException) {
            // Try parsing as date-only
            try {
                val date = LocalDate.parse(isoDatetime, DateTimeFormatter.ISO_LOCAL_DATE)
                date.format(dateDisplayFormatter)
            } catch (_: DateTimeParseException) {
                isoDatetime
            }
        }
    }

    /**
     * Format an ISO datetime string to a display-friendly time (e.g., "2:30 PM").
     * Returns the original string if parsing fails.
     */
    fun formatDisplayTime(isoDatetime: String): String {
        return try {
            val dateTime = LocalDateTime.parse(isoDatetime, isoFormatter)
            dateTime.format(timeDisplayFormatter)
        } catch (_: DateTimeParseException) {
            isoDatetime
        }
    }

    /**
     * Format an ISO datetime string to full date and time (e.g., "Jan 15, 2025 2:30 PM").
     */
    fun formatDisplayDateTime(isoDatetime: String): String {
        return try {
            val dateTime = LocalDateTime.parse(isoDatetime, isoFormatter)
            dateTime.format(dateTimeDisplayFormatter)
        } catch (_: DateTimeParseException) {
            isoDatetime
        }
    }

    /**
     * Format to short date (e.g., "Jan 15").
     */
    fun formatShortDate(isoDatetime: String): String {
        return try {
            val dateTime = LocalDateTime.parse(isoDatetime, isoFormatter)
            dateTime.format(shortDateFormatter)
        } catch (_: DateTimeParseException) {
            isoDatetime
        }
    }

    /**
     * Format to day of week with date (e.g., "Mon, Jan 15").
     */
    fun formatDayOfWeek(isoDatetime: String): String {
        return try {
            val dateTime = LocalDateTime.parse(isoDatetime, isoFormatter)
            dateTime.format(dayOfWeekFormatter)
        } catch (_: DateTimeParseException) {
            isoDatetime
        }
    }

    /**
     * Check if an ISO datetime string represents today's date.
     */
    fun isToday(isoDatetime: String): Boolean {
        return try {
            val dateTime = LocalDateTime.parse(isoDatetime, isoFormatter)
            dateTime.toLocalDate() == LocalDate.now()
        } catch (_: DateTimeParseException) {
            false
        }
    }

    /**
     * Check if an ISO datetime is in the past.
     */
    fun isPast(isoDatetime: String): Boolean {
        return try {
            val dateTime = LocalDateTime.parse(isoDatetime, isoFormatter)
            dateTime.isBefore(LocalDateTime.now())
        } catch (_: DateTimeParseException) {
            false
        }
    }
}
