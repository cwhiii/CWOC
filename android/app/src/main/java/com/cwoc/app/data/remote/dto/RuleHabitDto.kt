package com.cwoc.app.data.remote.dto

import com.google.gson.annotations.SerializedName

/**
 * DTO for a rule with habit_mode enabled, returned from GET /api/rules?habit=true.
 * Contains the rule metadata plus a computed habit_summary with streak/status info.
 */
data class RuleHabitDto(
    val id: String,
    val name: String,
    val description: String? = null,

    @SerializedName("habit_summary")
    val habitSummary: HabitSummaryDto? = null
)

/**
 * Nested DTO for the computed habit summary on a rule habit.
 * Returned as part of each rule when habit_mode is enabled.
 */
data class HabitSummaryDto(
    @SerializedName("current_status")
    val currentStatus: String? = null, // "due", "achieved", "missed"

    val streak: Int? = null,

    @SerializedName("success_rate")
    val successRate: Double? = null, // 0.0 to 1.0

    @SerializedName("last_achieved_datetime")
    val lastAchievedDatetime: String? = null,

    val period: String? = null // "daily", "weekly", "monthly"
)
