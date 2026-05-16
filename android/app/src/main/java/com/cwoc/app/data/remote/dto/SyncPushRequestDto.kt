package com.cwoc.app.data.remote.dto

/**
 * Request body for POST /api/sync/push.
 * Contains all dirty chits to push to the server.
 * Matches the server's expected schema: {"chits": [...]}.
 */
data class SyncPushRequestDto(
    val chits: List<ChitPushDto>
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
    val availability: String?,
    val snoozed_until: String?,
    val prerequisites: List<String>?
)
