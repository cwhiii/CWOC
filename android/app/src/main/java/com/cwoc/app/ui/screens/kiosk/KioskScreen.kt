package com.cwoc.app.ui.screens.kiosk

import android.content.SharedPreferences
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentText = Color(0xFF4A3520)
private val ParchmentBg = Color(0xFFFFFAF0)
private val TodayHighlight = Color(0xFFD4AF37)

// ─── Data Models ────────────────────────────────────────────────────────────────

data class KioskChit(
    val id: String,
    val title: String?,
    val status: String?,
    val color: String?,
    val start_datetime: String?,
    val due_datetime: String?,
    val end_datetime: String?,
    val owner_display_name: String?
)

enum class KioskPeriod { DAY, WEEK, MONTH }

// ─── ViewModel ──────────────────────────────────────────────────────────────────

@HiltViewModel
class KioskViewModel @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val gson: Gson
) : ViewModel() {

    private val _chits = MutableStateFlow<List<KioskChit>>(emptyList())
    val chits: StateFlow<List<KioskChit>> = _chits.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _lastUpdated = MutableStateFlow<String?>(null)
    val lastUpdated: StateFlow<String?> = _lastUpdated.asStateFlow()

    private var tags: List<String> = emptyList()

    fun startLoading(selectedTags: List<String>) {
        tags = selectedTags
        fetchData()
        // Auto-refresh every 60 seconds
        viewModelScope.launch {
            while (isActive) {
                delay(60_000)
                fetchData()
            }
        }
    }

    fun refresh() { fetchData() }

    private fun fetchData() {
        viewModelScope.launch {
            _isLoading.value = _chits.value.isEmpty()
            _error.value = null
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) {
                    _error.value = "No server URL configured"
                    return@launch
                }
                val url = "${serverUrl.trimEnd('/')}/api/kiosk?tags=${tags.joinToString(",")}"
                val request = Request.Builder().url(url).get().build()
                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "{}"
                    val map = gson.fromJson(body, Map::class.java) as? Map<*, *>
                    val chitsJson = gson.toJson(map?.get("chits") ?: emptyList<Any>())
                    val listType = object : TypeToken<List<KioskChit>>() {}.type
                    _chits.value = gson.fromJson(chitsJson, listType)
                    val fmt = SimpleDateFormat("h:mm a", Locale.US)
                    _lastUpdated.value = "Last updated: ${fmt.format(Date())}"
                } else {
                    _error.value = "Failed to load (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }
}

// ─── Main Screen ────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KioskScreen(
    selectedTags: List<String> = emptyList(),
    onNavigateBack: () -> Unit = {},
    onNavigateToEditor: (String) -> Unit = {},
    viewModel: KioskViewModel = hiltViewModel()
) {
    val chits by viewModel.chits.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val lastUpdated by viewModel.lastUpdated.collectAsState()

    var period by remember { mutableStateOf(KioskPeriod.WEEK) }
    var anchor by remember { mutableStateOf(Calendar.getInstance()) }

    // Start loading on first composition
    LaunchedEffect(selectedTags) {
        viewModel.startLoading(selectedTags)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Kiosk") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { innerPadding ->
        if (selectedTags.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(innerPadding), Alignment.Center) {
                Text(
                    "No tags selected for kiosk mode.\nConfigure in Settings → Kiosk.",
                    color = ParchmentBrown,
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                )
            }
            return@Scaffold
        }

        if (isLoading && chits.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(innerPadding), Alignment.Center) {
                CircularProgressIndicator(color = ParchmentBrown)
            }
            return@Scaffold
        }

        if (error != null && chits.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(innerPadding), Alignment.Center) {
                Text(error!!, color = MaterialTheme.colorScheme.error)
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Period selector bar
            item {
                PeriodBar(
                    period = period,
                    anchor = anchor,
                    onPeriodChange = { period = it },
                    onNavigate = { dir ->
                        anchor = (anchor.clone() as Calendar).apply {
                            when (period) {
                                KioskPeriod.DAY -> add(Calendar.DAY_OF_MONTH, dir)
                                KioskPeriod.WEEK -> add(Calendar.WEEK_OF_YEAR, dir)
                                KioskPeriod.MONTH -> add(Calendar.MONTH, dir)
                            }
                        }
                    },
                    onToday = { anchor = Calendar.getInstance() }
                )
            }

            // Calendar section
            item {
                Text(
                    "📅 CALENDAR",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = ParchmentText,
                    letterSpacing = 1.5.sp
                )
                HorizontalDivider(color = ParchmentBrown.copy(alpha = 0.4f), thickness = 2.dp)
            }

            val range = getPeriodRange(period, anchor)
            val calendarEvents = chits.filter { hasDate(it) }
                .filter { chitInRange(it, range.first, range.second) }
                .groupBy { chitDateKey(it) }
                .toSortedMap()

            if (calendarEvents.isEmpty()) {
                item {
                    Text(
                        "No events in this period",
                        color = ParchmentBrown.copy(alpha = 0.7f),
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                        modifier = Modifier.padding(vertical = 16.dp)
                    )
                }
            } else {
                val todayKey = dateKey(Calendar.getInstance())
                calendarEvents.forEach { (dayKey, events) ->
                    item(key = "cal_$dayKey") {
                        DayGroup(
                            dayKey = dayKey,
                            isToday = dayKey == todayKey,
                            events = events.sortedBy { chitDateStr(it) },
                            onChitClick = onNavigateToEditor
                        )
                    }
                }
            }

            // Tasks section
            item {
                Spacer(Modifier.height(8.dp))
                Text(
                    "✅ TASKS",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = ParchmentText,
                    letterSpacing = 1.5.sp
                )
                HorizontalDivider(color = ParchmentBrown.copy(alpha = 0.4f), thickness = 2.dp)
            }

            val tasks = chits.filter { isActiveTask(it) }
                .sortedWith(compareBy({ taskOrder(it) }, { it.due_datetime ?: "" }))

            if (tasks.isEmpty()) {
                item {
                    Text(
                        "No active tasks",
                        color = ParchmentBrown.copy(alpha = 0.7f),
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                        modifier = Modifier.padding(vertical = 16.dp)
                    )
                }
            } else {
                items(tasks, key = { "task_${it.id}" }) { chit ->
                    TaskRow(chit = chit, onClick = { onNavigateToEditor(chit.id) })
                }
            }

            // Tag legend
            if (selectedTags.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(ParchmentBrown.copy(alpha = 0.06f), RoundedCornerShape(4.dp))
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Tags:", fontSize = 12.sp, color = ParchmentBrown.copy(alpha = 0.6f))
                        selectedTags.forEach { tag ->
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = ParchmentBrown.copy(alpha = 0.1f)
                            ) {
                                Text(
                                    "🏷️ $tag",
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                    fontSize = 12.sp,
                                    color = ParchmentText,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            }

            // Last updated
            if (lastUpdated != null) {
                item {
                    Text(
                        lastUpdated!!,
                        fontSize = 11.sp,
                        color = Color(0xFF8B7355),
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 8.dp)
                    )
                }
            }
        }
    }
}

// ─── Period Bar ─────────────────────────────────────────────────────────────────

@Composable
private fun PeriodBar(
    period: KioskPeriod,
    anchor: Calendar,
    onPeriodChange: (KioskPeriod) -> Unit,
    onNavigate: (Int) -> Unit,
    onToday: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        KioskPeriod.entries.forEach { p ->
            FilterChip(
                selected = period == p,
                onClick = { onPeriodChange(p) },
                label = { Text(p.name.lowercase().replaceFirstChar { it.uppercase() }, fontSize = 13.sp) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = ParchmentBrown,
                    selectedLabelColor = Color.White
                )
            )
        }
        FilterChip(
            selected = false,
            onClick = onToday,
            label = { Text("📍 Today", fontSize = 13.sp) }
        )
        Spacer(Modifier.weight(1f))
        IconButton(onClick = { onNavigate(-1) }, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Default.ChevronLeft, "Previous", tint = ParchmentText)
        }
        Text(
            getPeriodLabel(period, anchor),
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            color = ParchmentText
        )
        IconButton(onClick = { onNavigate(1) }, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Default.ChevronRight, "Next", tint = ParchmentText)
        }
    }
}

// ─── Day Group ──────────────────────────────────────────────────────────────────

@Composable
private fun DayGroup(
    dayKey: String,
    isToday: Boolean,
    events: List<KioskChit>,
    onChitClick: (String) -> Unit
) {
    Column(modifier = Modifier.padding(bottom = 8.dp)) {
        // Day label
        val label = if (isToday) "📌 Today — ${formatDayLabel(dayKey)}" else formatDayLabel(dayKey)
        Text(
            text = label,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            color = ParchmentText,
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    if (isToday) TodayHighlight.copy(alpha = 0.2f)
                    else ParchmentBrown.copy(alpha = 0.1f),
                    RoundedCornerShape(4.dp)
                )
                .padding(horizontal = 8.dp, vertical = 4.dp)
        )
        Spacer(Modifier.height(4.dp))
        events.forEach { chit ->
            EventRow(chit = chit, onClick = { onChitClick(chit.id) })
        }
    }
}

// ─── Event Row ──────────────────────────────────────────────────────────────────

@Composable
private fun EventRow(chit: KioskChit, onClick: () -> Unit) {
    val bgColor = parseChitColor(chit.color)
    val textColor = if (isLightColor(bgColor)) ParchmentText else Color.White

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
            .background(bgColor, RoundedCornerShape(4.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = formatTime(chitDateStr(chit)) ?: "🕐",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = textColor,
            modifier = Modifier.width(60.dp)
        )
        Text(
            text = chit.title ?: "Untitled",
            fontSize = 14.sp,
            color = textColor,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        if (!chit.owner_display_name.isNullOrBlank()) {
            Text(
                "👤 ${chit.owner_display_name}",
                fontSize = 12.sp,
                color = textColor.copy(alpha = 0.8f)
            )
        }
    }
}

// ─── Task Row ───────────────────────────────────────────────────────────────────

@Composable
private fun TaskRow(chit: KioskChit, onClick: () -> Unit) {
    val bgColor = parseChitColor(chit.color)
    val textColor = if (isLightColor(bgColor)) ParchmentText else Color.White

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
            .background(bgColor, RoundedCornerShape(4.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(statusIcon(chit.status), fontSize = 14.sp)
        Text(
            text = chit.title ?: "Untitled",
            fontSize = 14.sp,
            color = textColor,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        if (!chit.due_datetime.isNullOrBlank()) {
            Text(
                "📅 ${formatDayLabel(chitDateKeyFromStr(chit.due_datetime))}",
                fontSize = 12.sp,
                color = Color(0xFFA0522D)
            )
        }
        if (!chit.owner_display_name.isNullOrBlank()) {
            Text(
                "👤 ${chit.owner_display_name}",
                fontSize = 12.sp,
                color = textColor.copy(alpha = 0.8f)
            )
        }
    }
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

private fun hasDate(chit: KioskChit): Boolean {
    return !chit.start_datetime.isNullOrBlank() ||
        !chit.due_datetime.isNullOrBlank() ||
        !chit.end_datetime.isNullOrBlank()
}

private fun chitDateStr(chit: KioskChit): String {
    return chit.start_datetime ?: chit.due_datetime ?: chit.end_datetime ?: ""
}

private fun chitDateKey(chit: KioskChit): String {
    val dateStr = chitDateStr(chit)
    return chitDateKeyFromStr(dateStr)
}

private fun chitDateKeyFromStr(dateStr: String): String {
    return try {
        if (dateStr.length >= 10) dateStr.substring(0, 10) else ""
    } catch (e: Exception) { "" }
}

private fun dateKey(cal: Calendar): String {
    return String.format(
        Locale.US, "%04d-%02d-%02d",
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH) + 1,
        cal.get(Calendar.DAY_OF_MONTH)
    )
}

private fun chitInRange(chit: KioskChit, start: Calendar, end: Calendar): Boolean {
    val dateStr = chitDateStr(chit)
    if (dateStr.isBlank()) return false
    return try {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val d = fmt.parse(dateStr.substring(0, 10)) ?: return false
        val cal = Calendar.getInstance().apply { time = d }
        !cal.before(start) && cal.before(end)
    } catch (e: Exception) { false }
}

private fun getPeriodRange(period: KioskPeriod, anchor: Calendar): Pair<Calendar, Calendar> {
    val start = (anchor.clone() as Calendar)
    val end: Calendar
    when (period) {
        KioskPeriod.DAY -> {
            start.set(Calendar.HOUR_OF_DAY, 0); start.set(Calendar.MINUTE, 0); start.set(Calendar.SECOND, 0)
            end = (start.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, 1) }
        }
        KioskPeriod.WEEK -> {
            val dow = start.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY
            start.add(Calendar.DAY_OF_MONTH, -dow)
            start.set(Calendar.HOUR_OF_DAY, 0); start.set(Calendar.MINUTE, 0); start.set(Calendar.SECOND, 0)
            end = (start.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, 7) }
        }
        KioskPeriod.MONTH -> {
            start.set(Calendar.DAY_OF_MONTH, 1)
            start.set(Calendar.HOUR_OF_DAY, 0); start.set(Calendar.MINUTE, 0); start.set(Calendar.SECOND, 0)
            end = (start.clone() as Calendar).apply { add(Calendar.MONTH, 1) }
        }
    }
    return start to end
}

private fun getPeriodLabel(period: KioskPeriod, anchor: Calendar): String {
    val range = getPeriodRange(period, anchor)
    val fmt = SimpleDateFormat("EEE, MMM d", Locale.US)
    return when (period) {
        KioskPeriod.DAY -> fmt.format(range.first.time)
        KioskPeriod.WEEK -> {
            val endCal = (range.second.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, -1) }
            "${fmt.format(range.first.time)} — ${fmt.format(endCal.time)}"
        }
        KioskPeriod.MONTH -> SimpleDateFormat("MMMM yyyy", Locale.US).format(range.first.time)
    }
}

private fun formatDayLabel(dayKey: String): String {
    return try {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val d = fmt.parse(dayKey) ?: return dayKey
        SimpleDateFormat("EEE, MMM d", Locale.US).format(d)
    } catch (e: Exception) { dayKey }
}

private fun formatTime(dateStr: String?): String? {
    if (dateStr.isNullOrBlank()) return null
    return try {
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        val d = fmt.parse(dateStr) ?: return null
        SimpleDateFormat("h:mm a", Locale.US).format(d)
    } catch (e: Exception) { null }
}

private fun isActiveTask(chit: KioskChit): Boolean {
    val s = (chit.status ?: "").lowercase()
    return s == "todo" || s == "in progress" || s == "blocked"
}

private fun taskOrder(chit: KioskChit): Int {
    return when ((chit.status ?: "").lowercase()) {
        "in progress" -> 0
        "blocked" -> 1
        "todo" -> 2
        else -> 3
    }
}

private fun statusIcon(status: String?): String {
    return when ((status ?: "").lowercase()) {
        "todo" -> "⭕"
        "in progress" -> "🔄"
        "blocked" -> "🚫"
        "complete" -> "✅"
        else -> "⭕"
    }
}

private fun parseChitColor(color: String?): Color {
    if (color.isNullOrBlank() || color == "transparent") return Color(0xFFFFF8E1)
    return try {
        Color(android.graphics.Color.parseColor(color))
    } catch (e: Exception) { Color(0xFFFFF8E1) }
}

private fun isLightColor(color: Color): Boolean {
    val luminance = 0.299f * color.red + 0.587f * color.green + 0.114f * color.blue
    return luminance > 0.6f
}
