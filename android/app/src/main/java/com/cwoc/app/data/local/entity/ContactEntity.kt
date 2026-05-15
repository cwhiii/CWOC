package com.cwoc.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "contacts")
data class ContactEntity(
    @PrimaryKey val id: String,
    val givenName: String,
    val surname: String?,
    val middleNames: String?,
    val prefix: String?,
    val suffix: String?,
    val nickname: String?,
    val displayName: String?,
    val phones: String?,
    val emails: String?,
    val addresses: String?,
    val callSigns: String?,
    val xHandles: String?,
    val websites: String?,
    val dates: String?,
    val hasSignal: Boolean,
    val signalUsername: String?,
    val pgpKey: String?,
    val favorite: Boolean,
    val color: String?,
    val organization: String?,
    val socialContext: String?,
    val imageUrl: String?,
    val notes: String?,
    val tags: List<String>?,
    val sharedToVault: Boolean,
    val createdDatetime: String?,
    val modifiedDatetime: String?,
    val syncVersion: Int,
    val lastSyncedAt: String?
)
