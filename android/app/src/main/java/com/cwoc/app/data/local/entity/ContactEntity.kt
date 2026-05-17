package com.cwoc.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "contacts",
    indices = [
        Index(
            name = "idx_contacts_name",
            value = ["givenName", "surname"]
        )
    ]
)
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
    val syncVersion: Int = 0,
    val lastSyncedAt: String?,

    // Phase 3 — dirty tracking and conflict state
    @ColumnInfo(defaultValue = "0")
    val isDirty: Boolean = false,
    @ColumnInfo(defaultValue = "[]")
    val dirtyFields: String? = "[]",
    @ColumnInfo(defaultValue = "0")
    val deleted: Boolean = false,
    @ColumnInfo(defaultValue = "0")
    val hasUnviewedConflict: Boolean = false,
    val conflictFields: String? = null
)
