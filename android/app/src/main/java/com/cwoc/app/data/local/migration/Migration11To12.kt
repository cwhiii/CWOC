package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration 11→12: Adds server-computed thread_id column to chits table.
 *
 * The thread_id groups email messages into conversations server-side,
 * eliminating the need for expensive O(n²) client-side threading.
 * The value is the root message-ID of the email conversation.
 *
 * New columns:
 * - threadId: TEXT (nullable) — server-computed email thread grouping ID
 */
val MIGRATION_11_12 = object : Migration(11, 12) {
    override fun migrate(database: SupportSQLiteDatabase) {
        try {
            database.execSQL("ALTER TABLE chits ADD COLUMN threadId TEXT")
        } catch (e: Exception) {
            // Column may already exist — safe to ignore
        }
    }
}
