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
     * Matches web's contrastColorForBg(hex) function:
     * - luminance > 150 → dark text (#2b1e0f)
     * - luminance <= 150 → light text (#fdf5e6)
     */
    fun contrastTextColor(bgColor: Color): Color {
        val luminance = (bgColor.red * 299f + bgColor.green * 587f + bgColor.blue * 114f) / 1000f
        // Web threshold is 150/255 ≈ 0.588
        return if (luminance > 0.588f) Color(0xFF2B1E0F) else Color(0xFFFDF5E6)
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
