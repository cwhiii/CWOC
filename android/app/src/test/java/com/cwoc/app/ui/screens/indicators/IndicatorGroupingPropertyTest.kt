package com.cwoc.app.ui.screens.indicators

import com.cwoc.app.domain.chart.ChartDataPoint
import com.cwoc.app.domain.chart.ChartDataTransformer
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

/**
 * Property-based tests for indicator grouping.
 *
 * Property 10: Indicator grouping produces one chart per type
 *
 * For any set of ChitEntity records with health_data, the Indicators_View SHALL produce
 * exactly one chart for each distinct indicator key present across all records.
 *
 * **Validates: Requirements 4.2**
 */
class IndicatorGroupingPropertyTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val indicatorTypes = listOf("weight", "blood_pressure", "heart_rate", "steps", "sleep_hours", "temperature")

    /**
     * Generates a health data JSON string with random indicator entries.
     */
    private fun generateHealthDataJson(seed: Int, entryCount: Int): String {
        val r = java.util.Random(seed.toLong())
        val baseDate = LocalDate.of(2025, 1, 1)
        val entries = (0 until entryCount).map { i ->
            val type = indicatorTypes[r.nextInt(indicatorTypes.size)]
            val value = 50.0 + r.nextDouble() * 150.0
            val date = baseDate.plusDays(r.nextInt(90).toLong())
            """{"type":"$type","value":$value,"date":"$date"}"""
        }
        return "[${entries.joinToString(",")}]"
    }

    /**
     * Generates a list of ChartDataPoints with known types for testing grouping.
     */
    private fun generateDataPoints(seed: Int, count: Int): List<ChartDataPoint> {
        val r = java.util.Random(seed.toLong())
        val baseDate = LocalDate.of(2025, 1, 1)
        return (0 until count).map { i ->
            ChartDataPoint(
                date = baseDate.plusDays(r.nextInt(90).toLong()),
                value = 50f + r.nextFloat() * 150f,
                label = indicatorTypes[r.nextInt(indicatorTypes.size)]
            )
        }
    }

    // =========================================================================
    // Property 10: Indicator grouping produces one chart per type
    // =========================================================================

    /**
     * Property 10: groupByType produces exactly one entry per distinct indicator type.
     */
    @Test
    fun `Property 10 - groupByType produces one group per distinct indicator type`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val pointCount = r.nextInt(30) + 5
            val points = generateDataPoints(seed, pointCount)

            val grouped = ChartDataTransformer.groupByType(points)

            // The number of groups should equal the number of distinct labels
            val distinctTypes = points.map { it.label ?: "unknown" }.distinct()
            assertEquals(
                "Seed $seed: group count should equal distinct type count",
                distinctTypes.size,
                grouped.size
            )

            // Every distinct type should have a group
            for (type in distinctTypes) {
                assertTrue(
                    "Seed $seed: grouped should contain key '$type'",
                    grouped.containsKey(type)
                )
            }
        }
    }

    /**
     * Property 10: Every data point appears in exactly one group (no loss, no duplication).
     */
    @Test
    fun `Property 10 - groupByType preserves all data points without duplication`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val pointCount = r.nextInt(30) + 5
            val points = generateDataPoints(seed, pointCount)

            val grouped = ChartDataTransformer.groupByType(points)

            // Total points across all groups should equal input count
            val totalGrouped = grouped.values.sumOf { it.size }
            assertEquals(
                "Seed $seed: total grouped points should equal input count",
                points.size,
                totalGrouped
            )
        }
    }

    /**
     * Property 10: Each point is placed in the group matching its label.
     */
    @Test
    fun `Property 10 - each point is in the group matching its label`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val pointCount = r.nextInt(20) + 5
            val points = generateDataPoints(seed, pointCount)

            val grouped = ChartDataTransformer.groupByType(points)

            for ((type, groupPoints) in grouped) {
                for (point in groupPoints) {
                    val expectedLabel = point.label ?: "unknown"
                    assertEquals(
                        "Seed $seed: point with label '${point.label}' should be in group '$type'",
                        type,
                        expectedLabel
                    )
                }
            }
        }
    }

    /**
     * Property 10: parseHealthData correctly extracts indicator types from JSON.
     */
    @Test
    fun `Property 10 - parseHealthData extracts correct types from JSON`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val entryCount = r.nextInt(10) + 1
            val json = generateHealthDataJson(seed, entryCount)

            val points = ChartDataTransformer.parseHealthData(json)

            // All parsed points should have a label that's one of the known types
            for (point in points) {
                assertNotNull(
                    "Seed $seed: parsed point should have a label",
                    point.label
                )
                assertTrue(
                    "Seed $seed: label '${point.label}' should be a known indicator type",
                    point.label in indicatorTypes
                )
            }
        }
    }

    /**
     * Property 10: Grouping with a single type produces exactly one group.
     */
    @Test
    fun `Property 10 - single indicator type produces one group`() {
        val baseDate = LocalDate.of(2025, 3, 1)
        val points = (1..10).map { i ->
            ChartDataPoint(
                date = baseDate.plusDays(i.toLong()),
                value = 70f + i.toFloat(),
                label = "weight"
            )
        }

        val grouped = ChartDataTransformer.groupByType(points)

        assertEquals("Single type should produce one group", 1, grouped.size)
        assertTrue("Group key should be 'weight'", grouped.containsKey("weight"))
        assertEquals("Group should contain all 10 points", 10, grouped["weight"]!!.size)
    }

    /**
     * Property 10: Grouping with all distinct types produces N groups for N points.
     */
    @Test
    fun `Property 10 - all distinct types produce one group per point`() {
        val baseDate = LocalDate.of(2025, 3, 1)
        val points = indicatorTypes.mapIndexed { i, type ->
            ChartDataPoint(
                date = baseDate.plusDays(i.toLong()),
                value = 50f + i * 10f,
                label = type
            )
        }

        val grouped = ChartDataTransformer.groupByType(points)

        assertEquals(
            "Each unique type should have its own group",
            indicatorTypes.size,
            grouped.size
        )
        for (type in indicatorTypes) {
            assertTrue("Group '$type' should exist", grouped.containsKey(type))
            assertEquals("Group '$type' should have exactly 1 point", 1, grouped[type]!!.size)
        }
    }

    /**
     * Property 10: Empty input produces empty grouping.
     */
    @Test
    fun `Property 10 - empty input produces empty grouping`() {
        val grouped = ChartDataTransformer.groupByType(emptyList())
        assertTrue("Empty input should produce empty grouping", grouped.isEmpty())
    }

    /**
     * Property 10: Points with null label are grouped under "unknown".
     */
    @Test
    fun `Property 10 - null label points are grouped under unknown`() {
        val baseDate = LocalDate.of(2025, 3, 1)
        val points = listOf(
            ChartDataPoint(date = baseDate, value = 42f, label = null),
            ChartDataPoint(date = baseDate.plusDays(1), value = 43f, label = null),
            ChartDataPoint(date = baseDate.plusDays(2), value = 44f, label = "weight")
        )

        val grouped = ChartDataTransformer.groupByType(points)

        assertEquals("Should have 2 groups (unknown + weight)", 2, grouped.size)
        assertTrue("Should have 'unknown' group", grouped.containsKey("unknown"))
        assertTrue("Should have 'weight' group", grouped.containsKey("weight"))
        assertEquals("'unknown' group should have 2 points", 2, grouped["unknown"]!!.size)
        assertEquals("'weight' group should have 1 point", 1, grouped["weight"]!!.size)
    }

    /**
     * Property 10: parseHealthData with null/empty/invalid JSON returns empty list.
     */
    @Test
    fun `Property 10 - parseHealthData handles null and invalid JSON gracefully`() {
        assertTrue("null should return empty", ChartDataTransformer.parseHealthData(null).isEmpty())
        assertTrue("empty string should return empty", ChartDataTransformer.parseHealthData("").isEmpty())
        assertTrue("'[]' should return empty", ChartDataTransformer.parseHealthData("[]").isEmpty())
        assertTrue("'null' should return empty", ChartDataTransformer.parseHealthData("null").isEmpty())
        assertTrue("invalid JSON should return empty", ChartDataTransformer.parseHealthData("not json").isEmpty())
    }

    /**
     * Property 10: The IndicatorChart model correctly pairs type with filtered points.
     * Simulates what the ViewModel does: parse → group → create IndicatorChart per type.
     */
    @Test
    fun `Property 10 - IndicatorChart creation produces one chart per distinct type`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val entryCount = r.nextInt(15) + 3
            val json = generateHealthDataJson(seed, entryCount)

            val allPoints = ChartDataTransformer.parseHealthData(json)
            val grouped = ChartDataTransformer.groupByType(allPoints)

            val charts = grouped.map { (type, points) ->
                IndicatorChart(type = type, points = points)
            }

            // One chart per distinct type
            val distinctTypes = allPoints.map { it.label ?: "unknown" }.distinct()
            assertEquals(
                "Seed $seed: should produce one chart per distinct indicator type",
                distinctTypes.size,
                charts.size
            )

            // Each chart's type matches its key
            for (chart in charts) {
                assertTrue(
                    "Seed $seed: chart type '${chart.type}' should be in distinct types",
                    chart.type in distinctTypes
                )
                // All points in the chart should have matching label
                for (point in chart.points) {
                    assertEquals(
                        "Seed $seed: point label should match chart type",
                        chart.type,
                        point.label ?: "unknown"
                    )
                }
            }
        }
    }
}
