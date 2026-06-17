package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration 15→16: Adds locations column for multiple locations per chit.
 *
 * Each chit can now have multiple locations with labels, geocoded coordinates,
 * and a primary flag. The existing 'location' column is preserved as a
 * denormalized copy of the primary location address for backward compatibility.
 *
 * New column: locations TEXT
 * - JSON array of LocationEntry objects: [{"address": "...", "label": "...", "lat": 42.123, "lon": -71.456, "isPrimary": true}]
 *
 * Migration behavior:
 * - Adds locations column if missing
 * - Migrates existing single location to locations array with isPrimary=true
 */
val MIGRATION_15_16 = object : Migration(15, 16) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // Add locations column if missing
        database.execSQL("ALTER TABLE chits ADD COLUMN locations TEXT")

        // Migrate existing single locations to the new array format
        // Only migrate chits that have a location but no locations array
        database.execSQL("""
            UPDATE chits
            SET locations = (
                SELECT json_array(
                    json_object(
                        'address', chits.location,
                        'label', NULL,
                        'lat', NULL,
                        'lon', NULL,
                        'isPrimary', 1
                    )
                )
                FROM chits AS source
                WHERE source.id = chits.id
            )
            WHERE chits.location IS NOT NULL
            AND chits.location != ''
            AND (chits.locations IS NULL OR chits.locations = '')
        """.trimIndent())
    }
}