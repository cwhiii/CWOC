package com.cwoc.app.widget.quickcapture

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.View
import com.cwoc.app.MainActivity
import com.cwoc.app.R

/**
 * Transparent floating menu activity launched by the Quick Capture widget.
 * Displays 6 creation options (Task, Note, Checklist, Project, Calendar Event, Alarm).
 * On option tap: launches MainActivity with navigate_to = "editor/new?type=<type>".
 * On outside tap or Back press: finishes without action.
 *
 * Uses plain Activity (not AppCompatActivity) because the transparent theme
 * inherits from android:Theme.Material.Light.NoActionBar, not AppCompat.
 *
 * Requirements: 2.2, 2.3, 2.4, 2.5
 */
class QuickCaptureMenuActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_quick_capture_menu)

        // Allow dismissal by tapping outside the card
        setFinishOnTouchOutside(true)

        // Set up click listeners for each creation option
        findViewById<View>(R.id.option_task).setOnClickListener {
            launchEditorWithType("task")
        }
        findViewById<View>(R.id.option_note).setOnClickListener {
            launchEditorWithType("note")
        }
        findViewById<View>(R.id.option_checklist).setOnClickListener {
            launchEditorWithType("checklist")
        }
        findViewById<View>(R.id.option_project).setOnClickListener {
            launchEditorWithType("project")
        }
        findViewById<View>(R.id.option_calendar).setOnClickListener {
            launchEditorWithType("calendar")
        }
        findViewById<View>(R.id.option_alarm).setOnClickListener {
            launchEditorWithType("alarm")
        }
    }

    /**
     * Launches MainActivity with navigate_to extra pointing to the editor
     * with the specified chit type pre-selected.
     */
    private fun launchEditorWithType(type: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra("navigate_to", "editor/new?type=$type")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        startActivity(intent)
        finish()
    }

    override fun onBackPressed() {
        finish()
    }
}
