package com.cwoc.app.ui.screens.alerts

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.filter.FilterEngine
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.domain.sort.SortEngine
import com.cwoc.app.domain.sort.SortState
import com.cwoc.app.ui.components.ChitActionMenu
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.components.SnoozePickerDialog
import com.cwoc.app.ui.components.sortPinnedFirst
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.launch

/**
 * Chits List View for the Alerts screen — displays all chits that have alert data.
 * Each chit is rendered as a card with title, color background, and alert summary counts.
 * Long-press shows ChitActionMenu with pin, archive, snooze, edit, delete actions.
 * Applies FilterSortViewModel filters (tags, status) and current sort order.
 * Pinned chits display before unpinned regardless of sort.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ChitAlertsListView(
    viewModel: AlertsViewModel,
    onNavigateToEditor: (String) -> Unit,
    filterSortViewModel: FilterSortViewModel? = null,
    chitRepository: ChitRepository? = null
) {
    val alertChits by viewModel.alertChits.collectAsState()
    val coroutineScope = rememberCoroutineScope()

    // Collect filter/sort state if ViewModel is provided
    val filterState = filterSortViewModel?.filterState?.collectAsState()?.value ?: FilterState()
    val sortState = filterSortViewModel?.sortState?.collectAsState()?.value ?: SortState()

    // Apply filters, sort, and pin-to-top
    val filteredSortedChits = remember(alertChits, filterState, sortState) {
        val filtered = FilterEngine.applyFilters(alertChits, filterState)
        val sorted = SortEngine.sort(filtered, sortState.field, sortState.direction)
        sortPinnedFirst(sorted) { it.pinned }
    }

    // Long-press action menu state
    var menuChit by remember { mutableStateOf<ChitEntity?>(null) }
    var showSnoozeDialog by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize()) {
        if (filteredSortedChits.isEmpty()) {
            // Empty state
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No chits with alerts found.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item { Spacer(modifier = Modifier.height(8.dp)) }

                items(filteredSortedChits, key = { it.id }) { chit ->
                    ChitAlertCard(
                        chit = chit,
                        onClick = { onNavigateToEditor(chit.id) },
                        onLongClick = { menuChit = chit }
                    )
                }

                item { Spacer(modifier = Modifier.height(8.dp)) }
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
                onDelete = {
                    viewModel.deleteReminder(currentMenuChit.id)
                }
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

/**
 * Individual chit alert card showing title, color background, and alert type summary counts.
 * Tapping navigates to editor; long-press shows action menu.
 *
 * Alert summary row shows only non-zero counts:
 * - 📢 N = notification type alerts
 * - 🔔 N = alarm type alerts
 * - ⏱️ N = timer type alerts
 * - ⏲️ N = stopwatch type alerts
 *
 * If a boolean flag (alarm, notification) is true but no matching array entries exist,
 * the count defaults to 1.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ChitAlertCard(
    chit: ChitEntity,
    onClick: () -> Unit,
    onLongClick: () -> Unit
) {
    val cardBgColor = remember(chit.color) { CwocChitCardStyle.resolveChitBgColor(chit.color) }
    val cardTextColor = remember(cardBgColor) { CwocChitCardStyle.contrastTextColor(cardBgColor) }

    // Parse alert counts from the alerts JSON field
    val alertCounts = remember(chit.alerts, chit.alarm, chit.notification) {
        parseAlertCounts(chit.alerts, chit.alarm, chit.notification)
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        border = CwocChitCardStyle.cardBorder,
        colors = CardDefaults.cardColors(containerColor = cardBgColor),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            // Title row
            Text(
                text = chit.title ?: "Untitled",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = cardTextColor,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            // Alert summary row — only show non-zero counts
            val summaryParts = buildAlertSummaryParts(alertCounts)
            if (summaryParts.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    summaryParts.forEach { part ->
                        Text(
                            text = part,
                            style = MaterialTheme.typography.bodySmall,
                            color = cardTextColor.copy(alpha = 0.85f)
                        )
                    }
                }
            }

            // Pin indicator
            if (chit.pinned) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "📌 Pinned",
                    style = MaterialTheme.typography.labelSmall,
                    color = cardTextColor.copy(alpha = 0.7f)
                )
            }
        }
    }
}

/**
 * Data class holding alert counts by type.
 */
private data class AlertCounts(
    val notification: Int = 0,
    val alarm: Int = 0,
    val timer: Int = 0,
    val stopwatch: Int = 0
)

/**
 * Parses the alerts JSON string to count entries by type.
 * The alerts field contains a JSON array of objects with a "type" field.
 * Valid type values: "notification", "alarm", "timer", "stopwatch".
 *
 * If a boolean flag (alarm, notification) is true but no matching array entries exist,
 * the count defaults to 1 for that type.
 */
private fun parseAlertCounts(
    alertsJson: String?,
    alarmFlag: Boolean?,
    notificationFlag: Boolean?
): AlertCounts {
    var notificationCount = 0
    var alarmCount = 0
    var timerCount = 0
    var stopwatchCount = 0

    // Parse the alerts JSON array
    if (!alertsJson.isNullOrBlank() && alertsJson != "[]") {
        try {
            val gson = Gson()
            val type = object : TypeToken<List<Map<String, Any>>>() {}.type
            val alerts: List<Map<String, Any>> = gson.fromJson(alertsJson, type)

            for (alert in alerts) {
                when (alert["type"] as? String) {
                    "notification" -> notificationCount++
                    "alarm" -> alarmCount++
                    "timer" -> timerCount++
                    "stopwatch" -> stopwatchCount++
                }
            }
        } catch (_: Exception) {
            // If JSON parsing fails, fall through to boolean flag defaults
        }
    }

    // If boolean flags are true but no matching array entries, default to 1
    if (alarmFlag == true && alarmCount == 0) {
        alarmCount = 1
    }
    if (notificationFlag == true && notificationCount == 0) {
        notificationCount = 1
    }

    return AlertCounts(
        notification = notificationCount,
        alarm = alarmCount,
        timer = timerCount,
        stopwatch = stopwatchCount
    )
}

/**
 * Builds the alert summary display parts showing only non-zero counts.
 * Format: "📢 N", "🔔 N", "⏱️ N", "⏲️ N"
 */
private fun buildAlertSummaryParts(counts: AlertCounts): List<String> {
    val parts = mutableListOf<String>()
    if (counts.notification > 0) parts.add("📢 ${counts.notification}")
    if (counts.alarm > 0) parts.add("🔔 ${counts.alarm}")
    if (counts.timer > 0) parts.add("⏱️ ${counts.timer}")
    if (counts.stopwatch > 0) parts.add("⏲️ ${counts.stopwatch}")
    return parts
}
