package com.cwoc.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "chits",
    indices = [
        Index(
            name = "idx_chits_checklist",
            value = ["deleted", "archived"]
        ),
        Index(
            name = "idx_chits_project_master",
            value = ["deleted", "archived", "isProjectMaster"]
        ),
        Index(
            name = "idx_chits_alerts",
            value = ["deleted", "archived"]
        ),
        Index(
            name = "idx_chits_health_data",
            value = ["deleted", "archived"]
        ),
        Index(
            name = "idx_chits_location",
            value = ["deleted", "archived"]
        )
    ]
)
data class ChitEntity(
    @PrimaryKey val id: String,
    val title: String?,
    val note: String?,
    val tags: List<String>?,
    val startDatetime: String?,
    val endDatetime: String?,
    val dueDatetime: String?,
    val pointInTime: String?,
    val completedDatetime: String?,
    val status: String?,
    val priority: String?,
    val severity: String?,
    val checklist: String?,
    val alarm: Boolean?,
    val notification: Boolean?,
    val recurrence: String?,
    val recurrenceId: String?,
    val recurrenceRule: String?,
    val recurrenceExceptions: String?,
    val location: String?,
    val color: String?,
    val people: List<String>?,
    val pinned: Boolean,
    val archived: Boolean,
    val deleted: Boolean,
    val createdDatetime: String?,
    val modifiedDatetime: String?,
    val isProjectMaster: Boolean,
    val childChits: List<String>?,
    val allDay: Boolean,
    val timezone: String?,
    val alerts: String?,
    val progressPercent: Int?,
    val timeEstimate: String?,
    val weatherData: String?,
    val healthData: String?,
    val habit: Boolean,
    val habitGoal: Int?,
    val habitSuccess: Int?,
    val showOnCalendar: Boolean?,
    val habitResetPeriod: String?,
    val habitLastActionDate: String?,
    val habitHideOverall: Boolean?,
    val perpetual: Boolean,
    val shares: String?,
    val stealth: Boolean?,
    val assignedTo: String?,
    val ownerId: String?,
    val hasUnviewedConflict: Boolean,
    val availability: String?,
    val snoozedUntil: String?,
    val prerequisites: List<String>?,
    val syncVersion: Int,
    val lastSyncedAt: String?,

    // Phase 2 — dirty tracking
    @ColumnInfo(defaultValue = "0")
    val isDirty: Boolean = false,
    @ColumnInfo(defaultValue = "[]")
    val dirtyFields: String? = "[]",

    // Phase 3 — conflict field tracking
    @ColumnInfo(defaultValue = "NULL")
    val conflictFields: String? = null
)
