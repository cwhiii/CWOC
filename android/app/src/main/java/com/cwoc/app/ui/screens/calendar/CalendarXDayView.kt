package com.cwoc.app.ui.screens.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.util.DateUtils
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/**
 * X-Day calendar view — horizontal scrollable columns, one per day.
 * Each column shows a day header (day name + date) and stacked event cards.
 * The current day column is highlighted.
 */
@Composable
fun XDayView(
    events: List<ChitEntity>,
    dayCount: Int = 7,
    startDate: LocalDate = LocalDate.now(),
    onEventTap: (chitId: String) -> Unit
) {
    val today = LocalDate.now()
    val horizontalScrollState = rememberScrollState()

    // Group events by their date
    val eventsByDate = groupEventsByDate(events, startDate, dayCount)

    Row(
        modifier = Modifier
            .fillMaxSize()
            .horizontalScroll(horizontalScrollState)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        for (dayOffset in 0 until dayCount) {
            val columnDate = startDate.plusDays(dayOffset.toLong())
            val isToday = columnDate == today
            val dayEvents = eventsByDate[columnDate] ?: emptyList()

            DayColumn(
                date = columnDate,
                isToday = isToday,
                events = dayEvents,
                onEventTap = onEventTap
            )
        }
    }
}

@Composable
private fun DayColumn(
    date: LocalDate,
    isToday: Boolean,
    events: List<ChitEntity>,
    onEventTap: (chitId: String) -> Unit
) {
    val columnBackground = if (isToday) {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.15f)
    } else {
        Color.Transparent
    }

    Column(
        modifier = Modifier
            .width(160.dp)
            .fillMaxHeight()
            .background(
                color = columnBackground,
                shape = RoundedCornerShape(8.dp)
            )
            .padding(4.dp)
            .verticalScroll(rememberScrollState())
    ) {
        // Day header
        DayHeader(date = date, isToday = isToday)

        Spacer(modifier = Modifier.height(8.dp))

        // Stacked event cards
        if (events.isEmpty()) {
            Text(
                text = "No events",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                modifier = Modifier.padding(horizontal = 4.dp)
            )
        } else {
            events.forEach { event ->
                XDayEventCard(
                    event = event,
                    onTap = { onEventTap(event.id) }
                )
                Spacer(modifier = Modifier.height(4.dp))
            }
        }
    }
}

@Composable
private fun DayHeader(
    date: LocalDate,
    isToday: Boolean
) {
    val dayNameFormatter = DateTimeFormatter.ofPattern("EEE")
    val dateFormatter = DateTimeFormatter.ofPattern("MMM d")

    val headerBackground = if (isToday) {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.surfaceVariant
    }

    val headerTextColor = if (isToday) {
        MaterialTheme.colorScheme.onPrimary
    } else {
        MaterialTheme.colorScheme.onSurface
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = headerBackground,
                shape = RoundedCornerShape(6.dp)
            )
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = date.format(dayNameFormatter),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = headerTextColor
        )
        Text(
            text = date.format(dateFormatter),
            style = MaterialTheme.typography.labelSmall,
            color = headerTextColor.copy(alpha = 0.85f)
        )
    }
}

@Composable
private fun XDayEventCard(
    event: ChitEntity,
    onTap: () -> Unit
) {
    // Full background color matching web's applyChitColors(el, chitColor(chit))
    val cardBgColor = remember(event.color) { CwocChitCardStyle.resolveChitBgColor(event.color) }
    val cardTextColor = remember(cardBgColor) { CwocChitCardStyle.contrastTextColor(cardBgColor) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onTap),
        colors = CardDefaults.cardColors(
            containerColor = cardBgColor
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        shape = RoundedCornerShape(6.dp)
    ) {
        Row(
            modifier = Modifier.padding(8.dp),
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = event.title ?: "Untitled",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = cardTextColor
                )

                val timeText = buildEventTimeText(event)
                if (timeText.isNotBlank()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = timeText,
                        style = MaterialTheme.typography.labelSmall,
                        color = cardTextColor.copy(alpha = 0.7f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

/**
 * Groups events by their date based on startDatetime parsing.
 * Events are assigned to the day their startDatetime falls on.
 */
private fun groupEventsByDate(
    events: List<ChitEntity>,
    startDate: LocalDate,
    dayCount: Int
): Map<LocalDate, List<ChitEntity>> {
    val endDate = startDate.plusDays(dayCount.toLong())
    val result = mutableMapOf<LocalDate, MutableList<ChitEntity>>()

    for (event in events) {
        val eventDate = parseEventDate(event) ?: continue
        if (eventDate >= startDate && eventDate < endDate) {
            result.getOrPut(eventDate) { mutableListOf() }.add(event)
        }
    }

    return result
}

/**
 * Parses the event's startDatetime to extract the LocalDate.
 * Handles ISO datetime format (e.g., "2025-01-15T10:30:00") and date-only format.
 */
private fun parseEventDate(event: ChitEntity): LocalDate? {
    val datetime = event.startDatetime ?: return null
    return try {
        LocalDateTime.parse(datetime, DateTimeFormatter.ISO_LOCAL_DATE_TIME).toLocalDate()
    } catch (_: DateTimeParseException) {
        try {
            LocalDate.parse(datetime, DateTimeFormatter.ISO_LOCAL_DATE)
        } catch (_: DateTimeParseException) {
            null
        }
    }
}

/**
 * Builds a time display string for an event card.
 */
private fun buildEventTimeText(event: ChitEntity): String {
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

/**
 * Parses a color string (hex) into a Compose Color.
 */
private fun parseEventColor(colorString: String): Color {
    return try {
        val hex = colorString.removePrefix("#")
        val colorLong = hex.toLong(16)
        when (hex.length) {
            6 -> Color(0xFF000000 or colorLong)
            8 -> Color(colorLong)
            else -> Color(0xFF6B4E31) // fallback to CWOC primary brown
        }
    } catch (_: Exception) {
        Color(0xFF6B4E31)
    }
}
