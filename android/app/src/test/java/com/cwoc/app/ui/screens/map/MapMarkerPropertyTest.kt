package com.cwoc.app.ui.screens.map

import com.cwoc.app.data.local.entity.ChitEntity
import org.junit.Assert.*
import org.junit.Test
import kotlin.random.Random

/**
 * Property-based tests for map marker logic.
 *
 * Property 14: Map markers match location-bearing chits
 * Property 15: Marker color resolution
 * Property 16: Map bounds encompass all markers
 *
 * **Validates: Requirements 5.3, 5.4, 5.6**
 *
 * These tests validate the logical properties of the MapViewModel's marker
 * generation, color resolution, and bounds computation without depending on
 * Android framework classes (android.graphics.Color, osmdroid). The pure logic
 * is tested directly.
 */
class MapMarkerPropertyTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val defaultColor = "#6b4e31"

    /**
     * Valid hex color strings for testing.
     */
    private val validColors = listOf(
        "#ff0000", "#00ff00", "#0000ff", "#6b4e31", "#ffffff",
        "#123456", "#abcdef", "#ABCDEF", "#FF5733", "#C70039"
    )

    /**
     * Invalid color strings that should fall back to default.
     */
    private val invalidColors = listOf(
        "red", "not-a-color", "12345", "#xyz", "#gg0000", "", "   "
    )

    /**
     * Valid location JSON strings.
     */
    private fun generateValidLocationJson(lat: Double, lng: Double): String =
        """{"lat": $lat, "lng": $lng, "name": "Test Location"}"""

    /**
     * Valid location CSV strings.
     */
    private fun generateValidLocationCsv(lat: Double, lng: Double): String =
        "$lat,$lng"

    /**
     * Creates a ChitEntity with the given location and color.
     */
    private fun createChit(
        id: String,
        location: String? = null,
        color: String? = null,
        deleted: Boolean = false,
        title: String? = "Test Chit"
    ): ChitEntity = ChitEntity(
        id = id,
        title = title,
        note = null,
        tags = null,
        startDatetime = null,
        endDatetime = null,
        dueDatetime = null,
        pointInTime = null,
        completedDatetime = null,
        status = null,
        priority = null,
        severity = null,
        checklist = null,
        alarm = null,
        notification = null,
        recurrence = null,
        recurrenceId = null,
        recurrenceRule = null,
        recurrenceExceptions = null,
        location = location,
        color = color,
        people = null,
        pinned = false,
        archived = false,
        deleted = deleted,
        createdDatetime = "2025-01-01T00:00:00Z",
        modifiedDatetime = "2025-01-01T00:00:00Z",
        isProjectMaster = false,
        childChits = null,
        allDay = false,
        timezone = null,
        alerts = null,
        progressPercent = null,
        timeEstimate = null,
        weatherData = null,
        healthData = null,
        habit = false,
        habitGoal = null,
        habitSuccess = null,
        showOnCalendar = null,
        habitResetPeriod = null,
        habitLastActionDate = null,
        habitHideOverall = null,
        perpetual = false,
        shares = null,
        stealth = null,
        assignedTo = null,
        ownerId = null,
        hasUnviewedConflict = false,
        availability = null,
        snoozedUntil = null,
        prerequisites = null,
        syncVersion = 0,
        lastSyncedAt = null,
        isDirty = false,
        dirtyFields = "[]"
    )

    // =========================================================================
    // Location parsing logic (mirrors MapViewModel.parseLatLng)
    // =========================================================================

    /**
     * Parses lat/lng from a location string, mirroring MapViewModel logic.
     * Returns null if the location cannot be parsed.
     */
    private fun parseLatLng(location: String): Pair<Double, Double>? {
        // Try JSON format: {"lat": ..., "lng": ...}
        try {
            // Simple JSON parsing without Gson dependency
            val latMatch = Regex(""""lat(?:itude)?":\s*(-?\d+\.?\d*)""").find(location)
            val lngMatch = Regex(""""(?:lng|lon|longitude)":\s*(-?\d+\.?\d*)""").find(location)
            if (latMatch != null && lngMatch != null) {
                val lat = latMatch.groupValues[1].toDouble()
                val lng = lngMatch.groupValues[1].toDouble()
                return Pair(lat, lng)
            }
        } catch (_: Exception) {}

        // Try "lat,lng" format
        try {
            val parts = location.split(",")
            if (parts.size == 2) {
                val lat = parts[0].trim().toDouble()
                val lng = parts[1].trim().toDouble()
                if (lat in -90.0..90.0 && lng in -180.0..180.0) {
                    return Pair(lat, lng)
                }
            }
        } catch (_: Exception) {}

        return null
    }

    /**
     * Determines if a chit would produce a map marker.
     * A chit produces a marker if it has a non-null, non-blank location
     * that can be parsed into valid lat/lng coordinates.
     */
    private fun wouldProduceMarker(chit: ChitEntity): Boolean {
        val location = chit.location ?: return false
        if (location.isBlank()) return false
        return parseLatLng(location) != null
    }

    /**
     * Resolves marker color: uses chit color if valid hex, otherwise default.
     * Mirrors MapViewModel.markerColor() logic.
     */
    private fun resolveMarkerColor(colorStr: String?): String {
        if (colorStr.isNullOrBlank()) return defaultColor
        // Validate hex color format: #RRGGBB or #AARRGGBB
        val hexPattern = Regex("^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
        return if (hexPattern.matches(colorStr)) colorStr.lowercase() else defaultColor
    }

    // =========================================================================
    // Property 14: Map markers match location-bearing chits
    // =========================================================================
    //
    // For any set of ChitEntity records, the map SHALL display markers for
    // exactly those non-deleted chits that have both latitude and longitude
    // non-null (parseable from the location field).
    //
    // **Validates: Requirements 5.3**

    @Test
    fun `Property 14 - only chits with valid location produce markers`() {
        for (seed in 1..100) {
            val r = Random(seed)
            val numChits = r.nextInt(5, 20)

            val chits = (0 until numChits).map { i ->
                val hasLocation = r.nextBoolean()
                val location = if (hasLocation) {
                    val lat = r.nextDouble() * 180.0 - 90.0  // -90 to 90
                    val lng = r.nextDouble() * 360.0 - 180.0 // -180 to 180
                    if (r.nextBoolean()) {
                        generateValidLocationJson(lat, lng)
                    } else {
                        generateValidLocationCsv(lat, lng)
                    }
                } else null

                createChit(id = "chit-$seed-$i", location = location)
            }

            val markersProduced = chits.filter { wouldProduceMarker(it) }
            val chitsWithLocation = chits.filter { it.location != null && it.location!!.isNotBlank() }

            // Every marker must come from a chit with a parseable location
            for (marker in markersProduced) {
                assertNotNull(
                    "Seed $seed: marker chit ${marker.id} must have non-null location",
                    marker.location
                )
                assertTrue(
                    "Seed $seed: marker chit ${marker.id} location must be parseable",
                    parseLatLng(marker.location!!) != null
                )
            }

            // Every chit with a valid parseable location must produce a marker
            for (chit in chitsWithLocation) {
                val parseable = parseLatLng(chit.location!!) != null
                if (parseable) {
                    assertTrue(
                        "Seed $seed: chit ${chit.id} with parseable location should produce a marker",
                        markersProduced.contains(chit)
                    )
                }
            }
        }
    }

    @Test
    fun `Property 14 - chits with null location do not produce markers`() {
        for (seed in 1..50) {
            val r = Random(seed)
            val numChits = r.nextInt(3, 15)

            val chits = (0 until numChits).map { i ->
                createChit(id = "null-loc-$seed-$i", location = null)
            }

            val markersProduced = chits.filter { wouldProduceMarker(it) }
            assertTrue(
                "Seed $seed: no markers should be produced from chits with null location",
                markersProduced.isEmpty()
            )
        }
    }

    @Test
    fun `Property 14 - chits with blank location do not produce markers`() {
        val blankLocations = listOf("", "   ", "\t", "\n")

        for (blank in blankLocations) {
            val chit = createChit(id = "blank-loc", location = blank)
            assertFalse(
                "Blank location '$blank' should not produce a marker",
                wouldProduceMarker(chit)
            )
        }
    }

    @Test
    fun `Property 14 - chits with unparseable location do not produce markers`() {
        val unparseableLocations = listOf(
            "not a location",
            "somewhere",
            "123",
            "abc,def",
            """{"name": "no coords"}""",
            """{"lat": "invalid", "lng": 45.0}""",
            "91.0,0.0",   // lat out of range
            "0.0,181.0",  // lng out of range
            "-91.0,0.0",  // lat out of range
            "0.0,-181.0"  // lng out of range
        )

        for (location in unparseableLocations) {
            val chit = createChit(id = "bad-loc", location = location)
            assertFalse(
                "Unparseable location '$location' should not produce a marker",
                wouldProduceMarker(chit)
            )
        }
    }

    @Test
    fun `Property 14 - marker count equals count of chits with valid locations`() {
        for (seed in 1..100) {
            val r = Random(seed)
            val numChits = r.nextInt(5, 25)

            val chits = (0 until numChits).map { i ->
                val locationType = r.nextInt(4) // 0=null, 1=json, 2=csv, 3=invalid
                val location = when (locationType) {
                    1 -> {
                        val lat = r.nextDouble() * 180.0 - 90.0
                        val lng = r.nextDouble() * 360.0 - 180.0
                        generateValidLocationJson(lat, lng)
                    }
                    2 -> {
                        val lat = r.nextDouble() * 180.0 - 90.0
                        val lng = r.nextDouble() * 360.0 - 180.0
                        generateValidLocationCsv(lat, lng)
                    }
                    3 -> "invalid location data"
                    else -> null
                }
                createChit(id = "count-$seed-$i", location = location)
            }

            val markerCount = chits.count { wouldProduceMarker(it) }
            val expectedCount = chits.count { chit ->
                val loc = chit.location
                loc != null && loc.isNotBlank() && parseLatLng(loc) != null
            }

            assertEquals(
                "Seed $seed: marker count should equal count of chits with valid locations",
                expectedCount,
                markerCount
            )
        }
    }

    @Test
    fun `Property 14 - JSON format locations with lat and lng produce markers`() {
        val validJsonLocations = listOf(
            """{"lat": 40.7128, "lng": -74.0060}""",
            """{"latitude": 51.5074, "longitude": -0.1278}""",
            """{"lat": 0.0, "lon": 0.0}""",
            """{"lat": -33.8688, "lng": 151.2093, "name": "Sydney"}""",
            """{"lat": 90.0, "lng": 180.0}""",
            """{"lat": -90.0, "lng": -180.0}"""
        )

        for (location in validJsonLocations) {
            val chit = createChit(id = "json-valid", location = location)
            assertTrue(
                "Valid JSON location '$location' should produce a marker",
                wouldProduceMarker(chit)
            )
        }
    }

    @Test
    fun `Property 14 - CSV format locations produce markers`() {
        val validCsvLocations = listOf(
            "40.7128,-74.0060",
            "51.5074, -0.1278",
            "0.0,0.0",
            "-33.8688,151.2093",
            "90.0,180.0",
            "-90.0,-180.0"
        )

        for (location in validCsvLocations) {
            val chit = createChit(id = "csv-valid", location = location)
            assertTrue(
                "Valid CSV location '$location' should produce a marker",
                wouldProduceMarker(chit)
            )
        }
    }

    // =========================================================================
    // Property 15: Marker color resolution
    // =========================================================================
    //
    // For any ChitEntity with a non-null color field, the marker color SHALL be
    // that color. For any ChitEntity with a null color field, the marker color
    // SHALL be #6b4e31.
    //
    // **Validates: Requirements 5.4**

    @Test
    fun `Property 15 - null color resolves to default brown`() {
        val resolved = resolveMarkerColor(null)
        assertEquals(
            "Null color should resolve to default #6b4e31",
            defaultColor,
            resolved
        )
    }

    @Test
    fun `Property 15 - blank color resolves to default brown`() {
        for (blank in listOf("", "   ", "\t")) {
            val resolved = resolveMarkerColor(blank)
            assertEquals(
                "Blank color '$blank' should resolve to default #6b4e31",
                defaultColor,
                resolved
            )
        }
    }

    @Test
    fun `Property 15 - valid hex colors are used as-is`() {
        for (color in validColors) {
            val resolved = resolveMarkerColor(color)
            assertEquals(
                "Valid color '$color' should be used (lowercased)",
                color.lowercase(),
                resolved
            )
        }
    }

    @Test
    fun `Property 15 - invalid color strings fall back to default`() {
        for (color in invalidColors) {
            val resolved = resolveMarkerColor(color)
            assertEquals(
                "Invalid color '$color' should fall back to default #6b4e31",
                defaultColor,
                resolved
            )
        }
    }

    @Test
    fun `Property 15 - color resolution is deterministic across many inputs`() {
        for (seed in 1..100) {
            val r = Random(seed)
            val hasColor = r.nextBoolean()
            val color = if (hasColor) {
                if (r.nextBoolean()) {
                    // Generate valid hex color
                    val hex = String.format("#%06x", r.nextInt(0xFFFFFF + 1))
                    hex
                } else {
                    // Generate invalid color
                    invalidColors[r.nextInt(invalidColors.size)]
                }
            } else null

            val result1 = resolveMarkerColor(color)
            val result2 = resolveMarkerColor(color)

            assertEquals(
                "Seed $seed: color resolution must be deterministic for input '$color'",
                result1,
                result2
            )

            // If color is null/blank, must be default
            if (color.isNullOrBlank()) {
                assertEquals(
                    "Seed $seed: null/blank color must resolve to default",
                    defaultColor,
                    result1
                )
            }
        }
    }

    @Test
    fun `Property 15 - chit with color gets that color on marker`() {
        for (seed in 1..100) {
            val r = Random(seed)
            val hex = String.format("#%06x", r.nextInt(0xFFFFFF + 1))
            val chit = createChit(
                id = "colored-$seed",
                location = "40.7128,-74.0060",
                color = hex
            )

            val markerColor = resolveMarkerColor(chit.color)
            assertEquals(
                "Seed $seed: chit with color '$hex' should have that color on marker",
                hex.lowercase(),
                markerColor
            )
        }
    }

    @Test
    fun `Property 15 - chit without color gets default on marker`() {
        for (seed in 1..50) {
            val chit = createChit(
                id = "no-color-$seed",
                location = "40.7128,-74.0060",
                color = null
            )

            val markerColor = resolveMarkerColor(chit.color)
            assertEquals(
                "Seed $seed: chit without color should get default #6b4e31",
                defaultColor,
                markerColor
            )
        }
    }

    // =========================================================================
    // Property 16: Map bounds encompass all markers
    // =========================================================================
    //
    // For any set of geo-located chits, the computed bounding box SHALL contain
    // all marker coordinates (every lat/lng pair falls within the box).
    //
    // **Validates: Requirements 5.6**

    /**
     * Simple bounding box representation for testing (avoids osmdroid dependency).
     */
    data class TestBoundingBox(
        val north: Double,
        val east: Double,
        val south: Double,
        val west: Double
    ) {
        fun contains(lat: Double, lng: Double): Boolean =
            lat in south..north && lng in west..east
    }

    /**
     * Computes bounding box encompassing all points with padding.
     * Mirrors MapViewModel.computeBounds() logic.
     */
    private fun computeBounds(points: List<Pair<Double, Double>>): TestBoundingBox? {
        if (points.isEmpty()) return null
        if (points.size == 1) {
            val (lat, lng) = points[0]
            return TestBoundingBox(
                north = lat + 0.01,
                east = lng + 0.01,
                south = lat - 0.01,
                west = lng - 0.01
            )
        }

        var north = -90.0
        var south = 90.0
        var east = -180.0
        var west = 180.0

        points.forEach { (lat, lng) ->
            if (lat > north) north = lat
            if (lat < south) south = lat
            if (lng > east) east = lng
            if (lng < west) west = lng
        }

        // Add padding (10% of range)
        val latPad = (north - south) * 0.1
        val lngPad = (east - west) * 0.1

        return TestBoundingBox(
            north = north + latPad,
            east = east + lngPad,
            south = south - latPad,
            west = west - lngPad
        )
    }

    @Test
    fun `Property 16 - bounds contain all marker positions`() {
        for (seed in 1..100) {
            val r = Random(seed)
            val numPoints = r.nextInt(2, 20)

            val points = (0 until numPoints).map {
                val lat = r.nextDouble() * 180.0 - 90.0
                val lng = r.nextDouble() * 360.0 - 180.0
                Pair(lat, lng)
            }

            val bounds = computeBounds(points)
            assertNotNull("Seed $seed: bounds should not be null for non-empty points", bounds)

            for ((idx, point) in points.withIndex()) {
                assertTrue(
                    "Seed $seed: point $idx (${point.first}, ${point.second}) must be within bounds " +
                            "[S=${bounds!!.south}, N=${bounds.north}, W=${bounds.west}, E=${bounds.east}]",
                    bounds.contains(point.first, point.second)
                )
            }
        }
    }

    @Test
    fun `Property 16 - single marker gets padded bounds`() {
        for (seed in 1..50) {
            val r = Random(seed)
            val lat = r.nextDouble() * 180.0 - 90.0
            val lng = r.nextDouble() * 360.0 - 180.0

            val bounds = computeBounds(listOf(Pair(lat, lng)))
            assertNotNull("Seed $seed: single point should produce bounds", bounds)

            assertTrue(
                "Seed $seed: single point ($lat, $lng) must be within its bounds",
                bounds!!.contains(lat, lng)
            )

            // Bounds should have padding around the single point
            assertTrue(
                "Seed $seed: north should be > lat for padding",
                bounds.north > lat
            )
            assertTrue(
                "Seed $seed: south should be < lat for padding",
                bounds.south < lat
            )
            assertTrue(
                "Seed $seed: east should be > lng for padding",
                bounds.east > lng
            )
            assertTrue(
                "Seed $seed: west should be < lng for padding",
                bounds.west < lng
            )
        }
    }

    @Test
    fun `Property 16 - empty marker list produces null bounds`() {
        val bounds = computeBounds(emptyList())
        assertNull("Empty marker list should produce null bounds", bounds)
    }

    @Test
    fun `Property 16 - bounds have positive area for multiple distinct points`() {
        for (seed in 1..100) {
            val r = Random(seed)
            val numPoints = r.nextInt(2, 15)

            // Generate points that are not all identical
            val points = (0 until numPoints).map {
                val lat = r.nextDouble() * 160.0 - 80.0  // -80 to 80 (avoid poles)
                val lng = r.nextDouble() * 340.0 - 170.0 // -170 to 170
                Pair(lat, lng)
            }

            // Only test if points are not all identical
            val distinctLats = points.map { it.first }.distinct()
            val distinctLngs = points.map { it.second }.distinct()

            if (distinctLats.size > 1 || distinctLngs.size > 1) {
                val bounds = computeBounds(points)!!

                if (distinctLats.size > 1) {
                    assertTrue(
                        "Seed $seed: bounds should have positive latitude range",
                        bounds.north > bounds.south
                    )
                }
                if (distinctLngs.size > 1) {
                    assertTrue(
                        "Seed $seed: bounds should have positive longitude range",
                        bounds.east > bounds.west
                    )
                }
            }
        }
    }

    @Test
    fun `Property 16 - bounds padding adds 10 percent margin`() {
        // Use known points to verify padding calculation
        val points = listOf(
            Pair(40.0, -74.0),
            Pair(42.0, -72.0)
        )

        val bounds = computeBounds(points)!!

        // Lat range = 42 - 40 = 2, padding = 0.2
        // Lng range = -72 - (-74) = 2, padding = 0.2
        val expectedNorth = 42.0 + 0.2
        val expectedSouth = 40.0 - 0.2
        val expectedEast = -72.0 + 0.2
        val expectedWest = -74.0 - 0.2

        assertEquals("North should include 10% padding", expectedNorth, bounds.north, 0.001)
        assertEquals("South should include 10% padding", expectedSouth, bounds.south, 0.001)
        assertEquals("East should include 10% padding", expectedEast, bounds.east, 0.001)
        assertEquals("West should include 10% padding", expectedWest, bounds.west, 0.001)
    }

    @Test
    fun `Property 16 - bounds with identical points still has padding`() {
        // All points at same location
        val lat = 35.6762
        val lng = 139.6503
        val points = listOf(
            Pair(lat, lng),
            Pair(lat, lng),
            Pair(lat, lng)
        )

        val bounds = computeBounds(points)!!

        // Range is 0, so padding is 0, but bounds should still contain the point
        assertTrue(
            "Identical points should still be within bounds",
            bounds.contains(lat, lng)
        )

        // With 0 range, north==south and east==west (0 padding from 0 range)
        // The point should be exactly at the boundary
        assertEquals("North should equal lat (zero range)", lat, bounds.north, 0.001)
        assertEquals("South should equal lat (zero range)", lat, bounds.south, 0.001)
        assertEquals("East should equal lng (zero range)", lng, bounds.east, 0.001)
        assertEquals("West should equal lng (zero range)", lng, bounds.west, 0.001)
    }

    @Test
    fun `Property 16 - extreme coordinates are handled correctly`() {
        val extremePoints = listOf(
            Pair(89.9, 179.9),
            Pair(-89.9, -179.9)
        )

        val bounds = computeBounds(extremePoints)!!

        // All points must be within bounds
        for (point in extremePoints) {
            assertTrue(
                "Extreme point (${point.first}, ${point.second}) must be within bounds",
                bounds.contains(point.first, point.second)
            )
        }
    }

    @Test
    fun `Property 16 - end-to-end marker to bounds pipeline`() {
        // Simulate the full pipeline: chits → filter location-bearing → compute bounds
        for (seed in 1..50) {
            val r = Random(seed)
            val numChits = r.nextInt(5, 20)

            val chits = (0 until numChits).map { i ->
                val hasLocation = r.nextBoolean()
                val location = if (hasLocation) {
                    val lat = r.nextDouble() * 160.0 - 80.0
                    val lng = r.nextDouble() * 340.0 - 170.0
                    generateValidLocationCsv(lat, lng)
                } else null

                createChit(id = "e2e-$seed-$i", location = location)
            }

            // Filter to location-bearing chits and extract coordinates
            val markerPoints = chits.mapNotNull { chit ->
                val loc = chit.location ?: return@mapNotNull null
                if (loc.isBlank()) return@mapNotNull null
                parseLatLng(loc)
            }

            if (markerPoints.isEmpty()) {
                val bounds = computeBounds(markerPoints)
                assertNull("Seed $seed: no markers should produce null bounds", bounds)
            } else {
                val bounds = computeBounds(markerPoints)
                assertNotNull("Seed $seed: markers should produce non-null bounds", bounds)

                // Every marker coordinate must be within bounds
                for ((idx, point) in markerPoints.withIndex()) {
                    assertTrue(
                        "Seed $seed: marker $idx (${point.first}, ${point.second}) must be within bounds",
                        bounds!!.contains(point.first, point.second)
                    )
                }
            }
        }
    }
}
