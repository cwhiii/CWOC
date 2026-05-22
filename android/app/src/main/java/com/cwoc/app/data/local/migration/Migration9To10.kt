package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration 9→10: Creates the saved_searches table for persisting user-saved search queries.
 *
 * Columns match SavedSearchEntity:
 * - id: INTEGER PRIMARY KEY AUTOINCREMENT
 * - query: TEXT NOT NULL
 * - createdAt: TEXT NOT NULL (ISO datetime string)
 *
 * The CREATE TABLE IF NOT EXISTS + try/catch ensures idempotency.
 */
val MIGRATION_9_10 = object : Migration(9, 10) {
    override fun migrate(database: SupportSQLiteDatabase) {
        try {
            database.execSQL(
                """CREATE TABLE IF NOT EXISTS saved_searches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    query TEXT NOT NULL,
                    createdAt TEXT NOT NULL
                )""".trimIndent()
            )
        } catch (e: Exception) {
            // Table may already exist — safe to ignore
        }
    }
}
