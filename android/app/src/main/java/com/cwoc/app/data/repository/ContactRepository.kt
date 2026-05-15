package com.cwoc.app.data.repository

import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.entity.ContactEntity
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository providing Flow-based access to contact data from the local Room database.
 *
 * Thin wrapper over ContactDao, exposing reactive queries for the UI layer.
 */
@Singleton
class ContactRepository @Inject constructor(
    private val contactDao: ContactDao
) {

    /** All contacts ordered alphabetically by given name. */
    fun getAllContacts(): Flow<List<ContactEntity>> = contactDao.getAllContacts()

    /** Get a single contact by ID. */
    suspend fun getById(id: String): ContactEntity? = contactDao.getById(id)
}
