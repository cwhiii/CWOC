package com.cwoc.app.widget.checklist

import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.ListView
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import com.cwoc.app.R
import com.cwoc.app.widget.config.BaseWidgetConfigActivity
import com.cwoc.app.widget.refresh.WidgetChecklistSummary
import com.cwoc.app.widget.refresh.WidgetDataProvider
import kotlinx.coroutines.launch

/**
 * Configuration activity for the Checklist Widget.
 * Presents a list of available checklist chits for the user to select.
 * Persists the selected chit ID to SharedPreferences keyed by appWidgetId.
 */
class ChecklistWidgetConfigActivity : BaseWidgetConfigActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_checklist_config)

        val listView = findViewById<ListView>(R.id.checklist_selection_list)
        val emptyView = findViewById<TextView>(R.id.config_empty)

        lifecycleScope.launch {
            val checklists: List<WidgetChecklistSummary> =
                WidgetDataProvider.getChecklistChits(this@ChecklistWidgetConfigActivity)

            if (checklists.isEmpty()) {
                listView.visibility = View.GONE
                emptyView.visibility = View.VISIBLE
            } else {
                listView.visibility = View.VISIBLE
                emptyView.visibility = View.GONE

                val titles = checklists.map { it.title ?: "Untitled Checklist" }
                val adapter = ArrayAdapter(
                    this@ChecklistWidgetConfigActivity,
                    android.R.layout.simple_list_item_1,
                    titles
                )
                listView.adapter = adapter

                listView.setOnItemClickListener { _, _, position, _ ->
                    val selectedChit = checklists[position]
                    saveConfig("checklist_$appWidgetId", selectedChit.chitId)
                    finishWithResult()
                }
            }
        }
    }
}
