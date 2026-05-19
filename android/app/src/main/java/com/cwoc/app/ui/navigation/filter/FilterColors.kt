package com.cwoc.app.ui.navigation.filter

import androidx.compose.ui.graphics.Color
import kotlin.math.abs

/**
 * Parchment theme color constants for the filter panel.
 * Matches the web sidebar's CSS variables and inline colors.
 */
val FilterParchmentBg = Color(0xFFFFFAF0)          // #fffaf0
val FilterParchmentLight = Color(0xFFF5E6CC)       // #f5e6cc
val FilterBrownBorder = Color(0xFF6B4E31)          // #6b4e31
val FilterBrownPrimary = Color(0xFF8B5A2B)         // #8b5a2b
val FilterBrownText = Color(0xFF4A2C2A)            // #4a2c2a
val FilterBrownDark = Color(0xFF3B1F0A)            // #3b1f0a
val FilterHeaderBrown = Color(0xFF4A3728)          // #4a3728
val FilterDarkestBrown = Color(0xFF1A1208)         // #1a1208 (user chip border)
val FilterDefaultChipColor = Color(0xFFD2B48C)     // #d2b48c (tan fallback)
val FilterSelectedOutline = Color(0xFF4A2C2A)      // #4a2c2a (selected chip outline)
val FilterSeparatorColor = Color(0xFFC4A882)       // #c4a882 (dashed separator)

/**
 * Generate a deterministic pastel color from a tag name.
 * Matches the web's getPastelColor() behavior.
 */
fun generatePastelColor(name: String): Color {
    val hash = abs(name.hashCode())
    val hue = (hash % 360).toFloat()
    return Color.hsl(hue, 0.4f, 0.8f)
}

/**
 * Determine if a color is "light" based on luminance.
 * Used to pick dark or light text color for contrast.
 * Matches the web's isLightColor() function.
 */
fun isLightColor(color: Color): Boolean {
    val luminance = 0.299 * color.red + 0.587 * color.green + 0.114 * color.blue
    return luminance > 0.5
}

/**
 * Parse a hex color string (e.g., "#6B4E31" or "6B4E31") to a Compose Color.
 * Returns the fallback color if parsing fails.
 */
fun parseHexColor(hex: String?, fallback: Color = FilterDefaultChipColor): Color {
    if (hex.isNullOrBlank()) return fallback
    return try {
        val cleaned = hex.removePrefix("#")
        val colorLong = cleaned.toLong(16)
        if (cleaned.length == 6) {
            Color(0xFF000000 or colorLong)
        } else if (cleaned.length == 8) {
            Color(colorLong)
        } else {
            fallback
        }
    } catch (_: Exception) {
        fallback
    }
}
