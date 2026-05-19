package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.cwoc.app.data.remote.NotificationDto

/**
 * Profile menu button + dropdown for the top app bar.
 * Shows the user's avatar (or default icon) with a notification badge, and a dropdown with:
 * - Display name / username header
 * - Switch User option
 * - View Profile option
 * - Logout option
 * - Notifications section (with count and inline notification cards)
 *
 * Matches the web's cwoc-profile-menu behavior.
 */
@Composable
fun ProfileMenu(
    username: String?,
    displayName: String?,
    onLogout: () -> Unit,
    onSwitchUser: (() -> Unit)? = null,
    onViewProfile: (() -> Unit)? = null,
    onViewNotifications: (() -> Unit)? = null,
    notificationCount: Int = 0,
    notifications: List<NotificationDto> = emptyList(),
    onAcceptNotification: ((String) -> Unit)? = null,
    onDeclineNotification: ((String) -> Unit)? = null,
    onDismissNotification: ((String) -> Unit)? = null,
    onSnoozeNotification: ((String) -> Unit)? = null,
    onNavigateToChit: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    Box(modifier = modifier) {
        // Profile avatar button with notification badge
        IconButton(
            onClick = { expanded = true }
        ) {
            Box {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer)
                        .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    // Show first letter of display name, or default person icon
                    val initial = (displayName ?: username)?.firstOrNull()?.uppercase()
                    if (initial != null) {
                        Text(
                            text = initial,
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            fontWeight = FontWeight.Bold
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = "Profile",
                            tint = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                // Notification badge
                if (notificationCount > 0) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .offset(x = 2.dp, y = (-2).dp)
                            .size(16.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFC62828)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (notificationCount > 9) "9+" else notificationCount.toString(),
                            color = Color.White,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // Dropdown menu
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            // Header with user info
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text(
                    text = displayName ?: username ?: "User",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                if (username != null && username != displayName) {
                    Text(
                        text = "@$username",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 12.sp
                    )
                }
            }

            HorizontalDivider()

            // Switch User
            if (onSwitchUser != null) {
                DropdownMenuItem(
                    text = { Text("🔄 Switch User") },
                    onClick = {
                        expanded = false
                        onSwitchUser()
                    }
                )
            }

            // View Profile
            if (onViewProfile != null) {
                DropdownMenuItem(
                    text = { Text("👤 View Profile") },
                    onClick = {
                        expanded = false
                        onViewProfile()
                    }
                )
            }

            // Logout
            DropdownMenuItem(
                text = { Text("🚪 Logout") },
                onClick = {
                    expanded = false
                    onLogout()
                }
            )

            HorizontalDivider()

            // Notifications header — clickable to navigate to full notifications view
            DropdownMenuItem(
                text = {
                    Text(
                        text = "🔔 Notifications" + if (notificationCount > 0) " ($notificationCount)" else "",
                        fontWeight = FontWeight.Bold
                    )
                },
                onClick = {
                    expanded = false
                    onViewNotifications?.invoke()
                }
            )

            // Inline notification cards (show up to 5 pending)
            val pendingNotifs = notifications.filter { it.status == "pending" }.take(5)
            if (pendingNotifs.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 8.dp)
                ) {
                    pendingNotifs.forEach { notif ->
                        NotificationCard(
                            notification = notif,
                            onAccept = {
                                onAcceptNotification?.invoke(notif.id)
                            },
                            onDecline = {
                                onDeclineNotification?.invoke(notif.id)
                            },
                            onDismiss = {
                                onDismissNotification?.invoke(notif.id)
                            },
                            onSnooze = {
                                onSnoozeNotification?.invoke(notif.id)
                            },
                            onNavigateToChit = {
                                expanded = false
                                notif.chitId?.let { id -> onNavigateToChit?.invoke(id) }
                            }
                        )
                    }
                }
            }
        }
    }
}

/**
 * A single notification card within the profile dropdown.
 * Shows title, owner/type info, and action buttons (Accept/Decline or Snooze/Dismiss).
 */
@Composable
private fun NotificationCard(
    notification: NotificationDto,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onDismiss: () -> Unit,
    onSnooze: () -> Unit,
    onNavigateToChit: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        HorizontalDivider(color = Color(0x26896B43))

        Spacer(modifier = Modifier.height(4.dp))

        // Title — clickable to navigate to chit
        val titleText = if (notification.notificationType == "reminder") {
            "📌 ${notification.chitTitle ?: "Reminder"}"
        } else {
            notification.chitTitle ?: "(Untitled)"
        }
        Text(
            text = titleText,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF4A2C2A),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 2.dp)
                .then(
                    if (notification.chitId != null) {
                        Modifier.background(Color.Transparent)
                    } else Modifier
                )
        )

        // Owner / type info
        val ownerText = if (notification.notificationType == "reminder") {
            if (notification.deliveryTarget == "desktop") "Next Time On Desktop"
            else "${notification.deliveryTarget ?: ""} reminder"
        } else {
            val typeLabel = if (notification.notificationType == "assigned") "assigned by" else "from"
            "$typeLabel ${notification.ownerDisplayName ?: "Unknown"}"
        }
        Text(
            text = ownerText,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 11.sp
        )

        Spacer(modifier = Modifier.height(4.dp))

        // Action buttons
        Row {
            if (notification.notificationType == "reminder") {
                // Reminder: Snooze + Dismiss
                TextButton(
                    onClick = onSnooze,
                    modifier = Modifier.height(28.dp)
                ) {
                    Text("Snooze", fontSize = 11.sp)
                }
                Spacer(modifier = Modifier.width(4.dp))
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.height(28.dp)
                ) {
                    Text("Dismiss", fontSize = 11.sp)
                }
            } else {
                // Sharing: Accept / Decline
                TextButton(
                    onClick = onAccept,
                    modifier = Modifier.height(28.dp)
                ) {
                    Text("Accept", fontSize = 11.sp, color = Color(0xFF2E7D32))
                }
                Spacer(modifier = Modifier.width(4.dp))
                TextButton(
                    onClick = onDecline,
                    modifier = Modifier.height(28.dp)
                ) {
                    Text("Decline", fontSize = 11.sp, color = Color(0xFFC62828))
                }
            }
        }
    }
}
