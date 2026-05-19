package com.cwoc.app.ui.screens.alerts

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.local.entity.StandaloneAlertEntity
import com.cwoc.app.domain.alerts.StopwatchRuntime

/**
 * Displays an independent stopwatch card with:
 * - Editable name TextField (saves on focus loss)
 * - Delete button (❌)
 * - Elapsed time display in HH:MM:SS.cs format (monospace, updates every 50ms when running)
 * - Start/Pause toggle button
 * - Lap button (only active when running)
 * - Reset button
 * - Laps list below controls
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.10
 */
@Composable
fun IndependentStopwatchCard(
    alert: StandaloneAlertEntity,
    viewModel: AlertsViewModel,
    modifier: Modifier = Modifier
) {
    val runtime = remember(alert.id) {
        viewModel.getOrCreateStopwatchRuntime(alert.id)
    }
    val stopwatchState by runtime.state.collectAsState()

    // Local name state for the editable TextField
    var nameText by remember(alert.id) { mutableStateOf(alert.name ?: "") }

    // Update local name if the entity changes externally
    LaunchedEffect(alert.name) {
        nameText = alert.name ?: ""
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            // --- Header row: Name field + Delete button ---
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = nameText,
                    onValueChange = { nameText = it },
                    placeholder = { Text("Stopwatch name") },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier
                        .weight(1f)
                        .onFocusChanged { focusState ->
                            if (!focusState.isFocused && nameText != (alert.name ?: "")) {
                                viewModel.updateStandaloneAlert(
                                    alert.id,
                                    mapOf("name" to nameText)
                                )
                            }
                        }
                )

                Spacer(modifier = Modifier.width(8.dp))

                // Delete button
                TextButton(
                    onClick = {
                        viewModel.deleteStandaloneAlert(alert.id)
                    },
                    modifier = Modifier.size(40.dp)
                ) {
                    Text("❌", fontSize = 16.sp)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // --- Elapsed time display (monospace) ---
            Text(
                text = StopwatchRuntime.formatElapsed(stopwatchState.elapsedMs),
                style = TextStyle(
                    fontFamily = FontFamily.Monospace,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                ),
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(12.dp))

            // --- Controls row: Start/Pause, Lap, Reset ---
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)
            ) {
                // Start/Pause toggle button
                Button(
                    onClick = {
                        if (stopwatchState.isRunning) {
                            runtime.pause()
                        } else {
                            runtime.start()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (stopwatchState.isRunning)
                            MaterialTheme.colorScheme.secondary
                        else
                            MaterialTheme.colorScheme.primary
                    )
                ) {
                    Text(
                        text = if (stopwatchState.isRunning) "⏸ Pause" else "▶ Start"
                    )
                }

                // Lap button (only active when running)
                OutlinedButton(
                    onClick = { runtime.lap() },
                    enabled = stopwatchState.isRunning
                ) {
                    Text("Lap")
                }

                // Reset button
                OutlinedButton(
                    onClick = { runtime.reset() }
                ) {
                    Text("Reset")
                }
            }

            // --- Laps list ---
            if (stopwatchState.laps.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))

                Column(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    stopwatchState.laps.forEach { lap ->
                        Text(
                            text = lap,
                            style = TextStyle(
                                fontFamily = FontFamily.Monospace,
                                fontSize = 14.sp
                            ),
                            modifier = Modifier.padding(vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}
