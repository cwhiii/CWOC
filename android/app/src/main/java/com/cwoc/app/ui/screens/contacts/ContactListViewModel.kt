package com.cwoc.app.ui.screens.contacts

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.entity.ContactEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/**
 * ViewModel for the Contact List screen.
 * Provides contacts with search filtering and alphabetical section index.
 */
@OptIn(FlowPreview::class)
@HiltViewModel
class ContactListViewModel @Inject constructor(
    private val contactDao: ContactDao
) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    val contacts: StateFlow<List<ContactEntity>> = _searchQuery
        .debounce(300)
        .flatMapLatest { query ->
            if (query.isBlank()) {
                contactDao.getAllActive()
            } else {
                contactDao.search(query)
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /**
     * Compute the alphabetical section index from the current contacts list.
     * Returns a map of letter -> index of first contact starting with that letter.
     */
    fun computeSectionIndex(contacts: List<ContactEntity>): Map<Char, Int> {
        val index = mutableMapOf<Char, Int>()
        contacts.forEachIndexed { i, contact ->
            val letter = (contact.givenName.firstOrNull() ?: contact.surname?.firstOrNull() ?: '#')
                .uppercaseChar()
            if (letter !in index) {
                index[letter] = i
            }
        }
        return index
    }

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }
}
