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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.util.DateUtils
import com.cwoc.app.ui.viewmodel.SidebarStateViewModel
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
    onNavigateToNewChitWithPrefill: (start: String, end: String) -> Unit = { _, _ -> },
    sidebarStateViewModel: SidebarStateViewModel? = null
) {
    val uiState by viewModel.uiState.collectAsState()

    // Sync sidebar state → CalendarViewModel (period, date, monthMode)
    val sidebarState = sidebarStateViewModel?.state?.collectAsState()?.value
    LaunchedEffect(sidebarState?.currentPeriod) {
        if (sidebarState != null) {
            val mode = when (sidebarState.currentPeriod) {
                "Itinerary" -> CalendarViewMode.ITINERARY
                "Day" -> CalendarViewMode.DAY
                "Work" -> CalendarViewMode.WORK_HOURS
                "Week" -> CalendarViewMode.WEEK
                "SevenDay" -> CalendarViewMode.X_DAY
                "Month" -> CalendarViewMode.MONTH
                "Year" -> CalendarViewMode.YEAR
                else -> CalendarViewMode.WEEK
            }
            if (uiState.viewMode != mode) {
                viewModel.setViewMode(mode)
            }
        }
    }
    LaunchedEffect(sidebarState?.currentDate) {
        if (sidebarState != null && uiState.selectedDate != sidebarState.currentDate) {
            viewModel.setDate(sidebarState.currentDate)
        }
    }
    LaunchedEffect(sidebarState?.monthMode) {
        if (sidebarState != null && uiState.monthMode != sidebarState.monthMode) {
            viewModel.setMonthMode(sidebarState.monthMode)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {

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
    // Full background color matching web's applyChitColors(el, chitColor(chit))
    val cardBgColor = remember(event.color) { CwocChitCardStyle.resolveChitBgColor(event.color) }
    val cardTextColor = remember(cardBgColor) { CwocChitCardStyle.contrastTextColor(cardBgColor) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onTap() },
        colors = CardDefaults.cardColors(
            containerColor = cardBgColor
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = event.title ?: "Untitled Event",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = cardTextColor,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                val timeText = buildTimeText(event)
                if (timeText.isNotBlank()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = timeText,
                        style = MaterialTheme.typography.bodySmall,
                        color = cardTextColor.copy(alpha = 0.7f)
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




