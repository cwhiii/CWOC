package com.cwoc.app.ui.screens.alerts

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.alerts.AlertClassifier
import com.cwoc.app.domain.alerts.AlertSection
import com.cwoc.app.domain.alerts.ClassifiedAlert
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import javax.inject.Inject

/**
 * ViewModel for the Alerts/Alarms view.
 * Classifies alerts into Upcoming/Past sections and auto-moves them as time passes.
 */
@HiltViewModel
class AlertsViewModel @Inject constructor(
    private val chitRepository: ChitRepository
) : ViewModel() {

    private val _alerts = MutableStateFlow<List<ClassifiedAlert>>(emptyList())
    val alerts: StateFlow<List<ClassifiedAlert>> = _alerts.asStateFlow()

    val upcomingAlerts: List<ClassifiedAlert>
        get() = _alerts.value.filter { it.section == AlertSection.UPCOMING }

    val pastAlerts: List<ClassifiedAlert>
        get() = _alerts.value.filter { it.section == AlertSection.PAST }

    init {
        // Collect alert chits and classify them
        viewModelScope.launch {
            chitRepository.getAlertChits().collect { chits ->
                val allAlerts = chits.flatMap { chit ->
                    val rawAlerts = AlertClassifier.parseAlerts(chit.alerts)
                    AlertClassifier.classifyAlerts(
                        chitId = chit.id,
                        chitTitle = chit.title,
                        alerts = rawAlerts
                    )
                }
                _alerts.value = allAlerts
            }
        }

        // Periodic reclassification — check every 30 seconds for alerts that have passed
        viewModelScope.launch {
            while (true) {
                delay(30_000)
                reclassify()
            }
        }
    }

    /**
     * Reclassify all alerts based on current time.
     * Moves alerts from UPCOMING to PAST when their time passes.
     */
    private fun reclassify() {
        val now = LocalDateTime.now()
        _alerts.value = _alerts.value.map { alert ->
            if (alert.section == AlertSection.UPCOMING && alert.scheduledTime.isBefore(now)) {
                alert.copy(section = AlertSection.PAST)
            } else {
                alert
            }
        }.sortedWith(
            compareBy<ClassifiedAlert> { it.section.ordinal }
                .thenBy { it.scheduledTime }
        )
    }
}
