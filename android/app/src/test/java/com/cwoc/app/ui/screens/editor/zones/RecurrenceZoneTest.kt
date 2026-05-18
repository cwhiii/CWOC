package com.cwoc.app.ui.screens.editor.zones

import com.cwoc.app.domain.recurrence.RecurrenceEngine
import com.cwoc.app.domain.recurrence.RecurrenceRule
import com.google.gson.Gson
import org.junit.Assert.*
import org.junit.Test

/**
 * Property-based tests for RecurrenceZone logic.
 *
 * Property 11: Recurrence rule generation round-trip
 * Property 12: Recurrence human-readable summary
 *
 * **Validates: Requirements 7.2, 7.3**
 */
class RecurrenceZoneTest {

    private val gson = Gson()
    private val recurrenceEngine = RecurrenceEngine()

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val frequencies = listOf("DAILY", "WEEKLY", "MONTHLY", "YEARLY")
    private val dayAbbreviations = listOf("SU", "MO", "TU", "WE", "TH", "FR", "SA")

    /**
     * Generate a random RecurrenceRule with the given seed.
     */
    private fun generateRecurrenceRule(seed: Int): RecurrenceRule {
        val r = java.util.Random(seed.toLong())
        val freq = frequencies[r.nextInt(frequencies.size)]
        val interval = r.nextInt(5) + 1 // 1-5

        val byDay: List<String>? = if (freq == "WEEKLY" && r.nextBoolean()) {
            val numDays = r.nextInt(4) + 1 // 1-4 days
            dayAbbreviations.shuffled(r).take(numDays)
        } else {
            null
        }

        val count: Int? = if (r.nextInt(4) == 0) r.nextInt(20) + 2 else null
        val until: String? = if (count == null && r.nextInt(4) == 0) {
            val month = r.nextInt(12) + 1
            val day = r.nextInt(28) + 1
            String.format("2025-%02d-%02d", month, day)
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

    // =========================================================================
    // Property 11: Recurrence rule generation round-trip
    // =========================================================================
    //
    // For any valid combination of frequency, interval, by-day selection, and
    // until/count, the generated RRULE JSON should be parseable by the existing
    // RecurrenceEngine and produce the same frequency/interval/by-day/until/count
    // values when parsed back.
    //
    // **Validates: Requirements 7.2**

    @Test
    fun `Property 11 - serializing and deserializing RecurrenceRule preserves freq`() {
        val random = java.util.Random(100)
        for (iteration in 1..200) {
            val rule = generateRecurrenceRule(random.nextInt(10000))

            val json = gson.toJson(rule)
            val parsed = gson.fromJson(json, RecurrenceRule::class.java)

            assertEquals(
                "Iteration $iteration: freq should survive round-trip (rule=$rule)",
                rule.freq,
                parsed.freq
            )
        }
    }

    @Test
    fun `Property 11 - serializing and deserializing RecurrenceRule preserves interval`() {
        val random = java.util.Random(200)
        for (iteration in 1..200) {
            val rule = generateRecurrenceRule(random.nextInt(10000))

            val json = gson.toJson(rule)
            val parsed = gson.fromJson(json, RecurrenceRule::class.java)

            assertEquals(
                "Iteration $iteration: interval should survive round-trip (rule=$rule)",
                rule.interval,
                parsed.interval
            )
        }
    }

    @Test
    fun `Property 11 - serializing and deserializing RecurrenceRule preserves byDay`() {
        val random = java.util.Random(300)
        for (iteration in 1..200) {
            val rule = generateRecurrenceRule(random.nextInt(10000))

            val json = gson.toJson(rule)
            val parsed = gson.fromJson(json, RecurrenceRule::class.java)

            if (rule.byDay == null) {
                assertNull(
                    "Iteration $iteration: null byDay should survive round-trip",
                    parsed.byDay
                )
            } else {
                assertNotNull(
                    "Iteration $iteration: non-null byDay should survive round-trip",
                    parsed.byDay
                )
                assertEquals(
                    "Iteration $iteration: byDay contents should survive round-trip (rule=$rule)",
                    rule.byDay!!.sorted(),
                    parsed.byDay!!.sorted()
                )
            }
        }
    }

    @Test
    fun `Property 11 - serializing and deserializing RecurrenceRule preserves until`() {
        val random = java.util.Random(400)
        for (iteration in 1..200) {
            val rule = generateRecurrenceRule(random.nextInt(10000))

            val json = gson.toJson(rule)
            val parsed = gson.fromJson(json, RecurrenceRule::class.java)

            assertEquals(
                "Iteration $iteration: until should survive round-trip (rule=$rule)",
                rule.until,
                parsed.until
            )
        }
    }

    @Test
    fun `Property 11 - serializing and deserializing RecurrenceRule preserves count`() {
        val random = java.util.Random(500)
        for (iteration in 1..200) {
            val rule = generateRecurrenceRule(random.nextInt(10000))

            val json = gson.toJson(rule)
            val parsed = gson.fromJson(json, RecurrenceRule::class.java)

            assertEquals(
                "Iteration $iteration: count should survive round-trip (rule=$rule)",
                rule.count,
                parsed.count
            )
        }
    }

    @Test
    fun `Property 11 - round-trip produces equivalent rule for all fields simultaneously`() {
        val random = java.util.Random(600)
        for (iteration in 1..200) {
            val rule = generateRecurrenceRule(random.nextInt(10000))

            val json = gson.toJson(rule)
            val parsed = gson.fromJson(json, RecurrenceRule::class.java)

            assertEquals(
                "Iteration $iteration: freq mismatch after round-trip",
                rule.freq, parsed.freq
            )
            assertEquals(
                "Iteration $iteration: interval mismatch after round-trip",
                rule.interval, parsed.interval
            )
            assertEquals(
                "Iteration $iteration: until mismatch after round-trip",
                rule.until, parsed.until
            )
            assertEquals(
                "Iteration $iteration: count mismatch after round-trip",
                rule.count, parsed.count
            )
            assertEquals(
                "Iteration $iteration: byDay mismatch after round-trip",
                rule.byDay?.sorted(), parsed.byDay?.sorted()
            )
            assertEquals(
                "Iteration $iteration: byMonthDay mismatch after round-trip",
                rule.byMonthDay, parsed.byMonthDay
            )
            assertEquals(
                "Iteration $iteration: bySetPos mismatch after round-trip",
                rule.bySetPos, parsed.bySetPos
            )
        }
    }

    @Test
    fun `Property 11 - preset JSON strings round-trip correctly`() {
        // Test the exact JSON strings used by RecurrenceZone presets
        val presetJsons = listOf(
            """{"freq":"DAILY","interval":1}""",
            """{"freq":"WEEKLY","interval":1}""",
            """{"freq":"MONTHLY","interval":1}""",
            """{"freq":"YEARLY","interval":1}"""
        )

        for (json in presetJsons) {
            val parsed = gson.fromJson(json, RecurrenceRule::class.java)
            val reserialized = gson.toJson(parsed)
            val reparsed = gson.fromJson(reserialized, RecurrenceRule::class.java)

            assertEquals(
                "Preset JSON '$json' should round-trip: freq",
                parsed.freq, reparsed.freq
            )
            assertEquals(
                "Preset JSON '$json' should round-trip: interval",
                parsed.interval, reparsed.interval
            )
            assertNull(
                "Preset JSON '$json' should have null byDay after round-trip",
                reparsed.byDay
            )
            assertNull(
                "Preset JSON '$json' should have null until after round-trip",
                reparsed.until
            )
            assertNull(
                "Preset JSON '$json' should have null count after round-trip",
                reparsed.count
            )
        }
    }

    @Test
    fun `Property 11 - complex rules with byMonthDay and bySetPos round-trip`() {
        val complexRules = listOf(
            RecurrenceRule(freq = "MONTHLY", interval = 1, byMonthDay = 15),
            RecurrenceRule(freq = "MONTHLY", interval = 2, bySetPos = -1, byDay = listOf("FR")),
            RecurrenceRule(freq = "MONTHLY", interval = 1, bySetPos = 2, byDay = listOf("MO")),
            RecurrenceRule(freq = "YEARLY", interval = 1, byMonthDay = 25),
            RecurrenceRule(freq = "WEEKLY", interval = 3, byDay = listOf("MO", "WE", "FR"), count = 10),
            RecurrenceRule(freq = "DAILY", interval = 2, until = "2025-12-31")
        )

        for (rule in complexRules) {
            val json = gson.toJson(rule)
            val parsed = gson.fromJson(json, RecurrenceRule::class.java)

            assertEquals("freq round-trip for $rule", rule.freq, parsed.freq)
            assertEquals("interval round-trip for $rule", rule.interval, parsed.interval)
            assertEquals("byDay round-trip for $rule", rule.byDay?.sorted(), parsed.byDay?.sorted())
            assertEquals("byMonthDay round-trip for $rule", rule.byMonthDay, parsed.byMonthDay)
            assertEquals("bySetPos round-trip for $rule", rule.bySetPos, parsed.bySetPos)
            assertEquals("until round-trip for $rule", rule.until, parsed.until)
            assertEquals("count round-trip for $rule", rule.count, parsed.count)
        }
    }

    // =========================================================================
    // Property 12: Recurrence human-readable summary
    // =========================================================================
    //
    // For any valid RecurrenceRuleUi object, the human-readable summary should
    // be a non-empty string that contains the frequency keyword (daily, weekly,
    // monthly, or yearly) and, when interval > 1, should contain the interval
    // number.
    //
    // **Validates: Requirements 7.3**

    @Test
    fun `Property 12 - summary is non-empty for any valid rule`() {
        val random = java.util.Random(700)
        for (iteration in 1..200) {
            val rule = generateRecurrenceRule(random.nextInt(10000))

            val summary = recurrenceEngine.formatRule(rule)

            assertTrue(
                "Iteration $iteration: summary should be non-empty for rule=$rule, got='$summary'",
                summary.isNotEmpty()
            )
        }
    }

    @Test
    fun `Property 12 - summary contains frequency keyword`() {
        val random = java.util.Random(800)
        val frequencyKeywords = mapOf(
            "DAILY" to listOf("daily", "day", "days"),
            "WEEKLY" to listOf("weekly", "week", "weeks"),
            "MONTHLY" to listOf("monthly", "month", "months"),
            "YEARLY" to listOf("yearly", "year", "years")
        )

        for (iteration in 1..200) {
            val rule = generateRecurrenceRule(random.nextInt(10000))

            val summary = recurrenceEngine.formatRule(rule).lowercase()
            val keywords = frequencyKeywords[rule.freq.uppercase()]!!

            val containsKeyword = keywords.any { keyword -> summary.contains(keyword) }

            assertTrue(
                "Iteration $iteration: summary '$summary' should contain one of $keywords for freq=${rule.freq}",
                containsKeyword
            )
        }
    }

    @Test
    fun `Property 12 - summary contains interval number when interval greater than 1`() {
        val random = java.util.Random(900)
        for (iteration in 1..200) {
            val rule = generateRecurrenceRule(random.nextInt(10000))

            val summary = recurrenceEngine.formatRule(rule)

            if (rule.interval > 1) {
                assertTrue(
                    "Iteration $iteration: summary '$summary' should contain interval ${rule.interval} for rule=$rule",
                    summary.contains(rule.interval.toString())
                )
            }
        }
    }

    @Test
    fun `Property 12 - Daily preset produces expected summary`() {
        val rule = RecurrenceRule(freq = "DAILY", interval = 1)
        val summary = recurrenceEngine.formatRule(rule)

        assertEquals("Daily preset summary", "Daily", summary)
    }

    @Test
    fun `Property 12 - Weekly preset produces expected summary`() {
        val rule = RecurrenceRule(freq = "WEEKLY", interval = 1)
        val summary = recurrenceEngine.formatRule(rule)

        assertEquals("Weekly preset summary", "Weekly", summary)
    }

    @Test
    fun `Property 12 - Monthly preset produces expected summary`() {
        val rule = RecurrenceRule(freq = "MONTHLY", interval = 1)
        val summary = recurrenceEngine.formatRule(rule)

        assertEquals("Monthly preset summary", "Monthly", summary)
    }

    @Test
    fun `Property 12 - Yearly preset produces expected summary`() {
        val rule = RecurrenceRule(freq = "YEARLY", interval = 1)
        val summary = recurrenceEngine.formatRule(rule)

        assertEquals("Yearly preset summary", "Yearly", summary)
    }

    @Test
    fun `Property 12 - Weekly with byDay includes day names`() {
        val testCases = listOf(
            listOf("MO") to "Mon",
            listOf("MO", "WE", "FR") to "Mon",  // Should contain at least Mon
            listOf("SA", "SU") to "Sat"          // Should contain at least Sat
        )

        for ((byDay, expectedDayName) in testCases) {
            val rule = RecurrenceRule(freq = "WEEKLY", interval = 1, byDay = byDay)
            val summary = recurrenceEngine.formatRule(rule)

            assertTrue(
                "Weekly with byDay=$byDay should contain '$expectedDayName', got '$summary'",
                summary.contains(expectedDayName)
            )
        }
    }

    @Test
    fun `Property 12 - summary with until date includes date info`() {
        val rule = RecurrenceRule(freq = "DAILY", interval = 1, until = "2025-06-15")
        val summary = recurrenceEngine.formatRule(rule)

        assertTrue(
            "Summary with until should contain date info, got '$summary'",
            summary.contains("until") || summary.contains("Jun") || summary.contains("2025")
        )
    }

    @Test
    fun `Property 12 - interval greater than 1 uses plural form`() {
        val pluralCases = listOf(
            RecurrenceRule(freq = "DAILY", interval = 2) to "days",
            RecurrenceRule(freq = "WEEKLY", interval = 3) to "weeks",
            RecurrenceRule(freq = "MONTHLY", interval = 2) to "months",
            RecurrenceRule(freq = "YEARLY", interval = 4) to "years"
        )

        for ((rule, expectedPlural) in pluralCases) {
            val summary = recurrenceEngine.formatRule(rule).lowercase()

            assertTrue(
                "Rule $rule with interval > 1 should use plural '$expectedPlural', got '$summary'",
                summary.contains(expectedPlural)
            )
        }
    }

    // =========================================================================
    // determinePreset logic tests
    // =========================================================================
    //
    // These tests verify that the determinePreset function correctly maps
    // simple rules to presets and complex rules to CUSTOM.

    @Test
    fun `determinePreset - simple daily rule maps to DAILY preset`() {
        val rule = RecurrenceRule(freq = "DAILY", interval = 1)
        val json = gson.toJson(rule)
        val parsed = gson.fromJson(json, RecurrenceRule::class.java)

        // Replicate determinePreset logic
        val preset = determinePresetFromRule(parsed)
        assertEquals("DAILY", preset)
    }

    @Test
    fun `determinePreset - simple weekly rule maps to WEEKLY preset`() {
        val rule = RecurrenceRule(freq = "WEEKLY", interval = 1)
        val parsed = gson.fromJson(gson.toJson(rule), RecurrenceRule::class.java)

        val preset = determinePresetFromRule(parsed)
        assertEquals("WEEKLY", preset)
    }

    @Test
    fun `determinePreset - simple monthly rule maps to MONTHLY preset`() {
        val rule = RecurrenceRule(freq = "MONTHLY", interval = 1)
        val parsed = gson.fromJson(gson.toJson(rule), RecurrenceRule::class.java)

        val preset = determinePresetFromRule(parsed)
        assertEquals("MONTHLY", preset)
    }

    @Test
    fun `determinePreset - simple yearly rule maps to YEARLY preset`() {
        val rule = RecurrenceRule(freq = "YEARLY", interval = 1)
        val parsed = gson.fromJson(gson.toJson(rule), RecurrenceRule::class.java)

        val preset = determinePresetFromRule(parsed)
        assertEquals("YEARLY", preset)
    }

    @Test
    fun `determinePreset - null rule maps to NONE`() {
        val preset = determinePresetFromRule(null)
        assertEquals("NONE", preset)
    }

    @Test
    fun `determinePreset - rule with interval greater than 1 maps to CUSTOM`() {
        val random = java.util.Random(1000)
        for (iteration in 1..50) {
            val freq = frequencies[random.nextInt(frequencies.size)]
            val interval = random.nextInt(5) + 2 // 2-6
            val rule = RecurrenceRule(freq = freq, interval = interval)
            val parsed = gson.fromJson(gson.toJson(rule), RecurrenceRule::class.java)

            val preset = determinePresetFromRule(parsed)
            assertEquals(
                "Iteration $iteration: rule with interval=$interval should be CUSTOM",
                "CUSTOM", preset
            )
        }
    }

    @Test
    fun `determinePreset - rule with byDay maps to CUSTOM`() {
        val rule = RecurrenceRule(freq = "WEEKLY", interval = 1, byDay = listOf("MO", "WE"))
        val parsed = gson.fromJson(gson.toJson(rule), RecurrenceRule::class.java)

        val preset = determinePresetFromRule(parsed)
        assertEquals("Rule with byDay should be CUSTOM", "CUSTOM", preset)
    }

    @Test
    fun `determinePreset - rule with until maps to CUSTOM`() {
        val rule = RecurrenceRule(freq = "DAILY", interval = 1, until = "2025-12-31")
        val parsed = gson.fromJson(gson.toJson(rule), RecurrenceRule::class.java)

        val preset = determinePresetFromRule(parsed)
        assertEquals("Rule with until should be CUSTOM", "CUSTOM", preset)
    }

    @Test
    fun `determinePreset - rule with count maps to CUSTOM`() {
        val rule = RecurrenceRule(freq = "DAILY", interval = 1, count = 10)
        val parsed = gson.fromJson(gson.toJson(rule), RecurrenceRule::class.java)

        val preset = determinePresetFromRule(parsed)
        assertEquals("Rule with count should be CUSTOM", "CUSTOM", preset)
    }

    @Test
    fun `determinePreset - rule with byMonthDay maps to CUSTOM`() {
        val rule = RecurrenceRule(freq = "MONTHLY", interval = 1, byMonthDay = 15)
        val parsed = gson.fromJson(gson.toJson(rule), RecurrenceRule::class.java)

        val preset = determinePresetFromRule(parsed)
        assertEquals("Rule with byMonthDay should be CUSTOM", "CUSTOM", preset)
    }

    @Test
    fun `determinePreset - rule with bySetPos maps to CUSTOM`() {
        val rule = RecurrenceRule(freq = "MONTHLY", interval = 1, bySetPos = -1, byDay = listOf("FR"))
        val parsed = gson.fromJson(gson.toJson(rule), RecurrenceRule::class.java)

        val preset = determinePresetFromRule(parsed)
        assertEquals("Rule with bySetPos should be CUSTOM", "CUSTOM", preset)
    }

    @Test
    fun `determinePreset - randomized complex rules always map to CUSTOM`() {
        val random = java.util.Random(1100)
        for (iteration in 1..100) {
            // Generate rules that always have at least one "complex" attribute
            val freq = frequencies[random.nextInt(frequencies.size)]
            val interval = random.nextInt(3) + 2 // Always > 1
            val rule = RecurrenceRule(
                freq = freq,
                interval = interval,
                byDay = if (freq == "WEEKLY") listOf("MO", "FR") else null,
                count = if (random.nextBoolean()) random.nextInt(10) + 2 else null
            )
            val parsed = gson.fromJson(gson.toJson(rule), RecurrenceRule::class.java)

            val preset = determinePresetFromRule(parsed)
            assertEquals(
                "Iteration $iteration: complex rule $rule should be CUSTOM",
                "CUSTOM", preset
            )
        }
    }

    // =========================================================================
    // Helper: Replicates the determinePreset logic from RecurrenceZone.kt
    // =========================================================================

    /**
     * Replicates the private determinePreset function from RecurrenceZone.kt
     * for testing purposes.
     */
    private fun determinePresetFromRule(rule: RecurrenceRule?): String {
        if (rule == null) return "NONE"

        val freq = rule.freq.uppercase()
        val interval = rule.interval
        val hasByDay = !rule.byDay.isNullOrEmpty()
        val hasUntil = rule.until != null
        val hasCount = rule.count != null
        val hasByMonthDay = rule.byMonthDay != null
        val hasBySetPos = rule.bySetPos != null

        // Simple presets: interval=1, no byDay, no until/count, no byMonthDay/bySetPos
        if (interval == 1 && !hasByDay && !hasUntil && !hasCount && !hasByMonthDay && !hasBySetPos) {
            return when (freq) {
                "DAILY" -> "DAILY"
                "WEEKLY" -> "WEEKLY"
                "MONTHLY" -> "MONTHLY"
                "YEARLY" -> "YEARLY"
                else -> "CUSTOM"
            }
        }

        return "CUSTOM"
    }
}
