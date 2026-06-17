package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Baseline Migration 12→16: Covers all schema changes from v12 to v16.
 *
 * Consolidates previously separate migrations 12→13, 13→14, 14→15, 15→16:
 *   - 12→13: Creates weather_forecasts table
 *   - 13→14: Adds badges_completed_window to settings
 *   - 14→15: Creates badges table
 *   - 15→16: Adds locations column to chits and migrates existing location data
 *
 * All steps use IF NOT EXISTS / try-catch so this is safe to run even if
 * some columns/tables already exist from a partial migration.
 */
val MIGRATION_12_16 = object : Migration(12, 16) {
    override fun migrate(database: SupportSQLiteDatabase) {

        // ── 12→13: weather_forecasts table ─────────────────────────────────
        database.execSQL(
            """
            CREATE TABLE IF NOT EXISTS weather_forecasts (
                locationLabel TEXT NOT NULL PRIMARY KEY,
                address TEXT,
                dailyJson TEXT,
                lastFetchedAt TEXT
            )
            """.trimIndent()
        )

        // ── 13→14: badges_completed_window column ───────────────────────────
        try {
            database.execSQL(
                "ALTER TABLE settings ADD COLUMN badges_completed_window TEXT DEFAULT '3'"
            )
        } catch (_: Exception) {
            // Column already exists — safe to ignore
        }

        // ── 14→15: badges table ─────────────────────────────────────────────
        database.execSQL(
            """
            CREATE TABLE IF NOT EXISTS badges (
                id TEXT NOT NULL PRIMARY KEY,
                chitId TEXT NOT NULL,
                category TEXT NOT NULL,
                providerName TEXT NOT NULL,
                code TEXT NOT NULL,
                url TEXT NOT NULL,
                icon TEXT,
                label TEXT NOT NULL,
                status TEXT NOT NULL,
                detectedAt TEXT NOT NULL,
                lastUpdatedAt TEXT NOT NULL,
                completedAt TEXT,
                lastEmailSubject TEXT,
                cachedAt TEXT NOT NULL
            )
            """.trimIndent()
        )

        // ── 15→16: locations column on chits ────────────────────────────────
        try {
            database.execSQL("ALTER TABLE chits ADD COLUMN locations TEXT")
        } catch (_: Exception) {
            // Column already exists — safe to ignore
        }

        // Migrate existing single location to new JSON array format
        database.execSQL(
            """
            UPDATE chits
            SET locations = json_array(
                json_object(
                    'address', location,
                    'label', NULL,
                    'lat', NULL,
                    'lon', NULL,
                    'isPrimary', 1
                )
            )
            WHERE location IS NOT NULL
            AND location != ''
            AND (locations IS NULL OR locations = '')
            """.trimIndent()
        )
    }
}
