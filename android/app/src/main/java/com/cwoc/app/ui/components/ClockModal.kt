package com.cwoc.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.cos
import kotlin.math.sin

/**
 * BB4: Multi-timezone clock modal.
 * Displays the current time in multiple configured timezones.
 * Equivalent to the web's clock modal (triggered by 'L' key).
 *
 * @param timezones List of IANA timezone IDs to display (from settings.activeClocks)
 * @param timeFormat "12h" or "24h"
 * @param onDismiss Callback when the modal is closed
 */
@Composable
fun ClockModal(
    timezones: List<String>,
    timeFormat: String = "12h",
    onDismiss: () -> Unit
) {
    // Auto-refresh every second (matching web's setInterval 1000ms)
    var now by remember { mutableStateOf(ZonedDateTime.now()) }
    LaunchedEffect(Unit) {
        while (true) {
            kotlinx.coroutines.delay(1000)
            now = ZonedDateTime.now()
        }
    }
    val formatter = remember(timeFormat) {
        if (timeFormat == "24h") DateTimeFormatter.ofPattern("HH:mm:ss")
        else DateTimeFormatter.ofPattern("h:mm:ss a")
    }
    val dateFormatter = remember { DateTimeFormatter.ofPattern("EEE, MMM d") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("World Clocks", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Analog clock face showing local timezone
                AnalogClockFace(
                    now = now,
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )
                Spacer(modifier = Modifier.height(8.dp))
                if (timezones.isEmpty()) {
                    Text(
                        text = "No clocks configured. Add timezones in Settings → World Clocks.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    timezones.forEach { tzId ->
                        val zoneTime = try {
                            now.withZoneSameInstant(ZoneId.of(tzId))
                        } catch (_: Exception) { null }

                        if (zoneTime != null) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = tzId.substringAfterLast("/").replace("_", " "),
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        text = zoneTime.format(dateFormatter),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Text(
                                    text = zoneTime.format(formatter),
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                            HorizontalDivider()
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        },
        containerColor = MaterialTheme.colorScheme.surface
    )
}

/**
 * Analog clock face drawn with Compose Canvas.
 * Matches the web's SVG analog clock visual style (parchment face, brown hands, gold center).
 *
 * @param now The current time to display on the clock face
 * @param modifier Modifier for sizing/positioning (default 160.dp)
 */
@Composable
fun AnalogClockFace(now: ZonedDateTime, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.size(160.dp)) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val outerRadius = size.minDimension / 2f
        val bezelRadius = outerRadius - 2.dp.toPx()
        val faceRadius = outerRadius - 4.dp.toPx()

        // Colors matching web's analog clock
        val outerRingColor = Color(0xFF5C3A1E)    // dark brown outer bezel
        val bezelColor = Color(0xFF8B4513)         // medium brown bezel
        val faceColor = Color(0xFFFDF5E6)          // parchment face fill
        val markerColor = Color(0xFF4A2C2A)        // dark brown for markers & hands
        val tickColor = Color(0xFF8B4513)          // medium brown for minute ticks
        val secondHandColor = Color(0xFFA0522D)    // sienna for second hand
        val centerFillColor = Color(0xFFD4AF37)    // gold center dot
        val centerStrokeColor = Color(0xFF4A2C2A)  // dark brown center dot border

        // Draw face: outer ring → bezel → parchment face
        drawCircle(color = outerRingColor, radius = outerRadius, center = center)
        drawCircle(color = bezelColor, radius = bezelRadius, center = center)
        drawCircle(color = faceColor, radius = faceRadius, center = center)

        // Draw 60 minute ticks (skip hour positions)
        for (i in 0 until 60) {
            if (i % 5 == 0) continue
            val angle = Math.toRadians((i * 6.0 - 90.0))
            val outerPoint = Offset(
                x = center.x + (faceRadius - 2.dp.toPx()) * cos(angle).toFloat(),
                y = center.y + (faceRadius - 2.dp.toPx()) * sin(angle).toFloat()
            )
            val innerPoint = Offset(
                x = center.x + (faceRadius - 5.5.dp.toPx()) * cos(angle).toFloat(),
                y = center.y + (faceRadius - 5.5.dp.toPx()) * sin(angle).toFloat()
            )
            drawLine(
                color = tickColor.copy(alpha = 0.4f),
                start = outerPoint,
                end = innerPoint,
                strokeWidth = 0.8.dp.toPx(),
                cap = StrokeCap.Round
            )
        }

        // Draw 12 hour markers (thicker for quarter hours)
        for (i in 0 until 12) {
            val angle = Math.toRadians((i * 30.0 - 90.0))
            val isQuarter = i % 3 == 0
            val outerDist = faceRadius - 2.dp.toPx()
            val innerDist = if (isQuarter) faceRadius - 16.dp.toPx() else faceRadius - 9.dp.toPx()
            val strokeW = if (isQuarter) 4.dp.toPx() else 1.5.dp.toPx()
            val outerPoint = Offset(
                x = center.x + outerDist * cos(angle).toFloat(),
                y = center.y + outerDist * sin(angle).toFloat()
            )
            val innerPoint = Offset(
                x = center.x + innerDist * cos(angle).toFloat(),
                y = center.y + innerDist * sin(angle).toFloat()
            )
            drawLine(
                color = markerColor,
                start = outerPoint,
                end = innerPoint,
                strokeWidth = strokeW,
                cap = StrokeCap.Round
            )
        }

        // Draw hour numerals using native Canvas text
        val numeralRadius = faceRadius - 30.dp.toPx()
        val numerals = listOf(12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)
        val paint = android.graphics.Paint().apply {
            color = 0xFF4A2C2A.toInt()
            textSize = 16.dp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            typeface = android.graphics.Typeface.create("serif", android.graphics.Typeface.BOLD)
            isAntiAlias = true
        }
        drawContext.canvas.nativeCanvas.let { canvas ->
            numerals.forEachIndexed { index, numeral ->
                val angle = Math.toRadians((index * 30.0 - 90.0))
                val x = center.x + numeralRadius * cos(angle).toFloat()
                val y = center.y + numeralRadius * sin(angle).toFloat()
                // Adjust y for text vertical centering
                val textBounds = android.graphics.Rect()
                paint.getTextBounds(numeral.toString(), 0, numeral.toString().length, textBounds)
                canvas.drawText(
                    numeral.toString(),
                    x,
                    y + textBounds.height() / 2f,
                    paint
                )
            }
        }

        // Calculate hand angles (0° = 12 o'clock, clockwise, offset by -90° for math)
        val hour = now.hour % 12
        val minute = now.minute
        val second = now.second

        // Hour hand: thick, short (48% of radius)
        val hourAngle = Math.toRadians(((hour + minute / 60.0) * 30.0 - 90.0))
        val hourLength = faceRadius * 0.48f
        drawLine(
            color = markerColor,
            start = center,
            end = Offset(
                x = center.x + hourLength * cos(hourAngle).toFloat(),
                y = center.y + hourLength * sin(hourAngle).toFloat()
            ),
            strokeWidth = 6.dp.toPx(),
            cap = StrokeCap.Round
        )

        // Minute hand: medium thickness, longer (70% of radius)
        val minuteAngle = Math.toRadians(((minute + second / 60.0) * 6.0 - 90.0))
        val minuteLength = faceRadius * 0.70f
        drawLine(
            color = markerColor,
            start = center,
            end = Offset(
                x = center.x + minuteLength * cos(minuteAngle).toFloat(),
                y = center.y + minuteLength * sin(minuteAngle).toFloat()
            ),
            strokeWidth = 4.dp.toPx(),
            cap = StrokeCap.Round
        )

        // Second hand: thin, long (78% of radius) with tail (18% opposite)
        val secondAngle = Math.toRadians((second * 6.0 - 90.0))
        val secondLength = faceRadius * 0.78f
        val secondTailLength = faceRadius * 0.18f
        val secondTailAngle = Math.toRadians((second * 6.0 + 90.0))
        drawLine(
            color = secondHandColor,
            start = Offset(
                x = center.x + secondTailLength * cos(secondTailAngle).toFloat(),
                y = center.y + secondTailLength * sin(secondTailAngle).toFloat()
            ),
            end = Offset(
                x = center.x + secondLength * cos(secondAngle).toFloat(),
                y = center.y + secondLength * sin(secondAngle).toFloat()
            ),
            strokeWidth = 1.5.dp.toPx(),
            cap = StrokeCap.Round
        )

        // Center dot: gold fill with dark brown border
        drawCircle(color = centerFillColor, radius = 6.dp.toPx(), center = center)
        drawCircle(
            color = centerStrokeColor,
            radius = 6.dp.toPx(),
            center = center,
            style = Stroke(width = 1.5.dp.toPx())
        )
    }
}
