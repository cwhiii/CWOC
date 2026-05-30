package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration 12→13: Creates the weather_forecasts table for local weather caching.
 *
 * Weather data is fetched from the CWOC server's /api/weather/forecasts endpoint
 * and cached locally so the weather screen works offline.
 *
 * New table: weather_forecasts
 * - locationLabel TEXT PRIMARY KEY — saved location label
 * - address TEXT — full address string
 * - dailyJson TEXT — JSON blob of Open-Meteo daily forecast data
 * - lastFetchedAt TEXT — ISO timestamp of last server fetch
 */
val MIGRATION_12_13 = object : Migration(12, 13) {
    override fun migrate(database: SupportSQLiteDatabase) {
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
    }
}
