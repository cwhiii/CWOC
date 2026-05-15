package com.cwoc.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "settings")
data class SettingsEntity(
    @PrimaryKey val userId: String,
    val timeFormat: String?,
    val sex: String?,
    val snoozeLength: String?,
    val defaultFilters: String?,
    val alarmOrientation: String?,
    val activeClocks: String?,
    val savedLocations: String?,
    val tags: String?,
    val customColors: String?,
    val visualIndicators: String?,
    val chitOptions: String?,
    val calendarSnap: String?,
    val weekStartDay: String?,
    val workStartHour: String?,
    val workEndHour: String?,
    val workDays: String?,
    val enabledPeriods: String?,
    val customDaysCount: String?,
    val allViewStartHour: String?,
    val allViewEndHour: String?,
    val dayScrollToHour: String?,
    val username: String?,
    val unitSystem: String?,
    val habitsSuccessWindow: String?,
    val overdueBorderColor: String?,
    val blockedBorderColor: String?,
    val hidDeclined: String?,
    val defaultShowHabitsOnCalendar: String?,
    val defaultTimezone: String?,
    val defaultView: String?,
    val viewOrder: String?,
    val syncVersion: Int,
    val lastSyncedAt: String?
)
