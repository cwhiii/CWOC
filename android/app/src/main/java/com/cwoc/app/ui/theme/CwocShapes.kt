package com.cwoc.app.ui.theme

import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/**
 * Hexagonal clip-path shape for point-in-time (zero-duration) calendar events.
 * Matches web CSS: clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 50%,
 *                                      calc(100% - 8px) 100%, 8px 100%, 0% 50%)
 */
val PointInTimeShape: Shape = object : Shape {
    override fun createOutline(
        size: Size,
        layoutDirection: LayoutDirection,
        density: Density
    ): Outline {
        val notch = with(density) { 8.dp.toPx() }
        val path = Path().apply {
            moveTo(notch, 0f)
            lineTo(size.width - notch, 0f)
            lineTo(size.width, size.height / 2f)
            lineTo(size.width - notch, size.height)
            lineTo(notch, size.height)
            lineTo(0f, size.height / 2f)
            close()
        }
        return Outline.Generic(path)
    }
}

/**
 * Concave-notch clip-path shape for birthday all-day event chips.
 * Matches web CSS: clip-path for `.birthday-chip` — inward-pointing notches on left and right edges.
 * Shape: left edge notches inward at midpoint, right edge notches inward at midpoint.
 */
val BirthdayChipShape: Shape = object : Shape {
    override fun createOutline(
        size: Size,
        layoutDirection: LayoutDirection,
        density: Density
    ): Outline {
        val notch = with(density) { 8.dp.toPx() }
        val path = Path().apply {
            moveTo(0f, 0f)
            lineTo(notch, size.height / 2f)
            lineTo(0f, size.height)
            lineTo(size.width, size.height)
            lineTo(size.width - notch, size.height / 2f)
            lineTo(size.width, 0f)
            close()
        }
        return Outline.Generic(path)
    }
}
