package com.cwoc.app.ui.screens.map

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.ui.theme.CwocButtonDefaults

private val PopupBrown = Color(0xFF6B4E31)
private val PopupCream = Color(0xFFFFFAF0)
private val OverdueRed = Color(0xFFF44336)
private val StatusBlue = Color(0xFF2196F3)
private val StatusOrange = Color(0xFFFF9800)
private val StatusGreen = Color(0xFF4CAF50)
private val StatusGrey = Color(0xFF9E9E9E)
private val BadgeBg = Color(0xFFF5E6D3)

/**
 * MarkerPopupOverlay — displays a popup card over the map when a marker is tapped.
 *
 * For chit markers: shows title, formatted date, status icon, indicator badges, "Open in Editor" button.
 * For contact markers: shows display name, address, "Open Contact" button.
 * Dismiss on tap outside (clickable scrim behind the popup).
 * Styled to match Mobile_Web popup appearance (parchment theme).
 */
@Composable
fun MarkerPopupOverlay(
    popupData: MarkerPopupData?,
    onDismiss: () -> Unit,
    onOpenEditor: (String) -> Unit,
    onOpenContact: (String) -> Unit
) {
    if (popupData == null) return

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        // Scrim — tap outside to dismiss
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.3f))
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() }
                ) { onDismiss() }
        )

        // Popup card
        Card(
            modifier = Modifier
                .widthIn(max = 320.dp)
                .padding(24.dp)
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() }
                ) { /* consume click to prevent dismiss */ },
            shape = RoundedCornerShape(8.dp),
            colors = CardDefaults.cardColors(containerColor = PopupCream),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, PopupBrown)
        ) {
            when (popupData) {
                is MarkerPopupData.ChitPopup -> ChitPopupContent(
                    data = popupData,
                    onOpenEditor = onOpenEditor
                )
                is MarkerPopupData.ContactPopup -> ContactPopupContent(
                    data = popupData,
                    onOpenContact = onOpenContact
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChitPopupContent(
    data: MarkerPopupData.ChitPopup,
    onOpenEditor: (String) -> Unit
) {
    Column(
        modifier = Modifier.padding(16.dp)
    ) {
        // Status icon + Title row
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            // Status icon
            if (data.status != null) {
                Text(
                    text = statusIcon(data.status),
                    fontSize = 16.sp,
                    modifier = Modifier.padding(end = 8.dp)
                )
            }

            // Title
            Text(
                text = data.title,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = PopupBrown,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
        }

        // Overdue indicator
        if (data.isOverdue) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "⚠️ Overdue",
                fontSize = 12.sp,
                color = OverdueRed,
                fontWeight = FontWeight.SemiBold
            )
        }

        // Date
        if (data.formattedDate != null) {
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "📅 ${data.formattedDate}",
                fontSize = 13.sp,
                color = PopupBrown.copy(alpha = 0.8f)
            )
        }

        // Status text
        if (data.status != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = data.status,
                fontSize = 12.sp,
                color = statusColor(data.status),
                fontWeight = FontWeight.Medium
            )
        }

        // Indicator badges
        val badges = buildIndicatorBadges(data)
        if (badges.isNotEmpty()) {
            Spacer(modifier = Modifier.height(8.dp))
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                badges.forEach { badge ->
                    IndicatorBadge(badge)
                }
            }
        }

        // "Open in Editor" button
        Spacer(modifier = Modifier.height(12.dp))
        Button(
            onClick = { onOpenEditor(data.chitId) },
            colors = CwocButtonDefaults.zoneButtonColors(),
            border = CwocButtonDefaults.zoneButtonBorder,
            shape = CwocButtonDefaults.zoneButtonShape,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Open in Editor", fontSize = 14.sp)
        }
    }
}

@Composable
private fun ContactPopupContent(
    data: MarkerPopupData.ContactPopup,
    onOpenContact: (String) -> Unit
) {
    Column(
        modifier = Modifier.padding(16.dp)
    ) {
        // Contact icon + Name
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "👤",
                fontSize = 16.sp,
                modifier = Modifier.padding(end = 8.dp)
            )
            Text(
                text = data.displayName,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = PopupBrown,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }

        // Address
        if (!data.address.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "📍 ${data.address}",
                fontSize = 13.sp,
                color = PopupBrown.copy(alpha = 0.8f),
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )
        }

        // "Open Contact" button
        Spacer(modifier = Modifier.height(12.dp))
        Button(
            onClick = { onOpenContact(data.contactId) },
            colors = CwocButtonDefaults.zoneButtonColors(),
            border = CwocButtonDefaults.zoneButtonBorder,
            shape = CwocButtonDefaults.zoneButtonShape,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Open Contact", fontSize = 14.sp)
        }
    }
}

@Composable
private fun IndicatorBadge(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        color = PopupBrown,
        modifier = Modifier
            .background(BadgeBg, RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp)
    )
}

/**
 * Build indicator badge labels from the chit popup data.
 */
private fun buildIndicatorBadges(data: MarkerPopupData.ChitPopup): List<String> {
    val badges = mutableListOf<String>()
    if (data.hasPriority) badges.add("⚡ Priority")
    if (data.hasChecklist) badges.add("☑️ Checklist")
    if (data.hasAlarm) badges.add("🔔 Alert")
    if (data.hasRecurrence) badges.add("🔄 Recurring")
    if (data.hasPeople) badges.add("👥 People")
    if (data.hasLocation) badges.add("📍 Location")
    return badges
}

/**
 * Returns a status emoji icon for the given status string.
 */
private fun statusIcon(status: String): String = when (status) {
    "ToDo" -> "📋"
    "In Progress" -> "🔨"
    "Blocked" -> "🚫"
    "Complete" -> "✅"
    "Rejected" -> "❌"
    else -> "📄"
}

/**
 * Returns a color for the given status string.
 */
private fun statusColor(status: String): Color = when (status) {
    "ToDo" -> StatusBlue
    "In Progress" -> StatusOrange
    "Blocked" -> OverdueRed
    "Complete" -> StatusGreen
    "Rejected" -> StatusGrey
    else -> PopupBrown
}
