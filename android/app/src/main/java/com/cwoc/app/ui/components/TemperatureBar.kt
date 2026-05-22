package com.cwoc.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * A single gradient stop mapping a temperature (in °C) to a color.
 */
data class TempGradientStop(val tempC: Double, val color: Color)

/**
 * Configuration for the temperature bar.
 *
 * @param barMin Minimum temperature on the scale (-10°C metric, 14°F imperial)
 * @param barMax Maximum temperature on the scale (40°C metric, 104°F imperial)
 * @param dayLow The day's low temperature in the active unit system
 * @param dayHigh The day's high temperature in the active unit system
 * @param unitSystem "metric" or "imperial"
 */
data class TempBarConfig(
    val barMin: Double,
    val barMax: Double,
    val dayLow: Double,
    val dayHigh: Double,
    val unitSystem: String
)

/**
 * Gradient color stops for the temperature bar, defined in °C.
 * Maps from deep blue (extreme cold) through neutral to dark red (extreme heat).
 */
val TEMP_GRADIENT_STOPS = listOf(
    TempGradientStop(-10.0, Color(0xFF001040)),  // Deep blue
    TempGradientStop(0.0, Color(0xFF2166AC)),    // Blue
    TempGradientStop(15.0, Color(0xFFE0DDD4)),   // Neutral
    TempGradientStop(22.0, Color(0xFFF0C830)),   // Yellow
    TempGradientStop(30.0, Color(0xFFD73027)),   // Red
    TempGradientStop(40.0, Color(0xFF3A0000))    // Dark red
)

/**
 * A colored gradient temperature bar showing where a day's temperature range falls
 * within the overall scale. Draws the full gradient at reduced opacity and overlays
 * the day's low-to-high segment at full opacity.
 *
 * Scale: metric [-10, 40]°C, imperial [14, 104]°F.
 *
 * @param config Temperature bar configuration with scale bounds and day temps
 * @param modifier Modifier for sizing and layout
 */
@Composable
fun TemperatureBar(
    config: TempBarConfig,
    modifier: Modifier = Modifier
) {
    val range = config.barMax - config.barMin
    if (range <= 0) return

    // Compute the percentage positions for the day's low and high, clamped to [0, 100]
    val startPct = ((config.dayLow - config.barMin) / range * 100.0)
        .coerceIn(0.0, 100.0)
    val endPct = ((config.dayHigh - config.barMin) / range * 100.0)
        .coerceIn(0.0, 100.0)

    // Build color stops as fractional positions [0..1] for the gradient brush
    val colorStops = TEMP_GRADIENT_STOPS.map { stop ->
        val fraction = ((stop.tempC - (-10.0)) / (40.0 - (-10.0))).toFloat()
            .coerceIn(0f, 1f)
        fraction to stop.color
    }.toTypedArray()

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(8.dp)
    ) {
        val width = size.width
        val height = size.height

        // Draw full gradient at reduced opacity (background context)
        drawRect(
            brush = Brush.horizontalGradient(
                colorStops = colorStops
            ),
            topLeft = Offset.Zero,
            size = Size(width, height),
            alpha = 0.3f
        )

        // Overlay the active segment [startPct, endPct] at full opacity
        val startX = (startPct / 100.0 * width).toFloat()
        val endX = (endPct / 100.0 * width).toFloat()
        val segmentWidth = (endX - startX).coerceAtLeast(0f)

        if (segmentWidth > 0f) {
            drawRect(
                brush = Brush.horizontalGradient(
                    colorStops = colorStops,
                    startX = 0f,
                    endX = width
                ),
                topLeft = Offset(startX, 0f),
                size = Size(segmentWidth, height),
                alpha = 1.0f
            )
        }
    }
}
