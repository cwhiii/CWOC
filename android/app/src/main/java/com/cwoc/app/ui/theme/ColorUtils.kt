package com.cwoc.app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Utility functions for contact color theming and auto-contrast text.
 * Matches the web's applyChitColors() behavior.
 */
object ColorUtils {

    /** Dark text color for light backgrounds */
    private val DarkText = Color(0xFF1A1208)

    /** Light text color for dark backgrounds */
    private val LightText = Color(0xFFFFFAF0)

    /** The 20-color palette matching the web contact editor */
    val ContactColorPalette = listOf(
        "#E3B23C", "#D4764E", "#D45B5B", "#C2185B", "#7B1FA2",
        "#512DA8", "#303F9F", "#1976D2", "#0097A7", "#00897B",
        "#388E3C", "#689F38", "#AFB42B", "#F9A825", "#FF8F00",
        "#D84315", "#795548", "#546E7A", "#8D6E63", "#E91E63"
    )

    /**
     * Parse a hex color string (e.g. "#E3B23C") into a Compose Color.
     * Returns null if the string is invalid.
     */
    fun parseHexColor(hex: String?): Color? {
        if (hex.isNullOrBlank()) return null
        val cleaned = hex.trim().removePrefix("#")
        if (cleaned.length != 6 && cleaned.length != 8) return null
        return try {
            val colorLong = cleaned.toLong(16)
            if (cleaned.length == 6) {
                Color(0xFF000000 or colorLong)
            } else {
                Color(colorLong)
            }
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Compute the auto-contrast text color for a given background color.
     * Uses the W3C relative luminance formula to determine if text should be dark or light.
     */
    fun computeAutoContrast(backgroundColor: Color): Color {
        val luminance = 0.299 * backgroundColor.red +
                0.587 * backgroundColor.green +
                0.114 * backgroundColor.blue
        return if (luminance > 0.5) DarkText else LightText
    }

    /**
     * Given a contact's color hex string, return a pair of (background, text) colors
     * suitable for rendering a contact row or editor background.
     * The background is the parsed color at reduced opacity for subtlety.
     * Returns null if the color string is invalid or blank.
     */
    fun applyContactRowColors(colorHex: String?): Pair<Color, Color>? {
        val bgColor = parseHexColor(colorHex) ?: return null
        // Use the color at ~20% opacity for row background (subtle tint)
        val tintedBg = bgColor.copy(alpha = 0.2f)
        val textColor = computeAutoContrast(bgColor)
        return Pair(tintedBg, textColor)
    }

    /**
     * Given a contact's color hex string, return the solid border color.
     */
    fun contactBorderColor(colorHex: String?): Color? {
        return parseHexColor(colorHex)
    }
}
