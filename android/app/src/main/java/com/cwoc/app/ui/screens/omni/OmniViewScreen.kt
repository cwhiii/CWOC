package com.cwoc.app.ui.screens.omni

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.util.DateUtils

/**
 * Omni View screen — a configurable dashboard showing sections of chits:
 * HST Bar, Weather, Chrono Anchored, Reminders, On Deck, Soon,
 * Email, Pinned Notes, Pinned Checklists, Pinned All.
 *
 * Sections are rendered in configured order. Hidden sections are skipped.
 * Tapping any item navigates to the editor. Empty sections show "Nothing here"
 * or are hidden based on hideWhenEmpty setting.
 *
 * Validates: Requirements 3.1, 3.2, 3.5
 */
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
    val showLayoutDialog by viewModel.showLayoutDialog.collectAsState()

    val visibleSections = sections
        .filter { it.visible }
        .sortedBy { it.order }

    Column(modifier = Modifier.fillMaxSize()) {
        // Configure gear icon (no title header since it's now a tab)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = { viewModel.openLayoutDialog() }) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Configure Layout",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            visibleSections.forEach { section ->
                // Check hideWhenEmpty
                val isEmpty = isSectionEmpty(
                    section, hstItems, weatherData, chronoAnchored, reminders,
                    onDeck, soon, emailChits, pinnedNotes, pinnedChecklists, pinnedAll,
                    hasEmailConfigured
                )
                if (section.hideWhenEmpty && isEmpty) return@forEach

                when (section.type) {
                    OmniSectionType.HST -> {
                        item(key = "hst_section") {
                            OmniHstSection(
                                items = hstItems,
                                onItemClick = { chitId -> onNavigateToEditor(chitId) }
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                        }
                    }
                    OmniSectionType.WEATHER -> {
                        item(key = "weather_section") {
                            OmniWeatherSection(
                                data = weatherData,
                                onClick = onNavigateToWeather
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                        }
                    }
                    OmniSectionType.HST_WEATHER -> {
                        item(key = "hst_weather_section") {
                            OmniHstSection(
                                items = hstItems,
                                onItemClick = { chitId -> onNavigateToEditor(chitId) }
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            OmniWeatherSection(
                                data = weatherData,
                                onClick = onNavigateToWeather
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                        }
                    }
                    OmniSectionType.HST_TEMP_STRIP -> {
                        item(key = "hst_temp_strip_section") {
                            OmniHstSection(
                                items = hstItems,
                                onItemClick = { chitId -> onNavigateToEditor(chitId) }
                            )
                            if (weatherData != null) {
                                Spacer(modifier = Modifier.height(4.dp))
                                OmniWeatherStrip(data = weatherData!!)
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                        }
                    }

                    OmniSectionType.EMAIL -> {
                        if (hasEmailConfigured) {
                            item(key = "email_header") {
                                OmniSectionHeader(title = "Email")
                            }
                            if (emailChits.isEmpty()) {
                                item(key = "email_empty") { OmniEmptySection() }
                            } else {
                                val displayedEmails = if (emailExpanded) emailChits
                                    else emailChits.take(emailPageSize)
                                items(displayedEmails, key = { "email_${it.id}" }) { chit ->
                                    OmniEmailCard(
                                        chit = chit,
                                        onClick = { onNavigateToEditor(chit.id) }
                                    )
                                }
                                if (emailChits.size > emailPageSize) {
                                    item(key = "email_toggle") {
                                        TextButton(
                                            onClick = { viewModel.toggleEmailExpanded() },
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Text(
                                                text = if (emailExpanded) "Show Less" else "Show More (${emailChits.size})"
                                            )
                                        }
                                    }
                                }
                            }
                            item(key = "email_spacer") { Spacer(modifier = Modifier.height(12.dp)) }
                        }
                    }

                    OmniSectionType.PINNED_ALL -> {
                        item(key = "pinned_all_header") {
                            OmniSectionHeader(title = "Pinned All")
                        }
                        if (pinnedAll.isEmpty()) {
                            item(key = "pinned_all_empty") { OmniEmptySection() }
                        } else {
                            items(pinnedAll, key = { "pinned_all_${it.id}" }) { chit ->
                                OmniPinnedAllCard(
                                    chit = chit,
                                    typeIcon = viewModel.getPinnedTypeIcon(chit),
                                    onClick = { onNavigateToEditor(chit.id) }
                                )
                            }
                        }
                        item(key = "pinned_all_spacer") { Spacer(modifier = Modifier.height(12.dp)) }
                    }

                    else -> {
                        // Standard chit-list sections
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
                            OmniSectionHeader(title = title)
                        }

                        if (chits.isEmpty()) {
                            item(key = "${section.type}_empty") { OmniEmptySection() }
                        } else {
                            items(chits, key = { "${section.type}_${it.id}" }) { chit ->
                                OmniChitCard(
                                    chit = chit,
                                    onClick = { onNavigateToEditor(chit.id) }
                                )
                            }
                        }

                        item(key = "${section.type}_spacer") { Spacer(modifier = Modifier.height(12.dp)) }
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(16.dp)) }
        }
    }

    // Layout configuration dialog
    if (showLayoutDialog) {
        OmniLayoutDialog(
            sections = sections,
            onDismiss = { viewModel.closeLayoutDialog() },
            onSave = { updatedSections -> viewModel.saveLayout(updatedSections) }
        )
    }
}

// ─── HST Section ────────────────────────────────────────────────────────────────

/**
 * Horizontal Strip Timeline — a horizontal LazyRow showing today's events
 * positioned along a 24-hour timeline bar.
 */
@Composable
private fun OmniHstSection(
    items: List<HstItem>,
    onItemClick: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(8.dp)) {
            // Timeline bar background
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(MaterialTheme.colorScheme.outlineVariant)
            ) {
                // Current time indicator
                val now = java.time.LocalDateTime.now()
                val currentPct = ((now.hour * 60 + now.minute) / 1440f)
                Box(
                    modifier = Modifier
                        .fillMaxWidth(currentPct)
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.6f))
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (items.isEmpty()) {
                Text(
                    text = "No events today",
                    style = MaterialTheme.typography.bodySmall,
                    fontStyle = FontStyle.Italic,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 4.dp)
                )
            } else {
                // Horizontal scrollable event items
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(items, key = { it.chitId }) { item ->
                        OmniHstItemCard(item = item, onClick = { onItemClick(item.chitId) })
                    }
                }
            }
        }
    }
}

@Composable
private fun OmniHstItemCard(
    item: HstItem,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .width(100.dp)
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = item.icon,
                style = MaterialTheme.typography.titleMedium
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = item.startTime,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = item.title,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

// ─── Weather Section ────────────────────────────────────────────────────────────

/**
 * Weather section card showing current conditions and a brief hourly forecast strip.
 * Tap navigates to the full Weather screen.
 */
@Composable
private fun OmniWeatherSection(
    data: OmniWeatherData?,
    onClick: () -> Unit
) {
    if (data == null) return

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Current conditions row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = weatherCodeToIcon(data.weatherCode),
                        style = MaterialTheme.typography.headlineMedium
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = data.currentTemp?.let { "${it.toInt()}°" } ?: "—",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = data.conditions,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = data.locationName,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Row {
                        Text(
                            text = "H: ${data.tempHigh?.toInt() ?: "—"}°",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "L: ${data.tempLow?.toInt() ?: "—"}°",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Hourly forecast strip
            if (data.hourlyForecast.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    data.hourlyForecast.forEach { hourly ->
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = hourly.hour,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = weatherCodeToIcon(hourly.weatherCode),
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                text = hourly.temp?.let { "${it.toInt()}°" } ?: "—",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Compact weather strip (used in HST_TEMP_STRIP mode) — just the hourly temps.
 */
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
                    style = MaterialTheme.typography.bodySmall
                )
                Text(
                    text = hourly.temp?.let { "${it.toInt()}°" } ?: "—",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

// ─── Email Section Card ─────────────────────────────────────────────────────────

@Composable
private fun OmniEmailCard(
    chit: ChitEntity,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        border = CwocChitCardStyle.cardBorder,
        colors = CwocChitCardStyle.cardColors(),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Sender
                Text(
                    text = chit.emailFrom ?: "Unknown sender",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                // Time
                val displayDate = chit.emailDate ?: chit.createdDatetime
                if (displayDate != null) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = DateUtils.formatDisplayTime(displayDate),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            // Subject
            Text(
                text = chit.emailSubject ?: chit.title ?: "No subject",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

// ─── Pinned All Card ────────────────────────────────────────────────────────────

@Composable
private fun OmniPinnedAllCard(
    chit: ChitEntity,
    typeIcon: String,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        border = CwocChitCardStyle.cardBorder,
        colors = CwocChitCardStyle.cardColors(),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Type indicator icon
            Text(
                text = typeIcon,
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = chit.title ?: "Untitled",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                val displayDate = chit.modifiedDatetime
                if (displayDate != null) {
                    Text(
                        text = DateUtils.formatDisplayDate(displayDate),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Text(
                text = "📌",
                style = MaterialTheme.typography.labelSmall
            )
        }
    }
}

// ─── Section Header ─────────────────────────────────────────────────────────────

@Composable
private fun OmniSectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(vertical = 8.dp)
    )
}

// ─── Empty Section ──────────────────────────────────────────────────────────────

@Composable
private fun OmniEmptySection() {
    Text(
        text = "Nothing here",
        style = MaterialTheme.typography.bodySmall,
        fontStyle = FontStyle.Italic,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 8.dp, bottom = 4.dp)
    )
}

// ─── Chit Card ──────────────────────────────────────────────────────────────────

@Composable
private fun OmniChitCard(
    chit: ChitEntity,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        border = CwocChitCardStyle.cardBorder,
        colors = CwocChitCardStyle.cardColors(),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = chit.title ?: "Untitled",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                // Show status badge if present
                val status = chit.status
                if (status != null && status != "Complete") {
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = status,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Show time or due date if available
            val displayDate = chit.startDatetime ?: chit.dueDatetime
            if (displayDate != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = DateUtils.formatDisplayDate(displayDate),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Pin indicator
            if (chit.pinned) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "📌 Pinned",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Maps a section config to its display title and corresponding chit list.
 * Only handles standard chit-list sections (not HST, Weather, Email, Pinned All).
 */
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

/**
 * Determines if a section is empty (for hideWhenEmpty logic).
 */
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
