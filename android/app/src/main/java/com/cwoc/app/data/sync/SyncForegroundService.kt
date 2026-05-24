package com.cwoc.app.data.sync

import android.app.Notification
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.cwoc.app.R
import com.cwoc.app.notification.NotificationChannelManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Foreground service that keeps the WebSocket connection alive regardless of app UI lifecycle.
 *
 * - Starts on login, stops on logout
 * - Shows a persistent IMPORTANCE_MIN notification ("CWOC connected") on cwoc_sync_service channel
 * - Calls WebSocketClient.connect() on start, disconnect() on destroy
 * - Returns START_STICKY so Android restarts it if killed by memory pressure
 * - Uses FOREGROUND_SERVICE_TYPE_DATA_SYNC to declare its purpose to the OS
 * - Updates notification text to "CWOC reconnecting..." when WebSocket is in backoff state
 * - Runs in the same process as the main app to share the singleton WebSocketClient instance
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.2, 8.3, 8.4, 8.5, 11.1, 11.3, 11.5, 11.6
 */
@AndroidEntryPoint
class SyncForegroundService : Service() {

    @Inject lateinit var webSocketClient: WebSocketClient

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    companion object {
        const val NOTIFICATION_ID = 9001
        const val ACTION_STOP = "com.cwoc.app.STOP_SYNC_SERVICE"

        fun start(context: Context) {
            val intent = Intent(context, SyncForegroundService::class.java)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, SyncForegroundService::class.java))
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification("CWOC connected")
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)

        // Establish WebSocket connection
        webSocketClient.connect()

        // Collect connection state changes to update notification text
        serviceScope.launch {
            webSocketClient.connectionState.collectLatest { state ->
                val text = when (state) {
                    WebSocketConnectionState.CONNECTED -> "CWOC connected"
                    WebSocketConnectionState.RECONNECTING -> "CWOC reconnecting..."
                    WebSocketConnectionState.DISCONNECTED -> "CWOC disconnected"
                }
                updateNotificationText(text)
            }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        webSocketClient.disconnect()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(text: String): Notification {
        return NotificationCompat.Builder(this, NotificationChannelManager.CHANNEL_ID_SYNC_SERVICE)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("CWOC Sync")
            .setContentText(text)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setSilent(true)
            .build()
    }

    private fun updateNotificationText(text: String) {
        val notification = buildNotification(text)
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }
}
