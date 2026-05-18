package com.cwoc.app.ui.viewmodel

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.domain.sort.SortDirection
import com.cwoc.app.domain.sort.SortField
import com.cwoc.app.domain.sort.SortState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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
    private val sharedPreferences: SharedPreferences
) : ViewModel() {

    private val _filterState = MutableStateFlow(FilterState())
    val filterState: StateFlow<FilterState> = _filterState.asStateFlow()

    private val _sortState = MutableStateFlow(SortState())
    val sortState: StateFlow<SortState> = _sortState.asStateFlow()

    /** The currently active tab route, used for per-tab sort persistence. */
    private var currentTabRoute: String? = null

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
     */
    private fun persistSortPreference(tabRoute: String, sort: SortState) {
        sharedPreferences.edit()
            .putString("sort_field_$tabRoute", sort.field.name)
            .putString("sort_direction_$tabRoute", sort.direction.name)
            .apply()
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
        } ?: SortField.MANUAL

        val direction = directionName?.let {
            try { SortDirection.valueOf(it) } catch (_: IllegalArgumentException) { null }
        } ?: SortDirection.ASC

        return SortState(field = field, direction = direction)
    }
}
