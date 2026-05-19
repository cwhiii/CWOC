package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.util.GeocodingUtil
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Shared card enhancement composables for chit list views.
 * These are reusable across Tasks, Notes, Checklists, Calendar, Projects, etc.
 *
 * Addresses gap items: B1 (tag chips), B2 (chit color), B3 (checklist progress),
 * B4 (people chips), B5 (overdue border), B8 (sharing/stealth indicators),
 * B9 (archive/snooze indicators), B13 (pinned sort).
 */

// ─── B1: Tag Chips ──────────────────────────────────────────────────────────────

/** System tags that are auto-assigned by the backend and should never display as chips. */
private val SYSTEM_TAGS = setOf(
    "Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes"
)

/**
 * Renders tag chips for a chit card. Shows colored pills with tag names.
 * Tags are stored as a List<String> on ChitEntity.
 * System tags (Calendar, Checklists, Alarms, Projects, Tasks, Notes) and
 * internal CWOC_System/ prefixed tags are automatically filtered out.
 *
 * @param tags List of tag name strings from the chit
 * @param tagColorMap Optional map of tag name → hex color string from settings.
 *                    When provided, uses the configured color. Falls back to hash-based color.
 * @param maxTags Maximum number of tags to display before showing "+N" overflow
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TagChipsRow(
    tags: List<String>?,
    modifier: Modifier = Modifier,
    tagColorMap: Map<String, String>? = null,
    maxTags: Int = 4,
    overflowTextColor: Color? = null
) {
    if (tags.isNullOrEmpty()) return

    // Filter out system tags and internal CWOC_System/ prefixed tags
    val userTags = remember(tags) {
        tags.filter { tag ->
            tag !in SYSTEM_TAGS &&
                !tag.startsWith("CWOC_System/", ignoreCase = true)
        }
    }

    if (userTags.isEmpty()) return

    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        val displayTags = if (userTags.size > maxTags) userTags.take(maxTags) else userTags
        displayTags.forEach { tag ->
            TagChip(tagName = tag, configuredColor = tagColorMap?.get(tag))
        }
        if (userTags.size > maxTags) {
            Text(
                text = "+${userTags.size - maxTags}",
                style = MaterialTheme.typography.labelSmall,
                color = overflowTextColor ?: MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 2.dp)
            )
        }
    }
}

@Composable
private fun TagChip(tagName: String, configuredColor: String? = null) {
    // Use configured color from settings if available, otherwise generate from hash
    val chipColor = remember(tagName, configuredColor) {
        if (configuredColor != null) {
            parseHexColor(configuredColor) ?: tagColor(tagName)
        } else {
            tagColor(tagName)
        }
    }
    // B1 sub-item 5: font color contrast logic — use dark text on light chips, light on dark
    val textColor = remember(chipColor) {
        val luminance = (0.299f * chipColor.red + 0.587f * chipColor.green + 0.114f * chipColor.blue)
        if (luminance > 0.5f) Color(0xFF1A1208) else Color(0xFFFFFFFF)
    }

    Surface(
        shape = RoundedCornerShape(10.dp),
        color = chipColor.copy(alpha = 0.85f),
        modifier = Modifier
    ) {
        Text(
            text = tagName,
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

/**
 * Generate a deterministic color for a tag based on its name hash.
 * Uses the CWOC brown/earth tone palette.
 */
private fun tagColor(tagName: String): Color {
    val colors = listOf(
        Color(0xFF8B5A2B), // Brown
        Color(0xFF4A6741), // Green
        Color(0xFF6B4E31), // Dark brown
        Color(0xFF1565C0), // Blue
        Color(0xFF9B59B6), // Purple
        Color(0xFFD2691E), // Chocolate
        Color(0xFF2E7D32), // Dark green
        Color(0xFF5C4A3A), // Muted brown
        Color(0xFF795548), // Brown 400
        Color(0xFF00695C)  // Teal
    )
    val index = (tagName.hashCode().and(0x7FFFFFFF)) % colors.size
    return colors[index]
}

// ─── B2: Chit Color Border ──────────────────────────────────────────────────────

/**
 * Returns a Modifier that applies the chit's color as a left border on the card.
 * If the chit has no color (null or "transparent"), returns Modifier unchanged.
 */
fun Modifier.chitColorBorder(color: String?): Modifier {
    if (color.isNullOrBlank() || color == "transparent") return this
    val parsedColor = parseHexColor(color) ?: return this
    return this.border(
        width = 3.dp,
        color = parsedColor,
        shape = RoundedCornerShape(12.dp)
    )
}

/**
 * Parse a hex color string (with or without #) into a Compose Color.
 */
fun parseHexColor(hex: String?): Color? {
    if (hex.isNullOrBlank() || hex == "transparent") return null
    return try {
        val cleanHex = hex.removePrefix("#")
        when (cleanHex.length) {
            6 -> Color(android.graphics.Color.parseColor("#$cleanHex"))
            8 -> Color(android.graphics.Color.parseColor("#$cleanHex"))
            else -> null
        }
    } catch (e: Exception) {
        null
    }
}

// ─── B3: Checklist Progress ─────────────────────────────────────────────────────

/**
 * Shows checklist progress as "X/Y complete" text with a mini progress bar.
 * Parses the checklist JSON to count checked vs total items.
 */
@Composable
fun ChecklistProgressBadge(
    checklistJson: String?,
    modifier: Modifier = Modifier,
    textColor: Color? = null
) {
    if (checklistJson.isNullOrBlank()) return

    val (checked, total) = remember(checklistJson) { parseChecklistProgress(checklistJson) }
    if (total == 0) return

    val progressFraction = checked.toFloat() / total.toFloat()

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        // Mini progress bar
        androidx.compose.material3.LinearProgressIndicator(
            progress = { progressFraction },
            modifier = Modifier
                .width(40.dp)
                .height(4.dp),
            color = if (checked == total) Color(0xFF4A6741) else (textColor ?: Color(0xFF8B5A2B)),
            trackColor = Color(0xFFEDE0D4).copy(alpha = if (textColor != null) 0.3f else 1f)
        )
        // Count text
        Text(
            text = "☑ $checked/$total",
            style = MaterialTheme.typography.labelSmall,
            color = if (checked == total) Color(0xFF4A6741) else (textColor ?: MaterialTheme.colorScheme.onSurfaceVariant),
            fontWeight = if (checked == total) FontWeight.Bold else FontWeight.Normal
        )
    }
}

/**
 * Parse checklist JSON and return (checked count, total count).
 * Checklist format: [{"text": "...", "checked": true/false, "children": [...]}]
 */
private fun parseChecklistProgress(json: String): Pair<Int, Int> {
    return try {
        val gson = Gson()
        val type = object : TypeToken<List<Map<String, Any>>>() {}.type
        val items: List<Map<String, Any>> = gson.fromJson(json, type)
        countChecklistItems(items)
    } catch (e: Exception) {
        Pair(0, 0)
    }
}

private fun countChecklistItems(items: List<Map<String, Any>>): Pair<Int, Int> {
    var checked = 0
    var total = 0
    for (item in items) {
        total++
        if (item["checked"] == true) checked++
        // Count children recursively
        @Suppress("UNCHECKED_CAST")
        val children = item["children"] as? List<Map<String, Any>>
        if (children != null) {
            val (childChecked, childTotal) = countChecklistItems(children)
            checked += childChecked
            total += childTotal
        }
    }
    return Pair(checked, total)
}

// ─── B4: People Chips ───────────────────────────────────────────────────────────

/**
 * Renders people chips on a card. Shows small name pills.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PeopleChipsRow(
    people: List<String>?,
    modifier: Modifier = Modifier,
    contactImages: Map<String, String?> = emptyMap(),
    serverUrl: String = "",
    authToken: String = "",
    maxPeople: Int = 3,
    overflowTextColor: Color? = null
) {
    if (people.isNullOrEmpty()) return

    FlowRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        val displayPeople = if (people.size > maxPeople) people.take(maxPeople) else people
        displayPeople.forEach { person ->
            PersonChip(
                name = person,
                imageUrl = contactImages[person],
                serverUrl = serverUrl,
                authToken = authToken
            )
        }
        if (people.size > maxPeople) {
            Text(
                text = "+${people.size - maxPeople}",
                style = MaterialTheme.typography.labelSmall,
                color = overflowTextColor ?: MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun PersonChip(
    name: String,
    imageUrl: String? = null,
    serverUrl: String = "",
    authToken: String = ""
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .background(
                color = MaterialTheme.colorScheme.secondaryContainer,
                shape = RoundedCornerShape(10.dp)
            )
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        // Profile image or initials circle
        ContactAvatar(
            imageUrl = imageUrl,
            name = name,
            size = 14.dp,
            serverUrl = serverUrl,
            authToken = authToken
        )
        Spacer(modifier = Modifier.width(3.dp))
        Text(
            text = name,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSecondaryContainer,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

// ─── B6: Weather Indicator ───────────────────────────────────────────────────────

/**
 * Shows a weather icon and temperature on cards that have weather data.
 * Weather data JSON format: {"weather_code": 0, "high": 75, "low": 55, "focus_date": "...", "updated_time": "..."}
 */
@Composable
fun WeatherIndicator(
    weatherDataJson: String?,
    modifier: Modifier = Modifier,
    textColor: Color? = null
) {
    if (weatherDataJson.isNullOrBlank()) return

    val weatherInfo = remember(weatherDataJson) { parseWeatherData(weatherDataJson) }
    if (weatherInfo == null) return

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Text(
            text = weatherCodeToEmoji(weatherInfo.weatherCode),
            style = MaterialTheme.typography.labelSmall
        )
        Text(
            text = "${weatherInfo.high}°/${weatherInfo.low}°",
            style = MaterialTheme.typography.labelSmall,
            color = textColor ?: MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

private data class WeatherInfo(val weatherCode: Int, val high: Int, val low: Int)

private fun parseWeatherData(json: String): WeatherInfo? {
    return try {
        val gson = Gson()
        val map: Map<String, Any> = gson.fromJson(json, object : TypeToken<Map<String, Any>>() {}.type)
        val code = (map["weather_code"] as? Number)?.toInt() ?: return null
        val high = (map["high"] as? Number)?.toInt() ?: return null
        val low = (map["low"] as? Number)?.toInt() ?: return null
        WeatherInfo(code, high, low)
    } catch (e: Exception) {
        null
    }
}

/**
 * Convert WMO weather code to an emoji representation.
 * Based on Open-Meteo WMO weather interpretation codes.
 */
private fun weatherCodeToEmoji(code: Int): String {
    return when (code) {
        0 -> "☀️"          // Clear sky
        1, 2, 3 -> "⛅"    // Partly cloudy
        45, 48 -> "🌫️"    // Fog
        51, 53, 55 -> "🌦️" // Drizzle
        56, 57 -> "🌧️"    // Freezing drizzle
        61, 63, 65 -> "🌧️" // Rain
        66, 67 -> "🌨️"    // Freezing rain
        71, 73, 75 -> "❄️" // Snow
        77 -> "🌨️"        // Snow grains
        80, 81, 82 -> "🌧️" // Rain showers
        85, 86 -> "🌨️"    // Snow showers
        95 -> "⛈️"        // Thunderstorm
        96, 99 -> "⛈️"    // Thunderstorm with hail
        else -> "🌤️"      // Default
    }
}

/**
 * Returns true if the chit is overdue (has a due date in the past and status is not Complete).
 */
fun isOverdue(chit: ChitEntity): Boolean {
    if (chit.status == "Complete" || chit.status == "Rejected") return false
    val dueStr = chit.dueDatetime ?: return false
    return try {
        val due = if (dueStr.contains("T")) {
            LocalDateTime.parse(dueStr.replace("Z", ""), DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                .toLocalDate()
        } else {
            LocalDate.parse(dueStr, DateTimeFormatter.ISO_LOCAL_DATE)
        }
        due.isBefore(LocalDate.now())
    } catch (e: Exception) {
        false
    }
}

/**
 * Returns a Modifier that adds a red border if the chit is overdue.
 */
fun Modifier.overdueBorder(chit: ChitEntity): Modifier {
    return if (isOverdue(chit)) {
        this.border(2.dp, Color(0xFFB22222), RoundedCornerShape(12.dp))
    } else {
        this
    }
}

// ─── B7: Location/Map Indicator ─────────────────────────────────────────────────

/**
 * Shows a location indicator on cards that have a location set.
 * When showMapThumbnail is true, displays an OSM tile image with a pin overlay
 * (matching the web's _buildMapThumbnail behavior). Falls back to pin icon + text
 * when geocoding hasn't resolved yet or thumbnails are disabled.
 *
 * @param location The location text string from the chit
 * @param showMapThumbnail Whether to show the OSM tile thumbnail (from show_map_thumbnails setting)
 * @param modifier Modifier for the composable
 * @param textColor Optional text color override
 */
@Composable
fun LocationIndicator(
    location: String?,
    modifier: Modifier = Modifier,
    showMapThumbnail: Boolean = false,
    textColor: Color? = null
) {
    if (location.isNullOrBlank()) return

    if (showMapThumbnail) {
        // Async geocode and show map tile
        var geoResult by remember { mutableStateOf<com.cwoc.app.ui.util.GeocodingUtil.GeoResult?>(null) }
        var geocodeFailed by remember { mutableStateOf(false) }

        LaunchedEffect(location) {
            val result = GeocodingUtil.geocode(location)
            if (result != null) {
                geoResult = result
            } else {
                geocodeFailed = true
            }
        }

        if (geoResult != null) {
            // Show OSM tile thumbnail with pin overlay (matching web's _renderMapTile)
            val tileUrl = remember(geoResult) {
                val lat = geoResult!!.lat
                val lon = geoResult!!.lon
                val zoom = 14
                val tileX = ((lon + 180.0) / 360.0 * Math.pow(2.0, zoom.toDouble())).toInt()
                val latRad = Math.toRadians(lat)
                val tileY = ((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0 * Math.pow(2.0, zoom.toDouble())).toInt()
                "https://tile.openstreetmap.org/$zoom/$tileX/$tileY.png"
            }

            Box(
                modifier = modifier
                    .fillMaxWidth()
                    .height(60.dp)
                    .clip(RoundedCornerShape(4.dp)),
                contentAlignment = Alignment.Center
            ) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(tileUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = "Map of $location",
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(60.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    contentScale = ContentScale.Crop
                )
                // Pin overlay
                Text(
                    text = "📍",
                    fontSize = 16.sp,
                    modifier = Modifier.align(Alignment.Center)
                )
            }
        } else {
            // Fallback: pin icon + text while geocoding or if failed
            Row(
                modifier = modifier,
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                Text(
                    text = "📍",
                    style = MaterialTheme.typography.labelSmall
                )
                Text(
                    text = location,
                    style = MaterialTheme.typography.labelSmall,
                    color = textColor ?: MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    } else {
        // Simple pin icon + text (no thumbnail)
        Row(
            modifier = modifier,
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp)
        ) {
            Text(
                text = "📍",
                style = MaterialTheme.typography.labelSmall
            )
            Text(
                text = location,
                style = MaterialTheme.typography.labelSmall,
                color = textColor ?: MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

// ─── B8: Sharing/Stealth Indicators ─────────────────────────────────────────────

/**
 * Shows sharing and stealth indicators on a card.
 */
@Composable
fun SharingIndicators(
    chit: ChitEntity,
    modifier: Modifier = Modifier
) {
    val hasShares = !chit.shares.isNullOrBlank() && chit.shares != "[]"
    val isStealth = chit.stealth == true

    if (!hasShares && !isStealth) return

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        if (hasShares) {
            Text(
                text = "🔗",
                style = MaterialTheme.typography.labelSmall
            )
        }
        if (isStealth) {
            Text(
                text = "🥷",
                style = MaterialTheme.typography.labelSmall
            )
        }
    }
}

// ─── B9: Archive/Snooze Indicators ──────────────────────────────────────────────

/**
 * Shows archive and snooze indicators on a card.
 */
@Composable
fun ArchiveSnoozeIndicators(
    chit: ChitEntity,
    modifier: Modifier = Modifier
) {
    val isArchived = chit.archived
    val isSnoozed = !chit.snoozedUntil.isNullOrBlank()

    if (!isArchived && !isSnoozed) return

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        if (isArchived) {
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = MaterialTheme.colorScheme.surfaceVariant
            ) {
                Text(
                    text = "📦 Archived",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                )
            }
        }
        if (isSnoozed) {
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = MaterialTheme.colorScheme.tertiaryContainer
            ) {
                Text(
                    text = "💤 Snoozed",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                )
            }
        }
    }
}

// ─── B12: Display Options (fade past, highlight overdue) ────────────────────────

/**
 * Returns a Modifier that applies reduced opacity to cards for past events.
 * An event is "past" if its end datetime (or start datetime if no end) is before now.
 * Only applies when the user's "fade past events" setting is enabled.
 *
 * @param chit The chit entity to check
 * @param fadePastEnabled Whether the "fade past events" setting is on
 */
fun Modifier.fadePastEvent(chit: ChitEntity, fadePastEnabled: Boolean = true): Modifier {
    if (!fadePastEnabled) return this
    val isPast = isPastEvent(chit)
    return if (isPast) {
        this.alpha(0.5f)
    } else {
        this
    }
}

/**
 * Check if a chit's event time is in the past.
 */
fun isPastEvent(chit: ChitEntity): Boolean {
    val dateStr = chit.endDatetime ?: chit.startDatetime ?: chit.pointInTime ?: return false
    return try {
        if (dateStr.contains("T")) {
            val dt = LocalDateTime.parse(dateStr.replace("Z", ""), DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            dt.isBefore(LocalDateTime.now())
        } else {
            val d = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE)
            d.isBefore(LocalDate.now())
        }
    } catch (e: Exception) {
        false
    }
}

// ─── B10: Health/Visual Indicators ──────────────────────────────────────────────

/**
 * Shows health indicator badges on cards that have health data.
 * Parses the healthData JSON and shows the latest value for each indicator type.
 * Health data format: {"type_name": [{"value": 120, "date": "2026-01-01"}, ...], ...}
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HealthIndicatorBadges(
    healthDataJson: String?,
    modifier: Modifier = Modifier
) {
    if (healthDataJson.isNullOrBlank()) return

    val indicators = remember(healthDataJson) { parseHealthIndicators(healthDataJson) }
    if (indicators.isEmpty()) return

    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        indicators.take(3).forEach { (name, latestValue) ->
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = MaterialTheme.colorScheme.tertiaryContainer
            ) {
                Text(
                    text = "$name: $latestValue",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                )
            }
        }
        if (indicators.size > 3) {
            Text(
                text = "+${indicators.size - 3}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Parse health data JSON and return a list of (indicator name, latest value string).
 */
private fun parseHealthIndicators(json: String): List<Pair<String, String>> {
    return try {
        val gson = Gson()
        val type = object : TypeToken<Map<String, Any>>() {}.type
        val data: Map<String, Any> = gson.fromJson(json, type)
        data.mapNotNull { (key, value) ->
            when (value) {
                is List<*> -> {
                    // Array of readings — get the last one
                    val readings = value.filterIsInstance<Map<*, *>>()
                    val latest = readings.lastOrNull()
                    val latestVal = latest?.get("value")?.toString() ?: return@mapNotNull null
                    key to latestVal
                }
                is Number -> key to value.toString()
                is String -> key to value
                else -> null
            }
        }
    } catch (e: Exception) {
        emptyList()
    }
}

// ─── B13: Pinned Sort Helper ────────────────────────────────────────────────────

/**
 * Sort a list of chits with pinned items first, preserving the existing order within each group.
 */
fun <T : Any> sortPinnedFirst(items: List<T>, isPinned: (T) -> Boolean): List<T> {
    val pinned = items.filter { isPinned(it) }
    val unpinned = items.filter { !isPinned(it) }
    return pinned + unpinned
}

// ─── B14: Snooze Filter ─────────────────────────────────────────────────────────

/**
 * Filter out snoozed items whose snooze period has not yet expired.
 * A chit is hidden if its `snoozedUntil` datetime is in the future.
 *
 * @param items List of chits to filter
 * @param hideSnoozed Whether to hide snoozed items (from user settings)
 */
fun filterSnoozedItems(items: List<ChitEntity>, hideSnoozed: Boolean = true): List<ChitEntity> {
    if (!hideSnoozed) return items
    val now = LocalDateTime.now()
    return items.filter { chit ->
        val snoozedUntil = chit.snoozedUntil
        if (snoozedUntil.isNullOrBlank()) {
            true // Not snoozed — show it
        } else {
            try {
                val snoozeEnd = LocalDateTime.parse(
                    snoozedUntil.replace("Z", ""),
                    DateTimeFormatter.ISO_LOCAL_DATE_TIME
                )
                // Show the item if snooze has expired (snoozeEnd is in the past)
                snoozeEnd.isBefore(now)
            } catch (e: Exception) {
                true // Can't parse — show it
            }
        }
    }
}

// ─── B15: RSVP Indicators ───────────────────────────────────────────────────────

/**
 * Shows RSVP status indicators for shared chits on cards.
 * Displays ✓ (accepted), ✗ (declined), or ⏳ (invited) for each shared user.
 * Also shows accept/decline action buttons for the current user if they're a shared user.
 * Matches the web's cwoc-rsvp-indicators + cwoc-rsvp-actions behavior.
 *
 * @param sharesJson The shares JSON string from the chit (array of {user_id, role, display_name, rsvp_status})
 * @param chitId The chit ID (needed for RSVP action API calls)
 * @param onRsvpAction Callback when user taps accept/decline: (chitId, rsvpStatus) -> Unit
 */
@Composable
fun RsvpIndicators(
    sharesJson: String?,
    modifier: Modifier = Modifier,
    chitId: String? = null,
    onRsvpAction: ((String, String) -> Unit)? = null
) {
    if (sharesJson.isNullOrBlank() || sharesJson == "[]") return

    val shares = remember(sharesJson) {
        try {
            val type = object : TypeToken<List<Map<String, Any?>>>() {}.type
            Gson().fromJson<List<Map<String, Any?>>>(sharesJson, type) ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }

    if (shares.isEmpty()) return

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // RSVP status indicators for each shared user
        shares.forEach { share ->
            val rsvpStatus = (share["rsvp_status"] as? String) ?: "invited"
            val displayName = (share["display_name"] as? String)
                ?: (share["user_id"] as? String)
                ?: "Unknown"
            val (icon, color) = when (rsvpStatus) {
                "accepted" -> "✓" to Color(0xFF388E3C)
                "declined" -> "✗" to Color(0xFFD32F2F)
                else -> "⏳" to Color(0xFF795548)
            }
            Text(
                text = icon,
                style = MaterialTheme.typography.labelSmall,
                color = color,
                fontWeight = FontWeight.Bold
            )
        }

        // RSVP action buttons (accept/decline) if callback provided
        if (onRsvpAction != null && chitId != null) {
            Spacer(modifier = Modifier.width(4.dp))
            Surface(
                onClick = { onRsvpAction(chitId, "accepted") },
                shape = RoundedCornerShape(4.dp),
                color = Color(0xFF388E3C).copy(alpha = 0.15f)
            ) {
                Text(
                    text = "✓",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF388E3C),
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
            Surface(
                onClick = { onRsvpAction(chitId, "declined") },
                shape = RoundedCornerShape(4.dp),
                color = Color(0xFFD32F2F).copy(alpha = 0.15f)
            ) {
                Text(
                    text = "✗",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFD32F2F),
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }
    }
}
