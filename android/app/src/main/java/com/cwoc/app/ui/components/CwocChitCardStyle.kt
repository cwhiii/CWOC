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
 */
object CwocChitCardStyle {
    /** Brown border matching web's #8b5a2b */
    val BorderColor = Color(0xFF8B5A2B)

    /** Dark text color matching web's #2b1e0f */
    val TextColor = Color(0xFF2B1E0F)

    /** Transparent/parchment card background — lets the page parchment show through */
    val CardBackground = Color(0xFFFDF5E6) // Parchment light — matches web's implicit background

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
}
