package com.cwoc.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocPrimary
import androidx.compose.material3.Button

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val DangerRed = Color(0xFFB22222)

/**
 * Bottom sheet presenting recurrence-aware delete options for a recurring chit instance.
 *
 * Displays three delete options:
 * - "Delete this instance" — adds a broken_off exception for this date
 * - "Delete this and following" — sets recurrenceRule.until to day before this instance
 * - "Delete entire series" — soft-deletes the parent chit (with danger confirmation)
 *
 * Each action dismisses the sheet and executes the corresponding callback.
 * "Delete entire series" shows an additional danger confirmation dialog before proceeding.
 *
 * Validates: Requirement 10
 *
 * @param instanceDate The date string (YYYY-MM-DD) of the instance being deleted
 * @param onDismiss Callback when the sheet is dismissed without action
 * @param onDeleteThisInstance Callback to delete just this instance (broken_off exception)
 * @param onDeleteThisAndFollowing Callback to delete this and all following instances (set until)
 * @param onDeleteEntireSeries Callback to soft-delete the entire series parent
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecurrenceDeleteSheet(
    instanceDate: String,
    onDismiss: () -> Unit,
    onDeleteThisInstance: () -> Unit,
    onDeleteThisAndFollowing: () -> Unit,
    onDeleteEntireSeries: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showDeleteAllConfirm by remember { mutableStateOf(false) }

    // ─── Danger Confirmation Dialog for "Delete entire series" ───────────────
    if (showDeleteAllConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteAllConfirm = false },
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("Delete Entire Series?", style = CwocDialogDefaults.titleStyle) },
            text = {
                Text(
                    "This will permanently delete the entire recurring series " +
                        "including all past and future instances. This action cannot be undone."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteAllConfirm = false
                    onDismiss()
                    onDeleteEntireSeries()
                }, colors = CwocDialogDefaults.dangerButtonColors()) {
                    Text("Delete Series")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteAllConfirm = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        modifier = CwocDialogDefaults.borderModifier,
        containerColor = CwocDialogDefaults.containerColor,
        dragHandle = { BottomSheetDefaults.DragHandle(color = CwocPrimary) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // Header
            Text(
                text = "Delete Recurring Instance",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = ParchmentBrown
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "This chit is part of a recurring series. Choose how to delete:",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(16.dp))

            // ─── Delete This Instance ────────────────────────────────────────
            DeleteOptionRow(
                icon = "🗑️",
                label = "Delete this instance",
                description = "Remove only this occurrence from the series",
                onClick = {
                    onDismiss()
                    onDeleteThisInstance()
                }
            )

            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp, modifier = Modifier.padding(vertical = 4.dp))

            // ─── Delete This and Following ───────────────────────────────────
            DeleteOptionRow(
                icon = "✂️",
                label = "Delete this and following",
                description = "End the series before this instance",
                onClick = {
                    onDismiss()
                    onDeleteThisAndFollowing()
                }
            )

            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp, modifier = Modifier.padding(vertical = 4.dp))

            // ─── Delete Entire Series ────────────────────────────────────────
            DeleteOptionRow(
                icon = "⚠️",
                label = "Delete entire series",
                description = "Remove the entire recurring series",
                isDanger = true,
                onClick = {
                    showDeleteAllConfirm = true
                }
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Cancel button
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = androidx.compose.foundation.layout.Arrangement.Center
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cancel")
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

/**
 * A single option row in the RecurrenceDeleteSheet.
 */
@Composable
private fun DeleteOptionRow(
    icon: String,
    label: String,
    description: String,
    isDanger: Boolean = false,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = icon,
            fontSize = 24.sp,
            modifier = Modifier.padding(end = 4.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = if (isDanger) DangerRed else MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = if (isDanger) DangerRed.copy(alpha = 0.7f) else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
