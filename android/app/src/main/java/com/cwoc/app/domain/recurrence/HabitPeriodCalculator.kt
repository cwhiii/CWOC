package com.cwoc.app.domain.recurrence

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Kotlin port of getCurrentPeriodDate() from shared-habits.js.
 *
 * Computes the current recurrence period's start date for a habit chit.
 * Used by rollover detection, urgency scoring, and period labels.
 *
 * All dates returned as YYYY-MM-DD strings.
 */
class HabitPeriodCalculator {

    companion object {
        private val DAY_MAP = mapOf(
            "SU" to 0, "MO" to 1, "TU" to 2, "WE" to 3,
            "TH" to 4, "FR" to 5, "SA" to 6
        )

        private val WEEK_START_DAY_MAP = mapOf(
            "sunday" to 0, "monday" to 1, "tuesday" to 2, "wednesday" to 3,
            "thursday" to 4, "friday" to 5, "saturday" to 6
        )

        private val DATE_FORMATTER: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE
    }

    /**
     * Return the current period's date for a recurring habit chit as a YYYY-MM-DD string.
     *
     * Matches the web's getCurrentPeriodDate() in shared-habits.js exactly.
     *
     * @param recurrenceRuleJson Parsed RecurrenceRule, or null if no rule
     * @param startDatetime The chit's start_datetime string (ISO format), or null
     * @param weekStartDay The user's week_start_day setting as a day name string
     *                     ("sunday", "monday", etc.) or numeric string ("0"-"6"),
     *                     or null (defaults to 0 = Sunday)
     * @param today Override for today's date (for testing); defaults to LocalDate.now()
     * @return YYYY-MM-DD string representing the current period start date
     */
    fun getCurrentPeriodDate(
        recurrenceRuleJson: RecurrenceRule?,
        startDatetime: String?,
        weekStartDay: String? = null,
        today: LocalDate = LocalDate.now()
    ): String {
        val todayStr = today.format(DATE_FORMATTER)

        // No recurrence_rule or no freq field → return today
        if (recurrenceRuleJson == null) return todayStr

        val freq = recurrenceRuleJson.freq.uppercase()
        if (freq.isBlank()) return todayStr

        // Unrecognized freq → return today
        if (freq !in listOf("DAILY", "WEEKLY", "MONTHLY", "YEARLY")) return todayStr

        val interval = (recurrenceRuleJson.interval).coerceAtLeast(1)
        val byDay = recurrenceRuleJson.byDay ?: emptyList()

        // Parse start date — fallback to today if missing
        val startDate: LocalDate = if (!startDatetime.isNullOrBlank()) {
            parseStartDate(startDatetime) ?: return todayStr
        } else {
            // No start_datetime → return today
            return todayStr
        }

        // If start date is in the future, return start date
        if (startDate.isAfter(today)) return startDate.format(DATE_FORMATTER)

        // ── DAILY ──
        if (freq == "DAILY") {
            if (interval == 1) {
                return todayStr
            }
            // Walk from start by interval days, find the period containing today
            var cur = startDate
            while (true) {
                val next = cur.plusDays(interval.toLong())
                if (next.isAfter(today)) return cur.format(DATE_FORMATTER)
                cur = next
            }
        }

        // ── WEEKLY ──
        if (freq == "WEEKLY") {
            val byDayNums = byDay.mapNotNull { DAY_MAP[it.uppercase()] }

            if (byDayNums.isNotEmpty()) {
                // WEEKLY with byDay
                if (interval == 1) {
                    // Simple case: check each day going backward from today
                    var check = today
                    for (i in 0 until 7) {
                        val checkDayOfWeek = dayOfWeekToNum(check.dayOfWeek)
                        if (checkDayOfWeek in byDayNums && !check.isBefore(startDate)) {
                            return check.format(DATE_FORMATTER)
                        }
                        check = check.minusDays(1)
                    }
                    // Fallback — shouldn't happen with valid byDay
                    return todayStr
                } else {
                    // Multi-week interval with byDay: walk from start day-by-day
                    var cur = startDate
                    var best = startDate
                    val maxIter = 5000
                    for (i in 0 until maxIter) {
                        if (cur.isAfter(today)) break
                        // Check if this day matches byDay
                        val curDayNum = dayOfWeekToNum(cur.dayOfWeek)
                        if (curDayNum in byDayNums) {
                            best = cur
                        }
                        // Advance: step one day at a time, but when we wrap to the first
                        // byDay of a new cycle, skip (interval-1) weeks
                        val prevDayNum = dayOfWeekToNum(cur.dayOfWeek)
                        cur = cur.plusDays(1)
                        val newDayNum = dayOfWeekToNum(cur.dayOfWeek)
                        if (newDayNum == byDayNums[0] && prevDayNum != byDayNums[0]) {
                            // We've wrapped to the start of a new cycle
                            if (interval > 1) {
                                cur = cur.plusWeeks((interval - 1).toLong())
                            }
                        }
                    }
                    return best.format(DATE_FORMATTER)
                }
            } else {
                // WEEKLY without byDay: return start of current week
                val weekStart = parseWeekStartDay(weekStartDay)

                if (interval == 1) {
                    val todayDayNum = dayOfWeekToNum(today.dayOfWeek)
                    val diff = ((todayDayNum - weekStart) + 7) % 7
                    val weekStartDate = today.minusDays(diff.toLong())
                    // Ensure we don't go before start date
                    return if (weekStartDate.isBefore(startDate)) {
                        startDate.format(DATE_FORMATTER)
                    } else {
                        weekStartDate.format(DATE_FORMATTER)
                    }
                } else {
                    // Multi-week interval: walk from start by interval weeks
                    // Align start to week start day
                    val startDayNum = dayOfWeekToNum(startDate.dayOfWeek)
                    val startDiff = ((startDayNum - weekStart) + 7) % 7
                    var cur = startDate.minusDays(startDiff.toLong())
                    while (true) {
                        val next = cur.plusWeeks(interval.toLong())
                        if (next.isAfter(today)) return cur.format(DATE_FORMATTER)
                        cur = next
                    }
                }
            }
        }

        // ── MONTHLY ──
        if (freq == "MONTHLY") {
            if (interval == 1) {
                return LocalDate.of(today.year, today.monthValue, 1).format(DATE_FORMATTER)
            }
            // Multi-month interval: walk from start month by interval
            var cur = LocalDate.of(startDate.year, startDate.monthValue, 1)
            while (true) {
                val next = cur.plusMonths(interval.toLong())
                if (next.isAfter(today)) return cur.format(DATE_FORMATTER)
                cur = next
            }
        }

        // ── YEARLY ──
        if (freq == "YEARLY") {
            if (interval == 1) {
                return "${today.year}-01-01"
            }
            // Multi-year interval: walk from start year by interval
            var curYear = startDate.year
            while (true) {
                val nextYear = curYear + interval
                val nextDate = LocalDate.of(nextYear, 1, 1)
                if (nextDate.isAfter(today)) return "$curYear-01-01"
                curYear = nextYear
            }
        }

        // Fallback for unknown freq (shouldn't reach here due to early check)
        return todayStr
    }

    /**
     * Convenience overload that accepts raw chit fields as stored in ChitEntity.
     *
     * @param recurrenceRuleJson The raw JSON string from ChitEntity.recurrenceRule
     * @param startDatetime The chit's start_datetime string
     * @param weekStartDay The user's week_start_day setting
     * @param today Override for today's date (for testing)
     * @return YYYY-MM-DD string
     */
    fun getCurrentPeriodDate(
        recurrenceRuleJson: String?,
        startDatetime: String?,
        weekStartDay: String? = null,
        today: LocalDate = LocalDate.now()
    ): String {
        val todayStr = today.format(DATE_FORMATTER)
        if (recurrenceRuleJson.isNullOrBlank()) return todayStr

        val rule = try {
            com.google.gson.Gson().fromJson(recurrenceRuleJson, RecurrenceRule::class.java)
        } catch (_: Exception) {
            return todayStr
        }

        return getCurrentPeriodDate(rule, startDatetime, weekStartDay, today)
    }

    // ── getPreviousPeriodDate ────────────────────────────────────────────────

    /**
     * Return the previous period's date for a recurring habit chit as a YYYY-MM-DD string,
     * or null if the recurrence rule is missing/invalid.
     *
     * Computes the period immediately before the current one by subtracting the
     * appropriate interval from the current period date.
     *
     * @param recurrenceRule Parsed RecurrenceRule, or null if no rule
     * @param startDatetime The chit's start_datetime string (ISO format), or null
     * @param weekStartDay The user's week_start_day setting
     * @param today Override for today's date (for testing); defaults to LocalDate.now()
     * @return YYYY-MM-DD string representing the previous period start date, or null
     */
    fun getPreviousPeriodDate(
        recurrenceRule: RecurrenceRule?,
        startDatetime: String?,
        weekStartDay: String? = null,
        today: LocalDate = LocalDate.now()
    ): String? {
        // No recurrence rule → null
        if (recurrenceRule == null) return null

        val freq = recurrenceRule.freq.uppercase()
        if (freq.isBlank()) return null

        // Unrecognized freq → null
        if (freq !in listOf("DAILY", "WEEKLY", "MONTHLY", "YEARLY")) return null

        // No interval field → treat as 1
        val interval = recurrenceRule.interval.coerceAtLeast(1)

        // Get the current period date
        val currentPeriodStr = getCurrentPeriodDate(recurrenceRule, startDatetime, weekStartDay, today)
        val currentPeriod = LocalDate.parse(currentPeriodStr, DATE_FORMATTER)

        // Subtract the appropriate interval based on frequency
        val previousPeriod: LocalDate = when (freq) {
            "DAILY" -> currentPeriod.minusDays(interval.toLong())

            "WEEKLY" -> currentPeriod.minusDays((interval * 7).toLong())

            "MONTHLY" -> {
                // Subtract interval months, clamping to last valid day of resulting month
                val targetMonth = currentPeriod.minusMonths(interval.toLong())
                // LocalDate.minusMonths already handles day-of-month clamping
                // (e.g., March 31 minus 1 month = Feb 28/29), but we need to ensure
                // we clamp the original day to the target month's length
                val originalDay = currentPeriod.dayOfMonth
                val maxDay = targetMonth.lengthOfMonth()
                if (originalDay > maxDay) {
                    targetMonth.withDayOfMonth(maxDay)
                } else {
                    targetMonth
                }
            }

            "YEARLY" -> {
                // Subtract interval years, clamping Feb 29 → Feb 28 for non-leap years
                val targetYear = currentPeriod.year - interval
                if (currentPeriod.monthValue == 2 && currentPeriod.dayOfMonth == 29) {
                    // Original is Feb 29 — check if target year is a leap year
                    if (LocalDate.of(targetYear, 1, 1).isLeapYear) {
                        LocalDate.of(targetYear, 2, 29)
                    } else {
                        LocalDate.of(targetYear, 2, 28)
                    }
                } else {
                    LocalDate.of(targetYear, currentPeriod.monthValue, currentPeriod.dayOfMonth)
                }
            }

            else -> return null
        }

        return previousPeriod.format(DATE_FORMATTER)
    }

    /**
     * Convenience overload that accepts raw JSON string for the recurrence rule.
     *
     * @param recurrenceRuleJson The raw JSON string from ChitEntity.recurrenceRule
     * @param startDatetime The chit's start_datetime string
     * @param weekStartDay The user's week_start_day setting
     * @param today Override for today's date (for testing)
     * @return YYYY-MM-DD string representing the previous period start date, or null
     */
    fun getPreviousPeriodDate(
        recurrenceRuleJson: String?,
        startDatetime: String?,
        weekStartDay: String? = null,
        today: LocalDate = LocalDate.now()
    ): String? {
        if (recurrenceRuleJson.isNullOrBlank()) return null

        val rule = try {
            com.google.gson.Gson().fromJson(recurrenceRuleJson, RecurrenceRule::class.java)
        } catch (_: Exception) {
            return null
        }

        return getPreviousPeriodDate(rule, startDatetime, weekStartDay, today)
    }

    // ── Private Helpers ──────────────────────────────────────────────────────

    /**
     * Convert java.time.DayOfWeek to JS-style day number (0=Sunday, 6=Saturday).
     */
    private fun dayOfWeekToNum(dow: DayOfWeek): Int {
        return when (dow) {
            DayOfWeek.SUNDAY -> 0
            DayOfWeek.MONDAY -> 1
            DayOfWeek.TUESDAY -> 2
            DayOfWeek.WEDNESDAY -> 3
            DayOfWeek.THURSDAY -> 4
            DayOfWeek.FRIDAY -> 5
            DayOfWeek.SATURDAY -> 6
        }
    }

    /**
     * Parse the weekStartDay setting into a numeric value (0=Sunday through 6=Saturday).
     * Accepts both day name strings ("sunday", "monday") and numeric strings ("0", "1").
     * Defaults to 0 (Sunday) if null or unrecognized.
     */
    private fun parseWeekStartDay(weekStartDay: String?): Int {
        if (weekStartDay.isNullOrBlank()) return 0

        // Try as numeric string first
        val numeric = weekStartDay.toIntOrNull()
        if (numeric != null && numeric in 0..6) return numeric

        // Try as day name
        return WEEK_START_DAY_MAP[weekStartDay.lowercase()] ?: 0
    }

    /**
     * Parse a start_datetime string into a LocalDate.
     * Handles ISO datetime formats (with or without time component).
     */
    private fun parseStartDate(startDatetime: String): LocalDate? {
        return try {
            // Handle both "2025-03-15" and "2025-03-15T10:00:00" and "2025-03-15 10:00:00" formats
            val datePart = startDatetime.substringBefore('T').substringBefore(' ').trim()
            LocalDate.parse(datePart, DATE_FORMATTER)
        } catch (_: Exception) {
            null
        }
    }
}
