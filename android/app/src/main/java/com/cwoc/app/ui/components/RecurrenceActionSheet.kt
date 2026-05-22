package com.cwoc.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocPrimary

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)

/**
 * Bottom sheet presenting recurrence series actions for a recurring chit instance.
 *
 * Displays three action rows:
 * - "✅ Complete Series" — marks the entire series as complete
 * - "✂️ Break Off Instance" — breaks the current instance into a standalone chit
 * - "📊 View Series Summary" — scrolls to/expands the series summary section
 *
 * Each action dismisses the sheet and executes the corresponding callback.
 *
 * Validates: Requirement 9
 *
 * @param onDismiss Callback when the sheet is dismissed without action
 * @param onCompleteSeries Callback to complete the entire recurring series
 * @param onBreakOffInstance Callback to break off the current instance as standalone
 * @param onViewSeriesSummary Callback to scroll to/expand the series summary section
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecurrenceActionSheet(
    onDismiss: () -> Unit,
    onCompleteSeries: () -> Unit,
    onBreakOffInstance: () -> Unit,
    onViewSeriesSummary: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
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
                text = "Series Actions",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = ParchmentBrown
            )

            Spacer(modifier = Modifier.height(16.dp))

            // ─── Complete Series ─────────────────────────────────────────────
            ActionRow(
                icon = "✅",
                label = "Complete Series",
                description = "Mark the entire series as complete",
                onClick = {
                    onDismiss()
                    onCompleteSeries()
                }
            )

            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp, modifier = Modifier.padding(vertical = 4.dp))

            // ─── Break Off Instance ──────────────────────────────────────────
            ActionRow(
                icon = "✂️",
                label = "Break Off Instance",
                description = "Detach this instance as a standalone chit",
                onClick = {
                    onDismiss()
                    onBreakOffInstance()
                }
            )

            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp, modifier = Modifier.padding(vertical = 4.dp))

            // ─── View Series Summary ─────────────────────────────────────────
            ActionRow(
                icon = "📊",
                label = "View Series Summary",
                description = "See all instances and their status",
                onClick = {
                    onDismiss()
                    onViewSeriesSummary()
                }
            )

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

/**
 * A single action row in the RecurrenceActionSheet.
 */
@Composable
private fun ActionRow(
    icon: String,
    label: String,
    description: String,
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
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
