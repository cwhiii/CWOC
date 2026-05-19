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
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
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
import com.cwoc.app.ui.viewmodel.SidebarStateViewModel
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * Indicators/Health Charts view — displays charts for health indicators.
 * Supports 3 sub-modes: Charts, Calendar, Log (matching web's pill toggle).
 * Time range is controlled by the sidebar.
 */
@Composable
fun IndicatorsScreen(
    modifier: Modifier = Modifier,
    viewModel: IndicatorsViewModel = hiltViewModel(),
    sidebarStateViewModel: SidebarStateViewModel? = null
) {
    val charts by viewModel.charts.collectAsState()
    val selectedRange by viewModel.selectedRange.collectAsState()
    val healthEntries by viewModel.healthEntries.collectAsState()

    // Mode state: charts, calendar, log
    var selectedMode by remember { mutableStateOf("charts") }

    // Sync sidebar indicatorsRange → ViewModel time range
    val sidebarState = sidebarStateViewModel?.state?.collectAsState()?.value
    LaunchedEffect(sidebarState?.indicatorsRange) {
        if (sidebarState != null) {
            val range = when (sidebarState.indicatorsRange) {
                "day" -> TimeRange.SEVEN_DAYS
                "week" -> TimeRange.SEVEN_DAYS
                "month" -> TimeRange.THIRTY_DAYS
                "year" -> TimeRange.NINETY_DAYS
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
        // Mode toggle row (Calendar | Log | Charts)
        IndicatorsModeToggle(
            selectedMode = selectedMode,
            onModeSelected = { selectedMode = it }
        )

        Spacer(modifier = Modifier.height(8.dp))

        when (selectedMode) {
            "charts" -> {
                if (charts.isEmpty()) {
                    EmptyIndicatorsState()
                } else {
                    // Graph filter: show/hide individual indicator types
                    val allTypes = remember(charts) { charts.map { it.type } }
                    var hiddenTypes by remember { mutableStateOf(setOf<String>()) }
                    val visibleCharts = charts.filter { it.type !in hiddenTypes }

                    Column {
                        // Filter chip row (scrollable)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState())
                                .padding(bottom = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            allTypes.forEach { type ->
                                FilterChip(
                                    selected = type !in hiddenTypes,
                                    onClick = {
                                        hiddenTypes = if (type in hiddenTypes) hiddenTypes - type
                                            else hiddenTypes + type
                                    },
                                    label = { Text(type.replaceFirstChar { it.uppercase() }, fontSize = 11.sp) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = indicatorTypeColor(type),
                                        selectedLabelColor = Color.White
                                    )
                                )
                            }
                        }

                        LazyColumn {
                            items(visibleCharts, key = { it.type }) { chart ->
                                IndicatorChartCard(chart = chart)
                                Spacer(modifier = Modifier.height(12.dp))
                            }
                        }
                    }
                }
            }
            "calendar" -> {
                IndicatorsCalendarView(healthEntries = healthEntries)
            }
            "log" -> {
                IndicatorsLogView(healthEntries = healthEntries)
            }
        }
    }
}

/**
 * Mode toggle row: Calendar | Log | Charts (matching web's 3-value pill toggle).
 */
@Composable
private fun IndicatorsModeToggle(
    selectedMode: String,
    onModeSelected: (String) -> Unit
) {
    val modes = listOf(
        "charts" to "📊 Charts",
        "calendar" to "📅 Calendar",
        "log" to "📋 Log"
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        modes.forEach { (modeValue, label) ->
            FilterChip(
                selected = selectedMode == modeValue,
                onClick = { onModeSelected(modeValue) },
                label = { Text(label) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = Color(0xFF6B4E31),
                    selectedLabelColor = Color.White
                )
            )
        }
    }
}

/**
 * Calendar view — year-view grid showing months × days, color-coded by health data.
 * Green = all readings in range, Amber = any reading out of range, Empty = no data.
 */
@Composable
private fun IndicatorsCalendarView(healthEntries: List<HealthEntry>) {
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

    // Build range map from indicator objects: type name → (min, max)
    val rangeMap = remember(indicatorObjects) {
        indicatorObjects.associate { obj ->
            obj.name.lowercase() to Pair(obj.range_min, obj.range_max)
        }
    }

    /**
     * Classify a day's color: "green" (all in range), "amber" (any out of range), "none" (no data).
     */
    fun classifyDay(date: LocalDate): String {
        val entries = entriesByDate[date] ?: return "none"
        if (entries.isEmpty()) return "none"

        var hasOutOfRange = false
        for (entry in entries) {
            val range = rangeMap[entry.indicatorType.lowercase()]
            if (range != null) {
                val (min, max) = range
                if (min != null && entry.value < min) { hasOutOfRange = true; break }
                if (max != null && entry.value > max) { hasOutOfRange = true; break }
            }
        }
        return if (hasOutOfRange) "amber" else "green"
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
                    // Day cells in a wrapping row
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
                            val cellColor = when (classification) {
                                "green" -> Color(0xFF4A6741) // Green — all in range
                                "amber" -> Color(0xFFD4A017) // Amber — out of range
                                else -> Color(0xFFEDE0D4) // Empty — no data
                            }
                            Box(
                                modifier = Modifier
                                    .size(14.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(cellColor)
                                    .then(
                                        if (isToday) Modifier.background(Color(0xFF6B4E31).copy(alpha = 0.3f))
                                        else Modifier
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                if (isToday) {
                                    Text(
                                        text = "•",
                                        fontSize = 8.sp,
                                        color = Color.White
                                    )
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
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(Color(0xFF4A6741))
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("All in range", style = MaterialTheme.typography.labelSmall, color = Color(0xFF6B4E31))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(Color(0xFFD4A017))
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Out of range", style = MaterialTheme.typography.labelSmall, color = Color(0xFF6B4E31))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(Color(0xFFEDE0D4))
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("No data", style = MaterialTheme.typography.labelSmall, color = Color(0xFF6B4E31))
                }
            }
        }
    }
}

/**
 * Log view — reverse-chronological list of health data entries.
 * Each entry shows date, chit title, and indicator readings.
 */
@Composable
private fun IndicatorsLogView(healthEntries: List<HealthEntry>) {
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

    // Group entries by date, sorted reverse-chronologically
    val groupedByDate = remember(healthEntries) {
        healthEntries
            .sortedByDescending { it.date }
            .groupBy { it.date }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Text(
                text = "Health Log",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF6B4E31)
            )
            Spacer(modifier = Modifier.height(8.dp))
        }

        groupedByDate.forEach { (date, entries) ->
            item(key = date.toString()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF5E6D3))
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = date.format(DateTimeFormatter.ofPattern("MMM d, yyyy")),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF6B4E31)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        entries.forEach { entry ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 2.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    if (!entry.chitTitle.isNullOrBlank()) {
                                        Text(
                                            text = entry.chitTitle,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF4A3520),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    Text(
                                        text = "${entry.indicatorType}: ${entry.value}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = Color(0xFF1A1208)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}


// ─── Chart Components ────────────────────────────────────────────────────────

@Composable
private fun IndicatorChartCard(chart: IndicatorChart) {
    var tooltipPoint by remember { mutableStateOf<MappedPoint?>(null) }
    var isExpanded by remember { mutableStateOf(true) }
    // S1: Per-type color based on indicator type name
    val chartColor = remember(chart.type) { indicatorTypeColor(chart.type) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF5E6D3))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // S3: Legend row — type name + color indicator + unit + expand/collapse
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { isExpanded = !isExpanded },
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
                // Expand/collapse indicator
                Text(
                    text = if (isExpanded) "▼" else "▶",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color(0xFF6B4E31)
                )
            }

            // Chart content (collapsible)
            if (isExpanded) {
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
            } // end if (isExpanded)
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
