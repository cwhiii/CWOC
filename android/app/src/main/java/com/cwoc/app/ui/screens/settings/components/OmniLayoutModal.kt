package com.cwoc.app.ui.screens.settings.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DragHandle
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.cwoc.app.ui.components.CwocPrimaryButton
import com.cwoc.app.ui.theme.CwocBackground
import com.cwoc.app.ui.theme.CwocGoldDivider
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown

/**
 * Data class representing the Omni View layout configuration.
 * Sections are distributed across four zones: Full Width (top), Left Column, Right Column, and Unused.
 * Each list contains section IDs in display order.
 */
data class OmniLayout(
    val fullWidth: List<String> = emptyList(),
    val leftColumn: List<String> = emptyList(),
    val rightColumn: List<String> = emptyList(),
    val unused: List<String> = emptyList(),
    val hideWhenEmpty: Map<String, Boolean> = emptyMap()
)

/**
 * All available Omni View sections with their display labels.
 * Matches the web implementation's _omniLayoutAreas.
 */
data class OmniSection(
    val id: String,
    val label: String
)

val ALL_OMNI_SECTIONS = listOf(
    OmniSection("hst", "📊 HST Bar"),
    OmniSection("weather", "🌤️ Weather Bar"),
    OmniSection("hst_weather", "📊🌤️ HST + Weather"),
    OmniSection("hst_temp_strip", "📊🌡️ HST Weather Strip"),
    OmniSection("events_weather", "🗓️🌤️ Events & Weather"),
    OmniSection("chrono", "⏰ Chrono Anchored"),
    OmniSection("reminders", "📢 Reminders"),
    OmniSection("ondeck", "🔜 On Deck"),
    OmniSection("soon", "🗓️ Soon"),
    OmniSection("email", "📧 Email"),
    OmniSection("pinned_notes", "📝 Pinned Notes"),
    OmniSection("pinned_checklists", "☑️ Pinned Checklists"),
    OmniSection("pinned_all", "📌 Pinned (Notes + Checklists)")
)

/**
 * Internal representation of a section within a zone for the modal's mutable state.
 */
private data class ZonedSection(
    val id: String,
    val label: String,
    val zone: OmniZone,
    val hideWhenEmpty: Boolean = true
)

private enum class OmniZone {
    FULL_WIDTH, LEFT_COLUMN, RIGHT_COLUMN, UNUSED
}

/**
 * Returns the default OmniLayout matching the web's default configuration.
 */
fun getDefaultOmniLayout(): OmniLayout {
    return OmniLayout(
        fullWidth = listOf("hst", "weather"),
        leftColumn = listOf("chrono", "reminders", "ondeck", "soon", "email"),
        rightColumn = listOf("pinned_notes", "pinned_checklists"),
        unused = listOf("hst_weather", "hst_temp_strip", "events_weather", "pinned_all")
    )
}

/**
 * Full-screen dialog for arranging Omni View sections between zones.
 * Sections can be moved between Full Width, Left Column, Right Column, and Unused zones
 * using up/down arrows and zone-change buttons (tap-to-move approach for mobile).
 *
 * @param currentLayout The current OmniLayout configuration
 * @param onDone Callback with the new layout when the user confirms
 * @param onCancel Callback when the user cancels without saving
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OmniLayoutModal(
    currentLayout: OmniLayout,
    onDone: (OmniLayout) -> Unit,
    onCancel: () -> Unit
) {
    // Build mutable state from the current layout
    val sections = remember(currentLayout) {
        val list = mutableStateListOf<ZonedSection>()
        val hwe = currentLayout.hideWhenEmpty
        currentLayout.fullWidth.forEach { id ->
            val section = ALL_OMNI_SECTIONS.find { it.id == id }
            if (section != null) list.add(ZonedSection(id, section.label, OmniZone.FULL_WIDTH, hwe[id] ?: true))
        }
        currentLayout.leftColumn.forEach { id ->
            val section = ALL_OMNI_SECTIONS.find { it.id == id }
            if (section != null) list.add(ZonedSection(id, section.label, OmniZone.LEFT_COLUMN, hwe[id] ?: true))
        }
        currentLayout.rightColumn.forEach { id ->
            val section = ALL_OMNI_SECTIONS.find { it.id == id }
            if (section != null) list.add(ZonedSection(id, section.label, OmniZone.RIGHT_COLUMN, hwe[id] ?: true))
        }
        currentLayout.unused.forEach { id ->
            val section = ALL_OMNI_SECTIONS.find { it.id == id }
            if (section != null) list.add(ZonedSection(id, section.label, OmniZone.UNUSED, hwe[id] ?: true))
        }
        // Add any sections not present in the layout (new sections added later)
        val existingIds = list.map { it.id }.toSet()
        ALL_OMNI_SECTIONS.filter { it.id !in existingIds }.forEach { section ->
            list.add(ZonedSection(section.id, section.label, OmniZone.UNUSED))
        }
        list
    }

    Dialog(
        onDismissRequest = onCancel,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            "Arrange Omni Layout",
                            fontWeight = FontWeight.Bold,
                            color = CwocZoneHeaderBrown
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onCancel) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = "Cancel",
                                tint = CwocZoneHeaderBrown
                            )
                        }
                    },
                    actions = {
                        CwocPrimaryButton(onClick = {
                            onDone(buildLayoutFromSections(sections))
                        }) {
                            Text("Done")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = CwocBackground
                    )
                )
            },
            containerColor = CwocBackground
        ) { padding ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 12.dp)
            ) {
                // ── Full Width Zone ──
                item {
                    ZoneHeader(title = "Full Width (top)")
                }
                val fullWidthItems = sections.filter { it.zone == OmniZone.FULL_WIDTH }
                if (fullWidthItems.isEmpty()) {
                    item {
                        EmptyZoneHint("Move sections here for full width display")
                    }
                } else {
                    items(fullWidthItems, key = { "full_${it.id}" }) { section ->
                        SectionCard(
                            section = section,
                            canMoveUp = fullWidthItems.indexOf(section) > 0,
                            canMoveDown = fullWidthItems.indexOf(section) < fullWidthItems.size - 1,
                            onMoveUp = { moveWithinZone(sections, section, -1) },
                            onMoveDown = { moveWithinZone(sections, section, 1) },
                            onMoveToZone = { targetZone -> moveToZone(sections, section, targetZone) },
                            onToggleHideWhenEmpty = { toggleHideWhenEmpty(sections, section) },
                            currentZone = OmniZone.FULL_WIDTH
                        )
                    }
                }

                // ── Left Column Zone ──
                item {
                    Spacer(modifier = Modifier.height(12.dp))
                    ZoneHeader(title = "Left Column")
                }
                val leftItems = sections.filter { it.zone == OmniZone.LEFT_COLUMN }
                if (leftItems.isEmpty()) {
                    item {
                        EmptyZoneHint("Move sections here for left column")
                    }
                } else {
                    items(leftItems, key = { "left_${it.id}" }) { section ->
                        SectionCard(
                            section = section,
                            canMoveUp = leftItems.indexOf(section) > 0,
                            canMoveDown = leftItems.indexOf(section) < leftItems.size - 1,
                            onMoveUp = { moveWithinZone(sections, section, -1) },
                            onMoveDown = { moveWithinZone(sections, section, 1) },
                            onMoveToZone = { targetZone -> moveToZone(sections, section, targetZone) },
                            onToggleHideWhenEmpty = { toggleHideWhenEmpty(sections, section) },
                            currentZone = OmniZone.LEFT_COLUMN
                        )
                    }
                }

                // ── Right Column Zone ──
                item {
                    Spacer(modifier = Modifier.height(12.dp))
                    ZoneHeader(title = "Right Column")
                }
                val rightItems = sections.filter { it.zone == OmniZone.RIGHT_COLUMN }
                if (rightItems.isEmpty()) {
                    item {
                        EmptyZoneHint("Move sections here for right column")
                    }
                } else {
                    items(rightItems, key = { "right_${it.id}" }) { section ->
                        SectionCard(
                            section = section,
                            canMoveUp = rightItems.indexOf(section) > 0,
                            canMoveDown = rightItems.indexOf(section) < rightItems.size - 1,
                            onMoveUp = { moveWithinZone(sections, section, -1) },
                            onMoveDown = { moveWithinZone(sections, section, 1) },
                            onMoveToZone = { targetZone -> moveToZone(sections, section, targetZone) },
                            onToggleHideWhenEmpty = { toggleHideWhenEmpty(sections, section) },
                            currentZone = OmniZone.RIGHT_COLUMN
                        )
                    }
                }

                // ── Unused Zone ──
                item {
                    Spacer(modifier = Modifier.height(12.dp))
                    ZoneHeader(title = "Unused", isUnused = true)
                }
                val unusedItems = sections.filter { it.zone == OmniZone.UNUSED }
                if (unusedItems.isEmpty()) {
                    item {
                        EmptyZoneHint("Drag sections here to hide them")
                    }
                } else {
                    items(unusedItems, key = { "unused_${it.id}" }) { section ->
                        SectionCard(
                            section = section,
                            canMoveUp = unusedItems.indexOf(section) > 0,
                            canMoveDown = unusedItems.indexOf(section) < unusedItems.size - 1,
                            onMoveUp = { moveWithinZone(sections, section, -1) },
                            onMoveDown = { moveWithinZone(sections, section, 1) },
                            onMoveToZone = { targetZone -> moveToZone(sections, section, targetZone) },
                            onToggleHideWhenEmpty = { toggleHideWhenEmpty(sections, section) },
                            currentZone = OmniZone.UNUSED
                        )
                    }
                }

                // Bottom spacing
                item {
                    Spacer(modifier = Modifier.height(24.dp))
                }
            }
        }
    }
}

/**
 * Zone header label displayed above each zone's section list.
 */
@Composable
private fun ZoneHeader(title: String, isUnused: Boolean = false) {
    Column(modifier = Modifier.fillMaxWidth()) {
        HorizontalDivider(color = CwocGoldDivider, thickness = 1.dp)
        Text(
            text = title,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (isUnused) Color(0xFF8B6914) else CwocZoneHeaderBrown,
            modifier = Modifier.padding(vertical = 6.dp, horizontal = 4.dp)
        )
    }
}

/**
 * Placeholder text shown when a zone has no sections.
 */
@Composable
private fun EmptyZoneHint(text: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp, horizontal = 8.dp)
            .border(
                width = 1.dp,
                color = CwocGoldDivider,
                shape = RoundedCornerShape(6.dp)
            )
            .padding(12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontSize = 13.sp,
            fontStyle = FontStyle.Italic,
            color = Color(0xFF8B7355)
        )
    }
}

/**
 * A single section card with move up/down arrows and a zone-change menu.
 * Tapping the zone label cycles through available target zones.
 */
@Composable
private fun SectionCard(
    section: ZonedSection,
    canMoveUp: Boolean,
    canMoveDown: Boolean,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onMoveToZone: (OmniZone) -> Unit,
    onToggleHideWhenEmpty: () -> Unit,
    currentZone: OmniZone
) {
    val isUnused = currentZone == OmniZone.UNUSED

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(
                if (isUnused) Color(0xFFF0E8D8).copy(alpha = 0.6f)
                else MaterialTheme.colorScheme.surface
            )
            .border(
                width = 1.dp,
                color = if (isUnused) CwocGoldDivider.copy(alpha = 0.5f) else CwocGoldDivider,
                shape = RoundedCornerShape(6.dp)
            )
            .padding(horizontal = 4.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Drag handle icon (visual indicator)
        Icon(
            imageVector = Icons.Default.DragHandle,
            contentDescription = "Reorder",
            tint = CwocZoneHeaderBrown.copy(alpha = 0.5f),
            modifier = Modifier.size(20.dp)
        )

        // Move up/down buttons
        IconButton(
            onClick = onMoveUp,
            enabled = canMoveUp,
            modifier = Modifier.size(32.dp)
        ) {
            Icon(
                imageVector = Icons.Default.KeyboardArrowUp,
                contentDescription = "Move up",
                tint = if (canMoveUp) CwocZoneHeaderBrown
                else CwocZoneHeaderBrown.copy(alpha = 0.25f),
                modifier = Modifier.size(20.dp)
            )
        }
        IconButton(
            onClick = onMoveDown,
            enabled = canMoveDown,
            modifier = Modifier.size(32.dp)
        ) {
            Icon(
                imageVector = Icons.Default.KeyboardArrowDown,
                contentDescription = "Move down",
                tint = if (canMoveDown) CwocZoneHeaderBrown
                else CwocZoneHeaderBrown.copy(alpha = 0.25f),
                modifier = Modifier.size(20.dp)
            )
        }

        // Section label
        Text(
            text = section.label,
            fontSize = 14.sp,
            color = if (isUnused) Color(0xFF8B7355) else MaterialTheme.colorScheme.onSurface,
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 4.dp)
        )

        // Hide when empty toggle (eye icon)
        if (!isUnused) {
            IconButton(
                onClick = onToggleHideWhenEmpty,
                modifier = Modifier.size(28.dp)
            ) {
                Text(
                    text = if (section.hideWhenEmpty) "👁" else "👁‍🗨",
                    fontSize = 14.sp
                )
            }
        }

        // Zone move button — shows target zone options
        ZoneMoveButton(
            currentZone = currentZone,
            onMoveToZone = onMoveToZone
        )
    }
}

/**
 * A compact button that cycles through available target zones when tapped.
 * Shows a short label indicating where the section can be moved.
 */
@Composable
private fun ZoneMoveButton(
    currentZone: OmniZone,
    onMoveToZone: (OmniZone) -> Unit
) {
    // Determine the next zone in cycle order
    val targetZones = OmniZone.entries.filter { it != currentZone }
    val nextZone = targetZones.first()

    val label = when (nextZone) {
        OmniZone.FULL_WIDTH -> "→ Full"
        OmniZone.LEFT_COLUMN -> "→ Left"
        OmniZone.RIGHT_COLUMN -> "→ Right"
        OmniZone.UNUSED -> "→ Hide"
    }

    Text(
        text = label,
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
        color = CwocZoneHeaderBrown,
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(Color(0xFFF5E6D3))
            .clickable { onMoveToZone(nextZone) }
            .padding(horizontal = 8.dp, vertical = 4.dp)
    )
}

/**
 * Toggles the hideWhenEmpty flag on a section.
 */
private fun toggleHideWhenEmpty(
    sections: MutableList<ZonedSection>,
    section: ZonedSection
) {
    val index = sections.indexOf(section)
    if (index < 0) return
    sections[index] = section.copy(hideWhenEmpty = !section.hideWhenEmpty)
}

/**
 * Moves a section up or down within its current zone.
 */
private fun moveWithinZone(
    sections: MutableList<ZonedSection>,
    section: ZonedSection,
    direction: Int // -1 for up, +1 for down
) {
    val zoneItems = sections.filter { it.zone == section.zone }
    val indexInZone = zoneItems.indexOf(section)
    val targetIndexInZone = indexInZone + direction

    if (targetIndexInZone < 0 || targetIndexInZone >= zoneItems.size) return

    // Find the actual indices in the full list
    val currentIndex = sections.indexOf(section)
    val targetSection = zoneItems[targetIndexInZone]
    val targetIndex = sections.indexOf(targetSection)

    // Swap positions in the full list
    sections[currentIndex] = targetSection
    sections[targetIndex] = section
}

/**
 * Moves a section to a different zone (appends at the end of the target zone).
 */
private fun moveToZone(
    sections: MutableList<ZonedSection>,
    section: ZonedSection,
    targetZone: OmniZone
) {
    val index = sections.indexOf(section)
    if (index < 0) return

    // Remove from current position
    sections.removeAt(index)

    // Find the last item in the target zone and insert after it
    val lastTargetIndex = sections.indexOfLast { it.zone == targetZone }
    val insertIndex = if (lastTargetIndex >= 0) lastTargetIndex + 1 else sections.size

    sections.add(insertIndex, section.copy(zone = targetZone))
}

/**
 * Builds an OmniLayout from the current mutable section state.
 */
private fun buildLayoutFromSections(sections: List<ZonedSection>): OmniLayout {
    return OmniLayout(
        fullWidth = sections.filter { it.zone == OmniZone.FULL_WIDTH }.map { it.id },
        leftColumn = sections.filter { it.zone == OmniZone.LEFT_COLUMN }.map { it.id },
        rightColumn = sections.filter { it.zone == OmniZone.RIGHT_COLUMN }.map { it.id },
        unused = sections.filter { it.zone == OmniZone.UNUSED }.map { it.id },
        hideWhenEmpty = sections.associate { it.id to it.hideWhenEmpty }
    )
}
