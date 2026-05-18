package com.cwoc.app.widget.refresh

import android.content.Context
import androidx.room.Room
import com.cwoc.app.data.local.CwocDatabase
import com.cwoc.app.data.local.migration.MIGRATION_1_2
import com.cwoc.app.data.local.migration.MIGRATION_2_3
import com.cwoc.app.data.local.migration.MIGRATION_3_4
import com.cwoc.app.data.local.migration.MIGRATION_4_5
import com.cwoc.app.data.local.migration.MIGRATION_5_6
import com.cwoc.app.data.local.migration.MIGRATION_6_7
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Simple data class for widget calendar items.
 */
data class WidgetCalendarItem(
    val id: String,
    val title: String?,
    val time: String?
)

/**
 * Simple data class for widget task items.
 */
data class WidgetTaskItem(
    val id: String,
    val title: String?,
    val dueDate: String?
)

/**
 * Provides data for home screen widgets by reading directly from Room.
 * No network calls — reads exclusively from the local database.
 */
object WidgetDataProvider {

    private fun getDatabase(context: Context): CwocDatabase {
        return Room.databaseBuilder(
            context.applicationContext,
            CwocDatabase::class.java,
            "cwoc.db"
        )
            .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6, MIGRATION_6_7)
            .build()
    }

    /**
     * Get today's calendar chits sorted by start time.
     */
    suspend fun getTodayCalendarChits(context: Context): List<WidgetCalendarItem> {
        val db = getDatabase(context)
        return try {
            val today = LocalDate.now()
            val dayStart = today.atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            val dayEnd = today.plusDays(1).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

            db.chitDao().getChitsForDaySuspend(dayStart, dayEnd)
                .map { chit ->
                    val time = chit.startDatetime?.let {
                        try {
                            val dt = LocalDateTime.parse(it)
                            dt.format(DateTimeFormatter.ofPattern("h:mm a"))
                        } catch (_: Exception) { null }
                    }
                    WidgetCalendarItem(
                        id = chit.id,
                        title = chit.title,
                        time = if (chit.allDay) "All day" else time
                    )
                }
        } catch (_: Exception) {
            emptyList()
        } finally {
            db.close()
        }
    }

    /**
     * Get up to 5 upcoming tasks (ToDo or In Progress) sorted by due date.
     */
    suspend fun getUpcomingTasks(context: Context): List<WidgetTaskItem> {
        val db = getDatabase(context)
        return try {
            db.chitDao().getUpcomingTasksSuspend()
                .map { chit ->
                    val due = chit.dueDatetime?.let {
                        try {
                            val dt = LocalDateTime.parse(it)
                            dt.format(DateTimeFormatter.ofPattern("MMM d"))
                        } catch (_: Exception) { null }
                    }
                    WidgetTaskItem(
                        id = chit.id,
                        title = chit.title,
                        dueDate = due
                    )
                }
        } catch (_: Exception) {
            emptyList()
        } finally {
            db.close()
        }
    }
}
