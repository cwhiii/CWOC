package com.cwoc.app.ui.screens.indicators

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.domain.chart.ChartDataTransformer
import com.cwoc.app.domain.chart.MappedPoint
import com.cwoc.app.domain.chart.TimeRange
import com.cwoc.app.ui.viewmodel.SidebarStateViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Indicators/Health Charts view — displays charts for health indicators.
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


// ─── Chart Components ────────────────────────────────────────────────────────

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
