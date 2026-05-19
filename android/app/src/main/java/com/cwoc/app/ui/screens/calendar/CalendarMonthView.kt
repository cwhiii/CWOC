package com.cwoc.app.ui.screens.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.components.CwocChitCardStyle
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.TemporalAdjusters

/**
 * Data class representing a single day cell in the month grid.
 */
private data class MonthDayCell(
    val date: LocalDate,
    val isCurrentMonth: Boolean,
    val isToday: Boolean,
    val events: List<ChitEntity>
)

/**
 * Month view composable displaying a calendar grid with event text.
 * Supports two modes:
 * - "compress": fixed-height day cells with maxLines truncation on event text
 * - "scroll": day cells expand to fit all events, month grid wrapped in vertical scroll
 *
 * @param events List of events for the visible date range
 * @param selectedDate The currently selected date (determines which month to show)
 * @param weekStartDay The day the week starts on (e.g., "sunday", "monday")
 * @param monthMode "compress" for fixed-height cells, "scroll" for expandable cells
 * @param onDayTap Callback when a day cell is tapped
 */
@Composable
fun MonthView(
    events: List<ChitEntity>,
    selectedDate: LocalDate,
    weekStartDay: String,
    monthMode: String = "compress",
    onDayTap: (LocalDate) -> Unit
) {
    val today = LocalDate.now()
    val yearMonth = YearMonth.from(selectedDate)
    val startDayOfWeek = parseWeekStartDay(weekStartDay)

    // Build the grid of day cells
    val dayCells = remember(yearMonth, startDayOfWeek, events) {
        buildMonthGrid(yearMonth, startDayOfWeek, today, events)
    }

    // Day-of-week header labels
    val dayHeaders = remember(startDayOfWeek) {
        buildDayHeaders(startDayOfWeek)
    }

    // Split cells into weeks (rows of 7)
    val weeks = remember(dayCells) {
        dayCells.chunked(7)
    }

    val scrollModifier = if (monthMode == "scroll") {
        Modifier.verticalScroll(rememberScrollState())
    } else {
        Modifier
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp)
            .then(scrollModifier)
    ) {
        // Day-of-week header row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            dayHeaders.forEach { label ->
                Text(
                    text = label,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Calendar grid rendered as rows of 7 cells
        weeks.forEach { week ->
            Row(
                modifier = Modifier.fillMaxWidth()
            ) {
                week.forEach { cell ->
                    Box(modifier = Modifier.weight(1f)) {
                        MonthDayCellView(
                            cell = cell,
                            monthMode = monthMode,
                            onTap = { onDayTap(cell.date) }
                        )
                    }
                }
                // Fill remaining slots if last week is incomplete
                if (week.size < 7) {
                    repeat(7 - week.size) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

/**
 * Individual day cell in the month grid.
 * In compress mode: fixed height (80dp) with maxLines=2 on event text.
 * In scroll mode: wraps content height to show all events.
 */
@Composable
private fun MonthDayCellView(
    cell: MonthDayCell,
    monthMode: String,
    onTap: () -> Unit
) {
    val textColor = when {
        cell.isToday -> MaterialTheme.colorScheme.onPrimary
        cell.isCurrentMonth -> MaterialTheme.colorScheme.onSurface
        else -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
    }

    val backgroundColor = if (cell.isToday) {
        MaterialTheme.colorScheme.primary
    } else {
        Color.Transparent
    }

    val cellModifier = if (monthMode == "compress") {
        Modifier
            .fillMaxWidth()
            .height(80.dp)
            .padding(1.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(backgroundColor)
            .clickable { onTap() }
    } else {
        Modifier
            .fillMaxWidth()
            .wrapContentHeight()
            .padding(1.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(backgroundColor)
            .clickable { onTap() }
    }

    Column(
        modifier = cellModifier.padding(2.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Day number
        Text(
            text = cell.date.dayOfMonth.toString(),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = if (cell.isToday) FontWeight.Bold else FontWeight.Normal,
            color = textColor,
            fontSize = 12.sp
        )

        // Event text list
        if (cell.events.isNotEmpty()) {
            Spacer(modifier = Modifier.height(1.dp))
            if (monthMode == "compress") {
                // Compress mode: show events with maxLines truncation
                cell.events.take(3).forEach { event ->
                    val eventBg = CwocChitCardStyle.resolveChitBgColor(event.color)
                    val eventText = CwocChitCardStyle.contrastTextColor(eventBg)
                    Text(
                        text = event.title ?: "Untitled",
                        style = MaterialTheme.typography.labelSmall,
                        fontSize = 9.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = eventText,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(eventBg, RoundedCornerShape(2.dp))
                            .padding(horizontal = 2.dp)
                    )
                }
                // Show overflow count if more events exist
                if (cell.events.size > 3) {
                    Text(
                        text = "+${cell.events.size - 3} more",
                        style = MaterialTheme.typography.labelSmall,
                        fontSize = 8.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            } else {
                // Scroll mode: show ALL events, no truncation
                cell.events.forEach { event ->
                    val eventBg = CwocChitCardStyle.resolveChitBgColor(event.color)
                    val eventText = CwocChitCardStyle.contrastTextColor(eventBg)
                    Text(
                        text = event.title ?: "Untitled",
                        style = MaterialTheme.typography.labelSmall,
                        fontSize = 9.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        color = eventText,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(eventBg, RoundedCornerShape(2.dp))
                            .padding(horizontal = 2.dp)
                    )
                }
            }
        }
    }
}

/**
 * Builds the full month grid including leading/trailing days from adjacent months.
 */
private fun buildMonthGrid(
    yearMonth: YearMonth,
    startDayOfWeek: DayOfWeek,
    today: LocalDate,
    events: List<ChitEntity>
): List<MonthDayCell> {
    val firstOfMonth = yearMonth.atDay(1)
    val lastOfMonth = yearMonth.atEndOfMonth()

    // Find the first day to display (may be in previous month)
    val gridStart = firstOfMonth.with(TemporalAdjusters.previousOrSame(startDayOfWeek))

    // Find the last day to display (fill out the last week)
    val endDayOfWeek = startDayOfWeek.minus(1) // Day before start = last day of week
    val gridEnd = lastOfMonth.with(TemporalAdjusters.nextOrSame(endDayOfWeek))

    // Group events by date for quick lookup
    val eventsByDate = groupEventsByDate(events)

    val cells = mutableListOf<MonthDayCell>()
    var current = gridStart
    while (!current.isAfter(gridEnd)) {
        cells.add(
            MonthDayCell(
                date = current,
                isCurrentMonth = current.month == yearMonth.month && current.year == yearMonth.year,
                isToday = current == today,
                events = eventsByDate[current] ?: emptyList()
            )
        )
        current = current.plusDays(1)
    }

    return cells
}

/**
 * Groups events by their start date for efficient lookup.
 */
private fun groupEventsByDate(events: List<ChitEntity>): Map<LocalDate, List<ChitEntity>> {
    val map = mutableMapOf<LocalDate, MutableList<ChitEntity>>()
    for (event in events) {
        val dateStr = event.startDatetime ?: event.dueDatetime ?: continue
        val date = try {
            LocalDate.parse(dateStr.substring(0, 10))
        } catch (_: Exception) {
            continue
        }
        map.getOrPut(date) { mutableListOf() }.add(event)
    }
    return map
}

/**
 * Builds the 7 day-of-week header labels starting from the configured start day.
 */
private fun buildDayHeaders(startDayOfWeek: DayOfWeek): List<String> {
    val abbreviations = mapOf(
        DayOfWeek.SUNDAY to "Sun",
        DayOfWeek.MONDAY to "Mon",
        DayOfWeek.TUESDAY to "Tue",
        DayOfWeek.WEDNESDAY to "Wed",
        DayOfWeek.THURSDAY to "Thu",
        DayOfWeek.FRIDAY to "Fri",
        DayOfWeek.SATURDAY to "Sat"
    )
    return (0 until 7).map { offset ->
        val day = startDayOfWeek.plus(offset.toLong())
        abbreviations[day] ?: ""
    }
}

/**
 * Parses the weekStartDay setting string into a DayOfWeek.
 * Defaults to Sunday if the value is unrecognized.
 */
private fun parseWeekStartDay(weekStartDay: String): DayOfWeek {
    return when (weekStartDay.lowercase()) {
        "monday" -> DayOfWeek.MONDAY
        "tuesday" -> DayOfWeek.TUESDAY
        "wednesday" -> DayOfWeek.WEDNESDAY
        "thursday" -> DayOfWeek.THURSDAY
        "friday" -> DayOfWeek.FRIDAY
        "saturday" -> DayOfWeek.SATURDAY
        else -> DayOfWeek.SUNDAY
    }
}

/**
 * Parses a color string (hex) into a Compose Color.
 * Falls back to CWOC primary brown on failure.
 */
private fun parseEventColor(colorString: String): Color {
    return try {
        val hex = colorString.removePrefix("#")
        val colorLong = hex.toLong(16)
        when (hex.length) {
            6 -> Color(0xFF000000 or colorLong)
            8 -> Color(colorLong)
            else -> Color(0xFF6B4E31)
        }
    } catch (_: Exception) {
        Color(0xFF6B4E31)
    }
}
