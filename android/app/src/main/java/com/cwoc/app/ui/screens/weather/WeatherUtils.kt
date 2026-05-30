package com.cwoc.app.ui.screens.weather

import androidx.compose.ui.graphics.Color
import com.cwoc.app.data.local.entity.ChitEntity
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

// ─── Weather Period Enum ────────────────────────────────────────────────────────

enum class WeatherPeriod(val label: String) {
    ONE_HOUR("1 Hour"),
    DAY("Day"),
    WORK_HOURS("Work Hours"),
    WEEK("Week"),
    X_DAYS("X Days"),
    MONTH("Month"),
    YEAR("Year"),
    FORECAST_MAX("Forecast Max (16 day)")
}

// ─── Temperature Gradient Stops ─────────────────────────────────────────────────

/**
 * Canonical temperature gradient stops — single source of truth.
 * Matches the web's _cwocTempGradientStops exactly.
 */
private data class TempGradientStop(val t: Double, val r: Int, val g: Int, val b: Int)

private val TEMP_GRADIENT_STOPS = listOf(
    TempGradientStop(-10.0, 0, 16, 64),      // #001040 — deep blue
    TempGradientStop(0.0, 33, 102, 172),      // #2166ac — light blue
    TempGradientStop(15.0, 224, 221, 212),    // #e0ddd4 — parchment/neutral
    TempGradientStop(22.0, 240, 200, 48),     // #f0c830 — gold/orange
    TempGradientStop(30.0, 215, 48, 39),      // #d73027 — red
    TempGradientStop(40.0, 58, 0, 0)          // #3a0000 — deep red/black
)

// ─── Snow Weather Codes ─────────────────────────────────────────────────────────

private val SNOW_CODES = setOf(71, 73, 75, 77, 85, 86)

// ─── WeatherUtils Object ────────────────────────────────────────────────────────

/**
 * Pure utility functions for weather data conversion and formatting.
 * All functions are stateless and side-effect-free.
 */
object WeatherUtils {

    /**
     * Convert a Celsius temperature to the target unit and return as a rounded Int.
     * Returns null if the input is null.
     *
     * @param celsius Temperature in Celsius (from API)
     * @param toFahrenheit If true, convert to Fahrenheit; otherwise keep as Celsius
     * @return Rounded integer temperature, or null
     */
    fun convertTemp(celsius: Double?, toFahrenheit: Boolean): Int? {
        if (celsius == null) return null
        return if (toFahrenheit) {
            (celsius * 9.0 / 5.0 + 32.0).roundToInt()
        } else {
            celsius.roundToInt()
        }
    }

    /**
     * Map a Celsius temperature to a Color using the canonical gradient stops.
     * Matches the web's _getTempColor / _getTempBorderColor exactly.
     *
     * Gradient: deep blue (-10°C) → light blue (0°C) → neutral (15°C) → gold (22°C) → red (30°C) → deep red (40°C)
     *
     * @param celsius Temperature in Celsius
     * @return Interpolated Color for the temperature
     */
    fun getTempBorderColor(celsius: Double?): Color {
        if (celsius == null) return Color(0xFF3A2A1A) // fallback brown

        val stops = TEMP_GRADIENT_STOPS

        // Clamp to range
        if (celsius <= stops.first().t) {
            val s = stops.first()
            return rgbColor(s.r, s.g, s.b)
        }
        if (celsius >= stops.last().t) {
            val s = stops.last()
            return rgbColor(s.r, s.g, s.b)
        }

        // Interpolate between adjacent stops
        for (i in 0 until stops.size - 1) {
            if (celsius >= stops[i].t && celsius <= stops[i + 1].t) {
                val pct = (celsius - stops[i].t) / (stops[i + 1].t - stops[i].t)
                val r = (stops[i].r + pct * (stops[i + 1].r - stops[i].r)).roundToInt()
                val g = (stops[i].g + pct * (stops[i + 1].g - stops[i].g)).roundToInt()
                val b = (stops[i].b + pct * (stops[i + 1].b - stops[i].b)).roundToInt()
                return rgbColor(r, g, b)
            }
        }

        return Color(0xFF3A2A1A) // fallback brown
    }

    /** Helper to construct a Color from 0-255 RGB int values. */
    private fun rgbColor(r: Int, g: Int, b: Int): Color {
        return Color(
            red = r.coerceIn(0, 255) / 255f,
            green = g.coerceIn(0, 255) / 255f,
            blue = b.coerceIn(0, 255) / 255f
        )
    }

    /**
     * Check if weather conditions are extreme.
     * Matches the web's _wxIsExtreme logic exactly: high temp > 5°C.
     *
     * @param highC High temperature in Celsius
     * @param lowC Low temperature in Celsius (currently unused, reserved for future thresholds)
     * @param weatherCode WMO weather code (currently unused, reserved for future thresholds)
     * @return true if conditions are extreme
     */
    fun isExtreme(highC: Double?, lowC: Double?, weatherCode: Int?): Boolean {
        if (highC != null && highC > 5) return true
        return false
    }

    /**
     * Format precipitation amount with snow/rain icon distinction.
     * Matches the web's _cwocFormatPrecip logic:
     * - Zero/null → em-dash (or custom emptyVal)
     * - Snow codes → ❄️ icon
     * - Rain/other → 💧 icon
     * - Sub-0.5cm → just the type icon
     * - ≥0.5cm → rounded cm + type icon
     *
     * @param precip Precipitation in millimeters
     * @param weatherCode WMO weather code for snow/rain distinction
     * @param emptyVal String to return when precipitation is zero/null (default "—")
     * @return Formatted precipitation string
     */
    fun formatPrecip(precip: Double?, weatherCode: Int?, emptyVal: String = "—"): String {
        if (precip == null || precip <= 0) return emptyVal

        val isSnow = weatherCode != null && weatherCode in SNOW_CODES
        val icon = if (isSnow) "❄️" else "💧"

        val cm = precip / 10.0
        return if (cm < 0.5) {
            icon
        } else {
            "${cm.roundToInt()}cm $icon"
        }
    }

    /**
     * Check if a date string falls on the configured week start day.
     * Used to draw vertical separator lines at week boundaries.
     *
     * @param dateStr Date in YYYY-MM-DD format
     * @param weekStartDay Day of week as 0=Sunday..6=Saturday (matching JS convention)
     * @return true if the date's day-of-week matches weekStartDay
     */
    fun isWeekStart(dateStr: String, weekStartDay: Int): Boolean {
        return try {
            val date = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE)
            // Convert Java's DayOfWeek (MONDAY=1..SUNDAY=7) to JS convention (0=Sun..6=Sat)
            val jsDow = date.dayOfWeek.value % 7 // MONDAY=1, SUNDAY=7 → Mon=1..Sat=6, Sun=0
            jsDow == weekStartDay
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Compute the start/end date range for a given weather period and offset.
     * Matches the web's period calculation logic in _wxApplyDateFilter.
     *
     * @param period The selected weather period
     * @param offset Integer offset from current (0=current, 1=next, -1=previous)
     * @param customDays Number of days for X_DAYS period (from user settings, capped at 16)
     * @return Pair of (startDate, endDate) or null for FORECAST_MAX (show all)
     */
    fun computePeriodRange(period: WeatherPeriod, offset: Int, customDays: Int): Pair<LocalDate, LocalDate>? {
        val now = LocalDate.now()

        return when (period) {
            WeatherPeriod.FORECAST_MAX -> null // Show all — no filtering

            WeatherPeriod.ONE_HOUR -> {
                // 1 Hour — weather is daily, so just show today
                val day = now
                Pair(day, day)
            }

            WeatherPeriod.DAY, WeatherPeriod.WORK_HOURS -> {
                // Day / Work Hours — single day with offset
                val day = now.plusDays(offset.toLong())
                Pair(day, day)
            }

            WeatherPeriod.WEEK -> {
                // Week — starts on Sunday (day 0), 7 days
                val dayOfWeek = now.dayOfWeek.value % 7 // Sun=0..Sat=6
                val weekStart = now.minusDays(dayOfWeek.toLong()).plusWeeks(offset.toLong())
                val weekEnd = weekStart.plusDays(6)
                Pair(weekStart, weekEnd)
            }

            WeatherPeriod.X_DAYS -> {
                // X Days — custom count, capped at 16
                val xDays = customDays.coerceIn(1, 16)
                val start = now.plusDays((offset * xDays).toLong())
                val end = start.plusDays((xDays - 1).toLong())
                Pair(start, end)
            }

            WeatherPeriod.MONTH -> {
                // Month — calendar month with offset
                val monthStart = now.withDayOfMonth(1).plusMonths(offset.toLong())
                val monthEnd = monthStart.plusMonths(1).minusDays(1)
                Pair(monthStart, monthEnd)
            }

            WeatherPeriod.YEAR -> {
                // Year — full calendar year with offset
                val yearStart = LocalDate.of(now.year + offset, 1, 1)
                val yearEnd = LocalDate.of(now.year + offset, 12, 31)
                Pair(yearStart, yearEnd)
            }
        }
    }

    /**
     * Build a map of location index → set of YYYY-MM-DD date strings where chits have events.
     * Matches the web's _wxBuildLocDateMap logic:
     * - Case-insensitive matching of chit.location against location label and address
     * - Considers startDatetime, endDatetime, dueDatetime fields
     * - Expands multi-day ranges (start to end) to include all intermediate dates
     *
     * @param chits List of chit entities to scan for location/date matches
     * @param locations List of location forecasts (with locationName and address)
     * @return Map where key is location index and value is set of date strings with events
     */
    fun buildLocDateMap(chits: List<ChitEntity>, locations: List<LocationForecast>): Map<Int, Set<String>> {
        // Build lookup: normalized address/label → location index
        val locLookup = mutableMapOf<String, Int>()
        locations.forEachIndexed { index, loc ->
            val addr = loc.address.lowercase().trim()
            val label = loc.locationName.lowercase().trim()
            if (addr.isNotEmpty()) locLookup[addr] = index
            if (label.isNotEmpty()) locLookup[label] = index
        }

        val result = mutableMapOf<Int, MutableSet<String>>()

        for (chit in chits) {
            if (chit.deleted) continue
            val chitLoc = (chit.location ?: "").lowercase().trim()
            if (chitLoc.isEmpty()) continue

            val locIdx = locLookup[chitLoc] ?: continue

            val datesToAdd = mutableSetOf<String>()

            // Extract dates from datetime fields
            val dateFields = listOf(chit.startDatetime, chit.endDatetime, chit.dueDatetime)
            for (field in dateFields) {
                if (field != null && field.length >= 10) {
                    val dateOnly = field.substring(0, 10)
                    if (dateOnly.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) {
                        datesToAdd.add(dateOnly)
                    }
                }
            }

            // Expand multi-day range if start and end both exist
            if (chit.startDatetime != null && chit.endDatetime != null &&
                chit.startDatetime.length >= 10 && chit.endDatetime.length >= 10
            ) {
                val startStr = chit.startDatetime.substring(0, 10)
                val endStr = chit.endDatetime.substring(0, 10)
                try {
                    val startDate = LocalDate.parse(startStr, DateTimeFormatter.ISO_LOCAL_DATE)
                    val endDate = LocalDate.parse(endStr, DateTimeFormatter.ISO_LOCAL_DATE)
                    var cur = startDate
                    while (!cur.isAfter(endDate)) {
                        datesToAdd.add(cur.format(DateTimeFormatter.ISO_LOCAL_DATE))
                        cur = cur.plusDays(1)
                    }
                } catch (_: Exception) {
                    // Skip invalid date ranges
                }
            }

            if (datesToAdd.isNotEmpty()) {
                result.getOrPut(locIdx) { mutableSetOf() }.addAll(datesToAdd)
            }
        }

        return result
    }
}
