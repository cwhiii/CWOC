package com.cwoc.app.domain.sort

import android.content.SharedPreferences
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.dto.ReorderRequest
import com.google.gson.Gson
import dagger.Lazy
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Shared utility for persisting drag-to-reorder operations across views.
 *
 * Handles both local persistence (SharedPreferences for instant UI) and
 * remote persistence (PUT /api/sort-orders/{tab} for cross-device sync).
 *
 * Used by: Notes, Checklists, Projects, Email Bundles.
 *
 * Validates: Requirements 9.3, 10.3, 11.3, 13.4
 */
@Singleton
class ChitReorderHelper @Inject constructor(
    private val apiService: Lazy<CwocApiService>,
    private val sharedPreferences: SharedPreferences
) {
    private val gson = Gson()

    companion object {
        private const val MANUAL_ORDER_KEY = "manual_order_"
    }

    /**
     * Persist a reordered list of chit IDs for a given view tab.
     *
     * 1. Saves to SharedPreferences immediately (local, instant UI response)
     * 2. Calls PUT /api/sort-orders/{tab} with the ordered IDs (remote, cross-device sync)
     *
     * @param tab The view tab name (e.g., "Notes", "Checklists", "Projects")
     * @param chitIds The ordered list of chit IDs representing the new sort order
     * @return Result.success if the API call succeeded, Result.failure otherwise.
     *         Local SharedPreferences are always updated regardless of API result.
     */
    suspend fun persistReorder(tab: String, chitIds: List<String>): Result<Unit> {
        // 1. Update local SharedPreferences immediately for instant UI
        saveLocalOrder(tab, chitIds)

        // 2. Persist to backend API for cross-device sync
        return try {
            val response = apiService.get().reorderChits(tab, ReorderRequest(ids = chitIds))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(
                    Exception("Failed to persist reorder: ${response.code()} ${response.message()}")
                )
            }
        } catch (e: Exception) {
            // Local order is already saved — API failure is non-fatal
            Result.failure(e)
        }
    }

    /**
     * Convenience overload: reorder by moving an item from one index to another.
     * Computes the new order and persists it.
     *
     * @param tab The view tab name
     * @param currentIds The current ordered list of IDs
     * @param fromIndex The index of the item being moved
     * @param toIndex The target index for the item
     * @return Result.success if the API call succeeded, Result.failure otherwise.
     */
    suspend fun persistReorder(
        tab: String,
        currentIds: List<String>,
        fromIndex: Int,
        toIndex: Int
    ): Result<Unit> {
        val mutable = currentIds.toMutableList()
        val item = mutable.removeAt(fromIndex)
        mutable.add(toIndex, item)
        return persistReorder(tab, mutable)
    }

    /**
     * Get the locally cached manual order for a view tab.
     *
     * @param tab The view tab name
     * @return The ordered list of chit IDs, or empty list if none saved
     */
    fun getLocalOrder(tab: String): List<String> {
        val json = sharedPreferences.getString("$MANUAL_ORDER_KEY$tab", null)
            ?: return emptyList()
        return try {
            gson.fromJson(json, Array<String>::class.java)?.toList() ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Save the manual order to SharedPreferences (local only, no API call).
     */
    private fun saveLocalOrder(tab: String, ids: List<String>) {
        val json = gson.toJson(ids)
        sharedPreferences.edit()
            .putString("$MANUAL_ORDER_KEY$tab", json)
            .apply()
    }
}
