package com.cwoc.app.ui.screens.indicators

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import java.time.format.DateTimeFormatter

/**
 * Indicators/Health Charts view — displays charts for each indicator type.
 */
@Composable
fun IndicatorsScreen(
    modifier: Modifier = Modifier,
    viewModel: IndicatorsViewModel = hiltViewModel()
) {
    val charts by viewModel.charts.collectAsState()
    val selectedRange by viewModel.selectedRange.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        TimeRangeSelector(
            selected = selectedRange,
            onSelect = { viewModel.setTimeRange(it) }
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

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF5E6D3))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = chart.type.replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.titleSmall,
                color = Color(0xFF6B4E31),
                fontWeight = FontWeight.Bold
            )

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


@Composable
private fun CanvasLineChart(
    chart: IndicatorChart,
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
                    color = Color(0xFF6B4E31),
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
            color = Color(0xFF6B4E31),
            style = Stroke(width = 2.5f)
        )

        // Draw data points
        points.forEach { p ->
            drawCircle(
                color = Color(0xFF6B4E31),
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
