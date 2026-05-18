package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * A dismissible banner displayed at the top of the Chit Editor when a sync conflict
 * was resolved on the server for that chit.
 *
 * Uses Material3 error-container colors to draw attention without being overly alarming.
 * Y1: "View in audit log" is now clickable.
 *
 * @param conflictFields Optional comma-separated field names that had conflicts
 * @param onDismiss Callback invoked when the user taps the dismiss (close) button
 * @param onViewAuditLog Callback when "View in audit log" is tapped (Y1)
 */
@Composable
fun ConflictBanner(
    conflictFields: String? = null,
    onDismiss: () -> Unit,
    onViewAuditLog: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.errorContainer)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = if (!conflictFields.isNullOrBlank()) {
                "⚠️ Sync conflict resolved ($conflictFields)"
            } else {
                "⚠️ Sync conflict resolved"
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onErrorContainer,
            modifier = Modifier.weight(1f)
        )
        // Y1: Clickable "View" button
        if (onViewAuditLog != null) {
            androidx.compose.material3.TextButton(onClick = onViewAuditLog) {
                Text("View", color = MaterialTheme.colorScheme.onErrorContainer)
            }
        }
        IconButton(onClick = onDismiss) {
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = "Dismiss conflict banner",
                tint = MaterialTheme.colorScheme.onErrorContainer
            )
        }
    }
}
