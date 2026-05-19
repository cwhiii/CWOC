package com.cwoc.app.ui.screens.email

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.remote.BundleDto

/**
 * Dialog that lists all available bundles and allows the user to select one
 * to assign an email to. Highlights the current bundle if the email is already
 * in one.
 *
 * On selection, calls [onSelectBundle] with the chosen bundle ID, which should
 * trigger the ViewModel to update the email's bundle assignment via the API.
 *
 * Validates: Requirements 15.2, 15.3, 15.4
 *
 * @param bundles All available bundles from the BundleViewModel.
 * @param currentBundleId The ID of the bundle the email is currently in (null if none).
 * @param onSelectBundle Callback when a bundle is selected — receives the bundle ID.
 * @param onDismiss Callback to close the dialog.
 */
@Composable
fun BundlePickerDialog(
    bundles: List<BundleDto>,
    currentBundleId: String?,
    onSelectBundle: (String) -> Unit,
    onDismiss: () -> Unit
) {
    // Filter out "Everything Else" bundle (catch-all, can't manually add to it)
    val selectableBundles = bundles.filter { it.name != "Everything Else" }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Add to Bundle",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
        },
        text = {
            if (selectableBundles.isEmpty()) {
                Text(
                    text = "No bundles available. Create a bundle first.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(selectableBundles, key = { it.id }) { bundle ->
                        val isCurrentBundle = bundle.id == currentBundleId
                        BundlePickerItem(
                            bundle = bundle,
                            isCurrentBundle = isCurrentBundle,
                            onClick = {
                                onSelectBundle(bundle.id)
                                onDismiss()
                            }
                        )
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

/**
 * A single row in the bundle picker list.
 * Shows the bundle name with an optional color indicator and a check mark
 * if this is the email's current bundle.
 */
@Composable
private fun BundlePickerItem(
    bundle: BundleDto,
    isCurrentBundle: Boolean,
    onClick: () -> Unit
) {
    val backgroundColor = if (isCurrentBundle) {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
    } else {
        Color.Transparent
    }

    val borderColor = if (isCurrentBundle) {
        MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
    } else {
        MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f)
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
            fontWeight = if (isCurrentBundle) FontWeight.SemiBold else FontWeight.Normal,
            fontSize = 15.sp,
            color = MaterialTheme.colorScheme.onSurface
        )

        // Check mark for current bundle
        if (isCurrentBundle) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = "Current bundle",
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
