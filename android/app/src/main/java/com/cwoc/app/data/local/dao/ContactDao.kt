package com.cwoc.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.cwoc.app.data.local.entity.ContactEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ContactDao {

    @Query("SELECT * FROM contacts WHERE deleted = 0 ORDER BY givenName ASC")
    fun getAllActive(): Flow<List<ContactEntity>>

    @Query("SELECT * FROM contacts WHERE deleted = 0 AND (givenName LIKE '%' || :query || '%' OR surname LIKE '%' || :query || '%' OR displayName LIKE '%' || :query || '%' OR emails LIKE '%' || :query || '%' OR phones LIKE '%' || :query || '%')")
    fun search(query: String): Flow<List<ContactEntity>>

    @Query("SELECT * FROM contacts WHERE id = :id")
    suspend fun getById(id: String): ContactEntity?

    @Query("SELECT * FROM contacts WHERE isDirty = 1")
    suspend fun getDirtyContacts(): List<ContactEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(contact: ContactEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(contacts: List<ContactEntity>)

    @Query("UPDATE contacts SET deleted = 1, modifiedDatetime = :now, isDirty = 1 WHERE id = :id")
    suspend fun markDeleted(id: String, now: String)

    @Query("UPDATE contacts SET isDirty = :isDirty, dirtyFields = :dirtyFields WHERE id = :id")
    suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String)

    @Query("UPDATE contacts SET syncVersion = :version WHERE id = :id")
    suspend fun updateSyncVersion(id: String, version: Int)

    @Query("UPDATE contacts SET hasUnviewedConflict = 1, conflictFields = :fields WHERE id = :id")
    suspend fun setConflictState(id: String, fields: String)

    // Legacy alias for backward compatibility
    @Query("SELECT * FROM contacts ORDER BY givenName ASC")
    fun getAllContacts(): Flow<List<ContactEntity>>
}
