package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration 3→4: Adds missing Phase 3 columns to the contacts table.
 *
 * The original MIGRATION_2_3 was deployed without isDirty, dirtyFields, deleted,
 * hasUnviewedConflict, and conflictFields on the contacts table. This migration
 * adds them for devices that already ran the incomplete v3 migration.
 */
val MIGRATION_3_4 = object : Migration(3, 4) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // Add missing columns to contacts table
        val contactColumns = listOf(
            "ALTER TABLE contacts ADD COLUMN isDirty INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE contacts ADD COLUMN dirtyFields TEXT DEFAULT '[]'",
            "ALTER TABLE contacts ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE contacts ADD COLUMN hasUnviewedConflict INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE contacts ADD COLUMN conflictFields TEXT"
        )
        for (sql in contactColumns) {
            try { database.execSQL(sql) } catch (e: Exception) { /* already exists */ }
        }

        // Add missing columns to settings table
        val settingsColumns = listOf(
            "ALTER TABLE settings ADD COLUMN isDirty INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE settings ADD COLUMN lastModified TEXT"
        )
        for (sql in settingsColumns) {
            try { database.execSQL(sql) } catch (e: Exception) { /* already exists */ }
        }
    }
}
