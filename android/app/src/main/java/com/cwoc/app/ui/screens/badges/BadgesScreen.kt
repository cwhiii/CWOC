package com.cwoc.app.ui.screens.badges

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.BadgeEntity
import com.cwoc.app.ui.components.CwocPagePanel
import com.cwoc.app.ui.components.TopBarProfileAvatar
import com.cwoc.app.ui.theme.CwocButtonDefaults
import com.cwoc.app.ui.theme.CwocAgedBrownDark
import com.cwoc.app.ui.theme.CwocGoldDivider
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

// ─── Category Definitions ───────────────────────────────────────────────────────

private data class BadgeCategory(
    val key: String,
    val emoji: String,
    val displayName: String
)

private val BADGE_CATEGORIES = listOf(
    BadgeCategory("Package", "📦", "Package"),
    BadgeCategory("Flight", "✈️", "Flight"),
    BadgeCategory("Hotel", "🏨", "Hotel"),
    BadgeCategory("Rental", "🚗", "Rental"),
    BadgeCategory("Event", "🎫", "Event"),
    BadgeCategory("Restaurant", "🍽️", "Restaurant"),
    BadgeCategory("Transit", "🚌", "Transit"),
    BadgeCategory("Order", "📋", "Order")
)

// ─── Main Screen ────────────────────────────────────────────────────────────────

/**
 * Badges screen displaying all active and recently-completed smart link detections
 * organized by category. Supports pull-to-refresh, offline banner, dismiss actions,
 * opening external URLs, and navigating to the source chit editor.
 *
 * Validates: Requirements 8.1, 8.3, 8.4, 8.5, 8.6, 8.7, 10.1, 10.2, 10.3, 10.4
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BadgesScreen(
    onNavigateBack: () -> Unit,
    onNavigateToEditor: (String) -> Unit,
    viewModel: BadgesViewModel = hiltViewModel()
) {
    val badges by viewModel.badges.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val isOffline by viewModel.isOffline.collectAsState()
    val use24HourTime by viewModel.use24HourTime.collectAsState()
    val error by viewModel.error.collectAsState()

    val pullToRefreshState = rememberPullToRefreshState()

    if (pullToRefreshState.isRefreshing) {
        LaunchedEffect(true) {
            viewModel.refresh()
        }
    }

    LaunchedEffect(isRefreshing) {
        if (!isRefreshing && pullToRefreshState.isRefreshing) {
            pullToRefreshState.endRefresh()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("🛡️ Badges") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    TopBarProfileAvatar()
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { innerPadding ->
        CwocPagePanel(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .nestedScroll(pullToRefreshState.nestedScrollConnection)
            ) {
                when {
                    isLoading && badges.isEmpty() -> {
                        BadgesLoadingState()
                    }
                    error != null && badges.isEmpty() -> {
                        BadgesErrorState(
                            errorMessage = error!!,
                            onRetry = { viewModel.refresh() }
                        )
                    }
                    else -> {
                        BadgesContent(
                            badges = badges,
                            isOffline = isOffline,
                            use24HourTime = use24HourTime,
                            onDismiss = { badgeId -> viewModel.dismiss(badgeId) },
                            onNavigateToEditor = onNavigateToEditor
                        )
                    }
                }

                PullToRefreshContainer(
                    state = pullToRefreshState,
                    modifier = Modifier.align(Alignment.TopCenter)
                )
            }
        }
    }
}

// ─── Content ────────────────────────────────────────────────────────────────────

@Composable
private fun BadgesContent(
    badges: List<BadgeEntity>,
    isOffline: Boolean,
    use24HourTime: Boolean,
    onDismiss: (String) -> Unit,
    onNavigateToEditor: (String) -> Unit
) {
    val activeBadges = badges.filter { it.status == "active" }
    val completedBadges = badges.filter { it.status == "completed" || it.status == "dismissed" }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Offline banner
        if (isOffline) {
            item(key = "offline_banner") {
                OfflineBanner()
            }
        }

        // Active badge category sections
        BADGE_CATEGORIES.forEach { category ->
            val categoryBadges = activeBadges
                .filter { it.category == category.key }
                .sortedByDescending { it.lastUpdatedAt }

            item(key = "header_${category.key}") {
                CategoryHeader(category = category)
            }

            if (categoryBadges.isEmpty()) {
                item(key = "empty_${category.key}") {
                    EmptyCategoryMessage(categoryName = category.displayName)
                }
            } else {
                items(
                    items = categoryBadges,
                    key = { "badge_${it.id}" }
                ) { badge ->
                    BadgeCard(
                        badge = badge,
                        use24HourTime = use24HourTime,
                        onDismiss = { onDismiss(badge.id) },
                        onNavigateToEditor = { onNavigateToEditor(badge.chitId) }
                    )
                }
            }
        }

        // Recently Completed section
        if (completedBadges.isNotEmpty()) {
            item(key = "completed_header") {
                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = CwocGoldDivider, thickness = 1.dp)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Recently Completed",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = CwocZoneHeaderBrown,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }

            items(
                items = completedBadges.sortedByDescending { it.completedAt ?: it.lastUpdatedAt },
                key = { "completed_${it.id}" }
            ) { badge ->
                BadgeCard(
                    badge = badge,
                    use24HourTime = use24HourTime,
                    onDismiss = null, // No dismiss for already-completed badges
                    onNavigateToEditor = { onNavigateToEditor(badge.chitId) },
                    isCompleted = true
                )
            }
        }

        // Bottom spacing
        item(key = "bottom_spacer") {
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

// ─── Category Header ────────────────────────────────────────────────────────────

@Composable
private fun CategoryHeader(category: BadgeCategory) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "${category.emoji} ${category.displayName}",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = CwocZoneHeaderBrown
        )
        Spacer(modifier = Modifier.width(8.dp))
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = CwocGoldDivider,
            thickness = 1.dp
        )
    }
}

// ─── Empty Category Message ─────────────────────────────────────────────────────

@Composable
private fun EmptyCategoryMessage(categoryName: String) {
    Text(
        text = "No active ${categoryName.lowercase()}",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        fontStyle = FontStyle.Italic,
        modifier = Modifier.padding(start = 16.dp, top = 2.dp, bottom = 4.dp)
    )
}

// ─── Badge Card ─────────────────────────────────────────────────────────────────

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BadgeCard(
    badge: BadgeEntity,
    use24HourTime: Boolean,
    onDismiss: (() -> Unit)?,
    onNavigateToEditor: () -> Unit,
    isCompleted: Boolean = false
) {
    val context = LocalContext.current

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isCompleted)
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
            else
                MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            // Row 1: Provider icon + name + staleness + dismiss
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Provider icon (emoji based on category)
                val categoryEmoji = BADGE_CATEGORIES.find { it.key == badge.category }?.emoji ?: "🔗"
                Text(
                    text = categoryEmoji,
                    fontSize = 20.sp
                )

                Spacer(modifier = Modifier.width(8.dp))

                // Provider name
                Text(
                    text = badge.providerName,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = CwocAgedBrownDark,
                    modifier = Modifier.weight(1f)
                )

                // Staleness indicator
                StalenessIndicator(
                    lastUpdatedAt = badge.lastUpdatedAt,
                    use24HourTime = use24HourTime
                )

                // Dismiss button
                if (onDismiss != null) {
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Dismiss",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            // Row 2: Code
            Text(
                text = badge.code,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 2.dp)
            )

            // Row 3: Last email subject
            if (!badge.lastEmailSubject.isNullOrBlank()) {
                Text(
                    text = "\"${badge.lastEmailSubject}\"",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontStyle = FontStyle.Italic,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }

            // Row 4: Status indicator for completed badges
            if (isCompleted) {
                val statusText = if (badge.status == "dismissed") "Dismissed" else "Completed"
                val statusColor = if (badge.status == "dismissed")
                    MaterialTheme.colorScheme.onSurfaceVariant
                else
                    Color(0xFF4A6741) // muted green
                Text(
                    text = "✓ $statusText",
                    style = MaterialTheme.typography.labelSmall,
                    color = statusColor,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Row 5: Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Action button — opens URL in browser
                Button(
                    onClick = {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(badge.url))
                            context.startActivity(intent)
                        } catch (e: Exception) {
                            Toast.makeText(context, "Unable to open link", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = CwocButtonDefaults.outsetColors(),
                    border = CwocButtonDefaults.outsetBorder,
                    shape = CwocButtonDefaults.outsetShape,
                    modifier = Modifier.height(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.OpenInNew,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = badge.label,
                        style = MaterialTheme.typography.labelSmall
                    )
                }

                // View chit button — navigates to editor
                Button(
                    onClick = onNavigateToEditor,
                    colors = CwocButtonDefaults.zoneButtonColors(),
                    border = CwocButtonDefaults.zoneButtonBorder,
                    shape = CwocButtonDefaults.zoneButtonShape,
                    modifier = Modifier.height(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "View Chit",
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }
        }
    }
}

// ─── Staleness Indicator ────────────────────────────────────────────────────────

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun StalenessIndicator(
    lastUpdatedAt: String,
    use24HourTime: Boolean
) {
    val context = LocalContext.current
    val now = Instant.now()
    val updatedInstant = try {
        Instant.parse(lastUpdatedAt)
    } catch (_: Exception) {
        null
    }

    if (updatedInstant == null) return

    val duration = Duration.between(updatedInstant, now)
    val totalMinutes = duration.toMinutes()
    val totalHours = duration.toHours()
    val totalDays = duration.toDays()

    val stalenessText = when {
        totalDays > 0 -> "⏱️ ${totalDays}d"
        totalHours > 0 -> "⏱️ ${totalHours}h"
        else -> "⏱️ ${totalMinutes}m"
    }

    // Warning color if > 7 days
    val isStale = totalDays > 7
    val textColor = if (isStale) Color(0xFFB22222) else MaterialTheme.colorScheme.onSurfaceVariant

    // Format exact datetime for tooltip
    val formatter = if (use24HourTime) {
        DateTimeFormatter.ofPattern("MMM d, yyyy HH:mm")
    } else {
        DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a")
    }
    val exactDateTime = updatedInstant
        .atZone(ZoneId.systemDefault())
        .format(formatter)

    Text(
        text = stalenessText,
        style = MaterialTheme.typography.labelSmall,
        color = textColor,
        fontWeight = if (isStale) FontWeight.Bold else FontWeight.Normal,
        modifier = Modifier
            .combinedClickable(
                onClick = {},
                onLongClick = {
                    Toast.makeText(context, "Last updated: $exactDateTime", Toast.LENGTH_LONG).show()
                }
            )
            .padding(horizontal = 4.dp)
    )
}

// ─── Offline Banner ─────────────────────────────────────────────────────────────

@Composable
private fun OfflineBanner() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = Color(0xFFFFF3CD),
                shape = RoundedCornerShape(6.dp)
            )
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Text(
            text = "📡 Offline — showing cached data",
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFF856404)
        )
    }
}

// ─── Loading State ──────────────────────────────────────────────────────────────

@Composable
private fun BadgesLoadingState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            color = MaterialTheme.colorScheme.primary
        )
    }
}

// ─── Error State ────────────────────────────────────────────────────────────────

@Composable
private fun BadgesErrorState(
    errorMessage: String,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Unable to load badges",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = errorMessage,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 32.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onRetry,
                colors = CwocButtonDefaults.outsetColors(),
                border = CwocButtonDefaults.outsetBorder,
                shape = CwocButtonDefaults.outsetShape
            ) {
                Text("Retry")
            }
        }
    }
}
