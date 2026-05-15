package com.cwoc.app.data.sync

import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.dao.SettingsDao
import com.cwoc.app.data.local.dao.SyncMetadataDao
import com.cwoc.app.data.local.entity.SyncMetadataEntity
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.repository.SyncResult
import com.google.gson.Gson
import java.io.IOException
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Orchestrates the sync flow: call API → map DTOs to entities → upsert into Room → update high-water mark.
 * Returns a SyncResult indicating success or the type of failure encountered.
 */
@Singleton
class SyncEngine @Inject constructor(
    private val apiService: CwocApiService,
    private val chitDao: ChitDao,
    private val contactDao: ContactDao,
    private val settingsDao: SettingsDao,
    private val syncMetadataDao: SyncMetadataDao,
    private val gson: Gson
) {

    /**
     * Perform a sync operation fetching all changes since the given version.
     *
     * @param since The server version to fetch changes from (0 for full sync)
     * @return SyncResult.Success with the new server version, or an error variant
     */
    suspend fun performSync(since: Int = 0): SyncResult {
        // Ensure sync metadata row exists
        if (syncMetadataDao.getMetadata() == null) {
            syncMetadataDao.upsert(SyncMetadataEntity())
        }

        syncMetadataDao.updateSyncStatus("syncing")

        try {
            val response = apiService.getSyncChanges(
                since = since,
                include = "chits,contacts,settings"
            )

            if (!response.isSuccessful) {
                syncMetadataDao.updateSyncStatus("error")
                return SyncResult.Error(response.code(), response.message())
            }

            val body = response.body()
            if (body == null) {
                syncMetadataDao.updateSyncStatus("error")
                return SyncResult.Error(0, "Empty response body")
            }

            val now = Instant.now().toString()

            // Upsert chits
            body.chits?.let { chits ->
                if (chits.isNotEmpty()) {
                    val entities = chits.map { it.toEntity(now, gson) }
                    chitDao.upsertAll(entities)
                }
            }

            // Upsert contacts
            body.contacts?.let { contacts ->
                if (contacts.isNotEmpty()) {
                    val entities = contacts.map { it.toEntity(now, gson) }
                    contactDao.upsertAll(entities)
                }
            }

            // Upsert settings
            body.settings?.let { settings ->
                val entity = settings.toEntity(now, gson)
                settingsDao.upsert(entity)
            }

            // Update high-water mark
            syncMetadataDao.updateHighWaterMark(body.server_version, now)
            syncMetadataDao.updateSyncStatus("idle")

            return SyncResult.Success(body.server_version)

        } catch (e: IOException) {
            syncMetadataDao.updateSyncStatus("error")
            return SyncResult.NetworkError(e.message ?: "Network error")
        } catch (e: Exception) {
            syncMetadataDao.updateSyncStatus("error")
            return SyncResult.NetworkError(e.message ?: "Unexpected error")
        }
    }
}
