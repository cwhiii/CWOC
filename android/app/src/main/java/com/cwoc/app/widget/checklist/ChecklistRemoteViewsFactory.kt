package com.cwoc.app.widget.checklist

import android.content.Context
import android.content.Intent
import android.util.TypedValue
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.cwoc.app.R
import com.cwoc.app.widget.refresh.WidgetChecklistItem
import com.cwoc.app.widget.refresh.WidgetDataProvider
import kotlinx.coroutines.runBlocking

/**
 * RemoteViewsFactory for the Checklist widget.
 * Populates the scrollable ListView with checklist items showing
 * checkboxes, text, and depth-based indentation.
 */
class ChecklistRemoteViewsFactory(
    private val context: Context,
    private val appWidgetId: Int
) : RemoteViewsService.RemoteViewsFactory {

    private var items: List<WidgetChecklistItem> = emptyList()
    private var chitId: String? = null

    override fun onCreate() {
        // No-op — data loaded in onDataSetChanged
    }

    override fun onDataSetChanged() {
        // Read configured chit ID from SharedPreferences
        val prefs = context.getSharedPreferences("cwoc_widget_config", Context.MODE_PRIVATE)
        chitId = prefs.getString("checklist_$appWidgetId", null)

        // Fetch checklist items for the configured chit
        items = if (chitId != null) {
            runBlocking {
                WidgetDataProvider.getChecklistItems(context, chitId!!)
            }
        } else {
            emptyList()
        }
    }

    override fun onDestroy() {
        // No-op
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_checklist_item)

        if (position < 0 || position >= items.size) {
            return views
        }

        val item = items[position]

        // Set item text
        views.setTextViewText(R.id.item_text, item.text)

        // Apply depth-based left padding (depth × 16dp converted to pixels)
        val depthPaddingPx = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            (item.depth * 16).toFloat(),
            context.resources.displayMetrics
        ).toInt()
        views.setViewPadding(R.id.item_checkbox, depthPaddingPx, 0, 0, 0)

        // Set checkbox checked state and toggle response (API 31+)
        views.setCompoundButtonChecked(R.id.item_checkbox, item.checked)

        // Use setOnCheckedChangeResponse for checkbox toggle (API 31+)
        // This properly handles checkbox clicks in RemoteViews ListView
        val toggleIntent = Intent().apply {
            putExtra("chit_id", chitId)
            putExtra("item_index", item.index)
            putExtra("action", "toggle")
        }
        views.setOnCheckedChangeResponse(
            R.id.item_checkbox,
            RemoteViews.RemoteResponse.fromFillInIntent(toggleIntent)
        )

        // Set fill-in intent for text tap (open editor)
        val openIntent = Intent().apply {
            putExtra("chit_id", chitId)
            putExtra("item_index", item.index)
            putExtra("action", "open")
        }
        views.setOnClickFillInIntent(R.id.item_text, openIntent)

        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = position.toLong()

    override fun hasStableIds(): Boolean = true
}
