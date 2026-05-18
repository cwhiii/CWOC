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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.local.entity.ChitEntity
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/**
 * Itinerary view — chronological list of events grouped by day.
 * Days with no events are skipped.
 */
@Composable
fun ItineraryView(
    events: List<ChitEntity>,
    onEventTap: (chitId: String) -> Unit
) {
    val groupedEvents = groupEventsByDay(events)

    if (groupedEvents.isEmpty()) {
        ItineraryEmptyState()
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            item { Spacer(modifier = Modifier.height(4.dp)) }

            groupedEvents.forEach { (date, dayEvents) ->
                item(key = "header_$date") {
                    ItineraryDayHeader(date = date)
                }

                items(dayEvents, key = { it.id }) { event ->
                    ItineraryEventCard(
                        event = event,
                        onTap = { onEventTap(event.id) }
                    )
                }

                item(key = "spacer_$date") {
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }

            item { Spacer(modifier = Modifier.height(8.dp)) }
        }
    }
}

@Composable
private fun ItineraryEmptyState() {
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
                text = "No events scheduled in this range",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ItineraryDayHeader(date: LocalDate) {
    val today = LocalDate.now()
    val formatter = DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy")
    val dateText = when (date) {
        today -> "Today — ${date.format(formatter)}"
        today.plusDays(1) -> "Tomorrow — ${date.format(formatter)}"
        else -> date.format(formatter)
    }

    Text(
        text = dateText,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp, horizontal = 4.dp)
    )
}

@Composable
private fun ItineraryEventCard(
    event: ChitEntity,
    onTap: () -> Unit
) {
    val eventColor = event.color?.let { parseItineraryColor(it) }
        ?: MaterialTheme.colorScheme.primary

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onTap),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
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

                val timeText = buildItineraryTimeText(event)
                if (timeText.isNotBlank()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = timeText,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

/**
 * Groups events by their start date, sorted chronologically.
 * Events without a startDatetime are excluded.
 * Days with no events are not included in the result.
 */
private fun groupEventsByDay(events: List<ChitEntity>): List<Pair<LocalDate, List<ChitEntity>>> {
    val isoFormatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME

    return events
        .mapNotNull { event ->
            val date = event.startDatetime?.let { dateStr ->
                try {
                    LocalDateTime.parse(dateStr, isoFormatter).toLocalDate()
                } catch (_: DateTimeParseException) {
                    try {
                        LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE)
                    } catch (_: DateTimeParseException) {
                        null
                    }
                }
            }
            if (date != null) date to event else null
        }
        .groupBy({ it.first }, { it.second })
        .toSortedMap()
        .map { (date, dayEvents) ->
            date to dayEvents.sortedBy { it.startDatetime }
        }
}

private fun buildItineraryTimeText(event: ChitEntity): String {
    if (event.allDay) return "All day"

    val isoFormatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME
    val timeFormatter = DateTimeFormatter.ofPattern("h:mm a")

    val start = event.startDatetime?.let { dateStr ->
        try {
            LocalDateTime.parse(dateStr, isoFormatter).format(timeFormatter)
        } catch (_: DateTimeParseException) {
            null
        }
    }
    val end = event.endDatetime?.let { dateStr ->
        try {
            LocalDateTime.parse(dateStr, isoFormatter).format(timeFormatter)
        } catch (_: DateTimeParseException) {
            null
        }
    }

    return when {
        start != null && end != null -> "$start – $end"
        start != null -> start
        end != null -> "Until $end"
        else -> ""
    }
}

private fun parseItineraryColor(colorString: String): Color {
    return try {
        val hex = colorString.removePrefix("#")
        val colorLong = hex.toLong(16)
        when (hex.length) {
            6 -> Color(0xFF000000 or colorLong)
            8 -> Color(colorLong)
            else -> Color(0xFF6B4E31) // fallback to CWOC primary
        }
    } catch (_: Exception) {
        Color(0xFF6B4E31) // fallback to CWOC primary
    }
}
