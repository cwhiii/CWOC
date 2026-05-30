package com.cwoc.app.ui.screens.weather

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Day block background: warm cream matching web's #fff8e1 */
private val DayBlockBg = Color(0xFFFFF8E1)

/** Today highlight background: lighter warm yellow matching web's #fffde7 */
private val TodayBg = Color(0xFFFFFDE7)

/** Has-event background: golden parchment matching web's #f0e0b0 */
private val HasEventBg = Color(0xFFF0E0B0)

/** High temp text color: firebrick matching web's #b22222 */
private val HighTempColor = Color(0xFFB22222)

/** Low temp text color: steel blue matching web's #4682b4 */
private val LowTempColor = Color(0xFF4682B4)

/** Precip text color: aged brown light matching web's #a0522d */
private val PrecipColor = Color(0xFFA0522D)

/** Default text color: aged brown dark matching web's #4a2c2a */
private val TextDark = Color(0xFF4A2C2A)

/** Week separator line color: aged brown dark with opacity */
private val WeekLineColor = Color(0xB34A2C2A) // ~70% opacity

/** Extreme indicator: subtle red glow overlay */
private val ExtremeOverlayColor = Color(0x18B22222) // very subtle red tint

/** Border width matching web's 3px */
private val BorderWidth = 3.dp

/** Event indicator dot color: gold/yellow */
private val EventDotColor = Color(0xFFD4AF37)

// ─── WeatherDayBlock Composable ─────────────────────────────────────────────────

/**
 * Individual day cell in the weather horizontal table.
 * Displays weather icon, high/low temperatures, and precipitation.
 * Applies temperature-based gradient border, today highlight, event indicator,
 * extreme weather indicator, and week separator line.
 *
 * Matches the web's `.weather-day-block` styling at mobile viewport (64-76dp wide).
 *
 * @param forecast The daily forecast data for this cell
 * @param isToday Whether this day is today (applies highlight background)
 * @param hasEvent Whether chits exist at this location on this day (yellow indicator)
 * @param isExtreme Whether weather conditions are extreme (visual indicator)
 * @param isWeekStart Whether this day starts a new week (draws left separator line)
 * @param tempUnit Unit system: "imperial" for Fahrenheit, else Celsius
 * @param precipUnit Precipitation unit: "in" for inches, else "mm"
 * @param onClick Callback when the day block is tapped (navigate to that day)
 */
@Composable
fun WeatherDayBlock(
    forecast: DailyForecast,
    isToday: Boolean,
    hasEvent: Boolean,
    isExtreme: Boolean,
    isWeekStart: Boolean,
    tempUnit: String,
    precipUnit: String,
    onClick: () -> Unit
) {
    // Compute temperature values using WeatherUtils
    val toFahrenheit = tempUnit == "imperial"
    val highDisplay = WeatherUtils.convertTemp(forecast.tempHigh, toFahrenheit)
    val lowDisplay = WeatherUtils.convertTemp(forecast.tempLow, toFahrenheit)

    // Compute gradient border colors from raw Celsius values
    val highBorderColor = WeatherUtils.getTempBorderColor(forecast.tempHigh)
    val lowBorderColor = WeatherUtils.getTempBorderColor(forecast.tempLow)

    // Format precipitation
    val precipStr = WeatherUtils.formatPrecip(forecast.precipChance, forecast.weatherCode)

    // Weather icon emoji
    val weatherIcon = weatherDayBlockIcon(forecast.weatherCode)

    // Determine background color based on state
    val bgColor = when {
        hasEvent -> HasEventBg
        isToday -> TodayBg
        else -> DayBlockBg
    }

    Box(
        modifier = Modifier
            .width(66.dp)
            .height(90.dp)
            .then(
                // Draw week separator line on left edge
                if (isWeekStart) {
                    Modifier.drawBehind {
                        drawLine(
                            color = WeekLineColor,
                            start = Offset(0f, 0f),
                            end = Offset(0f, size.height),
                            strokeWidth = 2.dp.toPx()
                        )
                    }
                } else Modifier
            )
            .padding(start = if (isWeekStart) 3.dp else 0.dp)
            .drawBehind {
                // Draw gradient border (bottom=low color, top=high color)
                val borderPx = BorderWidth.toPx()
                val halfBorder = borderPx / 2f

                val gradientBrush = Brush.verticalGradient(
                    colors = listOf(highBorderColor, lowBorderColor),
                    startY = 0f,
                    endY = size.height
                )

                drawRect(
                    brush = gradientBrush,
                    style = Stroke(width = borderPx)
                )

                // Draw extreme indicator: subtle inner glow
                if (isExtreme) {
                    drawRect(
                        color = ExtremeOverlayColor
                    )
                }

                // Draw event indicator dot (top-right corner)
                if (hasEvent) {
                    val dotRadius = 4.dp.toPx()
                    drawCircle(
                        color = EventDotColor,
                        radius = dotRadius,
                        center = Offset(
                            x = size.width - dotRadius - borderPx - 2.dp.toPx(),
                            y = borderPx + dotRadius + 2.dp.toPx()
                        )
                    )
                }
            }
            .background(bgColor)
            .clickable(onClick = onClick)
            .padding(BorderWidth) // Inner padding to avoid content overlapping border
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 2.dp, vertical = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Weather icon
            Text(
                text = weatherIcon,
                fontSize = 20.sp,
                textAlign = TextAlign.Center
            )

            // High/Low temperatures
            Text(
                text = buildString {
                    append(lowDisplay?.let { "$it°" } ?: "—")
                    append(" – ")
                    append(highDisplay?.let { "$it°" } ?: "—")
                },
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = TextDark,
                textAlign = TextAlign.Center,
                maxLines = 1
            )

            // Precipitation
            Text(
                text = precipStr,
                fontSize = 11.sp,
                color = PrecipColor,
                textAlign = TextAlign.Center,
                maxLines = 1
            )
        }
    }
}

// ─── Weather Icon Mapping ───────────────────────────────────────────────────────

/**
 * Maps WMO weather codes to emoji icons.
 * Matches the web's _cwocGetWeatherIcon function.
 * Package-level so it can be reused by WeatherHorizontalTable if needed.
 */
internal fun weatherDayBlockIcon(code: Int?): String {
    return when (code) {
        0 -> "☀️"
        1 -> "🌤️"
        2 -> "⛅"
        3 -> "☁️"
        45, 48 -> "🌫️"
        51, 53, 55 -> "🌦️"
        56, 57 -> "🌧️"
        61, 63, 65 -> "🌧️"
        66, 67 -> "🌧️"
        71, 73, 75 -> "🌨️"
        77 -> "🌨️"
        80, 81, 82 -> "🌧️"
        85, 86 -> "🌨️"
        95 -> "⛈️"
        96, 99 -> "⛈️"
        else -> "❓"
    }
}
