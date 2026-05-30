package com.cwoc.app.ui.screens.weather

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.cwoc.app.data.local.entity.ChitEntity
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Row header width matching web's location label column */
private val RowHeaderWidth = 100.dp

/** Day column width matching WeatherDayBlock */
private val DayColumnWidth = 66.dp

/** Date header height */
private val DateHeaderHeight = 36.dp

/** Row height matching WeatherDayBlock */
private val RowHeight = 90.dp

/** Parchment background for the table */
private val TableBg = Color(0xFFFFF8F0)

/** Header background: slightly darker parchment */
private val HeaderBg = Color(0xFFF5E6D3)

/** Drag handle color: aged brown */
private val DragHandleColor = Color(0xFF6B4E31)

/** Dragged row elevation shadow */
private const val DragElevation = 12f

/** Dragged row scale factor */
private const val DragScale = 1.03f

/** Dragged row opacity */
private const val DragAlpha = 0.85f

/** City row header background: lighter/more transparent than saved locations */
private val CityRowHeaderBg = Color(0xFFFFF4E8)

/** City row day block background: slightly lighter than saved locations */
private val CityRowBg = Color(0xFFFFF8F0)

// ─── WeatherHorizontalTable Composable ──────────────────────────────────────────

/**
 * Horizontal scrollable weather table with date columns and location rows.
 * Supports drag-to-reorder for location rows via long-press on row headers.
 *
 * Matches the web's weather horizontal table layout at mobile viewport.
 *
 * @param forecasts List of location forecasts to display as rows
 * @param cityForecasts List of city forecasts for non-saved locations (displayed below saved rows)
 * @param chits List of chits for event highlighting
 * @param period Current weather period filter
 * @param periodOffset Current period offset for navigation
 * @param weekStartDay Configured week start day (0=Sun..6=Sat)
 * @param tempUnit Temperature unit: "imperial" for Fahrenheit, else Celsius
 * @param precipUnit Precipitation unit: "in" for inches, else "mm"
 * @param rowOrder Saved row order (list of location names)
 * @param onDayClick Callback when a day block is tapped (passes date string)
 * @param onReorder Callback when rows are reordered (fromIndex, toIndex)
 */
@Composable
fun WeatherHorizontalTable(
    forecasts: List<LocationForecast>,
    cityForecasts: List<LocationForecast> = emptyList(),
    chits: List<ChitEntity>,
    period: WeatherPeriod,
    periodOffset: Int,
    weekStartDay: Int,
    tempUnit: String,
    precipUnit: String,
    rowOrder: List<String>,
    onDayClick: (String) -> Unit,
    onReorder: (Int, Int) -> Unit
) {
    // Apply saved row order to forecasts
    val orderedForecasts = remember(forecasts, rowOrder) {
        applyRowOrder(forecasts, rowOrder)
    }

    // Compute visible date range based on period
    val visibleDates = remember(orderedForecasts, period, periodOffset) {
        computeVisibleDates(orderedForecasts, period, periodOffset)
    }

    // Build event map for highlighting
    val eventMap = remember(chits, orderedForecasts) {
        WeatherUtils.buildLocDateMap(chits, orderedForecasts)
    }

    val today = remember { LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE) }

    // ─── Drag-to-Reorder State ──────────────────────────────────────────────
    var draggedIndex by remember { mutableIntStateOf(-1) }
    var dragOffsetY by remember { mutableFloatStateOf(0f) }
    var targetIndex by remember { mutableIntStateOf(-1) }
    var didDrag by remember { mutableStateOf(false) }

    val horizontalScrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(TableBg)
    ) {
        // ─── Date Column Headers ────────────────────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth()
        ) {
            // Empty corner cell (above row headers)
            Box(
                modifier = Modifier
                    .width(RowHeaderWidth)
                    .height(DateHeaderHeight)
                    .background(HeaderBg)
                    .padding(4.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Location",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = DragHandleColor
                )
            }

            // Scrollable date headers
            Row(
                modifier = Modifier
                    .weight(1f)
                    .horizontalScroll(horizontalScrollState)
            ) {
                visibleDates.forEach { dateStr ->
                    val isToday = dateStr == today
                    Box(
                        modifier = Modifier
                            .width(DayColumnWidth)
                            .height(DateHeaderHeight)
                            .background(if (isToday) Color(0xFFFFFDE7) else HeaderBg)
                            .padding(2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = formatDayOfWeek(dateStr),
                                fontSize = 10.sp,
                                fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                                color = if (isToday) Color(0xFF6B4E31) else Color(0xFF4A2C2A)
                            )
                            Text(
                                text = formatMonthDay(dateStr),
                                fontSize = 10.sp,
                                fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                                color = if (isToday) Color(0xFF6B4E31) else Color(0xFF4A2C2A)
                            )
                        }
                    }
                }
            }
        }

        // ─── Location Rows with Drag-to-Reorder ─────────────────────────────
        orderedForecasts.forEachIndexed { index, forecast ->
            val isDragging = draggedIndex == index

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .zIndex(if (isDragging) 1f else 0f)
                    .offset { IntOffset(0, if (isDragging) dragOffsetY.roundToInt() else 0) }
                    .graphicsLayer {
                        if (isDragging) {
                            shadowElevation = DragElevation
                            scaleX = DragScale
                            scaleY = DragScale
                            alpha = DragAlpha
                        }
                    }
            ) {
                // ─── Row Header (Location Label + Drag Handle) ──────────────
                Box(
                    modifier = Modifier
                        .width(RowHeaderWidth)
                        .height(RowHeight)
                        .background(if (isDragging) Color(0xFFF0E0C0) else HeaderBg)
                        .pointerInput(index) {
                            detectDragGesturesAfterLongPress(
                                onDragStart = {
                                    draggedIndex = index
                                    dragOffsetY = 0f
                                    didDrag = false
                                },
                                onDrag = { change, dragAmount ->
                                    change.consume()
                                    dragOffsetY += dragAmount.y
                                    didDrag = true

                                    // Calculate target index based on drag offset
                                    val itemHeight = RowHeight.toPx()
                                    if (itemHeight > 0) {
                                        val rawTarget = index + (dragOffsetY / itemHeight).roundToInt()
                                        targetIndex = rawTarget.coerceIn(0, orderedForecasts.size - 1)
                                    }
                                },
                                onDragEnd = {
                                    if (didDrag && draggedIndex >= 0 && targetIndex >= 0 && draggedIndex != targetIndex) {
                                        onReorder(draggedIndex, targetIndex)
                                    }
                                    draggedIndex = -1
                                    dragOffsetY = 0f
                                    targetIndex = -1
                                    didDrag = false
                                },
                                onDragCancel = {
                                    draggedIndex = -1
                                    dragOffsetY = 0f
                                    targetIndex = -1
                                    didDrag = false
                                }
                            )
                        }
                        .padding(4.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        // Drag handle icon
                        Text(
                            text = "⋮⋮",
                            fontSize = 14.sp,
                            color = DragHandleColor.copy(alpha = 0.6f),
                            modifier = Modifier.padding(bottom = 2.dp)
                        )

                        // Location label
                        Text(
                            text = forecast.locationName,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF4A2C2A),
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )

                        // Address (if different from label)
                        if (forecast.address.isNotBlank() &&
                            forecast.address.lowercase() != forecast.locationName.lowercase()
                        ) {
                            Text(
                                text = forecast.address,
                                fontSize = 9.sp,
                                color = Color(0xFF6B4E31).copy(alpha = 0.7f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }

                // ─── Day Blocks (Horizontally Scrollable) ───────────────────
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .horizontalScroll(horizontalScrollState)
                ) {
                    visibleDates.forEach { dateStr ->
                        val dailyForecast = forecast.daily.find { it.date == dateStr }
                        val isToday = dateStr == today
                        val hasEvent = eventMap[index]?.contains(dateStr) == true
                        val isWeekStart = WeatherUtils.isWeekStart(dateStr, weekStartDay)

                        if (dailyForecast != null) {
                            val isExtreme = WeatherUtils.isExtreme(
                                dailyForecast.tempHigh,
                                dailyForecast.tempLow,
                                dailyForecast.weatherCode
                            )

                            WeatherDayBlock(
                                forecast = dailyForecast,
                                isToday = isToday,
                                hasEvent = hasEvent,
                                isExtreme = isExtreme,
                                isWeekStart = isWeekStart,
                                tempUnit = tempUnit,
                                precipUnit = precipUnit,
                                onClick = { onDayClick(dateStr) }
                            )
                        } else {
                            // Empty placeholder for missing forecast data
                            Box(
                                modifier = Modifier
                                    .width(DayColumnWidth)
                                    .height(RowHeight)
                                    .background(Color(0xFFFFF8E1))
                                    .padding(4.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "—",
                                    fontSize = 14.sp,
                                    color = Color(0xFF6B4E31).copy(alpha = 0.4f)
                                )
                            }
                        }
                    }
                }
            }

            // Subtle divider between rows
            if (index < orderedForecasts.size - 1) {
                Spacer(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(Color(0xFF8B5A2B).copy(alpha = 0.2f))
                )
            }
        }

        // ─── City Rows (Non-Saved Locations) ────────────────────────────────
        if (cityForecasts.isNotEmpty()) {
            // Separator between saved and city rows
            Spacer(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(2.dp)
                    .background(Color(0xFF8B5A2B).copy(alpha = 0.3f))
            )

            cityForecasts.forEachIndexed { cityIndex, cityForecast ->
                Row(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    // ─── City Row Header (Distinct Styling) ─────────────────
                    Box(
                        modifier = Modifier
                            .width(RowHeaderWidth)
                            .height(RowHeight)
                            .background(CityRowHeaderBg)
                            .padding(4.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            // City label with 📍 prefix (already in locationName from ViewModel)
                            Text(
                                text = cityForecast.locationName,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Normal,
                                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                                color = Color(0xFF5A3E28),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )

                            // "from chits" subtitle
                            Text(
                                text = cityForecast.address,
                                fontSize = 9.sp,
                                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                                color = Color(0xFF6B4E31).copy(alpha = 0.5f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    // ─── City Day Blocks (Horizontally Scrollable) ──────────
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .horizontalScroll(horizontalScrollState)
                    ) {
                        visibleDates.forEach { dateStr ->
                            val dailyForecast = cityForecast.daily.find { it.date == dateStr }
                            val isToday = dateStr == today
                            val isWeekStart = WeatherUtils.isWeekStart(dateStr, weekStartDay)

                            if (dailyForecast != null) {
                                val isExtreme = WeatherUtils.isExtreme(
                                    dailyForecast.tempHigh,
                                    dailyForecast.tempLow,
                                    dailyForecast.weatherCode
                                )

                                WeatherDayBlock(
                                    forecast = dailyForecast,
                                    isToday = isToday,
                                    hasEvent = true, // City rows always have events (that's why they exist)
                                    isExtreme = isExtreme,
                                    isWeekStart = isWeekStart,
                                    tempUnit = tempUnit,
                                    precipUnit = precipUnit,
                                    onClick = { onDayClick(dateStr) }
                                )
                            } else {
                                // Empty placeholder for missing forecast data
                                Box(
                                    modifier = Modifier
                                        .width(DayColumnWidth)
                                        .height(RowHeight)
                                        .background(CityRowBg)
                                        .padding(4.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "—",
                                        fontSize = 14.sp,
                                        color = Color(0xFF6B4E31).copy(alpha = 0.3f)
                                    )
                                }
                            }
                        }
                    }
                }

                // Subtle divider between city rows
                if (cityIndex < cityForecasts.size - 1) {
                    Spacer(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(Color(0xFF8B5A2B).copy(alpha = 0.15f))
                    )
                }
            }
        }
    }
}

// ─── Row Order Logic ────────────────────────────────────────────────────────────

/**
 * Apply saved row order to the forecasts list.
 * Locations in rowOrder appear first in that order; any remaining locations
 * (new or not in the saved order) appear after in their original order.
 *
 * @param forecasts Original list of location forecasts
 * @param rowOrder Saved order of location names
 * @return Reordered list of location forecasts
 */
private fun applyRowOrder(
    forecasts: List<LocationForecast>,
    rowOrder: List<String>
): List<LocationForecast> {
    if (rowOrder.isEmpty()) return forecasts

    val byName = forecasts.associateBy { it.locationName }
    val ordered = mutableListOf<LocationForecast>()

    // Add locations in saved order
    for (name in rowOrder) {
        byName[name]?.let { ordered.add(it) }
    }

    // Add any remaining locations not in the saved order
    for (forecast in forecasts) {
        if (forecast.locationName !in rowOrder) {
            ordered.add(forecast)
        }
    }

    return ordered
}

// ─── Visible Dates Computation ──────────────────────────────────────────────────

/**
 * Compute the list of visible date strings based on the current period and offset.
 * If period is FORECAST_MAX, returns all available dates from the first forecast.
 *
 * @param forecasts Ordered list of location forecasts
 * @param period Current weather period filter
 * @param periodOffset Current period offset
 * @return List of YYYY-MM-DD date strings to display as columns
 */
private fun computeVisibleDates(
    forecasts: List<LocationForecast>,
    period: WeatherPeriod,
    periodOffset: Int
): List<String> {
    // Get all available dates from the first forecast (they should all have the same dates)
    val allDates = forecasts.firstOrNull()?.daily?.map { it.date } ?: return emptyList()

    if (period == WeatherPeriod.FORECAST_MAX) return allDates

    val range = WeatherUtils.computePeriodRange(period, periodOffset, 7) ?: return allDates
    val startStr = range.first.format(DateTimeFormatter.ISO_LOCAL_DATE)
    val endStr = range.second.format(DateTimeFormatter.ISO_LOCAL_DATE)

    return allDates.filter { it in startStr..endStr }
}

// ─── Date Formatting Helpers ────────────────────────────────────────────────────

/**
 * Format a date string (YYYY-MM-DD) to day-of-week abbreviation (Mon, Tue, etc.)
 */
private fun formatDayOfWeek(dateStr: String): String {
    return try {
        val date = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE)
        val dayNames = arrayOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
        dayNames[date.dayOfWeek.value - 1]
    } catch (_: Exception) {
        "?"
    }
}

/**
 * Format a date string (YYYY-MM-DD) to month/day label (e.g., "1/15", "12/3")
 */
private fun formatMonthDay(dateStr: String): String {
    return try {
        val date = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE)
        "${date.monthValue}/${date.dayOfMonth}"
    } catch (_: Exception) {
        "?"
    }
}
