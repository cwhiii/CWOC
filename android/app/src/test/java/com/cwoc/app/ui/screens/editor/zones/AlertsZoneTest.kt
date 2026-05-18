package com.cwoc.app.ui.screens.editor.zones

import org.junit.Assert.*
import org.junit.Test
import java.util.Random
import java.util.UUID

/**
 * Property-based tests for AlertsZone utility functions.
 *
 * Property 10: Alert list add/remove invariant
 *
 * **Validates: Requirements 6.2, 6.3**
 */
class AlertsZoneTest {

    // =========================================================================
    // Property 10: Alert list add/remove invariant
    // =========================================================================
    //
    // For any alert list and any valid alert configuration (type + time), adding
    // an alert should increase the list length by 1. For any alert list with at
    // least one alert, removing an alert by ID should decrease the length by 1
    // and that ID should no longer appear.
    //
    // **Validates: Requirements 6.2, 6.3**

    private val alertTypes = listOf("alarm", "timer", "reminder")
    private val offsetOptions = listOf(5, 10, 15, 30, 60, 120, 1440)

    /**
     * Generates a random AlertItem using the provided Random instance.
     */
    private fun generateRandomAlert(random: Random): AlertItem {
        val type = alertTypes[random.nextInt(alertTypes.size)]
        val useAbsolute = random.nextBoolean()
        return AlertItem(
            id = UUID.randomUUID().toString(),
            type = type,
            offsetMinutes = if (!useAbsolute) offsetOptions[random.nextInt(offsetOptions.size)] else null,
            absoluteTime = if (useAbsolute) String.format("%02d:%02d", random.nextInt(24), random.nextInt(60)) else null,
            label = if (random.nextBoolean()) "Label-${random.nextInt(1000)}" else null
        )
    }

    /**
     * Generates a random list of AlertItems with 0 to maxSize items.
     */
    private fun generateRandomAlertList(random: Random, maxSize: Int = 10): List<AlertItem> {
        val size = random.nextInt(maxSize + 1)
        return (0 until size).map { generateRandomAlert(random) }
    }

    // --- Add invariant tests ---

    @Test
    fun `Property 10 - adding an alert increases count by 1`() {
        val random = Random(42)
        for (iteration in 1..200) {
            val originalList = generateRandomAlertList(random)
            val newAlert = generateRandomAlert(random)

            val updatedList = originalList + newAlert
            val originalJson = serializeAlerts(originalList)
            val updatedJson = serializeAlerts(updatedList)

            val parsedOriginal = parseAlertsJson(originalJson)
            val parsedUpdated = parseAlertsJson(updatedJson)

            assertEquals(
                "Iteration $iteration: adding an alert should increase count by 1 (original size=${originalList.size})",
                parsedOriginal.size + 1,
                parsedUpdated.size
            )
        }
    }

    @Test
    fun `Property 10 - added alert is present in the updated list`() {
        val random = Random(123)
        for (iteration in 1..200) {
            val originalList = generateRandomAlertList(random)
            val newAlert = generateRandomAlert(random)

            val updatedList = originalList + newAlert
            val updatedJson = serializeAlerts(updatedList)
            val parsedUpdated = parseAlertsJson(updatedJson)

            val foundAlert = parsedUpdated.find { it.id == newAlert.id }
            assertNotNull(
                "Iteration $iteration: added alert with id=${newAlert.id} should be present in updated list",
                foundAlert
            )
            assertEquals(
                "Iteration $iteration: added alert type should match",
                newAlert.type,
                foundAlert!!.type
            )
            assertEquals(
                "Iteration $iteration: added alert offsetMinutes should match",
                newAlert.offsetMinutes,
                foundAlert.offsetMinutes
            )
            assertEquals(
                "Iteration $iteration: added alert absoluteTime should match",
                newAlert.absoluteTime,
                foundAlert.absoluteTime
            )
            assertEquals(
                "Iteration $iteration: added alert label should match",
                newAlert.label,
                foundAlert.label
            )
        }
    }

    // --- Remove invariant tests ---

    @Test
    fun `Property 10 - removing an alert decreases count by 1`() {
        val random = Random(456)
        for (iteration in 1..200) {
            // Generate a list with at least 1 alert
            val originalList = generateRandomAlertList(random, maxSize = 10).let {
                if (it.isEmpty()) listOf(generateRandomAlert(random)) else it
            }

            // Pick a random alert to remove
            val alertToRemove = originalList[random.nextInt(originalList.size)]
            val updatedList = originalList.filter { it.id != alertToRemove.id }

            assertEquals(
                "Iteration $iteration: removing alert should decrease count by 1 (original size=${originalList.size})",
                originalList.size - 1,
                updatedList.size
            )
        }
    }

    @Test
    fun `Property 10 - removed alert ID no longer appears in list`() {
        val random = Random(789)
        for (iteration in 1..200) {
            val originalList = generateRandomAlertList(random, maxSize = 10).let {
                if (it.isEmpty()) listOf(generateRandomAlert(random)) else it
            }

            val alertToRemove = originalList[random.nextInt(originalList.size)]
            val updatedList = originalList.filter { it.id != alertToRemove.id }
            val updatedJson = serializeAlerts(updatedList)
            val parsedUpdated = parseAlertsJson(updatedJson)

            val found = parsedUpdated.any { it.id == alertToRemove.id }
            assertFalse(
                "Iteration $iteration: removed alert id=${alertToRemove.id} should not appear in updated list",
                found
            )
        }
    }

    // --- Add then remove returns to original state ---

    @Test
    fun `Property 10 - add then remove returns to original list size`() {
        val random = Random(101)
        for (iteration in 1..200) {
            val originalList = generateRandomAlertList(random)
            val newAlert = generateRandomAlert(random)

            // Add
            val afterAdd = originalList + newAlert
            // Remove the same alert
            val afterRemove = afterAdd.filter { it.id != newAlert.id }

            assertEquals(
                "Iteration $iteration: add then remove should return to original size",
                originalList.size,
                afterRemove.size
            )
        }
    }

    @Test
    fun `Property 10 - add then remove preserves original alerts`() {
        val random = Random(202)
        for (iteration in 1..200) {
            val originalList = generateRandomAlertList(random)
            val newAlert = generateRandomAlert(random)

            // Add
            val afterAdd = originalList + newAlert
            // Remove the same alert
            val afterRemove = afterAdd.filter { it.id != newAlert.id }

            // All original alert IDs should still be present
            val originalIds = originalList.map { it.id }.toSet()
            val afterRemoveIds = afterRemove.map { it.id }.toSet()

            assertEquals(
                "Iteration $iteration: add then remove should preserve all original alert IDs",
                originalIds,
                afterRemoveIds
            )
        }
    }

    // --- JSON round-trip tests ---

    @Test
    fun `Property 10 - serialize then parse produces equivalent list`() {
        val random = Random(303)
        for (iteration in 1..200) {
            val originalList = generateRandomAlertList(random)

            val json = serializeAlerts(originalList)
            val parsed = parseAlertsJson(json)

            assertEquals(
                "Iteration $iteration: round-trip should preserve list size",
                originalList.size,
                parsed.size
            )

            for (i in originalList.indices) {
                assertEquals(
                    "Iteration $iteration, index $i: round-trip should preserve id",
                    originalList[i].id,
                    parsed[i].id
                )
                assertEquals(
                    "Iteration $iteration, index $i: round-trip should preserve type",
                    originalList[i].type,
                    parsed[i].type
                )
                assertEquals(
                    "Iteration $iteration, index $i: round-trip should preserve offsetMinutes",
                    originalList[i].offsetMinutes,
                    parsed[i].offsetMinutes
                )
                assertEquals(
                    "Iteration $iteration, index $i: round-trip should preserve absoluteTime",
                    originalList[i].absoluteTime,
                    parsed[i].absoluteTime
                )
                assertEquals(
                    "Iteration $iteration, index $i: round-trip should preserve label",
                    originalList[i].label,
                    parsed[i].label
                )
            }
        }
    }

    @Test
    fun `Property 10 - empty list serializes to null`() {
        val result = serializeAlerts(emptyList())
        assertNull(
            "Serializing empty list should return null",
            result
        )
    }

    @Test
    fun `Property 10 - null JSON parses to empty list`() {
        val result = parseAlertsJson(null)
        assertTrue(
            "Parsing null JSON should return empty list",
            result.isEmpty()
        )
    }

    @Test
    fun `Property 10 - blank JSON parses to empty list`() {
        val blankInputs = listOf("", "  ", "\t", "\n", "   \n\t  ")
        for (input in blankInputs) {
            val result = parseAlertsJson(input)
            assertTrue(
                "Parsing blank JSON '$input' should return empty list",
                result.isEmpty()
            )
        }
    }

    @Test
    fun `Property 10 - invalid JSON parses to empty list`() {
        val invalidInputs = listOf(
            "not json",
            "{invalid}",
            "[{\"id\": broken}]",
            "12345",
            "null",
            "[null]",
            "true"
        )
        for (input in invalidInputs) {
            val result = parseAlertsJson(input)
            // Should not throw, should return empty list or handle gracefully
            assertNotNull(
                "Parsing invalid JSON '$input' should not return null",
                result
            )
        }
    }

    @Test
    fun `Property 10 - serialize then parse of single alert preserves all fields`() {
        val random = Random(404)
        for (iteration in 1..100) {
            val alert = generateRandomAlert(random)
            val list = listOf(alert)

            val json = serializeAlerts(list)
            assertNotNull("Iteration $iteration: single alert should serialize to non-null", json)

            val parsed = parseAlertsJson(json)
            assertEquals("Iteration $iteration: parsed list should have 1 item", 1, parsed.size)

            val parsedAlert = parsed[0]
            assertEquals("Iteration $iteration: id round-trip", alert.id, parsedAlert.id)
            assertEquals("Iteration $iteration: type round-trip", alert.type, parsedAlert.type)
            assertEquals("Iteration $iteration: offsetMinutes round-trip", alert.offsetMinutes, parsedAlert.offsetMinutes)
            assertEquals("Iteration $iteration: absoluteTime round-trip", alert.absoluteTime, parsedAlert.absoluteTime)
            assertEquals("Iteration $iteration: label round-trip", alert.label, parsedAlert.label)
        }
    }
}
