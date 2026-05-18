package com.cwoc.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.NotificationDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/**
 * Lightweight ViewModel scoped to the activity for providing
 * the notification unread count to the TopAppBar badge.
 * Separate from NotificationsViewModel to avoid pulling in
 * unnecessary dependencies at the activity level.
 */
@HiltViewModel
class NotificationBadgeViewModel @Inject constructor(
    notificationDao: NotificationDao
) : ViewModel() {

    /** Count of unread, non-dismissed notifications for badge display. */
    val unreadCount: StateFlow<Int> = notificationDao.getUnreadCount()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = 0
        )
}
