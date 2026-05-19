package com.cwoc.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "standalone_alerts")
data class StandaloneAlertEntity(
    @PrimaryKey val id: String,
    val type: String,           // "alarm", "timer", "stopwatch"
    val name: String?,
    val data: String,           // JSON string of alert-specific data
    val createdDatetime: String?,
    val modifiedDatetime: String?
)
