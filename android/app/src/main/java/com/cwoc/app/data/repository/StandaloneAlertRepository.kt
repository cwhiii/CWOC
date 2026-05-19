package com.cwoc.app.data.repository

import com.cwoc.app.data.local.dao.StandaloneAlertDao
import com.cwoc.app.data.local.entity.StandaloneAlertEntity
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.dto.StandaloneAlertDto
import com.google.gson.Gson
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for standalone alerts (alarms, timers, stopwatches).
 *
 * Wraps the /api/standalone-alerts API and local Room cache.
 * On fetch failure, returns existing cached data without error state.
 */
@Singleton
class StandaloneAlertRepository @Inject constructor(
    private val apiService: CwocApiService,
    private val standaloneAlertDao: StandaloneAlertDao,
    private val gson: Gson
) {

    /**
     * Fetches all standalone alerts from the API and replaces the local cache.
     * On failure, silently returns — existing cached data remains available via flows.
     */
    suspend fun fetchAndCache() {
        try {
            val response = apiService.getStandaloneAlerts()
            if (response.isSuccessful) {
                val dtos = response.body() ?: emptyList()
                val entities = dtos.map { it.toEntity() }
                standaloneAlertDao.deleteAll()
                standaloneAlertDao.insertAll(entities)
            }
        } catch (_: Exception) {
            // On failure, return existing cached data without error state
        }
    }

    /** All standalone alerts as a reactive Flow from local cache. */
    fun getAll(): Flow<List<StandaloneAlertEntity>> = standaloneAlertDao.getAll()

    /** Standalone alerts filtered by type as a reactive Flow from local cache. */
    fun getByType(type: String): Flow<List<StandaloneAlertEntity>> = standaloneAlertDao.getByType(type)

    /**
     * Creates a new standalone alert via POST API.
     * On success, inserts into local cache and returns the created DTO.
     * On failure, returns a Result.failure with the exception.
     */
    suspend fun create(type: String, name: String?, data: Map<String, Any?>): Result<StandaloneAlertDto> {
        return try {
            val body = mutableMapOf<String, Any?>(
                "_type" to type,
                "name" to name,
                "data" to data
            )
            val response = apiService.createStandaloneAlert(body)
            if (response.isSuccessful) {
                val dto = response.body()!!
                standaloneAlertDao.insert(dto.toEntity())
                Result.success(dto)
            } else {
                Result.failure(Exception("Create failed: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Updates an existing standalone alert via PUT API.
     * On success, re-fetches to update the local cache.
     * On failure, returns a Result.failure with the exception.
     */
    suspend fun update(id: String, body: Map<String, Any?>): Result<Unit> {
        return try {
            val response = apiService.updateStandaloneAlert(id, body)
            if (response.isSuccessful) {
                // Re-fetch all to keep local cache consistent since PUT doesn't return updated entity
                fetchAndCache()
                Result.success(Unit)
            } else {
                Result.failure(Exception("Update failed: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Deletes a standalone alert via DELETE API.
     * On success, removes from local cache.
     * On failure, returns a Result.failure with the exception.
     */
    suspend fun delete(id: String): Result<Unit> {
        return try {
            val response = apiService.deleteStandaloneAlert(id)
            if (response.isSuccessful) {
                standaloneAlertDao.deleteById(id)
                Result.success(Unit)
            } else {
                Result.failure(Exception("Delete failed: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Converts a StandaloneAlertDto to a StandaloneAlertEntity for Room storage. */
    private fun StandaloneAlertDto.toEntity(): StandaloneAlertEntity {
        return StandaloneAlertEntity(
            id = id,
            type = type,
            name = name,
            data = gson.toJson(data),
            createdDatetime = createdDatetime,
            modifiedDatetime = modifiedDatetime
        )
    }
}
