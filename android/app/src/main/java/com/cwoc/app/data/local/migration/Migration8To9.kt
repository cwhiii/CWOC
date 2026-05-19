package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration 8→9: Creates the standalone_alerts table for independent alarms, timers, and stopwatches.
 *
 * This table stores standalone alert entities fetched from /api/standalone-alerts and cached locally.
 * The CREATE TABLE IF NOT EXISTS + try/catch ensures idempotency.
 */
val MIGRATION_8_9 = object : Migration(8, 9) {
    override fun migrate(database: SupportSQLiteDatabase) {
        try {
            database.execSQL(
                """CREATE TABLE IF NOT EXISTS standalone_alerts (
                    id TEXT NOT NULL PRIMARY KEY,
                    type TEXT NOT NULL,
                    name TEXT,
                    data TEXT NOT NULL,
                    createdDatetime TEXT,
                    modifiedDatetime TEXT
                )""".trimIndent()
            )
        } catch (e: Exception) {
            // Table may already exist — safe to ignore
        }
    }
}
