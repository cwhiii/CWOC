package com.cwoc.app.data.attachment

import android.content.Context
import com.cwoc.app.data.local.dao.AttachmentMetadataDao
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Interface for managing cached attachment files with LRU eviction.
 */
interface AttachmentCache {
    /** Maximum cache size in bytes. */
    val maxSizeBytes: Long

    /** Returns the cached file for the given attachment ID, or null if not cached. */
    suspend fun get(attachmentId: String): File?

    /** Writes data to cache, updates metadata, and evicts if over limit. */
    suspend fun put(attachmentId: String, data: ByteArray)

    /** Evicts least-recently-accessed files (excluding pending uploads) until under maxSizeBytes. */
    suspend fun evictIfNeeded()

    /** Removes the cached file from disk and clears localPath in metadata. */
    suspend fun remove(attachmentId: String)

    /** Returns the total size in bytes of all cached files. */
    suspend fun getTotalSize(): Long
}

/**
 * LRU-based attachment cache backed by the app's cache directory.
 *
 * Files are stored at: {cacheDir}/attachments/{attachmentId}
 * Eviction targets the least-recently-accessed files first, but never evicts
 * attachments that have pending uploads (not yet synced to server).
 */
@Singleton
class AttachmentCacheImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val attachmentMetadataDao: AttachmentMetadataDao
) : AttachmentCache {

    companion object {
        /** Default max cache size: 100 MB */
        const val DEFAULT_MAX_SIZE_BYTES: Long = 100L * 1024L * 1024L
    }

    override val maxSizeBytes: Long = DEFAULT_MAX_SIZE_BYTES

    private val cacheDir: File
        get() = File(context.cacheDir, "attachments").also { it.mkdirs() }

    override suspend fun get(attachmentId: String): File? {
        val metadata = attachmentMetadataDao.getById(attachmentId)
            ?: return null

        val localPath = metadata.localPath ?: return null
        val file = File(localPath)

        if (!file.exists()) {
            // File was deleted externally — clear the stale localPath
            attachmentMetadataDao.clearLocalPath(attachmentId)
            return null
        }

        // Update last accessed timestamp
        attachmentMetadataDao.updateLastAccessed(attachmentId, Instant.now().toString())
        return file
    }

    override suspend fun put(attachmentId: String, data: ByteArray) {
        val file = File(cacheDir, attachmentId)
        file.writeBytes(data)

        // Update metadata with local path and access time
        val now = Instant.now().toString()
        attachmentMetadataDao.updateLocalPath(attachmentId, file.absolutePath)
        attachmentMetadataDao.updateLastAccessed(attachmentId, now)

        // Evict if cache exceeds size limit
        evictIfNeeded()
    }

    override suspend fun evictIfNeeded() {
        var totalSize = getTotalSize()
        if (totalSize <= maxSizeBytes) return

        // Get all cached entries sorted by lastAccessedAt ASC (oldest first)
        val cachedEntries = attachmentMetadataDao.getAllCachedSortedByAccess()

        for (entry in cachedEntries) {
            if (totalSize <= maxSizeBytes) break

            // Never evict pending uploads
            if (entry.pendingUpload) continue

            val localPath = entry.localPath ?: continue
            val file = File(localPath)

            if (file.exists()) {
                val fileSize = file.length()
                file.delete()
                totalSize -= fileSize
            }

            // Clear localPath but retain metadata so file can be re-downloaded
            attachmentMetadataDao.clearLocalPath(entry.id)
        }
    }

    override suspend fun remove(attachmentId: String) {
        val metadata = attachmentMetadataDao.getById(attachmentId)
        if (metadata != null) {
            val localPath = metadata.localPath
            if (localPath != null) {
                val file = File(localPath)
                if (file.exists()) {
                    file.delete()
                }
            }
            attachmentMetadataDao.clearLocalPath(attachmentId)
        }
    }

    override suspend fun getTotalSize(): Long {
        val cachedEntries = attachmentMetadataDao.getAllCachedSortedByAccess()
        var total = 0L
        for (entry in cachedEntries) {
            val localPath = entry.localPath ?: continue
            val file = File(localPath)
            if (file.exists()) {
                total += file.length()
            }
        }
        return total
    }
}
