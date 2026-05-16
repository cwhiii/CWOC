package com.cwoc.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.cwoc.app.data.local.entity.AttachmentMetadata

@Dao
interface AttachmentMetadataDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(attachment: AttachmentMetadata)

    @Query("SELECT * FROM attachment_metadata WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): AttachmentMetadata?

    @Query("SELECT * FROM attachment_metadata WHERE url = :url LIMIT 1")
    suspend fun getByUrl(url: String): AttachmentMetadata?

    @Query("SELECT * FROM attachment_metadata WHERE chitId = :chitId")
    suspend fun getByChitId(chitId: String): List<AttachmentMetadata>

    @Query("SELECT * FROM attachment_metadata WHERE pendingUpload = 1")
    suspend fun getPendingUploads(): List<AttachmentMetadata>

    @Query("SELECT * FROM attachment_metadata WHERE localPath IS NOT NULL ORDER BY lastAccessedAt ASC")
    suspend fun getAllCachedSortedByAccess(): List<AttachmentMetadata>

    @Query("UPDATE attachment_metadata SET localPath = :localPath WHERE id = :id")
    suspend fun updateLocalPath(id: String, localPath: String?)

    @Query("UPDATE attachment_metadata SET lastAccessedAt = :timestamp WHERE id = :id")
    suspend fun updateLastAccessed(id: String, timestamp: String)

    @Query("UPDATE attachment_metadata SET url = :url, pendingUpload = 0 WHERE id = :id")
    suspend fun updateAfterUpload(id: String, url: String)

    @Query("UPDATE attachment_metadata SET localPath = NULL WHERE id = :id")
    suspend fun clearLocalPath(id: String)
}
