package com.cwoc.app.data.repository

import android.content.Context
import android.net.Uri
import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.mapper.ContactImageManager
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.ImportResultDto
import com.cwoc.app.data.remote.SwitchableUserDto
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import dagger.Lazy
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Interface for contact CRUD operations with dirty tracking and push sync.
 */
interface ContactRepository {
    /** All non-deleted contacts as a reactive Flow, ordered by favorite DESC then displayName. */
    val allContacts: Flow<List<ContactEntity>>

    /** Search contacts across ALL fields. */
    fun searchContacts(query: String): Flow<List<ContactEntity>>

    /** Get a single contact by ID. */
    suspend fun getById(id: String): ContactEntity?

    /** Create a new contact. Generates UUID, sets timestamps, marks dirty, pushes if online. */
    suspend fun create(contact: ContactEntity)

    /** Update an existing contact. Marks dirty with changed fields, pushes if online. */
    suspend fun update(contact: ContactEntity, changedFields: Set<String>)

    /** Soft-delete a contact. Marks deleted=true, dirty with ["deleted"], pushes if online. */
    suspend fun delete(contactId: String)

    /** Toggle favorite status locally and via API. Returns new favorite state. */
    suspend fun toggleFavorite(contactId: String): Boolean

    /** Upload a profile image for a contact. Returns the new image URL or null on failure. */
    suspend fun uploadImage(contactId: String, imageFile: File): String?

    /** Delete a contact's profile image. */
    suspend fun deleteImage(contactId: String)

    /** Import contacts from a file URI. Returns import result summary. */
    suspend fun importFile(context: Context, uri: Uri, filename: String): ImportResultDto?

    /** Export all contacts. Returns the downloaded file or null. */
    suspend fun exportAll(context: Context, format: String): File?

    /** Export a single contact as .vcf. Returns the downloaded file or null. */
    suspend fun exportSingle(context: Context, contactId: String): File?

    /** Get soft-deleted contacts for trash view. */
    fun getTrashContacts(): Flow<List<ContactEntity>>

    /** Restore a contact from trash. */
    suspend fun restoreFromTrash(contactId: String)

    /** Permanently purge a contact from trash. */
    suspend fun purgeFromTrash(contactId: String)

    /** Get list of switchable users from API. */
    suspend fun getSwitchableUsers(): List<SwitchableUserDto>

    /** Get favorites contacts. */
    fun getFavorites(): Flow<List<ContactEntity>>

    /** Get non-favorite owned contacts. */
    fun getNonFavoriteOwned(): Flow<List<ContactEntity>>

    /** Get vault contacts from other users. */
    fun getVaultContacts(currentUserId: String): Flow<List<ContactEntity>>
}

/**
 * Implementation of [ContactRepository] backed by Room via [ContactDao].
 */
@Singleton
class ContactRepositoryImpl @Inject constructor(
    private val contactDao: ContactDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: Lazy<SyncPushEngine>,
    private val connectivityMonitor: ConnectivityMonitor,
    private val apiService: Lazy<CwocApiService>,
    @ApplicationContext private val appContext: Context
) : ContactRepository {

    private val pushScope = CoroutineScope(Dispatchers.IO)

    override val allContacts: Flow<List<ContactEntity>>
        get() = contactDao.getAllActive()

    override fun searchContacts(query: String): Flow<List<ContactEntity>> =
        contactDao.searchAll(query)

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

    override suspend fun toggleFavorite(contactId: String): Boolean {
        val now = Instant.now().toString()
        contactDao.toggleFavorite(contactId, now)
        dirtyTracker.markContactDirty(contactId, setOf("favorite"))
        triggerPushIfOnline()
        return contactDao.getFavoriteState(contactId) ?: false
    }

    override suspend fun uploadImage(contactId: String, imageFile: File): String? {
        return withContext(Dispatchers.IO) {
            try {
                val mimeType = ContactImageManager.getMimeType(imageFile)
                val requestBody = imageFile.asRequestBody(mimeType.toMediaType())
                val part = MultipartBody.Part.createFormData("file", imageFile.name, requestBody)
                val response = apiService.get().uploadContactImage(contactId, part)
                if (response.isSuccessful) {
                    response.body()?.get("image_url")
                } else null
            } catch (_: Exception) {
                null
            }
        }
    }

    override suspend fun deleteImage(contactId: String) {
        withContext(Dispatchers.IO) {
            try {
                apiService.get().deleteContactImage(contactId)
            } catch (_: Exception) {}
        }
    }

    override suspend fun importFile(context: Context, uri: Uri, filename: String): ImportResultDto? {
        return withContext(Dispatchers.IO) {
            try {
                val inputStream = context.contentResolver.openInputStream(uri) ?: return@withContext null
                val bytes = inputStream.readBytes()
                inputStream.close()

                val mimeType = if (filename.endsWith(".csv")) "text/csv" else "text/vcard"
                val requestBody = bytes.toRequestBody(mimeType.toMediaType())
                val part = MultipartBody.Part.createFormData("file", filename, requestBody)
                val response = apiService.get().importContacts(part)
                if (response.isSuccessful) response.body() else null
            } catch (_: Exception) {
                null
            }
        }
    }

    override suspend fun exportAll(context: Context, format: String): File? {
        return withContext(Dispatchers.IO) {
            try {
                val response = apiService.get().exportContacts(format)
                if (response.isSuccessful) {
                    val body = response.body() ?: return@withContext null
                    val ext = if (format == "csv") "csv" else "vcf"
                    val file = File(context.getExternalFilesDir(null), "contacts_export.$ext")
                    file.outputStream().use { fos ->
                        body.byteStream().copyTo(fos)
                    }
                    file
                } else null
            } catch (_: Exception) {
                null
            }
        }
    }

    override suspend fun exportSingle(context: Context, contactId: String): File? {
        return withContext(Dispatchers.IO) {
            try {
                val response = apiService.get().exportSingleContact(contactId, "vcf")
                if (response.isSuccessful) {
                    val body = response.body() ?: return@withContext null
                    val file = File(context.getExternalFilesDir(null), "contact_$contactId.vcf")
                    file.outputStream().use { fos ->
                        body.byteStream().copyTo(fos)
                    }
                    file
                } else null
            } catch (_: Exception) {
                null
            }
        }
    }

    override fun getTrashContacts(): Flow<List<ContactEntity>> =
        contactDao.getDeletedContacts()

    override suspend fun restoreFromTrash(contactId: String) {
        val now = Instant.now().toString()
        contactDao.restoreFromTrash(contactId, now)
        // Also call API if online
        if (connectivityMonitor.isOnline.value) {
            pushScope.launch {
                try { apiService.get().restoreContact(contactId) } catch (_: Exception) {}
            }
        }
        dirtyTracker.markContactDirty(contactId, setOf("deleted"))
        triggerPushIfOnline()
    }

    override suspend fun purgeFromTrash(contactId: String) {
        contactDao.purge(contactId)
        // Also call API if online
        if (connectivityMonitor.isOnline.value) {
            pushScope.launch {
                try { apiService.get().purgeContact(contactId) } catch (_: Exception) {}
            }
        }
    }

    override suspend fun getSwitchableUsers(): List<SwitchableUserDto> {
        return withContext(Dispatchers.IO) {
            try {
                val response = apiService.get().getSwitchableUsers()
                if (response.isSuccessful) response.body() ?: emptyList() else emptyList()
            } catch (_: Exception) {
                emptyList()
            }
        }
    }

    override fun getFavorites(): Flow<List<ContactEntity>> =
        contactDao.getFavorites()

    override fun getNonFavoriteOwned(): Flow<List<ContactEntity>> =
        contactDao.getNonFavoriteOwned()

    override fun getVaultContacts(currentUserId: String): Flow<List<ContactEntity>> =
        contactDao.getVaultContacts(currentUserId)

    private fun triggerPushIfOnline() {
        if (connectivityMonitor.isOnline.value) {
            pushScope.launch {
                syncPushEngine.get().pushAll()
            }
        }
    }
}
