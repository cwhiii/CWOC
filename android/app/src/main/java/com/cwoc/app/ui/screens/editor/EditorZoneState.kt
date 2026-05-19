package com.cwoc.app.ui.screens.editor

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.cwoc.app.data.mapper.ChitFormState
import com.cwoc.app.ui.screens.editor.zones.EDITOR_ZONE_ORDER
import com.cwoc.app.ui.screens.editor.zones.EditorZone
import com.cwoc.app.ui.screens.editor.zones.SOURCE_TAB_ZONE_MAP

/**
 * State holder for the zone-at-a-time navigation system.
 * Manages current zone index, visible zones, and panel visibility.
 */
class EditorZoneState(
    initialZoneIndex: Int = 0,
    visibleZones: List<EditorZone> = EDITOR_ZONE_ORDER
) {
    var currentZoneIndex by mutableIntStateOf(initialZoneIndex)
        private set

    var visibleZones by mutableStateOf(visibleZones)
        private set

    var showZoneList by mutableStateOf(false)
    var showActionsSidebar by mutableStateOf(false)

    val currentZone: EditorZone
        get() = visibleZones.getOrElse(currentZoneIndex) { visibleZones.first() }

    val totalZones: Int
        get() = visibleZones.size

    fun navigateTo(index: Int) {
        currentZoneIndex = index.coerceIn(0, visibleZones.size - 1)
    }

    fun navigateToZoneId(zoneId: String) {
        val idx = visibleZones.indexOfFirst { it.id == zoneId }
        if (idx >= 0) currentZoneIndex = idx
    }

    fun nextZone() {
        currentZoneIndex = (currentZoneIndex + 1) % visibleZones.size
    }

    fun prevZone() {
        currentZoneIndex = if (currentZoneIndex - 1 < 0) visibleZones.size - 1 else currentZoneIndex - 1
    }

    fun updateVisibleZones(formState: ChitFormState) {
        val newVisible = EDITOR_ZONE_ORDER.filter { zone ->
            when (zone.id) {
                "emailSection" -> formState.emailStatus != null
                "habitLogSection" -> formState.habit
                else -> true
            }
        }
        // Preserve current zone if possible
        val currentId = visibleZones.getOrNull(currentZoneIndex)?.id
        visibleZones = newVisible
        if (currentId != null) {
            val newIdx = newVisible.indexOfFirst { it.id == currentId }
            if (newIdx >= 0) currentZoneIndex = newIdx
        }
        currentZoneIndex = currentZoneIndex.coerceIn(0, (visibleZones.size - 1).coerceAtLeast(0))
    }

    companion object {
        /**
         * Determine the starting zone index based on the source tab.
         */
        fun getStartingZoneIndex(sourceTab: String?, hasDatePrefill: Boolean): Int {
            if (hasDatePrefill) {
                return EDITOR_ZONE_ORDER.indexOfFirst { it.id == "datesSection" }.coerceAtLeast(0)
            }
            val targetZoneId = SOURCE_TAB_ZONE_MAP[sourceTab] ?: "datesSection"
            return EDITOR_ZONE_ORDER.indexOfFirst { it.id == targetZoneId }.coerceAtLeast(0)
        }
    }
}

/**
 * Determines if a zone is "empty" (has no meaningful content).
 * Used to grey out zones in the zone list panel.
 */
fun isZoneEmpty(zoneId: String, formState: ChitFormState): Boolean {
    return when (zoneId) {
        "titleZone" -> formState.title.isBlank()
        "datesSection" -> formState.startDatetime == null && formState.endDatetime == null &&
            formState.dueDatetime == null && formState.pointInTime == null && !formState.perpetual
        "taskSection" -> formState.status.isNullOrBlank()
        "notesSection" -> formState.note.isBlank()
        "checklistSection" -> formState.checklist.isNullOrBlank()
        "tagsSection" -> formState.tags.isEmpty()
        "peopleSection" -> formState.people.isEmpty()
        "locationSection" -> formState.location.isNullOrBlank()
        "alertsSection" -> formState.alerts.isNullOrBlank()
        "projectsSection" -> !formState.isProjectMaster && formState.childChits.isNullOrEmpty()
        "colorSection" -> formState.color.isNullOrBlank() || formState.color == "transparent"
        "healthIndicatorsSection" -> formState.healthData.isNullOrBlank()
        "attachmentsSection" -> formState.attachments.isNullOrBlank()
        "emailSection" -> formState.emailTo.isNullOrBlank()
        "habitLogSection" -> !formState.habit
        else -> true
    }
}

/**
 * Build overview rows from the current form state.
 * Only includes rows for populated fields.
 */
fun buildOverviewRows(formState: ChitFormState): List<com.cwoc.app.ui.screens.editor.zones.OverviewRow> {
    val rows = mutableListOf<com.cwoc.app.ui.screens.editor.zones.OverviewRow>()

    // Title
    if (formState.title.isNotBlank()) {
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "✏️",
            text = formState.title,
            targetZoneId = "titleZone",
            isTitle = true
        ))
    }

    // Dates
    val datesText = buildDatesText(formState)
    if (datesText.isNotBlank()) {
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "🗓️",
            text = datesText,
            targetZoneId = "datesSection"
        ))
    }

    // Status
    if (!formState.status.isNullOrBlank()) {
        val statusText = buildString {
            append(formState.status)
            if (!formState.priority.isNullOrBlank()) append(" • ${formState.priority}")
        }
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "📋",
            text = statusText,
            targetZoneId = "taskSection"
        ))
    }

    // Notes
    if (formState.note.isNotBlank()) {
        val preview = formState.note.lines()
            .filter { it.isNotBlank() }
            .take(3)
            .joinToString("\n") { if (it.length > 60) it.take(60) + "…" else it }
        val lineCount = formState.note.lines().count { it.isNotBlank() }
        val suffix = if (lineCount > 3) "\n…${lineCount - 3} more lines" else ""
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "📝",
            text = preview + suffix,
            targetZoneId = "notesSection",
            isMultiLine = true
        ))
    }

    // Checklist
    if (!formState.checklist.isNullOrBlank()) {
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "☑️",
            text = "Checklist items",
            targetZoneId = "checklistSection"
        ))
    }

    // Tags
    if (formState.tags.isNotEmpty()) {
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "🏷️",
            text = formState.tags.joinToString(", ") { it.substringAfterLast("/") },
            targetZoneId = "tagsSection"
        ))
    }

    // People
    if (formState.people.isNotEmpty()) {
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "👥",
            text = formState.people.joinToString(", "),
            targetZoneId = "peopleSection"
        ))
    }

    // Location
    if (!formState.location.isNullOrBlank()) {
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "📍",
            text = formState.location,
            targetZoneId = "locationSection"
        ))
    }

    // Alerts
    if (!formState.alerts.isNullOrBlank()) {
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "🔔",
            text = "Alerts configured",
            targetZoneId = "alertsSection"
        ))
    }

    // Color
    if (!formState.color.isNullOrBlank() && formState.color != "transparent") {
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "🎨",
            text = "Color: ${formState.color}",
            targetZoneId = "colorSection"
        ))
    }

    // Health
    if (!formState.healthData.isNullOrBlank()) {
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "❤️",
            text = "Health indicators recorded",
            targetZoneId = "healthIndicatorsSection"
        ))
    }

    return rows
}

private fun buildDatesText(formState: ChitFormState): String {
    val parts = mutableListOf<String>()

    if (formState.pointInTime != null) {
        parts.add(formState.pointInTime)
    } else if (formState.perpetual) {
        parts.add("Perpetual (ongoing)")
    } else {
        if (formState.startDatetime != null) {
            var s = formState.startDatetime
            if (formState.endDatetime != null) s += " → ${formState.endDatetime}"
            parts.add(s)
        }
        if (formState.dueDatetime != null) {
            parts.add("Due: ${formState.dueDatetime}")
        }
    }

    return parts.joinToString(" | ")
}

@Composable
fun rememberEditorZoneState(
    sourceTab: String? = null,
    hasDatePrefill: Boolean = false
): EditorZoneState {
    return remember {
        EditorZoneState(
            initialZoneIndex = EditorZoneState.getStartingZoneIndex(sourceTab, hasDatePrefill)
        )
    }
}
