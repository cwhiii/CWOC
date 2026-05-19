package com.cwoc.app.ui.components

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import com.cwoc.app.ui.theme.LoraFontFamily
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

// ─── Colors matching Flatpickr / web spec ────────────────────────────────────
private val CalendarBg = Color(0xFFFFFAF0)           // #fffaf0
private val CalendarBorder = Color(0xFF8B4513)       // #8b4513
private val HeaderTextColor = Color(0xFF4A2C2A)      // #4a2c2a
private val DayOfWeekColor = Color(0xFF6B4E31)       // #6b4e31
private val DayTextColor = Color(0xFF1A1208)         // #1a1208
private val SelectedDayBg = Color(0xFF008080)        // teal #008080
private val SelectedDayText = Color.White
private val TodayBorderColor = Color(0xFF008080)     // teal border for today
private val OtherMonthColor = Color(0xFF8B7355)      // #8b7355 at 0.4 opacity
private val OtherMonthAlpha = 0.4f
private val ScrimColor = Color(0x40000000)           // semi-transparent scrim for outside tap

private val DAY_CELL_HEIGHT = 36.dp
private val CALENDAR_PADDING = 8.dp

/**
 * Custom Flatpickr-style calendar date picker dropdown.
 * Renders as a popup anchored below the triggering element.
 * Replaces native Android DatePickerDialog.
 *
 * @param isOpen Whether the calendar is currently shown
 * @param initialDate Initial date for pre-selection (format "YYYY-Mon-DD" e.g. "2026-May-18"), or null
 * @param onDateSelected Called with selected date in "YYYY-Mon-DD" format
 * @param onDismiss Called when the calendar is dismissed without selection
 */
@Composable
fun FlatpickrCalendarPicker(
    isOpen: Boolean,
    initialDate: String? = null,
    onDateSelected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    if (!isOpen) return

    // Parse initial date
    val parsedInitial = remember(initialDate) { parseYMDDate(initialDate) }
    val today = remember { LocalDate.now() }

    // State for currently viewed month
    var currentMonth by remember(parsedInitial) {
        mutableStateOf(
            YearMonth.of(
                parsedInitial?.year ?: today.year,
                parsedInitial?.monthValue ?: today.monthValue
            )
        )
    }

    // State for selected date
    var selectedDate by remember(parsedInitial) { mutableStateOf(parsedInitial) }

    // Handle back button press to dismiss
    BackHandler { onDismiss() }

    // Full-screen scrim for outside-tap dismissal + popup content
    Popup(
        alignment = Alignment.TopCenter,
        onDismissRequest = onDismiss,
        properties = PopupProperties(
            focusable = true,
            dismissOnBackPress = true,
            dismissOnClickOutside = true
        )
    ) {
        // Full screen box to catch outside taps
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(ScrimColor)
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() }
                ) { onDismiss() },
            contentAlignment = Alignment.Center
        ) {
            // Calendar container
            Surface(
                modifier = Modifier
                    .fillMaxWidth(0.92f)
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { /* consume click to prevent dismiss */ }
                    .border(1.dp, CalendarBorder, RoundedCornerShape(4.dp)),
                shape = RoundedCornerShape(4.dp),
                color = CalendarBg,
                shadowElevation = 8.dp
            ) {
                Column(
                    modifier = Modifier.padding(CALENDAR_PADDING)
                ) {
                    // Month/Year header with navigation
                    CalendarHeader(
                        currentMonth = currentMonth,
                        onPreviousMonth = { currentMonth = currentMonth.minusMonths(1) },
                        onNextMonth = { currentMonth = currentMonth.plusMonths(1) }
                    )

                    // Day-of-week header row
                    DayOfWeekHeader()

                    // Day grid
                    DayGrid(
                        currentMonth = currentMonth,
                        selectedDate = selectedDate,
                        today = today,
                        onDaySelected = { date ->
                            selectedDate = date
                            onDateSelected(formatYMDDate(date))
                        }
                    )
                }
            }
        }
    }
}

/**
 * Month/year header with left/right navigation arrows.
 */
@Composable
private fun CalendarHeader(
    currentMonth: YearMonth,
    onPreviousMonth: () -> Unit,
    onNextMonth: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(CalendarBg)
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(
            onClick = onPreviousMonth,
            modifier = Modifier.size(32.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                contentDescription = "Previous month",
                tint = HeaderTextColor
            )
        }

        Text(
            text = "${currentMonth.month.getDisplayName(TextStyle.FULL, Locale.ENGLISH)} ${currentMonth.year}",
            fontFamily = LoraFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            color = HeaderTextColor,
            textAlign = TextAlign.Center
        )

        IconButton(
            onClick = onNextMonth,
            modifier = Modifier.size(32.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "Next month",
                tint = HeaderTextColor
            )
        }
    }
}

/**
 * 7-column day-of-week header row (Su, Mo, Tu, We, Th, Fr, Sa).
 */
@Composable
private fun DayOfWeekHeader() {
    val dayLabels = listOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa")
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        dayLabels.forEach { label ->
            Text(
                text = label,
                fontFamily = LoraFontFamily,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp, // ~0.85em relative to 14sp base
                color = DayOfWeekColor,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

/**
 * Day grid (6 rows × 7 columns) with day cells.
 */
@Composable
private fun DayGrid(
    currentMonth: YearMonth,
    selectedDate: LocalDate?,
    today: LocalDate,
    onDaySelected: (LocalDate) -> Unit
) {
    val daysInGrid = remember(currentMonth) { buildDayGrid(currentMonth) }

    Column {
        for (week in 0 until 6) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                for (dayOfWeek in 0 until 7) {
                    val index = week * 7 + dayOfWeek
                    val date = daysInGrid[index]
                    val isCurrentMonth = date.month == currentMonth.month
                    val isSelected = date == selectedDate
                    val isToday = date == today

                    DayCell(
                        date = date,
                        isCurrentMonth = isCurrentMonth,
                        isSelected = isSelected,
                        isToday = isToday,
                        onDaySelected = onDaySelected
                    )
                }
            }
        }
    }
}

/**
 * Individual day cell with selection and today indicators.
 */
@Composable
private fun DayCell(
    date: LocalDate,
    isCurrentMonth: Boolean,
    isSelected: Boolean,
    isToday: Boolean,
    onDaySelected: (LocalDate) -> Unit
) {
    val backgroundColor = when {
        isSelected -> SelectedDayBg
        else -> Color.Transparent
    }

    val textColor = when {
        isSelected -> SelectedDayText
        !isCurrentMonth -> OtherMonthColor.copy(alpha = OtherMonthAlpha)
        else -> DayTextColor
    }

    val shape = CircleShape

    Box(
        modifier = Modifier
            .size(width = 36.dp, height = DAY_CELL_HEIGHT)
            .then(
                if (isToday && !isSelected) {
                    Modifier.border(1.dp, TodayBorderColor, shape)
                } else {
                    Modifier
                }
            )
            .clip(shape)
            .background(backgroundColor, shape)
            .clickable { onDaySelected(date) },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = date.dayOfMonth.toString(),
            fontFamily = LoraFontFamily,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
            fontSize = 14.sp,
            color = textColor,
            textAlign = TextAlign.Center
        )
    }
}

// ─── Date format helpers ─────────────────────────────────────────────────────

private val MONTH_ABBREVS = listOf(
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
)

/**
 * Format a LocalDate to "YYYY-Mon-DD" format (e.g., "2026-May-18").
 * Matches Flatpickr's Y-M-d format.
 */
fun formatYMDDate(date: LocalDate): String {
    val year = date.year
    val month = MONTH_ABBREVS[date.monthValue - 1]
    val day = String.format("%02d", date.dayOfMonth)
    return "$year-$month-$day"
}

/**
 * Parse a "YYYY-Mon-DD" format date string (e.g., "2026-May-18") to LocalDate.
 * Returns null if parsing fails.
 */
fun parseYMDDate(dateStr: String?): LocalDate? {
    if (dateStr.isNullOrBlank()) return null
    return try {
        val parts = dateStr.split("-")
        if (parts.size != 3) return null
        val year = parts[0].toInt()
        val monthIndex = MONTH_ABBREVS.indexOfFirst { it.equals(parts[1], ignoreCase = true) }
        if (monthIndex == -1) return null
        val day = parts[2].toInt()
        LocalDate.of(year, monthIndex + 1, day)
    } catch (e: Exception) {
        null
    }
}

/**
 * Build the 6×7 grid of dates for a given month.
 * Starts on Sunday, includes days from previous/next months to fill the grid.
 */
private fun buildDayGrid(yearMonth: YearMonth): List<LocalDate> {
    val firstOfMonth = yearMonth.atDay(1)
    // Find the Sunday on or before the first of the month
    val dayOfWeekValue = firstOfMonth.dayOfWeek.value % 7 // Sunday=0, Monday=1, ..., Saturday=6
    val startDate = firstOfMonth.minusDays(dayOfWeekValue.toLong())

    return (0 until 42).map { startDate.plusDays(it.toLong()) }
}
