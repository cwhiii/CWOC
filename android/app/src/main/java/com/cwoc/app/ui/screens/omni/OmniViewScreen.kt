package com.cwoc.app.ui.screens.omni

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.util.DateUtils
import kotlinx.coroutines.delay
import java.time.LocalDateTime

// ─── Parchment Color Constants ──────────────────────────────────────────────────

private object OmniColors {
    val SaddleBrown = Color(0xFF8B4513)
    val NearBlack = Color(0xFF1A1208)
    val MediumBrown = Color(0xFF6B4E31)
    val Parchment = Color(0xFFF5E6CC)
    val LightCream = Color(0xFFFFF8E1)
    val DarkBrown = Color(0xFF4A2C2A)
    val HeaderBg = Color(0x805A3618) // 50% alpha brown
    val EmptyText = Color(0xFF8B5A2B)
    val BadgeBg = Color(0xFFF5E6CC)
    val BadgeBorder = Color(0xFFC4A97D)
    val DueBadgeText = Color(0xFF2E5A3A)
    val DueBadgeBorderColor = Color(0xFF81C784)
    val StreakBadgeBorder = Color(0xFFD4A574)
    val StreakBadgeText = Color(0xFF8B4513)
    val PastBadgeBorder = Color(0xFFB22222)
    val HstFillStart = Color(0xFFD4AF37)
    val HstFillMid = Color(0xFFC8965A)
    val HstFillEnd = Color(0xFF8B4513)
    val WeatherBgStart = Color(0xFFFFF8E1)
    val WeatherBgEnd = Color(0xFFF5E6CC)
    // Normalized color mode
    val NormEvent = Color(0xFF7AB87A)
    val NormTask = Color(0xFFC4A0D4)
    val NormNote = Color(0xFFD4956B)
    val NormChecklist = Color(0xFF9CC4D8)
    val NormBirthday = Color(0xFFD8A8D8)
    val NormEmail = Color(0xFFA89070)
    val NormHabit = Color(0xFFF0E87A)
    val NormReminder = Color(0xFFC47A76)
    val MonoBackground = Color(0xFFFFFAF0)
}

// ─── Section Icon Mapping ───────────────────────────────────────────────────────

private fun sectionIcon(type: OmniSectionType): String = when (type) {
    OmniSectionType.CHRONO_ANCHORED -> "⏰"
    OmniSectionType.REMINDERS -> "📢"
    OmniSectionType.ON_DECK -> "🔜"
    OmniSectionType.SOON -> "🗓️"
    OmniSectionType.EMAIL -> "📧"
    OmniSectionType.PINNED_NOTES -> "📝"
    OmniSectionType.PINNED_CHECKLISTS -> "☑️"
    OmniSectionType.PINNED_ALL -> "📌"
    else -> ""
}

private fun sectionLabel(type: OmniSectionType): String = when (type) {
    OmniSectionType.CHRONO_ANCHORED -> "Chrono Anchored"
    OmniSectionType.REMINDERS -> "Reminders"
    OmniSectionType.ON_DECK -> "On Deck"
    OmniSectionType.SOON -> "Soon"
    OmniSectionType.EMAIL -> "Email"
    OmniSectionType.PINNED_NOTES -> "Pinned Notes"
    OmniSectionType.PINNED_CHECKLISTS -> "Pinned Checklists"
    OmniSectionType.PINNED_ALL -> "Pinned"
    else -> ""
}

// ─── Main Screen ────────────────────────────────────────────────────────────────

@Composable
fun OmniViewScreen(
    onNavigateToEditor: (String) -> Unit,
    onNavigateToWeather: () -> Unit = {},
    viewModel: OmniViewViewModel = hiltViewModel()
) {
    val sections by viewModel.sections.collectAsState()
    val chronoAnchored by viewModel.chronoAnchored.collectAsState()
    val reminders by viewModel.reminders.collectAsState()
    val onDeck by viewModel.onDeck.collectAsState()
    val soon by viewModel.soon.collectAsState()
    val pinnedNotes by viewModel.pinnedNotes.collectAsState()
    val pinnedChecklists by viewModel.pinnedChecklists.collectAsState()
    val hstItems by viewModel.hstItems.collectAsState()
    val weatherData by viewModel.weatherData.collectAsState()
    val emailChits by viewModel.emailChits.collectAsState()
    val pinnedAll by viewModel.pinnedAll.collectAsState()
    val emailExpanded by viewModel.emailExpanded.collectAsState()
    val emailPageSize by viewModel.emailPageSize.collectAsState()
    val hasEmailConfigured by viewModel.hasEmailConfigured.collectAsState()
    val hstMode by viewModel.hstMode.collectAsState()
    val hstClockMode by viewModel.hstClockMode.collectAsState()
    val colorMode by viewModel.colorMode.collectAsState()

    val visibleSections = sections
        .filter { it.visible }
        .sortedBy { it.order }

    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp)
        ) {
            visibleSections.forEach { section ->
                val isEmpty = isSectionEmpty(
                    section, hstItems, weatherData, chronoAnchored, reminders,
                    onDeck, soon, emailChits, pinnedNotes, pinnedChecklists, pinnedAll,
                    hasEmailConfigured
                )
                if (section.hideWhenEmpty && isEmpty) return@forEach

                when (section.type) {
                    OmniSectionType.HST -> {
                        item(key = "hst_section") {
                            OmniHstBar(
                                items = hstItems,
                                hstMode = hstMode,
                                clockMode = hstClockMode,
                                onBarClick = { viewModel.cycleHstMode() },
                                onItemClick = { chitId -> onNavigateToEditor(chitId) }
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                    OmniSectionType.WEATHER -> {
                        item(key = "weather_section") {
                            OmniWeatherBar(
                                data = weatherData,
                                onClick = onNavigateToWeather
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                    OmniSectionType.HST_WEATHER -> {
                        item(key = "hst_weather_section") {
                            OmniHstBar(
                                items = hstItems,
                                hstMode = hstMode,
                                clockMode = hstClockMode,
                                onBarClick = { viewModel.cycleHstMode() },
                                onItemClick = { chitId -> onNavigateToEditor(chitId) }
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            OmniWeatherBar(data = weatherData, onClick = onNavigateToWeather)
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                    OmniSectionType.HST_TEMP_STRIP -> {
                        item(key = "hst_temp_strip_section") {
                            OmniHstBar(
                                items = hstItems,
                                hstMode = hstMode,
                                clockMode = hstClockMode,
                                onBarClick = { viewModel.cycleHstMode() },
                                onItemClick = { chitId -> onNavigateToEditor(chitId) }
                            )
                            if (weatherData != null) {
                                Spacer(modifier = Modifier.height(4.dp))
                                OmniWeatherStrip(data = weatherData!!)
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }

                    OmniSectionType.EMAIL -> {
                        if (hasEmailConfigured) {
                            item(key = "email_header") {
                                OmniSectionHeader(type = OmniSectionType.EMAIL)
                            }
                            if (isEmpty) {
                                item(key = "email_empty") { OmniEmptySection("email") }
                            } else {
                                val displayedEmails = if (emailExpanded) emailChits
                                    else emailChits.take(emailPageSize)
                                items(displayedEmails, key = { "email_${it.id}" }) { chit ->
                                    OmniEmailCard(
                                        chit = chit,
                                        colorMode = colorMode,
                                        onClick = { onNavigateToEditor(chit.id) }
                                    )
                                }
                                if (emailChits.size > emailPageSize) {
                                    item(key = "email_toggle") {
                                        OmniEmailPagination(
                                            expanded = emailExpanded,
                                            totalCount = emailChits.size,
                                            onToggle = { viewModel.toggleEmailExpanded() }
                                        )
                                    }
                                }
                            }
                            item(key = "email_spacer") { Spacer(modifier = Modifier.height(8.dp)) }
                        }
                    }

                    OmniSectionType.PINNED_ALL -> {
                        item(key = "pinned_all_header") {
                            OmniSectionHeader(type = OmniSectionType.PINNED_ALL)
                        }
                        if (isEmpty) {
                            item(key = "pinned_all_empty") { OmniEmptySection("pinned") }
                        } else {
                            items(pinnedAll, key = { "pinned_all_${it.id}" }) { chit ->
                                OmniPinnedAllCard(
                                    chit = chit,
                                    typeIcon = viewModel.getPinnedTypeIcon(chit),
                                    colorMode = colorMode,
                                    onClick = { onNavigateToEditor(chit.id) }
                                )
                            }
                        }
                        item(key = "pinned_all_spacer") { Spacer(modifier = Modifier.height(8.dp)) }
                    }

                    OmniSectionType.REMINDERS -> {
                        item(key = "reminders_header") {
                            OmniSectionHeader(type = OmniSectionType.REMINDERS)
                        }
                        if (isEmpty) {
                            item(key = "reminders_empty") { OmniEmptySection("reminders") }
                        } else {
                            items(reminders, key = { "reminders_${it.id}" }) { chit ->
                                OmniReminderCard(
                                    chit = chit,
                                    colorMode = colorMode,
                                    onClick = { onNavigateToEditor(chit.id) }
                                )
                            }
                        }
                        item(key = "reminders_spacer") { Spacer(modifier = Modifier.height(8.dp)) }
                    }

                    OmniSectionType.CHRONO_ANCHORED -> {
                        item(key = "chrono_header") {
                            OmniSectionHeader(type = OmniSectionType.CHRONO_ANCHORED)
                        }
                        if (isEmpty) {
                            item(key = "chrono_empty") { OmniEmptySection("chrono anchored") }
                        } else {
                            items(chronoAnchored, key = { "chrono_${it.id}" }) { chit ->
                                OmniChronoCard(
                                    chit = chit,
                                    colorMode = colorMode,
                                    onClick = { onNavigateToEditor(chit.id) }
                                )
                            }
                        }
                        item(key = "chrono_spacer") { Spacer(modifier = Modifier.height(8.dp)) }
                    }

                    OmniSectionType.SOON -> {
                        item(key = "soon_header") {
                            OmniSectionHeader(type = OmniSectionType.SOON)
                        }
                        if (isEmpty) {
                            item(key = "soon_empty") { OmniEmptySection("soon") }
                        } else {
                            items(soon, key = { "soon_${it.id}" }) { chit ->
                                OmniSoonCard(
                                    chit = chit,
                                    colorMode = colorMode,
                                    onClick = { onNavigateToEditor(chit.id) }
                                )
                            }
                        }
                        item(key = "soon_spacer") { Spacer(modifier = Modifier.height(8.dp)) }
                    }

                    else -> {
                        // ON_DECK, PINNED_NOTES, PINNED_CHECKLISTS
                        val (title, chits) = sectionData(
                            section = section,
                            chronoAnchored = chronoAnchored,
                            reminders = reminders,
                            onDeck = onDeck,
                            soon = soon,
                            pinnedNotes = pinnedNotes,
                            pinnedChecklists = pinnedChecklists
                        )

                        item(key = "${section.type}_header") {
                            OmniSectionHeader(type = section.type)
                        }

                        if (chits.isEmpty() && !section.hideWhenEmpty) {
                            item(key = "${section.type}_empty") {
                                OmniEmptySection(title.lowercase())
                            }
                        } else {
                            items(chits, key = { "${section.type}_${it.id}" }) { chit ->
                                OmniChitCard(
                                    chit = chit,
                                    colorMode = colorMode,
                                    sectionType = section.type,
                                    onClick = { onNavigateToEditor(chit.id) }
                                )
                            }
                        }

                        item(key = "${section.type}_spacer") {
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(16.dp)) }
        }
    }

}

// ─── Section Header (Pill Capsule with Icon) ────────────────────────────────────

@Composable
private fun OmniSectionHeader(type: OmniSectionType) {
    val icon = sectionIcon(type)
    val label = sectionLabel(type)
    if (label.isEmpty()) return

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            modifier = Modifier
                .background(
                    color = OmniColors.HeaderBg,
                    shape = RoundedCornerShape(20.dp)
                )
                .border(2.dp, OmniColors.SaddleBrown, RoundedCornerShape(20.dp))
                .padding(horizontal = 16.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (icon.isNotEmpty()) {
                Text(
                    text = icon,
                    fontSize = 16.sp
                )
                Spacer(modifier = Modifier.width(6.dp))
            }
            Text(
                text = label,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = OmniColors.NearBlack
            )
        }
    }
}

// ─── HST Bar (Gradient Fill Timeline) ───────────────────────────────────────────

@Composable
private fun OmniHstBar(
    items: List<HstItem>,
    hstMode: String,
    clockMode: String,
    onBarClick: () -> Unit,
    onItemClick: (String) -> Unit
) {
    var dayFraction by remember { mutableFloatStateOf(currentDayFraction()) }
    var timeText by remember { mutableStateOf(formatHstTimeText(clockMode)) }

    // Update every second
    LaunchedEffect(Unit) {
        while (true) {
            delay(1000L)
            dayFraction = currentDayFraction()
            timeText = formatHstTimeText(clockMode)
        }
    }

    val showChits = hstMode == "chits" || hstMode == "both"

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(40.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(OmniColors.Parchment)
            .border(2.dp, OmniColors.SaddleBrown, RoundedCornerShape(6.dp))
            .clickable(onClick = onBarClick)
    ) {
        // Fill gradient
        Box(
            modifier = Modifier
                .fillMaxWidth(dayFraction)
                .height(36.dp)
                .padding(start = 2.dp, top = 2.dp, bottom = 2.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            OmniColors.HstFillStart,
                            OmniColors.HstFillMid,
                            OmniColors.HstFillEnd
                        )
                    )
                )
        )

        // Chit icons positioned on the bar
        if (showChits && items.isNotEmpty()) {
            items.forEach { item ->
                val offsetFraction = (item.positionPercent / 100f).coerceIn(0f, 0.95f)
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .clickable { onItemClick(item.chitId) },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (offsetFraction > 0f) {
                        Spacer(modifier = Modifier.fillMaxWidth(offsetFraction))
                    }
                    Text(
                        text = item.icon,
                        fontSize = 12.sp
                    )
                }
            }
        }

        // Time text overlay
        Text(
            text = timeText,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = OmniColors.DarkBrown,
            modifier = Modifier
                .align(Alignment.CenterStart)
                .padding(start = 12.dp)
        )
    }
}

private fun currentDayFraction(): Float {
    val now = LocalDateTime.now()
    return ((now.hour * 3600 + now.minute * 60 + now.second) / 86400f)
}

private fun formatHstTimeText(clockMode: String): String {
    val now = LocalDateTime.now()
    val dayFraction = (now.hour * 3600 + now.minute * 60 + now.second) / 86400.0
    val hstVal = String.format("%.3f", dayFraction * 100)
    return when (clockMode) {
        "system" -> {
            val h = now.hour
            val m = now.minute
            val amPm = if (h < 12) "AM" else "PM"
            val displayH = when { h == 0 -> 12; h > 12 -> h - 12; else -> h }
            "$displayH:${m.toString().padStart(2, '0')} $amPm"
        }
        "hst" -> "$hstVal sd"
        else -> "$hstVal sd" // "both" defaults to HST display
    }
}

// ─── Weather Bar ────────────────────────────────────────────────────────────────

@Composable
private fun OmniWeatherBar(
    data: OmniWeatherData?,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(
                Brush.linearGradient(
                    colors = listOf(OmniColors.WeatherBgStart, OmniColors.WeatherBgEnd)
                )
            )
            .border(2.dp, OmniColors.SaddleBrown, RoundedCornerShape(6.dp))
            .clickable(onClick = onClick)
            .padding(8.dp)
    ) {
        if (data == null) {
            Text(
                text = "⏳ Loading weather…",
                fontStyle = FontStyle.Italic,
                color = OmniColors.MediumBrown,
                fontSize = 14.sp
            )
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Weather icon
                Text(
                    text = weatherCodeToIcon(data.weatherCode),
                    fontSize = 20.sp
                )
                // Temps
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "${data.tempHigh?.toInt() ?: "—"}°",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = OmniColors.SaddleBrown
                    )
                    Text(
                        text = " / ",
                        fontSize = 14.sp,
                        color = OmniColors.MediumBrown
                    )
                    Text(
                        text = "${data.tempLow?.toInt() ?: "—"}°",
                        fontSize = 14.sp,
                        color = OmniColors.MediumBrown
                    )
                }
                Spacer(modifier = Modifier.weight(1f))
                // Location
                Text(
                    text = data.locationName,
                    fontSize = 12.sp,
                    color = OmniColors.MediumBrown,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.widthIn(max = 120.dp)
                )
            }
        }
    }
}

// ─── Weather Strip (compact hourly) ─────────────────────────────────────────────

@Composable
private fun OmniWeatherStrip(data: OmniWeatherData) {
    if (data.hourlyForecast.isEmpty()) return
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        data.hourlyForecast.forEach { hourly ->
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = weatherCodeToIcon(hourly.weatherCode),
                    fontSize = 12.sp
                )
                Text(
                    text = hourly.temp?.let { "${it.toInt()}°" } ?: "—",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = OmniColors.DarkBrown
                )
            }
        }
    }
}

// ─── Chrono Card (with time-until badge) ────────────────────────────────────────

@Composable
private fun OmniChronoCard(
    chit: ChitEntity,
    colorMode: String,
    onClick: () -> Unit
) {
    val bgColor = resolveCardColor(chit, colorMode, "chrono")
    val textColor = CwocChitCardStyle.contrastTextColor(bgColor)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(bgColor)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Time column
        Text(
            text = chit.startDatetime?.let { DateUtils.formatDisplayTime(it) } ?: "—",
            fontSize = 12.sp,
            color = textColor.copy(alpha = 0.8f),
            modifier = Modifier.width(70.dp)
        )
        // Title
        Text(
            text = chit.title ?: "Untitled",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = textColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
        // Time-until badge
        chit.startDatetime?.let { startDt ->
            TimeUntilBadge(startDatetime = startDt)
        }
    }
}

// ─── Reminder Card ──────────────────────────────────────────────────────────────

@Composable
private fun OmniReminderCard(
    chit: ChitEntity,
    colorMode: String,
    onClick: () -> Unit
) {
    val bgColor = resolveCardColor(chit, colorMode, "reminders")
    val textColor = CwocChitCardStyle.contrastTextColor(bgColor)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(bgColor)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Pin icon
        Text(text = "📌", fontSize = 14.sp)
        Spacer(modifier = Modifier.width(6.dp))
        // Time column
        Text(
            text = chit.startDatetime?.let { DateUtils.formatDisplayTime(it) }
                ?: chit.dueDatetime?.let { DateUtils.formatDisplayTime(it) }
                ?: "—",
            fontSize = 12.sp,
            color = textColor.copy(alpha = 0.8f),
            modifier = Modifier.width(70.dp)
        )
        // Title
        Text(
            text = chit.title ?: "Untitled",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = textColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
        // Time-until badge (supports negative)
        val targetTime = chit.startDatetime ?: chit.dueDatetime
        if (targetTime != null) {
            ReminderTimeUntilBadge(targetDatetime = targetTime)
        }
    }
}

// ─── Soon Card (with due-date badge) ────────────────────────────────────────────

@Composable
private fun OmniSoonCard(
    chit: ChitEntity,
    colorMode: String,
    onClick: () -> Unit
) {
    val bgColor = resolveCardColor(chit, colorMode, "soon")
    val textColor = CwocChitCardStyle.contrastTextColor(bgColor)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(bgColor)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Title
        Text(
            text = chit.title ?: "Untitled",
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            color = textColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
        // Status
        val status = chit.status
        if (status != null && status != "Complete") {
            Text(
                text = status,
                fontSize = 11.sp,
                color = textColor.copy(alpha = 0.7f),
                modifier = Modifier.padding(end = 8.dp)
            )
        }
        // Due-date badge
        chit.dueDatetime?.let { dueDt ->
            DueDateBadge(dueDatetime = dueDt)
        }
    }
}

// ─── Generic Chit Card (On Deck, Pinned Notes, Pinned Checklists) ───────────────

@Composable
private fun OmniChitCard(
    chit: ChitEntity,
    colorMode: String,
    sectionType: OmniSectionType,
    onClick: () -> Unit
) {
    val sectionId = when (sectionType) {
        OmniSectionType.ON_DECK -> "ondeck"
        OmniSectionType.PINNED_NOTES -> "pinned_notes"
        OmniSectionType.PINNED_CHECKLISTS -> "pinned_checklists"
        else -> "event"
    }
    val bgColor = resolveCardColor(chit, colorMode, sectionId)
    val textColor = CwocChitCardStyle.contrastTextColor(bgColor)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(bgColor)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Time column for On Deck
        if (sectionType == OmniSectionType.ON_DECK) {
            val timeText = chit.startDatetime?.let { DateUtils.formatDisplayTime(it) }
                ?: chit.dueDatetime?.let { DateUtils.formatDisplayTime(it) }
                ?: ""
            if (timeText.isNotEmpty()) {
                Text(
                    text = timeText,
                    fontSize = 12.sp,
                    color = textColor.copy(alpha = 0.8f),
                    modifier = Modifier.width(70.dp)
                )
            }
        }

        // Pin icon for pinned sections
        if (sectionType == OmniSectionType.PINNED_NOTES || sectionType == OmniSectionType.PINNED_CHECKLISTS) {
            Text(text = "📌", fontSize = 12.sp)
            Spacer(modifier = Modifier.width(6.dp))
        }

        // Title
        Text(
            text = chit.title ?: "Untitled",
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            color = textColor,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )

        // Status badge
        val status = chit.status
        if (status != null && status != "Complete") {
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = status,
                fontSize = 11.sp,
                color = textColor.copy(alpha = 0.7f)
            )
        }
    }
}

// ─── Email Card ─────────────────────────────────────────────────────────────────

@Composable
private fun OmniEmailCard(
    chit: ChitEntity,
    colorMode: String,
    onClick: () -> Unit
) {
    val bgColor = resolveCardColor(chit, colorMode, "email")
    val textColor = CwocChitCardStyle.contrastTextColor(bgColor)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(bgColor)
            .clickable(onClick = onClick)
            .padding(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = chit.emailFrom ?: "Unknown sender",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = textColor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            val displayDate = chit.emailDate ?: chit.createdDatetime
            if (displayDate != null) {
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = DateUtils.formatDisplayTime(displayDate),
                    fontSize = 11.sp,
                    color = textColor.copy(alpha = 0.7f)
                )
            }
        }
        Text(
            text = chit.emailSubject ?: chit.title ?: "No subject",
            fontSize = 12.sp,
            color = textColor.copy(alpha = 0.7f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

// ─── Email Pagination ───────────────────────────────────────────────────────────

@Composable
private fun OmniEmailPagination(
    expanded: Boolean,
    totalCount: Int,
    onToggle: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(
                    Brush.linearGradient(
                        colors = listOf(OmniColors.LightCream, OmniColors.Parchment)
                    )
                )
                .clickable(onClick = onToggle)
                .padding(horizontal = 14.dp, vertical = 8.dp)
        ) {
            Text(
                text = if (expanded) "Show Less" else "Show More ($totalCount)",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = OmniColors.DarkBrown
            )
        }
    }
}

// ─── Pinned All Card ────────────────────────────────────────────────────────────

@Composable
private fun OmniPinnedAllCard(
    chit: ChitEntity,
    typeIcon: String,
    colorMode: String,
    onClick: () -> Unit
) {
    val bgColor = resolveCardColor(chit, colorMode, "pinned_all")
    val textColor = CwocChitCardStyle.contrastTextColor(bgColor)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(bgColor)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = typeIcon, fontSize = 16.sp)
        Spacer(modifier = Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = chit.title ?: "Untitled",
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = textColor,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            val displayDate = chit.modifiedDatetime
            if (displayDate != null) {
                Text(
                    text = DateUtils.formatDisplayDate(displayDate),
                    fontSize = 12.sp,
                    color = textColor.copy(alpha = 0.7f)
                )
            }
        }
        Text(text = "📌", fontSize = 12.sp)
    }
}

// ─── Badges ─────────────────────────────────────────────────────────────────────

@Composable
private fun TimeUntilBadge(startDatetime: String) {
    var text by remember { mutableStateOf(computeTimeUntil(startDatetime)) }

    LaunchedEffect(startDatetime) {
        while (true) {
            delay(60_000L)
            text = computeTimeUntil(startDatetime)
        }
    }

    if (text.isNotEmpty()) {
        Box(
            modifier = Modifier
                .background(
                    color = OmniColors.BadgeBg,
                    shape = RoundedCornerShape(10.dp)
                )
                .padding(horizontal = 8.dp, vertical = 2.dp)
        ) {
            Text(
                text = text,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = OmniColors.DarkBrown
            )
        }
    }
}

@Composable
private fun ReminderTimeUntilBadge(targetDatetime: String) {
    var text by remember { mutableStateOf("") }
    var isPast by remember { mutableStateOf(false) }

    LaunchedEffect(targetDatetime) {
        while (true) {
            val result = computeReminderTimeUntil(targetDatetime)
            text = result.first
            isPast = result.second
            delay(60_000L)
        }
    }

    if (text.isNotEmpty()) {
        val borderColor = if (isPast) OmniColors.PastBadgeBorder else OmniColors.BadgeBorder
        Box(
            modifier = Modifier
                .background(
                    color = OmniColors.BadgeBg,
                    shape = RoundedCornerShape(10.dp)
                )
                .padding(horizontal = 8.dp, vertical = 2.dp)
        ) {
            Text(
                text = text,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = if (isPast) OmniColors.PastBadgeBorder else OmniColors.DarkBrown
            )
        }
    }
}

@Composable
private fun DueDateBadge(dueDatetime: String) {
    val text = remember(dueDatetime) { computeDueDateText(dueDatetime) }
    if (text.isNotEmpty()) {
        Box(
            modifier = Modifier
                .background(
                    brush = Brush.linearGradient(
                        colors = listOf(Color(0xFFE8F5E9), Color(0xFFC8E6C9))
                    ),
                    shape = RoundedCornerShape(10.dp)
                )
                .padding(horizontal = 8.dp, vertical = 2.dp)
        ) {
            Text(
                text = text,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = OmniColors.DueBadgeText
            )
        }
    }
}

// ─── Empty Section ──────────────────────────────────────────────────────────────

@Composable
private fun OmniEmptySection(sectionName: String = "") {
    Text(
        text = if (sectionName.isNotEmpty()) "No $sectionName right now." else "Nothing here",
        fontSize = 13.sp,
        fontStyle = FontStyle.Italic,
        color = OmniColors.EmptyText.copy(alpha = 0.7f),
        modifier = Modifier.padding(start = 12.dp, bottom = 4.dp, top = 4.dp)
    )
}

// ─── Color Resolution ───────────────────────────────────────────────────────────

/**
 * Resolves the background color for a card based on the current color mode.
 * - "colored" → chit's own color
 * - "normalized" → fixed earthy tone by type/section
 * - "mono" → ivory
 */
private fun resolveCardColor(chit: ChitEntity, colorMode: String, sectionId: String): Color {
    return when (colorMode) {
        "normalized" -> resolveNormalizedColor(chit, sectionId)
        "mono" -> OmniColors.MonoBackground
        else -> CwocChitCardStyle.resolveChitBgColor(chit.color)
    }
}

private fun resolveNormalizedColor(chit: ChitEntity, sectionId: String): Color {
    return when (sectionId) {
        "chrono", "ondeck", "soon" -> {
            when {
                chit.status != null && chit.status!!.isNotEmpty() -> OmniColors.NormTask
                else -> OmniColors.NormEvent
            }
        }
        "reminders" -> OmniColors.NormReminder
        "email" -> OmniColors.NormEmail
        "pinned_notes" -> OmniColors.NormNote
        "pinned_checklists" -> OmniColors.NormChecklist
        else -> {
            when {
                chit.notification == true -> OmniColors.NormReminder
                !chit.emailMessageId.isNullOrBlank() -> OmniColors.NormEmail
                !chit.checklist.isNullOrBlank() && chit.checklist != "[]" -> OmniColors.NormChecklist
                chit.status != null && chit.status!!.isNotEmpty() -> OmniColors.NormTask
                chit.startDatetime != null || chit.dueDatetime != null -> OmniColors.NormEvent
                else -> OmniColors.NormNote
            }
        }
    }
}

// ─── Time Computation Helpers ───────────────────────────────────────────────────

private fun computeTimeUntil(startDatetime: String): String {
    val now = java.time.Instant.now()
    val target = try {
        java.time.Instant.parse(startDatetime)
    } catch (_: Exception) {
        try {
            LocalDateTime.parse(startDatetime, java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                .atZone(java.time.ZoneId.systemDefault()).toInstant()
        } catch (_: Exception) { return "" }
    }
    val diffMs = target.toEpochMilli() - now.toEpochMilli()
    if (diffMs < 0) return ""
    val diffMin = (diffMs / 60000).toInt()
    return when {
        diffMin <= 5 -> "now"
        diffMin < 60 -> "in ${diffMin}m"
        else -> {
            val h = diffMin / 60
            val m = diffMin % 60
            if (m == 0) "in ${h}h" else "in ${h}h ${m}m"
        }
    }
}

private fun computeReminderTimeUntil(targetDatetime: String): Pair<String, Boolean> {
    val now = java.time.Instant.now()
    val target = try {
        java.time.Instant.parse(targetDatetime)
    } catch (_: Exception) {
        try {
            LocalDateTime.parse(targetDatetime, java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                .atZone(java.time.ZoneId.systemDefault()).toInstant()
        } catch (_: Exception) { return "" to false }
    }
    val diffMs = target.toEpochMilli() - now.toEpochMilli()
    val isPast = diffMs < 0
    val absDiffMin = (Math.abs(diffMs) / 60000).toInt()
    val text = when {
        absDiffMin <= 5 && !isPast -> "now"
        absDiffMin < 60 -> if (isPast) "-${absDiffMin}m" else "in ${absDiffMin}m"
        else -> {
            val h = absDiffMin / 60
            val m = absDiffMin % 60
            val timeStr = if (m == 0) "${h}h" else "${h}h ${m}m"
            if (isPast) "-$timeStr" else "in $timeStr"
        }
    }
    return text to isPast
}

private fun computeDueDateText(dueDatetime: String): String {
    val now = java.time.LocalDate.now()
    val dueDate = try {
        LocalDateTime.parse(dueDatetime, java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME).toLocalDate()
    } catch (_: Exception) {
        try {
            java.time.LocalDate.parse(dueDatetime, java.time.format.DateTimeFormatter.ISO_LOCAL_DATE)
        } catch (_: Exception) {
            try {
                java.time.Instant.parse(dueDatetime)
                    .atZone(java.time.ZoneId.systemDefault()).toLocalDate()
            } catch (_: Exception) { return "" }
        }
    }
    val diffDays = java.time.temporal.ChronoUnit.DAYS.between(now, dueDate).toInt()
    return when {
        diffDays <= 0 -> "today"
        diffDays == 1 -> "1 day"
        else -> "$diffDays days"
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

private fun sectionData(
    section: OmniSection,
    chronoAnchored: List<ChitEntity>,
    reminders: List<ChitEntity>,
    onDeck: List<ChitEntity>,
    soon: List<ChitEntity>,
    pinnedNotes: List<ChitEntity>,
    pinnedChecklists: List<ChitEntity>
): Pair<String, List<ChitEntity>> {
    return when (section.type) {
        OmniSectionType.CHRONO_ANCHORED -> "Chrono Anchored" to chronoAnchored
        OmniSectionType.REMINDERS -> "Reminders" to reminders
        OmniSectionType.ON_DECK -> "On Deck" to onDeck
        OmniSectionType.SOON -> "Soon" to soon
        OmniSectionType.PINNED_NOTES -> "Pinned Notes" to pinnedNotes
        OmniSectionType.PINNED_CHECKLISTS -> "Pinned Checklists" to pinnedChecklists
        else -> "" to emptyList()
    }
}

private fun isSectionEmpty(
    section: OmniSection,
    hstItems: List<HstItem>,
    weatherData: OmniWeatherData?,
    chronoAnchored: List<ChitEntity>,
    reminders: List<ChitEntity>,
    onDeck: List<ChitEntity>,
    soon: List<ChitEntity>,
    emailChits: List<ChitEntity>,
    pinnedNotes: List<ChitEntity>,
    pinnedChecklists: List<ChitEntity>,
    pinnedAll: List<ChitEntity>,
    hasEmailConfigured: Boolean
): Boolean {
    return when (section.type) {
        OmniSectionType.HST -> hstItems.isEmpty()
        OmniSectionType.WEATHER -> weatherData == null
        OmniSectionType.HST_WEATHER -> hstItems.isEmpty() && weatherData == null
        OmniSectionType.HST_TEMP_STRIP -> hstItems.isEmpty() && weatherData == null
        OmniSectionType.CHRONO_ANCHORED -> chronoAnchored.isEmpty()
        OmniSectionType.REMINDERS -> reminders.isEmpty()
        OmniSectionType.ON_DECK -> onDeck.isEmpty()
        OmniSectionType.SOON -> soon.isEmpty()
        OmniSectionType.EMAIL -> !hasEmailConfigured || emailChits.isEmpty()
        OmniSectionType.PINNED_NOTES -> pinnedNotes.isEmpty()
        OmniSectionType.PINNED_CHECKLISTS -> pinnedChecklists.isEmpty()
        OmniSectionType.PINNED_ALL -> pinnedAll.isEmpty()
    }
}
