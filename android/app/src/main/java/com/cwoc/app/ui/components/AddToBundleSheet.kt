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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.OutlinedTextField
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
 * Mode for the add-to-bundle action.
 * Matches the server's /api/bundles/{id}/drop-email modes.
 */
enum class BundleDropMode(val apiValue: String, val displayLabel: String) {
    MOVE_ONCE("move_once", "Just this once"),
    ALWAYS_SENDER("always_sender", "Always from this sender"),
    ALWAYS_SUBJECT("always_subject", "Always with this subject"),
    ALWAYS_RECIPIENT("always_recipient", "Always to this recipient")
}

/**
 * Result from the AddToBundleSheet when the user confirms.
 */
data class AddToBundleResult(
    val bundleId: String?,        // null if creating a new bundle
    val newBundleName: String?,   // non-null if creating a new bundle
    val mode: BundleDropMode,
    val matchValue: String,
    val applyRetroactively: Boolean
)

/**
 * Unified ModalBottomSheet for adding an email to a bundle.
 *
 * Features:
 * - 4 mode options (move once, always by sender/subject/recipient)
 * - Editable match value with wildcard support
 * - Bundle picker with "Create new bundle" option
 * - Retroactive checkbox
 *
 * @param senderEmail The sender's email address
 * @param subject The email subject
 * @param recipientEmail The recipient's email address
 * @param bundles Available bundles (already filtered and sorted)
 * @param currentBundleId The ID of the bundle the email is currently in (null if none)
 * @param preselectedBundleId Optional pre-selected bundle (from drag-drop)
 * @param onConfirm Callback with AddToBundleResult when user confirms
 * @param onDismiss Callback when sheet is dismissed
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddToBundleSheet(
    senderEmail: String,
    subject: String,
    recipientEmail: String = "",
    bundles: List<BundleDto>,
    currentBundleId: String?,
    preselectedBundleId: String? = null,
    onConfirm: (AddToBundleResult) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedMode by remember { mutableStateOf(BundleDropMode.MOVE_ONCE) }
    var matchValue by remember { mutableStateOf(senderEmail) }
    var applyRetroactively by remember { mutableStateOf(true) }
    var selectedBundleId by remember { mutableStateOf(preselectedBundleId) }
    var isCreatingNewBundle by remember { mutableStateOf(false) }
    var newBundleName by remember { mutableStateOf("") }

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
                text = if (preselectedBundleId != null) {
                    val name = bundles.find { it.id == preselectedBundleId }?.name ?: "Bundle"
                    "Move to $name"
                } else "Add Email to Bundle",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            // ─── Mode Selection ──────────────────────────────────────────
            BundleDropMode.entries.forEach { mode ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .clickable {
                            selectedMode = mode
                            when (mode) {
                                BundleDropMode.MOVE_ONCE -> applyRetroactively = false
                                BundleDropMode.ALWAYS_SENDER -> {
                                    matchValue = senderEmail
                                    applyRetroactively = true
                                }
                                BundleDropMode.ALWAYS_SUBJECT -> {
                                    matchValue = subject
                                    applyRetroactively = true
                                }
                                BundleDropMode.ALWAYS_RECIPIENT -> {
                                    matchValue = recipientEmail
                                    applyRetroactively = true
                                }
                            }
                        }
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(
                        selected = selectedMode == mode,
                        onClick = null // handled by row click
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = mode.displayLabel,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }

            // ─── Match Value Input (shown for "always" modes) ────────────
            if (selectedMode != BundleDropMode.MOVE_ONCE) {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = matchValue,
                    onValueChange = { matchValue = it },
                    label = { Text("Match value (use * as wildcard)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }

            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
            Spacer(modifier = Modifier.height(12.dp))

            // ─── Bundle Picker (only if no preselected bundle) ───────────
            if (preselectedBundleId == null) {
                Text(
                    text = "Target Bundle",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                val selectableBundles = bundles.filter {
                    it.isCatchAll != true && (it.displayOrder ?: 0) >= 0
                }

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(selectableBundles, key = { it.id }) { bundle ->
                        val isSelected = bundle.id == selectedBundleId && !isCreatingNewBundle
                        val isCurrent = bundle.id == currentBundleId

                        BundleRow(
                            bundle = bundle,
                            isSelected = isSelected,
                            isCurrent = isCurrent,
                            onClick = {
                                selectedBundleId = bundle.id
                                isCreatingNewBundle = false
                            }
                        )
                    }

                    // "Create new bundle" row
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (isCreatingNewBundle)
                                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)
                                    else Color.Transparent
                                )
                                .border(
                                    1.dp,
                                    if (isCreatingNewBundle)
                                        MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
                                    else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.2f),
                                    RoundedCornerShape(8.dp)
                                )
                                .clickable {
                                    isCreatingNewBundle = true
                                    selectedBundleId = null
                                }
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Create new bundle...",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }

                // New bundle name input
                if (isCreatingNewBundle) {
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = newBundleName,
                        onValueChange = { newBundleName = it },
                        label = { Text("New bundle name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))
            }

            // ─── Retroactive Checkbox ────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { applyRetroactively = !applyRetroactively }
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = applyRetroactively,
                    onCheckedChange = { applyRetroactively = it }
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Apply retroactively to existing emails",
                    style = MaterialTheme.typography.bodyMedium
                )
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
                        val result = AddToBundleResult(
                            bundleId = if (isCreatingNewBundle) null else selectedBundleId,
                            newBundleName = if (isCreatingNewBundle) newBundleName.trim() else null,
                            mode = selectedMode,
                            matchValue = matchValue.trim(),
                            applyRetroactively = applyRetroactively
                        )
                        onConfirm(result)
                    },
                    enabled = when {
                        preselectedBundleId != null -> true
                        isCreatingNewBundle -> newBundleName.isNotBlank()
                        else -> selectedBundleId != null
                    }
                ) {
                    Text(if (preselectedBundleId != null) "Move" else "Add to Bundle")
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
