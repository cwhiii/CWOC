package com.cwoc.app.data.local.entity

import androidx.room.ColumnInfo

/**
 * Lightweight Room projection for notification scheduling.
 * Only includes the columns needed to parse alerts and compute trigger times.
 * Avoids CursorWindow overflow from SELECT * on the 97-column chits table.
 */
data class ChitAlertProjection(
    val id: String,
    val title: String?,
    val alerts: String?,
    val startDatetime: String?,
    val endDatetime: String?,
    val dueDatetime: String?,
    val pointInTime: String?,
    val timezone: String?,
    val status: String?,
    val habit: Boolean,
    val habitGoal: Int?,
    val habitSuccess: Int?
)
