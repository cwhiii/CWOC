package com.cwoc.app.ui.screens.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.components.WeatherIndicator
import com.cwoc.app.ui.components.LocationIndicator
import com.cwoc.app.ui.util.DateUtils
import java.time.LocalDate

/**
 * Calendar screen with day/week toggle, date navigation, and event list.
 * C1: Day view uses a time grid instead of flat list.
 * C8: Tapping events navigates to the editor.
 */
@Composable
fun CalendarScreen(
    viewModel: CalendarViewModel = hiltViewModel(),
    onNavigateToEditor: (String) -> Unit = {},
    onNavigateToNewChitWithPrefill: (start: String, end: String) -> Unit = { _, _ -> }
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        // View mode toggle
        ViewModeToggle(
            currentMode = uiState.viewMode,
            onModeChanged = viewModel::setViewMode
        )

        // Date navigation header
        DateNavigationHeader(
            title = uiState.headerTitle,
            onPrevious = viewModel::previousPeriod,
            onNext = viewModel::nextPeriod,
            onToday = viewModel::goToToday
        )

        // Event display based on view mode
        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(48.dp),
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
            uiState.events.isEmpty() -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "No Events",
                            style = MaterialTheme.typography.headlineSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "No events scheduled for this period",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            else -> {
                when (uiState.viewMode) {
                    CalendarViewMode.DAY -> {
                        // C1: Time grid instead of flat list
                        DayTimeGrid(
                            events = uiState.events,
                            date = uiState.selectedDate,
                            onEventTap = { event -> onNavigateToEditor(event.id) },
                            onEmptySlotTap = { tappedTime ->
                                // Task 33: Navigate to editor with pre-filled start/end
                                val start = tappedTime.toString()
                                val end = tappedTime.plusHours(1).toString()
                                onNavigateToNewChitWithPrefill(start, end)
                            }
                        )
                    }
                    CalendarViewMode.WEEK -> {
                        // C1 sub-item 2: Week time grid with 7 columns
                        WeekTimeGrid(
                            events = uiState.events,
                            weekStartDate = uiState.selectedDate,
                            onEventTap = { event -> onNavigateToEditor(event.id) },
                            onEmptySlotTap = { tappedTime ->
                                // Task 33: Navigate to editor with pre-filled start/end
                                val start = tappedTime.toString()
                                val end = tappedTime.plusHours(1).toString()
                                onNavigateToNewChitWithPrefill(start, end)
                            }
                        )
                    }
                    CalendarViewMode.MONTH -> {
                        Column {
                            // Compress/Scroll toggle
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 4.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                FilterChip(
                                    selected = uiState.monthMode == "compress",
                                    onClick = { viewModel.setMonthMode("compress") },
                                    label = { Text("Compress") }
                                )
                                FilterChip(
                                    selected = uiState.monthMode == "scroll",
                                    onClick = { viewModel.setMonthMode("scroll") },
                                    label = { Text("Scroll") }
                                )
                            }
                            MonthView(
                                events = uiState.events,
                                selectedDate = uiState.selectedDate,
                                weekStartDay = "sunday",
                                monthMode = uiState.monthMode,
                                onDayTap = { date ->
                                    viewModel.setViewMode(CalendarViewMode.DAY)
                                }
                            )
                        }
                    }
                    CalendarViewMode.YEAR -> {
                        YearView(
                            events = uiState.events,
                            selectedDate = uiState.selectedDate,
                            weekStartDay = "sunday",
                            onMonthTap = { date ->
                                viewModel.setViewMode(CalendarViewMode.MONTH)
                            }
                        )
                    }
                    CalendarViewMode.ITINERARY -> {
                        ItineraryView(
                            events = uiState.events,
                            onEventTap = { chitId -> onNavigateToEditor(chitId) }
                        )
                    }
                    CalendarViewMode.X_DAY -> {
                        XDayView(
                            events = uiState.events,
                            dayCount = uiState.xDayCount,
                            startDate = uiState.selectedDate,
                            onEventTap = { chitId -> onNavigateToEditor(chitId) }
                        )
                    }
                    CalendarViewMode.WORK_HOURS -> {
                        // ADD12: Work Hours view — same as Day but filtered to work hours
                        DayTimeGrid(
                            events = uiState.events,
                            date = uiState.selectedDate,
                            onEventTap = { event -> onNavigateToEditor(event.id) },
                            onEmptySlotTap = { tappedTime ->
                                val start = tappedTime.toString()
                                val end = tappedTime.plusHours(1).toString()
                                onNavigateToNewChitWithPrefill(start, end)
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ViewModeToggle(
    currentMode: CalendarViewMode,
    onModeChanged: (CalendarViewMode) -> Unit
) {
    val modes = listOf(
        CalendarViewMode.DAY to "Day",
        CalendarViewMode.WEEK to "Week",
        CalendarViewMode.MONTH to "Month",
        CalendarViewMode.YEAR to "Year",
        CalendarViewMode.ITINERARY to "Itinerary",
        CalendarViewMode.X_DAY to "X-Day",
        CalendarViewMode.WORK_HOURS to "Work"
    )

    LazyRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        itemsIndexed(modes) { _, (mode, label) ->
            FilterChip(
                selected = currentMode == mode,
                onClick = { onModeChanged(mode) },
                label = { Text(label) }
            )
        }
    }
}

@Composable
private fun DateNavigationHeader(
    title: String,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onToday: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        IconButton(onClick = onPrevious) {
            Icon(Icons.Default.ArrowBack, contentDescription = "Previous")
        }

        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        IconButton(onClick = onToday) {
            Icon(Icons.Default.Home, contentDescription = "Today")
        }

        IconButton(onClick = onNext) {
            Icon(Icons.Default.ArrowForward, contentDescription = "Next")
        }
    }
}

@Composable
private fun EventList(
    events: List<ChitEntity>,
    onEventTap: (ChitEntity) -> Unit = {}
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item { Spacer(modifier = Modifier.height(4.dp)) }

        items(events, key = { it.id }) { event ->
            EventCard(
                event = event,
                onTap = { onEventTap(event) }
            )
        }

        item { Spacer(modifier = Modifier.height(8.dp)) }
    }
}

@Composable
private fun EventCard(event: ChitEntity, onTap: () -> Unit = {}) {
    val eventColor = event.color?.let { parseColor(it) }
        ?: MaterialTheme.colorScheme.primary

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onTap() },
        colors = CardDefaults.cardColors(
            // B2 sub-item 4: background tint from chit color
            containerColor = eventColor.copy(alpha = 0.08f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Color indicator dot
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(eventColor)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = event.title ?: "Untitled Event",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                val timeText = buildTimeText(event)
                if (timeText.isNotBlank()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = timeText,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // B6: Weather indicator
                WeatherIndicator(
                    weatherDataJson = event.weatherData,
                    modifier = Modifier.padding(top = 2.dp)
                )

                // B7: Location indicator
                LocationIndicator(
                    location = event.location,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }
    }
}

private fun buildTimeText(event: ChitEntity): String {
    if (event.allDay) return "All day"

    val start = event.startDatetime?.let { DateUtils.formatDisplayTime(it) }
    val end = event.endDatetime?.let { DateUtils.formatDisplayTime(it) }

    return when {
        start != null && end != null -> "$start – $end"
        start != null -> start
        end != null -> "Until $end"
        else -> ""
    }
}

private fun parseColor(colorString: String): Color {
    return try {
        val hex = colorString.removePrefix("#")
        val colorLong = hex.toLong(16)
        when (hex.length) {
            6 -> Color(0xFF000000 or colorLong)
            8 -> Color(colorLong)
            else -> Color(0xFF6B4E31) // fallback to primary
        }
    } catch (_: Exception) {
        Color(0xFF6B4E31) // fallback to primary
    }
}

// --- Additional view composables (stubs for tasks 2.2–2.5) ---




