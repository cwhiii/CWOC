package com.cwoc.app.data.repository

import com.cwoc.app.data.remote.BundleDto
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.dto.CreateBundleRequest
import com.cwoc.app.data.remote.dto.ReorderBundlesRequest
import com.cwoc.app.data.remote.dto.UpdateBundleRequest
import dagger.Lazy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for bundle CRUD operations via the API.
 * Bundles are not synced via the DirtyTracker/SyncPushEngine system —
 * they are managed entirely through direct API calls.
 */
interface BundleRepository {
    /** Reactive list of bundles for UI consumption. */
    val bundles: StateFlow<List<BundleDto>>

    /** Fetch all bundles from the API and update the local state. */
    suspend fun fetchBundles(): Result<List<BundleDto>>

    /** Create a new bundle. */
    suspend fun createBundle(
        name: String,
        description: String?,
        color: String?,
        showInOmni: Boolean
    ): Result<BundleDto>

    /** Update an existing bundle. */
    suspend fun updateBundle(
        id: String,
        name: String?,
        description: String?,
        color: String?,
        showInOmni: Boolean?
    ): Result<BundleDto>

    /** Delete a bundle by ID. */
    suspend fun deleteBundle(id: String): Result<Unit>

    /** Disable an auto-bundle (hides it and strips tags from classified emails). */
    suspend fun disableBundle(id: String): Result<Unit>

    /** Enable a previously disabled bundle. */
    suspend fun enableBundle(id: String): Result<Unit>

    /** Reorder bundles by providing an ordered list of IDs. */
    suspend fun reorderBundles(orderedIds: List<String>): Result<Unit>
}

/**
 * Implementation of [BundleRepository] backed by [CwocApiService].
 * Maintains a [MutableStateFlow] of bundles that is updated after each mutation.
 */
@Singleton
class BundleRepositoryImpl @Inject constructor(
    private val apiService: Lazy<CwocApiService>
) : BundleRepository {

    private val _bundles = MutableStateFlow<List<BundleDto>>(emptyList())
    override val bundles: StateFlow<List<BundleDto>> = _bundles.asStateFlow()

    override suspend fun fetchBundles(): Result<List<BundleDto>> {
        return try {
            val response = apiService.get().getBundles()
            if (response.isSuccessful) {
                val list = response.body() ?: emptyList()
                _bundles.value = list
                Result.success(list)
            } else {
                Result.failure(Exception("Failed to fetch bundles: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun createBundle(
        name: String,
        description: String?,
        color: String?,
        showInOmni: Boolean
    ): Result<BundleDto> {
        return try {
            val request = CreateBundleRequest(
                name = name,
                description = description,
                color = color,
                showInOmni = showInOmni
            )
            val response = apiService.get().createBundle(request)
            if (response.isSuccessful) {
                val bundle = response.body()!!
                // Refresh the full list to get correct ordering
                fetchBundles()
                Result.success(bundle)
            } else {
                Result.failure(Exception("Failed to create bundle: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateBundle(
        id: String,
        name: String?,
        description: String?,
        color: String?,
        showInOmni: Boolean?
    ): Result<BundleDto> {
        return try {
            val request = UpdateBundleRequest(
                name = name,
                description = description,
                color = color,
                showInOmni = showInOmni
            )
            val response = apiService.get().updateBundle(id, request)
            if (response.isSuccessful) {
                val updated = response.body()!!
                // Update the local state in-place
                _bundles.value = _bundles.value.map { if (it.id == id) updated else it }
                Result.success(updated)
            } else {
                Result.failure(Exception("Failed to update bundle: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteBundle(id: String): Result<Unit> {
        return try {
            val response = apiService.get().deleteBundle(id)
            if (response.isSuccessful) {
                // Remove from local state
                _bundles.value = _bundles.value.filter { it.id != id }
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to delete bundle: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun disableBundle(id: String): Result<Unit> {
        return try {
            val response = apiService.get().disableBundle(id)
            if (response.isSuccessful) {
                // Refresh to get updated display_order
                fetchBundles()
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to disable bundle: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun enableBundle(id: String): Result<Unit> {
        return try {
            val response = apiService.get().enableBundle(id)
            if (response.isSuccessful) {
                // Refresh to get updated display_order
                fetchBundles()
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to enable bundle: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun reorderBundles(orderedIds: List<String>): Result<Unit> {
        return try {
            val request = ReorderBundlesRequest(orderedIds = orderedIds)
            val response = apiService.get().reorderBundles(request)
            if (response.isSuccessful) {
                // Refresh to get server-confirmed ordering
                fetchBundles()
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to reorder bundles: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
