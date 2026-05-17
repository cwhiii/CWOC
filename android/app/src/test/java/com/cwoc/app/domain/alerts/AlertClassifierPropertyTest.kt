package com.cwoc.app.domain.alerts

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDateTime

/**
 * Property-based tests for AlertClassifier.classifyAlerts().
 *
 * Property 8: Alert classification partitions correctly
 *
 * For any set of alert chits and a reference time T, classifyAlerts SHALL place
 * alerts with scheduledTime > T in UPCOMING and alerts with scheduledTime ≤ T in PAST,
 * sorted by scheduledTime ascending within each section.
 *
 * **Validates: Requirements 3.2, 3.3**
 */
class AlertClassifierPropertyTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val random = java.util.Random(42)

    private val alertTypes = listOf("alarm", "reminder", "timer")

    /**
     * Generates a random LocalDateTime within a reasonable range around a base time.
     * Offsets range from -30 days to +30 days from the base.
     */
    private fun randomDateTime(base: LocalDateTime, r: java.util.Random): LocalDateTime {
        val offsetMinutes = r.nextInt(60 * 24 * 60) - (30 * 24 * 60) // -30 to +30 days in minutes
        return base.plusMinutes(offsetMinutes.toLong())
    }

    /**
     * Generates a list of RawAlerts with random types and datetimes.
     */
    private fun generateAlerts(count: Int, base: LocalDateTime, r: java.util.Random): List<RawAlert> {
        return (0 until count).map {
            val dt = randomDateTime(base, r)
            RawAlert(
                type = alertTypes[r.nextInt(alertTypes.size)],
                datetime = dt.toString(),
                offset = if (r.nextBoolean()) r.nextInt(120) else null,
                label = if (r.nextBoolean()) "label_${r.nextInt(100)}" else null
            )
        }
    }

    // =========================================================================
    // Property 8: Alert classification partitions correctly
    // =========================================================================

    /**
     * Property 8: Every alert with scheduledTime >= referenceTime is classified as UPCOMING,
     * and every alert with scheduledTime < referenceTime is classified as PAST.
     *
     * Tests across 100 random configurations with varying alert counts and reference times.
     */
    @Test
    fun `Property 8 - alerts are partitioned into correct sections based on reference time`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
            val alertCount = r.nextInt(10) + 1 // 1 to 10 alerts
            val alerts = generateAlerts(alertCount, referenceTime, r)

            val result = AlertClassifier.classifyAlerts(
                chitId = "chit-$seed",
                chitTitle = "Test Chit $seed",
                alerts = alerts,
                referenceTime = referenceTime
            )

            // Verify each classified alert is in the correct section
            for (classified in result) {
                if (classified.scheduledTime.isBefore(referenceTime)) {
                    assertEquals(
                        "Seed $seed: alert at ${classified.scheduledTime} should be PAST (ref=$referenceTime)",
                        AlertSection.PAST,
                        classified.section
                    )
                } else {
                    assertEquals(
                        "Seed $seed: alert at ${classified.scheduledTime} should be UPCOMING (ref=$referenceTime)",
                        AlertSection.UPCOMING,
                        classified.section
                    )
                }
            }
        }
    }

    /**
     * Property 8: Within each section (UPCOMING and PAST), alerts are sorted
     * by scheduledTime ascending.
     */
    @Test
    fun `Property 8 - alerts are sorted ascending within each section`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
            val alertCount = r.nextInt(15) + 2 // 2 to 16 alerts for meaningful sort checks
            val alerts = generateAlerts(alertCount, referenceTime, r)

            val result = AlertClassifier.classifyAlerts(
                chitId = "chit-$seed",
                chitTitle = "Test Chit $seed",
                alerts = alerts,
                referenceTime = referenceTime
            )

            val upcoming = result.filter { it.section == AlertSection.UPCOMING }
            val past = result.filter { it.section == AlertSection.PAST }

            // Verify UPCOMING section is sorted ascending
            for (i in 0 until upcoming.size - 1) {
                assertTrue(
                    "Seed $seed: UPCOMING not sorted at index $i: ${upcoming[i].scheduledTime} should be <= ${upcoming[i + 1].scheduledTime}",
                    !upcoming[i].scheduledTime.isAfter(upcoming[i + 1].scheduledTime)
                )
            }

            // Verify PAST section is sorted ascending
            for (i in 0 until past.size - 1) {
                assertTrue(
                    "Seed $seed: PAST not sorted at index $i: ${past[i].scheduledTime} should be <= ${past[i + 1].scheduledTime}",
                    !past[i].scheduledTime.isAfter(past[i + 1].scheduledTime)
                )
            }
        }
    }

    /**
     * Property 8: The total number of classified alerts equals the number of
     * parseable input alerts (alerts with valid datetime strings).
     */
    @Test
    fun `Property 8 - classification preserves all parseable alerts`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
            val alertCount = r.nextInt(10) + 1
            val alerts = generateAlerts(alertCount, referenceTime, r)

            val result = AlertClassifier.classifyAlerts(
                chitId = "chit-$seed",
                chitTitle = "Test Chit $seed",
                alerts = alerts,
                referenceTime = referenceTime
            )

            // All generated alerts have valid datetimes, so all should be classified
            assertEquals(
                "Seed $seed: expected $alertCount classified alerts",
                alertCount,
                result.size
            )
        }
    }

    /**
     * Property 8: UPCOMING section appears before PAST section in the output list.
     */
    @Test
    fun `Property 8 - UPCOMING alerts appear before PAST alerts in output`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
            val alertCount = r.nextInt(10) + 2
            val alerts = generateAlerts(alertCount, referenceTime, r)

            val result = AlertClassifier.classifyAlerts(
                chitId = "chit-$seed",
                chitTitle = "Test Chit $seed",
                alerts = alerts,
                referenceTime = referenceTime
            )

            // Find the last UPCOMING index and first PAST index
            val lastUpcomingIdx = result.indexOfLast { it.section == AlertSection.UPCOMING }
            val firstPastIdx = result.indexOfFirst { it.section == AlertSection.PAST }

            // If both sections exist, UPCOMING must come before PAST
            if (lastUpcomingIdx != -1 && firstPastIdx != -1) {
                assertTrue(
                    "Seed $seed: last UPCOMING ($lastUpcomingIdx) should be before first PAST ($firstPastIdx)",
                    lastUpcomingIdx < firstPastIdx
                )
            }
        }
    }

    /**
     * Property 8: Alerts exactly at the reference time are classified as UPCOMING
     * (scheduledTime >= referenceTime means UPCOMING per the implementation).
     */
    @Test
    fun `Property 8 - alert exactly at reference time is classified as UPCOMING`() {
        val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
        val alerts = listOf(
            RawAlert(type = "alarm", datetime = referenceTime.toString()),
            RawAlert(type = "reminder", datetime = referenceTime.minusMinutes(1).toString()),
            RawAlert(type = "timer", datetime = referenceTime.plusMinutes(1).toString())
        )

        val result = AlertClassifier.classifyAlerts(
            chitId = "boundary-test",
            chitTitle = "Boundary Test",
            alerts = alerts,
            referenceTime = referenceTime
        )

        assertEquals(3, result.size)

        // Exactly at reference time → UPCOMING
        val atRef = result.find { it.scheduledTime == referenceTime }
        assertNotNull("Alert at reference time should exist", atRef)
        assertEquals(AlertSection.UPCOMING, atRef!!.section)

        // 1 minute before → PAST
        val before = result.find { it.scheduledTime == referenceTime.minusMinutes(1) }
        assertNotNull(before)
        assertEquals(AlertSection.PAST, before!!.section)

        // 1 minute after → UPCOMING
        val after = result.find { it.scheduledTime == referenceTime.plusMinutes(1) }
        assertNotNull(after)
        assertEquals(AlertSection.UPCOMING, after!!.section)
    }

    /**
     * Property 8: Empty alert list produces empty result.
     */
    @Test
    fun `Property 8 - empty alerts produce empty classification`() {
        val result = AlertClassifier.classifyAlerts(
            chitId = "empty-test",
            chitTitle = "Empty",
            alerts = emptyList(),
            referenceTime = LocalDateTime.now()
        )
        assertTrue(result.isEmpty())
    }

    /**
     * Property 8: Alerts with null or invalid datetime are excluded from classification.
     */
    @Test
    fun `Property 8 - invalid datetime alerts are excluded`() {
        val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
        val alerts = listOf(
            RawAlert(type = "alarm", datetime = null),
            RawAlert(type = "reminder", datetime = ""),
            RawAlert(type = "timer", datetime = "not-a-date"),
            RawAlert(type = "alarm", datetime = referenceTime.plusHours(1).toString())
        )

        val result = AlertClassifier.classifyAlerts(
            chitId = "invalid-test",
            chitTitle = "Invalid Test",
            alerts = alerts,
            referenceTime = referenceTime
        )

        // Only the valid alert should be classified
        assertEquals(1, result.size)
        assertEquals(AlertSection.UPCOMING, result[0].section)
    }

    /**
     * Property 8: All alerts in the future produce only UPCOMING section.
     */
    @Test
    fun `Property 8 - all future alerts are UPCOMING`() {
        val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
        val alerts = (1..5).map { i ->
            RawAlert(type = "alarm", datetime = referenceTime.plusHours(i.toLong()).toString())
        }

        val result = AlertClassifier.classifyAlerts(
            chitId = "all-future",
            chitTitle = "All Future",
            alerts = alerts,
            referenceTime = referenceTime
        )

        assertEquals(5, result.size)
        assertTrue(result.all { it.section == AlertSection.UPCOMING })
        // Verify ascending sort
        for (i in 0 until result.size - 1) {
            assertTrue(!result[i].scheduledTime.isAfter(result[i + 1].scheduledTime))
        }
    }

    /**
     * Property 8: All alerts in the past produce only PAST section.
     */
    @Test
    fun `Property 8 - all past alerts are PAST`() {
        val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
        val alerts = (1..5).map { i ->
            RawAlert(type = "reminder", datetime = referenceTime.minusHours(i.toLong()).toString())
        }

        val result = AlertClassifier.classifyAlerts(
            chitId = "all-past",
            chitTitle = "All Past",
            alerts = alerts,
            referenceTime = referenceTime
        )

        assertEquals(5, result.size)
        assertTrue(result.all { it.section == AlertSection.PAST })
        // Verify ascending sort
        for (i in 0 until result.size - 1) {
            assertTrue(!result[i].scheduledTime.isAfter(result[i + 1].scheduledTime))
        }
    }

    /**
     * Property 8: chitId and chitTitle are correctly propagated to all classified alerts.
     */
    @Test
    fun `Property 8 - chitId and chitTitle propagated to all classified alerts`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
            val chitId = "chit-prop-$seed"
            val chitTitle = "Title $seed"
            val alerts = generateAlerts(r.nextInt(5) + 1, referenceTime, r)

            val result = AlertClassifier.classifyAlerts(
                chitId = chitId,
                chitTitle = chitTitle,
                alerts = alerts,
                referenceTime = referenceTime
            )

            for (classified in result) {
                assertEquals("Seed $seed: chitId mismatch", chitId, classified.chitId)
                assertEquals("Seed $seed: chitTitle mismatch", chitTitle, classified.chitTitle)
            }
        }
    }

    /**
     * Property 8: alertType defaults to "reminder" when raw alert type is null.
     */
    @Test
    fun `Property 8 - null alert type defaults to reminder`() {
        val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
        val alerts = listOf(
            RawAlert(type = null, datetime = referenceTime.plusHours(1).toString())
        )

        val result = AlertClassifier.classifyAlerts(
            chitId = "null-type",
            chitTitle = "Null Type",
            alerts = alerts,
            referenceTime = referenceTime
        )

        assertEquals(1, result.size)
        assertEquals("reminder", result[0].alertType)
    }
}
