package com.cwoc.app.domain.recurrence

import org.junit.Assert.*
import org.junit.Test
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Property-based tests for RecurrenceEngine.
 *
 * Property 24: Recurrence engine equivalence with JS — the Kotlin engine produces
 * the same set of instance dates as shared-recurrence.js for identical inputs.
 *
 * Property 25: Weekly recurrence respects byDay — every generated instance for a
 * weekly rule with byDay falls on one of the specified days.
 *
 * Property 26: Recurrence exceptions are excluded — no generated instance has a
 * date matching a broken-off exception.
 *
 * **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.6, 12.8**
 */
class RecurrenceEnginePropertyTest {

    private val engine = RecurrenceEngine()
    private val random = java.util.Random(42)

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val frequencies = listOf("DAILY", "WEEKLY", "MONTHLY", "YEARLY")

    private val dayAbbreviations = listOf("SU", "MO", "TU", "WE", "TH", "FR", "SA")

    private val dayAbbrevToDow = mapOf(
        "SU" to DayOfWeek.SUNDAY,
        "MO" to DayOfWeek.MONDAY,
        "TU" to DayOfWeek.TUESDAY,
        "WE" to DayOfWeek.WEDNESDAY,
        "TH" to DayOfWeek.THURSDAY,
        "FR" to DayOfWeek.FRIDAY,
        "SA" to DayOfWeek.SATURDAY
    )

    /**
     * Generate a random recurrence rule with the given seed.
     */
    private fun generateRule(seed: Int): RecurrenceRule {
        val r = java.util.Random(seed.toLong())
        val freq = frequencies[r.nextInt(frequencies.size)]
        val interval = r.nextInt(3) + 1 // 1-3

        val byDay: List<String>? = if (freq == "WEEKLY" && r.nextBoolean()) {
            // Pick 1-3 random days
            val numDays = r.nextInt(3) + 1
            dayAbbreviations.shuffled(r).take(numDays)
        } else {
            null
        }

        val count: Int? = if (r.nextInt(3) == 0) r.nextInt(10) + 3 else null
        val until: String? = if (count == null && r.nextInt(3) == 0) {
            LocalDate.of(2025, r.nextInt(6) + 6, r.nextInt(28) + 1).toString()
        } else {
            null
        }

        return RecurrenceRule(
            freq = freq,
            interval = interval,
            byDay = byDay,
            count = count,
            until = until
        )
    }

    /**
     * Generate a random base start datetime.
     */
    private fun generateBaseStart(seed: Int): LocalDateTime {
        val r = java.util.Random(seed.toLong())
        val year = 2025
        val month = r.nextInt(6) + 1 // Jan-Jun
        val day = r.nextInt(28) + 1
        val hour = r.nextInt(24)
        val minute = listOf(0, 15, 30, 45)[r.nextInt(4)]
        return LocalDateTime.of(year, month, day, hour, minute)
    }

    /**
     * Generate a date range that starts at or before the base date and extends forward.
     */
    private fun generateRange(baseDate: LocalDate, seed: Int): Pair<LocalDate, LocalDate> {
        val r = java.util.Random(seed.toLong())
        val rangeStart = baseDate.minusDays(r.nextInt(7).toLong())
        val rangeEnd = baseDate.plusDays(r.nextInt(60).toLong() + 14)
        return rangeStart to rangeEnd
    }

    /**
     * Generate random exceptions for a set of dates.
     */
    private fun generateExceptions(
        dates: List<LocalDate>,
        seed: Int,
        brokenOffCount: Int = 0,
        completedCount: Int = 0
    ): List<RecurrenceException> {
        if (dates.isEmpty()) return emptyList()
        val r = java.util.Random(seed.toLong())
        val exceptions = mutableListOf<RecurrenceException>()

        // Pick some dates to be broken off
        val shuffled = dates.shuffled(r)
        val brokenOff = shuffled.take(brokenOffCount.coerceAtMost(dates.size))
        val remaining = shuffled.drop(brokenOffCount.coerceAtMost(dates.size))
        val completed = remaining.take(completedCount.coerceAtMost(remaining.size))

        for (date in brokenOff) {
            exceptions.add(
                RecurrenceException(
                    date = date.toString(),
                    brokenOff = true
                )
            )
        }
        for (date in completed) {
            exceptions.add(
                RecurrenceException(
                    date = date.toString(),
                    completed = true
                )
            )
        }
        return exceptions
    }

    // =========================================================================
    // Property 24: Recurrence engine equivalence with JS
    // =========================================================================
    //
    // For any valid RecurrenceRule, base date, date range, and exception set,
    // the Kotlin RecurrenceEngine SHALL produce the same set of instance dates
    // as the web app's shared-recurrence.js expandRecurrence function given
    // identical inputs.
    //
    // We verify equivalence by checking:
    // 1. Daily recurrence produces instances at exact interval spacing
    // 2. Weekly recurrence produces instances at 7*interval day spacing
    // 3. Monthly recurrence produces instances on the same day-of-month
    // 4. Yearly recurrence produces instances on the same month-and-day
    // 5. Count limits are respected
    // 6. Until dates are respected
    //
    // **Validates: Requirements 12.1, 12.2, 12.3, 12.8**

    @Test
    fun `Property 24 - Daily recurrence produces correct interval spacing`() {
        for (seed in 1..50) {
            val interval = (seed % 3) + 1 // 1, 2, or 3
            val rule = RecurrenceRule(freq = "DAILY", interval = interval)
            val baseStart = generateBaseStart(seed)
            val rangeStart = baseStart.toLocalDate()
            val rangeEnd = rangeStart.plusDays(30)

            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            assertTrue(
                "Seed $seed: Daily recurrence should produce instances",
                instances.isNotEmpty()
            )

            // Verify spacing between consecutive instances
            for (i in 1 until instances.size) {
                val daysBetween = java.time.temporal.ChronoUnit.DAYS.between(
                    instances[i - 1].date, instances[i].date
                )
                assertEquals(
                    "Seed $seed: Daily interval=$interval, instances[$i] spacing",
                    interval.toLong(),
                    daysBetween
                )
            }

            // First instance should be on the base date
            assertEquals(
                "Seed $seed: First instance on base date",
                baseStart.toLocalDate(),
                instances[0].date
            )
        }
    }

    @Test
    fun `Property 24 - Weekly recurrence without byDay produces 7x interval spacing`() {
        for (seed in 1..50) {
            val interval = (seed % 3) + 1
            val rule = RecurrenceRule(freq = "WEEKLY", interval = interval)
            val baseStart = generateBaseStart(seed)
            val rangeStart = baseStart.toLocalDate()
            val rangeEnd = rangeStart.plusDays(90)

            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            assertTrue(
                "Seed $seed: Weekly recurrence should produce instances",
                instances.isNotEmpty()
            )

            // Verify spacing: each instance should be 7*interval days apart
            for (i in 1 until instances.size) {
                val daysBetween = java.time.temporal.ChronoUnit.DAYS.between(
                    instances[i - 1].date, instances[i].date
                )
                assertEquals(
                    "Seed $seed: Weekly interval=$interval, instances[$i] spacing",
                    (7L * interval),
                    daysBetween
                )
            }
        }
    }

    @Test
    fun `Property 24 - Monthly recurrence preserves day of month`() {
        for (seed in 1..50) {
            val interval = (seed % 2) + 1
            val rule = RecurrenceRule(freq = "MONTHLY", interval = interval)
            // Use day 1-28 to avoid month-end edge cases
            val baseDay = (seed % 28) + 1
            val baseStart = LocalDateTime.of(2025, 1, baseDay, 9, 0)
            val rangeStart = baseStart.toLocalDate()
            val rangeEnd = rangeStart.plusMonths(12)

            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            assertTrue(
                "Seed $seed: Monthly recurrence should produce instances",
                instances.isNotEmpty()
            )

            // Each instance should fall on the same day of month as the base
            for (instance in instances) {
                assertEquals(
                    "Seed $seed: Monthly instance day-of-month should be $baseDay",
                    baseDay,
                    instance.date.dayOfMonth
                )
            }
        }
    }

    @Test
    fun `Property 24 - Yearly recurrence preserves month and day`() {
        for (seed in 1..30) {
            val rule = RecurrenceRule(freq = "YEARLY", interval = 1)
            val baseMonth = (seed % 12) + 1
            val baseDay = (seed % 28) + 1
            val baseStart = LocalDateTime.of(2020, baseMonth, baseDay, 10, 0)
            val rangeStart = baseStart.toLocalDate()
            val rangeEnd = rangeStart.plusYears(6)

            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            assertTrue(
                "Seed $seed: Yearly recurrence should produce instances",
                instances.isNotEmpty()
            )

            for (instance in instances) {
                assertEquals(
                    "Seed $seed: Yearly instance month",
                    baseMonth,
                    instance.date.monthValue
                )
                assertEquals(
                    "Seed $seed: Yearly instance day",
                    baseDay,
                    instance.date.dayOfMonth
                )
            }
        }
    }

    @Test
    fun `Property 24 - Count limit is respected`() {
        for (seed in 1..50) {
            val count = (seed % 8) + 2 // 2-9
            val rule = RecurrenceRule(
                freq = frequencies[seed % frequencies.size],
                interval = 1,
                count = count,
                byDay = if (frequencies[seed % frequencies.size] == "WEEKLY") listOf("MO", "WE", "FR") else null
            )
            val baseStart = generateBaseStart(seed)
            val rangeStart = baseStart.toLocalDate()
            // Use a very large range to ensure count is the limiting factor
            val rangeEnd = rangeStart.plusYears(10)

            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            assertTrue(
                "Seed $seed: Count=$count, freq=${rule.freq} — instances should not exceed count",
                instances.size <= count
            )
        }
    }

    @Test
    fun `Property 24 - Until date is respected`() {
        for (seed in 1..50) {
            val baseStart = LocalDateTime.of(2025, 1, 1, 9, 0)
            val untilDate = LocalDate.of(2025, 1, 1).plusDays((seed % 30 + 5).toLong())
            val rule = RecurrenceRule(
                freq = "DAILY",
                interval = 1,
                until = untilDate.toString()
            )
            val rangeStart = baseStart.toLocalDate()
            val rangeEnd = rangeStart.plusDays(90)

            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            // No instance should be after the until date
            for (instance in instances) {
                assertFalse(
                    "Seed $seed: Instance ${instance.date} should not be after until $untilDate",
                    instance.date.isAfter(untilDate)
                )
            }

            // Should have instances up to the until date
            assertTrue(
                "Seed $seed: Should have at least one instance",
                instances.isNotEmpty()
            )
        }
    }

    @Test
    fun `Property 24 - Instance numbers are sequential`() {
        for (seed in 1..50) {
            val rule = generateRule(seed)
            val baseStart = generateBaseStart(seed)
            val (rangeStart, rangeEnd) = generateRange(baseStart.toLocalDate(), seed)

            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            if (instances.size > 1) {
                // Instance numbers should be monotonically increasing
                for (i in 1 until instances.size) {
                    assertTrue(
                        "Seed $seed: Instance numbers should increase: " +
                            "${instances[i - 1].instanceNum} < ${instances[i].instanceNum}",
                        instances[i].instanceNum > instances[i - 1].instanceNum
                    )
                }
            }
        }
    }

    @Test
    fun `Property 24 - Duration is preserved across instances`() {
        for (seed in 1..30) {
            val rule = RecurrenceRule(freq = "DAILY", interval = 1)
            val baseStart = LocalDateTime.of(2025, 3, 1, 9, 0)
            val baseEnd = LocalDateTime.of(2025, 3, 1, 10, 30) // 90 min duration
            val rangeStart = baseStart.toLocalDate()
            val rangeEnd = rangeStart.plusDays(seed.toLong() + 5)

            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = baseEnd,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            for (instance in instances) {
                assertNotNull(
                    "Seed $seed: Instance should have endDatetime",
                    instance.endDatetime
                )
                val duration = java.time.Duration.between(
                    instance.startDatetime, instance.endDatetime
                ).toMinutes()
                assertEquals(
                    "Seed $seed: Duration should be 90 minutes for instance on ${instance.date}",
                    90L,
                    duration
                )
            }
        }
    }

    // =========================================================================
    // Property 25: Weekly recurrence respects byDay
    // =========================================================================
    //
    // For any weekly recurrence rule with byDay specified, every generated
    // instance SHALL fall on one of the specified days of the week.
    //
    // **Validates: Requirements 12.4**

    @Test
    fun `Property 25 - Weekly recurrence with byDay only produces instances on specified days`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            // Pick 1-4 random days
            val numDays = r.nextInt(4) + 1
            val selectedDays = dayAbbreviations.shuffled(r).take(numDays)
            val expectedDows = selectedDays.map { dayAbbrevToDow[it]!! }.toSet()

            val rule = RecurrenceRule(
                freq = "WEEKLY",
                interval = (r.nextInt(3) + 1),
                byDay = selectedDays
            )

            val baseStart = generateBaseStart(seed)
            val rangeStart = baseStart.toLocalDate()
            val rangeEnd = rangeStart.plusDays(60)

            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            // Every instance must fall on one of the specified days
            for (instance in instances) {
                assertTrue(
                    "Seed $seed: Instance on ${instance.date} (${instance.date.dayOfWeek}) " +
                        "should be one of $expectedDows (byDay=$selectedDays)",
                    instance.date.dayOfWeek in expectedDows
                )
            }
        }
    }

    @Test
    fun `Property 25 - Weekly byDay with single day produces only that day`() {
        // Test each individual day of the week
        for (dayAbbrev in dayAbbreviations) {
            val expectedDow = dayAbbrevToDow[dayAbbrev]!!
            val rule = RecurrenceRule(
                freq = "WEEKLY",
                interval = 1,
                byDay = listOf(dayAbbrev)
            )

            val baseStart = LocalDateTime.of(2025, 1, 1, 9, 0) // Wednesday
            val rangeStart = baseStart.toLocalDate()
            val rangeEnd = rangeStart.plusDays(60)

            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            assertTrue(
                "byDay=$dayAbbrev should produce instances",
                instances.isNotEmpty()
            )

            for (instance in instances) {
                assertEquals(
                    "byDay=$dayAbbrev: Instance on ${instance.date} should be $expectedDow",
                    expectedDow,
                    instance.date.dayOfWeek
                )
            }
        }
    }

    @Test
    fun `Property 25 - Weekly byDay with interval greater than 1 still respects days`() {
        for (seed in 1..30) {
            val r = java.util.Random(seed.toLong())
            val interval = r.nextInt(3) + 2 // 2-4
            val selectedDays = listOf("MO", "TH") // Monday and Thursday
            val expectedDows = setOf(DayOfWeek.MONDAY, DayOfWeek.THURSDAY)

            val rule = RecurrenceRule(
                freq = "WEEKLY",
                interval = interval,
                byDay = selectedDays
            )

            val baseStart = LocalDateTime.of(2025, 1, 6, 9, 0) // Monday
            val rangeStart = baseStart.toLocalDate()
            val rangeEnd = rangeStart.plusDays(120)

            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            for (instance in instances) {
                assertTrue(
                    "Seed $seed interval=$interval: Instance on ${instance.date} " +
                        "(${instance.date.dayOfWeek}) should be MON or THU",
                    instance.date.dayOfWeek in expectedDows
                )
            }
        }
    }

    // =========================================================================
    // Property 26: Recurrence exceptions are excluded
    // =========================================================================
    //
    // For any recurrence rule with broken-off exception dates, no generated
    // instance SHALL have a date matching any broken-off exception.
    //
    // **Validates: Requirements 12.6**

    @Test
    fun `Property 26 - Broken-off exceptions are excluded from results`() {
        for (seed in 1..50) {
            val rule = RecurrenceRule(freq = "DAILY", interval = 1)
            val baseStart = LocalDateTime.of(2025, 1, 1, 9, 0)
            val rangeStart = baseStart.toLocalDate()
            val rangeEnd = rangeStart.plusDays(30)

            // First expand without exceptions to get all dates
            val allInstances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            // Pick some dates to exclude
            val r = java.util.Random(seed.toLong())
            val numExceptions = r.nextInt(5) + 1
            val exceptionDates = allInstances.map { it.date }
                .shuffled(r)
                .take(numExceptions.coerceAtMost(allInstances.size))

            val exceptions = exceptionDates.map { date ->
                RecurrenceException(
                    date = date.toString(),
                    brokenOff = true
                )
            }

            val brokenOffDateStrings = exceptionDates.map { it.toString() }.toSet()

            // Expand with exceptions
            val filteredInstances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd,
                exceptions = exceptions
            )

            // No instance should have a date matching a broken-off exception
            for (instance in filteredInstances) {
                assertFalse(
                    "Seed $seed: Instance on ${instance.date} should be excluded " +
                        "(broken-off exceptions: $brokenOffDateStrings)",
                    instance.date.toString() in brokenOffDateStrings
                )
            }

            // The filtered count should be less than the unfiltered count
            assertTrue(
                "Seed $seed: Filtered instances (${filteredInstances.size}) should be fewer " +
                    "than all instances (${allInstances.size})",
                filteredInstances.size < allInstances.size
            )
        }
    }

    @Test
    fun `Property 26 - Completed exceptions are NOT excluded but marked`() {
        for (seed in 1..30) {
            val rule = RecurrenceRule(freq = "DAILY", interval = 1)
            val baseStart = LocalDateTime.of(2025, 2, 1, 9, 0)
            val rangeStart = baseStart.toLocalDate()
            val rangeEnd = rangeStart.plusDays(14)

            // First expand to get all dates
            val allInstances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            // Mark some as completed (not broken off)
            val r = java.util.Random(seed.toLong())
            val numCompleted = r.nextInt(3) + 1
            val completedDates = allInstances.map { it.date }
                .shuffled(r)
                .take(numCompleted.coerceAtMost(allInstances.size))

            val exceptions = completedDates.map { date ->
                RecurrenceException(
                    date = date.toString(),
                    brokenOff = false,
                    completed = true
                )
            }

            val completedDateStrings = completedDates.map { it.toString() }.toSet()

            // Expand with completed exceptions
            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd,
                exceptions = exceptions
            )

            // Completed dates should still appear (not excluded)
            assertEquals(
                "Seed $seed: Completed exceptions should not reduce instance count",
                allInstances.size,
                instances.size
            )

            // Completed instances should be marked as completed
            for (instance in instances) {
                if (instance.date.toString() in completedDateStrings) {
                    assertTrue(
                        "Seed $seed: Instance on ${instance.date} should be marked completed",
                        instance.isCompleted
                    )
                }
            }
        }
    }

    @Test
    fun `Property 26 - Mixed exceptions correctly exclude broken-off and keep completed`() {
        for (seed in 1..30) {
            val rule = RecurrenceRule(freq = "DAILY", interval = 1)
            val baseStart = LocalDateTime.of(2025, 3, 1, 10, 0)
            val rangeStart = baseStart.toLocalDate()
            val rangeEnd = rangeStart.plusDays(20)

            // Get all possible dates
            val allInstances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd
            )

            val r = java.util.Random(seed.toLong())
            val allDates = allInstances.map { it.date }.shuffled(r)

            // Split into broken-off and completed
            val brokenOffDates = allDates.take(2)
            val completedDates = allDates.drop(2).take(2)

            val exceptions = brokenOffDates.map { date ->
                RecurrenceException(date = date.toString(), brokenOff = true)
            } + completedDates.map { date ->
                RecurrenceException(date = date.toString(), completed = true)
            }

            val brokenOffStrings = brokenOffDates.map { it.toString() }.toSet()
            val completedStrings = completedDates.map { it.toString() }.toSet()

            val instances = engine.expand(
                rule = rule,
                baseStart = baseStart,
                baseEnd = null,
                rangeStart = rangeStart,
                rangeEnd = rangeEnd,
                exceptions = exceptions
            )

            // Broken-off dates must not appear
            for (instance in instances) {
                assertFalse(
                    "Seed $seed: Broken-off date ${instance.date} should not appear",
                    instance.date.toString() in brokenOffStrings
                )
            }

            // Completed dates must appear and be marked
            val instanceDateStrings = instances.map { it.date.toString() }.toSet()
            for (completedDate in completedStrings) {
                assertTrue(
                    "Seed $seed: Completed date $completedDate should still appear",
                    completedDate in instanceDateStrings
                )
            }

            // Total count should be allInstances - brokenOff
            assertEquals(
                "Seed $seed: Instance count should be all minus broken-off",
                allInstances.size - brokenOffDates.size,
                instances.size
            )
        }
    }

    @Test
    fun `Property 26 - All dates broken off produces empty result`() {
        val rule = RecurrenceRule(freq = "DAILY", interval = 1)
        val baseStart = LocalDateTime.of(2025, 4, 1, 9, 0)
        val rangeStart = baseStart.toLocalDate()
        val rangeEnd = rangeStart.plusDays(4) // 5 days total

        // Get all dates
        val allInstances = engine.expand(
            rule = rule,
            baseStart = baseStart,
            baseEnd = null,
            rangeStart = rangeStart,
            rangeEnd = rangeEnd
        )

        // Break off all of them
        val exceptions = allInstances.map { instance ->
            RecurrenceException(date = instance.date.toString(), brokenOff = true)
        }

        val instances = engine.expand(
            rule = rule,
            baseStart = baseStart,
            baseEnd = null,
            rangeStart = rangeStart,
            rangeEnd = rangeEnd,
            exceptions = exceptions
        )

        assertTrue(
            "All broken-off should produce empty result",
            instances.isEmpty()
        )
    }
}
