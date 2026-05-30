package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL(
            "ALTER TABLE chits ADD COLUMN isDirty INTEGER NOT NULL DEFAULT 0"
        )
        database.execSQL(
            "ALTER TABLE chits ADD COLUMN dirtyFields TEXT DEFAULT '[]'"
        )
    }
}
