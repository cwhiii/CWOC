package com.cwoc.app.ui.components

import android.graphics.PixelFormat
import android.graphics.Rect
import android.view.Gravity
import android.view.ViewTreeObserver
import android.view.WindowManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
 * Renders [content] in a separate window pinned directly above the keyboard.
 * Uses WindowManager with FLAG_LAYOUT_IN_SCREEN to position relative to the full screen,
 * then offsets from the bottom by the keyboard height so it sits right on top of the keyboard.
 * When the keyboard is hidden, sits at the bottom of the screen.
 */
@Composable
fun KeyboardPinnedBar(
    visible: Boolean,
    content: @Composable () -> Unit
) {
    if (!visible) return

    val context = LocalContext.current
    val parentView = LocalView.current

    DisposableEffect(parentView) {
        val windowManager = context.getSystemService(android.content.Context.WINDOW_SERVICE) as WindowManager

        val composeView = ComposeView(context).apply {
            setContent { content() }
        }

        composeView.setViewTreeLifecycleOwner(parentView.findViewTreeLifecycleOwner())
        composeView.setViewTreeViewModelStoreOwner(parentView.findViewTreeViewModelStoreOwner())
        composeView.setViewTreeSavedStateRegistryOwner(parentView.findViewTreeSavedStateRegistryOwner())

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
            y = 0
        }

        windowManager.addView(composeView, params)

        // Measure keyboard height and reposition toolbar directly above it
        val listener = ViewTreeObserver.OnGlobalLayoutListener {
            val rect = Rect()
            parentView.rootView.getWindowVisibleDisplayFrame(rect)
            val screenHeight = parentView.rootView.height
            // Distance from bottom of visible frame to bottom of screen = keyboard height
            val kbHeight = screenHeight - rect.bottom
            params.y = kbHeight
            try {
                windowManager.updateViewLayout(composeView, params)
            } catch (_: Exception) { }
        }
        parentView.viewTreeObserver.addOnGlobalLayoutListener(listener)

        onDispose {
            parentView.viewTreeObserver.removeOnGlobalLayoutListener(listener)
            try {
                windowManager.removeView(composeView)
            } catch (_: Exception) { }
        }
    }
}
