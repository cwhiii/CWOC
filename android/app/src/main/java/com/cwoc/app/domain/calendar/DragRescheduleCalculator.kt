package com.cwoc.app.domain.calendar

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Pure utility functions for drag-to-reschedule calculations in the calendar time grid.
 *
 * Extracted from inline logic in CalendarTimeGrid.kt to enable testability
 * and reuse across recurring event scope handlers.
 *
 * All datetime strings are ISO format (e.g., "2024-01-15T10:30:00").
 */
object DragRescheduleCalculator {

    private val ISO_FORMATTER: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME

    /** RFC 5545 day abbreviations mapped to java.time DayOfWeek values. */
    private val DAY_ABBREV_MAP = mapOf(
        java.time.DayOfWeek.MONDAY to "MO",
        java.time.DayOfWeek.TUESDAY to "TU",
        java.time.DayOfWeek.WEDNESDAY to "WE",
        java.time.DayOfWeek.THURSDAY to "TH",
        java.time.DayOfWeek.FRIDAY to "FR",
        java.time.DayOfWeek.SATURDAY to "SA",
        java.time.DayOfWeek.SUNDAY to "SU"
    )

    /**
     * Rounds [rawMinutes] to the nearest multiple of [snapInterval].
     *
     * If [snapInterval] is 0 or negative, treats it as 1 (no snapping).
     * Uses standard rounding (0.5 rounds up).
     */
    fun snapToGrid(rawMinutes: Int, snapInterval: Int): Int {
        val interval = if (snapInterval <= 0) 1 else snapInterval
        if (interval == 1) return rawMinutes
        return (Math.round(rawMinutes.toFloat() / interval) * interval).toInt()
    }

    /**
     * Clamps [minutes] to the valid range [dayStartMinute, dayEndMinute - eventDurationMinutes].
     *
     * Ensures the event fits entirely within the day boundaries.
     * If the input is already within range, it is returned unchanged.
     *
     * @param minutes The target start minute to clamp.
     * @param eventDurationMinutes Duration of the event in minutes.
     * @param dayStartMinute Start of the valid day range (default 0).
     * @param dayEndMinute End of the valid day range (default 1440 = 24*60).
     * @return Clamped minute value in [dayStartMinute, dayEndMinute - eventDurationMinutes].
     */
    fun clampToValidRange(
        minutes: Int,
        eventDurationMinutes: Int,
        dayStartMinute: Int = 0,
        dayEndMinute: Int = 1440
    ): Int {
        val maxStart = dayEndMinute - eventDurationMinutes
        return minutes.coerceIn(dayStartMinute, maxStart)
    }

    /**
     * Computes the time delta in minutes between [sourceMinute] and [targetMinute].
     *
     * @return The difference (targetMinute - sourceMinute) as a Long.
     */
    fun computeTimeDelta(sourceMinute: Int, targetMinute: Int): Long {
        return (targetMinute - sourceMinute).toLong()
    }

    /**
     * Shifts all non-null datetime fields by [deltaMinutes], preserving nulls.
     *
     * Each datetime string is parsed as ISO_LOCAL_DATE_TIME, shifted by the delta,
     * and formatted back to ISO string. Null inputs produce null outputs.
     *
     * @param start Start datetime string (ISO format), or null.
     * @param end End datetime string (ISO format), or null.
     * @param due Due datetime string (ISO format), or null.
     * @param pit Point-in-time datetime string (ISO format), or null.
     * @param deltaMinutes Number of minutes to shift (positive = later, negative = earlier).
     * @return [ShiftedDateTimes] with all fields shifted by the delta.
     */
    fun shiftDateTimes(
        start: String?,
        end: String?,
        due: String?,
        pit: String?,
        deltaMinutes: Long
    ): ShiftedDateTimes {
        return ShiftedDateTimes(
            start = shiftSingleDateTime(start, deltaMinutes),
            end = shiftSingleDateTime(end, deltaMinutes),
            due = shiftSingleDateTime(due, deltaMinutes),
            pointInTime = shiftSingleDateTime(pit, deltaMinutes)
        )
    }

    /**
     * Updates the byDay list in a WEEKLY recurrence rule when the day of week changes.
     *
     * Replaces the source day abbreviation with the target day abbreviation in the
     * BYDAY parameter. Only applies to rules with freq=WEEKLY that contain a BYDAY list.
     * If the rule is not WEEKLY or has no BYDAY, returns the rule unchanged.
     * If the source and target fall on the same day of week, returns the rule unchanged.
     *
     * Day abbreviations follow RFC 5545: MO, TU, WE, TH, FR, SA, SU.
     *
     * @param recurrenceRule The recurrence rule string (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR").
     * @param sourceDate The original date of the event instance.
     * @param targetDate The new date the event is being moved to.
     * @return Updated recurrence rule string with the day abbreviation replaced.
     */
    fun updateByDayForWeekly(
        recurrenceRule: String,
        sourceDate: LocalDate,
        targetDate: LocalDate
    ): String {
        // Only process WEEKLY rules
        if (!recurrenceRule.uppercase().contains("FREQ=WEEKLY")) return recurrenceRule

        val sourceDayAbbrev = DAY_ABBREV_MAP[sourceDate.dayOfWeek] ?: return recurrenceRule
        val targetDayAbbrev = DAY_ABBREV_MAP[targetDate.dayOfWeek] ?: return recurrenceRule

        // Same day — no change needed
        if (sourceDayAbbrev == targetDayAbbrev) return recurrenceRule

        // Find and update the BYDAY parameter
        val parts = recurrenceRule.split(";").toMutableList()
        val byDayIndex = parts.indexOfFirst { it.uppercase().startsWith("BYDAY=") }
        if (byDayIndex == -1) return recurrenceRule

        val byDayPart = parts[byDayIndex]
        val prefix = byDayPart.substring(0, byDayPart.indexOf('=') + 1)
        val days = byDayPart.substring(byDayPart.indexOf('=') + 1).split(",").toMutableList()

        // Replace source day with target day (case-insensitive match, preserve original case style)
        val updatedDays = days.map { day ->
            if (day.uppercase() == sourceDayAbbrev) targetDayAbbrev else day
        }

        parts[byDayIndex] = prefix + updatedDays.joinToString(",")
        return parts.joinToString(";")
    }

    // ── Private Helpers ──────────────────────────────────────────────────────

    /**
     * Shifts a single datetime string by [deltaMinutes]. Returns null if input is null.
     */
    private fun shiftSingleDateTime(dateTimeStr: String?, deltaMinutes: Long): String? {
        if (dateTimeStr.isNullOrBlank()) return null
        return try {
            val dt = LocalDateTime.parse(dateTimeStr, ISO_FORMATTER)
            val shifted = dt.plusMinutes(deltaMinutes)
            shifted.format(ISO_FORMATTER)
        } catch (_: Exception) {
            // If parsing fails, return the original string unchanged
            dateTimeStr
        }
    }
}

/**
 * Result of shifting datetime fields by a time delta.
 * Null fields indicate the original was null (not applicable to this event type).
 */
data class ShiftedDateTimes(
    val start: String?,
    val end: String?,
    val due: String?,
    val pointInTime: String?
)
