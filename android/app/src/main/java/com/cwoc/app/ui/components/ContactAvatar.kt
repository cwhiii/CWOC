package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest

/**
 * Standardized contact avatar composable used across the app.
 * Displays a circular profile image when available, or falls back to
 * an initials circle with a deterministic color background.
 *
 * Used by: PeopleChipsRow, PeopleZone, EmailCard, ContactList.
 */
@Composable
fun ContactAvatar(
    imageUrl: String?,
    name: String,
    size: Dp = 24.dp,
    serverUrl: String,
    authToken: String,
    modifier: Modifier = Modifier
) {
    val fontSize = (size.value * 0.4f).sp

    if (imageUrl != null) {
        val fullUrl = if (imageUrl.startsWith("http")) imageUrl else "$serverUrl$imageUrl"

        SubcomposeAsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(fullUrl)
                .addHeader("Authorization", "Bearer $authToken")
                .crossfade(true)
                .build(),
            contentDescription = "$name avatar",
            modifier = modifier
                .size(size)
                .clip(CircleShape),
            contentScale = ContentScale.Crop,
            loading = {
                InitialsCircle(name = name, size = size, fontSize = fontSize)
            },
            error = {
                InitialsCircle(name = name, size = size, fontSize = fontSize)
            }
        )
    } else {
        InitialsCircle(
            name = name,
            size = size,
            fontSize = fontSize,
            modifier = modifier
        )
    }
}

/**
 * Fallback initials circle with a deterministic color derived from the contact name.
 */
@Composable
private fun InitialsCircle(
    name: String,
    size: Dp,
    fontSize: androidx.compose.ui.unit.TextUnit,
    modifier: Modifier = Modifier
) {
    val bgColor = avatarColorForName(name)
    val textColor = Color.White

    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(bgColor),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = name.firstOrNull()?.uppercase() ?: "?",
            color = textColor,
            fontSize = fontSize,
            style = MaterialTheme.typography.labelSmall
        )
    }
}

/**
 * Generates a deterministic avatar background color from the contact name hash.
 * Uses a 12-color palette that provides good visual variety and contrast with white text.
 */
private fun avatarColorForName(name: String): Color {
    val colors = listOf(
        Color(0xFF1565C0), // Blue
        Color(0xFF2E7D32), // Green
        Color(0xFF6A1B9A), // Purple
        Color(0xFFC62828), // Red
        Color(0xFFEF6C00), // Orange
        Color(0xFF00838F), // Cyan
        Color(0xFF4527A0), // Deep Purple
        Color(0xFF283593), // Indigo
        Color(0xFF558B2F), // Light Green
        Color(0xFF6D4C41), // Brown
        Color(0xFF00695C), // Teal
        Color(0xFFAD1457)  // Pink
    )
    val index = (name.hashCode().and(0x7FFFFFFF)) % colors.size
    return colors[index]
}
