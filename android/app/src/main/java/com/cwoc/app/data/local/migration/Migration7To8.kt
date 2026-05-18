package com.cwoc.app.data.local.migration

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Migration 7→8: Adds settings columns for full Android Settings parity with the web client.
 *
 * SettingsEntity: +25 columns covering General, Views, Email, and Admin tabs.
 *
 * Note: Some columns (default_share_contacts, checklist_autosave, autosave_desktop,
 * autosave_mobile, show_map_thumbnails) were already added in Migration6To7 using
 * camelCase property names. This migration adds the remaining columns using snake_case
 * @ColumnInfo names as specified in the design. The try/catch pattern ensures idempotency
 * — if a column already exists, the ALTER TABLE will fail silently.
 */
val MIGRATION_7_8 = object : Migration(7, 8) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // === SettingsEntity: New columns for settings parity ===

        // General tab
        try { database.execSQL("ALTER TABLE settings ADD COLUMN clock_orientation TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN landing_view TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN hidden_views TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN prefer_google_maps TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN show_tab_counts TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN combine_alerts TEXT DEFAULT NULL") } catch (e: Exception) {}

        // Views tab
        try { database.execSQL("ALTER TABLE settings ADD COLUMN projects_show_child_count TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN projects_show_checklist_count TEXT DEFAULT NULL") } catch (e: Exception) {}

        // Email tab
        try { database.execSQL("ALTER TABLE settings ADD COLUMN email_check_interval TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN email_max_pull TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN email_signature TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN email_bundles_count_display TEXT DEFAULT NULL") } catch (e: Exception) {}

        // Admin tab
        try { database.execSQL("ALTER TABLE settings ADD COLUMN instance_name TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN welcome_message TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN audit_log_pruning_enabled TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN tailscale_enabled TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN tailscale_auth_key TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN ntfy_enabled TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN ha_enabled TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN ha_poll_interval TEXT DEFAULT NULL") } catch (e: Exception) {}
        try { database.execSQL("ALTER TABLE settings ADD COLUMN kiosk_selected_tags TEXT DEFAULT NULL") } catch (e: Exception) {}
    }
}
