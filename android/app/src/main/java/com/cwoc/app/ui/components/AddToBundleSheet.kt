package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.remote.BundleDto
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocPrimary

/**
 * Match type for the add-to-bundle rule.
 * SENDER matches by the sender's email address.
 * SUBJECT matches by the email subject line.
 */
enum class MatchType(val apiValue: String, val displayLabel: String) {
    SENDER("sender", "By Sender"),
    SUBJECT("subject", "By Subject")
}

/**
 * ModalBottomSheet for adding an email to a bundle with match type selection.
 *
 * Shows:
 * - Email info (sender and subject for context)
 * - Match type radio group (Sender / Subject)
 * - Bundle picker list (excluding "Everything Else", sorted by display_order)
 * - Cancel / Add buttons
 *
 * On confirm, calls [onConfirm] with the selected bundle ID, bundle name, and match type.
 *
 * Validates: REQ-3 (Email Add-to-Bundle)
 *
 * @param senderEmail The sender's email address (for display and as match value for sender type)
 * @param subject The email subject (for display and as match value for subject type)
 * @param bundles Available bundles (already filtered and sorted)
 * @param currentBundleId The ID of the bundle the email is currently in (null if none)
 * @param onConfirm Callback with (bundleId, bundleName, matchType) when user confirms
 * @param onDismiss Callback when sheet is dismissed
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddToBundleSheet(
    senderEmail: String,
    subject: String,
    bundles: List<BundleDto>,
    currentBundleId: String?,
    onConfirm: (bundleId: String, bundleName: String, matchType: MatchType) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedMatchType by remember { mutableStateOf(MatchType.SENDER) }
    var selectedBundleId by remember { mutableStateOf<String?>(null) }

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
            // ─── Header ──────────────────────────────────────────────────
            Text(
                text = "Add to Bundle",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            // ─── Email Info ──────────────────────────────────────────────
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    .padding(12.dp)
            ) {
                Text(
                    text = "From: $senderEmail",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Subject: $subject",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(16.dp))
            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
            Spacer(modifier = Modifier.height(12.dp))

            // ─── Match Type Selection ────────────────────────────────────
            Text(
                text = "Match Rule",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            Text(
                text = "Future emails matching this rule will automatically go to the selected bundle.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            // Sender radio option
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { selectedMatchType = MatchType.SENDER }
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RadioButton(
                    selected = selectedMatchType == MatchType.SENDER,
                    onClick = { selectedMatchType = MatchType.SENDER }
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(
                        text = "By Sender",
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Text(
                        text = senderEmail,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // Subject radio option
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { selectedMatchType = MatchType.SUBJECT }
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RadioButton(
                    selected = selectedMatchType == MatchType.SUBJECT,
                    onClick = { selectedMatchType = MatchType.SUBJECT }
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(
                        text = "By Subject",
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Text(
                        text = subject,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
            Spacer(modifier = Modifier.height(12.dp))

            // ─── Bundle Picker ───────────────────────────────────────────
            Text(
                text = "Select Bundle",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            if (bundles.isEmpty()) {
                Text(
                    text = "No bundles available. Create a bundle first.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(bundles, key = { it.id }) { bundle ->
                        val isSelected = bundle.id == selectedBundleId
                        val isCurrent = bundle.id == currentBundleId

                        BundleRow(
                            bundle = bundle,
                            isSelected = isSelected,
                            isCurrent = isCurrent,
                            onClick = { selectedBundleId = bundle.id }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // ─── Action Buttons ──────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cancel")
                }
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = {
                        val bundleId = selectedBundleId ?: return@Button
                        val bundleName = bundles.find { it.id == bundleId }?.name ?: "Unnamed"
                        onConfirm(bundleId, bundleName, selectedMatchType)
                    },
                    enabled = selectedBundleId != null
                ) {
                    Text("Add")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

/**
 * A single row in the bundle picker list within AddToBundleSheet.
 * Shows bundle color indicator, name, and selection/current state.
 */
@Composable
private fun BundleRow(
    bundle: BundleDto,
    isSelected: Boolean,
    isCurrent: Boolean,
    onClick: () -> Unit
) {
    val backgroundColor = when {
        isSelected -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)
        isCurrent -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
        else -> Color.Transparent
    }

    val borderColor = when {
        isSelected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
        isCurrent -> MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
        else -> MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.2f)
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(backgroundColor)
            .border(1.dp, borderColor, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Bundle color indicator
        val bundleColor = bundle.color?.let { parseColorSafe(it) }
        if (bundleColor != null) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(bundleColor)
            )
            Spacer(modifier = Modifier.width(10.dp))
        } else {
            Icon(
                imageVector = Icons.Default.Folder,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(8.dp))
        }

        // Bundle name
        Text(
            text = bundle.name ?: "Unnamed",
            modifier = Modifier.weight(1f),
            fontWeight = if (isSelected || isCurrent) FontWeight.SemiBold else FontWeight.Normal,
            fontSize = 15.sp,
            color = MaterialTheme.colorScheme.onSurface
        )

        // Current bundle indicator
        if (isCurrent && !isSelected) {
            Text(
                text = "Current",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // Selection check mark
        if (isSelected) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = "Selected",
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.primary
            )
        }
    }
}

/**
 * Safely parse a color string (hex format like "#FF5733") to a Compose Color.
 * Returns null if parsing fails.
 */
private fun parseColorSafe(colorString: String): Color? {
    return try {
        val hex = colorString.removePrefix("#")
        val colorLong = when (hex.length) {
            6 -> (0xFF000000 or hex.toLong(16))
            8 -> hex.toLong(16)
            else -> return null
        }
        Color(colorLong.toInt())
    } catch (_: Exception) {
        null
    }
}
