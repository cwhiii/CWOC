package com.cwoc.app.ui.viewmodel

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.domain.sort.SortDirection
import com.cwoc.app.domain.sort.SortField
import com.cwoc.app.domain.sort.SortState
import dagger.Lazy
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Shared ViewModel holding filter and sort state for list views.
 * Scoped to the activity so state persists across view/tab switches within a session.
 *
 * Filter state is in-memory only (resets on app restart).
 * Sort state is persisted per-tab in SharedPreferences.
 *
 * Validates: Requirements 9.8, 9.9, 10.4
 */
@HiltViewModel
class FilterSortViewModel @Inject constructor(
    private val sharedPreferences: SharedPreferences,
    private val apiService: Lazy<CwocApiService>
) : ViewModel() {

    private val _filterState = MutableStateFlow(FilterState())
    val filterState: StateFlow<FilterState> = _filterState.asStateFlow()

    private val _sortState = MutableStateFlow(SortState())
    val sortState: StateFlow<SortState> = _sortState.asStateFlow()

    /** The currently active tab route, used for per-tab sort persistence. */
    private var currentTabRoute: String? = null

    init {
        // Load sort orders and preferences from server on init (cross-device sync)
        viewModelScope.launch {
            try {
                val response = apiService.get().getSortOrders()
                if (response.isSuccessful) {
                    val serverOrders = response.body() ?: emptyMap()
                    val editor = sharedPreferences.edit()
                    serverOrders.forEach { (tab, ids) ->
                        editor.putString("manual_order_$tab", com.google.gson.Gson().toJson(ids))
                    }
                    editor.apply()
                }
            } catch (_: Exception) { /* Best-effort — use local cache */ }
            try {
                val response = apiService.get().getSortPreferences()
                if (response.isSuccessful) {
                    val serverPrefs = response.body() ?: emptyMap()
                    val editor = sharedPreferences.edit()
                    serverPrefs.forEach { (tab, pref) ->
                        val field = pref["field"]
                        val dir = pref["dir"]
                        if (field != null) editor.putString("sort_field_$tab", field.uppercase())
                        if (dir != null) editor.putString("sort_direction_$tab", dir.uppercase())
                    }
                    editor.apply()
                }
            } catch (_: Exception) { /* Best-effort */ }
        }
    }

    /**
     * Updates the filter state.
     * Filter state is held in-memory and persists across view switches within a session.
     */
    fun updateFilter(filter: FilterState) {
        _filterState.value = filter
    }

    /**
     * Updates the sort state and persists it for the current tab.
     */
    fun updateSort(sort: SortState) {
        _sortState.value = sort
        currentTabRoute?.let { tab ->
            persistSortPreference(tab, sort)
        }
    }

    /**
     * Resets all filters to their default values.
     * Does not affect sort state.
     */
    fun clearFilters() {
        _filterState.value = FilterState()
    }

    /**
     * Get the manual order for the current tab.
     * Returns a list of chit IDs in the user's preferred order.
     */
    fun getManualOrder(): List<String> {
        val tab = currentTabRoute ?: return emptyList()
        val json = sharedPreferences.getString("manual_order_$tab", null) ?: return emptyList()
        return try {
            com.google.gson.Gson().fromJson(json, Array<String>::class.java)?.toList() ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }

    /**
     * Save the manual order for the current tab and auto-switch sort to MANUAL.
     * Persists to SharedPreferences for immediate use and to the backend API for cross-device sync.
     */
    fun saveManualOrder(ids: List<String>) {
        val tab = currentTabRoute ?: return
        val json = com.google.gson.Gson().toJson(ids)
        sharedPreferences.edit()
            .putString("manual_order_$tab", json)
            .apply()
        // Auto-switch to manual sort
        val manualSort = SortState(field = SortField.MANUAL, direction = SortDirection.ASC)
        _sortState.value = manualSort
        persistSortPreference(tab, manualSort)
        // Persist to backend API for cross-device sync
        viewModelScope.launch {
            try {
                apiService.get().saveSortOrder(tab, mapOf("ids" to ids))
            } catch (_: Exception) { /* Best-effort — local order is already saved */ }
        }
    }

    /**
     * Reorder items: move item from fromIndex to toIndex and save the new order.
     */
    fun reorderItems(currentIds: List<String>, fromIndex: Int, toIndex: Int) {
        val mutable = currentIds.toMutableList()
        val item = mutable.removeAt(fromIndex)
        mutable.add(toIndex, item)
        saveManualOrder(mutable)
    }

    /**
     * Called when the user switches tabs. Loads the persisted sort preference
     * for the new tab, or falls back to defaults if none is saved.
     */
    fun onTabChanged(tabRoute: String) {
        currentTabRoute = tabRoute
        _sortState.value = loadSortPreference(tabRoute)
    }

    /**
     * Persists the sort field and direction for a given tab route.
     * Keys: "sort_field_<tabRoute>" and "sort_direction_<tabRoute>"
     * Also persists to backend API for cross-device sync.
     */
    private fun persistSortPreference(tabRoute: String, sort: SortState) {
        sharedPreferences.edit()
            .putString("sort_field_$tabRoute", sort.field.name)
            .putString("sort_direction_$tabRoute", sort.direction.name)
            .apply()
        // Persist to backend
        viewModelScope.launch {
            try {
                apiService.get().saveSortPreference(
                    tabRoute,
                    mapOf("field" to (sort.field.name.lowercase()), "dir" to sort.direction.name.lowercase())
                )
            } catch (_: Exception) { /* Best-effort */ }
        }
    }

    /**
     * Loads the persisted sort preference for a given tab route.
     * Returns default SortState if no preference is saved.
     */
    private fun loadSortPreference(tabRoute: String): SortState {
        val fieldName = sharedPreferences.getString("sort_field_$tabRoute", null)
        val directionName = sharedPreferences.getString("sort_direction_$tabRoute", null)

        val field = fieldName?.let {
            try { SortField.valueOf(it) } catch (_: IllegalArgumentException) { null }
        } ?: SortField.NONE

        val direction = directionName?.let {
            try { SortDirection.valueOf(it) } catch (_: IllegalArgumentException) { null }
        } ?: SortDirection.ASC

        return SortState(field = field, direction = direction)
    }
}
