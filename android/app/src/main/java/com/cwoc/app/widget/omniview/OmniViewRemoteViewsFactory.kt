package com.cwoc.app.widget.omniview

import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.cwoc.app.R
import com.cwoc.app.widget.refresh.WidgetDataProvider
import com.cwoc.app.widget.refresh.WidgetOmniItem
import kotlinx.coroutines.runBlocking

/**
 * RemoteViewsFactory for the Omni View widget.
 * Populates the scrollable ListView with chit cards showing category color,
 * title, status icon, due date badge, and priority marker.
 */
class OmniViewRemoteViewsFactory(
    private val context: Context
) : RemoteViewsService.RemoteViewsFactory {

    private var items: List<WidgetOmniItem> = emptyList()

    override fun onCreate() {
        // No-op
    }

    override fun onDataSetChanged() {
        // Fetch chits respecting user's sort order, visible categories, and active filters
        items = runBlocking {
            WidgetDataProvider.getOmniViewChits(context, 20)
        }
    }

    override fun onDestroy() {
        // No-op
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_omni_view_item)

        if (position < 0 || position >= items.size) {
            return views
        }

        val item = items[position]

        // Set colored left border (category color)
        views.setInt(R.id.item_category_border, "setBackgroundColor", item.categoryColor)

        // Set title text
        views.setTextViewText(R.id.item_title, item.title ?: "Untitled")

        // Show/hide status icon based on whether value is non-null
        if (item.statusIcon != null) {
            views.setViewVisibility(R.id.item_status_icon, View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.item_status_icon, View.GONE)
        }

        // Show/hide due date badge
        if (item.dueDate != null) {
            views.setViewVisibility(R.id.item_due_date, View.VISIBLE)
            views.setTextViewText(R.id.item_due_date, item.dueDate)
        } else {
            views.setViewVisibility(R.id.item_due_date, View.GONE)
        }

        // Show/hide priority marker
        if (item.priority != null) {
            views.setViewVisibility(R.id.item_priority, View.VISIBLE)
            views.setTextViewText(R.id.item_priority, item.priority)
        } else {
            views.setViewVisibility(R.id.item_priority, View.GONE)
        }

        // Set fill-in intent for tap-to-open-editor (on the whole item row)
        val fillInIntent = Intent().apply {
            putExtra("chit_id", item.id)
            putExtra("navigate_to", "editor/${item.id}")
        }
        views.setOnClickFillInIntent(R.id.item_root, fillInIntent)

        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = position.toLong()

    override fun hasStableIds(): Boolean = true
}
