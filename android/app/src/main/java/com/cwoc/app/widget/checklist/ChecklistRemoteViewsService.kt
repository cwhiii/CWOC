package com.cwoc.app.widget.checklist

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.widget.RemoteViewsService

/**
 * RemoteViewsService for the Checklist widget's scrollable ListView.
 * Returns a ChecklistRemoteViewsFactory to populate checklist items.
 */
class ChecklistRemoteViewsService : RemoteViewsService() {

    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        val appWidgetId = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        )
        return ChecklistRemoteViewsFactory(applicationContext, appWidgetId)
    }
}
