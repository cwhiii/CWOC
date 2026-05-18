package com.cwoc.app.ui.screens.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.local.entity.ChitEntity
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.Month
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

/**
 * Year view composable displaying 12 mini-month grids in a 3×4 layout.
 * Each mini-month shows day numbers with dot indicators for days with events.
 * Tapping a month navigates to that month's view.
 */
@Composable
fun YearView(
    events: List<ChitEntity>,
    selectedDate: LocalDate,
    weekStartDay: String,
    onMonthTap: (LocalDate) -> Unit
) {
    val year = selectedDate.year
    val today = LocalDate.now()
    val currentMonth = today.month
    val currentYear = today.year

    // Build a set of days that have events for quick lookup
    val eventDays: Set<LocalDate> = remember(events) {
        events.mapNotNull { chit ->
            chit.startDatetime?.let { parseToLocalDate(it) }
        }.toSet()
    }

    // Determine the first day of week from settings
    val firstDayOfWeek = remember(weekStartDay) {
        parseWeekStartDay(weekStartDay)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        // 4 rows of 3 months each
        for (row in 0 until 4) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                for (col in 0 until 3) {
                    val monthIndex = row * 3 + col + 1 // 1-based month
                    val month = Month.of(monthIndex)
                    val isCurrentMonth = (year == currentYear && month == currentMonth)
                    val firstOfMonth = LocalDate.of(year, month, 1)

                    MiniMonthGrid(
                        yearMonth = YearMonth.of(year, month),
                        isCurrentMonth = isCurrentMonth,
                        today = today,
                        eventDays = eventDays,
                        firstDayOfWeek = firstDayOfWeek,
                        onMonthTap = { onMonthTap(firstOfMonth) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
            if (row < 3) {
                Spacer(modifier = Modifier.height(4.dp))
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
    }
}

/**
 * A single mini-month grid showing the month name, abbreviated day headers,
 * and day numbers with event dot indicators.
 */
@Composable
private fun MiniMonthGrid(
    yearMonth: YearMonth,
    isCurrentMonth: Boolean,
    today: LocalDate,
    eventDays: Set<LocalDate>,
    firstDayOfWeek: DayOfWeek,
    onMonthTap: () -> Unit,
    modifier: Modifier = Modifier
) {
    val containerColor = if (isCurrentMonth) {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
    } else {
        MaterialTheme.colorScheme.surface
    }

    Card(
        modifier = modifier.clickable { onMonthTap() },
        colors = CardDefaults.cardColors(containerColor = containerColor),
        shape = RoundedCornerShape(8.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isCurrentMonth) 2.dp else 0.dp)
    ) {
        Column(
            modifier = Modifier.padding(4.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Month name header
            Text(
                text = yearMonth.month.getDisplayName(TextStyle.SHORT, Locale.getDefault()),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = if (isCurrentMonth) FontWeight.Bold else FontWeight.Medium,
                color = if (isCurrentMonth) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(2.dp))

            // Day-of-week headers
            val orderedDays = getOrderedDaysOfWeek(firstDayOfWeek)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                orderedDays.forEach { day ->
                    Text(
                        text = day.getDisplayName(TextStyle.NARROW, Locale.getDefault()),
                        style = MaterialTheme.typography.labelSmall,
                        fontSize = 8.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(1.dp))

            // Day number grid
            val daysInMonth = yearMonth.lengthOfMonth()
            val firstOfMonth = yearMonth.atDay(1)
            val startOffset = getStartOffset(firstOfMonth.dayOfWeek, firstDayOfWeek)

            // Calculate total cells needed (offset + days in month), then rows
            val totalCells = startOffset + daysInMonth
            val totalRows = (totalCells + 6) / 7

            for (week in 0 until totalRows) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    for (dayInWeek in 0 until 7) {
                        val cellIndex = week * 7 + dayInWeek
                        val dayNumber = cellIndex - startOffset + 1

                        if (dayNumber in 1..daysInMonth) {
                            val date = LocalDate.of(yearMonth.year, yearMonth.month, dayNumber)
                            val hasEvent = eventDays.contains(date)
                            val isToday = date == today

                            DayCell(
                                dayNumber = dayNumber,
                                hasEvent = hasEvent,
                                isToday = isToday,
                                modifier = Modifier.weight(1f)
                            )
                        } else {
                            // Empty cell
                            Box(modifier = Modifier.weight(1f).aspectRatio(1f))
                        }
                    }
                }
            }
        }
    }
}

/**
 * A single day cell in the mini-month grid.
 * Shows the day number and a small dot if there are events on that day.
 */
@Composable
private fun DayCell(
    dayNumber: Int,
    hasEvent: Boolean,
    isToday: Boolean,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.aspectRatio(1f),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Day number with today highlight
            Box(
                contentAlignment = Alignment.Center,
                modifier = if (isToday) {
                    Modifier
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                } else {
                    Modifier.size(16.dp)
                }
            ) {
                Text(
                    text = dayNumber.toString(),
                    fontSize = 8.sp,
                    color = if (isToday) {
                        MaterialTheme.colorScheme.onPrimary
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                    textAlign = TextAlign.Center,
                    lineHeight = 8.sp
                )
            }

            // Event dot indicator
            if (hasEvent) {
                Box(
                    modifier = Modifier
                        .size(3.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                )
            }
        }
    }
}

/**
 * Returns the ordered list of days of the week starting from the given first day.
 */
private fun getOrderedDaysOfWeek(firstDayOfWeek: DayOfWeek): List<DayOfWeek> {
    val days = DayOfWeek.entries.toMutableList()
    val startIndex = days.indexOf(firstDayOfWeek)
    return days.subList(startIndex, days.size) + days.subList(0, startIndex)
}

/**
 * Calculates how many empty cells to place before the first day of the month.
 */
private fun getStartOffset(firstDayOfMonth: DayOfWeek, firstDayOfWeek: DayOfWeek): Int {
    val diff = firstDayOfMonth.value - firstDayOfWeek.value
    return if (diff >= 0) diff else diff + 7
}

/**
 * Parses the weekStartDay setting string into a DayOfWeek.
 * Supports values like "sunday", "monday", "saturday", etc.
 * Defaults to Sunday if unrecognized.
 */
private fun parseWeekStartDay(weekStartDay: String): DayOfWeek {
    return when (weekStartDay.lowercase().trim()) {
        "monday", "mon" -> DayOfWeek.MONDAY
        "tuesday", "tue" -> DayOfWeek.TUESDAY
        "wednesday", "wed" -> DayOfWeek.WEDNESDAY
        "thursday", "thu" -> DayOfWeek.THURSDAY
        "friday", "fri" -> DayOfWeek.FRIDAY
        "saturday", "sat" -> DayOfWeek.SATURDAY
        else -> DayOfWeek.SUNDAY
    }
}

/**
 * Parses a datetime string (ISO format) to a LocalDate.
 * Returns null if parsing fails.
 */
private fun parseToLocalDate(datetime: String): LocalDate? {
    return try {
        // Handle both "2024-01-15" and "2024-01-15T10:00:00" formats
        LocalDate.parse(datetime.take(10))
    } catch (_: Exception) {
        null
    }
}
