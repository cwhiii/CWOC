package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Data class representing a single day's release notes.
 */
data class ReleaseNoteEntry(
    val date: String,
    val content: String
)

/**
 * Bottom sheet showing release notes with Older/Newer day navigation.
 *
 * Fetches from GET /api/release-notes which returns:
 * { notes: [{date, content}, ...] } sorted newest-first.
 *
 * Accessible from Settings → Admin → Version section → "Release Notes" button.
 *
 * @param serverUrl The base server URL
 * @param authToken The auth token for API calls
 * @param onDismiss Callback when the sheet is dismissed
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReleaseNotesDialog(
    serverUrl: String,
    authToken: String,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val coroutineScope = rememberCoroutineScope()
    var notes by remember { mutableStateOf<List<ReleaseNoteEntry>>(emptyList()) }
    var currentIndex by remember { mutableIntStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Fetch release notes on first composition
    LaunchedEffect(Unit) {
        coroutineScope.launch {
            val result = fetchReleaseNotes(serverUrl, authToken)
            if (result != null) {
                notes = result
                errorMessage = null
            } else {
                errorMessage = "Failed to load release notes"
            }
            isLoading = false
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.background,
        contentColor = MaterialTheme.colorScheme.onBackground
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "📋 Release Notes",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close")
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            when {
                isLoading -> {
                    Text(
                        text = "Loading…",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                errorMessage != null -> {
                    Text(
                        text = errorMessage!!,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                notes.isEmpty() -> {
                    Text(
                        text = "No release notes available.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                else -> {
                    val currentNote = notes[currentIndex]

                    // Date header formatted nicely
                    Text(
                        text = formatReleaseNoteDate(currentNote.date),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Navigation row with Older/Newer buttons and counter
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Older button (go to next index = older)
                        TextButton(
                            onClick = { if (currentIndex < notes.size - 1) currentIndex++ },
                            enabled = currentIndex < notes.size - 1
                        ) {
                            Icon(
                                Icons.Default.ArrowBack, null,
                                modifier = Modifier.padding(end = 4.dp)
                            )
                            Text("Older")
                        }

                        // "{current} / {total}" counter
                        Text(
                            text = "${currentIndex + 1} / ${notes.size}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        // Newer button (go to previous index = newer)
                        TextButton(
                            onClick = { if (currentIndex > 0) currentIndex-- },
                            enabled = currentIndex > 0
                        ) {
                            Text("Newer")
                            Icon(
                                Icons.Default.ArrowForward, null,
                                modifier = Modifier.padding(start = 4.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Content (markdown rendered as plain text for now)
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f, fill = false)
                            .height(400.dp)
                            .verticalScroll(rememberScrollState())
                    ) {
                        MarkdownRenderer(
                            markdown = currentNote.content,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }
    }
}

/**
 * Fetches release notes from the server API.
 * Returns a list of ReleaseNoteEntry sorted newest-first, or null on failure.
 */
private suspend fun fetchReleaseNotes(
    serverUrl: String,
    authToken: String
): List<ReleaseNoteEntry>? = withContext(Dispatchers.IO) {
    try {
        val request = Request.Builder()
            .url("$serverUrl/api/release-notes")
            .addHeader("Authorization", "Bearer $authToken")
            .get()
            .build()

        val client = OkHttpClient()
        val response = client.newCall(request).execute()

        if (response.isSuccessful) {
            val body = response.body?.string() ?: return@withContext null
            // Parse { notes: [{date, content}, ...] }
            val parsed: Map<String, List<ReleaseNoteEntry>> = Gson().fromJson(
                body,
                object : TypeToken<Map<String, List<ReleaseNoteEntry>>>() {}.type
            )
            parsed["notes"]
        } else {
            null
        }
    } catch (_: Exception) {
        null
    }
}

/**
 * Formats a release note date string (YYYYMMDD) into a human-readable format.
 * e.g., "20250115" → "January 15, 2025"
 */
private fun formatReleaseNoteDate(dateStr: String): String {
    return try {
        if (dateStr.length == 8) {
            val year = dateStr.substring(0, 4).toInt()
            val month = dateStr.substring(4, 6).toInt()
            val day = dateStr.substring(6, 8).toInt()
            val monthName = when (month) {
                1 -> "January"; 2 -> "February"; 3 -> "March"
                4 -> "April"; 5 -> "May"; 6 -> "June"
                7 -> "July"; 8 -> "August"; 9 -> "September"
                10 -> "October"; 11 -> "November"; 12 -> "December"
                else -> "Unknown"
            }
            "$monthName $day, $year"
        } else {
            // If it's already a formatted date or different format, return as-is
            dateStr
        }
    } catch (_: Exception) {
        dateStr
    }
}
