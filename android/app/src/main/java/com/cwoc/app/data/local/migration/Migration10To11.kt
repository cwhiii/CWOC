package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration 10→11: Adds unified user-contact columns to the contacts table.
 *
 * New columns:
 * - username: TEXT (nullable) — login username, NULL for regular contacts
 * - is_admin: INTEGER NOT NULL DEFAULT 0 — whether the contact is an admin user
 * - is_active: INTEGER NOT NULL DEFAULT 1 — whether the user account is active
 * - is_user: INTEGER NOT NULL DEFAULT 0 — convenience flag for UI badge display
 *
 * Each ALTER TABLE is wrapped in try/catch for idempotency (safe to re-run).
 */
val MIGRATION_10_11 = object : Migration(10, 11) {
    override fun migrate(database: SupportSQLiteDatabase) {
        try {
            database.execSQL("ALTER TABLE contacts ADD COLUMN username TEXT")
        } catch (e: Exception) {
            // Column may already exist — safe to ignore
        }

        try {
            database.execSQL("ALTER TABLE contacts ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
        } catch (e: Exception) {
            // Column may already exist — safe to ignore
        }

        try {
            database.execSQL("ALTER TABLE contacts ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
        } catch (e: Exception) {
            // Column may already exist — safe to ignore
        }

        try {
            database.execSQL("ALTER TABLE contacts ADD COLUMN is_user INTEGER NOT NULL DEFAULT 0")
        } catch (e: Exception) {
            // Column may already exist — safe to ignore
        }
    }
}
