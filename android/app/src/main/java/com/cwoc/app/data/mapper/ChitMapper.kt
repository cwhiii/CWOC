package com.cwoc.app.data.mapper

import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.remote.dto.ChitPushDto
import com.google.gson.Gson

/**
 * Form state representing the editable fields of a chit in the editor UI.
 * Decoupled from ChitEntity to allow dirty comparison and UI-friendly defaults.
 */
data class ChitFormState(
    val id: String,
    val title: String = "",
    val note: String = "",
    val startDatetime: String? = null,
    val endDatetime: String? = null,
    val dueDatetime: String? = null,
    val pointInTime: String? = null,
    val status: String? = null,
    val priority: String? = null,
    val tags: List<String> = emptyList(),
    val checklist: String? = null,
    val people: List<String> = emptyList(),
    val location: String? = null,
    val color: String? = null,
    val alerts: String? = null,
    val recurrence: String? = null,
    val recurrenceRule: String? = null,
    val allDay: Boolean = false,
    val timezone: String? = null,
    val availability: String? = null,
    val isNew: Boolean = false
)

/**
 * Converts a ChitEntity to a ChitFormState for display in the editor.
 * Nullable entity fields are mapped to safe defaults (empty string, empty list, false).
 */
fun ChitEntity.toFormState(): ChitFormState {
    return ChitFormState(
        id = id,
        title = title ?: "",
        note = note ?: "",
        startDatetime = startDatetime,
        endDatetime = endDatetime,
        dueDatetime = dueDatetime,
        pointInTime = pointInTime,
        status = status,
        priority = priority,
        tags = tags ?: emptyList(),
        checklist = checklist,
        people = people ?: emptyList(),
        location = location,
        color = color,
        alerts = alerts,
        recurrence = recurrence,
        recurrenceRule = recurrenceRule,
        allDay = allDay,
        timezone = timezone,
        availability = availability,
        isNew = false
    )
}

/**
 * Converts a ChitFormState back to a ChitEntity for persistence.
 * Non-editable fields are preserved from the original entity (or use defaults for new chits).
 *
 * @param originalEntity The existing entity (null for new chits)
 * @param modifiedDatetime The current timestamp to set as modifiedDatetime
 * @param createdDatetime The creation timestamp (current time for new, original for existing)
 */
fun ChitFormState.toEntity(
    originalEntity: ChitEntity?,
    modifiedDatetime: String,
    createdDatetime: String?
): ChitEntity {
    return ChitEntity(
        id = id,
        title = title.ifBlank { null },
        note = note.ifBlank { null },
        tags = tags.ifEmpty { null },
        startDatetime = startDatetime,
        endDatetime = endDatetime,
        dueDatetime = dueDatetime,
        pointInTime = pointInTime,
        completedDatetime = originalEntity?.completedDatetime,
        status = status,
        priority = priority,
        severity = originalEntity?.severity,
        checklist = checklist,
        alarm = originalEntity?.alarm,
        notification = originalEntity?.notification,
        recurrence = recurrence,
        recurrenceId = originalEntity?.recurrenceId,
        recurrenceRule = recurrenceRule,
        recurrenceExceptions = originalEntity?.recurrenceExceptions,
        location = location,
        color = color,
        people = people.ifEmpty { null },
        pinned = originalEntity?.pinned ?: false,
        archived = originalEntity?.archived ?: false,
        deleted = originalEntity?.deleted ?: false,
        createdDatetime = createdDatetime,
        modifiedDatetime = modifiedDatetime,
        isProjectMaster = originalEntity?.isProjectMaster ?: false,
        childChits = originalEntity?.childChits,
        allDay = allDay,
        timezone = timezone,
        alerts = alerts,
        progressPercent = originalEntity?.progressPercent,
        timeEstimate = originalEntity?.timeEstimate,
        weatherData = originalEntity?.weatherData,
        healthData = originalEntity?.healthData,
        habit = originalEntity?.habit ?: false,
        habitGoal = originalEntity?.habitGoal,
        habitSuccess = originalEntity?.habitSuccess,
        showOnCalendar = originalEntity?.showOnCalendar,
        habitResetPeriod = originalEntity?.habitResetPeriod,
        habitLastActionDate = originalEntity?.habitLastActionDate,
        habitHideOverall = originalEntity?.habitHideOverall,
        perpetual = originalEntity?.perpetual ?: false,
        shares = originalEntity?.shares,
        stealth = originalEntity?.stealth,
        assignedTo = originalEntity?.assignedTo,
        ownerId = originalEntity?.ownerId,
        hasUnviewedConflict = originalEntity?.hasUnviewedConflict ?: false,
        availability = availability,
        snoozedUntil = originalEntity?.snoozedUntil,
        prerequisites = originalEntity?.prerequisites,
        syncVersion = originalEntity?.syncVersion ?: 0,
        lastSyncedAt = originalEntity?.lastSyncedAt,
        isDirty = true,
        dirtyFields = "[]" // Will be set by DirtyTracker
    )
}

/**
 * Converts a ChitEntity to a ChitPushDto for the POST /api/sync/push request.
 * Maps camelCase entity fields to snake_case DTO fields.
 * JSON-stored fields (checklist, recurrenceRule, etc.) are deserialized to Any? for the DTO.
 */
fun ChitEntity.toPushDto(): ChitPushDto {
    val gson = Gson()
    return ChitPushDto(
        id = id,
        last_known_sync_version = syncVersion,
        title = title,
        note = note,
        tags = tags,
        start_datetime = startDatetime,
        end_datetime = endDatetime,
        due_datetime = dueDatetime,
        point_in_time = pointInTime,
        completed_datetime = completedDatetime,
        status = status,
        priority = priority,
        severity = severity,
        checklist = checklist?.let { gson.fromJson(it, Any::class.java) },
        alarm = alarm,
        notification = notification,
        recurrence = recurrence,
        recurrence_id = recurrenceId,
        recurrence_rule = recurrenceRule?.let { gson.fromJson(it, Any::class.java) },
        recurrence_exceptions = recurrenceExceptions?.let { gson.fromJson(it, Any::class.java) },
        location = location,
        color = color,
        people = people,
        pinned = pinned,
        archived = archived,
        deleted = deleted,
        created_datetime = createdDatetime,
        modified_datetime = modifiedDatetime,
        is_project_master = isProjectMaster,
        child_chits = childChits,
        all_day = allDay,
        timezone = timezone,
        alerts = alerts?.let { gson.fromJson(it, Any::class.java) },
        progress_percent = progressPercent,
        time_estimate = timeEstimate,
        weather_data = weatherData?.let { gson.fromJson(it, Any::class.java) },
        health_data = healthData?.let { gson.fromJson(it, Any::class.java) },
        habit = habit,
        habit_goal = habitGoal,
        habit_success = habitSuccess,
        show_on_calendar = showOnCalendar,
        habit_reset_period = habitResetPeriod,
        habit_last_action_date = habitLastActionDate,
        habit_hide_overall = habitHideOverall,
        perpetual = perpetual,
        shares = shares?.let { gson.fromJson(it, Any::class.java) },
        stealth = stealth,
        assigned_to = assignedTo,
        owner_id = ownerId,
        availability = availability,
        snoozed_until = snoozedUntil,
        prerequisites = prerequisites
    )
}

/**
 * Detects which fields changed between an original ChitEntity and the current form state.
 * Returns field names using snake_case (matching the server's field naming convention).
 *
 * For new chits (original == null), returns all non-default/non-empty fields as dirty.
 * For existing chits, compares each editable field and returns those that differ.
 */
fun detectChangedFields(original: ChitEntity?, form: ChitFormState): Set<String> {
    if (original == null) {
        // New chit — all non-null/non-default fields are dirty
        return buildSet {
            if (form.title.isNotBlank()) add("title")
            if (form.note.isNotBlank()) add("note")
            if (form.startDatetime != null) add("start_datetime")
            if (form.endDatetime != null) add("end_datetime")
            if (form.dueDatetime != null) add("due_datetime")
            if (form.pointInTime != null) add("point_in_time")
            if (form.status != null) add("status")
            if (form.priority != null) add("priority")
            if (form.tags.isNotEmpty()) add("tags")
            if (form.checklist != null) add("checklist")
            if (form.people.isNotEmpty()) add("people")
            if (form.location != null) add("location")
            if (form.color != null) add("color")
            if (form.alerts != null) add("alerts")
            if (form.recurrence != null) add("recurrence")
            if (form.recurrenceRule != null) add("recurrence_rule")
            if (form.allDay) add("all_day")
            if (form.timezone != null) add("timezone")
            if (form.availability != null) add("availability")
        }
    }

    // Existing chit — compare field by field
    return buildSet {
        if (form.title != (original.title ?: "")) add("title")
        if (form.note != (original.note ?: "")) add("note")
        if (form.startDatetime != original.startDatetime) add("start_datetime")
        if (form.endDatetime != original.endDatetime) add("end_datetime")
        if (form.dueDatetime != original.dueDatetime) add("due_datetime")
        if (form.pointInTime != original.pointInTime) add("point_in_time")
        if (form.status != original.status) add("status")
        if (form.priority != original.priority) add("priority")
        if (form.tags != (original.tags ?: emptyList<String>())) add("tags")
        if (form.checklist != original.checklist) add("checklist")
        if (form.people != (original.people ?: emptyList<String>())) add("people")
        if (form.location != original.location) add("location")
        if (form.color != original.color) add("color")
        if (form.alerts != original.alerts) add("alerts")
        if (form.recurrence != original.recurrence) add("recurrence")
        if (form.recurrenceRule != original.recurrenceRule) add("recurrence_rule")
        if (form.allDay != original.allDay) add("all_day")
        if (form.timezone != original.timezone) add("timezone")
        if (form.availability != original.availability) add("availability")
    }
}
