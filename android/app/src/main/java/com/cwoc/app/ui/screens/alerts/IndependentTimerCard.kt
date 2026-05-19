package com.cwoc.app.ui.screens.alerts

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.local.entity.StandaloneAlertEntity
import com.cwoc.app.domain.alerts.TimerState
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Full implementation of IndependentTimerCard — displays a countdown timer with
 * duration input, progress bar, loop toggle, and start/pause/reset controls.
 *
 * States:
 * - Stopped/Reset: shows HH:MM:SS number input fields for setting duration
 * - Running: shows horizontal progress bar with remaining time text, tapping pauses
 * - Done: shows "✓ DONE" text on progress bar
 * - Paused: shows progress bar with frozen value; tapping shows duration inputs
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 5.16
 */
@Composable
fun IndependentTimerCard(
    alert: StandaloneAlertEntity,
    viewModel: AlertsViewModel,
    modifier: Modifier = Modifier
) {
    // Parse data JSON to get totalSeconds and loop
    val gson = remember { Gson() }
    val dataMap: Map<String, Any?> = remember(alert.data) {
        try {
            val type = object : TypeToken<Map<String, Any?>>() {}.type
            gson.fromJson(alert.data, type) ?: emptyMap()
        } catch (_: Exception) {
            emptyMap()
        }
    }

    val savedTotalSeconds = remember(dataMap) {
        when (val ts = dataMap["totalSeconds"]) {
            is Number -> ts.toLong()
            else -> 0L
        }
    }
    val savedLoop = remember(dataMap) {
        (dataMap["loop"] as? Boolean) ?: false
    }

    // Get or create the timer runtime for this alert
    val runtime = remember(alert.id) { viewModel.getOrCreateTimerRuntime(alert.id) }
    val timerState by runtime.state.collectAsState()

    // Initialize runtime from saved data if it hasn't been set yet (totalMs == 0 and not running)
    LaunchedEffect(alert.id, savedTotalSeconds) {
        if (timerState.totalMs == 0L && !timerState.isRunning && !timerState.isDone && savedTotalSeconds > 0L) {
            val h = (savedTotalSeconds / 3600).toInt()
            val m = ((savedTotalSeconds % 3600) / 60).toInt()
            val s = (savedTotalSeconds % 60).toInt()
            runtime.setDuration(h, m, s)
        }
    }

    // Initialize loop from saved data
    LaunchedEffect(alert.id, savedLoop) {
        runtime.loop = savedLoop
    }

    // Local state for name editing
    var nameText by remember(alert.name) { mutableStateOf(alert.name ?: "") }
    var loopChecked by remember(savedLoop) { mutableStateOf(savedLoop) }

    // Track whether paused bar was tapped to show duration inputs
    var showDurationInputsWhilePaused by remember { mutableStateOf(false) }

    // Reset showDurationInputsWhilePaused when timer starts running again
    LaunchedEffect(timerState.isRunning) {
        if (timerState.isRunning) {
            showDurationInputsWhilePaused = false
        }
    }

    // Determine display mode
    val isStopped = !timerState.isRunning && !timerState.isDone && timerState.remainingMs == timerState.totalMs
    val isPaused = !timerState.isRunning && !timerState.isDone && timerState.remainingMs < timerState.totalMs && timerState.totalMs > 0L
    val isRunning = timerState.isRunning
    val isDone = timerState.isDone

    // Should we show duration inputs?
    val showDurationInputs = isStopped || (isPaused && showDurationInputsWhilePaused)

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            // Top row: name field, loop checkbox, delete button
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Editable name
                OutlinedTextField(
                    value = nameText,
                    onValueChange = { nameText = it },
                    placeholder = { Text("Timer name") },
                    singleLine = true,
                    modifier = Modifier
                        .weight(1f)
                        .onFocusChanged { focusState ->
                            if (!focusState.isFocused && nameText != (alert.name ?: "")) {
                                viewModel.updateStandaloneAlert(
                                    alert.id,
                                    mapOf("name" to nameText)
                                )
                            }
                        },
                    textStyle = MaterialTheme.typography.bodyMedium
                )

                Spacer(modifier = Modifier.width(8.dp))

                // Loop checkbox
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable {
                        loopChecked = !loopChecked
                        runtime.loop = loopChecked
                        viewModel.updateStandaloneAlert(
                            alert.id,
                            mapOf("loop" to loopChecked)
                        )
                    }
                ) {
                    Checkbox(
                        checked = loopChecked,
                        onCheckedChange = { checked ->
                            loopChecked = checked
                            runtime.loop = checked
                            viewModel.updateStandaloneAlert(
                                alert.id,
                                mapOf("loop" to checked)
                            )
                        }
                    )
                    Text("🔁", fontSize = 16.sp)
                }

                Spacer(modifier = Modifier.width(4.dp))

                // Delete button
                TextButton(onClick = { viewModel.deleteStandaloneAlert(alert.id) }) {
                    Text("❌", fontSize = 16.sp)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Duration inputs or progress bar
            if (showDurationInputs) {
                DurationInputRow(
                    timerState = timerState,
                    onDurationChanged = { h, m, s ->
                        runtime.setDuration(h, m, s)
                        // Save to server
                        val totalSec = (h * 3600L) + (m * 60L) + s
                        viewModel.updateStandaloneAlert(
                            alert.id,
                            mapOf("totalSeconds" to totalSec)
                        )
                    }
                )
            } else if (isRunning || (isPaused && !showDurationInputsWhilePaused)) {
                // Progress bar (tappable)
                TimerProgressBar(
                    timerState = timerState,
                    onClick = {
                        if (isRunning) {
                            // Tapping running bar pauses timer
                            runtime.pause()
                        } else if (isPaused) {
                            // Tapping paused bar shows duration inputs
                            showDurationInputsWhilePaused = true
                        }
                    }
                )
            } else if (isDone) {
                // Done state: show "✓ DONE" on progress bar
                TimerDoneBar()
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Control buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (isRunning) {
                    // Pause button
                    Button(
                        onClick = { runtime.pause() },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("⏸ Pause")
                    }
                } else if (!isDone) {
                    // Start button (disabled if duration is 0)
                    Button(
                        onClick = { runtime.start() },
                        enabled = timerState.totalMs > 0L,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("▶ Start")
                    }
                }

                // Reset button (always available unless done)
                if (!isDone) {
                    Button(
                        onClick = {
                            runtime.reset()
                            showDurationInputsWhilePaused = false
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.secondaryContainer,
                            contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    ) {
                        Text("↺ Reset")
                    }
                }
            }
        }
    }
}

/**
 * Row of HH:MM:SS number input fields for setting timer duration.
 * HH >= 0, MM 0-59, SS 0-59.
 */
@Composable
private fun DurationInputRow(
    timerState: TimerState,
    onDurationChanged: (Int, Int, Int) -> Unit
) {
    // Derive initial values from timerState.totalMs
    val totalSec = timerState.totalMs / 1000L
    var hours by remember(totalSec) { mutableStateOf(((totalSec / 3600)).toInt().toString()) }
    var minutes by remember(totalSec) { mutableStateOf(((totalSec % 3600) / 60).toInt().toString()) }
    var seconds by remember(totalSec) { mutableStateOf((totalSec % 60).toInt().toString()) }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Hours
        OutlinedTextField(
            value = hours,
            onValueChange = { value ->
                val filtered = value.filter { it.isDigit() }
                hours = filtered
                notifyDurationChange(filtered, minutes, seconds, onDurationChanged)
            },
            label = { Text("HH") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            modifier = Modifier.width(70.dp),
            textStyle = MaterialTheme.typography.bodyLarge.copy(textAlign = TextAlign.Center)
        )

        Text(":", fontSize = 20.sp, modifier = Modifier.padding(horizontal = 4.dp))

        // Minutes
        OutlinedTextField(
            value = minutes,
            onValueChange = { value ->
                val filtered = value.filter { it.isDigit() }
                val clamped = filtered.toIntOrNull()?.coerceIn(0, 59)?.toString() ?: filtered
                minutes = clamped
                notifyDurationChange(hours, clamped, seconds, onDurationChanged)
            },
            label = { Text("MM") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            modifier = Modifier.width(70.dp),
            textStyle = MaterialTheme.typography.bodyLarge.copy(textAlign = TextAlign.Center)
        )

        Text(":", fontSize = 20.sp, modifier = Modifier.padding(horizontal = 4.dp))

        // Seconds
        OutlinedTextField(
            value = seconds,
            onValueChange = { value ->
                val filtered = value.filter { it.isDigit() }
                val clamped = filtered.toIntOrNull()?.coerceIn(0, 59)?.toString() ?: filtered
                seconds = clamped
                notifyDurationChange(hours, minutes, clamped, onDurationChanged)
            },
            label = { Text("SS") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            modifier = Modifier.width(70.dp),
            textStyle = MaterialTheme.typography.bodyLarge.copy(textAlign = TextAlign.Center)
        )
    }
}

/**
 * Helper to parse and notify duration changes.
 */
private fun notifyDurationChange(
    hoursStr: String,
    minutesStr: String,
    secondsStr: String,
    onDurationChanged: (Int, Int, Int) -> Unit
) {
    val h = hoursStr.toIntOrNull()?.coerceAtLeast(0) ?: 0
    val m = minutesStr.toIntOrNull()?.coerceIn(0, 59) ?: 0
    val s = secondsStr.toIntOrNull()?.coerceIn(0, 59) ?: 0
    onDurationChanged(h, m, s)
}

/**
 * Horizontal progress bar showing remaining/total percentage and time text.
 * Tappable to pause (when running) or show duration inputs (when paused).
 */
@Composable
private fun TimerProgressBar(
    timerState: TimerState,
    onClick: () -> Unit
) {
    val progress = if (timerState.totalMs > 0L) {
        timerState.remainingMs.toFloat() / timerState.totalMs.toFloat()
    } else {
        0f
    }

    val timeText = formatRemainingTime(timerState.remainingMs)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 4.dp)
    ) {
        Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(28.dp),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )
            Text(
                text = timeText,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.Bold
                ),
                color = if (progress > 0.5f) Color.White else MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

/**
 * Progress bar showing "✓ DONE" when timer completes.
 */
@Composable
private fun TimerDoneBar() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        LinearProgressIndicator(
            progress = { 1f },
            modifier = Modifier
                .fillMaxWidth()
                .height(28.dp),
            color = Color(0xFF4CAF50),
            trackColor = Color(0xFF4CAF50)
        )
        Text(
            text = "✓ DONE",
            style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = FontWeight.Bold
            ),
            color = Color.White
        )
    }
}

/**
 * Formats remaining milliseconds as HH:MM:SS or HH:MM:SS.T (tenths) when < 10 seconds.
 */
private fun formatRemainingTime(remainingMs: Long): String {
    val totalSeconds = remainingMs / 1000L
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60

    return if (remainingMs < 10_000L) {
        // Show tenths of a second when < 10 seconds
        val tenths = (remainingMs % 1000L) / 100L
        "%02d:%02d:%02d.%d".format(hours, minutes, seconds, tenths)
    } else {
        "%02d:%02d:%02d".format(hours, minutes, seconds)
    }
}
