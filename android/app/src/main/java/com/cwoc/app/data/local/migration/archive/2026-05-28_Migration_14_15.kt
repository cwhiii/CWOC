package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration 14→15: Creates the badges table for local badge caching.
 *
 * Badge data is fetched from GET /api/badges and cached locally so the
 * Badges screen works offline. Each row represents a detected smart link
 * (package tracking, flight, hotel, etc.) with its current status.
 *
 * New table: badges
 * - id TEXT PRIMARY KEY — unique badge ID from server
 * - chitId TEXT — source email chit ID
 * - category TEXT — badge category (Package, Flight, Hotel, etc.)
 * - providerName TEXT — tracking provider name
 * - code TEXT — detected tracking/confirmation code
 * - url TEXT — external tracking URL
 * - icon TEXT (nullable) — provider icon path
 * - label TEXT — action button label
 * - status TEXT — "active", "completed", or "dismissed"
 * - detectedAt TEXT — ISO timestamp of first detection
 * - lastUpdatedAt TEXT — ISO timestamp of most recent update
 * - completedAt TEXT (nullable) — ISO timestamp of completion/dismissal
 * - lastEmailSubject TEXT (nullable) — most recent email subject
 * - cachedAt TEXT — ISO timestamp of when this was last fetched from server
 */
val MIGRATION_14_15 = object : Migration(14, 15) {
    override fun migrate(database: SupportSQLiteDatabase) {
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
    }
}
