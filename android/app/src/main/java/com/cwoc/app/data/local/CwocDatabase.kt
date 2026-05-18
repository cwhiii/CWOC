package com.cwoc.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.cwoc.app.data.local.converter.Converters
import com.cwoc.app.data.local.dao.AttachmentMetadataDao
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.dao.NotificationDao
import com.cwoc.app.data.local.dao.SettingsDao
import com.cwoc.app.data.local.dao.SyncMetadataDao
import com.cwoc.app.data.local.entity.AttachmentMetadata
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.local.entity.NotificationEntity
import com.cwoc.app.data.local.entity.SettingsEntity
import com.cwoc.app.data.local.entity.SyncMetadataEntity

@Database(
    entities = [
        ChitEntity::class,
        ContactEntity::class,
        SettingsEntity::class,
        AttachmentMetadata::class,
        SyncMetadataEntity::class,
        NotificationEntity::class
    ],
    version = 8,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class CwocDatabase : RoomDatabase() {
    abstract fun chitDao(): ChitDao
    abstract fun contactDao(): ContactDao
    abstract fun settingsDao(): SettingsDao
    abstract fun attachmentMetadataDao(): AttachmentMetadataDao
    abstract fun syncMetadataDao(): SyncMetadataDao
    abstract fun notificationDao(): NotificationDao
}
