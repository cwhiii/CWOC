package com.cwoc.app.widget.checklist

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.ArrayAdapter
import android.widget.EditText
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
 * Presents a searchable list of available checklist chits for the user to select.
 * Persists the selected chit ID to SharedPreferences keyed by appWidgetId.
 */
class ChecklistWidgetConfigActivity : BaseWidgetConfigActivity() {

    private var allChecklists: List<WidgetChecklistSummary> = emptyList()
    private var filteredChecklists: List<WidgetChecklistSummary> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_checklist_config)

        val listView = findViewById<ListView>(R.id.checklist_selection_list)
        val emptyView = findViewById<TextView>(R.id.config_empty)
        val searchField = findViewById<EditText>(R.id.checklist_search)

        lifecycleScope.launch {
            allChecklists = WidgetDataProvider.getChecklistChits(this@ChecklistWidgetConfigActivity)
            filteredChecklists = allChecklists

            if (allChecklists.isEmpty()) {
                listView.visibility = View.GONE
                searchField.visibility = View.GONE
                emptyView.visibility = View.VISIBLE
            } else {
                listView.visibility = View.VISIBLE
                emptyView.visibility = View.GONE

                updateList(listView)

                listView.setOnItemClickListener { _, _, position, _ ->
                    val selectedChit = filteredChecklists[position]
                    saveConfig("checklist_$appWidgetId", selectedChit.chitId)
                    finishWithResult()
                }

                // Search filtering
                searchField.addTextChangedListener(object : TextWatcher {
                    override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                    override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                    override fun afterTextChanged(s: Editable?) {
                        val query = s?.toString()?.trim()?.lowercase() ?: ""
                        filteredChecklists = if (query.isEmpty()) {
                            allChecklists
                        } else {
                            allChecklists.filter {
                                (it.title ?: "").lowercase().contains(query)
                            }
                        }
                        updateList(listView)
                    }
                })
            }
        }
    }

    private fun updateList(listView: ListView) {
        val titles = filteredChecklists.map { it.title ?: "Untitled Checklist" }
        val adapter = ArrayAdapter(
            this@ChecklistWidgetConfigActivity,
            android.R.layout.simple_list_item_1,
            titles
        )
        listView.adapter = adapter
    }
}
