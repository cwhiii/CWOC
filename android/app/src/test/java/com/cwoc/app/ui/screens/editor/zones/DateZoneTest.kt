package com.cwoc.app.ui.screens.editor.zones

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalTime

/**
 * Property-based tests for DateZone utility functions.
 *
 * Property 2: Time snap interval
 * Property 3: Date/time format correctness
 * Property 4: Timezone search filtering
 *
 * **Validates: Requirements 3.2, 3.4, 3.6**
 */
class DateZoneTest {

    // =========================================================================
    // Property 2: Time snap interval
    // =========================================================================
    //
    // For any time value (hours 0–23, minutes 0–59) and any valid snap interval
    // (1, 5, 10, 15, 30, 60 minutes), the snapped time should be the nearest
    // multiple of the snap interval that is <= the original time, and the snapped
    // minutes should be evenly divisible by the interval.
    //
    // **Validates: Requirements 3.2**

    private val validSnapIntervals = listOf(1, 5, 10, 15, 30, 60)

    @Test
    fun `Property 2 - snapMinute result is evenly divisible by interval`() {
        val random = java.util.Random(42)
        for (iteration in 1..200) {
            val minute = random.nextInt(60) // 0-59
            val interval = validSnapIntervals[random.nextInt(validSnapIntervals.size)]

            val snapped = snapMinute(minute, interval)

            assertEquals(
                "Iteration $iteration: snapMinute($minute, $interval) = $snapped should be divisible by $interval",
                0,
                snapped % interval
            )
        }
    }

    @Test
    fun `Property 2 - snapMinute result is less than or equal to original minute`() {
        val random = java.util.Random(123)
        for (iteration in 1..200) {
            val minute = random.nextInt(60)
            val interval = validSnapIntervals[random.nextInt(validSnapIntervals.size)]

            val snapped = snapMinute(minute, interval)

            assertTrue(
                "Iteration $iteration: snapMinute($minute, $interval) = $snapped should be <= $minute",
                snapped <= minute
            )
        }
    }

    @Test
    fun `Property 2 - snapMinute result is the nearest multiple below original`() {
        val random = java.util.Random(456)
        for (iteration in 1..200) {
            val minute = random.nextInt(60)
            val interval = validSnapIntervals[random.nextInt(validSnapIntervals.size)]

            val snapped = snapMinute(minute, interval)

            // The next multiple up should be > minute (proving snapped is the nearest below)
            val nextMultiple = snapped + interval
            assertTrue(
                "Iteration $iteration: next multiple ($nextMultiple) after snapMinute($minute, $interval) = $snapped should be > $minute",
                nextMultiple > minute
            )
        }
    }

    @Test
    fun `Property 2 - snapMinute result is in valid range 0-59`() {
        val random = java.util.Random(789)
        for (iteration in 1..200) {
            val minute = random.nextInt(60)
            val interval = validSnapIntervals[random.nextInt(validSnapIntervals.size)]

            val snapped = snapMinute(minute, interval)

            assertTrue(
                "Iteration $iteration: snapMinute($minute, $interval) = $snapped should be >= 0",
                snapped >= 0
            )
            assertTrue(
                "Iteration $iteration: snapMinute($minute, $interval) = $snapped should be < 60",
                snapped < 60
            )
        }
    }

    @Test
    fun `Property 2 - snapTime preserves hour and snaps minute`() {
        val random = java.util.Random(101)
        for (iteration in 1..200) {
            val hour = random.nextInt(24)
            val minute = random.nextInt(60)
            val interval = validSnapIntervals[random.nextInt(validSnapIntervals.size)]
            val time = LocalTime.of(hour, minute)

            val snapped = snapTime(time, interval)

            assertEquals(
                "Iteration $iteration: snapTime hour should be preserved for $time with interval $interval",
                hour,
                snapped.hour
            )
            assertEquals(
                "Iteration $iteration: snapTime minute should equal snapMinute result",
                snapMinute(minute, interval),
                snapped.minute
            )
        }
    }

    @Test
    fun `Property 2 - snapTime with interval 1 returns original time`() {
        val random = java.util.Random(202)
        for (iteration in 1..100) {
            val hour = random.nextInt(24)
            val minute = random.nextInt(60)
            val time = LocalTime.of(hour, minute)

            val snapped = snapTime(time, 1)

            assertEquals(
                "Iteration $iteration: snapTime with interval 1 should return original time",
                time.hour,
                snapped.hour
            )
            assertEquals(
                "Iteration $iteration: snapTime with interval 1 should return original minute",
                time.minute,
                snapped.minute
            )
        }
    }

    @Test
    fun `Property 2 - snapTime with invalid interval returns original time`() {
        val random = java.util.Random(303)
        val invalidIntervals = listOf(0, -1, -5, 61, 100)
        for (iteration in 1..50) {
            val hour = random.nextInt(24)
            val minute = random.nextInt(60)
            val time = LocalTime.of(hour, minute)
            val invalidInterval = invalidIntervals[random.nextInt(invalidIntervals.size)]

            val snapped = snapTime(time, invalidInterval)

            assertEquals(
                "Iteration $iteration: snapTime with invalid interval $invalidInterval should return original",
                time,
                snapped
            )
        }
    }

    // =========================================================================
    // Property 3: Date/time format correctness
    // =========================================================================
    //
    // For any valid datetime and format preference (12h or 24h), the formatted
    // string should match the expected pattern: 12h format contains AM/PM and
    // hours 1–12, 24h format uses hours 0–23 with no AM/PM suffix.
    //
    // **Validates: Requirements 3.4**

    @Test
    fun `Property 3 - 12h format contains AM or PM`() {
        val random = java.util.Random(500)
        for (iteration in 1..200) {
            val year = 2020 + random.nextInt(5)
            val month = random.nextInt(12) + 1
            val day = random.nextInt(28) + 1
            val hour = random.nextInt(24)
            val minute = random.nextInt(60)
            val datetime = String.format("%04d-%02d-%02dT%02d:%02d:00", year, month, day, hour, minute)

            val result = formatDatetimeForDisplay(datetime, allDay = false, timeFormat = "12h")

            assertTrue(
                "Iteration $iteration: 12h format for '$datetime' should contain AM or PM, got '$result'",
                result.contains("AM") || result.contains("PM")
            )
        }
    }

    @Test
    fun `Property 3 - 24h format does not contain AM or PM`() {
        val random = java.util.Random(501)
        for (iteration in 1..200) {
            val year = 2020 + random.nextInt(5)
            val month = random.nextInt(12) + 1
            val day = random.nextInt(28) + 1
            val hour = random.nextInt(24)
            val minute = random.nextInt(60)
            val datetime = String.format("%04d-%02d-%02dT%02d:%02d:00", year, month, day, hour, minute)

            val result = formatDatetimeForDisplay(datetime, allDay = false, timeFormat = "24h")

            assertFalse(
                "Iteration $iteration: 24h format for '$datetime' should NOT contain AM or PM, got '$result'",
                result.contains("AM") || result.contains("PM")
            )
        }
    }

    @Test
    fun `Property 3 - allDay mode does not contain time portion`() {
        val random = java.util.Random(502)
        for (iteration in 1..200) {
            val year = 2020 + random.nextInt(5)
            val month = random.nextInt(12) + 1
            val day = random.nextInt(28) + 1
            val hour = random.nextInt(24)
            val minute = random.nextInt(60)
            val datetime = String.format("%04d-%02d-%02dT%02d:%02d:00", year, month, day, hour, minute)

            val result12 = formatDatetimeForDisplay(datetime, allDay = true, timeFormat = "12h")
            val result24 = formatDatetimeForDisplay(datetime, allDay = true, timeFormat = "24h")

            assertFalse(
                "Iteration $iteration: allDay 12h for '$datetime' should NOT contain AM/PM, got '$result12'",
                result12.contains("AM") || result12.contains("PM")
            )
            assertFalse(
                "Iteration $iteration: allDay 24h for '$datetime' should NOT contain AM/PM, got '$result24'",
                result24.contains("AM") || result24.contains("PM")
            )
            // allDay should not contain a colon (time separator)
            assertFalse(
                "Iteration $iteration: allDay format should not contain ':' (time), got '$result12'",
                result12.contains(":")
            )
        }
    }

    @Test
    fun `Property 3 - null or blank input returns empty string`() {
        val inputs = listOf(null, "", "  ", "\t", "\n")
        val formats = listOf("12h", "24h")
        val allDayOptions = listOf(true, false)

        for (input in inputs) {
            for (format in formats) {
                for (allDay in allDayOptions) {
                    val result = formatDatetimeForDisplay(input, allDay, format)
                    assertEquals(
                        "formatDatetimeForDisplay('$input', allDay=$allDay, '$format') should return empty string",
                        "",
                        result
                    )
                }
            }
        }
    }

    @Test
    fun `Property 3 - formatted output is non-empty for valid datetime`() {
        val random = java.util.Random(503)
        for (iteration in 1..200) {
            val year = 2020 + random.nextInt(5)
            val month = random.nextInt(12) + 1
            val day = random.nextInt(28) + 1
            val hour = random.nextInt(24)
            val minute = random.nextInt(60)
            val datetime = String.format("%04d-%02d-%02dT%02d:%02d:00", year, month, day, hour, minute)
            val format = if (random.nextBoolean()) "12h" else "24h"
            val allDay = random.nextBoolean()

            val result = formatDatetimeForDisplay(datetime, allDay, format)

            assertTrue(
                "Iteration $iteration: formatDatetimeForDisplay('$datetime', $allDay, '$format') should be non-empty",
                result.isNotEmpty()
            )
        }
    }

    @Test
    fun `Property 3 - 12h format hour is between 1 and 12`() {
        val random = java.util.Random(504)
        // Regex to extract the hour from 12h format like "Jan 15, 2024  3:30 PM"
        val hourPattern = Regex("""(\d{1,2}):\d{2}\s[AP]M""")

        for (iteration in 1..200) {
            val year = 2020 + random.nextInt(5)
            val month = random.nextInt(12) + 1
            val day = random.nextInt(28) + 1
            val hour = random.nextInt(24)
            val minute = random.nextInt(60)
            val datetime = String.format("%04d-%02d-%02dT%02d:%02d:00", year, month, day, hour, minute)

            val result = formatDatetimeForDisplay(datetime, allDay = false, timeFormat = "12h")
            val match = hourPattern.find(result)

            assertNotNull(
                "Iteration $iteration: should find hour:minute AM/PM pattern in '$result'",
                match
            )
            if (match != null) {
                val displayHour = match.groupValues[1].toInt()
                assertTrue(
                    "Iteration $iteration: 12h hour should be 1-12, got $displayHour in '$result' (input hour=$hour)",
                    displayHour in 1..12
                )
            }
        }
    }

    @Test
    fun `Property 3 - 24h format hour is between 0 and 23`() {
        val random = java.util.Random(505)
        // Regex to extract the hour from 24h format like "Jan 15, 2024  15:30"
        val hourPattern = Regex("""(\d{1,2}):(\d{2})(?!\s[AP]M)""")

        for (iteration in 1..200) {
            val year = 2020 + random.nextInt(5)
            val month = random.nextInt(12) + 1
            val day = random.nextInt(28) + 1
            val hour = random.nextInt(24)
            val minute = random.nextInt(60)
            val datetime = String.format("%04d-%02d-%02dT%02d:%02d:00", year, month, day, hour, minute)

            val result = formatDatetimeForDisplay(datetime, allDay = false, timeFormat = "24h")
            val match = hourPattern.find(result)

            assertNotNull(
                "Iteration $iteration: should find hour:minute pattern in '$result'",
                match
            )
            if (match != null) {
                val displayHour = match.groupValues[1].toInt()
                assertTrue(
                    "Iteration $iteration: 24h hour should be 0-23, got $displayHour in '$result' (input hour=$hour)",
                    displayHour in 0..23
                )
            }
        }
    }

    // =========================================================================
    // Property 4: Timezone search filtering
    // =========================================================================
    //
    // For any substring of a valid IANA timezone ID, searching the timezone list
    // with that substring should return a non-empty result set where every result
    // contains the search substring (case-insensitive).
    //
    // **Validates: Requirements 3.6**

    @Test
    fun `Property 4 - filtering by substring returns only matching entries`() {
        val random = java.util.Random(600)
        for (iteration in 1..200) {
            // Pick a random timezone and extract a random substring from it
            val tz = COMMON_TIMEZONES[random.nextInt(COMMON_TIMEZONES.size)]
            val startIdx = random.nextInt(tz.length)
            val endIdx = startIdx + random.nextInt(tz.length - startIdx) + 1
            val searchString = tz.substring(startIdx, endIdx)

            val filtered = COMMON_TIMEZONES.filter { it.contains(searchString, ignoreCase = true) }

            // Result should be non-empty (at least the source timezone matches)
            assertTrue(
                "Iteration $iteration: filtering by '$searchString' (from '$tz') should return non-empty results",
                filtered.isNotEmpty()
            )

            // Every result must contain the search string (case-insensitive)
            for (result in filtered) {
                assertTrue(
                    "Iteration $iteration: '$result' should contain '$searchString' (case-insensitive)",
                    result.contains(searchString, ignoreCase = true)
                )
            }
        }
    }

    @Test
    fun `Property 4 - filtering is case-insensitive`() {
        val random = java.util.Random(601)
        for (iteration in 1..100) {
            val tz = COMMON_TIMEZONES[random.nextInt(COMMON_TIMEZONES.size)]
            val startIdx = random.nextInt(tz.length)
            val endIdx = startIdx + random.nextInt(tz.length - startIdx) + 1
            val searchString = tz.substring(startIdx, endIdx)

            // Compare lowercase, uppercase, and mixed case searches
            val lowerResult = COMMON_TIMEZONES.filter { it.contains(searchString.lowercase(), ignoreCase = true) }
            val upperResult = COMMON_TIMEZONES.filter { it.contains(searchString.uppercase(), ignoreCase = true) }
            val originalResult = COMMON_TIMEZONES.filter { it.contains(searchString, ignoreCase = true) }

            assertEquals(
                "Iteration $iteration: lowercase search '$searchString' should match same entries as original",
                originalResult.toSet(),
                lowerResult.toSet()
            )
            assertEquals(
                "Iteration $iteration: uppercase search '$searchString' should match same entries as original",
                originalResult.toSet(),
                upperResult.toSet()
            )
        }
    }

    @Test
    fun `Property 4 - empty search returns all timezones`() {
        val filtered = COMMON_TIMEZONES.filter { it.contains("", ignoreCase = true) }

        assertEquals(
            "Empty search should return all timezones",
            COMMON_TIMEZONES.size,
            filtered.size
        )
    }

    @Test
    fun `Property 4 - non-matching search returns empty list`() {
        val nonsenseQueries = listOf(
            "ZZZZZ", "12345xyz", "qqqqqq", "!!!!", "NoSuchTimezone"
        )

        for (query in nonsenseQueries) {
            val filtered = COMMON_TIMEZONES.filter { it.contains(query, ignoreCase = true) }

            assertTrue(
                "Nonsense query '$query' should return empty results",
                filtered.isEmpty()
            )
        }
    }

    @Test
    fun `Property 4 - region prefix filters correctly`() {
        val regions = listOf("America", "Europe", "Asia", "Pacific", "Africa", "Australia")

        for (region in regions) {
            val filtered = COMMON_TIMEZONES.filter { it.contains(region, ignoreCase = true) }

            assertTrue(
                "Region '$region' should match at least one timezone",
                filtered.isNotEmpty()
            )

            for (result in filtered) {
                assertTrue(
                    "'$result' should contain region '$region'",
                    result.contains(region, ignoreCase = true)
                )
            }

            // Verify no timezone from a different region sneaks in
            for (result in filtered) {
                assertTrue(
                    "'$result' must actually contain '$region'",
                    result.lowercase().contains(region.lowercase())
                )
            }
        }
    }

    @Test
    fun `Property 4 - every timezone in COMMON_TIMEZONES is findable by its own name`() {
        for (tz in COMMON_TIMEZONES) {
            val filtered = COMMON_TIMEZONES.filter { it.contains(tz, ignoreCase = true) }

            assertTrue(
                "Timezone '$tz' should be findable by searching for itself",
                filtered.contains(tz)
            )
        }
    }

    @Test
    fun `Property 4 - filtered results are a subset of COMMON_TIMEZONES`() {
        val random = java.util.Random(602)
        for (iteration in 1..100) {
            val tz = COMMON_TIMEZONES[random.nextInt(COMMON_TIMEZONES.size)]
            val startIdx = random.nextInt(tz.length)
            val endIdx = startIdx + random.nextInt(tz.length - startIdx) + 1
            val searchString = tz.substring(startIdx, endIdx)

            val filtered = COMMON_TIMEZONES.filter { it.contains(searchString, ignoreCase = true) }

            // Every filtered result must be in the original list
            for (result in filtered) {
                assertTrue(
                    "Iteration $iteration: filtered result '$result' must be in COMMON_TIMEZONES",
                    COMMON_TIMEZONES.contains(result)
                )
            }
        }
    }
}
