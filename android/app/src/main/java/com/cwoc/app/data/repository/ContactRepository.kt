package com.cwoc.app.data.repository

import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import dagger.Lazy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Interface for contact CRUD operations with dirty tracking and push sync.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */
interface ContactRepository {
    /** All non-deleted contacts as a reactive Flow, ordered by givenName. */
    val allContacts: Flow<List<ContactEntity>>

    /** Search contacts by name, email, or phone. */
    fun searchContacts(query: String): Flow<List<ContactEntity>>

    /** Get a single contact by ID. */
    suspend fun getById(id: String): ContactEntity?

    /** Create a new contact. Generates UUID, sets timestamps, marks dirty, pushes if online. */
    suspend fun create(contact: ContactEntity)

    /** Update an existing contact. Marks dirty with changed fields, pushes if online. */
    suspend fun update(contact: ContactEntity, changedFields: Set<String>)

    /** Soft-delete a contact. Marks deleted=true, dirty with ["deleted"], pushes if online. */
    suspend fun delete(contactId: String)
}

/**
 * Implementation of [ContactRepository] backed by Room via [ContactDao].
 *
 * - create(): generates UUID, sets createdDatetime/modifiedDatetime, upserts to Room,
 *   marks dirty with all populated fields, triggers immediate push when online.
 * - update(): upserts to Room, marks dirty with changed fields, pushes if online.
 * - delete(): calls contactDao.markDeleted, marks dirty with ["deleted"], pushes if online.
 */
@Singleton
class ContactRepositoryImpl @Inject constructor(
    private val contactDao: ContactDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: Lazy<SyncPushEngine>,
    private val connectivityMonitor: ConnectivityMonitor
) : ContactRepository {

    private val pushScope = CoroutineScope(Dispatchers.IO)

    override val allContacts: Flow<List<ContactEntity>>
        get() = contactDao.getAllActive()

    override fun searchContacts(query: String): Flow<List<ContactEntity>> =
        contactDao.search(query)

    override suspend fun getById(id: String): ContactEntity? =
        contactDao.getById(id)

    override suspend fun create(contact: ContactEntity) {
        val now = Instant.now().toString()
        val id = if (contact.id.isBlank()) UUID.randomUUID().toString() else contact.id

        val entity = contact.copy(
            id = id,
            createdDatetime = now,
            modifiedDatetime = now,
            isDirty = true,
            dirtyFields = "[]",
            deleted = false
        )

        contactDao.upsert(entity)

        // Mark dirty with all populated fields
        val allFields = buildSet {
            if (entity.givenName.isNotBlank()) add("givenName")
            if (!entity.surname.isNullOrBlank()) add("surname")
            if (!entity.middleNames.isNullOrBlank()) add("middleNames")
            if (!entity.prefix.isNullOrBlank()) add("prefix")
            if (!entity.suffix.isNullOrBlank()) add("suffix")
            if (!entity.nickname.isNullOrBlank()) add("nickname")
            if (!entity.displayName.isNullOrBlank()) add("displayName")
            if (!entity.phones.isNullOrBlank()) add("phones")
            if (!entity.emails.isNullOrBlank()) add("emails")
            if (!entity.addresses.isNullOrBlank()) add("addresses")
            if (!entity.callSigns.isNullOrBlank()) add("callSigns")
            if (!entity.xHandles.isNullOrBlank()) add("xHandles")
            if (!entity.websites.isNullOrBlank()) add("websites")
            if (!entity.dates.isNullOrBlank()) add("dates")
            if (entity.hasSignal) add("hasSignal")
            if (!entity.signalUsername.isNullOrBlank()) add("signalUsername")
            if (!entity.pgpKey.isNullOrBlank()) add("pgpKey")
            if (entity.favorite) add("favorite")
            if (!entity.color.isNullOrBlank()) add("color")
            if (!entity.organization.isNullOrBlank()) add("organization")
            if (!entity.socialContext.isNullOrBlank()) add("socialContext")
            if (!entity.imageUrl.isNullOrBlank()) add("imageUrl")
            if (!entity.notes.isNullOrBlank()) add("notes")
            if (!entity.tags.isNullOrEmpty()) add("tags")
            if (entity.sharedToVault) add("sharedToVault")
        }

        dirtyTracker.markContactDirty(id, allFields)
        triggerPushIfOnline()
    }

    override suspend fun update(contact: ContactEntity, changedFields: Set<String>) {
        val now = Instant.now().toString()
        val entity = contact.copy(modifiedDatetime = now)

        contactDao.upsert(entity)
        dirtyTracker.markContactDirty(entity.id, changedFields)
        triggerPushIfOnline()
    }

    override suspend fun delete(contactId: String) {
        val now = Instant.now().toString()
        contactDao.markDeleted(contactId, now)
        dirtyTracker.markContactDirty(contactId, setOf("deleted"))
        triggerPushIfOnline()
    }

    /**
     * Triggers an immediate push if the device is currently online.
     * Launches in a separate coroutine scope so the caller doesn't block on the push.
     */
    private fun triggerPushIfOnline() {
        if (connectivityMonitor.isOnline.value) {
            pushScope.launch {
                syncPushEngine.get().pushAll()
            }
        }
    }
}
