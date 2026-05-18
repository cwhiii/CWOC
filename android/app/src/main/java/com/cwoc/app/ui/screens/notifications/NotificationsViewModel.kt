package com.cwoc.app.ui.screens.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.NotificationDao
import com.cwoc.app.data.local.entity.NotificationEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.SyncPushEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for the Notifications screen.
 * Exposes non-dismissed notifications ordered by date descending,
 * an unread count for badge display, and action methods for
 * marking read, accepting, declining, and dismissing notifications.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */
@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val notificationDao: NotificationDao,
    private val chitRepository: ChitRepository,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor
) : ViewModel() {

    /** Non-dismissed notifications, ordered by createdDatetime descending. */
    val notifications: StateFlow<List<NotificationEntity>> = notificationDao.getAll()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    /** Count of unread, non-dismissed notifications (for badge display). */
    val unreadCount: StateFlow<Int> = notificationDao.getUnreadCount()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = 0
        )

    /**
     * Marks a notification as read.
     */
    fun markRead(id: String) {
        viewModelScope.launch {
            notificationDao.markRead(id)
        }
    }

    /**
     * Accepts a notification (e.g., invitation).
     * Updates the actionTaken field and triggers a sync push.
     *
     * Validates: Requirement 10.3
     */
    fun accept(id: String) {
        viewModelScope.launch {
            notificationDao.updateAction(id, "accepted")
            notificationDao.markRead(id)

            // Trigger sync push to propagate the action to the server
            if (connectivityMonitor.isOnline.value) {
                launch { syncPushEngine.pushAll() }
            }
        }
    }

    /**
     * Declines a notification (e.g., invitation).
     * Updates the actionTaken field and triggers a sync push.
     *
     * Validates: Requirement 10.3
     */
    fun decline(id: String) {
        viewModelScope.launch {
            notificationDao.updateAction(id, "declined")
            notificationDao.markRead(id)

            // Trigger sync push to propagate the action to the server
            if (connectivityMonitor.isOnline.value) {
                launch { syncPushEngine.pushAll() }
            }
        }
    }

    /**
     * Dismisses a notification, removing it from the visible list.
     *
     * Validates: Requirement 10.4
     */
    fun dismiss(id: String) {
        viewModelScope.launch {
            notificationDao.dismiss(id)
        }
    }
}
