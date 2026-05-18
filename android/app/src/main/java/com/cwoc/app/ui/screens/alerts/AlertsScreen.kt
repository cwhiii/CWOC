package com.cwoc.app.ui.screens.alerts

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.alerts.AlertSection
import com.cwoc.app.domain.alerts.ClassifiedAlert
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.domain.sort.SortState
import com.cwoc.app.ui.components.ChitActionMenu
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.components.SnoozePickerDialog
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import kotlinx.coroutines.launch
import java.time.format.DateTimeFormatter

/**
 * Alerts/Alarms view — displays all alert chits grouped into Upcoming and Past sections.
 * Applies FilterSortViewModel filter state to exclude alerts from chits that don't match filters.
 * Long-press on an alert card shows ChitActionMenu for pin/archive/snooze actions.
 *
 * Note: Alerts are derived from chits, so we filter by checking if the alert's parent chit
 * would pass the filter. Sort is applied to the alert list by scheduled time (default behavior).
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.8, 10.4
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun AlertsScreen(
    onNavigateToEditor: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: AlertsViewModel = hiltViewModel(),
    filterSortViewModel: FilterSortViewModel? = null,
    chitRepository: ChitRepository? = null
) {
    val alerts by viewModel.alerts.collectAsState()

    // Collect filter state if ViewModel is provided
    val filterState = filterSortViewModel?.filterState?.collectAsState()?.value ?: FilterState()

    // Check if filters are active (non-default state)
    val hasActiveFilters = filterState != FilterState()

    // R3/R7: Alerts view mode — "list", "independent", "notifications", or "reminders"
    var alertsMode by remember { mutableStateOf("list") }

    // Long-press action menu state
    var menuChit by remember { mutableStateOf<ChitEntity?>(null) }
    var menuChitId by remember { mutableStateOf<String?>(null) }
    var showSnoozeDialog by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    // R6 FIX: Apply filters to alerts based on parent chit properties
    val filteredAlerts = remember(alerts, filterState) {
        if (!hasActiveFilters) {
            alerts
        } else {
            alerts.filter { alert ->
                // Filter by status if status filter is set
                val statusMatch = if (filterState.statuses.isEmpty()) true
                    else alert.chitStatus in filterState.statuses
                // Filter by tags if tag filter is set
                val tagMatch = if (filterState.tags.isEmpty()) true
                    else alert.chitTags?.any { it in filterState.tags } ?: false
                statusMatch && tagMatch
            }
        }
    }

    // Mode-based filtering: Notifications and Reminders modes filter by alertType
    val modeFilteredAlerts = remember(filteredAlerts, alertsMode) {
        when (alertsMode) {
            "notifications" -> filteredAlerts.filter { it.alertType == "notification" }
            "reminders" -> filteredAlerts.filter { it.alertType == "reminder" }
            else -> filteredAlerts // "list" and "independent" show all
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        when {
            modeFilteredAlerts.isEmpty() && hasActiveFilters -> {
                FilteredEmptyState(
                    onClearFilters = { filterSortViewModel?.clearFilters() }
                )
            }
            alerts.isEmpty() -> {
                EmptyAlertsState()
            }
            modeFilteredAlerts.isEmpty() -> {
                FilteredEmptyState(
                    onClearFilters = {
                        alertsMode = "list"
                        filterSortViewModel?.clearFilters()
                    }
                )
            }
            else -> {
                val upcoming = modeFilteredAlerts.filter { it.section == AlertSection.UPCOMING }
                val past = modeFilteredAlerts.filter { it.section == AlertSection.PAST }

                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    // R3/R7: Mode toggle (List, Independent, Notifications, Reminders)
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState())
                                .padding(bottom = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            FilterChip(
                                selected = alertsMode == "list",
                                onClick = { alertsMode = "list" },
                                label = { Text("List") }
                            )
                            FilterChip(
                                selected = alertsMode == "independent",
                                onClick = { alertsMode = "independent" },
                                label = { Text("Independent") }
                            )
                            FilterChip(
                                selected = alertsMode == "notifications",
                                onClick = { alertsMode = "notifications" },
                                label = { Text("Notifications") }
                            )
                            FilterChip(
                                selected = alertsMode == "reminders",
                                onClick = { alertsMode = "reminders" },
                                label = { Text("Reminders") }
                            )
                        }
                    }
                    // Upcoming section
                    if (upcoming.isNotEmpty()) {
                        item {
                            SectionHeader(title = "Upcoming", count = upcoming.size)
                        }
                        items(upcoming, key = { "${it.chitId}_${it.scheduledTime}" }) { alert ->
                            AlertItemCard(
                                alert = alert,
                                onTap = { onNavigateToEditor(alert.chitId) },
                                onLongPress = {
                                    menuChitId = alert.chitId
                                    // Look up the full ChitEntity for the action menu
                                    chitRepository?.let { repo ->
                                        coroutineScope.launch {
                                            val chit = repo.getById(alert.chitId)
                                            if (chit != null) {
                                                menuChit = chit
                                            }
                                        }
                                    }
                                }
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                        }
                    }

                    // Past section
                    if (past.isNotEmpty()) {
                        item {
                            Spacer(modifier = Modifier.height(16.dp))
                            SectionHeader(title = "Past", count = past.size)
                        }
                        items(past, key = { "${it.chitId}_${it.scheduledTime}_past" }) { alert ->
                            AlertItemCard(
                                alert = alert,
                                onTap = { onNavigateToEditor(alert.chitId) },
                                onLongPress = {
                                    menuChitId = alert.chitId
                                    chitRepository?.let { repo ->
                                        coroutineScope.launch {
                                            val chit = repo.getById(alert.chitId)
                                            if (chit != null) {
                                                menuChit = chit
                                            }
                                        }
                                    }
                                }
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                        }
                    }
                }
            }
        }

        // ChitActionMenu for long-press
        val currentMenuChit = menuChit
        if (currentMenuChit != null) {
            ChitActionMenu(
                expanded = true,
                chit = currentMenuChit,
                onDismiss = { menuChit = null },
                onPin = {
                    chitRepository?.let { repo ->
                        coroutineScope.launch {
                            if (currentMenuChit.pinned) repo.unpin(currentMenuChit.id)
                            else repo.pin(currentMenuChit.id)
                        }
                    }
                },
                onArchive = {
                    chitRepository?.let { repo ->
                        coroutineScope.launch {
                            if (currentMenuChit.archived) repo.unarchive(currentMenuChit.id)
                            else repo.archive(currentMenuChit.id)
                        }
                    }
                },
                onSnooze = {
                    showSnoozeDialog = true
                },
                onEdit = { onNavigateToEditor(currentMenuChit.id) },
                onDelete = { /* Alerts screen doesn't have soft-delete */ }
            )
        }

        // Snooze picker dialog
        if (showSnoozeDialog && currentMenuChit != null) {
            SnoozePickerDialog(
                onSnoozeSelected = { isoString ->
                    chitRepository?.let { repo ->
                        coroutineScope.launch {
                            repo.snooze(currentMenuChit.id, isoString)
                        }
                    }
                    showSnoozeDialog = false
                    menuChit = null
                },
                onDismiss = {
                    showSnoozeDialog = false
                }
            )
        }
    }
}

@Composable
private fun FilteredEmptyState(
    onClearFilters: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No chits match filters",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = onClearFilters) {
                Text("Clear Filters")
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, count: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            color = Color(0xFF6B4E31),
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "($count)",
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFF8B7355)
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun AlertItemCard(
    alert: ClassifiedAlert,
    onTap: () -> Unit,
    onLongPress: () -> Unit,
    // R1: Inline snooze callback
    onSnooze: (() -> Unit)? = null,
    // R2: Inline dismiss callback
    onDismiss: (() -> Unit)? = null
) {
    val timeFormatter = DateTimeFormatter.ofPattern("MMM d, h:mm a")

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = onTap,
                onLongClick = onLongPress
            ),
        border = CwocChitCardStyle.cardBorder,
        colors = CwocChitCardStyle.cardColors(),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Alert type icon/label
            Text(
                text = when (alert.alertType) {
                    "notification" -> "🔔"
                    "alarm" -> "⏰"
                    "timer" -> "⏱"
                    "stopwatch" -> "⏲"
                    else -> "📌"
                },
                style = MaterialTheme.typography.titleMedium
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = alert.chitTitle ?: "Untitled",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF1A1208),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = alert.scheduledTime.format(timeFormatter),
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF8B7355)
                )
                // R4: Stopwatch display (running time)
                if (alert.alertType == "stopwatch") {
                    Text(
                        text = "⏲ Running...",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF4A6741),
                        fontWeight = FontWeight.Bold
                    )
                }
                // R5: Timer countdown display
                if (alert.alertType == "timer" && alert.section == AlertSection.UPCOMING) {
                    val remaining = java.time.Duration.between(
                        java.time.LocalDateTime.now(),
                        alert.scheduledTime
                    )
                    if (!remaining.isNegative) {
                        val hours = remaining.toHours()
                        val minutes = remaining.toMinutes() % 60
                        val seconds = remaining.seconds % 60
                        Text(
                            text = "⏱ ${hours}h ${minutes}m ${seconds}s remaining",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF8B5A2B),
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // R1: Inline snooze button
            if (onSnooze != null && alert.section == AlertSection.UPCOMING) {
                androidx.compose.material3.IconButton(
                    onClick = onSnooze,
                    modifier = Modifier.padding(end = 4.dp)
                ) {
                    Text("💤", style = MaterialTheme.typography.bodyMedium)
                }
            }

            // R2: Inline dismiss button
            if (onDismiss != null) {
                androidx.compose.material3.IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.padding(end = 4.dp)
                ) {
                    Text("✓", style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF4A6741), fontWeight = FontWeight.Bold)
                }
            }

            // Alert type label
            Text(
                text = alert.alertType.replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF6B4E31)
            )
        }
    }
}

@Composable
private fun EmptyAlertsState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(120.dp))
        Text(
            text = "No alerts set",
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF6B4E31)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Add alerts to your chits to see them here.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF8B7355)
        )
    }
}
