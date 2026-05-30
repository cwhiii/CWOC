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
import com.cwoc.app.ui.screens.editor.zones.ChecklistOverviewItem
import com.cwoc.app.ui.screens.editor.zones.SOURCE_TAB_ZONE_MAP
import com.cwoc.app.ui.screens.editor.zones.ZONE_PREFILL_MAP
import com.cwoc.app.ui.util.DateUtils

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
         * When sourceTab is null (existing chit), start on Overview (index 0).
         */
        fun getStartingZoneIndex(sourceTab: String?, hasDatePrefill: Boolean): Int {
            if (hasDatePrefill) {
                return EDITOR_ZONE_ORDER.indexOfFirst { it.id == "datesSection" }.coerceAtLeast(0)
            }
            // Both new chits and existing chits start on Overview (index 0).
            // For new chits, the Overview zone embeds the relevant zone content
            // based on sourceTab (handled in ChitEditorScreen).
            return 0
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
        "tagsSection" -> formState.tags.none { tag ->
            tag !in setOf("Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes") &&
                !tag.startsWith("CWOC_System/", ignoreCase = true)
        }
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
 * Includes rows for populated fields, plus placeholder rows for prefill zones
 * when creating a new chit from a specific source tab.
 *
 * @param tagNameMap Optional map of tag ID (UUID) → display name for resolving tag IDs.
 */
fun buildOverviewRows(formState: ChitFormState, sourceTab: String? = null, tagNameMap: Map<String, String> = emptyMap()): List<com.cwoc.app.ui.screens.editor.zones.OverviewRow> {
    val rows = mutableListOf<com.cwoc.app.ui.screens.editor.zones.OverviewRow>()
    val prefillZoneIds = if (formState.isNew && sourceTab != null) {
        ZONE_PREFILL_MAP[sourceTab] ?: emptyList()
    } else {
        emptyList()
    }

    // Title is NOT included here — it's shown as the editable OutlinedTextField
    // at the top of the overview zone in ChitEditorScreen.kt

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
        try {
            val items = org.json.JSONArray(formState.checklist)
            val incomplete = mutableListOf<ChecklistOverviewItem>()
            var totalChecked = 0
            for (i in 0 until items.length()) {
                val item = items.getJSONObject(i)
                val checked = item.optBoolean("checked", false)
                val text = item.optString("text", "").trim()
                if (checked) {
                    totalChecked++
                } else if (text.isNotEmpty()) {
                    incomplete.add(ChecklistOverviewItem(
                        index = i,
                        text = if (text.length > 50) text.take(50) + "…" else text,
                        checked = false
                    ))
                }
            }
            val overflowText = buildString {
                if (incomplete.size > 6) append("…${incomplete.size - 6} more")
                if (totalChecked > 0) {
                    if (isNotEmpty()) append(" • ")
                    append("✓ $totalChecked completed")
                }
            }
            if (incomplete.isNotEmpty()) {
                rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
                    icon = "☑️",
                    text = overflowText,
                    targetZoneId = "checklistSection",
                    isMultiLine = true,
                    checklistItems = incomplete.take(6)
                ))
            } else if (totalChecked > 0) {
                rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
                    icon = "☑️",
                    text = "✓ All $totalChecked items complete",
                    targetZoneId = "checklistSection"
                ))
            }
        } catch (e: Exception) {
            rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
                icon = "☑️",
                text = "Checklist items",
                targetZoneId = "checklistSection"
            ))
        }
    }

    // Tags (filter out system tags for display)
    val userTagsForOverview = formState.tags.filter { tag ->
        tag !in setOf("Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes") &&
            !tag.startsWith("CWOC_System/", ignoreCase = true)
    }
    if (userTagsForOverview.isNotEmpty()) {
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "🏷️",
            text = userTagsForOverview.joinToString(", ") { tag ->
                // Resolve UUID to display name via tagNameMap, or fall back to path leaf
                tagNameMap[tag]?.substringAfterLast("/") ?: tag.substringAfterLast("/")
            },
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

    // Habits
    if (formState.habit) {
        val habitText = buildString {
            val goal = formState.habitGoal ?: 1
            val success = formState.habitSuccess ?: 0
            append("$success / $goal")
            if (formState.habitResetPeriod != null) {
                val period = formState.habitResetPeriod
                val periodLabel = when {
                    period.contains("DAILY", ignoreCase = true) -> "daily"
                    period.contains("WEEKLY", ignoreCase = true) -> "weekly"
                    period.contains("MONTHLY", ignoreCase = true) -> "monthly"
                    period.contains("YEARLY", ignoreCase = true) -> "yearly"
                    else -> period.substringAfter(":").lowercase()
                }
                append(" ($periodLabel)")
            }
        }
        rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
            icon = "🎯",
            text = habitText,
            targetZoneId = "habitLogSection"
        ))
    }

    // Add placeholder rows for prefill zones that don't already have a row
    if (prefillZoneIds.isNotEmpty()) {
        val existingZoneIds = rows.map { it.targetZoneId }.toSet()
        for (zoneId in prefillZoneIds) {
            if (zoneId !in existingZoneIds) {
                val zone = EDITOR_ZONE_ORDER.find { it.id == zoneId }
                if (zone != null) {
                    rows.add(com.cwoc.app.ui.screens.editor.zones.OverviewRow(
                        icon = zone.icon,
                        text = "${zone.label} — tap to start",
                        targetZoneId = zoneId
                    ))
                }
            }
        }
    }

    return rows
}

private fun buildDatesText(formState: ChitFormState): String {
    val parts = mutableListOf<String>()

    if (formState.pointInTime != null) {
        parts.add(DateUtils.formatOverviewDateTime(formState.pointInTime))
    } else if (formState.perpetual) {
        parts.add("Perpetual (ongoing)")
    } else {
        if (formState.startDatetime != null) {
            if (formState.endDatetime != null) {
                val startDate = DateUtils.formatOverviewDateOnly(formState.startDatetime)
                val endDate = DateUtils.formatOverviewDateOnly(formState.endDatetime)
                if (startDate != null && startDate == endDate) {
                    // Same date — show date once with time range
                    val startTime = DateUtils.formatOverviewTimeOnly(formState.startDatetime)
                    val endTime = DateUtils.formatOverviewTimeOnly(formState.endDatetime)
                    val s = if (startTime != null && endTime != null) {
                        "$startDate $startTime → $endTime"
                    } else if (startTime != null) {
                        "$startDate $startTime"
                    } else {
                        startDate
                    }
                    parts.add(s)
                } else {
                    // Different dates — show full datetime for each
                    parts.add("${DateUtils.formatOverviewDateTime(formState.startDatetime)} → ${DateUtils.formatOverviewDateTime(formState.endDatetime)}")
                }
            } else {
                parts.add(DateUtils.formatOverviewDateTime(formState.startDatetime))
            }
        }
        if (formState.dueDatetime != null) {
            parts.add("Due: ${DateUtils.formatOverviewDateTime(formState.dueDatetime)}")
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
