package com.cwoc.app.domain.alerts

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Immutable snapshot of timer state exposed to the UI.
 */
data class TimerState(
    val remainingMs: Long = 0L,
    val totalMs: Long = 0L,
    val isRunning: Boolean = false,
    val isDone: Boolean = false
)

/**
 * Manages in-memory countdown timer state for a single standalone timer.
 *
 * Decrements remaining time every 100ms while running. When remaining reaches 0:
 * - Sets isDone = true
 * - If loop is enabled: restarts after 1.5s delay
 * - If loop is disabled: stays done for 2.5s then resets to stopped state
 *
 * State persists across navigation within the ViewModel lifecycle but is lost
 * if the app process is terminated.
 *
 * @param scope CoroutineScope for launching timer tick coroutines
 */
class TimerRuntime(private val scope: CoroutineScope) {

    private var totalSeconds: Long = 0L
    private var remainingMs: Long = 0L
    private var isRunning: Boolean = false
    private var isDone: Boolean = false
    var loop: Boolean = false

    private var tickJob: Job? = null

    private val _state = MutableStateFlow(TimerState())
    val state: StateFlow<TimerState> = _state.asStateFlow()

    /**
     * Set the timer duration from hours, minutes, and seconds.
     * Also resets remaining to the new total. Only works when timer is not running.
     */
    fun setDuration(hours: Int, minutes: Int, seconds: Int) {
        if (isRunning) return
        totalSeconds = (hours * 3600L) + (minutes * 60L) + seconds
        remainingMs = totalSeconds * 1000L
        isDone = false
        emitState()
    }

    /**
     * Begin decrementing remaining every 100ms.
     * Does nothing if total duration is 0 or timer is already running.
     */
    fun start() {
        if (totalSeconds == 0L || isRunning) return
        isRunning = true
        isDone = false
        emitState()
        startTicking()
    }

    /**
     * Stop decrementing, preserve remaining time.
     */
    fun pause() {
        if (!isRunning) return
        isRunning = false
        tickJob?.cancel()
        tickJob = null
        emitState()
    }

    /**
     * Stop the countdown and restore remaining to totalSeconds.
     */
    fun reset() {
        isRunning = false
        isDone = false
        tickJob?.cancel()
        tickJob = null
        remainingMs = totalSeconds * 1000L
        emitState()
    }

    private fun startTicking() {
        tickJob?.cancel()
        tickJob = scope.launch {
            while (isRunning && remainingMs > 0L) {
                delay(100L)
                remainingMs = (remainingMs - 100L).coerceAtLeast(0L)
                emitState()

                if (remainingMs <= 0L) {
                    onTimerComplete()
                }
            }
        }
    }

    private suspend fun onTimerComplete() {
        isRunning = false
        isDone = true
        emitState()

        if (loop) {
            // Loop mode: restart after 1.5s delay
            delay(1500L)
            remainingMs = totalSeconds * 1000L
            isDone = false
            isRunning = true
            emitState()
            startTicking()
        } else {
            // Non-loop: stay done for 2.5s then reset
            delay(2500L)
            isDone = false
            remainingMs = totalSeconds * 1000L
            emitState()
        }
    }

    private fun emitState() {
        _state.value = TimerState(
            remainingMs = remainingMs,
            totalMs = totalSeconds * 1000L,
            isRunning = isRunning,
            isDone = isDone
        )
    }
}
