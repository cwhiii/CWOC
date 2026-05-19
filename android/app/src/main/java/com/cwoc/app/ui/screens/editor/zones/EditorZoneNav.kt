package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.ui.theme.CwocAgedBrownDark
import com.cwoc.app.ui.theme.CwocAgedBrownLight
import com.cwoc.app.ui.theme.CwocAgedBrownMedium
import com.cwoc.app.ui.theme.CwocBackground
import com.cwoc.app.ui.theme.CwocGoldDivider
import com.cwoc.app.ui.theme.CwocPrimary
import com.cwoc.app.ui.theme.CwocSurface
import com.cwoc.app.ui.theme.CwocSurfaceVariant

/**
 * Zone definition for the mobile zone navigation system.
 * Matches the web's _mobileZoneOrder exactly.
 */
data class EditorZone(
    val id: String,
    val label: String,
    val icon: String,
    val isTitle: Boolean = false
)

/**
 * The fixed zone order matching the mobile browser implementation.
 */
val EDITOR_ZONE_ORDER = listOf(
    EditorZone("titleZone", "Overview", "📋", isTitle = true),
    EditorZone("datesSection", "Dates & Times", "🗓️"),
    EditorZone("taskSection", "Task", "📋"),
    EditorZone("notesSection", "Notes", "📝"),
    EditorZone("checklistSection", "Checklist", "☑️"),
    EditorZone("tagsSection", "Tags", "🏷️"),
    EditorZone("peopleSection", "People", "👥"),
    EditorZone("locationSection", "Location", "📍"),
    EditorZone("alertsSection", "Alerts", "🔔"),
    EditorZone("projectsSection", "Projects", "📂"),
    EditorZone("colorSection", "Color", "🎨"),
    EditorZone("healthIndicatorsSection", "Indicators", "❤️"),
    EditorZone("attachmentsSection", "Attachments", "📎"),
    EditorZone("emailSection", "Email", "✉️"),
    EditorZone("habitLogSection", "Habits", "🎯")
)

/**
 * Map from source tab name to starting zone ID.
 * Matches the web's _mobileTabZoneMap.
 */
val SOURCE_TAB_ZONE_MAP = mapOf(
    "Calendar" to "datesSection",
    "Checklists" to "checklistSection",
    "Alarms" to "alertsSection",
    "Projects" to "checklistSection",
    "Tasks" to "taskSection",
    "Notes" to "notesSection",
    "Email" to "emailSection",
    "Indicators" to "healthIndicatorsSection"
)

// ─── Sticky Navigation Header ────────────────────────────────────────────────────

/**
 * Sticky navigation header for the zone-at-a-time editor.
 * Shows: [☰ Actions] [Chit Title] [counter] [☰ Zone Name]
 *
 * The nav bar background changes to the chit's color when set.
 */
@Composable
fun EditorZoneNavHeader(
    chitTitle: String,
    currentZoneIndex: Int,
    totalZones: Int,
    currentZoneLabel: String,
    chitColor: Color?,
    hasUnsavedChanges: Boolean,
    repeatEnabled: Boolean = false,
    habitActive: Boolean = false,
    onActionsClick: () -> Unit,
    onZoneListClick: () -> Unit
) {
    val bgColor = chitColor ?: CwocSurfaceVariant
    val contentColor = if (chitColor != null) contrastColor(chitColor) else CwocAgedBrownDark
    val buttonBg = if (chitColor != null) contentColor else CwocPrimary
    val buttonText = if (chitColor != null) chitColor else Color.White

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(bgColor)
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .shadow(2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Left hamburger — Actions
        Box {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(3.dp))
                    .background(buttonBg)
                    .clickable(onClick = onActionsClick)
                    .padding(horizontal = 10.dp, vertical = 6.dp)
                    .size(width = 36.dp, height = 36.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("☰", color = buttonText, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
            // Pulsing unsaved dot
            if (hasUnsavedChanges) {
                UnsavedDot(modifier = Modifier.align(Alignment.TopEnd).offset(x = 2.dp, y = (-2).dp))
            }
        }

        // Title area
        Text(
            text = chitTitle.ifBlank { "New Chit" },
            color = contentColor.copy(alpha = 0.7f),
            fontSize = 14.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )

        // Recurrence/Habit icon in title accessories
        if (habitActive) {
            Text(
                text = "🎯",
                fontSize = 18.sp, // ~1.1em
                modifier = Modifier
                    .alpha(0.7f)
                    .semantics { contentDescription = "Habit" }
            )
        } else if (repeatEnabled) {
            Text(
                text = "🔁",
                fontSize = 18.sp, // ~1.1em
                modifier = Modifier
                    .alpha(0.7f)
                    .semantics { contentDescription = "Recurring chit" }
            )
        }

        // Counter
        Text(
            text = "${currentZoneIndex + 1}/$totalZones",
            color = contentColor.copy(alpha = 0.7f),
            fontSize = 12.sp
        )

        // Right hamburger — Zone name
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(3.dp))
                .background(buttonBg)
                .clickable(onClick = onZoneListClick)
                .padding(horizontal = 8.dp, vertical = 6.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                "☰ $currentZoneLabel",
                color = buttonText,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                maxLines = 1
            )
        }
    }
}

/**
 * Pulsing gold dot indicating unsaved changes.
 */
@Composable
fun UnsavedDot(modifier: Modifier = Modifier) {
    val infiniteTransition = rememberInfiniteTransition(label = "unsaved_pulse")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 0.4f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000),
            repeatMode = RepeatMode.Reverse
        ),
        label = "unsaved_alpha"
    )

    Box(
        modifier = modifier
            .size(8.dp)
            .alpha(alpha)
            .clip(CircleShape)
            .background(Color(0xFFD4AF37))
            .border(1.dp, CwocPrimary, CircleShape)
    )
}

// ─── Zone List Panel (Right Sidebar) ─────────────────────────────────────────────

/**
 * Zone list panel that slides in from the right.
 * Shows all zones with icons, labels, active/empty states.
 */
@Composable
fun ZoneListPanel(
    visible: Boolean,
    zones: List<EditorZone>,
    currentZoneIndex: Int,
    isZoneEmpty: (String) -> Boolean,
    onZoneSelected: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    // Backdrop
    if (visible) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.4f))
                .clickable(onClick = onDismiss)
        )
    }

    // Panel
    AnimatedVisibility(
        visible = visible,
        enter = slideInHorizontally(initialOffsetX = { it }),
        exit = slideOutHorizontally(targetOffsetX = { it })
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.CenterEnd
        ) {
            Column(
                modifier = Modifier
                    .width(240.dp)
                    .fillMaxHeight()
                    .background(CwocBackground)
                    .border(width = 2.dp, color = CwocAgedBrownMedium)
                    .padding(12.dp)
            ) {
                // Title
                Text(
                    text = "Zones",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = CwocAgedBrownDark,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp)
                )
                HorizontalDivider(color = CwocAgedBrownLight)
                Spacer(modifier = Modifier.height(8.dp))

                // Zone items
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    zones.forEachIndexed { index, zone ->
                        val isActive = index == currentZoneIndex
                        val isEmpty = isZoneEmpty(zone.id)

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(4.dp))
                                .background(
                                    if (isActive) Color(0xFFFFFFF0) else Color(0xFFFDF5E6)
                                )
                                .border(
                                    width = if (isActive) 2.dp else 1.dp,
                                    color = if (isActive) CwocAgedBrownMedium else CwocAgedBrownLight,
                                    shape = RoundedCornerShape(4.dp)
                                )
                                .clickable {
                                    onZoneSelected(index)
                                    onDismiss()
                                }
                                .padding(horizontal = 10.dp, vertical = 8.dp)
                                .alpha(if (isEmpty) 0.4f else 1f),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(zone.icon, fontSize = 16.sp)
                            Text(
                                text = zone.label,
                                fontWeight = if (isEmpty) FontWeight.Normal else FontWeight.Bold,
                                fontStyle = if (isEmpty) FontStyle.Italic else FontStyle.Normal,
                                color = CwocAgedBrownDark,
                                fontSize = 14.sp
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Close button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(4.dp))
                        .background(CwocAgedBrownLight)
                        .clickable(onClick = onDismiss)
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("⇤ Close", color = Color(0xFFFFF8E1), fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ─── Actions Sidebar (Left Sidebar) ──────────────────────────────────────────────

/**
 * Action item for the actions sidebar.
 */
data class ActionItem(
    val label: String,
    val icon: String = "",
    val onClick: () -> Unit,
    val isHighlighted: Boolean = false,
    val isDanger: Boolean = false
)

/**
 * Actions sidebar that slides in from the left.
 * Contains save, exit, calculator, snooze, options, etc.
 */
@Composable
fun ActionsSidebar(
    visible: Boolean,
    actions: List<ActionItem>,
    onDismiss: () -> Unit
) {
    // Backdrop
    if (visible) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.4f))
                .clickable(onClick = onDismiss)
        )
    }

    // Panel
    AnimatedVisibility(
        visible = visible,
        enter = slideInHorizontally(initialOffsetX = { -it }),
        exit = slideOutHorizontally(targetOffsetX = { -it })
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.CenterStart
        ) {
            Column(
                modifier = Modifier
                    .width(280.dp)
                    .fillMaxHeight()
                    .background(CwocBackground)
                    .border(width = 2.dp, color = CwocAgedBrownMedium)
                    .padding(12.dp)
            ) {
                // Close button at top
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(4.dp))
                        .background(CwocAgedBrownLight)
                        .clickable(onClick = onDismiss)
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("⇤ Close", color = Color(0xFFFFF8E1), fontWeight = FontWeight.Bold)
                }

                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = CwocGoldDivider)
                Spacer(modifier = Modifier.height(8.dp))

                // Action items
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    actions.forEach { action ->
                        val bgColor = when {
                            action.isHighlighted -> CwocPrimary
                            else -> Color(0xFFFDF5E6)
                        }
                        val textColor = when {
                            action.isHighlighted -> Color(0xFFFFF8E1)
                            action.isDanger -> Color(0xFF8B0000)
                            else -> CwocAgedBrownDark
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(4.dp))
                                .background(bgColor)
                                .border(
                                    1.dp,
                                    if (action.isDanger) Color(0xFFCC4444) else CwocAgedBrownLight,
                                    RoundedCornerShape(4.dp)
                                )
                                .clickable {
                                    action.onClick()
                                    onDismiss()
                                }
                                .padding(horizontal = 10.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            if (action.icon.isNotEmpty()) {
                                Text(action.icon, fontSize = 16.sp)
                            }
                            Text(
                                text = action.label,
                                fontWeight = FontWeight.Bold,
                                color = textColor,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

// ─── Overview Zone ───────────────────────────────────────────────────────────────

/**
 * A single row in the overview panel.
 */
data class OverviewRow(
    val icon: String,
    val text: String,
    val targetZoneId: String,
    val isTitle: Boolean = false,
    val isMultiLine: Boolean = false
)

/**
 * Overview zone — read-only summary of all populated fields.
 * Tapping any row navigates to the corresponding zone.
 */
@Composable
fun OverviewZoneContent(
    rows: List<OverviewRow>,
    onRowClick: (String) -> Unit
) {
    if (rows.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "New chit — swipe or tap a zone to start editing",
                color = Color(0xFF8B7355),
                fontStyle = FontStyle.Italic,
                fontSize = 14.sp
            )
        }
        return
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        rows.forEach { row ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onRowClick(row.targetZoneId) }
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = if (row.isMultiLine) Alignment.Top else Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(row.icon, fontSize = 16.sp, modifier = Modifier.width(24.dp))
                Text(
                    text = row.text,
                    modifier = Modifier.weight(1f),
                    fontSize = if (row.isTitle) 16.sp else 14.sp,
                    fontWeight = if (row.isTitle) FontWeight.Bold else FontWeight.Normal,
                    color = if (row.isTitle) Color(0xFF2B1E0F) else Color(0xFF3E2B1A),
                    maxLines = if (row.isMultiLine) 5 else 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text("›", fontSize = 18.sp, color = Color(0xFFA0845A), fontWeight = FontWeight.Bold)
            }
            HorizontalDivider(color = Color(0xFFE0D4C0), thickness = 1.dp)
        }
    }
}

// ─── Utility ─────────────────────────────────────────────────────────────────────

/**
 * Compute contrast color (dark or light) for a given background.
 * Matches the web's contrastColorForBg().
 */
fun contrastColor(bg: Color): Color {
    val luminance = 0.299f * bg.red + 0.587f * bg.green + 0.114f * bg.blue
    return if (luminance > 0.5f) Color(0xFF1A1208) else Color(0xFFFFF8E1)
}
