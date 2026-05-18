package com.cwoc.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.cwoc.app.data.local.entity.ContactEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ContactDao {

    @Query("SELECT * FROM contacts WHERE deleted = 0 ORDER BY favorite DESC, displayName COLLATE NOCASE ASC")
    fun getAllActive(): Flow<List<ContactEntity>>

    @Query("""SELECT * FROM contacts WHERE deleted = 0 AND (
        displayName LIKE '%' || :query || '%' OR givenName LIKE '%' || :query || '%' OR 
        surname LIKE '%' || :query || '%' OR nickname LIKE '%' || :query || '%' OR 
        organization LIKE '%' || :query || '%' OR socialContext LIKE '%' || :query || '%' OR 
        emails LIKE '%' || :query || '%' OR phones LIKE '%' || :query || '%' OR 
        addresses LIKE '%' || :query || '%' OR callSigns LIKE '%' || :query || '%' OR 
        xHandles LIKE '%' || :query || '%' OR websites LIKE '%' || :query || '%' OR 
        dates LIKE '%' || :query || '%' OR notes LIKE '%' || :query || '%' OR 
        tags LIKE '%' || :query || '%')
        ORDER BY favorite DESC, displayName COLLATE NOCASE ASC""")
    fun searchAll(query: String): Flow<List<ContactEntity>>

    // Legacy search (limited fields) — kept for backward compatibility
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

    @Query("UPDATE contacts SET deleted = 1, deletedDatetime = :now, modifiedDatetime = :now, isDirty = 1 WHERE id = :id")
    suspend fun markDeleted(id: String, now: String)

    @Query("UPDATE contacts SET isDirty = :isDirty, dirtyFields = :dirtyFields WHERE id = :id")
    suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String)

    @Query("UPDATE contacts SET syncVersion = :version WHERE id = :id")
    suspend fun updateSyncVersion(id: String, version: Int)

    @Query("UPDATE contacts SET hasUnviewedConflict = 1, conflictFields = :fields WHERE id = :id")
    suspend fun setConflictState(id: String, fields: String)

    // ─── Grouped mode queries ───────────────────────────────────────────────

    @Query("SELECT * FROM contacts WHERE deleted = 0 AND favorite = 1 ORDER BY displayName COLLATE NOCASE ASC")
    fun getFavorites(): Flow<List<ContactEntity>>

    @Query("SELECT * FROM contacts WHERE deleted = 0 AND favorite = 0 AND sharedToVault = 0 ORDER BY displayName COLLATE NOCASE ASC")
    fun getNonFavoriteOwned(): Flow<List<ContactEntity>>

    @Query("SELECT * FROM contacts WHERE deleted = 0 AND sharedToVault = 1 AND ownerId != :currentUserId ORDER BY displayName COLLATE NOCASE ASC")
    fun getVaultContacts(currentUserId: String): Flow<List<ContactEntity>>

    // ─── Trash queries ──────────────────────────────────────────────────────

    @Query("SELECT * FROM contacts WHERE deleted = 1 ORDER BY deletedDatetime DESC")
    fun getDeletedContacts(): Flow<List<ContactEntity>>

    @Query("UPDATE contacts SET deleted = 0, deletedDatetime = null, isDirty = 1, modifiedDatetime = :now WHERE id = :id")
    suspend fun restoreFromTrash(id: String, now: String)

    @Query("DELETE FROM contacts WHERE id = :id")
    suspend fun purge(id: String)

    // ─── Favorite toggle ────────────────────────────────────────────────────

    @Query("UPDATE contacts SET favorite = NOT favorite, modifiedDatetime = :now, isDirty = 1 WHERE id = :id")
    suspend fun toggleFavorite(id: String, now: String)

    @Query("SELECT favorite FROM contacts WHERE id = :id")
    suspend fun getFavoriteState(id: String): Boolean?

    // Legacy alias for backward compatibility
    @Query("SELECT * FROM contacts ORDER BY givenName ASC")
    fun getAllContacts(): Flow<List<ContactEntity>>
}
