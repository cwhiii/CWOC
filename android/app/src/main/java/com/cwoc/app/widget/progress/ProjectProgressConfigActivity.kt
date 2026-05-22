package com.cwoc.app.widget.progress

import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.ListView
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import com.cwoc.app.R
import com.cwoc.app.widget.config.BaseWidgetConfigActivity
import com.cwoc.app.widget.refresh.WidgetDataProvider
import com.cwoc.app.widget.refresh.WidgetProjectSummary
import kotlinx.coroutines.launch

/**
 * Configuration activity for the Project Progress Widget.
 * Presents a list of available project chits for the user to select.
 * Persists the selected project chit ID to SharedPreferences keyed by appWidgetId.
 */
class ProjectProgressConfigActivity : BaseWidgetConfigActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_project_config)

        val listView = findViewById<ListView>(R.id.project_list)
        val emptyView = findViewById<TextView>(R.id.project_list_empty)

        lifecycleScope.launch {
            val projects: List<WidgetProjectSummary> =
                WidgetDataProvider.getProjectChits(this@ProjectProgressConfigActivity)

            if (projects.isEmpty()) {
                listView.visibility = View.GONE
                emptyView.visibility = View.VISIBLE
            } else {
                listView.visibility = View.VISIBLE
                emptyView.visibility = View.GONE

                val titles = projects.map { it.title ?: "Untitled Project" }
                val adapter = ArrayAdapter(
                    this@ProjectProgressConfigActivity,
                    android.R.layout.simple_list_item_1,
                    titles.toMutableList()
                )
                listView.adapter = adapter

                listView.setOnItemClickListener { _, _, position, _ ->
                    val selectedProject = projects[position]
                    saveConfig("project_$appWidgetId", selectedProject.chitId)
                    finishWithResult()
                }
            }
        }
    }
}
