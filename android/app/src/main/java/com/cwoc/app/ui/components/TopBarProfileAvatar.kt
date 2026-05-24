package com.cwoc.app.ui.components

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import com.cwoc.app.data.sync.SyncForegroundService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * A self-contained profile menu button for use in secondary screen TopAppBars.
 * Loads the current user's profile image from the server, falling back to initials.
 * Tapping opens a dropdown showing the user's display name, username, and full
 * menu actions (Switch User, View Profile, Logout, Notifications) — matching
 * the ProfileMenu on the main dashboard exactly.
 *
 * Usage: Drop into any TopAppBar's `actions` block:
 *   actions = { TopBarProfileAvatar() }
 *
 * Reads all user info from EncryptedSharedPreferences (same store as AuthRepository).
 * Handles logout internally by clearing prefs and restarting the Activity.
 * View Profile and Switch User navigate by restarting with intent extras.
 */
@Composable
fun TopBarProfileAvatar(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var expanded by remember { mutableStateOf(false) }

    // Read user info from EncryptedSharedPreferences (same store as AuthRepository)
    val securePrefs = try {
        val masterKeyAlias = androidx.security.crypto.MasterKeys.getOrCreate(
            androidx.security.crypto.MasterKeys.AES256_GCM_SPEC
        )
        androidx.security.crypto.EncryptedSharedPreferences.create(
            "cwoc_secure_prefs",
            masterKeyAlias,
            context,
            androidx.security.crypto.EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            androidx.security.crypto.EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (_: Exception) {
        null
    }

    val serverUrl = securePrefs?.getString("server_url", "")?.trimEnd('/') ?: ""
    val authToken = securePrefs?.getString("device_token", "") ?: ""
    val displayName = securePrefs?.getString("user_display_name", null)
    val username = securePrefs?.getString("user_username", null)
    val userId = securePrefs?.getString("user_id", null)
    val profileImagePath = securePrefs?.getString("user_profile_image_url", null)

    val imageUrl = if (profileImagePath != null && serverUrl.isNotEmpty()) {
        "$serverUrl$profileImagePath"
    } else null

    // Fetch notification count
    var notificationCount by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            try {
                if (serverUrl.isNotEmpty() && authToken.isNotEmpty()) {
                    val url = java.net.URL("$serverUrl/api/notifications?device=mobile")
                    val conn = url.openConnection() as java.net.HttpURLConnection
                    conn.setRequestProperty("Authorization", "Bearer $authToken")
                    conn.connectTimeout = 5000
                    conn.readTimeout = 5000
                    if (conn.responseCode == 200) {
                        val body = conn.inputStream.bufferedReader().readText()
                        // Count items with status "pending"
                        val count = "\"status\":\\s*\"pending\"".toRegex().findAll(body).count()
                        notificationCount = count
                    }
                    conn.disconnect()
                }
            } catch (_: Exception) {
                // Silently fail — notification count is non-critical
            }
        }
    }

    Box(modifier = modifier) {
        IconButton(onClick = { expanded = true }) {
            Box {
                val avatarSize = 32.dp

                if (imageUrl != null) {
                    SubcomposeAsyncImage(
                        model = ImageRequest.Builder(context)
                            .data(imageUrl)
                            .addHeader("Authorization", "Bearer $authToken")
                            .crossfade(true)
                            .build(),
                        contentDescription = "Profile",
                        modifier = Modifier
                            .size(avatarSize)
                            .clip(CircleShape)
                            .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape),
                        contentScale = ContentScale.Crop,
                        loading = {
                            AvatarInitialsCircle(displayName = displayName)
                        },
                        error = {
                            AvatarInitialsCircle(displayName = displayName)
                        }
                    )
                } else {
                    AvatarInitialsCircle(displayName = displayName)
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

        // Dropdown menu — matches ProfileMenu on main dashboard
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            // Header with display name and username
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

            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)

            // Switch User — restart activity to go to login
            DropdownMenuItem(
                text = { Text("🔄 Switch User") },
                onClick = {
                    expanded = false
                    // Stop the sync foreground service before clearing credentials
                    SyncForegroundService.stop(context)
                    // Clear token and restart to login
                    securePrefs?.edit()
                        ?.remove("device_token")
                        ?.remove("user_display_name")
                        ?.remove("user_username")
                        ?.remove("user_id")
                        ?.remove("user_profile_image_url")
                        ?.apply()
                    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                    intent?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                }
            )

            // View Profile — navigate to profile editor
            if (userId != null) {
                DropdownMenuItem(
                    text = { Text("👤 View Profile") },
                    onClick = {
                        expanded = false
                        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                        intent?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
                        intent?.putExtra("navigate_to", "profile/$userId")
                        context.startActivity(intent)
                    }
                )
            }

            // Logout
            DropdownMenuItem(
                text = { Text("🚪 Logout") },
                onClick = {
                    expanded = false
                    // Stop the sync foreground service before clearing credentials
                    SyncForegroundService.stop(context)
                    securePrefs?.edit()
                        ?.remove("device_token")
                        ?.remove("user_display_name")
                        ?.remove("user_username")
                        ?.remove("user_id")
                        ?.remove("user_profile_image_url")
                        ?.apply()
                    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                    intent?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                }
            )

            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)

            // Notifications
            DropdownMenuItem(
                text = {
                    Text(
                        text = "🔔 Notifications" + if (notificationCount > 0) " ($notificationCount)" else "",
                        fontWeight = FontWeight.Bold
                    )
                },
                onClick = {
                    expanded = false
                    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                    intent?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
                    intent?.putExtra("navigate_to", "notifications")
                    context.startActivity(intent)
                }
            )
        }
    }
}

@Composable
private fun AvatarInitialsCircle(displayName: String?) {
    Box(
        modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primaryContainer)
            .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape),
        contentAlignment = Alignment.Center
    ) {
        val initial = displayName?.firstOrNull()?.uppercase()
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
}
