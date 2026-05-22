package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest

/**
 * A small profile avatar for use in secondary screen TopAppBars.
 * Loads the current user's profile image from the server, falling back to initials.
 *
 * Usage: Drop into any TopAppBar's `actions` block:
 *   actions = { TopBarProfileAvatar() }
 *
 * Reads serverUrl, authToken, userId, and displayName from SharedPreferences.
 */
@Composable
fun TopBarProfileAvatar(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val prefs = context.getSharedPreferences("cwoc_prefs", android.content.Context.MODE_PRIVATE)
    val serverUrl = prefs.getString("server_url", "")?.trimEnd('/') ?: ""
    val authToken = prefs.getString("auth_token", "") ?: ""

    // Read user info from secure prefs (EncryptedSharedPreferences)
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

    val userId = securePrefs?.getString("user_id", null)
    val displayName = securePrefs?.getString("user_display_name", null)

    val imageUrl = if (userId != null && serverUrl.isNotEmpty()) {
        "$serverUrl/api/contacts/$userId/image"
    } else null

    Box(modifier = modifier.size(32.dp)) {
        if (imageUrl != null) {
            SubcomposeAsyncImage(
                model = ImageRequest.Builder(context)
                    .data(imageUrl)
                    .addHeader("Authorization", "Bearer $authToken")
                    .crossfade(true)
                    .build(),
                contentDescription = "Profile",
                modifier = Modifier
                    .size(32.dp)
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
