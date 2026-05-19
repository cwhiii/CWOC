package com.cwoc.app.ui.screens.alerts

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.local.entity.StandaloneAlertEntity
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.NotificationDto
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.repository.StandaloneAlertRepository
import com.cwoc.app.data.repository.SyncRepository
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import com.cwoc.app.domain.alerts.StopwatchRuntime
import com.cwoc.app.domain.alerts.TimerRuntime
import com.cwoc.app.notification.TimerNotificationHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale
import javax.inject.Inject

/**
 * ViewModel for the Alerts view supporting four modes:
 * - "list" (Chits): alert-bearing chits from ChitRepository
 * - "independent": standalone alarms/timers/stopwatches from StandaloneAlertRepository
 * - "notifications": server notifications from CwocApiService
 * - "reminders": chits with notification=true AND pointInTime != null
 *
 * Maintains in-memory TimerRuntime and StopwatchRuntime instances that persist
 * across navigation within the ViewModel lifecycle.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 3.2, 7.1, 7.2, 7.4, 8.1, 9.1, 10.1, 10.2, 10.3, 10.4
 */
@HiltViewModel
class AlertsViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val chitDao: ChitDao,
    private val standaloneAlertRepository: StandaloneAlertRepository,
    private val apiService: CwocApiService,
    private val settingsRepository: SettingsRepository,
    private val syncRepository: SyncRepository,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor,
    private val timerNotificationHelper: TimerNotificationHelper,
    private val prefs: SharedPreferences
) : ViewModel() {

    companion object {
        private const val PREF_KEY_MODE = "alerts_view_mode"
        private val VALID_MODES = setOf("list", "independent", "notifications", "reminders")
        private const val DEFAULT_MODE = "independent"
    }

    // --- Mode state ---

    private val _selectedMode = MutableStateFlow(loadPersistedMode())
    val selectedMode: StateFlow<String> = _selectedMode.asStateFlow()

    // --- Chits mode state ---

    private val _alertChits = MutableStateFlow<List<ChitEntity>>(emptyList())
    val alertChits: StateFlow<List<ChitEntity>> = _alertChits.asStateFlow()

    // --- Independent mode state ---

    private val _standaloneAlerts = MutableStateFlow<List<StandaloneAlertEntity>>(emptyList())
    val standaloneAlerts: StateFlow<List<StandaloneAlertEntity>> = _standaloneAlerts.asStateFlow()

    // --- Notifications mode state ---

    private val _notifications = MutableStateFlow<List<NotificationDto>>(emptyList())
    val notifications: StateFlow<List<NotificationDto>> = _notifications.asStateFlow()

    // --- Reminders mode state ---

    private val _reminders = MutableStateFlow<List<ChitEntity>>(emptyList())
    val reminders: StateFlow<List<ChitEntity>> = _reminders.asStateFlow()

    // --- Refresh state ---

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    // --- Notification error state (for showing error toasts in UI) ---

    private val _notificationError = MutableStateFlow<String?>(null)
    val notificationError: StateFlow<String?> = _notificationError.asStateFlow()

    /** Call from UI after consuming the error (e.g., showing a toast). */
    fun clearNotificationError() {
        _notificationError.value = null
    }

    // --- Timer and Stopwatch runtimes (persist across navigation) ---

    val timerRuntimes: MutableMap<String, TimerRuntime> = mutableMapOf()
    val stopwatchRuntimes: MutableMap<String, StopwatchRuntime> = mutableMapOf()

    // Track which timers have already fired a completion notification (to avoid duplicates)
    private val timerNotificationFired: MutableSet<String> = mutableSetOf()

    // Jobs observing timer state for notification triggers
    private val timerObserverJobs: MutableMap<String, Job> = mutableMapOf()

    // --- Reminder complete with undo support ---

    /** Pending complete jobs keyed by chitId. Cancelled if user taps Undo. */
    private val pendingCompleteJobs: MutableMap<String, Job> = mutableMapOf()

    // --- Internal collection jobs ---

    private var chitsCollectionJob: Job? = null
    private var standaloneCollectionJob: Job? = null
    private var remindersCollectionJob: Job? = null

    init {
        loadDataForMode(_selectedMode.value)
        // Collect settings (snooze_length, time_format, week_start_day)
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                _snoozeLength.value = settings.snoozeLength ?: "5"
                _timeFormat.value = settings.timeFormat ?: "12"
                _weekStartDay.value = settings.weekStartDay?.toIntOrNull() ?: 0
            }
        }
    }

    /**
     * Validates and sets the active mode. Persists to SharedPreferences and triggers
     * data load for the new mode.
     */
    fun setMode(mode: String) {
        if (mode !in VALID_MODES) return
        if (mode == _selectedMode.value) return
        _selectedMode.value = mode
        prefs.edit().putString(PREF_KEY_MODE, mode).apply()
        loadDataForMode(mode)
    }

    /**
     * Re-fetches data for the current mode (pull-to-refresh).
     */
    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            try {
                when (_selectedMode.value) {
                    "list" -> refreshChitsMode()
                    "independent" -> refreshIndependentMode()
                    "notifications" -> refreshNotificationsMode()
                    "reminders" -> refreshRemindersMode()
                }
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    // --- Data loading per mode ---

    private fun loadDataForMode(mode: String) {
        when (mode) {
            "list" -> startChitsCollection()
            "independent" -> startIndependentCollection()
            "notifications" -> fetchNotifications()
            "reminders" -> startRemindersCollection()
        }
    }

    // --- Chits mode ---

    private fun startChitsCollection() {
        chitsCollectionJob?.cancel()
        chitsCollectionJob = viewModelScope.launch {
            chitRepository.getAlertChits().collect { chits ->
                _alertChits.value = chits
            }
        }
    }

    private suspend fun refreshChitsMode() {
        // Trigger incremental sync to refresh local chit data
        syncRepository.performIncrementalSync()
        // The Flow collection will automatically update _alertChits
    }

    // --- Independent mode ---

    private fun startIndependentCollection() {
        // Fetch from server and cache locally
        viewModelScope.launch {
            standaloneAlertRepository.fetchAndCache()
        }
        // Collect from local cache
        standaloneCollectionJob?.cancel()
        standaloneCollectionJob = viewModelScope.launch {
            standaloneAlertRepository.getAll().collect { alerts ->
                _standaloneAlerts.value = alerts
            }
        }
    }

    private suspend fun refreshIndependentMode() {
        standaloneAlertRepository.fetchAndCache()
    }

    // --- Notifications mode ---

    private fun fetchNotifications() {
        viewModelScope.launch {
            try {
                val response = apiService.getNotifications("mobile")
                if (response.isSuccessful) {
                    _notifications.value = response.body() ?: emptyList()
                }
            } catch (_: Exception) {
                // On failure, retain existing notifications
            }
        }
    }

    private suspend fun refreshNotificationsMode() {
        try {
            val response = apiService.getNotifications("mobile")
            if (response.isSuccessful) {
                _notifications.value = response.body() ?: emptyList()
            }
        } catch (_: Exception) {
            // On failure, retain existing notifications
        }
    }

    // --- Reminders mode ---

    private fun startRemindersCollection() {
        remindersCollectionJob?.cancel()
        remindersCollectionJob = viewModelScope.launch {
            chitRepository.getAlertChits().collect { allChits ->
                // Filter to chits where notification=true AND pointInTime is not null
                val reminderChits = allChits.filter { chit ->
                    chit.notification == true && !chit.pointInTime.isNullOrBlank()
                }
                _reminders.value = reminderChits.sortedBy { it.pointInTime }
            }
        }
    }

    private suspend fun refreshRemindersMode() {
        // Trigger incremental sync to refresh local chit data
        syncRepository.performIncrementalSync()
        // The Flow collection will automatically update _reminders
    }

    // --- Convenience accessors for notifications split ---

    /** Unread notifications (status = "pending"), sorted by created_datetime descending. */
    fun getUnreadNotifications(): List<NotificationDto> {
        return _notifications.value
            .filter { it.status == "pending" }
            .sortedByDescending { it.createdDatetime }
    }

    /** Addressed notifications (status != "pending"), sorted by created_datetime descending. */
    fun getAddressedNotifications(): List<NotificationDto> {
        return _notifications.value
            .filter { it.status != "pending" }
            .sortedByDescending { it.createdDatetime }
    }

    // --- Convenience accessors for reminders split ---

    /** Upcoming reminders (pointInTime >= now). */
    fun getUpcomingReminders(): List<ChitEntity> {
        val now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        return _reminders.value.filter { (it.pointInTime ?: "") >= now }
    }

    /** Past reminders (pointInTime < now). */
    fun getPastReminders(): List<ChitEntity> {
        val now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        return _reminders.value.filter { (it.pointInTime ?: "") < now }
    }

    // --- Notification actions (Requirements: 8.6, 8.7, 8.8, 8.9, 8.11, 8.12, 8.14) ---

    /**
     * Accept a notification — PATCH with status "accepted".
     * On success, updates local state; on failure, retains current state and shows error.
     */
    fun acceptNotification(id: String) {
        viewModelScope.launch {
            try {
                val response = apiService.updateNotification(id, mapOf("status" to "accepted"))
                if (response.isSuccessful) {
                    updateNotificationStatusLocally(id, "accepted")
                } else {
                    _notificationError.value = "Failed to accept notification"
                }
            } catch (e: Exception) {
                _notificationError.value = "Network error: ${e.message}"
            }
        }
    }

    /**
     * Decline a notification — PATCH with status "declined".
     * On success, updates local state; on failure, retains current state and shows error.
     */
    fun declineNotification(id: String) {
        viewModelScope.launch {
            try {
                val response = apiService.updateNotification(id, mapOf("status" to "declined"))
                if (response.isSuccessful) {
                    updateNotificationStatusLocally(id, "declined")
                } else {
                    _notificationError.value = "Failed to decline notification"
                }
            } catch (e: Exception) {
                _notificationError.value = "Network error: ${e.message}"
            }
        }
    }

    /**
     * Dismiss a notification — PATCH with status "dismissed".
     * On success, updates local state; on failure, retains current state and shows error.
     */
    fun dismissNotification(id: String) {
        viewModelScope.launch {
            try {
                val response = apiService.updateNotification(id, mapOf("status" to "dismissed"))
                if (response.isSuccessful) {
                    updateNotificationStatusLocally(id, "dismissed")
                } else {
                    _notificationError.value = "Failed to dismiss notification"
                }
            } catch (e: Exception) {
                _notificationError.value = "Network error: ${e.message}"
            }
        }
    }

    /**
     * Snooze a notification — POST to snooze endpoint with minutes.
     * On success, removes the notification from local state; on failure, retains and shows error.
     */
    fun snoozeNotification(id: String, minutes: Int) {
        viewModelScope.launch {
            try {
                val response = apiService.snoozeNotification(id, mapOf("minutes" to minutes))
                if (response.isSuccessful) {
                    updateNotificationStatusLocally(id, "snoozed")
                } else {
                    _notificationError.value = "Failed to snooze notification"
                }
            } catch (e: Exception) {
                _notificationError.value = "Network error: ${e.message}"
            }
        }
    }

    /**
     * Delete a notification — DELETE endpoint.
     * On success, removes from local state; on failure, retains and shows error.
     */
    fun deleteNotification(id: String) {
        viewModelScope.launch {
            try {
                val response = apiService.dismissNotification(id)
                if (response.isSuccessful) {
                    _notifications.value = _notifications.value.filter { it.id != id }
                } else {
                    _notificationError.value = "Failed to delete notification"
                }
            } catch (e: Exception) {
                _notificationError.value = "Network error: ${e.message}"
            }
        }
    }

    /**
     * Clear all addressed notifications by deleting them one by one.
     * On success for each, removes from local state; on failure, shows error and stops.
     */
    fun clearAddressed() {
        viewModelScope.launch {
            val addressed = _notifications.value.filter { it.status != "pending" }
            for (notification in addressed) {
                try {
                    val response = apiService.dismissNotification(notification.id)
                    if (response.isSuccessful) {
                        _notifications.value = _notifications.value.filter { it.id != notification.id }
                    } else {
                        _notificationError.value = "Failed to clear some addressed notifications"
                        break
                    }
                } catch (e: Exception) {
                    _notificationError.value = "Network error: ${e.message}"
                    break
                }
            }
        }
    }

    /**
     * Updates a notification's status in the local state list.
     * Creates a copy of the notification with the new status.
     */
    private fun updateNotificationStatusLocally(id: String, newStatus: String) {
        _notifications.value = _notifications.value.map { notification ->
            if (notification.id == id) {
                notification.copy(status = newStatus)
            } else {
                notification
            }
        }
    }

    // --- Timer/Stopwatch runtime management ---

    /**
     * Gets or creates a TimerRuntime for the given standalone alert ID.
     * Runtimes persist across navigation within the ViewModel lifecycle.
     * Automatically starts observing the timer state for completion notifications.
     */
    fun getOrCreateTimerRuntime(alertId: String): TimerRuntime {
        return timerRuntimes.getOrPut(alertId) {
            TimerRuntime(viewModelScope).also { runtime ->
                observeTimerForNotification(alertId, runtime)
            }
        }
    }

    /**
     * Gets or creates a StopwatchRuntime for the given standalone alert ID.
     * Runtimes persist across navigation within the ViewModel lifecycle.
     */
    fun getOrCreateStopwatchRuntime(alertId: String): StopwatchRuntime {
        return stopwatchRuntimes.getOrPut(alertId) {
            StopwatchRuntime(viewModelScope)
        }
    }

    /**
     * Removes a timer runtime (e.g., when the standalone alert is deleted).
     * Also cancels the notification observer and clears notification tracking.
     */
    fun removeTimerRuntime(alertId: String) {
        timerRuntimes.remove(alertId)
        timerObserverJobs.remove(alertId)?.cancel()
        timerNotificationFired.remove(alertId)
    }

    /**
     * Removes a stopwatch runtime (e.g., when the standalone alert is deleted).
     */
    fun removeStopwatchRuntime(alertId: String) {
        val runtime = stopwatchRuntimes.remove(alertId)
        runtime?.pause() // Stop if running before removing
    }

    // --- Standalone Alert CRUD ---

    /**
     * Creates a new alarm with defaults:
     * - time = current time + 1 minute as "HH:MM"
     * - days = [today's day abbreviation, e.g. "Mon"]
     * - enabled = true
     * - name = ""
     *
     * Requirements: 3.6, 4.9, 4.2, 4.4, 4.6, 4.7, 4.8
     */
    fun createAlarm() {
        viewModelScope.launch {
            val now = LocalTime.now().plusMinutes(1)
            val time = "%02d:%02d".format(now.hour, now.minute)
            val today = LocalDateTime.now().dayOfWeek
            val dayAbbreviation = today.getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
            // e.g. "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"

            val data = mapOf<String, Any?>(
                "time" to time,
                "days" to listOf(dayAbbreviation),
                "enabled" to true
            )
            standaloneAlertRepository.create(type = "alarm", name = "", data = data)
        }
    }

    /**
     * Creates a new timer with defaults:
     * - totalSeconds = 0
     * - loop = false
     * - name = ""
     *
     * Requirements: 3.6, 5.15, 5.13, 5.14
     */
    fun createTimer() {
        viewModelScope.launch {
            val data = mapOf<String, Any?>(
                "totalSeconds" to 0,
                "loop" to false
            )
            standaloneAlertRepository.create(type = "timer", name = "", data = data)
        }
    }

    /**
     * Creates a new stopwatch with defaults:
     * - name = ""
     * Then auto-starts the StopwatchRuntime for the new ID.
     *
     * Requirements: 3.6, 6.9, 6.7, 6.8
     */
    fun createStopwatch() {
        viewModelScope.launch {
            val data = emptyMap<String, Any?>()
            val result = standaloneAlertRepository.create(type = "stopwatch", name = "", data = data)
            result.onSuccess { dto ->
                // Auto-start the stopwatch runtime for the newly created alert
                val runtime = getOrCreateStopwatchRuntime(dto.id)
                runtime.start()
            }
        }
    }

    /**
     * Updates a standalone alert by ID with the given body fields.
     *
     * Requirements: 4.2, 4.4, 4.6, 4.7, 4.8, 5.13, 5.14, 6.7, 6.8
     */
    fun updateStandaloneAlert(id: String, body: Map<String, Any?>) {
        viewModelScope.launch {
            standaloneAlertRepository.update(id, body)
        }
    }

    /**
     * Deletes a standalone alert by ID.
     * Also removes any associated TimerRuntime or StopwatchRuntime.
     *
     * Requirements: 4.9, 5.15, 6.9
     */
    fun deleteStandaloneAlert(id: String) {
        viewModelScope.launch {
            standaloneAlertRepository.delete(id)
            // Clean up any associated runtimes
            removeTimerRuntime(id)
            removeStopwatchRuntime(id)
        }
    }

    // --- Reminder actions (Requirements: 9.6, 9.7, 9.8, 9.9, 9.10) ---

    /**
     * Toggles the pinned state of a reminder chit.
     * If currently pinned, unpins it; if unpinned, pins it.
     *
     * Requirements: 9.6
     */
    fun toggleReminderPin(chitId: String) {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId) ?: return@launch
            if (entity.pinned == true) {
                chitRepository.unpin(chitId)
            } else {
                chitRepository.pin(chitId)
            }
        }
    }

    /**
     * Completes a reminder with delayed execution for undo support.
     * Starts a 5-second countdown. If not cancelled, sets status=Complete and archived=true.
     * The UI should show an undo toast during this window.
     *
     * Requirements: 9.7
     */
    fun completeReminder(chitId: String) {
        // Cancel any existing pending complete for this chit
        pendingCompleteJobs[chitId]?.cancel()

        pendingCompleteJobs[chitId] = viewModelScope.launch {
            delay(5000L) // 5 second undo window

            // After delay, actually complete the reminder
            val entity = chitDao.getById(chitId) ?: return@launch
            val now = Instant.now().toString()
            chitDao.upsert(entity.copy(status = "Complete", archived = true, modifiedDatetime = now))
            dirtyTracker.markDirty(chitId, setOf("status", "archived"))

            // Push to server if online
            if (connectivityMonitor.isOnline.value) {
                launch { syncPushEngine.pushSingle(chitId) }
            }

            // Clean up the pending job reference
            pendingCompleteJobs.remove(chitId)
        }
    }

    /**
     * Cancels a pending complete operation (undo).
     * If the user taps Undo before the 5-second delay expires, the chit is not modified.
     *
     * Requirements: 9.8
     */
    fun cancelComplete(chitId: String) {
        pendingCompleteJobs.remove(chitId)?.cancel()
    }

    /**
     * Toggles the archived state of a reminder chit.
     * If currently archived, unarchives it; if not archived, archives it.
     *
     * Requirements: 9.9
     */
    fun archiveReminder(chitId: String) {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId) ?: return@launch
            if (entity.archived == true) {
                chitRepository.unarchive(chitId)
            } else {
                chitRepository.archive(chitId)
            }
        }
    }

    /**
     * Soft-deletes a reminder chit. The confirmation dialog is handled by the UI layer.
     * Marks the chit as deleted, marks dirty, and triggers sync push if online.
     *
     * Requirements: 9.10
     */
    fun deleteReminder(chitId: String) {
        viewModelScope.launch {
            val now = Instant.now().toString()
            chitDao.markDeleted(chitId, now)
            dirtyTracker.markDirty(chitId, setOf("deleted"))

            // Push to server if online
            if (connectivityMonitor.isOnline.value) {
                launch { syncPushEngine.pushSingle(chitId) }
            }
        }
    }

    // --- Timer completion notification observation (Requirement 7.3) ---

    /**
     * Observes a TimerRuntime's state flow and fires a local notification when
     * isDone transitions to true. Works even when the user is on a different screen
     * because the ViewModel (and its viewModelScope) remains alive.
     *
     * Uses distinctUntilChanged on isDone to only react to transitions, and tracks
     * fired notifications to avoid duplicates within the same completion cycle.
     * The tracking is cleared when the timer resets (isDone goes back to false).
     */
    private fun observeTimerForNotification(alertId: String, runtime: TimerRuntime) {
        timerObserverJobs[alertId]?.cancel()
        timerObserverJobs[alertId] = viewModelScope.launch {
            runtime.state
                .map { it.isDone }
                .distinctUntilChanged()
                .collect { isDone ->
                    if (isDone && alertId !in timerNotificationFired) {
                        timerNotificationFired.add(alertId)
                        // Look up the timer name from standalone alerts
                        val timerName = getTimerName(alertId)
                        timerNotificationHelper.fireTimerCompleteNotification(alertId, timerName)
                    } else if (!isDone) {
                        // Timer reset or restarted — allow notification to fire again next time
                        timerNotificationFired.remove(alertId)
                    }
                }
        }
    }

    /**
     * Resolves the timer name from the standalone alerts list by matching alert ID.
     */
    private fun getTimerName(alertId: String): String? {
        return _standaloneAlerts.value
            .firstOrNull { it.id == alertId }
            ?.name
    }

    // --- Settings accessors ---

    /** Exposes the snooze_length setting as a StateFlow (default "5"). */
    private val _snoozeLength = MutableStateFlow("5")
    val snoozeLength: StateFlow<String> = _snoozeLength.asStateFlow()

    // --- Settings accessors for time format and week start day ---

    private val _timeFormat = MutableStateFlow("12")
    val timeFormat: StateFlow<String> = _timeFormat.asStateFlow()

    private val _weekStartDay = MutableStateFlow(0) // 0=Sunday
    val weekStartDay: StateFlow<Int> = _weekStartDay.asStateFlow()

    // --- Helpers ---

    private fun loadPersistedMode(): String {
        val saved = prefs.getString(PREF_KEY_MODE, null)
        return if (saved != null && saved in VALID_MODES) saved else DEFAULT_MODE
    }
}
