package com.cwoc.app.data.repository

import android.util.Log
import com.cwoc.app.data.local.dao.SettingsDao
import com.cwoc.app.data.local.entity.SettingsEntity
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import dagger.Lazy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository interface for settings persistence and sync.
 *
 * Provides reactive access to the local settings record, handles dirty tracking
 * on local updates, and triggers push sync when online.
 *
 * Settings use LWW (Last Writer Wins) on the entire record for conflict resolution.
 */
interface SettingsRepository {
    /** Reactive stream of the current settings. Filters out null (no settings yet). */
    val settings: Flow<SettingsEntity>

    /** Get the current settings snapshot, or null if none exist yet. */
    suspend fun get(): SettingsEntity?

    /**
     * Update settings locally. Marks the record as dirty with lastModified=now,
     * and triggers a push if the device is online.
     */
    suspend fun update(settings: SettingsEntity)

    /**
     * Replace local settings with the server's version (isDirty=false).
     * Used for LWW conflict resolution when the server returns a "merged" status.
     */
    suspend fun replaceWithServerVersion(settings: SettingsEntity)

    /** Clear the dirty flag on the local settings record. */
    suspend fun clearDirty()
}

/**
 * Implementation of [SettingsRepository] backed by Room via [SettingsDao].
 *
 * Injected via Hilt with SettingsDao, DirtyTracker, SyncPushEngine, and
 * ConnectivityMonitor as constructor parameters.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */
@Singleton
class SettingsRepositoryImpl @Inject constructor(
    private val settingsDao: SettingsDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: Lazy<SyncPushEngine>,
    private val connectivityMonitor: ConnectivityMonitor
) : SettingsRepository {

    companion object {
        private const val TAG = "CWOC_SETTINGS_REPO"
    }

    /**
     * Dedicated scope for fire-and-forget push operations.
     * Uses SupervisorJob so push failures don't cancel the scope or propagate to callers.
     * Uses IO dispatcher since push involves network I/O.
     */
    private val pushScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override val settings: Flow<SettingsEntity> =
        settingsDao.getSettings().filterNotNull()

    override suspend fun get(): SettingsEntity? =
        settingsDao.get()

    override suspend fun update(settings: SettingsEntity) {
        val now = Instant.now().toString()
        val dirtySettings = settings.copy(
            isDirty = true,
            lastModified = now
        )
        settingsDao.upsert(dirtySettings)
        dirtyTracker.markSettingsDirty()

        // Trigger push in background — fire-and-forget.
        // The local save is already committed; push is best-effort.
        // If push fails (network error, 401, etc.), the dirty tracker ensures
        // it will be retried by PushSyncWorker on next connectivity event.
        if (connectivityMonitor.isOnline.value) {
            pushScope.launch {
                try {
                    syncPushEngine.get().pushAll()
                } catch (e: Exception) {
                    Log.e(TAG, "Background push failed (settings will retry later): ${e.message}")
                }
            }
        }
    }

    override suspend fun replaceWithServerVersion(settings: SettingsEntity) {
        val cleanSettings = settings.copy(isDirty = false)
        settingsDao.replace(cleanSettings)
    }

    override suspend fun clearDirty() {
        settingsDao.clearDirty()
    }
}
