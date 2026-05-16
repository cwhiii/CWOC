package com.cwoc.app.data.sync

import android.util.Log
import com.cwoc.app.data.local.entity.SettingsEntity
import com.cwoc.app.data.repository.SettingsRepository
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "CWOC_SETTINGS_CONFLICT"

/**
 * Handles settings conflict resolution using Last Writer Wins (LWW) on the entire record.
 *
 * When the server responds with status "merged" for a settings push, this resolver
 * replaces the local settings entirely with the server's version. The new values
 * are applied to the running app state immediately because SettingsRepository.settings
 * is backed by Room's reactive Flow — any observer (UI, ViewModel) will automatically
 * receive the updated values.
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 */
@Singleton
open class SettingsConflictResolver @Inject constructor(
    private val settingsRepository: SettingsRepository
) {

    /**
     * Resolves a settings conflict by replacing local settings with the server's version.
     *
     * This implements LWW (Last Writer Wins) on the entire settings record:
     * - The server's merged version completely overwrites the local record
     * - isDirty is cleared (the server has the authoritative version)
     * - The Room-backed Flow in SettingsRepository emits the new value immediately,
     *   causing any active UI observers to refresh with the updated settings
     *
     * @param serverSettings The settings entity returned by the server in the "merged" response
     */
    open suspend fun resolve(serverSettings: SettingsEntity) {
        Log.d(TAG, "Resolving settings conflict with LWW — replacing local with server version")
        settingsRepository.replaceWithServerVersion(serverSettings)
        Log.d(TAG, "Settings conflict resolved — local replaced, UI will refresh via Flow")
    }
}
