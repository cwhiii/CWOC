package com.cwoc.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "notifications")
data class NotificationEntity(
    @PrimaryKey val id: String,
    val type: String,           // "invitation", "reminder", "system"
    val title: String,
    val body: String?,
    val chitId: String?,
    val senderId: String?,
    val ownerDisplayName: String? = null,
    val deliveryTarget: String? = null,
    val snoozedUntil: String? = null,
    @ColumnInfo(defaultValue = "0")
    val isRead: Boolean = false,
    @ColumnInfo(defaultValue = "0")
    val isDismissed: Boolean = false,
    val createdDatetime: String,
    val actionTaken: String? = null  // "accepted", "declined", "dismissed"
)
