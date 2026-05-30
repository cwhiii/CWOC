package com.cwoc.app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Utility functions for color theming, auto-contrast text, and the unified color palette.
 * Matches the web's shared-utils.js _cwocDefaultColors and applyChitColors() behavior.
 *
 * ALL color pickers in the app (editor, contacts, bundles, settings, tags) MUST use
 * [CwocDefaultColors] as their default palette. Custom colors from user settings are
 * appended at render time by each picker.
 */
object ColorUtils {

    /** Dark text color for light backgrounds — matches web's #2b1e0f */
    private val DarkText = Color(0xFF2B1E0F)

    /** Light text color for dark backgrounds — matches web's #fdf5e6 */
    private val LightText = Color(0xFFFDF5E6)

    /**
     * Unified default color palette — the ONE source of truth for all color pickers.
     * Matches web's _cwocDefaultColors in shared-utils.js exactly.
     * Custom colors from user settings are appended at render time.
     */
    val CwocDefaultColors = listOf(
        "#C66B6B" to "Dusty Rose",
        "#D68A59" to "Burnt Sienna",
        "#E3B23C" to "Golden Ochre",
        "#8A9A5B" to "Mossy Sage",
        "#6B8299" to "Slate Teal",
        "#8B6B99" to "Muted Lilac"
    )

    /** Just the hex values from the unified palette (convenience accessor) */
    val CwocDefaultColorHexes: List<String> = CwocDefaultColors.map { it.first }

    /**
     * Look up a color name from the unified palette by hex value.
     * Falls back to the hex string itself if not found.
     */
    fun colorName(hex: String?): String {
        if (hex.isNullOrBlank()) return "None"
        val match = CwocDefaultColors.find { it.first.equals(hex, ignoreCase = true) }
        return match?.second ?: hex
    }

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
     * Delegates to CwocChitCardStyle.contrastTextColor — the single source of truth.
     */
    fun computeAutoContrast(backgroundColor: Color): Color =
        com.cwoc.app.ui.components.CwocChitCardStyle.contrastTextColor(backgroundColor)

    /**
     * Given a contact's color hex string, return a pair of (background, text) colors
     * suitable for rendering a contact row or editor background.
     * The background is the full solid color (matching the web's applyChitColors behavior).
     * Returns null if the color string is invalid or blank.
     */
    fun applyContactRowColors(colorHex: String?): Pair<Color, Color>? {
        val bgColor = parseHexColor(colorHex) ?: return null
        val textColor = computeAutoContrast(bgColor)
        return Pair(bgColor, textColor)
    }

    /**
     * Given a contact's color hex string, return the solid border color.
     */
    fun contactBorderColor(colorHex: String?): Color? {
        return parseHexColor(colorHex)
    }
}
