package com.cwoc.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.NotificationDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for the profile menu dropdown.
 * Fetches notifications from the server API (matching the web's behavior of
 * calling GET /api/notifications?device=mobile) and provides actions for
 * accept, decline, dismiss, and snooze.
 *
 * Polls every 30 seconds (matching the web's setInterval).
 */
@HiltViewModel
class ProfileMenuViewModel @Inject constructor(
    private val apiService: CwocApiService
) : ViewModel() {

    private val _notifications = MutableStateFlow<List<NotificationDto>>(emptyList())
    val notifications: StateFlow<List<NotificationDto>> = _notifications.asStateFlow()

    private val _pendingCount = MutableStateFlow(0)
    val pendingCount: StateFlow<Int> = _pendingCount.asStateFlow()

    init {
        // Start polling notifications
        viewModelScope.launch {
            while (isActive) {
                fetchNotifications()
                delay(30_000L) // Poll every 30 seconds like the web
            }
        }
    }

    /** Fetch notifications from the server. */
    fun fetchNotifications() {
        viewModelScope.launch {
            try {
                val response = apiService.getNotifications(device = "mobile")
                if (response.isSuccessful) {
                    val all = response.body() ?: emptyList()
                    _notifications.value = all
                    _pendingCount.value = all.count { it.status == "pending" }
                }
            } catch (e: Exception) {
                android.util.Log.e("ProfileMenuVM", "Failed to fetch notifications: ${e.message}")
            }
        }
    }

    /** Accept a notification (sharing invitation). */
    fun acceptNotification(notificationId: String) {
        viewModelScope.launch {
            try {
                val response = apiService.updateNotification(
                    notificationId,
                    mapOf("status" to "accepted")
                )
                if (response.isSuccessful) {
                    removeFromList(notificationId)
                }
            } catch (e: Exception) {
                android.util.Log.e("ProfileMenuVM", "Failed to accept notification: ${e.message}")
            }
        }
    }

    /** Decline a notification (sharing invitation). */
    fun declineNotification(notificationId: String) {
        viewModelScope.launch {
            try {
                val response = apiService.updateNotification(
                    notificationId,
                    mapOf("status" to "declined")
                )
                if (response.isSuccessful) {
                    removeFromList(notificationId)
                }
            } catch (e: Exception) {
                android.util.Log.e("ProfileMenuVM", "Failed to decline notification: ${e.message}")
            }
        }
    }

    /** Dismiss a notification. */
    fun dismissNotification(notificationId: String) {
        viewModelScope.launch {
            try {
                val response = apiService.updateNotification(
                    notificationId,
                    mapOf("status" to "dismissed")
                )
                if (response.isSuccessful) {
                    removeFromList(notificationId)
                }
            } catch (e: Exception) {
                android.util.Log.e("ProfileMenuVM", "Failed to dismiss notification: ${e.message}")
            }
        }
    }

    /** Snooze a notification for 5 minutes (default snooze length). */
    fun snoozeNotification(notificationId: String) {
        viewModelScope.launch {
            try {
                val response = apiService.snoozeNotification(
                    notificationId,
                    mapOf("minutes" to 5)
                )
                if (response.isSuccessful) {
                    removeFromList(notificationId)
                }
            } catch (e: Exception) {
                android.util.Log.e("ProfileMenuVM", "Failed to snooze notification: ${e.message}")
            }
        }
    }

    private fun removeFromList(notificationId: String) {
        _notifications.value = _notifications.value.filter { it.id != notificationId }
        _pendingCount.value = _notifications.value.count { it.status == "pending" }
    }
}
