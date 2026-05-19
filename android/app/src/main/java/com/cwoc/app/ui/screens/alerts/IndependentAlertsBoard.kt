package com.cwoc.app.ui.screens.alerts

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.local.entity.StandaloneAlertEntity

/**
 * Independent Alerts Board — displays three vertically stacked sections:
 * 🔔 Alarms, ⏱️ Timers, ⏲️ Stopwatches.
 *
 * Each section has a header row with label and "+" button for creating new items,
 * and renders cards for that type or an empty state message when no items exist.
 *
 * Validates: Requirements 3.1, 3.4, 3.5, 3.6
 */
@Composable
fun IndependentAlertsBoard(
    viewModel: AlertsViewModel,
    modifier: Modifier = Modifier
) {
    val standaloneAlerts by viewModel.standaloneAlerts.collectAsState()

    // Group alerts by type
    val alarms = remember(standaloneAlerts) {
        standaloneAlerts.filter { it.type == "alarm" }
    }
    val timers = remember(standaloneAlerts) {
        standaloneAlerts.filter { it.type == "timer" }
    }
    val stopwatches = remember(standaloneAlerts) {
        standaloneAlerts.filter { it.type == "stopwatch" }
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // ─── Alarms Section ───────────────────────────────────────────────
        item {
            SectionHeader(
                label = "🔔 Alarms",
                onAddClick = { viewModel.createAlarm() }
            )
        }
        if (alarms.isEmpty()) {
            item {
                EmptyStateText("No independent alarms yet.")
            }
        } else {
            items(alarms, key = { it.id }) { alarm ->
                IndependentAlarmCard(
                    alert = alarm,
                    viewModel = viewModel
                )
            }
        }

        // ─── Timers Section ───────────────────────────────────────────────
        item {
            Spacer(modifier = Modifier.height(8.dp))
            SectionHeader(
                label = "⏱️ Timers",
                onAddClick = { viewModel.createTimer() }
            )
        }
        if (timers.isEmpty()) {
            item {
                EmptyStateText("No independent timers yet.")
            }
        } else {
            items(timers, key = { it.id }) { timer ->
                IndependentTimerCard(
                    alert = timer,
                    viewModel = viewModel
                )
            }
        }

        // ─── Stopwatches Section ──────────────────────────────────────────
        item {
            Spacer(modifier = Modifier.height(8.dp))
            SectionHeader(
                label = "⏲️ Stopwatches",
                onAddClick = { viewModel.createStopwatch() }
            )
        }
        if (stopwatches.isEmpty()) {
            item {
                EmptyStateText("No independent stopwatches yet.")
            }
        } else {
            items(stopwatches, key = { it.id }) { stopwatch ->
                IndependentStopwatchCard(
                    alert = stopwatch,
                    viewModel = viewModel
                )
            }
        }
    }
}

/**
 * Section header with label text and "+" add button.
 */
@Composable
private fun SectionHeader(
    label: String,
    onAddClick: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF6B4E31)
        )
        IconButton(
            onClick = onAddClick,
            modifier = Modifier.size(36.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = "Add $label",
                tint = Color(0xFF6B4E31)
            )
        }
    }
}

/**
 * Empty state text shown when a section has no items.
 */
@Composable
private fun EmptyStateText(message: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF8B7355)
        )
    }
}
