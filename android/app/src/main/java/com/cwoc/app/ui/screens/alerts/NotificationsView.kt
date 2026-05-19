package com.cwoc.app.ui.screens.alerts

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.remote.NotificationDto
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Notifications mode view — displays server notifications split into
 * "📬 Unread" (status = "pending") and "📭 Addressed" (status != "pending") sections.
 *
 * Each notification card shows chit title, type info, dates, and action buttons.
 * Reminder notifications get Snooze/Dismiss; other types get Accept/Decline pill toggle.
 * Addressed cards render at 0.7 opacity with a status badge and Delete button.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14
 */
@Composable
fun NotificationsView(
    viewModel: AlertsViewModel,
    onNavigateToEditor: (String) -> Unit
) {
    val notifications by viewModel.notifications.collectAsState()
    val notificationError by viewModel.notificationError.collectAsState()
    val snoozeLength by viewModel.snoozeLength.collectAsState()
    val timeFormat by viewModel.timeFormat.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    var showClearConfirmDialog by remember { mutableStateOf(false) }

    // Show error toast when notificationError changes
    LaunchedEffect(notificationError) {
        notificationError?.let { error ->
            snackbarHostState.showSnackbar(error)
            viewModel.clearNotificationError()
        }
    }

    val unread = remember(notifications) {
        notifications
            .filter { it.status == "pending" }
            .sortedByDescending { it.createdDatetime }
    }

    val addressed = remember(notifications) {
        notifications
            .filter { it.status != "pending" }
            .sortedByDescending { it.createdDatetime }
    }

    val snoozeLengthMinutes = remember(snoozeLength) {
        snoozeLength.toIntOrNull() ?: 5
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (notifications.isEmpty()) {
            // Empty state
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No notifications.",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color(0xFF6B4E31)
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                // --- Unread section ---
                if (unread.isNotEmpty()) {
                    item {
                        SectionHeaderRow(
                            title = "📬 Unread",
                            count = unread.size
                        )
                    }
                    items(unread, key = { it.id }) { notification ->
                        NotificationCard(
                            notification = notification,
                            snoozeLengthMinutes = snoozeLengthMinutes,
                            timeFormat = timeFormat,
                            isAddressed = false,
                            onNavigateToEditor = onNavigateToEditor,
                            onAccept = { viewModel.acceptNotification(notification.id) },
                            onDecline = { viewModel.declineNotification(notification.id) },
                            onDismiss = { viewModel.dismissNotification(notification.id) },
                            onSnooze = { viewModel.snoozeNotification(notification.id, snoozeLengthMinutes) },
                            onDelete = { viewModel.deleteNotification(notification.id) }
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }

                // --- Addressed section ---
                if (addressed.isNotEmpty()) {
                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                        AddressedSectionHeader(
                            count = addressed.size,
                            onClearAddressed = { showClearConfirmDialog = true }
                        )
                    }
                    items(addressed, key = { it.id }) { notification ->
                        NotificationCard(
                            notification = notification,
                            snoozeLengthMinutes = snoozeLengthMinutes,
                            timeFormat = timeFormat,
                            isAddressed = true,
                            onNavigateToEditor = onNavigateToEditor,
                            onAccept = { viewModel.acceptNotification(notification.id) },
                            onDecline = { viewModel.declineNotification(notification.id) },
                            onDismiss = { viewModel.dismissNotification(notification.id) },
                            onSnooze = { viewModel.snoozeNotification(notification.id, snoozeLengthMinutes) },
                            onDelete = { viewModel.deleteNotification(notification.id) }
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
            }
        }

        // Snackbar for error toasts
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.align(Alignment.BottomCenter)
        )

        // Clear Addressed confirmation dialog
        if (showClearConfirmDialog) {
            AlertDialog(
                onDismissRequest = { showClearConfirmDialog = false },
                title = { Text("Clear Addressed") },
                text = { Text("Delete all addressed notifications? This cannot be undone.") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showClearConfirmDialog = false
                            viewModel.clearAddressed()
                        }
                    ) {
                        Text("Clear All", color = Color(0xFFB71C1C))
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showClearConfirmDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

/**
 * Section header with title and count.
 */
@Composable
private fun SectionHeaderRow(title: String, count: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            color = Color(0xFF6B4E31),
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "($count)",
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFF8B7355)
        )
    }
}

/**
 * Addressed section header with "Clear Addressed" button.
 */
@Composable
private fun AddressedSectionHeader(count: Int, onClearAddressed: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "📭 Addressed",
                style = MaterialTheme.typography.titleSmall,
                color = Color(0xFF6B4E31),
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "($count)",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF8B7355)
            )
        }
        TextButton(onClick = onClearAddressed) {
            Text(
                text = "Clear Addressed",
                color = Color(0xFFB71C1C),
                fontSize = 12.sp
            )
        }
    }
}

/**
 * Individual notification card.
 * Displays chit title, type info, dates, and action buttons based on notification type and status.
 */
@Composable
private fun NotificationCard(
    notification: NotificationDto,
    snoozeLengthMinutes: Int,
    timeFormat: String,
    isAddressed: Boolean,
    onNavigateToEditor: (String) -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onDismiss: () -> Unit,
    onSnooze: () -> Unit,
    onDelete: () -> Unit
) {
    val cardAlpha = if (isAddressed) 0.7f else 1f

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(cardAlpha),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFFFFAF0)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            // Top row: chit title + status badge (if addressed)
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Chit title (tappable if chit_id exists)
                val chitTitle = notification.chitTitle ?: "Untitled"
                if (!notification.chitId.isNullOrBlank()) {
                    Text(
                        text = chitTitle,
                        style = MaterialTheme.typography.bodyLarge.copy(
                            fontWeight = FontWeight.SemiBold,
                            textDecoration = TextDecoration.Underline
                        ),
                        color = Color(0xFF4A3520),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { onNavigateToEditor(notification.chitId) }
                    )
                } else {
                    Text(
                        text = chitTitle,
                        style = MaterialTheme.typography.bodyLarge.copy(
                            fontWeight = FontWeight.SemiBold
                        ),
                        color = Color(0xFF4A3520),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                }

                // Status badge for addressed notifications
                if (isAddressed && notification.status != null) {
                    Spacer(modifier = Modifier.width(8.dp))
                    StatusBadge(status = notification.status)
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Type info row
            val typeInfo = when (notification.notificationType) {
                "assigned" -> "Assigned by: ${notification.ownerDisplayName ?: "Unknown"}"
                "reminder" -> "${notification.deliveryTarget ?: "Mobile"} reminder"
                else -> notification.notificationType ?: ""
            }
            if (typeInfo.isNotBlank()) {
                Text(
                    text = typeInfo,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF6B4E31)
                )
                Spacer(modifier = Modifier.height(4.dp))
            }

            // Dates row
            Column {
                // Sent date
                notification.createdDatetime?.let { dateStr ->
                    val formatted = formatNotificationDate(dateStr, timeFormat)
                    Text(
                        text = "Sent: $formatted",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF8B7355)
                    )
                }
                // Due date
                notification.dueDatetime?.let { dateStr ->
                    val formatted = formatNotificationDate(dateStr, timeFormat)
                    Text(
                        text = "Due: $formatted",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF8B7355)
                    )
                }
                // Start date
                notification.startDatetime?.let { dateStr ->
                    val formatted = formatNotificationDate(dateStr, timeFormat)
                    Text(
                        text = "Start: $formatted",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF8B7355)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Action buttons row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                if (!isAddressed) {
                    // Unread card actions
                    if (notification.notificationType == "reminder" && notification.status == "pending") {
                        // Reminder with pending status: Snooze + Dismiss
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = onSnooze,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF8B7355)
                                ),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Text(
                                    text = "Snooze ${snoozeLengthMinutes}m",
                                    fontSize = 12.sp
                                )
                            }
                            Button(
                                onClick = onDismiss,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF6B4E31)
                                ),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Text(
                                    text = "Dismiss",
                                    fontSize = 12.sp
                                )
                            }
                        }
                    } else {
                        // Other notification types: Accept/Decline pill toggle
                        AcceptDeclinePill(
                            currentStatus = notification.status,
                            onAccept = onAccept,
                            onDecline = onDecline
                        )
                    }
                } else {
                    // Addressed card: Delete button
                    Spacer(modifier = Modifier.weight(1f))
                    TextButton(onClick = onDelete) {
                        Text(
                            text = "Delete",
                            color = Color(0xFFB71C1C),
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}

/**
 * Accept/Decline pill toggle.
 * Shows both options side by side with the current status visually indicated.
 */
@Composable
private fun AcceptDeclinePill(
    currentStatus: String?,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    val acceptSelected = currentStatus == "accepted"
    val declineSelected = currentStatus == "declined"

    Row(
        modifier = Modifier
            .background(
                color = Color(0xFFEDE0D4),
                shape = RoundedCornerShape(16.dp)
            )
            .padding(2.dp)
    ) {
        // Accept button
        Box(
            modifier = Modifier
                .background(
                    color = if (acceptSelected) Color(0xFF4A6741) else Color.Transparent,
                    shape = RoundedCornerShape(14.dp)
                )
                .clickable { onAccept() }
                .padding(horizontal = 12.dp, vertical = 6.dp)
        ) {
            Text(
                text = "Accept",
                fontSize = 12.sp,
                fontWeight = if (acceptSelected) FontWeight.Bold else FontWeight.Normal,
                color = if (acceptSelected) Color.White else Color(0xFF4A3520)
            )
        }

        // Decline button
        Box(
            modifier = Modifier
                .background(
                    color = if (declineSelected) Color(0xFFB71C1C) else Color.Transparent,
                    shape = RoundedCornerShape(14.dp)
                )
                .clickable { onDecline() }
                .padding(horizontal = 12.dp, vertical = 6.dp)
        ) {
            Text(
                text = "Decline",
                fontSize = 12.sp,
                fontWeight = if (declineSelected) FontWeight.Bold else FontWeight.Normal,
                color = if (declineSelected) Color.White else Color(0xFF4A3520)
            )
        }
    }
}

/**
 * Status badge for addressed notifications.
 * Shows the action taken (accepted, declined, dismissed, snoozed) with appropriate color.
 */
@Composable
private fun StatusBadge(status: String) {
    val (text, bgColor) = when (status) {
        "accepted" -> "Accepted" to Color(0xFF4A6741)
        "declined" -> "Declined" to Color(0xFFB71C1C)
        "dismissed" -> "Dismissed" to Color(0xFF6B4E31)
        "snoozed" -> "Snoozed" to Color(0xFF8B7355)
        else -> status.replaceFirstChar { it.uppercase() } to Color(0xFF8B7355)
    }

    Box(
        modifier = Modifier
            .background(
                color = bgColor,
                shape = RoundedCornerShape(12.dp)
            )
            .padding(horizontal = 8.dp, vertical = 2.dp)
    ) {
        Text(
            text = text,
            fontSize = 10.sp,
            color = Color.White,
            fontWeight = FontWeight.Medium
        )
    }
}

/**
 * Formats a notification date string for display, respecting the user's time_format setting.
 * "12" → "yyyy-MMM-dd hh:mm a", "24" → "yyyy-MMM-dd HH:mm"
 * Attempts ISO datetime parsing, falls back to showing the raw string.
 */
private fun formatNotificationDate(dateStr: String, timeFormat: String): String {
    val pattern = if (timeFormat == "24") "yyyy-MMM-dd HH:mm" else "yyyy-MMM-dd hh:mm a"
    return try {
        val dateTime = LocalDateTime.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        dateTime.format(DateTimeFormatter.ofPattern(pattern))
    } catch (_: Exception) {
        try {
            // Try parsing with offset
            val dateTime = LocalDateTime.parse(
                dateStr.substringBefore("+").substringBefore("Z"),
                DateTimeFormatter.ISO_LOCAL_DATE_TIME
            )
            dateTime.format(DateTimeFormatter.ofPattern(pattern))
        } catch (_: Exception) {
            dateStr
        }
    }
}
