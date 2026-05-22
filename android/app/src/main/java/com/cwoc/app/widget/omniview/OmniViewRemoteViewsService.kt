package com.cwoc.app.widget.omniview

import android.content.Intent
import android.widget.RemoteViewsService

/**
 * RemoteViewsService for the Omni View widget's scrollable ListView.
 * Returns an OmniViewRemoteViewsFactory to populate list items.
 */
class OmniViewRemoteViewsService : RemoteViewsService() {

    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return OmniViewRemoteViewsFactory(applicationContext)
    }
}
