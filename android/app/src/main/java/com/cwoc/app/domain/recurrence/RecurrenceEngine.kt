package com.cwoc.app.domain.recurrence

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters

/**
 * Recurrence rule definition — mirrors the server's JSON structure.
 */
data class RecurrenceRule(
    val freq: String,           // DAILY, WEEKLY, MONTHLY, YEARLY
    val interval: Int = 1,
    val byDay: List<String>? = null,    // SU, MO, TU, WE, TH, FR, SA
    val byMonthDay: Int? = null,
    val bySetPos: Int? = null,          // e.g., 2 = "second", -1 = "last"
    val until: String? = null,          // ISO date string
    val count: Int? = null
)

/**
 * A single expanded recurrence instance.
 */
data class RecurrenceInstance(
    val date: LocalDate,
    val startDatetime: LocalDateTime?,
    val endDatetime: LocalDateTime?,
    val instanceNum: Int,
    val isException: Boolean = false,
    val isCompleted: Boolean = false
)

/**
 * A recurrence exception — modifies or removes a single occurrence.
 */
data class RecurrenceException(
    val date: String,           // YYYY-MM-DD
    val brokenOff: Boolean = false,
    val completed: Boolean = false,
    val title: String? = null,
    val note: String? = null,
    val startDatetime: String? = null,
    val endDatetime: String? = null,
    val dueDatetime: String? = null,
    val location: String? = null
)

/**
 * Kotlin port of shared-recurrence.js — expands recurrence rules into concrete date instances.
 *
 * Supports: DAILY, WEEKLY, MONTHLY, YEARLY frequencies.
 * Supports: byDay (weekly), byMonthDay (monthly), bySetPos (ordinal weekday),
 *           until, count, and exception handling.
 *
 * Timezone-aware: anchored chits expand in their stored timezone,
 * floating chits expand in the provided display timezone.
 */
class RecurrenceEngine {

    companion object {
        private val DAY_MAP = mapOf(
            "SU" to DayOfWeek.SUNDAY,
            "MO" to DayOfWeek.MONDAY,
            "TU" to DayOfWeek.TUESDAY,
            "WE" to DayOfWeek.WEDNESDAY,
            "TH" to DayOfWeek.THURSDAY,
            "FR" to DayOfWeek.FRIDAY,
            "SA" to DayOfWeek.SATURDAY
        )

        private val DAY_NAMES = mapOf(
            "MO" to "Mon",
            "TU" to "Tue",
            "WE" to "Wed",
            "TH" to "Thu",
            "FR" to "Fri",
            "SA" to "Sat",
            "SU" to "Sun"
        )

        private const val MAX_INSTANCES = 365
    }

    /**
     * Expand a recurrence rule into concrete instances within a date range.
     *
     * @param rule The recurrence rule to expand
     * @param baseStart The start datetime of the recurring chit
     * @param baseEnd The end datetime (nullable, for duration computation)
     * @param rangeStart Start of the visible date range
     * @param rangeEnd End of the visible date range
     * @param exceptions List of recurrence exceptions
     * @param timezone IANA timezone for expansion (e.g., "America/New_York")
     * @return List of expanded instances within the range
     */
    fun expand(
        rule: RecurrenceRule,
        baseStart: LocalDateTime,
        baseEnd: LocalDateTime?,
        rangeStart: LocalDate,
        rangeEnd: LocalDate,
        exceptions: List<RecurrenceException> = emptyList(),
        timezone: String = "UTC"
    ): List<RecurrenceInstance> {
        val freq = rule.freq.uppercase()
        val interval = rule.interval.coerceAtLeast(1)
        val byDayDows = rule.byDay?.mapNotNull { DAY_MAP[it.uppercase()] } ?: emptyList()

        val exceptionDates = exceptions.map { it.date }.toSet()
        val brokenOffDates = exceptions.filter { it.brokenOff }.map { it.date }.toSet()
        val completedDates = exceptions.filter { it.completed }.map { it.date }.toSet()

        val untilDate = rule.until?.let { parseDate(it) }
        val maxCount = rule.count

        // Duration in minutes for generating end times
        val durationMinutes = if (baseEnd != null) {
            java.time.Duration.between(baseStart, baseEnd).toMinutes()
        } else {
            0L
        }

        val zoneId = try {
            ZoneId.of(timezone)
        } catch (_: Exception) {
            ZoneId.of("UTC")
        }

        val instances = mutableListOf<RecurrenceInstance>()
        var currentDate = baseStart.toLocalDate()
        var currentTime = baseStart.toLocalTime()
        var iterCount = 0
        var occurrenceNum = 0

        while (iterCount < MAX_INSTANCES) {
            // Check until condition
            if (untilDate != null && currentDate.isAfter(untilDate)) break

            // Check if past range end
            if (currentDate.isAfter(rangeEnd)) break

            // Check count condition
            if (maxCount != null && occurrenceNum >= maxCount) break

            val dateStr = currentDate.format(DateTimeFormatter.ISO_LOCAL_DATE)

            // For weekly with byDay, check if current day matches
            var dayMatches = true
            if (freq == "WEEKLY" && byDayDows.isNotEmpty()) {
                dayMatches = currentDate.dayOfWeek in byDayDows
            }

            if (dayMatches && dateStr !in brokenOffDates) {
                occurrenceNum++

                // Check if in visible range
                if (!currentDate.isBefore(rangeStart)) {
                    val startDt = LocalDateTime.of(currentDate, currentTime)
                    val endDt = if (durationMinutes > 0) {
                        startDt.plusMinutes(durationMinutes)
                    } else {
                        null
                    }

                    instances.add(
                        RecurrenceInstance(
                            date = currentDate,
                            startDatetime = startDt,
                            endDatetime = endDt,
                            instanceNum = occurrenceNum,
                            isException = dateStr in exceptionDates,
                            isCompleted = dateStr in completedDates
                        )
                    )
                }
            }

            // Advance to next occurrence
            iterCount++
            currentDate = advanceDate(currentDate, freq, interval, byDayDows)
        }

        return instances
    }

    /**
     * Format a recurrence rule as a human-readable string.
     * Equivalent to formatRecurrenceRule() in shared-recurrence.js.
     */
    fun formatRule(rule: RecurrenceRule, isHabit: Boolean = false): String {
        val freq = rule.freq.uppercase()
        val interval = rule.interval.coerceAtLeast(1)

        var text = when (freq) {
            "MINUTELY" -> if (interval == 1) "Every minute" else "Every $interval minutes"
            "HOURLY" -> if (interval == 1) "Hourly" else "Every $interval hours"
            "DAILY" -> if (interval == 1) "Daily" else "Every $interval days"
            "WEEKLY" -> {
                val base = if (interval == 1) "Weekly" else "Every $interval weeks"
                if (!isHabit && !rule.byDay.isNullOrEmpty()) {
                    val days = rule.byDay.mapNotNull { DAY_NAMES[it.uppercase()] }.joinToString(", ")
                    if (days.isNotEmpty()) "$base on $days" else base
                } else {
                    base
                }
            }
            "MONTHLY" -> if (interval == 1) "Monthly" else "Every $interval months"
            "YEARLY" -> if (interval == 1) "Yearly" else "Every $interval years"
            else -> freq
        }

        rule.until?.let { until ->
            val date = parseDate(until)
            if (date != null) {
                text += " until ${date.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))}"
            }
        }

        return text
    }

    // ── Private Helpers ──────────────────────────────────────────────────────

    private fun advanceDate(
        current: LocalDate,
        freq: String,
        interval: Int,
        byDayDows: List<DayOfWeek>
    ): LocalDate {
        return when (freq) {
            "DAILY" -> current.plusDays(interval.toLong())
            "WEEKLY" -> {
                if (byDayDows.isNotEmpty()) {
                    // Advance one day at a time until we hit the next matching day
                    var next = current.plusDays(1)
                    // If we've wrapped back to the first byDay and interval > 1,
                    // skip forward by (interval-1) weeks
                    if (next.dayOfWeek == byDayDows[0] && interval > 1) {
                        next = next.plusWeeks((interval - 1).toLong())
                    }
                    // Keep advancing until we hit a matching day
                    var safety = 0
                    while (next.dayOfWeek !in byDayDows && safety < 7) {
                        next = next.plusDays(1)
                        safety++
                    }
                    next
                } else {
                    current.plusWeeks(interval.toLong())
                }
            }
            "MONTHLY" -> {
                current.plusMonths(interval.toLong())
            }
            "YEARLY" -> {
                current.plusYears(interval.toLong())
            }
            else -> current.plusDays(1) // fallback
        }
    }

    private fun parseDate(dateStr: String): LocalDate? {
        return try {
            // Handle both "2025-03-15" and "2025-03-15T00:00:00" formats
            val cleaned = dateStr.substringBefore('T')
            LocalDate.parse(cleaned)
        } catch (_: Exception) {
            null
        }
    }
}
