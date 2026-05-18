package com.cwoc.app.ui.screens.settings.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.cwoc.app.data.remote.CwocApiService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * Mode for the UpgradeModal dialog.
 */
enum class UpgradeModalMode {
    /** Shows Start button, connects to /api/update/run via SSE to stream upgrade logs. */
    UPGRADE,
    /** Hides Start button, fetches last upgrade log from /api/update/log. */
    VIEW_LOG
}

/**
 * A dialog for the server upgrade process with SSE log streaming.
 *
 * - Terminal-style scrollable log area (monospace font, dark background)
 * - Start button connects to `/api/update/run` via SSE and streams log lines
 * - Auto-scrolls as new lines arrive
 * - Copy button copies log text to clipboard
 * - Disable Start and Close during active upgrade, re-enable on completion/error
 * - VIEW_LOG mode: hide Start, fetch from `/api/update/log`, display in terminal area
 *
 * Validates: Requirements 28.4, 28.5, 28.6
 */
@Composable
fun UpgradeModal(
    mode: UpgradeModalMode,
    apiService: CwocApiService,
    onDismiss: () -> Unit
) {
    val clipboardManager = LocalClipboardManager.current
    val scope = rememberCoroutineScope()

    // Log lines state
    val logLines = remember { mutableStateListOf<String>() }
    val scrollState = rememberScrollState()

    // Upgrade state
    var isUpgrading by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var upgradeComplete by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Track the streaming job so we can cancel on dispose
    var streamJob by remember { mutableStateOf<Job?>(null) }

    // Auto-scroll when new lines arrive
    LaunchedEffect(logLines.size) {
        if (logLines.isNotEmpty()) {
            scrollState.animateScrollTo(scrollState.maxValue)
        }
    }

    // In VIEW_LOG mode, fetch the log on open
    LaunchedEffect(mode) {
        if (mode == UpgradeModalMode.VIEW_LOG) {
            isLoading = true
            try {
                val response = withContext(Dispatchers.IO) {
                    apiService.getUpdateLog()
                }
                if (response.isSuccessful) {
                    val body = response.body()
                    val logText = body?.log ?: ""
                    if (logText.isNotEmpty()) {
                        logLines.addAll(logText.lines())
                    } else if (body?.error != null) {
                        logLines.add("Error: ${body.error}")
                    } else {
                        logLines.add("No upgrade log available.")
                    }
                } else {
                    logLines.add("Failed to fetch log: HTTP ${response.code()}")
                }
            } catch (e: Exception) {
                logLines.add("Error fetching log: ${e.message ?: "Unknown error"}")
            } finally {
                isLoading = false
            }
        }
    }

    // Clean up streaming job on dispose
    DisposableEffect(Unit) {
        onDispose {
            streamJob?.cancel()
        }
    }

    /**
     * Start the upgrade by connecting to /api/update/run via SSE streaming.
     * Reads the ResponseBody line by line and appends to logLines.
     */
    fun startUpgrade() {
        isUpgrading = true
        upgradeComplete = false
        errorMessage = null
        logLines.clear()
        logLines.add("Starting upgrade...")

        streamJob = scope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    apiService.streamUpgrade()
                }

                if (!response.isSuccessful) {
                    logLines.add("Error: Server returned HTTP ${response.code()}")
                    isUpgrading = false
                    errorMessage = "Server returned HTTP ${response.code()}"
                    return@launch
                }

                val body = response.body()
                if (body == null) {
                    logLines.add("Error: Empty response body")
                    isUpgrading = false
                    errorMessage = "Empty response body"
                    return@launch
                }

                // Read the streaming response line by line
                withContext(Dispatchers.IO) {
                    val reader = BufferedReader(InputStreamReader(body.byteStream()))
                    try {
                        var line: String?
                        while (reader.readLine().also { line = it } != null && isActive) {
                            val currentLine = line ?: continue
                            // SSE format: lines starting with "data:" contain the payload
                            if (currentLine.startsWith("data:")) {
                                val data = currentLine.removePrefix("data:").trim()
                                if (data.isNotEmpty()) {
                                    withContext(Dispatchers.Main) {
                                        logLines.add(data)
                                    }
                                }
                            } else if (currentLine.isNotEmpty() && !currentLine.startsWith(":") && !currentLine.startsWith("event:") && !currentLine.startsWith("id:")) {
                                // Plain text lines (non-SSE format) — also display them
                                withContext(Dispatchers.Main) {
                                    logLines.add(currentLine)
                                }
                            }
                        }
                    } finally {
                        reader.close()
                        body.close()
                    }
                }

                // Stream completed successfully
                withContext(Dispatchers.Main) {
                    logLines.add("")
                    logLines.add("--- Upgrade complete ---")
                    isUpgrading = false
                    upgradeComplete = true
                }
            } catch (e: Exception) {
                if (isActive) {
                    withContext(Dispatchers.Main) {
                        val msg = e.message ?: "Unknown error"
                        logLines.add("")
                        logLines.add("--- Connection lost: $msg ---")
                        isUpgrading = false
                        errorMessage = msg
                    }
                }
            }
        }
    }

    // Determine title based on mode
    val title = when (mode) {
        UpgradeModalMode.UPGRADE -> "Upgrading Omni Chits"
        UpgradeModalMode.VIEW_LOG -> "Upgrade Log"
    }

    Dialog(
        onDismissRequest = {
            if (!isUpgrading) onDismiss()
        },
        properties = DialogProperties(
            dismissOnBackPress = !isUpgrading,
            dismissOnClickOutside = !isUpgrading,
            usePlatformDefaultWidth = false
        )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .padding(16.dp),
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 8.dp
        ) {
            Column(
                modifier = Modifier.padding(20.dp)
            ) {
                // Title
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Terminal-style log area
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 200.dp, max = 400.dp)
                        .background(
                            color = Color(0xFF1E1E1E),
                            shape = RoundedCornerShape(8.dp)
                        )
                        .padding(12.dp)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier
                                .size(24.dp)
                                .align(Alignment.Center),
                            color = Color(0xFF4EC9B0)
                        )
                    } else if (logLines.isEmpty()) {
                        Text(
                            text = if (mode == UpgradeModalMode.UPGRADE) {
                                "Press Start to begin the upgrade."
                            } else {
                                "No log data available."
                            },
                            color = Color(0xFF808080),
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp
                        )
                    } else {
                        Column(
                            modifier = Modifier.verticalScroll(scrollState)
                        ) {
                            logLines.forEach { line ->
                                Text(
                                    text = line,
                                    color = Color(0xFFD4D4D4),
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 12.sp,
                                    lineHeight = 16.sp
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Button row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Start button (only in UPGRADE mode)
                    if (mode == UpgradeModalMode.UPGRADE) {
                        Button(
                            onClick = { startUpgrade() },
                            enabled = !isUpgrading,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF6B4E31)
                            )
                        ) {
                            if (isUpgrading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Upgrading...")
                            } else {
                                Text("Start")
                            }
                        }
                    }

                    // Copy button
                    IconButton(
                        onClick = {
                            val text = logLines.joinToString("\n")
                            clipboardManager.setText(AnnotatedString(text))
                        },
                        enabled = logLines.isNotEmpty()
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "Copy log to clipboard",
                            tint = if (logLines.isNotEmpty()) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                            }
                        )
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    // Close button
                    OutlinedButton(
                        onClick = onDismiss,
                        enabled = !isUpgrading
                    ) {
                        Text("Close")
                    }
                }

                // Error message display
                errorMessage?.let { error ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "⚠️ $error",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}
