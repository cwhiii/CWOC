package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // 1. Create contacts table
        database.execSQL("""
            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT NOT NULL PRIMARY KEY,
                givenName TEXT NOT NULL,
                surname TEXT,
                middleNames TEXT,
                prefix TEXT,
                suffix TEXT,
                nickname TEXT,
                displayName TEXT,
                phones TEXT,
                emails TEXT,
                addresses TEXT,
                callSigns TEXT,
                xHandles TEXT,
                websites TEXT,
                dates TEXT,
                hasSignal INTEGER NOT NULL DEFAULT 0,
                signalUsername TEXT,
                pgpKey TEXT,
                favorite INTEGER NOT NULL DEFAULT 0,
                color TEXT,
                organization TEXT,
                socialContext TEXT,
                imageUrl TEXT,
                notes TEXT,
                tags TEXT,
                sharedToVault INTEGER NOT NULL DEFAULT 0,
                createdDatetime TEXT,
                modifiedDatetime TEXT,
                syncVersion INTEGER NOT NULL DEFAULT 0,
                lastSyncedAt TEXT,
                isDirty INTEGER NOT NULL DEFAULT 0,
                dirtyFields TEXT DEFAULT '[]',
                deleted INTEGER NOT NULL DEFAULT 0,
                hasUnviewedConflict INTEGER NOT NULL DEFAULT 0,
                conflictFields TEXT
            )
        """.trimIndent())

        // 2. Create settings table
        database.execSQL("""
            CREATE TABLE IF NOT EXISTS settings (
                userId TEXT NOT NULL PRIMARY KEY,
                timeFormat TEXT,
                sex TEXT,
                snoozeLength TEXT,
                defaultFilters TEXT,
                alarmOrientation TEXT,
                activeClocks TEXT,
                savedLocations TEXT,
                tags TEXT,
                customColors TEXT,
                visualIndicators TEXT,
                chitOptions TEXT,
                calendarSnap TEXT,
                weekStartDay TEXT,
                workStartHour TEXT,
                workEndHour TEXT,
                workDays TEXT,
                enabledPeriods TEXT,
                customDaysCount TEXT,
                allViewStartHour TEXT,
                allViewEndHour TEXT,
                dayScrollToHour TEXT,
                username TEXT,
                unitSystem TEXT,
                habitsSuccessWindow TEXT,
                overdueBorderColor TEXT,
                blockedBorderColor TEXT,
                hidDeclined TEXT,
                defaultShowHabitsOnCalendar TEXT,
                defaultTimezone TEXT,
                defaultView TEXT,
                viewOrder TEXT,
                syncVersion INTEGER NOT NULL DEFAULT 0,
                lastSyncedAt TEXT,
                isDirty INTEGER NOT NULL DEFAULT 0,
                lastModified TEXT
            )
        """.trimIndent())

        // 3. Create attachment_metadata table
        database.execSQL("""
            CREATE TABLE IF NOT EXISTS attachment_metadata (
                id TEXT NOT NULL PRIMARY KEY,
                chitId TEXT NOT NULL,
                url TEXT,
                filename TEXT NOT NULL,
                sizeBytes INTEGER NOT NULL DEFAULT 0,
                mimeType TEXT,
                localPath TEXT,
                pendingUpload INTEGER NOT NULL DEFAULT 0,
                lastAccessedAt TEXT,
                createdAt TEXT NOT NULL
            )
        """.trimIndent())

        // 4. Add conflictFields column to chits table
        database.execSQL(
            "ALTER TABLE chits ADD COLUMN conflictFields TEXT DEFAULT NULL"
        )
    }
}
