package com.cwoc.app.ui.components

import android.graphics.PixelFormat
import android.graphics.Rect
import android.view.Gravity
import android.view.ViewTreeObserver
import android.view.WindowManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.lifecycle.findViewTreeLifecycleOwner
import androidx.lifecycle.findViewTreeViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.findViewTreeSavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner

/**
 * Renders [content] in a separate window that is always pinned directly above the keyboard.
 * When the keyboard is hidden, the bar sits at the bottom of the screen.
 * Uses WindowManager to create an overlay panel — completely independent of the Compose layout tree.
 */
@Composable
fun KeyboardPinnedBar(
    visible: Boolean,
    content: @Composable () -> Unit
) {
    if (!visible) return

    val context = LocalContext.current
    val parentView = LocalView.current

    // Track keyboard height
    var keyboardHeight by remember { mutableIntStateOf(0) }

    DisposableEffect(parentView) {
        val windowManager = context.getSystemService(android.content.Context.WINDOW_SERVICE) as WindowManager

        // Create a ComposeView to host our toolbar content
        val composeView = ComposeView(context).apply {
            setContent { content() }
        }

        // Copy the view tree owners so Compose runtime works inside the new window
        composeView.setViewTreeLifecycleOwner(parentView.findViewTreeLifecycleOwner())
        composeView.setViewTreeViewModelStoreOwner(parentView.findViewTreeViewModelStoreOwner())
        composeView.setViewTreeSavedStateRegistryOwner(parentView.findViewTreeSavedStateRegistryOwner())

        // Window params: non-focusable panel at the bottom, above keyboard
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_PANEL,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM
            token = parentView.windowToken
            y = keyboardHeight
        }

        windowManager.addView(composeView, params)

        // Listen for layout changes to detect keyboard
        val listener = ViewTreeObserver.OnGlobalLayoutListener {
            val rect = Rect()
            parentView.getWindowVisibleDisplayFrame(rect)
            val screenHeight = parentView.rootView.height
            val newKeyboardHeight = screenHeight - rect.bottom
            // Only treat as keyboard if height is significant (> 150px threshold)
            val effectiveHeight = if (newKeyboardHeight > 150) newKeyboardHeight else 0
            if (effectiveHeight != keyboardHeight) {
                keyboardHeight = effectiveHeight
                params.y = effectiveHeight
                try {
                    windowManager.updateViewLayout(composeView, params)
                } catch (_: Exception) { /* view may have been removed */ }
            }
        }
        parentView.viewTreeObserver.addOnGlobalLayoutListener(listener)

        onDispose {
            parentView.viewTreeObserver.removeOnGlobalLayoutListener(listener)
            try {
                windowManager.removeView(composeView)
            } catch (_: Exception) { /* already removed */ }
        }
    }
}
