package com.cwoc.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/**
 * Lightweight ViewModel scoped to the activity for providing
 * the email unread count to the CCaptnTabRow badge.
 * Follows the same pattern as NotificationBadgeViewModel.
 */
@HiltViewModel
class EmailBadgeViewModel @Inject constructor(
    chitDao: ChitDao
) : ViewModel() {

    /**
     * Count of unread inbox emails for the Email tab badge.
     * An email is "unread inbox" when:
     * - It has an emailMessageId (it's an email chit)
     * - It has the "Inbox" tag
     * - It is not archived
     * - It is not deleted
     * - emailRead is not true (null or false)
     */
    val unreadCount: StateFlow<Int> = chitDao.getAllNonDeleted()
        .map { allChits ->
            allChits.count { chit ->
                chit.emailMessageId != null &&
                    chit.tags.orEmpty().contains("Inbox") &&
                    !chit.archived &&
                    chit.emailRead != true
            }
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = 0
        )
}
