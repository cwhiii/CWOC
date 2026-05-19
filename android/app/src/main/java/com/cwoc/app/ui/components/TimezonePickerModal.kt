package com.cwoc.app.ui.components

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.cwoc.app.ui.theme.LoraFontFamily
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.ZoneId
import java.util.TimeZone

// ═══════════════════════════════════════════════════════════════════════════
// Colors matching web spec Section 9
// ═══════════════════════════════════════════════════════════════════════════
private val TzOverlayBg = Color(0x80000000) // rgba(0,0,0,0.5)
private val TzModalBg = Color(0xFFFFFAF0)
private val TzModalBorder = Color(0xFF6B4E31)
private val TzTitleColor = Color(0xFF4A2C2A)
private val TzHintColor = Color(0xFF8B5A2B)
private val TzStatusGreen = Color(0xFF2E7D32)
private val TzStatusWarning = Color(0xFFE65100)
private val TzInputBg = Color(0xFFFFF8F0)
private val TzInputBorder = Color(0xFFA0522D)
private val TzInputFocusBorder = Color(0xFF008080) // teal
private val TzInputFocusShadow = Color(0x33008080) // rgba(0,128,128,0.2)
private val TzPlaceholderColor = Color(0xFFC9B896)
private val TzInputTextColor = Color(0xFF1A1208)
private val TzItemTextColor = Color(0xFF1A1208)
private val TzItemSelectedColor = Color(0xFF008080)

// Zone button colors
private val TzBtnBg = Color(0xFFA0522D)
private val TzBtnText = Color(0xFFFDF5E6)
private val TzBtnBorder = Color(0xFF8B4513)

/**
 * 18 common timezone entries shown at the top of the list.
 * Matches the web's _COMMON_TZ_ENTRIES exactly.
 * Format: "ABBR - Display Name (IANA ID)"
 */
private data class CommonTzEntry(val iana: String, val name: String)

private val COMMON_TZ_ENTRIES = listOf(
    CommonTzEntry("America/New_York", "Eastern Time"),
    CommonTzEntry("America/Chicago", "Central Time"),
    CommonTzEntry("America/Denver", "Mountain Time"),
    CommonTzEntry("America/Los_Angeles", "Pacific Time"),
    CommonTzEntry("America/Anchorage", "Alaska Time"),
    CommonTzEntry("Pacific/Honolulu", "Hawaii Time"),
    CommonTzEntry("Europe/London", "United Kingdom"),
    CommonTzEntry("Europe/Paris", "Central European Time"),
    CommonTzEntry("Europe/Helsinki", "Eastern European Time"),
    CommonTzEntry("Europe/Moscow", "Moscow Time"),
    CommonTzEntry("Asia/Dubai", "Gulf Standard Time"),
    CommonTzEntry("Asia/Kolkata", "India Standard Time"),
    CommonTzEntry("Asia/Bangkok", "Indochina Time"),
    CommonTzEntry("Asia/Shanghai", "China Standard Time"),
    CommonTzEntry("Asia/Tokyo", "Japan Standard Time"),
    CommonTzEntry("Australia/Sydney", "Australian Eastern Time"),
    CommonTzEntry("Australia/Adelaide", "Australian Central Time"),
    CommonTzEntry("Australia/Perth", "Australian Western Time"),
    CommonTzEntry("Pacific/Auckland", "New Zealand Time")
)

/**
 * All available IANA timezone IDs from the platform.
 */
private val ALL_TIMEZONES: List<String> by lazy {
    ZoneId.getAvailableZoneIds().sorted()
}

/**
 * Format a common timezone entry for display in the list.
 * Format: "MST - Mountain Time (America/Denver)"
 */
private fun formatCommonTzDisplay(entry: CommonTzEntry): String {
    val abbr = getTimezoneAbbreviation(entry.iana)
    return "$abbr - ${entry.name} (${entry.iana})"
}

/**
 * Get the short timezone abbreviation for an IANA timezone ID.
 * e.g., "America/Denver" → "MST"
 */
private fun getTimezoneAbbreviation(tzId: String): String {
    return try {
        val tz = TimeZone.getTimeZone(tzId)
        tz.getDisplayName(tz.useDaylightTime(), TimeZone.SHORT)
    } catch (_: Exception) {
        tzId.substringAfterLast('/')
    }
}

/**
 * Check if a string is a valid IANA timezone.
 */
private fun isValidTimezone(tz: String): Boolean {
    if (tz.isBlank()) return false
    return ALL_TIMEZONES.any { it.equals(tz, ignoreCase = true) }
}

/**
 * Find the exact IANA timezone matching the input (case-insensitive).
 */
private fun findExactTimezone(input: String): String? {
    if (input.isBlank()) return null
    return ALL_TIMEZONES.find { it.equals(input, ignoreCase = true) }
}

/**
 * Data class for geocoding results used by the timezone picker.
 */
private data class TzGeocodeResult(
    val lat: Double,
    val lon: Double,
    val countryCode: String?,
    val displayName: String?
)

/**
 * Perform geocoding via the server's /api/geocode endpoint.
 * Returns null on failure.
 */
private suspend fun geocodeForTimezone(query: String, context: Context): TzGeocodeResult? {
    return withContext(Dispatchers.IO) {
        try {
            // Try cwoc_prefs first (used by ChitEditorScreen), then cwoc_secure_prefs
            val prefs = context.getSharedPreferences("cwoc_prefs", Context.MODE_PRIVATE)
            var serverUrl = prefs.getString("server_url", null)
            var token = prefs.getString("auth_token", null)
            if (serverUrl.isNullOrBlank()) {
                val securePrefs = context.getSharedPreferences("cwoc_secure_prefs", Context.MODE_PRIVATE)
                serverUrl = securePrefs.getString("server_url", null)
                token = securePrefs.getString("device_token", null)
            }
            if (serverUrl.isNullOrBlank()) return@withContext null

            val encoded = URLEncoder.encode(query.trim(), "UTF-8")
            val url = URL("${serverUrl.trimEnd('/')}/api/geocode?q=$encoded")
            val connection = url.openConnection() as HttpURLConnection
            connection.setRequestProperty("User-Agent", "CWOC-Android/1.0")
            // Add auth token if available
            if (!token.isNullOrBlank()) {
                connection.setRequestProperty("Authorization", "Bearer $token")
            }
            connection.connectTimeout = 8000
            connection.readTimeout = 8000

            val responseCode = connection.responseCode
            if (responseCode != 200) return@withContext null

            val response = connection.inputStream.bufferedReader().readText()
            val json = JSONObject(response)
            val results = json.optJSONArray("results")
            if (results == null || results.length() == 0) return@withContext null

            val first = results.getJSONObject(0)
            TzGeocodeResult(
                lat = first.getDouble("lat"),
                lon = first.getDouble("lon"),
                countryCode = first.optString("country_code", null),
                displayName = first.optString("display_name", null)
            )
        } catch (e: Exception) {
            android.util.Log.e("CWOC_TZ", "Geocode for timezone failed: ${e.message}")
            null
        }
    }
}

/**
 * Detect timezone from coordinates using a simple longitude-based heuristic.
 * This matches the web's _detectTimezoneFromCoords approach.
 * For more accuracy, the web uses a lookup table — we approximate here.
 *
 * Made internal so LocationZone can use it for timezone suggestion detection.
 */
internal fun detectTimezoneFromCoords(lat: Double, lon: Double, countryCode: String?): String? {
    // Use country code + longitude to make a reasonable guess
    // This is a simplified version — the web has a more complete lookup
    return when {
        countryCode?.uppercase() == "US" -> when {
            lon > -67.0 -> "America/New_York"      // Eastern
            lon > -87.0 -> "America/New_York"      // Eastern
            lon > -90.0 -> "America/Chicago"       // Central
            lon > -105.0 -> "America/Chicago"      // Central
            lon > -115.0 -> "America/Denver"       // Mountain
            lon > -125.0 -> "America/Los_Angeles"  // Pacific
            lon > -145.0 -> "America/Anchorage"    // Alaska
            else -> "Pacific/Honolulu"             // Hawaii
        }
        countryCode?.uppercase() == "CA" -> when {
            lon > -67.0 -> "America/Halifax"
            lon > -90.0 -> "America/Toronto"
            lon > -105.0 -> "America/Winnipeg"
            lon > -115.0 -> "America/Edmonton"
            else -> "America/Vancouver"
        }
        countryCode?.uppercase() == "GB" || countryCode?.uppercase() == "IE" -> "Europe/London"
        countryCode?.uppercase() == "DE" || countryCode?.uppercase() == "FR" ||
        countryCode?.uppercase() == "ES" || countryCode?.uppercase() == "IT" ||
        countryCode?.uppercase() == "NL" || countryCode?.uppercase() == "BE" ||
        countryCode?.uppercase() == "AT" || countryCode?.uppercase() == "CH" -> "Europe/Paris"
        countryCode?.uppercase() == "RU" -> "Europe/Moscow"
        countryCode?.uppercase() == "IN" -> "Asia/Kolkata"
        countryCode?.uppercase() == "CN" -> "Asia/Shanghai"
        countryCode?.uppercase() == "JP" -> "Asia/Tokyo"
        countryCode?.uppercase() == "AU" -> when {
            lon > 145.0 -> "Australia/Sydney"
            lon > 135.0 -> "Australia/Adelaide"
            else -> "Australia/Perth"
        }
        countryCode?.uppercase() == "NZ" -> "Pacific/Auckland"
        else -> {
            // Fallback: use longitude to estimate UTC offset
            val offsetHours = (lon / 15.0).toInt()
            when (offsetHours) {
                in -12..-10 -> "Pacific/Honolulu"
                in -9..-9 -> "America/Anchorage"
                in -8..-8 -> "America/Los_Angeles"
                in -7..-7 -> "America/Denver"
                in -6..-6 -> "America/Chicago"
                in -5..-5 -> "America/New_York"
                in -4..-3 -> "America/Halifax"
                0 -> "Europe/London"
                1 -> "Europe/Paris"
                2 -> "Europe/Helsinki"
                3 -> "Europe/Moscow"
                in 4..4 -> "Asia/Dubai"
                in 5..5 -> "Asia/Kolkata"
                in 6..7 -> "Asia/Bangkok"
                8 -> "Asia/Shanghai"
                9 -> "Asia/Tokyo"
                in 10..11 -> "Australia/Sydney"
                12 -> "Pacific/Auckland"
                else -> null
            }
        }
    }
}

/**
 * Timezone picker modal matching the web's tz picker (Section 9 of the spec).
 *
 * Features:
 * - Centered overlay modal with parchment styling
 * - Search input with datalist-style autocomplete (18 common + all IANA)
 * - Auto-validate: when typed text matches a valid IANA timezone, auto-close after 200ms
 * - Geocoding: when Enter pressed with non-timezone text, calls /api/geocode
 * - Pre-fill when timezone already set
 * - Tap outside / back button closes without changes
 *
 * @param currentTimezone Currently set timezone (null = floating)
 * @param onTimezoneSelected Called with the selected timezone ID
 * @param onClear Called when user clears timezone (reverts to floating)
 * @param onCancel Called when modal is dismissed without changes
 * @param onLocationGeocoded Optional callback when geocoding populates a location address
 */
@Composable
fun TimezonePickerModal(
    currentTimezone: String?,
    onTimezoneSelected: (String) -> Unit,
    onClear: () -> Unit,
    onCancel: () -> Unit,
    onLocationGeocoded: ((String) -> Unit)? = null
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val focusRequester = remember { FocusRequester() }
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    // State
    var searchQuery by remember { mutableStateOf(currentTimezone ?: "") }
    var statusText by remember { mutableStateOf(if (currentTimezone != null) "✓ $currentTimezone" else "") }
    var statusColor by remember { mutableStateOf(TzStatusGreen) }
    var shouldAutoClose by remember { mutableStateOf(false) }
    var autoCloseTimezone by remember { mutableStateOf<String?>(null) }
    var isGeocoding by remember { mutableStateOf(false) }

    // 3.10/3.11: Auto-close after valid selection (200ms delay)
    LaunchedEffect(shouldAutoClose, autoCloseTimezone) {
        if (shouldAutoClose && autoCloseTimezone != null) {
            delay(200)
            onTimezoneSelected(autoCloseTimezone!!)
        }
    }

    // Build filtered timezone list based on search query
    val filteredTimezones = remember(searchQuery) {
        if (searchQuery.isBlank()) {
            // Show 18 common entries when empty
            COMMON_TZ_ENTRIES.map { entry ->
                TimezoneListItem(
                    iana = entry.iana,
                    displayText = formatCommonTzDisplay(entry),
                    isCommon = true
                )
            }
        } else {
            val query = searchQuery.lowercase()
            // Search common entries (match against display text and IANA)
            val commonMatches = COMMON_TZ_ENTRIES
                .filter { entry ->
                    entry.iana.lowercase().contains(query) ||
                    entry.name.lowercase().contains(query) ||
                    getTimezoneAbbreviation(entry.iana).lowercase().contains(query)
                }
                .map { entry ->
                    TimezoneListItem(
                        iana = entry.iana,
                        displayText = formatCommonTzDisplay(entry),
                        isCommon = true
                    )
                }
            // Search all IANA timezones (exclude ones already in common matches)
            val commonIanas = commonMatches.map { it.iana }.toSet()
            val allMatches = ALL_TIMEZONES
                .filter { tz -> tz.lowercase().contains(query) && tz !in commonIanas }
                .take(20 - commonMatches.size)
                .map { tz ->
                    TimezoneListItem(
                        iana = tz,
                        displayText = tz,
                        isCommon = false
                    )
                }
            (commonMatches + allMatches)
        }
    }

    // 3.10: Auto-validate as user types — check if typed text matches a valid IANA timezone
    LaunchedEffect(searchQuery) {
        if (searchQuery.isNotBlank() && !shouldAutoClose) {
            val exactMatch = findExactTimezone(searchQuery)
            if (exactMatch != null) {
                statusText = "✓ $exactMatch"
                statusColor = TzStatusGreen
                autoCloseTimezone = exactMatch
                shouldAutoClose = true
            }
        }
    }

    // Request focus on the search input when modal opens
    LaunchedEffect(Unit) {
        delay(100)
        try { focusRequester.requestFocus() } catch (_: Exception) {}
    }

    // 3.1 & 3.18 & 3.19: Dialog with full-screen overlay, tap-outside closes, back button closes
    Dialog(
        onDismissRequest = { onCancel() },
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = true
        )
    ) {
        // 3.1: Full-screen overlay with rgba(0,0,0,0.5), centered content
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(TzOverlayBg)
                // 3.18: Tap outside modal closes without changes
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() }
                ) { onCancel() },
            contentAlignment = Alignment.Center
        ) {
            // 3.2: Modal content box
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.95f) // width 95%
                    .shadow(
                        elevation = 32.dp, // box-shadow 0 8dp 32dp rgba(0,0,0,0.3)
                        shape = RoundedCornerShape(8.dp)
                    )
                    .background(TzModalBg, RoundedCornerShape(8.dp))
                    .border(2.dp, TzModalBorder, RoundedCornerShape(8.dp))
                    // Stop click propagation so tapping inside modal doesn't close it
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { /* consume click */ }
                    .padding(16.dp) // padding 16dp (mobile)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth()
                ) {
                // 3.3: Title "Set Timezone"
                Text(
                    text = "Set Timezone",
                    fontFamily = LoraFontFamily,
                    fontSize = 18.sp, // 1.1em relative to ~16sp base
                    fontWeight = FontWeight.SemiBold,
                    color = TzTitleColor,
                    modifier = Modifier.padding(bottom = 16.dp) // margin 0 0 16dp 0
                )

                // 3.4 & 3.5: Search input with focus styling
                val borderColor = if (isFocused) TzInputFocusBorder else TzInputBorder
                val shadowModifier = if (isFocused) {
                    Modifier.border(2.dp, TzInputFocusShadow, RoundedCornerShape(4.dp))
                } else {
                    Modifier
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 38.dp) // min-height 38dp
                        .then(shadowModifier)
                        .background(TzInputBg, RoundedCornerShape(4.dp))
                        .border(1.dp, borderColor, RoundedCornerShape(4.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp) // padding 8dp 10dp
                ) {
                    BasicTextField(
                        value = searchQuery,
                        onValueChange = { newValue ->
                            searchQuery = newValue
                            shouldAutoClose = false
                            autoCloseTimezone = null
                            if (newValue.isBlank()) {
                                statusText = ""
                            }
                        },
                        singleLine = true,
                        textStyle = TextStyle(
                            fontFamily = LoraFontFamily,
                            fontSize = 16.sp, // font-size 16sp (prevents iOS zoom)
                            color = TzInputTextColor
                        ),
                        cursorBrush = SolidColor(TzInputFocusBorder),
                        interactionSource = interactionSource,
                        modifier = Modifier
                            .fillMaxWidth()
                            .focusRequester(focusRequester),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(
                            onSearch = {
                                // 3.12: Geocoding on Enter with non-timezone text
                                val val_ = searchQuery.trim()
                                if (val_.isNotBlank() && !isValidTimezone(val_)) {
                                    isGeocoding = true
                                    statusText = "🔍 Looking up…"
                                    statusColor = TzStatusGreen
                                    coroutineScope.launch {
                                        val result = geocodeForTimezone(val_, context)
                                        if (result != null) {
                                            val detectedTz = detectTimezoneFromCoords(
                                                result.lat, result.lon, result.countryCode
                                            )
                                            if (detectedTz != null && isValidTimezone(detectedTz)) {
                                                // 3.12: Show success and auto-apply
                                                statusText = "✓ $detectedTz (from \"$val_\")"
                                                statusColor = TzStatusGreen
                                                // 3.14: Populate location with geocoded address
                                                result.displayName?.let { addr ->
                                                    onLocationGeocoded?.invoke(addr)
                                                }
                                                autoCloseTimezone = detectedTz
                                                shouldAutoClose = true
                                            } else {
                                                // 3.13: Could not determine timezone
                                                statusText = "⚠️ No results"
                                                statusColor = TzStatusWarning
                                            }
                                        } else {
                                            // 3.13: Geocoding failure
                                            statusText = "⚠️ No results"
                                            statusColor = TzStatusWarning
                                        }
                                        isGeocoding = false
                                    }
                                }
                            }
                        ),
                        decorationBox = { innerTextField ->
                            Box {
                                if (searchQuery.isEmpty()) {
                                    // 3.4: Placeholder text
                                    Text(
                                        text = "Search timezone or address…",
                                        fontFamily = LoraFontFamily,
                                        fontSize = 16.sp,
                                        fontStyle = FontStyle.Italic,
                                        color = TzPlaceholderColor
                                    )
                                }
                                innerTextField()
                            }
                        }
                    )
                }

                // 3.6: Hint text "(or enter address)"
                Text(
                    text = "(or enter address)",
                    fontFamily = LoraFontFamily,
                    fontSize = 14.sp, // 0.85em
                    fontStyle = FontStyle.Italic,
                    color = TzHintColor,
                    modifier = Modifier.padding(top = 6.dp, bottom = 12.dp) // margin 6dp 0 12dp 0
                )

                // 3.7: Status display
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 20.dp) // min-height 1.2em
                        .padding(bottom = 12.dp) // margin-bottom 12dp
                ) {
                    if (statusText.isNotBlank()) {
                        Text(
                            text = statusText,
                            fontFamily = LoraFontFamily,
                            fontSize = 14.sp, // 0.9em
                            fontWeight = FontWeight.Medium, // font-weight 500
                            color = statusColor
                        )
                    }
                }

                // 3.8 & 3.9: Filtered timezone list (datalist equivalent)
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 200.dp)
                ) {
                    items(filteredTimezones) { item ->
                        val isSelected = item.iana.equals(currentTimezone, ignoreCase = true)
                        Text(
                            text = item.displayText,
                            fontFamily = LoraFontFamily,
                            fontSize = 14.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSelected) TzItemSelectedColor else TzItemTextColor,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    // 3.11: Datalist selection — same as typing a valid timezone
                                    searchQuery = item.iana
                                    statusText = "✓ ${item.iana}"
                                    statusColor = TzStatusGreen
                                    autoCloseTimezone = item.iana
                                    shouldAutoClose = true
                                }
                                .padding(vertical = 8.dp, horizontal = 4.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // 3.15: Action buttons — flex column on mobile, each button width 100%, gap 8dp
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // 3.16: "Clear (floating)" button
                    ZoneButton(
                        text = "Clear (floating)",
                        onClick = {
                            onClear()
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 38.dp) // min-height 38dp
                    )
                    // 3.17: "Cancel" button
                    ZoneButton(
                        text = "Cancel",
                        onClick = { onCancel() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 38.dp) // min-height 38dp
                    )
                }
            } // Column
            } // modal Box
        } // overlay Box
    } // Dialog
}

/**
 * Data class for timezone list items.
 */
private data class TimezoneListItem(
    val iana: String,
    val displayText: String,
    val isCommon: Boolean
)

/**
 * Reusable zone-button styled composable matching the web's .zone-button class.
 * padding 5dp 10dp, font-size 12sp, background #a0522d, color #fdf5e6,
 * border 1dp outset #8b4513, white-space nowrap
 */
@Composable
fun ZoneButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    backgroundColor: Color = TzBtnBg,
    textColor: Color = TzBtnText,
    borderColor: Color = TzBtnBorder
) {
    Box(
        modifier = modifier
            .height(38.dp)
            .background(
                if (enabled) backgroundColor else backgroundColor.copy(alpha = 0.6f),
                RoundedCornerShape(3.dp)
            )
            .border(1.dp, borderColor, RoundedCornerShape(3.dp))
            .clickable(enabled = enabled) { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontFamily = LoraFontFamily,
            fontSize = 12.sp,
            fontWeight = FontWeight.Normal,
            color = textColor
        )
    }
}
