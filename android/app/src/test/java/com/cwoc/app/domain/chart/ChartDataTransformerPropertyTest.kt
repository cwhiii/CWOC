package com.cwoc.app.domain.chart

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

/**
 * Property-based tests for ChartDataTransformer.
 *
 * Property 11: Chart coordinate mapping preserves order
 * Property 12: Chart hit-test returns nearest point
 * Property 13: Chart time range filter is correct
 *
 * **Validates: Requirements 4.4, 4.5, 4.6**
 */
class ChartDataTransformerPropertyTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val random = java.util.Random(42)

    /**
     * Generates a list of ChartDataPoints sorted by date within a date range.
     * Ensures dates are unique and sorted ascending.
     */
    private fun generateSortedDataPoints(seed: Int, count: Int, baseDate: LocalDate = LocalDate.of(2025, 1, 1)): List<ChartDataPoint> {
        val r = java.util.Random(seed.toLong())
        val dates = mutableSetOf<LocalDate>()
        while (dates.size < count) {
            dates.add(baseDate.plusDays(r.nextInt(365).toLong()))
        }
        return dates.sorted().map { date ->
            ChartDataPoint(
                date = date,
                value = r.nextFloat() * 200f - 50f, // range: -50 to 150
                label = "indicator_${r.nextInt(3)}"
            )
        }
    }

    /**
     * Generates a random list of ChartDataPoints (not necessarily sorted).
     */
    private fun generateRandomDataPoints(seed: Int, count: Int): List<ChartDataPoint> {
        val r = java.util.Random(seed.toLong())
        val baseDate = LocalDate.of(2025, 1, 1)
        return (1..count).map {
            ChartDataPoint(
                date = baseDate.plusDays(r.nextInt(365).toLong()),
                value = r.nextFloat() * 200f - 50f,
                label = "type_${r.nextInt(5)}"
            )
        }
    }

    // =========================================================================
    // Property 11: Chart coordinate mapping preserves order
    // =========================================================================
    //
    // For any list of ChartDataPoints sorted by date, mapToPixels SHALL produce
    // x-coordinates in strictly non-decreasing order.
    //
    // **Validates: Requirements 4.4**

    @Test
    fun `Property 11 - mapToPixels preserves temporal order in x-coordinates`() {
        for (seed in 1..100) {
            val count = (seed % 20) + 2 // 2 to 21 points
            val sortedPoints = generateSortedDataPoints(seed, count)

            val mapped = ChartDataTransformer.mapToPixels(
                points = sortedPoints,
                canvasWidth = 800f,
                canvasHeight = 400f,
                padding = 32f
            )

            assertEquals("Seed $seed: mapped count should equal input count", sortedPoints.size, mapped.size)

            // X-coordinates must be non-decreasing (preserves temporal order)
            for (i in 1 until mapped.size) {
                assertTrue(
                    "Seed $seed: x[$i] (${mapped[i].x}) should be >= x[${i - 1}] (${mapped[i - 1].x})",
                    mapped[i].x >= mapped[i - 1].x
                )
            }
        }
    }

    @Test
    fun `Property 11 - mapToPixels with single point places it at center x`() {
        val singlePoint = listOf(
            ChartDataPoint(date = LocalDate.of(2025, 6, 15), value = 42f)
        )

        val mapped = ChartDataTransformer.mapToPixels(
            points = singlePoint,
            canvasWidth = 800f,
            canvasHeight = 400f,
            padding = 32f
        )

        assertEquals(1, mapped.size)
        // Single point with dateRange=0 should be at x = padding + 0.5 * drawWidth
        val expectedX = 32f + 0.5f * (800f - 64f)
        assertEquals(expectedX, mapped[0].x, 0.01f)
    }

    @Test
    fun `Property 11 - mapToPixels with empty list returns empty`() {
        val mapped = ChartDataTransformer.mapToPixels(
            points = emptyList(),
            canvasWidth = 800f,
            canvasHeight = 400f
        )
        assertTrue(mapped.isEmpty())
    }

    @Test
    fun `Property 11 - mapToPixels x-coordinates stay within canvas bounds`() {
        for (seed in 1..50) {
            val count = (seed % 15) + 2
            val points = generateSortedDataPoints(seed, count)
            val canvasWidth = 600f + (seed * 10f)
            val padding = 32f

            val mapped = ChartDataTransformer.mapToPixels(
                points = points,
                canvasWidth = canvasWidth,
                canvasHeight = 400f,
                padding = padding
            )

            for (i in mapped.indices) {
                assertTrue(
                    "Seed $seed: x[$i] (${mapped[i].x}) should be >= padding ($padding)",
                    mapped[i].x >= padding - 0.01f
                )
                assertTrue(
                    "Seed $seed: x[$i] (${mapped[i].x}) should be <= canvasWidth - padding (${canvasWidth - padding})",
                    mapped[i].x <= canvasWidth - padding + 0.01f
                )
            }
        }
    }

    @Test
    fun `Property 11 - mapToPixels y-coordinates stay within canvas bounds`() {
        for (seed in 1..50) {
            val count = (seed % 15) + 2
            val points = generateSortedDataPoints(seed, count)
            val canvasHeight = 300f + (seed * 5f)
            val padding = 32f

            val mapped = ChartDataTransformer.mapToPixels(
                points = points,
                canvasWidth = 800f,
                canvasHeight = canvasHeight,
                padding = padding
            )

            for (i in mapped.indices) {
                assertTrue(
                    "Seed $seed: y[$i] (${mapped[i].y}) should be >= padding ($padding)",
                    mapped[i].y >= padding - 0.01f
                )
                assertTrue(
                    "Seed $seed: y[$i] (${mapped[i].y}) should be <= canvasHeight - padding (${canvasHeight - padding})",
                    mapped[i].y <= canvasHeight - padding + 0.01f
                )
            }
        }
    }

    // =========================================================================
    // Property 12: Chart hit-test returns nearest point
    // =========================================================================
    //
    // For any tap coordinate within tap radius of exactly one data point,
    // hitTest SHALL return that point. For taps outside all radii, it SHALL
    // return null.
    //
    // **Validates: Requirements 4.5**

    @Test
    fun `Property 12 - hitTest returns nearest point when tap is within radius`() {
        for (seed in 1..100) {
            val count = (seed % 10) + 3
            val points = generateSortedDataPoints(seed, count)

            val mapped = ChartDataTransformer.mapToPixels(
                points = points,
                canvasWidth = 1000f,
                canvasHeight = 500f,
                padding = 32f
            )

            if (mapped.isEmpty()) continue

            // Tap exactly on each point — should return that point
            val r = java.util.Random(seed.toLong() + 1000)
            val targetIdx = r.nextInt(mapped.size)
            val target = mapped[targetIdx]

            val result = ChartDataTransformer.hitTest(
                mappedPoints = mapped,
                tapX = target.x,
                tapY = target.y,
                maxDistance = 48f
            )

            assertNotNull("Seed $seed: tapping on point $targetIdx should hit", result)
            assertEquals(
                "Seed $seed: tapping on point $targetIdx should return that point's data",
                target.dataPoint,
                result!!.dataPoint
            )
        }
    }

    @Test
    fun `Property 12 - hitTest returns null when tap is far from all points`() {
        val points = listOf(
            ChartDataPoint(date = LocalDate.of(2025, 1, 1), value = 50f),
            ChartDataPoint(date = LocalDate.of(2025, 1, 10), value = 75f),
            ChartDataPoint(date = LocalDate.of(2025, 1, 20), value = 25f)
        )

        val mapped = ChartDataTransformer.mapToPixels(
            points = points,
            canvasWidth = 800f,
            canvasHeight = 400f,
            padding = 32f
        )

        // Tap very far away from all points
        val result = ChartDataTransformer.hitTest(
            mappedPoints = mapped,
            tapX = -1000f,
            tapY = -1000f,
            maxDistance = 48f
        )

        assertNull("Tap far from all points should return null", result)
    }

    @Test
    fun `Property 12 - hitTest returns null for empty point list`() {
        val result = ChartDataTransformer.hitTest(
            mappedPoints = emptyList(),
            tapX = 100f,
            tapY = 100f,
            maxDistance = 48f
        )
        assertNull("Empty point list should return null", result)
    }

    @Test
    fun `Property 12 - hitTest returns closest point when multiple are within radius`() {
        // Create points that are close together
        val points = listOf(
            ChartDataPoint(date = LocalDate.of(2025, 1, 1), value = 50f),
            ChartDataPoint(date = LocalDate.of(2025, 1, 2), value = 51f),
            ChartDataPoint(date = LocalDate.of(2025, 1, 3), value = 52f)
        )

        val mapped = ChartDataTransformer.mapToPixels(
            points = points,
            canvasWidth = 800f,
            canvasHeight = 400f,
            padding = 32f
        )

        // Tap exactly on the middle point
        val middlePoint = mapped[1]
        val result = ChartDataTransformer.hitTest(
            mappedPoints = mapped,
            tapX = middlePoint.x,
            tapY = middlePoint.y,
            maxDistance = 200f // large radius to include all
        )

        assertNotNull("Should find a point", result)
        assertEquals(
            "Should return the closest point (middle)",
            middlePoint.dataPoint,
            result!!.dataPoint
        )
    }

    @Test
    fun `Property 12 - hitTest respects maxDistance threshold`() {
        for (seed in 1..50) {
            val points = generateSortedDataPoints(seed, 5)

            val mapped = ChartDataTransformer.mapToPixels(
                points = points,
                canvasWidth = 800f,
                canvasHeight = 400f,
                padding = 32f
            )

            if (mapped.isEmpty()) continue

            val target = mapped[0]

            // Tap just barely outside maxDistance
            val maxDist = 10f
            val result = ChartDataTransformer.hitTest(
                mappedPoints = mapped,
                tapX = target.x + maxDist + 1f,
                tapY = target.y + maxDist + 1f,
                maxDistance = maxDist
            )

            // Distance is sqrt((maxDist+1)^2 + (maxDist+1)^2) = (maxDist+1)*sqrt(2) ≈ 15.56
            // which is > maxDist (10), so should be null IF no other point is closer
            // We can't guarantee null here because another point might be within range,
            // but we verify the logic is distance-based
            if (result != null) {
                // If a result is returned, verify it's actually within maxDistance
                val dx = result.x - (target.x + maxDist + 1f)
                val dy = result.y - (target.y + maxDist + 1f)
                val dist = kotlin.math.sqrt(dx * dx + dy * dy)
                assertTrue(
                    "Seed $seed: returned point should be within maxDistance ($dist <= $maxDist)",
                    dist <= maxDist
                )
            }
        }
    }

    // =========================================================================
    // Property 13: Chart time range filter is correct
    // =========================================================================
    //
    // For any set of data points and a selected TimeRange, filterByRange SHALL
    // return exactly those points whose date falls within [today - range, today].
    //
    // **Validates: Requirements 4.6**

    @Test
    fun `Property 13 - filterByRange returns only points within the time range`() {
        val referenceDate = LocalDate.of(2025, 6, 15)

        for (seed in 1..100) {
            val points = generateRandomDataPoints(seed, 20)

            for (range in TimeRange.values()) {
                val filtered = ChartDataTransformer.filterByRange(points, range, referenceDate)

                for (point in filtered) {
                    // Every filtered point must be <= referenceDate
                    assertFalse(
                        "Seed $seed, range $range: point date ${point.date} should not be after reference $referenceDate",
                        point.date.isAfter(referenceDate)
                    )

                    // If range has a day limit, point must be >= cutoff
                    if (range.days != null) {
                        val cutoff = referenceDate.minusDays(range.days)
                        assertFalse(
                            "Seed $seed, range $range: point date ${point.date} should not be before cutoff $cutoff",
                            point.date.isBefore(cutoff)
                        )
                    }
                }
            }
        }
    }

    @Test
    fun `Property 13 - filterByRange does not exclude points that should be included`() {
        val referenceDate = LocalDate.of(2025, 6, 15)

        for (seed in 1..100) {
            val points = generateRandomDataPoints(seed, 20)

            for (range in TimeRange.values()) {
                val filtered = ChartDataTransformer.filterByRange(points, range, referenceDate)
                val filteredDates = filtered.map { it.date }.toSet()

                // Every point in the original that's within range should appear in filtered
                for (point in points) {
                    val inRange = if (range.days != null) {
                        val cutoff = referenceDate.minusDays(range.days)
                        !point.date.isBefore(cutoff) && !point.date.isAfter(referenceDate)
                    } else {
                        !point.date.isAfter(referenceDate)
                    }

                    if (inRange) {
                        assertTrue(
                            "Seed $seed, range $range: point ${point.date} with value ${point.value} should be in filtered results",
                            filtered.any { it.date == point.date && it.value == point.value }
                        )
                    }
                }
            }
        }
    }

    @Test
    fun `Property 13 - filterByRange result is sorted by date`() {
        for (seed in 1..50) {
            val points = generateRandomDataPoints(seed, 15)

            for (range in TimeRange.values()) {
                val referenceDate = LocalDate.of(2025, 6, 15)
                val filtered = ChartDataTransformer.filterByRange(points, range, referenceDate)

                for (i in 1 until filtered.size) {
                    assertTrue(
                        "Seed $seed, range $range: filtered results should be sorted by date, " +
                                "but ${filtered[i].date} < ${filtered[i - 1].date}",
                        !filtered[i].date.isBefore(filtered[i - 1].date)
                    )
                }
            }
        }
    }

    @Test
    fun `Property 13 - filterByRange ALL returns all points not after reference`() {
        val referenceDate = LocalDate.of(2025, 6, 15)

        for (seed in 1..50) {
            val points = generateRandomDataPoints(seed, 20)
            val filtered = ChartDataTransformer.filterByRange(points, TimeRange.ALL, referenceDate)

            val expectedCount = points.count { !it.date.isAfter(referenceDate) }
            assertEquals(
                "Seed $seed: ALL range should include all points not after reference date",
                expectedCount,
                filtered.size
            )
        }
    }

    @Test
    fun `Property 13 - filterByRange with empty input returns empty`() {
        for (range in TimeRange.values()) {
            val filtered = ChartDataTransformer.filterByRange(emptyList(), range, LocalDate.of(2025, 6, 15))
            assertTrue("Empty input should produce empty output for range $range", filtered.isEmpty())
        }
    }

    @Test
    fun `Property 13 - filterByRange SEVEN_DAYS includes boundary dates`() {
        val referenceDate = LocalDate.of(2025, 6, 15)
        val points = listOf(
            ChartDataPoint(date = referenceDate, value = 1f),                          // today (included)
            ChartDataPoint(date = referenceDate.minusDays(7), value = 2f),             // exactly 7 days ago (included)
            ChartDataPoint(date = referenceDate.minusDays(8), value = 3f),             // 8 days ago (excluded)
            ChartDataPoint(date = referenceDate.plusDays(1), value = 4f)               // tomorrow (excluded)
        )

        val filtered = ChartDataTransformer.filterByRange(points, TimeRange.SEVEN_DAYS, referenceDate)

        assertEquals("Should include exactly 2 boundary points", 2, filtered.size)
        assertTrue("Should include today", filtered.any { it.value == 1f })
        assertTrue("Should include 7 days ago", filtered.any { it.value == 2f })
    }
}
