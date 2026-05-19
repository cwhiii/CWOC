package com.cwoc.app.ui.screens.calendar

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.components.CwocChitCardStyle
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.delay

// ─── Data classes for event layout ──────────────────────────────────────────────

private data class CalendarDateInfo(
    val start: LocalDateTime?,
    val end: LocalDateTime?,
    val isAllDay: Boolean,
    val isDueOnly: Boolean,
    val isPointInTime: Boolean,
    val hasDate: Boolean
)

private data class LayoutEvent(
    val event: ChitEntity,
    val info: CalendarDateInfo,
    val startMinute: Int,
    val endMinute: Int,
    val position: Int, // horizontal position for overlap
    val localMaxOverlap: Int // max concurrent events in this event's time range
)

// ─── DayTimeGrid — Main Day View Composable ─────────────────────────────────────

/**
 * A vertical time grid for Day view matching the web's displayDayView function.
 *
 * Features matching web parity:
 * - All-day events section above the time grid
 * - Hour labels along the left edge (respects 12h/24h setting)
 * - Horizontal grid lines at each hour
 * - Events positioned vertically by start time, sized by duration
 * - Overlapping events shown side-by-side with proportional widths
 * - Current time indicator (red line + dot) that updates live
 * - Pinch-to-zoom (vertical axis)
 * - Tap empty slot to create event
 * - Long-press event for quick-edit
 * - Drag-to-move events (persists new time)
 * - Drag-to-resize events (persists new end time)
 * - Auto-scroll to configured hour on load
 * - Due-only events shown with ⌚ prefix
 * - Point-in-time events shown with 📌 prefix
 * - Completed tasks shown with strikethrough + reduced opacity
 */
@Composable
fun DayTimeGrid(
    events: List<ChitEntity>,
    date: LocalDate,
    hourHeight: Dp = 60.dp,
    timeFormat: String = "12hour",
    scrollToHour: Int = 6,
    snapMinutes: Int = 15,
    hourStart: Int = 0,
    hourEnd: Int = 24,
    onEventTap: (ChitEntity) -> Unit = {},
    onEventLongPress: (ChitEntity) -> Unit = {},
    onEventDragEnd: (chitId: String, startDatetime: String?, endDatetime: String?, dueDatetime: String?, pointInTime: String?) -> Unit = { _, _, _, _, _ -> },
    onEmptySlotTap: (LocalDateTime) -> Unit = {},
    modifier: Modifier = Modifier
) {
    // Pinch-to-zoom state
    var zoomScale by remember { mutableFloatStateOf(1f) }
    val effectiveHourHeight = hourHeight * zoomScale
    val scrollState = rememberScrollState()
    val totalMinutes = (hourEnd - hourStart) * 60
    val totalHeight = effectiveHourHeight * (hourEnd - hourStart)
    val hourLabelWidth = 52.dp
    val gridLineColor = MaterialTheme.colorScheme.outlineVariant
    val currentTimeColor = Color(0xFF4A2C2A) // matches web's #4a2c2a
    val isToday = date == LocalDate.now()

    // Live-updating current time (updates every minute)
    var currentTime by remember { mutableStateOf(LocalTime.now()) }
    LaunchedEffect(Unit) {
        while (true) {
            currentTime = LocalTime.now()
            val secondsUntilNextMinute = 60 - currentTime.second
            delay(secondsUntilNextMinute * 1000L)
        }
    }

    // Auto-scroll to configured hour on first load
    val density = LocalDensity.current
    LaunchedEffect(scrollToHour, zoomScale) {
        val targetMinute = (scrollToHour - hourStart).coerceAtLeast(0) * 60
        val scrollPx = with(density) { (targetMinute.toFloat() / 60f) * effectiveHourHeight.toPx() }
        scrollState.scrollTo(scrollPx.toInt())
    }

    // Separate events into all-day and timed
    val (allDayEvents, timedEvents) = remember(events, date) {
        val allDay = mutableListOf<Pair<ChitEntity, CalendarDateInfo>>()
        val timed = mutableListOf<Pair<ChitEntity, CalendarDateInfo>>()
        events.forEach { event ->
            val info = getCalendarDateInfoForEvent(event)
            if (!info.hasDate) return@forEach
            // Check if event matches this day
            if (!eventMatchesDay(event, info, date)) return@forEach
            if (info.isAllDay) allDay.add(event to info)
            else timed.add(event to info)
        }
        allDay to timed
    }

    // Calculate overlap layout for timed events (matching web's timeSlots algorithm)
    val layoutEvents = remember(timedEvents, hourStart, hourEnd) {
        calculateOverlapLayout(timedEvents, hourStart, hourEnd)
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTransformGestures { _, _, zoom, _ ->
                    zoomScale = (zoomScale * zoom).coerceIn(0.5f, 4f)
                }
            }
    ) {
        // All-day events section (matching web's allday-events-area)
        if (allDayEvents.isNotEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFE8DCC8)) // web's #e8dcc8
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                allDayEvents.forEach { (event, info) ->
                    AllDayEventChip(
                        event = event,
                        info = info,
                        timeFormat = timeFormat,
                        onTap = { onEventTap(event) },
                        onLongPress = { onEventLongPress(event) }
                    )
                }
            }
        }

        // Scrollable time grid
        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            // Hour labels column
            Column(
                modifier = Modifier
                    .width(hourLabelWidth)
                    .verticalScroll(scrollState)
            ) {
                for (hour in hourStart until hourEnd) {
                    Box(
                        modifier = Modifier
                            .height(effectiveHourHeight)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.TopEnd
                    ) {
                        Text(
                            text = formatHourLabel(hour, timeFormat),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(end = 4.dp),
                            fontSize = 10.sp
                        )
                    }
                }
            }

            // Time grid + events
            Box(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(scrollState)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(totalHeight)
                        .pointerInput(date, snapMinutes, hourStart) {
                            detectTapGestures { offset ->
                                val minuteInGrid = (offset.y / effectiveHourHeight.toPx() * 60).toInt()
                                val snapped = snapToGrid(minuteInGrid, snapMinutes)
                                val absMinute = snapped + hourStart * 60
                                val hour = (absMinute / 60).coerceIn(0, 23)
                                val minute = (absMinute % 60).coerceIn(0, 59)
                                val tappedTime = LocalDateTime.of(date, LocalTime.of(hour, minute))
                                onEmptySlotTap(tappedTime)
                            }
                        }
                ) {
                    // Grid lines
                    Canvas(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(totalHeight)
                    ) {
                        val hourHeightPx = effectiveHourHeight.toPx()
                        for (hour in 0..(hourEnd - hourStart)) {
                            val y = hour * hourHeightPx
                            drawLine(
                                color = gridLineColor,
                                start = Offset(0f, y),
                                end = Offset(size.width, y),
                                strokeWidth = 1f
                            )
                        }
                    }

                    // Current time indicator (matching web's .time-now-bar)
                    if (isToday) {
                        val currentMinutes = currentTime.hour * 60 + currentTime.minute
                        val gridMinute = currentMinutes - hourStart * 60
                        if (gridMinute in 0..totalMinutes) {
                            val currentY = with(LocalDensity.current) {
                                (gridMinute.toFloat() / 60f) * effectiveHourHeight.toPx()
                            }
                            Canvas(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(totalHeight)
                            ) {
                                drawLine(
                                    color = currentTimeColor,
                                    start = Offset(0f, currentY),
                                    end = Offset(size.width, currentY),
                                    strokeWidth = 2f
                                )
                                // Red dot at left edge (matching web's ::before pseudo-element)
                                drawCircle(
                                    color = currentTimeColor,
                                    radius = 4f,
                                    center = Offset(4f, currentY)
                                )
                            }
                        }
                    }

                    // Timed events with overlap layout
                    layoutEvents.forEach { layoutEvent ->
                        val widthFraction = 0.95f / layoutEvent.localMaxOverlap
                        val leftFraction = layoutEvent.position * widthFraction

                        TimeGridEventCard(
                            event = layoutEvent.event,
                            info = layoutEvent.info,
                            startMinute = layoutEvent.startMinute,
                            endMinute = layoutEvent.endMinute,
                            widthFraction = widthFraction,
                            leftFraction = leftFraction,
                            effectiveHourHeight = effectiveHourHeight,
                            timeFormat = timeFormat,
                            snapMinutes = snapMinutes,
                            hourStart = hourStart,
                            date = date,
                            onTap = { onEventTap(layoutEvent.event) },
                            onLongPress = { onEventLongPress(layoutEvent.event) },
                            onDragEnd = onEventDragEnd
                        )
                    }
                }
            }
        }
    }
}

// ─── All-Day Event Chip ─────────────────────────────────────────────────────────

@Composable
private fun AllDayEventChip(
    event: ChitEntity,
    info: CalendarDateInfo,
    timeFormat: String,
    onTap: () -> Unit,
    onLongPress: () -> Unit
) {
    val bgColor = CwocChitCardStyle.resolveChitBgColor(event.color)
    val textColor = CwocChitCardStyle.contrastTextColor(bgColor)
    val isCompleted = event.status == "Complete"

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 1.dp)
            .clip(RoundedCornerShape(3.dp))
            .background(bgColor)
            .alpha(if (isCompleted) 0.6f else 1f)
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { onTap() },
                    onLongPress = { onLongPress() }
                )
            }
            .padding(horizontal = 4.dp, vertical = 2.dp)
    ) {
        val prefix = when {
            info.isDueOnly -> "⌚ "
            info.isPointInTime -> "📌 "
            event.pinned == true -> "📌 "
            else -> ""
        }
        Text(
            text = "$prefix${event.title ?: "(Untitled)"}",
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textDecoration = if (isCompleted) TextDecoration.LineThrough else TextDecoration.None
        )
    }
}
