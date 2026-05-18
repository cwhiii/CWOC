package com.cwoc.app.data.remote.dto

/**
 * Request body for POST /api/sync/push.
 * Contains all dirty entities to push to the server.
 * Matches the server's expected schema: {"chits": [...], "contacts": [...], "settings": {...}}.
 * Nullable lists/objects are omitted from the JSON when null (Gson default behavior).
 */
data class SyncPushRequestDto(
    val chits: List<ChitPushDto>? = null,
    val contacts: List<ContactPushDto>? = null,
    val settings: SettingsPushDto? = null
)

/**
 * DTO for a single chit being pushed to the server.
 * Fields use snake_case to match server field names (Gson handles serialization).
 * Includes last_known_sync_version for server-side conflict detection.
 */
data class ChitPushDto(
    val id: String,
    val last_known_sync_version: Int,
    val title: String?,
    val note: String?,
    val tags: List<String>?,
    val start_datetime: String?,
    val end_datetime: String?,
    val due_datetime: String?,
    val point_in_time: String?,
    val completed_datetime: String?,
    val status: String?,
    val priority: String?,
    val severity: String?,
    val checklist: Any?,
    val alarm: Boolean?,
    val notification: Boolean?,
    val recurrence: String?,
    val recurrence_id: String?,
    val recurrence_rule: Any?,
    val recurrence_exceptions: Any?,
    val location: String?,
    val color: String?,
    val people: List<String>?,
    val pinned: Boolean?,
    val archived: Boolean?,
    val deleted: Boolean?,
    val created_datetime: String?,
    val modified_datetime: String?,
    val is_project_master: Boolean?,
    val child_chits: List<String>?,
    val all_day: Boolean?,
    val timezone: String?,
    val alerts: Any?,
    val progress_percent: Int?,
    val time_estimate: String?,
    val weather_data: Any?,
    val health_data: Any?,
    val habit: Boolean?,
    val habit_goal: Int?,
    val habit_success: Int?,
    val show_on_calendar: Boolean?,
    val habit_reset_period: String?,
    val habit_last_action_date: String?,
    val habit_hide_overall: Boolean?,
    val perpetual: Boolean?,
    val shares: Any?,
    val stealth: Boolean?,
    val assigned_to: String?,
    val owner_id: String?,
    val owner_display_name: String?,
    val owner_username: String?,
    val availability: String?,
    val snoozed_until: String?,
    val prerequisites: List<String>?,
    // Email fields
    val email_message_id: String?,
    val email_from: String?,
    val email_to: Any?,
    val email_cc: Any?,
    val email_bcc: Any?,
    val email_subject: String?,
    val email_body_text: String?,
    val email_date: String?,
    val email_folder: String?,
    val email_status: String?,
    val email_read: Boolean?,
    val email_in_reply_to: String?,
    val email_references: String?,
    val email_body_html: String?,
    val email_account_id: String?,
    val email_send_at: String?,
    val email_request_read_receipt: Boolean?,
    // Attachments
    val attachments: Any?,
    // Checklist/thread fields
    val checklist_autosave: String?,
    val nest_thread_id: String?,
    val auto_complete_checklist: Boolean?
)

/**
 * DTO for a single contact being pushed to the server.
 * Fields use snake_case to match server field names.
 * Includes last_known_sync_version for server-side conflict detection
 * and dirty_fields to indicate which fields were locally modified.
 */
data class ContactPushDto(
    val id: String,
    val last_known_sync_version: Int,
    val given_name: String?,
    val surname: String?,
    val middle_names: String?,
    val prefix: String?,
    val suffix: String?,
    val nickname: String?,
    val display_name: String?,
    val phones: Any?,
    val emails: Any?,
    val addresses: Any?,
    val call_signs: Any?,
    val x_handles: Any?,
    val websites: Any?,
    val dates: Any?,
    val has_signal: Boolean?,
    val signal_username: String?,
    val pgp_key: String?,
    val favorite: Boolean?,
    val color: String?,
    val organization: String?,
    val social_context: String?,
    val image_url: String?,
    val notes: String?,
    val tags: List<String>?,
    val shared_to_vault: Boolean?,
    val deleted: Boolean?,
    val created_datetime: String?,
    val modified_datetime: String?,
    val dirty_fields: List<String>?
)

/**
 * DTO for pushing settings to the server.
 * Contains the full settings blob and sync version for conflict detection.
 * The server uses LWW (last-writer-wins) on the entire settings record.
 */
data class SettingsPushDto(
    val last_known_sync_version: Int,
    val settings: Map<String, Any?>
)
