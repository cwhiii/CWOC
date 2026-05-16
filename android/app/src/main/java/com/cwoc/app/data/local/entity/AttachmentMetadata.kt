package com.cwoc.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "attachment_metadata")
data class AttachmentMetadata(
    @PrimaryKey val id: String,
    val chitId: String,
    val url: String?,
    val filename: String,
    val sizeBytes: Long,
    val mimeType: String?,
    val localPath: String?,
    val pendingUpload: Boolean = false,
    val lastAccessedAt: String? = null,
    val createdAt: String
)
