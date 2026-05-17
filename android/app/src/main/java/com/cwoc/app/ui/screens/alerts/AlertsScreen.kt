package com.cwoc.app.ui.screens.alerts

import androidx.compose.foundation.clickable
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.domain.alerts.AlertSection
import com.cwoc.app.domain.alerts.ClassifiedAlert
import java.time.format.DateTimeFormatter

/**
 * Alerts/Alarms view — displays all alert chits grouped into Upcoming and Past sections.
 */
@Composable
fun AlertsScreen(
    onNavigateToEditor: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: AlertsViewModel = hiltViewModel()
) {
    val alerts by viewModel.alerts.collectAsState()

    if (alerts.isEmpty()) {
        EmptyAlertsState(modifier)
    } else {
        val upcoming = alerts.filter { it.section == AlertSection.UPCOMING }
        val past = alerts.filter { it.section == AlertSection.PAST }

        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            // Upcoming section
            if (upcoming.isNotEmpty()) {
                item {
                    SectionHeader(title = "Upcoming", count = upcoming.size)
                }
                items(upcoming, key = { "${it.chitId}_${it.scheduledTime}" }) { alert ->
                    AlertItemCard(
                        alert = alert,
                        onTap = { onNavigateToEditor(alert.chitId) }
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
                        onTap = { onNavigateToEditor(alert.chitId) }
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                }
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

@Composable
private fun AlertItemCard(
    alert: ClassifiedAlert,
    onTap: () -> Unit
) {
    val timeFormatter = DateTimeFormatter.ofPattern("MMM d, h:mm a")

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onTap() },
        colors = CardDefaults.cardColors(
            containerColor = if (alert.section == AlertSection.UPCOMING)
                Color(0xFFF5E6D3) else Color(0xFFEDE0D0)
        )
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Alert type icon/label
            Text(
                text = when (alert.alertType) {
                    "alarm" -> "🔔"
                    "timer" -> "⏱"
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
private fun EmptyAlertsState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
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
