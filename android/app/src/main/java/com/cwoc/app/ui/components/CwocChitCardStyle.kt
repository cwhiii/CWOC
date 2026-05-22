package com.cwoc.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.CardColors
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CardElevation
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Shared chit card styling that matches the mobile web's parchment aesthetic.
 *
 * Web CSS reference (.chit-card):
 *   border: 2px solid #8b5a2b
 *   border-radius: 6px
 *   color: #2b1e0f
 *   font-family: 'Lora', Georgia, serif
 *   background: transparent (parchment page background shows through)
 *
 * All chit cards across all views (Tasks, Notes, Checklists, Alarms, Projects,
 * Calendar, Email, OmniView) should use these defaults for visual consistency
 * with the mobile web version.
 *
 * COLOR BEHAVIOR (matching web's applyChitColors):
 * The web app sets the chit's color as the FULL BACKGROUND of the card, with
 * auto-contrast text (dark on light backgrounds, light on dark). When a chit
 * has no color, the default parchment cream (#fdf6e3) is used.
 */
object CwocChitCardStyle {
    /** Brown border matching web's #8b5a2b */
    val BorderColor = Color(0xFF8B5A2B)

    /** Dark text color matching web's #2b1e0f */
    val TextColor = Color(0xFF2B1E0F)

    /** Transparent/parchment card background — lets the page parchment show through */
    val CardBackground = Color(0xFFFDF5E6) // Parchment light — matches web's implicit background

    /** Default cream used by web's chitColor() when no color is set */
    val DefaultChitColor = Color(0xFFFDF6E3)

    /** Card border stroke matching web's 2px solid #8b5a2b */
    val cardBorder = BorderStroke(2.dp, BorderColor)

    /** Card colors: parchment background, no elevation shadow */
    @Composable
    fun cardColors(): CardColors = CardDefaults.cardColors(
        containerColor = CardBackground
    )

    /** No elevation — web cards have no box-shadow by default */
    @Composable
    fun cardElevation(): CardElevation = CardDefaults.cardElevation(
        defaultElevation = 0.dp
    )

    /**
     * Resolve a chit's color string to a background Color.
     * Matches web's chitColor(chit) function:
     * - If color is null/blank/transparent → default parchment cream
     * - Otherwise → the parsed hex color
     */
    fun resolveChitBgColor(colorHex: String?): Color {
        if (colorHex.isNullOrBlank() || colorHex == "transparent") return DefaultChitColor
        return parseHexColor(colorHex) ?: DefaultChitColor
    }

    /**
     * Compute the contrast text color for a given background.
     * Matches web's contrastColorForBg(hex) function EXACTLY:
     *   lum = (r*299 + g*587 + b*114) / 1000  (on 0-255 scale)
     *   return dark '#2b1e0f' if lum > 150, else light '#fdf5e6'
     *
     * THIS IS THE SINGLE SOURCE OF TRUTH for contrast color in the entire app.
     * Do NOT create local/private versions of this function elsewhere.
     */
    fun contrastTextColor(bgColor: Color): Color {
        val r = (bgColor.red * 255).toInt()
        val g = (bgColor.green * 255).toInt()
        val b = (bgColor.blue * 255).toInt()
        val lum = (r * 299 + g * 587 + b * 114) / 1000
        return if (lum > 150) Color(0xFF2B1E0F) else Color(0xFFFDF5E6)
    }

    /**
     * Returns true if the background is "light" (dark text should be used).
     * Same threshold as contrastTextColor — just returns a boolean.
     */
    fun isLightBackground(bgColor: Color): Boolean {
        val r = (bgColor.red * 255).toInt()
        val g = (bgColor.green * 255).toInt()
        val b = (bgColor.blue * 255).toInt()
        val lum = (r * 299 + g * 587 + b * 114) / 1000
        return lum > 150
    }

    /**
     * Overload: check if a hex color string is "light".
     * Returns true for null/blank/transparent (parchment default is light).
     */
    fun isLightBackground(hex: String?): Boolean {
        if (hex.isNullOrBlank() || hex == "transparent") return true
        val bg = parseHexColor(hex) ?: return true
        return isLightBackground(bg)
    }

    /**
     * Card colors with the chit's color as full background.
     * This matches the web's applyChitColors(el, chitColor(chit)) behavior.
     */
    @Composable
    fun cardColorsForChit(colorHex: String?): CardColors {
        val bg = resolveChitBgColor(colorHex)
        return CardDefaults.cardColors(containerColor = bg)
    }
}
