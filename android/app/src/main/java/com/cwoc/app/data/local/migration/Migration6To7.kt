package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration 6→7: Adds all missing columns to achieve full schema parity with the server.
 *
 * ChitEntity: +23 columns (email fields, attachments, checklist_autosave, nest_thread_id,
 *             auto_complete_checklist, owner_display_name, owner_username, email_send_at,
 *             email_request_read_receipt)
 * ContactEntity: +2 columns (ownerId, deletedDatetime)
 * SettingsEntity: +37 columns (audit, map, email, omni, bundles, autosave, privacy, etc.)
 * NotificationEntity: +3 columns (ownerDisplayName, deliveryTarget, snoozedUntil)
 */
val MIGRATION_6_7 = object : Migration(6, 7) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // === ChitEntity: 23 new columns ===

        // Ownership display fields
        try { database.execSQL("ALTER TABLE chits ADD COLUMN ownerDisplayName TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN ownerUsername TEXT") } catch (e: Exception) {}

        // Email fields
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailMessageId TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailFrom TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailTo TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailCc TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailBcc TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailSubject TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailBodyText TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailDate TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailFolder TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailStatus TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailRead INTEGER") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailInReplyTo TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailReferences TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailBodyHtml TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailAccountId TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailSendAt TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN emailRequestReadReceipt INTEGER") } catch (e: Exception) {}

        // Attachments
        try { database.execSQL("ALTER TABLE chits ADD COLUMN attachments TEXT") } catch (e: Exception) {}

        // Checklist/thread fields
        try { database.execSQL("ALTER TABLE chits ADD COLUMN checklistAutosave TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN nestThreadId TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE chits ADD COLUMN autoCompleteChecklist INTEGER") } catch (e: Exception) {}

        // === ContactEntity: 2 new columns ===
        try { database.execSQL("ALTER TABLE contacts ADD COLUMN ownerId TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE contacts ADD COLUMN deletedDatetime TEXT") } catch (e: Exception) {}

        // === SettingsEntity: 37 new columns ===
        try { database.execSQL("ALTER TABLE settings ADD COLUMN auditLogMaxDays INTEGER") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN auditLogMaxMb REAL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN defaultNotifications TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN sharedTags TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN kioskUsers TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN mapDefaultLat TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN mapDefaultLon TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN mapDefaultZoom TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN mapAutoZoom TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN emailAccount TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN emailAccounts TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN attachmentMaxSizeMb TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN attachmentMaxStorageMb TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN defaultShareContacts TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN checklistAutosave TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN autosaveDesktop TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN autosaveMobile TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN recentTags TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN paginateEmail TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN bundlesMultiPlacement INTEGER") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN bundlesEnabled INTEGER") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN bundlesShowCount TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN showMapThumbnails TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN sessionLifetime TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN omniLayout TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN omniLockedFilters TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN omniHstClockMode TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN omniEmailCount TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN omniNormalizeColors TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN smartActionsConfig TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN customViewFilters TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN emailBlockTrackingPixels TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN emailExternalContent TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN emailReadReceipts TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN emailUndoSendDelay TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN emailGroupBy TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN timezoneOverride TEXT") } catch (e: Exception) {}

        // === NotificationEntity: 3 new columns ===
        try { database.execSQL("ALTER TABLE notifications ADD COLUMN ownerDisplayName TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE notifications ADD COLUMN deliveryTarget TEXT") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE notifications ADD COLUMN snoozedUntil TEXT") } catch (e: Exception) {}
    }
}
