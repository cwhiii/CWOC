package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/**
 * BB4: Multi-timezone clock modal.
 * Displays the current time in multiple configured timezones.
 * Equivalent to the web's clock modal (triggered by 'L' key).
 *
 * @param timezones List of IANA timezone IDs to display (from settings.activeClocks)
 * @param timeFormat "12h" or "24h"
 * @param onDismiss Callback when the modal is closed
 */
@Composable
fun ClockModal(
    timezones: List<String>,
    timeFormat: String = "12h",
    onDismiss: () -> Unit
) {
    val now = remember { ZonedDateTime.now() }
    val formatter = remember(timeFormat) {
        if (timeFormat == "24h") DateTimeFormatter.ofPattern("HH:mm:ss")
        else DateTimeFormatter.ofPattern("h:mm:ss a")
    }
    val dateFormatter = remember { DateTimeFormatter.ofPattern("EEE, MMM d") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("World Clocks", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (timezones.isEmpty()) {
                    Text(
                        text = "No clocks configured. Add timezones in Settings → World Clocks.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    timezones.forEach { tzId ->
                        val zoneTime = try {
                            now.withZoneSameInstant(ZoneId.of(tzId))
                        } catch (_: Exception) { null }

                        if (zoneTime != null) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = tzId.substringAfterLast("/").replace("_", " "),
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        text = zoneTime.format(dateFormatter),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Text(
                                    text = zoneTime.format(formatter),
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                            HorizontalDivider()
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        },
        containerColor = MaterialTheme.colorScheme.surface
    )
}
