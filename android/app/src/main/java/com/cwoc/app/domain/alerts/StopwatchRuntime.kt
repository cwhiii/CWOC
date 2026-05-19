package com.cwoc.app.domain.alerts

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Immutable state snapshot for a stopwatch.
 */
data class StopwatchState(
    val elapsedMs: Long = 0L,
    val isRunning: Boolean = false,
    val laps: List<String> = emptyList()
)

/**
 * Manages in-memory stopwatch state for a single stopwatch instance.
 * Updates every 50ms for smooth centisecond display.
 *
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.10, 7.1
 */
class StopwatchRuntime(private val scope: CoroutineScope) {

    private val _state = MutableStateFlow(StopwatchState())
    val state: StateFlow<StopwatchState> = _state.asStateFlow()

    private var tickJob: Job? = null
    private var elapsedMs: Long = 0L
    private var isRunning: Boolean = false
    private var laps: MutableList<String> = mutableListOf()

    /**
     * Begins incrementing elapsed time every 50ms via coroutine.
     * If already running, this is a no-op.
     */
    fun start() {
        if (isRunning) return
        isRunning = true
        emitState()
        tickJob = scope.launch {
            while (isRunning) {
                delay(50L)
                if (isRunning) {
                    elapsedMs += 50L
                    emitState()
                }
            }
        }
    }

    /**
     * Stops incrementing, preserves elapsed time.
     */
    fun pause() {
        if (!isRunning) return
        isRunning = false
        tickJob?.cancel()
        tickJob = null
        emitState()
    }

    /**
     * Stops the stopwatch, resets elapsed to 0, and clears laps.
     */
    fun reset() {
        isRunning = false
        tickJob?.cancel()
        tickJob = null
        elapsedMs = 0L
        laps.clear()
        emitState()
    }

    /**
     * If running, appends the current elapsed time as a formatted lap entry.
     * Format: "Lap N: HH:MM:SS.cs" where cs is centiseconds (2 digits).
     * If not running, this is a no-op.
     */
    fun lap() {
        if (!isRunning) return
        val lapNumber = laps.size + 1
        val formatted = formatElapsed(elapsedMs)
        laps.add("Lap $lapNumber: $formatted")
        emitState()
    }

    private fun emitState() {
        _state.value = StopwatchState(
            elapsedMs = elapsedMs,
            isRunning = isRunning,
            laps = laps.toList()
        )
    }

    companion object {
        /**
         * Formats milliseconds as HH:MM:SS.cs where cs is centiseconds (2 digits).
         */
        fun formatElapsed(ms: Long): String {
            val totalCs = ms / 10
            val cs = (totalCs % 100).toInt()
            val totalSeconds = ms / 1000
            val seconds = (totalSeconds % 60).toInt()
            val totalMinutes = totalSeconds / 60
            val minutes = (totalMinutes % 60).toInt()
            val hours = (totalMinutes / 60).toInt()
            return "%02d:%02d:%02d.%02d".format(hours, minutes, seconds, cs)
        }
    }
}
