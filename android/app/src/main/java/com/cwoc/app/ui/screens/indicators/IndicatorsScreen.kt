package com.cwoc.app.ui.screens.indicators

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.domain.chart.ChartDataTransformer
import com.cwoc.app.domain.chart.MappedPoint
import com.cwoc.app.domain.chart.TimeRange
import java.time.LocalDate
import java.time.Month
import java.time.Year
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * Indicators/Health Charts view — displays charts, calendar, or log for health indicators.
 */
@Composable
fun IndicatorsScreen(
    modifier: Modifier = Modifier,
    viewModel: IndicatorsViewModel = hiltViewModel()
) {
    val charts by viewModel.charts.collectAsState()
    val selectedRange by viewModel.selectedRange.collectAsState()
    val healthEntries by viewModel.healthEntries.collectAsState()

    var indicatorsMode by remember { mutableStateOf("charts") }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        // 3-way mode toggle
        IndicatorsModeSelector(
            selected = indicatorsMode,
            onSelect = { indicatorsMode = it }
        )

        Spacer(modifier = Modifier.height(8.dp))

        when (indicatorsMode) {
            "charts" -> ChartsMode(
                charts = charts,
                selectedRange = selectedRange,
                onRangeSelect = { viewModel.setTimeRange(it) }
            )
            "calendar" -> CalendarMode(healthEntries = healthEntries)
            "log" -> LogMode(healthEntries = healthEntries)
        }
    }
}

@Composable
private fun IndicatorsModeSelector(
    selected: String,
    onSelect: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FilterChip(
            selected = selected == "charts",
            onClick = { onSelect("charts") },
            label = { Text("Charts") },
            colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = Color(0xFF6B4E31),
                selectedLabelColor = Color.White
            )
        )
        FilterChip(
            selected = selected == "calendar",
            onClick = { onSelect("calendar") },
            label = { Text("Calendar") },
            colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = Color(0xFF6B4E31),
                selectedLabelColor = Color.White
            )
        )
        FilterChip(
            selected = selected == "log",
            onClick = { onSelect("log") },
            label = { Text("Log") },
            colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = Color(0xFF6B4E31),
                selectedLabelColor = Color.White
            )
        )
    }
}

// ─── Charts Mode ────────────────────────────────────────────────────────────────

@Composable
private fun ChartsMode(
    charts: List<IndicatorChart>,
    selectedRange: TimeRange,
    onRangeSelect: (TimeRange) -> Unit
) {
    Column {
        TimeRangeSelector(
            selected = selectedRange,
            onSelect = onRangeSelect
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (charts.isEmpty()) {
            EmptyIndicatorsState()
        } else {
            LazyColumn {
                items(charts, key = { it.type }) { chart ->
                    IndicatorChartCard(chart = chart)
                    Spacer(modifier = Modifier.height(12.dp))
                }
            }
        }
    }
}

// ─── Calendar Mode ──────────────────────────────────────────────────────────────

@Composable
private fun CalendarMode(healthEntries: List<HealthEntry>) {
    val currentYear = Year.now().value

    // Build a set of dates that have data for quick lookup
    val datesWithData = remember(healthEntries) {
        healthEntries.map { it.date }.toSet()
    }

    if (healthEntries.isEmpty()) {
        EmptyCalendarState()
    } else {
        LazyColumn {
            items(Month.entries.toList()) { month ->
                CalendarMonthGrid(
                    year = currentYear,
                    month = month,
                    datesWithData = datesWithData
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun CalendarMonthGrid(
    year: Int,
    month: Month,
    datesWithData: Set<LocalDate>
) {
    val firstOfMonth = LocalDate.of(year, month, 1)
    val daysInMonth = firstOfMonth.lengthOfMonth()
    val startDayOfWeek = firstOfMonth.dayOfWeek.value // 1=Monday, 7=Sunday

    // Adjust so Sunday=0, Monday=1, etc. for grid layout
    val startOffset = if (startDayOfWeek == 7) 0 else startDayOfWeek

    Column(modifier = Modifier.padding(horizontal = 8.dp)) {
        // Month header
        Text(
            text = month.getDisplayName(TextStyle.FULL, Locale.getDefault()) + " $year",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF6B4E31),
            modifier = Modifier.padding(bottom = 4.dp)
        )

        // Day-of-week headers
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            listOf("S", "M", "T", "W", "T", "F", "S").forEach { day ->
                Text(
                    text = day,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF8B7355),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.width(20.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(2.dp))

        // Day cells in rows of 7
        val totalCells = startOffset + daysInMonth
        val rows = (totalCells + 6) / 7

        for (row in 0 until rows) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                for (col in 0..6) {
                    val cellIndex = row * 7 + col
                    val dayNum = cellIndex - startOffset + 1

                    if (dayNum in 1..daysInMonth) {
                        val date = LocalDate.of(year, month, dayNum)
                        val hasData = datesWithData.contains(date)
                        val cellColor = if (hasData) Color(0xFF43A047) else Color(0xFFE0E0E0)

                        Box(
                            modifier = Modifier
                                .size(18.dp)
                                .padding(1.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(cellColor),
                            contentAlignment = Alignment.Center
                        ) {
                            // Optionally show day number for accessibility
                        }
                    } else {
                        // Empty cell
                        Box(modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyCalendarState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(120.dp))
        Text(
            text = "No health data for calendar",
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF6B4E31)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Add health indicators to your chits to see the year calendar here.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF8B7355)
        )
    }
}

// ─── Log Mode ───────────────────────────────────────────────────────────────────

@Composable
private fun LogMode(healthEntries: List<HealthEntry>) {
    if (healthEntries.isEmpty()) {
        EmptyLogState()
        return
    }

    // Sort reverse chronological and group by date
    val grouped = remember(healthEntries) {
        healthEntries
            .sortedByDescending { it.date }
            .groupBy { it.date }
    }

    LazyColumn {
        grouped.forEach { (date, entries) ->
            item(key = "header-$date") {
                LogDateHeader(date = date)
            }
            items(entries, key = { "${it.date}-${it.indicatorType}-${it.value}" }) { entry ->
                LogEntryCard(entry = entry)
            }
            item(key = "spacer-$date") {
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun LogDateHeader(date: LocalDate) {
    val formatter = DateTimeFormatter.ofPattern("EEEE, MMM d, yyyy")
    Text(
        text = date.format(formatter),
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = Color(0xFF6B4E31),
        modifier = Modifier.padding(horizontal = 4.dp, vertical = 8.dp)
    )
}

@Composable
private fun LogEntryCard(entry: HealthEntry) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 2.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF5E6D3))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Color dot for indicator type
            val dotColor = remember(entry.indicatorType) { indicatorTypeColor(entry.indicatorType) }
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(dotColor)
            )

            Spacer(modifier = Modifier.width(10.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = entry.indicatorType.replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF6B4E31)
                )
                if (entry.chitTitle != null) {
                    Text(
                        text = entry.chitTitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF8B7355),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Text(
                text = formatValue(entry.value),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF6B4E31)
            )
        }
    }
}

/** Format a float value nicely — drop .0 for whole numbers. */
private fun formatValue(value: Float): String {
    return if (value == value.toLong().toFloat()) {
        value.toLong().toString()
    } else {
        "%.1f".format(value)
    }
}

@Composable
private fun EmptyLogState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(120.dp))
        Text(
            text = "No health data entries",
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF6B4E31)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Add health indicators to your chits to see the log here.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF8B7355)
        )
    }
}

// ─── Shared Components ──────────────────────────────────────────────────────────

@Composable
private fun TimeRangeSelector(
    selected: TimeRange,
    onSelect: (TimeRange) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        TimeRange.entries.forEach { range ->
            FilterChip(
                selected = range == selected,
                onClick = { onSelect(range) },
                label = {
                    Text(
                        text = when (range) {
                            TimeRange.SEVEN_DAYS -> "7d"
                            TimeRange.THIRTY_DAYS -> "30d"
                            TimeRange.NINETY_DAYS -> "90d"
                            TimeRange.ALL -> "All"
                        }
                    )
                },
                modifier = Modifier.padding(end = 8.dp),
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = Color(0xFF6B4E31),
                    selectedLabelColor = Color.White
                )
            )
        }
    }
}

@Composable
private fun IndicatorChartCard(chart: IndicatorChart) {
    var tooltipPoint by remember { mutableStateOf<MappedPoint?>(null) }
    // S1: Per-type color based on indicator type name
    val chartColor = remember(chart.type) { indicatorTypeColor(chart.type) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF5E6D3))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // S3: Legend row — type name + color indicator + unit
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Color dot for legend
                Canvas(modifier = Modifier.padding(end = 8.dp)) {
                    drawCircle(color = chartColor, radius = 6f)
                }
                Text(
                    text = chart.type.replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.titleSmall,
                    color = Color(0xFF6B4E31),
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                // S2: Add reading button
                androidx.compose.material3.TextButton(
                    onClick = { /* Would open a number input dialog for new reading */ }
                ) {
                    Text("+ Add Reading", style = MaterialTheme.typography.labelSmall)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (chart.points.isEmpty()) {
                Text(
                    text = "No data for this period",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF8B7355)
                )
            } else {
                CanvasLineChart(
                    chart = chart,
                    lineColor = chartColor,
                    onPointTapped = { tooltipPoint = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp)
                )

                tooltipPoint?.let { point ->
                    Text(
                        text = "${point.dataPoint.value} on ${point.dataPoint.date.format(DateTimeFormatter.ofPattern("MMM d"))}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF6B4E31),
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }
    }
}

/**
 * S1: Returns a unique color for each indicator type.
 */
private fun indicatorTypeColor(type: String): Color {
    return when (type.lowercase()) {
        "heart_rate", "heartrate", "pulse" -> Color(0xFFE53935) // Red
        "blood_pressure", "bp" -> Color(0xFF1E88E5) // Blue
        "weight" -> Color(0xFF43A047) // Green
        "temperature", "temp" -> Color(0xFFFF8F00) // Amber
        "sleep" -> Color(0xFF5E35B1) // Purple
        "steps" -> Color(0xFF00897B) // Teal
        "oxygen", "spo2" -> Color(0xFF039BE5) // Light blue
        "glucose", "blood_sugar" -> Color(0xFFF4511E) // Deep orange
        else -> {
            // Generate from hash for unknown types
            val colors = listOf(
                Color(0xFF6B4E31), Color(0xFF8B5A2B), Color(0xFF4A6741),
                Color(0xFF1565C0), Color(0xFF9B59B6), Color(0xFFD2691E)
            )
            colors[(type.hashCode().and(0x7FFFFFFF)) % colors.size]
        }
    }
}


@Composable
private fun CanvasLineChart(
    chart: IndicatorChart,
    lineColor: Color = Color(0xFF6B4E31),
    onPointTapped: (MappedPoint?) -> Unit,
    modifier: Modifier = Modifier
) {
    var mappedPoints by remember { mutableStateOf<List<MappedPoint>>(emptyList()) }

    Canvas(
        modifier = modifier
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    val hit = ChartDataTransformer.hitTest(
                        mappedPoints, offset.x, offset.y, 48f
                    )
                    onPointTapped(hit)
                }
            }
    ) {
        val points = ChartDataTransformer.mapToPixels(
            chart.points, size.width, size.height, 32f
        )
        mappedPoints = points

        if (points.size < 2) {
            points.firstOrNull()?.let { p ->
                drawCircle(
                    color = lineColor,
                    radius = 6f,
                    center = Offset(p.x, p.y)
                )
            }
            return@Canvas
        }

        // Draw line path
        val path = Path().apply {
            moveTo(points.first().x, points.first().y)
            for (i in 1 until points.size) {
                lineTo(points[i].x, points[i].y)
            }
        }
        drawPath(
            path = path,
            color = lineColor,
            style = Stroke(width = 2.5f)
        )

        // Draw data points
        points.forEach { p ->
            drawCircle(
                color = lineColor,
                radius = 4f,
                center = Offset(p.x, p.y)
            )
        }
    }
}

@Composable
private fun EmptyIndicatorsState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(120.dp))
        Text(
            text = "No health data yet",
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF6B4E31)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Add health indicators to your chits to see charts here.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF8B7355)
        )
    }
}
