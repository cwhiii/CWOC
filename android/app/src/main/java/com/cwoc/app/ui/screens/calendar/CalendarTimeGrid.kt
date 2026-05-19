package com.cwoc.app.ui.screens.calendar

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.theme.BirthdayChipShape
import com.cwoc.app.ui.theme.PointInTimeShape
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt
import kotlinx.coroutines.delay

// ─── Data classes ────────────────────────────────────────────────────────────────

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
    val position: Int,
    val localMaxOverlap: Int
)

// ─── DayTimeGrid ─────────────────────────────────────────────────────────────────

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
    currentUsername: String? = null,
    onEventTap: (ChitEntity) -> Unit = {},
    onEventLongPress: (ChitEntity) -> Unit = {},
    onEventDragEnd: (String, String?, String?, String?, String?) -> Unit = { _, _, _, _, _ -> },
    onEmptySlotTap: (LocalDateTime) -> Unit = {},
    modifier: Modifier = Modifier
) {
    var zoomScale by remember { mutableFloatStateOf(1f) }
    val effectiveHourHeight = hourHeight * zoomScale
    val scrollState = rememberScrollState()
    val totalMinutes = (hourEnd - hourStart) * 60
    val totalHeight = effectiveHourHeight * (hourEnd - hourStart)
    val hourLabelWidth = 52.dp
    val gridLineColor = MaterialTheme.colorScheme.outlineVariant
    val currentTimeColor = Color(0xFF4A2C2A)
    val isToday = date == LocalDate.now()

    // Live current time
    var currentTime by remember { mutableStateOf(LocalTime.now()) }
    LaunchedEffect(Unit) {
        while (true) {
            currentTime = LocalTime.now()
            delay((60 - currentTime.second) * 1000L)
        }
    }

    // Auto-scroll
    val density = LocalDensity.current
    LaunchedEffect(scrollToHour, zoomScale) {
        val targetMin = (scrollToHour - hourStart).coerceAtLeast(0) * 60
        val px = with(density) { (targetMin.toFloat() / 60f) * effectiveHourHeight.toPx() }
        scrollState.scrollTo(px.toInt())
    }

    // Separate all-day vs timed
    val (allDayEvents, timedEvents) = remember(events, date) {
        val allDay = mutableListOf<Pair<ChitEntity, CalendarDateInfo>>()
        val timed = mutableListOf<Pair<ChitEntity, CalendarDateInfo>>()
        events.forEach { event ->
            val info = getCalendarDateInfoForEvent(event)
            if (!info.hasDate) return@forEach
            if (!eventMatchesDay(info, date)) return@forEach
            if (info.isAllDay) allDay.add(event to info)
            else timed.add(event to info)
        }
        allDay to timed
    }

    val layoutEvents = remember(timedEvents, hourStart, hourEnd) {
        calculateOverlapLayout(timedEvents, hourStart, hourEnd)
    }

    // Track whether any event is currently being dragged (for snap grid overlay)
    var isAnyEventDragging by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTransformGestures { _, _, zoom, _ ->
                    zoomScale = (zoomScale * zoom).coerceIn(0.5f, 4f)
                }
            }
    ) {
        // All-day section
        if (allDayEvents.isNotEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFE8DCC8))
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                allDayEvents.forEach { (event, info) ->
                    AllDayEventChip(event, info, onEventTap, onEventLongPress)
                }
            }
        }

        // Time grid
        Row(modifier = Modifier.weight(1f).fillMaxWidth()) {
            // Hour labels
            Column(
                modifier = Modifier.width(hourLabelWidth).verticalScroll(scrollState)
            ) {
                for (hour in hourStart until hourEnd) {
                    Box(
                        modifier = Modifier.height(effectiveHourHeight).fillMaxWidth(),
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

            // Events grid area
            BoxWithConstraints(
                modifier = Modifier.weight(1f).verticalScroll(scrollState)
            ) {
                val containerWidthPx = with(density) { maxWidth.toPx() }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(totalHeight)
                        .pointerInput(date, snapMinutes, hourStart) {
                            detectTapGestures { offset ->
                                val minInGrid = (offset.y / effectiveHourHeight.toPx() * 60).toInt()
                                val snapped = snapToGrid(minInGrid, snapMinutes)
                                val absMin = snapped + hourStart * 60
                                val h = (absMin / 60).coerceIn(0, 23)
                                val m = (absMin % 60).coerceIn(0, 59)
                                onEmptySlotTap(LocalDateTime.of(date, LocalTime.of(h, m)))
                            }
                        }
                ) {
                    // Grid lines
                    Canvas(modifier = Modifier.fillMaxWidth().height(totalHeight)) {
                        val hPx = effectiveHourHeight.toPx()
                        for (i in 0..(hourEnd - hourStart)) {
                            drawLine(gridLineColor, Offset(0f, i * hPx), Offset(size.width, i * hPx), 1f)
                        }

                        // Snap grid overlay when dragging
                        if (isAnyEventDragging) {
                            val snapPx = (snapMinutes.toFloat() / 60f) * hPx
                            val snapColor = Color(0x336B4E31)
                            val dashEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 4f))
                            var y = 0f
                            while (y <= size.height) {
                                drawLine(snapColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f, pathEffect = dashEffect)
                                y += snapPx
                            }
                        }
                    }

                    // Current time bar
                    if (isToday) {
                        val gridMin = currentTime.hour * 60 + currentTime.minute - hourStart * 60
                        if (gridMin in 0..totalMinutes) {
                            val y = with(density) { (gridMin.toFloat() / 60f) * effectiveHourHeight.toPx() }
                            Canvas(modifier = Modifier.fillMaxWidth().height(totalHeight)) {
                                drawLine(currentTimeColor, Offset(0f, y), Offset(size.width, y), 2f)
                                drawCircle(currentTimeColor, 4f, Offset(4f, y))
                            }
                        }
                    }

                    // Events
                    layoutEvents.forEach { le ->
                        val wFrac = 0.95f / le.localMaxOverlap
                        val xPx = le.position * wFrac * containerWidthPx
                        val wPx = wFrac * containerWidthPx
                        val hPx = with(density) { effectiveHourHeight.toPx() }
                        val yPx = (le.startMinute.toFloat() / 60f) * hPx
                        val evHPx = ((le.endMinute - le.startMinute).coerceAtLeast(15).toFloat() / 60f) * hPx

                        DayEventCard(
                            event = le.event,
                            info = le.info,
                            xPx = xPx,
                            yPx = yPx,
                            widthPx = wPx,
                            heightPx = evHPx,
                            hourHeightPx = hPx,
                            timeFormat = timeFormat,
                            snapMinutes = snapMinutes,
                            hourStart = hourStart,
                            date = date,
                            onTap = { onEventTap(le.event) },
                            onLongPress = { onEventLongPress(le.event) },
                            onDragEnd = onEventDragEnd,
                            onDragStateChange = { dragging -> isAnyEventDragging = dragging }
                        )
                    }
                }
            }
        }
    }
}

// ─── DayEventCard ────────────────────────────────────────────────────────────────

@Composable
private fun DayEventCard(
    event: ChitEntity,
    info: CalendarDateInfo,
    xPx: Float,
    yPx: Float,
    widthPx: Float,
    heightPx: Float,
    hourHeightPx: Float,
    timeFormat: String,
    snapMinutes: Int,
    hourStart: Int,
    date: LocalDate,
    onTap: () -> Unit,
    onLongPress: () -> Unit,
    onDragEnd: (String, String?, String?, String?, String?) -> Unit,
    onDragStateChange: (Boolean) -> Unit = {}
) {
    val eventColor = CwocChitCardStyle.resolveChitBgColor(event.color)
    val textColor = CwocChitCardStyle.contrastTextColor(eventColor)
    val isCompleted = event.status == "Complete"
    val isDeclined = !event.shares.isNullOrBlank() && event.shares.contains("\"rsvp_status\":\"declined\"")
    // Viewer-role check: if shares contains viewer role for any user, disable drag
    // (simplified — full check would need current user ID)
    val isViewerRole = !event.shares.isNullOrBlank() && event.shares.contains("\"role\":\"viewer\"") && event.ownerId != null
    val density = LocalDensity.current

    var dragOffsetY by remember { mutableFloatStateOf(0f) }
    var isDragging by remember { mutableStateOf(false) }

    val startMinute = info.start?.let { it.hour * 60 + it.minute - hourStart * 60 } ?: 0
    val endMinute = info.end?.let { it.hour * 60 + it.minute - hourStart * 60 } ?: (startMinute + 30)

    val clipShape = if (info.isPointInTime) PointInTimeShape else RoundedCornerShape(4.dp)
    val contentPadding = if (info.isPointInTime) {
        Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
    } else {
        Modifier.padding(4.dp)
    }

    Box(
        modifier = Modifier
            .offset { androidx.compose.ui.unit.IntOffset(xPx.toInt(), (yPx + dragOffsetY).toInt()) }
            .width(with(density) { widthPx.toDp() })
            .height(with(density) { heightPx.toDp() })
            .padding(1.dp)
            .clip(clipShape)
            .background(if (isDragging) eventColor.copy(alpha = 0.6f) else eventColor)
            .alpha(if (isCompleted || isDeclined) 0.5f else 1f)
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { onTap() },
                    onLongPress = { onLongPress() }
                )
            }
            .pointerInput(event.id, snapMinutes, hourStart, date) {
                if (!isViewerRole) {
                    detectDragGestures(
                        onDragStart = {
                            isDragging = true
                            onDragStateChange(true)
                        },
                        onDrag = { change, amount ->
                            change.consume()
                            dragOffsetY += amount.y
                        },
                        onDragEnd = {
                            isDragging = false
                            onDragStateChange(false)
                            val deltaMins = (dragOffsetY / hourHeightPx * 60).toInt()
                            val snapped = snapToGrid(deltaMins, snapMinutes)
                            dragOffsetY = 0f
                            if (snapped != 0) {
                                persistDragMove(event, info, snapped, hourStart, date, onDragEnd)
                            }
                        },
                        onDragCancel = {
                            isDragging = false
                            onDragStateChange(false)
                            dragOffsetY = 0f
                        }
                    )
                }
            }
            .then(contentPadding)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            val prefix = when {
                info.isDueOnly -> "⌚ "
                info.isPointInTime -> "📌 "
                event.pinned == true -> "📌 "
                else -> ""
            }
            Text(
                text = "$prefix${event.title ?: "(Untitled)"}",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = textColor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textDecoration = if (isCompleted || isDeclined) TextDecoration.LineThrough else null
            )
            val timeLabel = buildEventTimeLabel(info, timeFormat)
            if (timeLabel.isNotBlank()) {
                Text(
                    text = timeLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = textColor.copy(alpha = 0.7f),
                    fontSize = 9.sp,
                    maxLines = 1
                )
            }
            Spacer(modifier = Modifier.weight(1f))
            if (!info.isDueOnly && !info.isPointInTime) {
                // Resize handle — drag to change end time only
                var resizeDragY by remember { mutableFloatStateOf(0f) }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(10.dp)
                        .background(textColor.copy(alpha = 0.2f), RoundedCornerShape(2.dp))
                        .pointerInput(event.id, snapMinutes, hourStart, date) {
                            detectDragGestures(
                                onDrag = { change, amount ->
                                    change.consume()
                                    resizeDragY += amount.y
                                },
                                onDragEnd = {
                                    val deltaMins = (resizeDragY / hourHeightPx * 60).toInt()
                                    val snapped = snapToGrid(deltaMins, snapMinutes)
                                    resizeDragY = 0f
                                    if (snapped != 0) {
                                        // Resize: only change end time
                                        val currentEndMin = (info.end?.let { it.hour * 60 + it.minute } ?: (startMinute + hourStart * 60 + 30))
                                        val newEndMin = (currentEndMin + snapped).coerceIn(startMinute + hourStart * 60 + 15, 1440)
                                        val newEndTime = java.time.LocalTime.of(newEndMin / 60, newEndMin % 60)
                                        val newEnd = LocalDateTime.of(date, newEndTime)
                                        onDragEnd(event.id, null, newEnd.format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME), null, null)
                                    }
                                },
                                onDragCancel = { resizeDragY = 0f }
                            )
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text("⋯", fontSize = 8.sp, color = textColor.copy(alpha = 0.5f))
                }
            }
        }
    }
}

// ─── AllDayEventChip ─────────────────────────────────────────────────────────────

@Composable
private fun AllDayEventChip(
    event: ChitEntity,
    info: CalendarDateInfo,
    onTap: (ChitEntity) -> Unit,
    onLongPress: (ChitEntity) -> Unit
) {
    val bgColor = CwocChitCardStyle.resolveChitBgColor(event.color)
    val textColor = CwocChitCardStyle.contrastTextColor(bgColor)
    val isCompleted = event.status == "Complete"
    val isDeclined = !event.shares.isNullOrBlank() && event.shares.contains("\"rsvp_status\":\"declined\"")
    val isBirthday = event.tags?.contains("Birthday") == true

    val chipShape = if (isBirthday) BirthdayChipShape else RoundedCornerShape(3.dp)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 1.dp)
            .clip(chipShape)
            .background(bgColor)
            .alpha(if (isCompleted || isDeclined) 0.5f else 1f)
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { onTap(event) },
                    onLongPress = { onLongPress(event) }
                )
            }
            .padding(horizontal = 4.dp, vertical = 2.dp)
    ) {
        val prefix = when {
            isBirthday -> "🎂 "
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
            textDecoration = if (isCompleted || isDeclined) TextDecoration.LineThrough else null
        )
    }
}

// ─── WeekTimeGrid ────────────────────────────────────────────────────────────────

@Composable
fun WeekTimeGrid(
    events: List<ChitEntity>,
    weekStartDate: LocalDate,
    hourHeight: Dp = 48.dp,
    timeFormat: String = "12hour",
    scrollToHour: Int = 6,
    snapMinutes: Int = 15,
    hourStart: Int = 0,
    hourEnd: Int = 24,
    dayCount: Int = 7,
    onEventTap: (ChitEntity) -> Unit = {},
    onEmptySlotTap: (LocalDateTime) -> Unit = {},
    onEventDragEnd: (String, String?, String?, String?, String?) -> Unit = { _, _, _, _, _ -> },
    modifier: Modifier = Modifier
) {
    var zoomScale by remember { mutableFloatStateOf(1f) }
    val effectiveHourHeight = hourHeight * zoomScale
    val scrollState = rememberScrollState()
    val totalHeight = effectiveHourHeight * (hourEnd - hourStart)
    val hourLabelWidth = 36.dp
    val gridLineColor = MaterialTheme.colorScheme.outlineVariant
    val currentTimeColor = Color(0xFF4A2C2A)
    val today = LocalDate.now()
    val days = (0 until dayCount).map { weekStartDate.plusDays(it.toLong()) }
    val density = LocalDensity.current

    var currentTime by remember { mutableStateOf(LocalTime.now()) }
    LaunchedEffect(Unit) {
        while (true) {
            currentTime = LocalTime.now()
            delay((60 - currentTime.second) * 1000L)
        }
    }

    LaunchedEffect(scrollToHour, zoomScale) {
        val px = with(density) { scrollToHour.toFloat() * effectiveHourHeight.toPx() }
        scrollState.scrollTo(px.toInt())
    }

    // Track whether any event is currently being dragged (for snap grid overlay)
    var isAnyEventDragging by remember { mutableStateOf(false) }
    // Track which column is highlighted during cross-day drag
    var highlightedColumn: Int? by remember { mutableStateOf(null) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTransformGestures { _, _, zoom, _ ->
                    zoomScale = (zoomScale * zoom).coerceIn(0.5f, 4f)
                }
            }
    ) {
        // Day headers (today highlighted with reversed colors)
        Row(modifier = Modifier.fillMaxWidth()) {
            Box(modifier = Modifier.width(hourLabelWidth), contentAlignment = Alignment.Center) {
                val wn = weekStartDate.get(java.time.temporal.WeekFields.ISO.weekOfWeekBasedYear())
                Text("W$wn", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 8.sp)
            }
            days.forEach { day ->
                val isTodayCol = day == today
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .background(if (isTodayCol) Color(0xFF4A2C2A) else Color.Transparent)
                        .padding(2.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            day.dayOfWeek.name.take(3),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isTodayCol) Color(0xFFFDF5E6) else MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 9.sp
                        )
                        Text(
                            day.dayOfMonth.toString(),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = if (isTodayCol) FontWeight.Bold else FontWeight.Normal,
                            color = if (isTodayCol) Color(0xFFFDF5E6) else MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        }

        // All-day events row (above the time grid)
        val allDayByDay = remember(events, days) {
            days.map { day ->
                events.mapNotNull { event ->
                    val info = getCalendarDateInfoForEvent(event)
                    if (!info.hasDate || !info.isAllDay) return@mapNotNull null
                    if (!eventMatchesDay(info, day)) return@mapNotNull null
                    event to info
                }
            }
        }
        val hasAnyAllDay = allDayByDay.any { it.isNotEmpty() }
        var allDayExpanded by remember { mutableStateOf(true) }
        if (hasAnyAllDay) {
            // All-day section with collapse/expand toggle (matching web's ☀ Hide / ▲ Show)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFE8DCC8))
            ) {
                // Toggle button row
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { allDayExpanded = !allDayExpanded }
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (allDayExpanded) "☀ Hide" else "▲ Show",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF4A2C2A),
                        fontWeight = FontWeight.Bold,
                        fontSize = 9.sp
                    )
                    Spacer(modifier = Modifier.weight(1f))
                    val totalAllDay = allDayByDay.sumOf { it.size }
                    Text(
                        text = "$totalAllDay all-day",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF6B4E31),
                        fontSize = 8.sp
                    )
                }
                // All-day events (collapsible)
                if (allDayExpanded) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 2.dp)
                    ) {
                        Spacer(modifier = Modifier.width(hourLabelWidth))
                        days.forEachIndexed { idx, _ ->
                            Column(
                                modifier = Modifier.weight(1f).padding(horizontal = 1.dp)
                            ) {
                                allDayByDay[idx].take(3).forEach { (event, info) ->
                                    AllDayEventChip(event, info, onEventTap, { })
                                }
                                if (allDayByDay[idx].size > 3) {
                                    Text(
                                        "+${allDayByDay[idx].size - 3} more",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color(0xFF6B4E31),
                                        fontSize = 8.sp
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Scrollable time grid
        Row(modifier = Modifier.weight(1f).verticalScroll(scrollState)) {
            // Hour labels
            Column(modifier = Modifier.width(hourLabelWidth)) {
                for (hour in hourStart until hourEnd) {
                    Box(
                        modifier = Modifier.height(effectiveHourHeight).fillMaxWidth(),
                        contentAlignment = Alignment.TopEnd
                    ) {
                        Text(
                            formatHourLabel(hour, timeFormat),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(end = 2.dp),
                            fontSize = 8.sp
                        )
                    }
                }
            }

            // Day columns
            days.forEachIndexed { dayIndex, day ->
                val isTodayCol = day == today
                BoxWithConstraints(modifier = Modifier.weight(1f).height(totalHeight)) {
                    val colWidthPx = with(density) { maxWidth.toPx() }

                    // Grid lines + border
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        val hPx = effectiveHourHeight.toPx()
                        for (i in 0..(hourEnd - hourStart)) {
                            drawLine(gridLineColor, Offset(0f, i * hPx), Offset(size.width, i * hPx), 0.5f)
                        }
                        drawLine(gridLineColor, Offset(0f, 0f), Offset(0f, size.height), 0.5f)

                        // Snap grid overlay when dragging
                        if (isAnyEventDragging) {
                            val snapPx = (snapMinutes.toFloat() / 60f) * hPx
                            val snapColor = Color(0x336B4E31)
                            val dashEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 4f))
                            var y = 0f
                            while (y <= size.height) {
                                drawLine(snapColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f, pathEffect = dashEffect)
                                y += snapPx
                            }
                        }
                    }

                    // Today background tint
                    if (isTodayCol) {
                        Box(modifier = Modifier.fillMaxSize().background(Color(0x0F4A2C2A)))
                    }

                    // Column highlight during cross-day drag
                    if (highlightedColumn == dayIndex) {
                        Box(modifier = Modifier.fillMaxSize().background(Color(0x1A6B4E31)))
                    }

                    // Current time line
                    if (isTodayCol) {
                        val mins = currentTime.hour * 60 + currentTime.minute
                        val gridMin = mins - hourStart * 60
                        if (gridMin in 0..(hourEnd - hourStart) * 60) {
                            val y = with(density) { (gridMin.toFloat() / 60f) * effectiveHourHeight.toPx() }
                            Canvas(modifier = Modifier.fillMaxSize()) {
                                drawLine(currentTimeColor, Offset(0f, y), Offset(size.width, y), 2f)
                            }
                        }
                    }

                    // Events for this day
                    val dayTimedEvents = remember(events, day) {
                        val timed = mutableListOf<Pair<ChitEntity, CalendarDateInfo>>()
                        events.forEach { event ->
                            val info = getCalendarDateInfoForEvent(event)
                            if (!info.hasDate || info.isAllDay) return@forEach
                            if (!eventMatchesDay(info, day)) return@forEach
                            timed.add(event to info)
                        }
                        timed
                    }
                    val dayLayout = remember(dayTimedEvents) {
                        calculateOverlapLayout(dayTimedEvents, hourStart, hourEnd)
                    }

                    dayLayout.forEach { le ->
                        val wFrac = 0.95f / le.localMaxOverlap
                        val xPx = le.position * wFrac * colWidthPx
                        val wPx = wFrac * colWidthPx
                        val hPx = with(density) { effectiveHourHeight.toPx() }
                        val yPx = (le.startMinute.toFloat() / 60f) * hPx
                        val evHPx = ((le.endMinute - le.startMinute).coerceAtLeast(15).toFloat() / 60f) * hPx

                        WeekEventChip(
                            event = le.event,
                            info = le.info,
                            xPx = xPx,
                            yPx = yPx,
                            widthPx = wPx,
                            heightPx = evHPx,
                            hourHeightPx = hPx,
                            columnWidthPx = colWidthPx,
                            dayIndex = dayIndex,
                            days = days,
                            snapMinutes = snapMinutes,
                            hourStart = hourStart,
                            date = day,
                            onTap = { onEventTap(le.event) },
                            onDragEnd = onEventDragEnd,
                            onDragStateChange = { dragging -> isAnyEventDragging = dragging },
                            onHighlightColumn = { col -> highlightedColumn = col }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WeekEventChip(
    event: ChitEntity,
    info: CalendarDateInfo,
    xPx: Float,
    yPx: Float,
    widthPx: Float,
    heightPx: Float,
    hourHeightPx: Float,
    columnWidthPx: Float,
    dayIndex: Int,
    days: List<LocalDate>,
    snapMinutes: Int,
    hourStart: Int,
    date: LocalDate,
    onTap: () -> Unit,
    onDragEnd: (String, String?, String?, String?, String?) -> Unit = { _, _, _, _, _ -> },
    onDragStateChange: (Boolean) -> Unit = {},
    onHighlightColumn: (Int?) -> Unit = {}
) {
    val bg = CwocChitCardStyle.resolveChitBgColor(event.color)
    val fg = CwocChitCardStyle.contrastTextColor(bg)
    val isCompleted = event.status == "Complete"
    val density = LocalDensity.current

    var dragOffsetX by remember { mutableFloatStateOf(0f) }
    var dragOffsetY by remember { mutableFloatStateOf(0f) }
    var isDragging by remember { mutableStateOf(false) }

    val clipShape = if (info.isPointInTime) PointInTimeShape else RoundedCornerShape(2.dp)
    val contentPadding = if (info.isPointInTime) {
        Modifier.padding(horizontal = 12.dp, vertical = 2.dp)
    } else {
        Modifier.padding(2.dp)
    }

    Box(
        modifier = Modifier
            .offset { androidx.compose.ui.unit.IntOffset((xPx + dragOffsetX).toInt(), (yPx + dragOffsetY).toInt()) }
            .width(with(density) { widthPx.toDp() })
            .height(with(density) { heightPx.toDp() })
            .padding(0.5.dp)
            .clip(clipShape)
            .background(if (isDragging) bg.copy(alpha = 0.6f) else bg)
            .alpha(if (isCompleted) 0.6f else 1f)
            .pointerInput(Unit) { detectTapGestures { onTap() } }
            .pointerInput(event.id, snapMinutes, hourStart, date, columnWidthPx, dayIndex, days) {
                detectDragGesturesAfterLongPress(
                    onDragStart = {
                        isDragging = true
                        onDragStateChange(true)
                        onHighlightColumn(dayIndex)
                    },
                    onDrag = { change, amount ->
                        change.consume()
                        dragOffsetX += amount.x
                        dragOffsetY += amount.y
                        // Update highlighted column during drag
                        val dayDelta = (dragOffsetX / columnWidthPx).roundToInt()
                        val targetCol = (dayIndex + dayDelta).coerceIn(0, days.size - 1)
                        onHighlightColumn(targetCol)
                    },
                    onDragEnd = {
                        isDragging = false
                        onDragStateChange(false)
                        onHighlightColumn(null)
                        // Calculate target day from horizontal offset
                        val dayDelta = (dragOffsetX / columnWidthPx).roundToInt()
                        val targetDayIndex = (dayIndex + dayDelta).coerceIn(0, days.size - 1)
                        val targetDate = days[targetDayIndex]
                        // Calculate time delta from vertical offset
                        val deltaMins = (dragOffsetY / hourHeightPx * 60).toInt()
                        val snapped = snapToGrid(deltaMins, snapMinutes)
                        dragOffsetX = 0f
                        dragOffsetY = 0f
                        // Persist if day changed or time changed
                        if (targetDayIndex != dayIndex || snapped != 0) {
                            persistDragMove(event, info, snapped, hourStart, targetDate, onDragEnd)
                        }
                    },
                    onDragCancel = {
                        isDragging = false
                        onDragStateChange(false)
                        onHighlightColumn(null)
                        dragOffsetX = 0f
                        dragOffsetY = 0f
                    }
                )
            }
            .then(contentPadding)
    ) {
        Text(
            event.title ?: "",
            style = MaterialTheme.typography.labelSmall,
            color = fg,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            fontSize = 8.sp,
            textDecoration = if (isCompleted) TextDecoration.LineThrough else null
        )
    }
}

// ─── Helper Functions ────────────────────────────────────────────────────────────

private fun formatHourLabel(hour: Int, timeFormat: String): String {
    return if (timeFormat == "24hour") {
        "${hour.toString().padStart(2, '0')}:00"
    } else {
        when {
            hour == 0 -> "12 AM"
            hour < 12 -> "$hour AM"
            hour == 12 -> "12 PM"
            else -> "${hour - 12} PM"
        }
    }
}

private fun snapToGrid(minutes: Int, snapMinutes: Int): Int {
    if (snapMinutes <= 1) return minutes
    return (kotlin.math.round(minutes.toFloat() / snapMinutes) * snapMinutes).toInt()
}

private fun getCalendarDateInfoForEvent(event: ChitEntity): CalendarDateInfo {
    val isAllDay = event.allDay

    // Priority 1: due_datetime (matches web's getCalendarDateInfo)
    if (!event.dueDatetime.isNullOrBlank()) {
        val due = parseDateTime(event.dueDatetime) ?: return CalendarDateInfo(null, null, false, false, false, false)
        return if (isAllDay) CalendarDateInfo(due, due, true, true, false, true)
        else CalendarDateInfo(due, due.plusMinutes(30), false, true, false, true)
    }

    // Priority 2: start_datetime
    if (!event.startDatetime.isNullOrBlank()) {
        val start = parseDateTime(event.startDatetime) ?: return CalendarDateInfo(null, null, false, false, false, false)
        return if (isAllDay) {
            val end = event.endDatetime?.let { parseDateTime(it) } ?: start
            CalendarDateInfo(start, end, true, false, false, true)
        } else {
            val end = event.endDatetime?.let { parseDateTime(it) } ?: start.plusHours(1)
            CalendarDateInfo(start, end, false, false, false, true)
        }
    }

    // Priority 3: point_in_time
    if (!event.pointInTime.isNullOrBlank()) {
        val pit = parseDateTime(event.pointInTime) ?: return CalendarDateInfo(null, null, false, false, false, false)
        return if (isAllDay) CalendarDateInfo(pit, pit, true, false, true, true)
        else CalendarDateInfo(pit, pit.plusMinutes(30), false, false, true, true)
    }

    return CalendarDateInfo(null, null, false, false, false, false)
}

private fun eventMatchesDay(info: CalendarDateInfo, day: LocalDate): Boolean {
    if (!info.hasDate || info.start == null || info.end == null) return false
    val dayStart = day.atStartOfDay()
    val dayEnd = day.plusDays(1).atStartOfDay().minusNanos(1)
    return !info.start.isAfter(dayEnd) && !info.end.isBefore(dayStart)
}

/**
 * Check if the current user has declined this chit (RSVP status = "declined").
 * Parses the shares JSON to find the current user's entry.
 */
private fun isDeclinedByUser(event: ChitEntity, currentUsername: String?): Boolean {
    if (currentUsername.isNullOrBlank() || event.shares.isNullOrBlank()) return false
    return try {
        val regex = Regex(""""user_id"\s*:\s*"${Regex.escape(currentUsername)}"[^}]*"rsvp_status"\s*:\s*"declined"""")
        regex.containsMatchIn(event.shares)
    } catch (_: Exception) { false }
}

private fun parseDateTime(dateStr: String?): LocalDateTime? {
    if (dateStr.isNullOrBlank()) return null
    return try {
        val cleaned = dateStr.replace("Z", "")
        if (cleaned.contains("T")) LocalDateTime.parse(cleaned, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        else LocalDate.parse(cleaned, DateTimeFormatter.ISO_LOCAL_DATE).atStartOfDay()
    } catch (_: Exception) { null }
}

private fun calculateOverlapLayout(
    timedEvents: List<Pair<ChitEntity, CalendarDateInfo>>,
    hourStart: Int,
    hourEnd: Int
): List<LayoutEvent> {
    val rangeStartMin = hourStart * 60
    val rangeEndMin = hourEnd * 60
    val timeSlots = mutableMapOf<Int, MutableList<Int>>()

    data class Slot(val event: ChitEntity, val info: CalendarDateInfo, val s: Int, val e: Int, var pos: Int = 0)

    val slots = mutableListOf<Slot>()

    timedEvents.forEach { (event, info) ->
        if (info.start == null || info.end == null) return@forEach
        var absStart = info.start.hour * 60 + info.start.minute
        var absEnd = info.end.hour * 60 + info.end.minute
        if (absEnd <= absStart) absEnd = absStart + 30
        if (absEnd <= rangeStartMin || absStart >= rangeEndMin) return@forEach
        absStart = absStart.coerceAtLeast(rangeStartMin)
        absEnd = absEnd.coerceAtMost(rangeEndMin)
        val s = absStart - rangeStartMin
        val e = absEnd - rangeStartMin

        for (t in s until e) { timeSlots.getOrPut(t) { mutableListOf() } }

        var pos = 0
        while (true) {
            var collision = false
            for (t in s until e) { if (timeSlots[t]?.contains(pos) == true) { collision = true; break } }
            if (!collision) break
            pos++
        }
        for (t in s until e) { timeSlots[t]?.add(pos) }
        slots.add(Slot(event, info, s, e, pos))
    }

    return slots.map { slot ->
        var localMax = 1
        for (t in slot.s until slot.e) {
            val c = timeSlots[t]?.size ?: 0
            if (c > localMax) localMax = c
        }
        LayoutEvent(slot.event, slot.info, slot.s, slot.e, slot.pos, localMax)
    }
}

private fun buildEventTimeLabel(info: CalendarDateInfo, timeFormat: String): String {
    if (info.start == null) return ""
    return when {
        info.isPointInTime -> "📌 ${fmtTime(info.start, timeFormat)}"
        info.isDueOnly -> "Due: ${fmtTime(info.start, timeFormat)}"
        info.end != null -> "${fmtTime(info.start, timeFormat)} - ${fmtTime(info.end, timeFormat)}"
        else -> fmtTime(info.start, timeFormat)
    }
}

private fun fmtTime(dt: LocalDateTime, timeFormat: String): String {
    val h = dt.hour; val m = dt.minute
    return if (timeFormat == "24hour") {
        "${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}"
    } else {
        val amPm = if (h < 12) "AM" else "PM"
        val dh = when { h == 0 -> 12; h > 12 -> h - 12; else -> h }
        if (m == 0) "$dh $amPm" else "$dh:${m.toString().padStart(2, '0')} $amPm"
    }
}

private fun persistDragMove(
    event: ChitEntity,
    info: CalendarDateInfo,
    snappedDeltaMinutes: Int,
    hourStart: Int,
    date: LocalDate,
    onDragEnd: (String, String?, String?, String?, String?) -> Unit
) {
    val startMin = (info.start?.let { it.hour * 60 + it.minute } ?: 0)
    val newStartMin = (startMin + snappedDeltaMinutes).coerceIn(0, 1439)
    val duration = if (info.end != null && info.start != null) {
        java.time.Duration.between(info.start, info.end).toMinutes().toInt()
    } else 30
    val newEndMin = (newStartMin + duration).coerceAtMost(1440)

    val newStart = LocalDateTime.of(date, LocalTime.of(newStartMin / 60, newStartMin % 60))
    val newEnd = LocalDateTime.of(date, LocalTime.of(
        (newEndMin / 60).coerceAtMost(23), newEndMin % 60
    ))
    val fmt = DateTimeFormatter.ISO_LOCAL_DATE_TIME

    when {
        info.isDueOnly -> onDragEnd(event.id, null, null, newStart.format(fmt), null)
        info.isPointInTime -> onDragEnd(event.id, null, null, null, newStart.format(fmt))
        else -> onDragEnd(event.id, newStart.format(fmt), newEnd.format(fmt), null, null)
    }
}
