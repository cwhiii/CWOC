package com.cwoc.app.ui.screens.debug

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Debug screen showing database stats, sync status, and manual sync controls.
 */
@Composable
fun DebugScreen(
    viewModel: DebugViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val clipboardManager = LocalClipboardManager.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Debug Info",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        // Sync controls
        DebugCard(title = "Sync Controls") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { viewModel.syncNow() },
                    enabled = !uiState.isSyncing,
                    modifier = Modifier.weight(1f)
                ) {
                    if (uiState.isSyncing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Text("Sync Now")
                    }
                }
                OutlinedButton(
                    onClick = { viewModel.fullResync() },
                    enabled = !uiState.isSyncing,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Full Resync")
                }
            }
            uiState.lastSyncResult?.let { result ->
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = result,
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                    color = if (result.startsWith("Error") || result.startsWith("Network"))
                        MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.primary
                )
            }
        }

        // Copy all to clipboard
        OutlinedButton(
            onClick = {
                val text = buildString {
                    appendLine("=== CWOC Debug Info ===")
                    appendLine("Database: total=${uiState.totalChits}, tasks=${uiState.taskCount}, notes=${uiState.noteCount}, calendar=${uiState.calendarCount}")
                    appendLine("Sync: status=${uiState.syncStatus}, hwm=${uiState.highWaterMark}, lastSync=${uiState.lastSyncedAt}")
                    uiState.lastSyncResult?.let { appendLine("Last result: $it") }
                    if (uiState.sampleChits.isNotEmpty()) {
                        appendLine("Sample chits:")
                        uiState.sampleChits.forEach { (title, status) ->
                            appendLine("  ${title ?: "(no title)"} [status=${status ?: "null"}]")
                        }
                    }
                }
                clipboardManager.setText(AnnotatedString(text))
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Copy All to Clipboard")
        }

        // Database stats
        DebugCard(title = "Database") {
            DebugLine("Total chits in DB", uiState.totalChits.toString())
            DebugLine("Tasks (status != null)", uiState.taskCount.toString())
            DebugLine("Notes", uiState.noteCount.toString())
            DebugLine("Calendar", uiState.calendarCount.toString())
        }

        // Sync status
        DebugCard(title = "Sync") {
            DebugLine("Status", uiState.syncStatus ?: "unknown")
            DebugLine("High-water mark", uiState.highWaterMark?.toString() ?: "none")
            DebugLine("Last synced", uiState.lastSyncedAt ?: "never")
        }

        // Sample chit data
        if (uiState.sampleChits.isNotEmpty()) {
            DebugCard(title = "Sample Chits (first 5)") {
                uiState.sampleChits.forEach { (title, status) ->
                    DebugLine(title ?: "(no title)", "status=${status ?: "null"}")
                }
            }
        }

        if (uiState.isLoading) {
            CircularProgressIndicator()
        }
    }
}

@Composable
private fun DebugCard(title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun DebugLine(label: String, value: String) {
    Text(
        text = "$label: $value",
        style = MaterialTheme.typography.bodySmall,
        fontFamily = FontFamily.Monospace
    )
}
