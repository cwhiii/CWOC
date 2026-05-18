package com.cwoc.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * A minimal line chart composable for rendering habit data (completion, success rate, streak).
 * Draws a simple line graph from a list of data points.
 *
 * Addresses gaps G3 (completion chart), G4 (success rate chart), G5 (streak chart).
 *
 * @param dataPoints List of float values to plot (0.0 to max)
 * @param lineColor Color of the line
 * @param fillColor Optional fill color below the line (with alpha)
 * @param height Height of the chart
 * @param maxValue Maximum Y value (for scaling). If null, uses max of dataPoints.
 */
@Composable
fun MiniLineChart(
    dataPoints: List<Float>,
    modifier: Modifier = Modifier,
    lineColor: Color = MaterialTheme.colorScheme.primary,
    fillColor: Color? = null,
    height: Dp = 60.dp,
    maxValue: Float? = null
) {
    if (dataPoints.size < 2) return

    val effectiveMax = maxValue ?: dataPoints.maxOrNull() ?: 1f
    val safeMax = if (effectiveMax == 0f) 1f else effectiveMax

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
    ) {
        val width = size.width
        val chartHeight = size.height
        val stepX = width / (dataPoints.size - 1).toFloat()
        val padding = 4f

        // Build the path
        val path = Path()
        dataPoints.forEachIndexed { index, value ->
            val x = index * stepX
            val y = chartHeight - padding - ((value / safeMax) * (chartHeight - padding * 2))
            if (index == 0) {
                path.moveTo(x, y)
            } else {
                path.lineTo(x, y)
            }
        }

        // Draw fill if specified
        if (fillColor != null) {
            val fillPath = Path()
            fillPath.addPath(path)
            fillPath.lineTo(width, chartHeight)
            fillPath.lineTo(0f, chartHeight)
            fillPath.close()
            drawPath(fillPath, fillColor)
        }

        // Draw the line
        drawPath(path, lineColor, style = Stroke(width = 2f))

        // Draw dots at each data point
        dataPoints.forEachIndexed { index, value ->
            val x = index * stepX
            val y = chartHeight - padding - ((value / safeMax) * (chartHeight - padding * 2))
            drawCircle(lineColor, radius = 3f, center = Offset(x, y))
        }
    }
}

/**
 * A minimal bar chart composable for rendering discrete values (e.g., daily completion counts).
 *
 * @param dataPoints List of float values to plot
 * @param barColor Color of the bars
 * @param height Height of the chart
 * @param maxValue Maximum Y value for scaling
 */
@Composable
fun MiniBarChart(
    dataPoints: List<Float>,
    modifier: Modifier = Modifier,
    barColor: Color = MaterialTheme.colorScheme.primary,
    height: Dp = 60.dp,
    maxValue: Float? = null
) {
    if (dataPoints.isEmpty()) return

    val effectiveMax = maxValue ?: dataPoints.maxOrNull() ?: 1f
    val safeMax = if (effectiveMax == 0f) 1f else effectiveMax

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
    ) {
        val width = size.width
        val chartHeight = size.height
        val barWidth = (width / dataPoints.size) * 0.7f
        val gap = (width / dataPoints.size) * 0.3f / 2f

        dataPoints.forEachIndexed { index, value ->
            val barHeight = (value / safeMax) * chartHeight
            val x = index * (width / dataPoints.size) + gap
            val y = chartHeight - barHeight

            drawRect(
                color = barColor,
                topLeft = Offset(x, y),
                size = androidx.compose.ui.geometry.Size(barWidth, barHeight)
            )
        }
    }
}
