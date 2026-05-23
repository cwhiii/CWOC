package com.cwoc.app.ui.screens.indicators

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.domain.chart.ChartDataTransformer
import com.cwoc.app.domain.chart.MappedPoint
import com.cwoc.app.domain.chart.TimeRange
import com.cwoc.app.ui.components.CwocSectionHeading
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import com.cwoc.app.ui.viewmodel.SidebarStateViewModel
import com.cwoc.app.domain.filter.FilterState
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * Indicators/Health Charts view — displays charts for health indicators.
 * Supports 3 sub-modes: Charts, Calendar, Log (controlled by sidebar).
 * Time range is controlled by the sidebar.
 */
@Composable
fun IndicatorsScreen(
    modifier: Modifier = Modifier,
    viewModel: IndicatorsViewModel = hiltViewModel(),
    sidebarStateViewModel: SidebarStateViewModel? = null,
    filterSortViewModel: FilterSortViewModel? = null,
    onNavigateToEditor: ((String) -> Unit)? = null
) {
    val charts by viewModel.charts.collectAsState()
    val selectedRange by viewModel.selectedRange.collectAsState()
    val allHealthEntries by viewModel.healthEntries.collectAsState()

    // Apply search text filter to health entries (filter by chit title)
    val filterState = filterSortViewModel?.filterState?.collectAsState()?.value ?: FilterState()
    val healthEntries = remember(allHealthEntries, filterState.searchText) {
        if (filterState.searchText.isEmpty()) allHealthEntries
        else {
            val query = filterState.searchText.lowercase()
            allHealthEntries.filter { entry ->
                entry.chitTitle?.lowercase()?.contains(query) == true ||
                entry.indicatorType.lowercase().contains(query)
            }
        }
    }

    // Mode driven by sidebar state
    val sidebarState = sidebarStateViewModel?.state?.collectAsState()?.value
    val selectedMode = sidebarState?.indicatorsMode ?: "charts"

    // Sync sidebar indicatorsRange → ViewModel time range
    LaunchedEffect(sidebarState?.indicatorsRange) {
        if (sidebarState != null) {
            val range = when (sidebarState.indicatorsRange) {
                "day" -> TimeRange.ONE_DAY
                "week" -> TimeRange.SEVEN_DAYS
                "month" -> TimeRange.THIRTY_DAYS
                "year" -> TimeRange.THREE_SIXTY_FIVE_DAYS
                "all" -> TimeRange.ALL
                else -> TimeRange.THIRTY_DAYS
            }
            if (selectedRange != range) {
                viewModel.setTimeRange(range)
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        when (selectedMode) {
            "charts" -> {
                if (charts.isEmpty()) {
                    EmptyIndicatorsState()
                } else {
                    LazyColumn {
                        items(charts, key = { it.type }) { chart ->
                            IndicatorChartCard(
                                chart = chart,
                                onNavigateToEditor = onNavigateToEditor
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                        }
                    }
                }
            }
            "calendar" -> {
                IndicatorsCalendarView(
                    healthEntries = healthEntries,
                    onNavigateToEditor = onNavigateToEditor
                )
            }
            "log" -> {
                IndicatorsLogView(
                    healthEntries = healthEntries,
                    onNavigateToEditor = onNavigateToEditor
                )
            }
        }
    }
}

/**
 * Calendar view — year-view grid showing months × days, color-coded by health data.
 * Green = all readings in range, Amber = any reading out of range, Empty = no data.
 */
@Composable
private fun IndicatorsCalendarView(
    healthEntries: List<HealthEntry>,
    onNavigateToEditor: ((String) -> Unit)? = null
) {
    val today = remember { LocalDate.now() }
    val year = today.year
    val viewModel: IndicatorsViewModel = hiltViewModel()
    val indicatorObjects by viewModel.indicatorObjects.collectAsState()

    // Build a map of date → list of entries for that day
    val entriesByDate = remember(healthEntries) {
        healthEntries
            .filter { it.date.year == year }
            .groupBy { it.date }
    }

    // Build range map from indicator objects: object ID → (min, max)
    val rangeMap = remember(indicatorObjects) {
        indicatorObjects.associate { obj ->
            obj.id to Pair(obj.range_min?.toFloat(), obj.range_max?.toFloat())
        }
    }

    /**
     * Classify a day's color based on readings vs ranges.
     */
    fun classifyDay(date: LocalDate): String {
        val entries = entriesByDate[date] ?: return "none"
        if (entries.isEmpty()) return "none"

        for (entry in entries) {
            val range = rangeMap[entry.objectId]
            if (range != null) {
                val (min, max) = range
                if (min != null && entry.value < min) return "amber"
                if (max != null && entry.value > max) return "amber"
            }
        }
        return "green"
    }

    /** Get the first chit ID for a given date (for navigation). */
    fun getChitIdForDate(date: LocalDate): String? {
        return entriesByDate[date]?.firstOrNull()?.chitId
    }

    if (healthEntries.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "No health data recorded this year.",
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF8B7355)
            )
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Year header
        item {
            Text(
                text = year.toString(),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF2B1E0F),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
            )
        }

        items(12) { monthIndex ->
            val month = YearMonth.of(year, monthIndex + 1)
            val monthName = month.month.getDisplayName(TextStyle.SHORT, Locale.getDefault())
            val daysInMonth = month.lengthOfMonth()

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF5E6D3))
            ) {
                Column(modifier = Modifier.padding(8.dp)) {
                    Text(
                        text = monthName,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF6B4E31)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        for (day in 1..daysInMonth) {
                            val date = LocalDate.of(year, monthIndex + 1, day)
                            val classification = classifyDay(date)
                            val isToday = date == today
                            val hasData = entriesByDate.containsKey(date)
                            val cellColor = when (classification) {
                                "green" -> Color(0xFF4CAF50)
                                "amber" -> Color(0xFFFF9800)
                                else -> Color(0xFFE0D4B5)
                            }
                            Box(
                                modifier = Modifier
                                    .size(14.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(cellColor)
                                    .then(
                                        if (isToday) Modifier.background(
                                            Color.Transparent
                                        ) else Modifier
                                    )
                                    .then(
                                        if (hasData && onNavigateToEditor != null) {
                                            Modifier.clickable {
                                                val chitId = getChitIdForDate(date)
                                                if (chitId != null) onNavigateToEditor(chitId)
                                            }
                                        } else Modifier
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                if (isToday) {
                                    // Draw outline for today
                                    Box(
                                        modifier = Modifier
                                            .size(14.dp)
                                            .clip(RoundedCornerShape(2.dp))
                                            .background(Color.Transparent)
                                            .then(
                                                Modifier.background(Color.Transparent)
                                            )
                                    )
                                    Canvas(modifier = Modifier.size(14.dp)) {
                                        drawRect(
                                            color = Color(0xFF2B1E0F),
                                            style = Stroke(width = 2f)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Legend
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                LegendItem(color = Color(0xFF4CAF50), label = "All in range")
                LegendItem(color = Color(0xFFFF9800), label = "Out of range")
                LegendItem(color = Color(0xFFE0D4B5), label = "No data")
            }
        }
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(color)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = Color(0xFF6B4E31))
    }
}

/**
 * Log view — reverse-chronological list of health data entries.
 * Each entry shows date, chit title, and indicator readings.
 * Tapping an entry navigates to the chit editor.
 */
@Composable
private fun IndicatorsLogView(
    healthEntries: List<HealthEntry>,
    onNavigateToEditor: ((String) -> Unit)? = null
) {
    if (healthEntries.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "No health data recorded yet.\nAdd health indicators to chits in the editor.",
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF8B7355),
                textAlign = TextAlign.Center
            )
        }
        return
    }

    // Group entries by chit (date + chitId), sorted reverse-chronologically
    val groupedEntries = remember(healthEntries) {
        healthEntries
            .groupBy { Pair(it.date, it.chitId) }
            .entries
            .sortedByDescending { it.key.first }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            CwocSectionHeading(text = "Health Log")
            Spacer(modifier = Modifier.height(8.dp))
        }

        items(groupedEntries.size, key = { groupedEntries[it].key.toString() }) { index ->
            val (key, entries) = groupedEntries[index]
            val (date, chitId) = key
            val chitTitle = entries.firstOrNull()?.chitTitle ?: "(Untitled)"
            val summary = entries.joinToString(", ") { "${it.indicatorType}: ${formatValue(it.value)}" }

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .then(
                        if (chitId != null && onNavigateToEditor != null) {
                            Modifier.clickable { onNavigateToEditor(chitId) }
                        } else Modifier
                    ),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF5E6D3))
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Date column
                    Text(
                        text = date.format(DateTimeFormatter.ofPattern("MM/dd")),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF6B4E31),
                        modifier = Modifier.width(48.dp)
                    )
                    // Body column
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = chitTitle,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF2B1E0F),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = summary,
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF5A4228),
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

private fun formatValue(value: Float): String {
    return if (value == value.toLong().toFloat()) {
        value.toLong().toString()
    } else {
        String.format("%.1f", value)
    }
}


// ─── Chart Components ────────────────────────────────────────────────────────

@Composable
private fun IndicatorChartCard(
    chart: IndicatorChart,
    onNavigateToEditor: ((String) -> Unit)? = null
) {
    var tooltipPoint by remember { mutableStateOf<MappedPoint?>(null) }
    var isExpanded by remember { mutableStateOf(true) }
    val chartColor = remember(chart.type) { indicatorTypeColor(chart.type) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF5E6D3))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Header row — display name + unit + expand/collapse
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { isExpanded = !isExpanded },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Canvas(modifier = Modifier.size(12.dp).padding(end = 4.dp)) {
                    drawCircle(color = chartColor, radius = 6f)
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = chart.displayName + if (chart.unit.isNotBlank()) " (${chart.unit})" else "",
                    style = MaterialTheme.typography.titleSmall,
                    color = Color(0xFF6B4E31),
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = if (isExpanded) "▼" else "▶",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color(0xFF6B4E31)
                )
            }

            if (isExpanded) {
                Spacer(modifier = Modifier.height(8.dp))

                if (chart.points.isEmpty()) {
                    Text(
                        text = "No data for this period",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF8B7355)
                    )
                } else {
                    // Latest value display
                    val latest = chart.points.last()
                    Text(
                        text = "Latest: ${formatValue(latest.value)} ${chart.unit}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF6B4E31),
                        modifier = Modifier.padding(bottom = 4.dp)
                    )

                    CanvasLineChart(
                        chart = chart,
                        lineColor = chartColor,
                        onPointTapped = { point ->
                            tooltipPoint = point
                            // Navigate to chit on tap
                            if (point != null && point.dataPoint.chitId != null && onNavigateToEditor != null) {
                                onNavigateToEditor(point.dataPoint.chitId)
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp)
                    )

                    tooltipPoint?.let { point ->
                        Text(
                            text = "${formatValue(point.dataPoint.value)} ${chart.unit} on ${point.dataPoint.date.format(DateTimeFormatter.ofPattern("MMM d"))}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF6B4E31),
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Returns a unique color for each indicator type.
 */
private fun indicatorTypeColor(type: String): Color {
    // Match the web's color cycle
    val webColors = listOf(
        Color(0xFFB22222), // firebrick
        Color(0xFF4682B4), // steelblue
        Color(0xFFD4A017), // gold
        Color(0xFF6B8E23), // olivedrab
        Color(0xFF8B5A2B), // saddlebrown
        Color(0xFFD2691E), // chocolate
        Color(0xFF2E8B57), // seagreen
        Color(0xFFCC4444), // red variant
        Color(0xFF9370DB), // mediumpurple
        Color(0xFF20B2AA)  // lightseagreen
    )
    val index = (type.hashCode().and(0x7FFFFFFF)) % webColors.size
    return webColors[index]
}


@Composable
private fun CanvasLineChart(
    chart: IndicatorChart,
    lineColor: Color = Color(0xFF6B4E31),
    onPointTapped: (MappedPoint?) -> Unit,
    modifier: Modifier = Modifier
) {
    var mappedPoints by remember { mutableStateOf<List<MappedPoint>>(emptyList()) }
    val gridColor = Color(0xFFE0D4B5)
    val textColor = Color(0xFF6B4E31)

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
        val padding = 40f
        val points = ChartDataTransformer.mapToPixels(
            chart.points, size.width, size.height, padding
        )
        mappedPoints = points

        val drawWidth = size.width - (padding * 2)
        val drawHeight = size.height - (padding * 2)

        // Draw gridlines (4 horizontal lines)
        if (chart.points.isNotEmpty()) {
            val minVal = chart.points.minOf { it.value }
            val maxVal = chart.points.maxOf { it.value }
            val valRange = if (maxVal == minVal) 1f else maxVal - minVal

            for (i in 0..3) {
                val y = padding + (drawHeight / 3f) * i
                // Gridline
                drawLine(
                    color = gridColor,
                    start = Offset(padding, y),
                    end = Offset(size.width - padding, y),
                    strokeWidth = 0.5f
                )
                // Y-axis label
                val labelVal = maxVal - (valRange / 3f) * i
                drawContext.canvas.nativeCanvas.drawText(
                    formatValue(labelVal),
                    padding - 4f,
                    y + 4f,
                    android.graphics.Paint().apply {
                        color = 0xFF6B4E31.toInt()
                        textSize = 22f
                        textAlign = android.graphics.Paint.Align.RIGHT
                    }
                )
            }

            // X-axis date labels (up to 4)
            val dateLabels = minOf(chart.points.size, 4)
            if (dateLabels > 0 && points.isNotEmpty()) {
                for (i in 0 until dateLabels) {
                    val idx = if (dateLabels == 1) 0
                    else (i * (chart.points.size - 1)) / (dateLabels - 1)
                    val pt = chart.points[idx]
                    val mappedPt = points.getOrNull(idx) ?: continue
                    val dateLabel = pt.date.format(DateTimeFormatter.ofPattern("M/d"))
                    drawContext.canvas.nativeCanvas.drawText(
                        dateLabel,
                        mappedPt.x,
                        size.height - 4f,
                        android.graphics.Paint().apply {
                            color = 0xFF6B4E31.toInt()
                            textSize = 22f
                            textAlign = android.graphics.Paint.Align.CENTER
                        }
                    )
                }
            }
        }

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
