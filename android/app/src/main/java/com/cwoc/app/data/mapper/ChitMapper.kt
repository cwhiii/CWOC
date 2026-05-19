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
    val severity: String? = null,
    val tags: List<String> = emptyList(),
    val checklist: String? = null,
    val people: List<String> = emptyList(),
    val location: String? = null,
    val color: String? = null,
    val alerts: String? = null,
    val recurrence: String? = null,
    val recurrenceRule: String? = null,
    val recurrenceExceptions: String? = null,
    val allDay: Boolean = false,
    val timezone: String? = null,
    val availability: String? = null,
    val perpetual: Boolean = false,
    val habit: Boolean = false,
    val habitGoal: Int? = null,
    val habitSuccess: Int? = null,
    val habitResetPeriod: String? = null,
    val habitLastActionDate: String? = null,
    val habitHideOverall: Boolean? = null,
    val showOnCalendar: Boolean? = null,
    val isProjectMaster: Boolean = false,
    val childChits: List<String>? = null,
    val assignedTo: String? = null,
    val prerequisites: List<String>? = null,
    val stealth: Boolean? = null,
    val shares: String? = null,  // JSON array of {user_id, role, display_name, rsvp_status}
    val autoCompleteChecklist: Boolean? = null,
    val checklistAutosave: String? = null,
    val healthData: String? = null,
    val attachments: String? = null,
    val nestThreadId: String? = null,
    // Email fields
    val emailFrom: String? = null,
    val emailTo: String? = null,
    val emailCc: String? = null,
    val emailBcc: String? = null,
    val emailSubject: String? = null,
    val emailBodyText: String? = null,
    val emailBodyHtml: String? = null,
    val emailDate: String? = null,
    val emailFolder: String? = null,
    val emailStatus: String? = null,
    val emailRead: Boolean? = null,
    val emailInReplyTo: String? = null,
    val emailReferences: String? = null,
    val emailMessageId: String? = null,
    val emailAccountId: String? = null,
    val emailSendAt: String? = null,
    val emailRequestReadReceipt: Boolean? = null,
    // Ownership display
    val ownerId: String? = null,
    val ownerDisplayName: String? = null,
    val ownerUsername: String? = null,
    val notification: Boolean? = null,
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
        severity = severity,
        tags = tags ?: emptyList(),
        checklist = checklist,
        people = people ?: emptyList(),
        location = location,
        color = color,
        alerts = alerts,
        recurrence = recurrence,
        recurrenceRule = recurrenceRule,
        recurrenceExceptions = recurrenceExceptions,
        allDay = allDay,
        timezone = timezone,
        availability = availability,
        perpetual = perpetual,
        habit = habit,
        habitGoal = habitGoal,
        habitSuccess = habitSuccess,
        habitResetPeriod = habitResetPeriod,
        habitLastActionDate = habitLastActionDate,
        habitHideOverall = habitHideOverall,
        showOnCalendar = showOnCalendar,
        isProjectMaster = isProjectMaster,
        childChits = childChits,
        assignedTo = assignedTo,
        prerequisites = prerequisites,
        stealth = stealth,
        shares = shares,
        autoCompleteChecklist = autoCompleteChecklist,
        checklistAutosave = checklistAutosave,
        healthData = healthData,
        attachments = attachments,
        nestThreadId = nestThreadId,
        emailFrom = emailFrom,
        emailTo = emailTo,
        emailCc = emailCc,
        emailBcc = emailBcc,
        emailSubject = emailSubject,
        emailBodyText = emailBodyText,
        emailBodyHtml = emailBodyHtml,
        emailDate = emailDate,
        emailFolder = emailFolder,
        emailStatus = emailStatus,
        emailRead = emailRead,
        emailInReplyTo = emailInReplyTo,
        emailReferences = emailReferences,
        emailMessageId = emailMessageId,
        emailAccountId = emailAccountId,
        emailSendAt = emailSendAt,
        emailRequestReadReceipt = emailRequestReadReceipt,
        ownerId = ownerId,
        ownerDisplayName = ownerDisplayName,
        ownerUsername = ownerUsername,
        notification = notification,
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
        severity = severity,
        checklist = checklist,
        alarm = originalEntity?.alarm,
        notification = notification,
        recurrence = recurrence,
        recurrenceId = originalEntity?.recurrenceId,
        recurrenceRule = recurrenceRule,
        recurrenceExceptions = recurrenceExceptions,
        location = location,
        color = color,
        people = people.ifEmpty { null },
        pinned = originalEntity?.pinned ?: false,
        archived = originalEntity?.archived ?: false,
        deleted = originalEntity?.deleted ?: false,
        createdDatetime = createdDatetime,
        modifiedDatetime = modifiedDatetime,
        isProjectMaster = isProjectMaster,
        childChits = childChits,
        allDay = allDay,
        timezone = timezone,
        alerts = alerts,
        progressPercent = originalEntity?.progressPercent,
        timeEstimate = originalEntity?.timeEstimate,
        weatherData = originalEntity?.weatherData,
        healthData = healthData,
        habit = habit,
        habitGoal = habitGoal,
        habitSuccess = habitSuccess,
        showOnCalendar = showOnCalendar,
        habitResetPeriod = habitResetPeriod,
        habitLastActionDate = habitLastActionDate,
        habitHideOverall = habitHideOverall,
        perpetual = perpetual,
        shares = shares ?: originalEntity?.shares,
        stealth = stealth,
        assignedTo = assignedTo,
        ownerId = ownerId,
        ownerDisplayName = ownerDisplayName,
        ownerUsername = ownerUsername,
        hasUnviewedConflict = originalEntity?.hasUnviewedConflict ?: false,
        availability = availability,
        snoozedUntil = originalEntity?.snoozedUntil,
        prerequisites = prerequisites,
        syncVersion = originalEntity?.syncVersion ?: 0,
        lastSyncedAt = originalEntity?.lastSyncedAt,
        // Email fields
        emailMessageId = emailMessageId,
        emailFrom = emailFrom,
        emailTo = emailTo,
        emailCc = emailCc,
        emailBcc = emailBcc,
        emailSubject = emailSubject,
        emailBodyText = emailBodyText,
        emailDate = emailDate,
        emailFolder = emailFolder,
        emailStatus = emailStatus,
        emailRead = emailRead,
        emailInReplyTo = emailInReplyTo,
        emailReferences = emailReferences,
        emailBodyHtml = emailBodyHtml,
        emailAccountId = emailAccountId,
        emailSendAt = emailSendAt,
        emailRequestReadReceipt = emailRequestReadReceipt,
        // Attachments
        attachments = attachments,
        // Checklist/thread fields
        checklistAutosave = checklistAutosave,
        nestThreadId = nestThreadId,
        autoCompleteChecklist = autoCompleteChecklist,
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
        owner_display_name = ownerDisplayName,
        owner_username = ownerUsername,
        availability = availability,
        snoozed_until = snoozedUntil,
        prerequisites = prerequisites,
        // Email fields
        email_message_id = emailMessageId,
        email_from = emailFrom,
        email_to = emailTo?.let { gson.fromJson(it, Any::class.java) },
        email_cc = emailCc?.let { gson.fromJson(it, Any::class.java) },
        email_bcc = emailBcc?.let { gson.fromJson(it, Any::class.java) },
        email_subject = emailSubject,
        email_body_text = emailBodyText,
        email_date = emailDate,
        email_folder = emailFolder,
        email_status = emailStatus,
        email_read = emailRead,
        email_in_reply_to = emailInReplyTo,
        email_references = emailReferences,
        email_body_html = emailBodyHtml,
        email_account_id = emailAccountId,
        email_send_at = emailSendAt,
        email_request_read_receipt = emailRequestReadReceipt,
        // Attachments
        attachments = attachments?.let { gson.fromJson(it, Any::class.java) },
        // Checklist/thread fields
        checklist_autosave = checklistAutosave,
        nest_thread_id = nestThreadId,
        auto_complete_checklist = autoCompleteChecklist
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
            if (form.severity != null) add("severity")
            if (form.tags.isNotEmpty()) add("tags")
            if (form.checklist != null) add("checklist")
            if (form.people.isNotEmpty()) add("people")
            if (form.location != null) add("location")
            if (form.color != null) add("color")
            if (form.alerts != null) add("alerts")
            if (form.recurrence != null) add("recurrence")
            if (form.recurrenceRule != null) add("recurrence_rule")
            if (form.recurrenceExceptions != null) add("recurrence_exceptions")
            if (form.allDay) add("all_day")
            if (form.timezone != null) add("timezone")
            if (form.availability != null) add("availability")
            if (form.perpetual) add("perpetual")
            if (form.habit) add("habit")
            if (form.habitGoal != null) add("habit_goal")
            if (form.habitSuccess != null) add("habit_success")
            if (form.habitResetPeriod != null) add("habit_reset_period")
            if (form.habitLastActionDate != null) add("habit_last_action_date")
            if (form.habitHideOverall != null) add("habit_hide_overall")
            if (form.showOnCalendar != null) add("show_on_calendar")
            if (form.isProjectMaster) add("is_project_master")
            if (!form.childChits.isNullOrEmpty()) add("child_chits")
            if (form.assignedTo != null) add("assigned_to")
            if (!form.prerequisites.isNullOrEmpty()) add("prerequisites")
            if (form.stealth != null) add("stealth")
            if (form.shares != null) add("shares")
            if (form.autoCompleteChecklist != null) add("auto_complete_checklist")
            if (form.checklistAutosave != null) add("checklist_autosave")
            if (form.healthData != null) add("health_data")
            if (form.attachments != null) add("attachments")
            if (form.nestThreadId != null) add("nest_thread_id")
            if (form.emailFrom != null) add("email_from")
            if (form.emailTo != null) add("email_to")
            if (form.emailCc != null) add("email_cc")
            if (form.emailBcc != null) add("email_bcc")
            if (form.emailSubject != null) add("email_subject")
            if (form.emailBodyText != null) add("email_body_text")
            if (form.emailBodyHtml != null) add("email_body_html")
            if (form.emailStatus != null) add("email_status")
            if (form.emailSendAt != null) add("email_send_at")
            if (form.emailRequestReadReceipt != null) add("email_request_read_receipt")
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
        if (form.severity != original.severity) add("severity")
        if (form.tags    != (original.tags ?: emptyList<String>())) add("tags")
        if (form.checklist != original.checklist) add("checklist")
        if (form.people != (original.people ?: emptyList<String>())) add("people")
        if (form.location != original.location) add("location")
        if (form.color != original.color) add("color")
        if (form.alerts != original.alerts) add("alerts")
        if (form.recurrence != original.recurrence) add("recurrence")
        if (form.recurrenceRule != original.recurrenceRule) add("recurrence_rule")
        if (form.recurrenceExceptions != original.recurrenceExceptions) add("recurrence_exceptions")
        if (form.allDay != original.allDay) add("all_day")
        if (form.timezone != original.timezone) add("timezone")
        if (form.availability != original.availability) add("availability")
        if (form.perpetual != original.perpetual) add("perpetual")
        if (form.habit != original.habit) add("habit")
        if (form.habitGoal != original.habitGoal) add("habit_goal")
        if (form.habitSuccess != original.habitSuccess) add("habit_success")
        if (form.habitResetPeriod != original.habitResetPeriod) add("habit_reset_period")
        if (form.habitLastActionDate != original.habitLastActionDate) add("habit_last_action_date")
        if (form.habitHideOverall != original.habitHideOverall) add("habit_hide_overall")
        if (form.showOnCalendar != original.showOnCalendar) add("show_on_calendar")
        if (form.isProjectMaster != original.isProjectMaster) add("is_project_master")
        if (form.childChits != original.childChits) add("child_chits")
        if (form.assignedTo != original.assignedTo) add("assigned_to")
        if (form.prerequisites != original.prerequisites) add("prerequisites")
        if (form.stealth != original.stealth) add("stealth")
        if (form.shares != original.shares) add("shares")
        if (form.autoCompleteChecklist != original.autoCompleteChecklist) add("auto_complete_checklist")
        if (form.checklistAutosave != original.checklistAutosave) add("checklist_autosave")
        if (form.healthData != original.healthData) add("health_data")
        if (form.attachments != original.attachments) add("attachments")
        if (form.nestThreadId != original.nestThreadId) add("nest_thread_id")
        if (form.emailFrom != original.emailFrom) add("email_from")
        if (form.emailTo != original.emailTo) add("email_to")
        if (form.emailCc != original.emailCc) add("email_cc")
        if (form.emailBcc != original.emailBcc) add("email_bcc")
        if (form.emailSubject != original.emailSubject) add("email_subject")
        if (form.emailBodyText != original.emailBodyText) add("email_body_text")
        if (form.emailBodyHtml != original.emailBodyHtml) add("email_body_html")
        if (form.emailStatus != original.emailStatus) add("email_status")
        if (form.emailSendAt != original.emailSendAt) add("email_send_at")
        if (form.emailRequestReadReceipt != original.emailRequestReadReceipt) add("email_request_read_receipt")
    }
}
