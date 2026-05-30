package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration 13→14: Adds badges_completed_window column to settings table.
 *
 * This stores the user's preference for how far back to show completed badges
 * on the Badges page. Values: "1", "3", "7", "30", "365", or "all".
 * Default: "3" (3 days).
 */
val MIGRATION_13_14 = object : Migration(13, 14) {
    override fun migrate(database: SupportSQLiteDatabase) {
        try {
            database.execSQL(
                "ALTER TABLE settings ADD COLUMN badges_completed_window TEXT DEFAULT '3'"
            )
        } catch (_: Exception) {
            // Column may already exist — safe to ignore
        }
    }
}
