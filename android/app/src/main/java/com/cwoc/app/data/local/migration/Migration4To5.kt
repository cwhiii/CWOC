package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration 4→5: Adds partial indexes for Phase 4 view queries.
 *
 * These indexes optimize the new C CAPTN view queries (Checklists, Projects,
 * Alerts, Indicators) and the Contact List alphabetical sort.
 */
val MIGRATION_4_5 = object : Migration(4, 5) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // Index for Checklists view: non-deleted chits with checklist data
        try {
            database.execSQL(
                """CREATE INDEX IF NOT EXISTS idx_chits_checklist 
                   ON chits(deleted, archived) 
                   WHERE checklist IS NOT NULL AND checklist != '' AND checklist != '[]'"""
            )
        } catch (e: Exception) { /* already exists or partial index not supported — fallback below */ }

        // Index for Projects view: project master chits with children
        try {
            database.execSQL(
                """CREATE INDEX IF NOT EXISTS idx_chits_project_master 
                   ON chits(deleted, archived, isProjectMaster) 
                   WHERE isProjectMaster = 1"""
            )
        } catch (e: Exception) { /* already exists */ }

        // Index for Alerts view: chits with alert data
        try {
            database.execSQL(
                """CREATE INDEX IF NOT EXISTS idx_chits_alerts 
                   ON chits(deleted, archived) 
                   WHERE alerts IS NOT NULL AND alerts != '' AND alerts != '[]'"""
            )
        } catch (e: Exception) { /* already exists */ }

        // Index for Indicators view: chits with health data
        try {
            database.execSQL(
                """CREATE INDEX IF NOT EXISTS idx_chits_health_data 
                   ON chits(deleted, archived) 
                   WHERE healthData IS NOT NULL AND healthData != '' AND healthData != '[]'"""
            )
        } catch (e: Exception) { /* already exists */ }

        // Index for location/map queries
        try {
            database.execSQL(
                """CREATE INDEX IF NOT EXISTS idx_chits_location 
                   ON chits(deleted, archived) 
                   WHERE location IS NOT NULL AND location != ''"""
            )
        } catch (e: Exception) { /* already exists */ }

        // Index for Contact List alphabetical sort
        try {
            database.execSQL(
                """CREATE INDEX IF NOT EXISTS idx_contacts_name 
                   ON contacts(givenName, surname) 
                   WHERE deleted = 0"""
            )
        } catch (e: Exception) { /* already exists */ }
    }
}
