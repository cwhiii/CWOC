package com.cwoc.app.ui.screens.email

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ErrorRed = Color(0xFFD32F2F)
private val SuccessGreen = Color(0xFF2E7D32)

/**
 * Displays one filter pill per configured email account.
 * Each pill shows the account nickname and reflects sync state:
 * - Active: full opacity, selected appearance
 * - Inactive: reduced opacity, unselected appearance
 * - Syncing: small CircularProgressIndicator as leading icon
 * - Error: red tint with warning icon prefix
 * - Success: green tint briefly
 *
 * Long-press shows tooltip with last sync time.
 * Tapping an error-state pill shows a detailed error dialog.
 *
 * Validates: Requirements 33.1-33.8
 */
@Composable
fun AccountFilterPills(
    accounts: List<EmailAccountInfo>,
    onToggleAccount: (String) -> Unit,
    onNavigateToEmailSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (accounts.isEmpty()) return

    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        accounts.forEach { account ->
            AccountPill(
                account = account,
                onToggle = { onToggleAccount(account.id) },
                onNavigateToEmailSettings = onNavigateToEmailSettings
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun AccountPill(
    account: EmailAccountInfo,
    onToggle: () -> Unit,
    onNavigateToEmailSettings: () -> Unit
) {
    val context = LocalContext.current
    var showTooltip by remember { mutableStateOf(false) }
    var showErrorDialog by remember { mutableStateOf(false) }

    // Animate success green tint briefly then fade back
    var showSuccessFlash by remember { mutableStateOf(false) }
    LaunchedEffect(account.syncState) {
        if (account.syncState == SyncState.SUCCESS) {
            showSuccessFlash = true
            delay(2000L)
            showSuccessFlash = false
        }
    }

    // Determine pill colors based on state
    val isError = account.syncState == SyncState.ERROR
    val isSuccess = showSuccessFlash && account.syncState == SyncState.SUCCESS
    val isSyncing = account.syncState == SyncState.SYNCING

    val containerColor by animateColorAsState(
        targetValue = when {
            isError -> ErrorRed.copy(alpha = 0.15f)
            isSuccess -> SuccessGreen.copy(alpha = 0.15f)
            account.isActive -> ParchmentBrown
            else -> Color.Transparent
        },
        animationSpec = tween(300),
        label = "pillContainerColor"
    )

    val labelColor by animateColorAsState(
        targetValue = when {
            isError -> ErrorRed
            isSuccess -> SuccessGreen
            account.isActive -> Color.White
            else -> ParchmentBrown
        },
        animationSpec = tween(300),
        label = "pillLabelColor"
    )

    val pillAlpha by animateFloatAsState(
        targetValue = if (account.isActive) 1f else 0.5f,
        animationSpec = tween(200),
        label = "pillAlpha"
    )

    FilterChip(
        selected = account.isActive,
        onClick = {
            if (isError) {
                showErrorDialog = true
            } else {
                onToggle()
            }
        },
        label = {
            Text(
                text = account.nickname,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        },
        modifier = Modifier
            .alpha(pillAlpha)
            .combinedClickable(
                onClick = {
                    if (isError) {
                        showErrorDialog = true
                    } else {
                        onToggle()
                    }
                },
                onLongClick = { showTooltip = true }
            ),
        leadingIcon = {
            when {
                isSyncing -> {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = if (account.isActive) Color.White else ParchmentBrown
                    )
                }
                isError -> {
                    Icon(
                        imageVector = Icons.Filled.Warning,
                        contentDescription = "Sync error",
                        modifier = Modifier.size(16.dp),
                        tint = ErrorRed
                    )
                }
            }
        },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = containerColor,
            selectedLabelColor = labelColor,
            containerColor = containerColor,
            labelColor = labelColor
        )
    )

    // Long-press tooltip showing last sync time
    if (showTooltip) {
        val tooltipText = if (account.lastSyncTime != null) {
            "Last check: ${account.lastSyncTime}"
        } else {
            "Never synced"
        }
        Toast.makeText(context, tooltipText, Toast.LENGTH_SHORT).show()
        showTooltip = false
    }

    // Error dialog with detailed error and action buttons
    if (showErrorDialog && account.error != null) {
        ErrorDetailDialog(
            accountNickname = account.nickname,
            errorMessage = account.error,
            onDismiss = { showErrorDialog = false },
            onNavigateToSettings = {
                showErrorDialog = false
                onNavigateToEmailSettings()
            },
            onCopyError = {
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = ClipData.newPlainText("Email Error", account.error)
                clipboard.setPrimaryClip(clip)
                Toast.makeText(context, "Error copied to clipboard", Toast.LENGTH_SHORT).show()
                showErrorDialog = false
            }
        )
    }
}

/**
 * Dialog showing detailed sync error with action buttons:
 * - "Email Settings" — navigates to email settings
 * - "Copy Error" — copies error text to clipboard
 * - "Dismiss" — closes the dialog
 */
@Composable
private fun ErrorDetailDialog(
    accountNickname: String,
    errorMessage: String,
    onDismiss: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onCopyError: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Filled.Warning,
                    contentDescription = null,
                    tint = ErrorRed,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Sync Error: $accountNickname",
                    style = MaterialTheme.typography.titleMedium
                )
            }
        },
        text = {
            Text(
                text = errorMessage,
                style = MaterialTheme.typography.bodyMedium
            )
        },
        confirmButton = {
            TextButton(onClick = onNavigateToSettings) {
                Text("Email Settings")
            }
        },
        dismissButton = {
            Row {
                TextButton(onClick = onCopyError) {
                    Text("Copy Error")
                }
                TextButton(onClick = onDismiss) {
                    Text("Dismiss")
                }
            }
        }
    )
}
