package com.cwoc.app.ui.screens.alerts

import com.cwoc.app.domain.alerts.AlertClassifier
import com.cwoc.app.domain.alerts.AlertSection
import com.cwoc.app.domain.alerts.ClassifiedAlert
import com.cwoc.app.domain.alerts.RawAlert
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDateTime

/**
 * Property-based tests for alert display fields.
 *
 * Property 9: Alert display contains required fields
 *
 * For any ClassifiedAlert, the rendered output SHALL contain the alert type,
 * scheduled time, and chit title.
 *
 * **Validates: Requirements 3.5**
 */
class AlertDisplayFieldsPropertyTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val alertTypes = listOf("alarm", "reminder", "timer")
    private val sampleTitles = listOf(
        "Morning standup",
        "Doctor appointment",
        "Pick up groceries",
        "Submit report",
        "Call plumber",
        "Team lunch",
        "Flight to NYC",
        "Dentist",
        "Pay rent",
        "Birthday party"
    )

    /**
     * Generates a random set of RawAlerts with valid datetimes.
     */
    private fun generateAlerts(seed: Int, count: Int, base: LocalDateTime): List<RawAlert> {
        val r = java.util.Random(seed.toLong())
        return (0 until count).map {
            val offsetMinutes = r.nextInt(60 * 24 * 30) - (15 * 24 * 60) // -15 to +15 days
            val dt = base.plusMinutes(offsetMinutes.toLong())
            RawAlert(
                type = alertTypes[r.nextInt(alertTypes.size)],
                datetime = dt.toString(),
                offset = if (r.nextBoolean()) r.nextInt(60) else null,
                label = if (r.nextBoolean()) "label_${r.nextInt(50)}" else null
            )
        }
    }

    // =========================================================================
    // Property 9: Alert display contains required fields
    // =========================================================================

    /**
     * Property 9: Every ClassifiedAlert has a non-null alertType field.
     */
    @Test
    fun `Property 9 - every classified alert has a non-null alert type`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
            val alertCount = r.nextInt(8) + 1
            val chitTitle = sampleTitles[r.nextInt(sampleTitles.size)]
            val alerts = generateAlerts(seed, alertCount, referenceTime)

            val result = AlertClassifier.classifyAlerts(
                chitId = "chit-$seed",
                chitTitle = chitTitle,
                alerts = alerts,
                referenceTime = referenceTime
            )

            for (classified in result) {
                assertNotNull(
                    "Seed $seed: alertType should not be null",
                    classified.alertType
                )
                assertTrue(
                    "Seed $seed: alertType '${classified.alertType}' should be a valid type",
                    classified.alertType in listOf("alarm", "reminder", "timer")
                )
            }
        }
    }

    /**
     * Property 9: Every ClassifiedAlert has a valid scheduledTime.
     */
    @Test
    fun `Property 9 - every classified alert has a valid scheduled time`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
            val alertCount = r.nextInt(8) + 1
            val chitTitle = sampleTitles[r.nextInt(sampleTitles.size)]
            val alerts = generateAlerts(seed, alertCount, referenceTime)

            val result = AlertClassifier.classifyAlerts(
                chitId = "chit-$seed",
                chitTitle = chitTitle,
                alerts = alerts,
                referenceTime = referenceTime
            )

            for (classified in result) {
                assertNotNull(
                    "Seed $seed: scheduledTime should not be null",
                    classified.scheduledTime
                )
                // Verify it's a reasonable datetime (within our generation range)
                assertTrue(
                    "Seed $seed: scheduledTime ${classified.scheduledTime} should be within reasonable range",
                    classified.scheduledTime.year in 2024..2026
                )
            }
        }
    }

    /**
     * Property 9: Every ClassifiedAlert preserves the chit title from input.
     */
    @Test
    fun `Property 9 - every classified alert preserves the chit title`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
            val alertCount = r.nextInt(8) + 1
            val chitTitle = sampleTitles[r.nextInt(sampleTitles.size)]
            val alerts = generateAlerts(seed, alertCount, referenceTime)

            val result = AlertClassifier.classifyAlerts(
                chitId = "chit-$seed",
                chitTitle = chitTitle,
                alerts = alerts,
                referenceTime = referenceTime
            )

            for (classified in result) {
                assertEquals(
                    "Seed $seed: chitTitle should be preserved",
                    chitTitle,
                    classified.chitTitle
                )
            }
        }
    }

    /**
     * Property 9: The alert type in the output matches the type from the raw input.
     */
    @Test
    fun `Property 9 - alert type matches the raw input type`() {
        val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)

        for (type in alertTypes) {
            val alerts = listOf(
                RawAlert(
                    type = type,
                    datetime = referenceTime.plusHours(1).toString()
                )
            )

            val result = AlertClassifier.classifyAlerts(
                chitId = "type-test-$type",
                chitTitle = "Type Test",
                alerts = alerts,
                referenceTime = referenceTime
            )

            assertEquals(1, result.size)
            assertEquals(
                "Alert type should match input: $type",
                type,
                result[0].alertType
            )
        }
    }

    /**
     * Property 9: The scheduled time in the output matches the datetime from the raw input.
     */
    @Test
    fun `Property 9 - scheduled time matches the raw input datetime`() {
        val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)

        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val expectedTime = referenceTime.plusMinutes(r.nextInt(10000).toLong())
            val alerts = listOf(
                RawAlert(
                    type = "alarm",
                    datetime = expectedTime.toString()
                )
            )

            val result = AlertClassifier.classifyAlerts(
                chitId = "time-test-$seed",
                chitTitle = "Time Test",
                alerts = alerts,
                referenceTime = referenceTime
            )

            assertEquals(1, result.size)
            assertEquals(
                "Seed $seed: scheduledTime should match input datetime",
                expectedTime,
                result[0].scheduledTime
            )
        }
    }

    /**
     * Property 9: All three required display fields (type, time, title) are present
     * simultaneously on every classified alert.
     */
    @Test
    fun `Property 9 - all three display fields present simultaneously`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
            val alertCount = r.nextInt(10) + 1
            val chitTitle = "Chit Title $seed"
            val alerts = generateAlerts(seed, alertCount, referenceTime)

            val result = AlertClassifier.classifyAlerts(
                chitId = "chit-$seed",
                chitTitle = chitTitle,
                alerts = alerts,
                referenceTime = referenceTime
            )

            for ((idx, classified) in result.withIndex()) {
                // All three fields must be present and valid
                assertNotNull(
                    "Seed $seed, alert $idx: alertType must not be null",
                    classified.alertType
                )
                assertTrue(
                    "Seed $seed, alert $idx: alertType must not be empty",
                    classified.alertType.isNotEmpty()
                )
                assertNotNull(
                    "Seed $seed, alert $idx: scheduledTime must not be null",
                    classified.scheduledTime
                )
                assertEquals(
                    "Seed $seed, alert $idx: chitTitle must match input",
                    chitTitle,
                    classified.chitTitle
                )
            }
        }
    }

    /**
     * Property 9: Null title is preserved as null (not replaced with empty string).
     */
    @Test
    fun `Property 9 - null title is preserved as null`() {
        val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
        val alerts = listOf(
            RawAlert(type = "alarm", datetime = referenceTime.plusHours(1).toString())
        )

        val result = AlertClassifier.classifyAlerts(
            chitId = "null-title",
            chitTitle = null,
            alerts = alerts,
            referenceTime = referenceTime
        )

        assertEquals(1, result.size)
        assertNull("Null title should be preserved as null", result[0].chitTitle)
        // But alertType and scheduledTime should still be present
        assertNotNull(result[0].alertType)
        assertNotNull(result[0].scheduledTime)
    }

    /**
     * Property 9: Alert type defaults to "reminder" when raw type is null.
     */
    @Test
    fun `Property 9 - null raw type defaults to reminder`() {
        val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
        val alerts = listOf(
            RawAlert(type = null, datetime = referenceTime.plusHours(1).toString())
        )

        val result = AlertClassifier.classifyAlerts(
            chitId = "default-type",
            chitTitle = "Default Type Test",
            alerts = alerts,
            referenceTime = referenceTime
        )

        assertEquals(1, result.size)
        assertEquals("reminder", result[0].alertType)
        assertEquals("Default Type Test", result[0].chitTitle)
        assertNotNull(result[0].scheduledTime)
    }

    /**
     * Property 9: chitId is correctly propagated (needed for navigation on tap).
     */
    @Test
    fun `Property 9 - chitId is correctly propagated for navigation`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
            val chitId = "unique-chit-id-$seed"
            val alertCount = r.nextInt(5) + 1
            val alerts = generateAlerts(seed, alertCount, referenceTime)

            val result = AlertClassifier.classifyAlerts(
                chitId = chitId,
                chitTitle = "Title $seed",
                alerts = alerts,
                referenceTime = referenceTime
            )

            for (classified in result) {
                assertEquals(
                    "Seed $seed: chitId should be propagated",
                    chitId,
                    classified.chitId
                )
            }
        }
    }

    /**
     * Property 9: Alerts with invalid datetime are excluded (they can't display a time).
     * Only alerts with all required display fields are included.
     */
    @Test
    fun `Property 9 - alerts without valid datetime are excluded from display`() {
        val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
        val alerts = listOf(
            RawAlert(type = "alarm", datetime = null),
            RawAlert(type = "reminder", datetime = ""),
            RawAlert(type = "timer", datetime = "invalid-date"),
            RawAlert(type = "alarm", datetime = referenceTime.plusHours(2).toString())
        )

        val result = AlertClassifier.classifyAlerts(
            chitId = "display-test",
            chitTitle = "Display Test",
            alerts = alerts,
            referenceTime = referenceTime
        )

        // Only the valid alert should be included
        assertEquals("Only alerts with valid datetime should be displayable", 1, result.size)
        assertEquals("alarm", result[0].alertType)
        assertEquals("Display Test", result[0].chitTitle)
        assertEquals(referenceTime.plusHours(2), result[0].scheduledTime)
    }

    /**
     * Property 9: Multiple alerts from the same chit all carry the same title and chitId.
     */
    @Test
    fun `Property 9 - multiple alerts from same chit share title and chitId`() {
        val referenceTime = LocalDateTime.of(2025, 6, 15, 12, 0, 0)
        val chitId = "multi-alert-chit"
        val chitTitle = "Multi-Alert Chit"
        val alerts = listOf(
            RawAlert(type = "alarm", datetime = referenceTime.plusHours(1).toString()),
            RawAlert(type = "reminder", datetime = referenceTime.plusHours(2).toString()),
            RawAlert(type = "timer", datetime = referenceTime.minusHours(1).toString())
        )

        val result = AlertClassifier.classifyAlerts(
            chitId = chitId,
            chitTitle = chitTitle,
            alerts = alerts,
            referenceTime = referenceTime
        )

        assertEquals(3, result.size)
        for (classified in result) {
            assertEquals(chitId, classified.chitId)
            assertEquals(chitTitle, classified.chitTitle)
            assertNotNull(classified.alertType)
            assertNotNull(classified.scheduledTime)
        }

        // Verify different types are preserved
        val types = result.map { it.alertType }.toSet()
        assertEquals("All three alert types should be present", 3, types.size)
    }
}
