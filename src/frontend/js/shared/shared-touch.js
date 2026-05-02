/**
 * shared-touch.js — Unified touch gesture system for drag and long-press.
 *
 * Provides:
 *   enableTouchDrag()    — drag-only touch adapter (used by calendar, checklists)
 *   enableTouchGesture() — unified drag + long-press (used by card views)
 *
 * Sequential gesture model (enableTouchGesture):
 *   - Hold 400ms without moving → drag activates (short vibration)
 *   - Long-press timer starts ONLY after drag activates (sequential, not parallel)
 *   - If user moves after drag activates → long-press cancelled permanently, drag proceeds
 *   - If user stays perfectly still for 1200ms total → long-press fires, drag cancelled
 *   - Movement > threshold before 400ms → cancel everything (scroll)
 *
 * Key guarantee: once the user starts moving (dragging), long-press can NEVER fire.
 *
 * All timing constants are centralized here so a single change updates all views.
 *
 * Must load after: shared-utils.js
 * Must load before: shared-checklist.js, shared-sort.js, shared-calendar.js
 *
 * No dependencies on other shared sub-scripts.
 */

// ── Centralized Touch Timing Constants ───────────────────────────────────────
//
// Platform references (content rephrased for compliance with licensing restrictions):
//   Android DEFAULT_LONG_PRESS_TIMEOUT = 400ms, TOUCH_SLOP = 8dp
//   iOS UILongPressGestureRecognizer minimumPressDuration = 0.5s
//   FullCalendar longPressDelay = 1000ms
//
// Our model:
//   - Drag activates after a short hold (400ms) — matches Android long-press default
//   - Long-press (quick-edit / action) requires a much longer hold (1200ms)
//   - Once drag activates, ANY movement cancels long-press permanently
//   - The wide 800ms gap between drag (400ms) and long-press (1200ms) gives
//     users plenty of time to start moving after the drag "grabs"

/** Duration (ms) the user must hold before drag activates */
var TOUCH_DRAG_HOLD_MS = 400;

/** Duration (ms) the user must hold before long-press (action) fires */
var TOUCH_LONGPRESS_HOLD_MS = 1200;

/** Max finger movement (px) allowed during the hold period */
var TOUCH_DRAG_MOVE_THRESHOLD = 10;

/**
 * Fire haptic vibration with Android compatibility.
 * Some Android devices/browsers ignore very short durations (<50ms) or require
 * a pattern array. This helper tries multiple approaches for maximum compat.
 * @param {number|number[]} pattern - Duration in ms, or vibration pattern array
 */
function _cwocVibrate(pattern) {
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(0);
    navigator.vibrate(pattern);
  } catch (e) { /* vibrate unsupported or blocked */ }
}

/**
 * Enable touch-based drag on an element using a long-press activation pattern.
 *
 * The user must hold their finger on the element for TOUCH_DRAG_HOLD_MS
 * without moving more than TOUCH_DRAG_MOVE_THRESHOLD pixels. Once the hold
 * completes, drag mode activates with haptic feedback and visual cues.
 * Subsequent touchmove events call onMove, and touchend calls onEnd.
 *
 * If the finger moves too far during the hold, the gesture is treated as a
 * normal scroll — no drag callbacks fire and the browser handles scrolling.
 *
 * Idempotent — safe to call multiple times on the same element (previous
 * listeners are removed via the _touchDragCleanup property).
 *
 * @param {HTMLElement} element - The DOM element to attach touch listeners to
 * @param {object} callbacks - { onStart, onMove, onEnd } functions
 * @param {object} [options] - Optional config: { holdMs, moveThreshold, immediate }
 *   - immediate: if true, skip long-press and activate drag immediately (for resize handles etc.)
 */
function enableTouchDrag(element, callbacks, options) {
  try {
    if (!element || !callbacks) return;

    // Clean up previous listeners if called again on the same element (idempotent)
    if (element._touchDragCleanup) {
      element._touchDragCleanup();
    }

    var opts = options || {};
    var holdMs = opts.holdMs || TOUCH_DRAG_HOLD_MS;
    var moveThreshold = opts.moveThreshold || TOUCH_DRAG_MOVE_THRESHOLD;
    var immediate = !!opts.immediate;

    // State for the current touch gesture
    var _holdTimer = null;
    var _dragActive = false;
    var _startX = 0;
    var _startY = 0;
    var _cancelled = false;

    function _extractTouchData(touchEvent) {
      var touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
      if (!touch) return null;
      return {
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: touchEvent.target,
        event: touchEvent,
      };
    }

    function _activateDrag(data) {
      _dragActive = true;
      window._touchDragActive = true;
      // Haptic feedback — 200ms pulse for drag activation
      _cwocVibrate(200);
      // Visual feedback — add class to element
      element.classList.add('cwoc-touch-dragging');
      if (typeof callbacks.onStart === 'function') {
        callbacks.onStart(data);
      }
    }

    function _onTouchStart(e) {
      // Only single-finger touches
      if (e.touches.length !== 1) return;
      // Don't start if another drag is already active
      if (window._touchDragActive) return;

      var data = _extractTouchData(e);
      if (!data) return;

      _startX = data.clientX;
      _startY = data.clientY;
      _dragActive = false;
      _cancelled = false;

      if (immediate) {
        // Immediate mode: activate drag right away (for resize handles)
        _activateDrag(data);
      } else {
        // Long-press mode: start hold timer
        _holdTimer = setTimeout(function () {
          _holdTimer = null;
          if (!_cancelled) {
            // Re-extract position (finger may have shifted slightly)
            _activateDrag(data);
          }
        }, holdMs);
      }
    }

    function _onTouchMove(e) {
      if (_cancelled) return;

      var data = _extractTouchData(e);
      if (!data) return;

      if (_dragActive) {
        // Drag is active — prevent scroll and call onMove
        e.preventDefault();
        if (typeof callbacks.onMove === 'function') {
          callbacks.onMove(data);
        }
      } else if (_holdTimer) {
        // Still in hold period — check if finger moved too far
        var dx = data.clientX - _startX;
        var dy = data.clientY - _startY;
        if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
          // Finger moved too far — cancel hold, allow normal scroll
          clearTimeout(_holdTimer);
          _holdTimer = null;
          _cancelled = true;
        }
        // Don't preventDefault here — let the browser scroll
      }
    }

    function _onTouchEnd(e) {
      // Clean up hold timer if still pending
      if (_holdTimer) {
        clearTimeout(_holdTimer);
        _holdTimer = null;
      }

      if (_dragActive) {
        _dragActive = false;
        window._touchDragActive = false;
        element.classList.remove('cwoc-touch-dragging');
        var data = _extractTouchData(e);
        if (data && typeof callbacks.onEnd === 'function') {
          callbacks.onEnd(data);
        }
        // Suppress post-drag click/tap
        if (typeof _markDragJustEnded === 'function') _markDragJustEnded();
      }

      _cancelled = false;
    }

    function _onTouchCancel() {
      if (_holdTimer) {
        clearTimeout(_holdTimer);
        _holdTimer = null;
      }
      if (_dragActive) {
        _dragActive = false;
        window._touchDragActive = false;
        element.classList.remove('cwoc-touch-dragging');
      }
      _cancelled = false;
    }

    element.addEventListener('touchstart', _onTouchStart, { passive: true });
    element.addEventListener('touchmove', _onTouchMove, { passive: false });
    element.addEventListener('touchend', _onTouchEnd, { passive: true });
    element.addEventListener('touchcancel', _onTouchCancel, { passive: true });

    // Store cleanup function for idempotent re-attachment
    element._touchDragCleanup = function () {
      element.removeEventListener('touchstart', _onTouchStart);
      element.removeEventListener('touchmove', _onTouchMove);
      element.removeEventListener('touchend', _onTouchEnd);
      element.removeEventListener('touchcancel', _onTouchCancel);
      if (_holdTimer) clearTimeout(_holdTimer);
      _dragActive = false;
      _cancelled = false;
      element.classList.remove('cwoc-touch-dragging');
      delete element._touchDragCleanup;
    };
  } catch (e) {
    // No-op fallback if touch events are unsupported
  }
}


// ── Unified Touch Gesture System ─────────────────────────────────────────────

/**
 * Enable unified touch gestures on an element: drag (short hold) + long-press (longer hold).
 *
 * Sequential gesture model:
 *   0ms          — touchstart, drag timer begins
 *   0–400ms      — if finger moves > threshold → cancel (scroll)
 *   400ms        — drag activates (short vibration), long-press timer starts
 *   400ms+       — if finger moves → drag proceeds, long-press cancelled permanently
 *   1200ms       — if finger stayed perfectly still since 400ms → long-press fires, drag cancelled
 *
 * Key guarantee: once the user moves after drag activates, long-press can NEVER fire.
 * Long-press only fires if the user holds completely motionless for the full duration.
 *
 * @param {HTMLElement} element - The DOM element to attach touch listeners to
 * @param {object} callbacks - {
 *     onDragStart, onDragMove, onDragEnd — drag callbacks (same as enableTouchDrag)
 *     onLongPress — called when long-press fires (receives element)
 *   }
 * @param {object} [options] - Optional config: { dragHoldMs, longPressMs, moveThreshold }
 */
function enableTouchGesture(element, callbacks, options) {
  try {
    if (!element || !callbacks) return;

    // Clean up previous gesture listeners
    if (element._touchGestureCleanup) {
      element._touchGestureCleanup();
    }
    // Also clean up any standalone drag or long-press listeners
    if (element._touchDragCleanup) {
      element._touchDragCleanup();
    }

    var opts = options || {};
    var dragHoldMs = opts.dragHoldMs || TOUCH_DRAG_HOLD_MS;
    var longPressMs = opts.longPressMs || TOUCH_LONGPRESS_HOLD_MS;
    var moveThreshold = opts.moveThreshold || TOUCH_DRAG_MOVE_THRESHOLD;

    // State
    var _dragTimer = null;
    var _longPressTimer = null;
    var _dragActive = false;
    var _longPressFired = false;
    var _startX = 0;
    var _startY = 0;
    var _cancelled = false;
    var _movedAfterDragStart = false;

    function _extractTouchData(touchEvent) {
      var touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
      if (!touch) return null;
      return {
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: touchEvent.target,
        event: touchEvent,
      };
    }

    function _activateDrag(data) {
      _dragActive = true;
      _movedAfterDragStart = false;
      window._touchDragActive = true;
      // Haptic feedback — short vibration for drag activation
      _cwocVibrate(30);
      // Visual feedback
      element.classList.add('cwoc-touch-dragging');
      if (typeof callbacks.onDragStart === 'function') {
        callbacks.onDragStart(data);
      }
      // Start long-press timer NOW (sequential: only after drag activates).
      // If user stays perfectly still for the remaining time, long-press fires.
      // Any movement after this point cancels long-press permanently.
      if (typeof callbacks.onLongPress === 'function' && !_longPressTimer) {
        var remainingMs = longPressMs - dragHoldMs;
        if (remainingMs > 0) {
          _longPressTimer = setTimeout(function () {
            _longPressTimer = null;
            if (!_cancelled && !_movedAfterDragStart && _dragActive) {
              _fireLongPress();
            }
          }, remainingMs);
        }
      }
    }

    function _fireLongPress() {
      _longPressFired = true;
      // Cancel drag — long-press takes over
      if (_dragActive) {
        _dragActive = false;
        window._touchDragActive = false;
        element.classList.remove('cwoc-touch-dragging');
      }
      // Haptic feedback — double vibration for long-press
      _cwocVibrate([30, 50, 30]);
      if (typeof callbacks.onLongPress === 'function') {
        callbacks.onLongPress(element);
      }
    }

    function _onTouchStart(e) {
      if (e.touches.length !== 1) return;
      if (window._touchDragActive) return;

      var data = _extractTouchData(e);
      if (!data) return;

      _startX = data.clientX;
      _startY = data.clientY;
      _dragActive = false;
      _longPressFired = false;
      _cancelled = false;
      _movedAfterDragStart = false;

      // Start drag timer
      if (typeof callbacks.onDragStart === 'function') {
        _dragTimer = setTimeout(function () {
          _dragTimer = null;
          if (!_cancelled && !_longPressFired) {
            _activateDrag(data);
          }
        }, dragHoldMs);
      }

      // Long-press timer is started inside _activateDrag (sequential model).
      // If there's no drag callback, start long-press timer directly.
      if (typeof callbacks.onDragStart !== 'function' && typeof callbacks.onLongPress === 'function') {
        _longPressTimer = setTimeout(function () {
          _longPressTimer = null;
          if (!_cancelled) {
            _fireLongPress();
          }
        }, longPressMs);
      }
    }

    function _onTouchMove(e) {
      if (_cancelled || _longPressFired) return;

      var data = _extractTouchData(e);
      if (!data) return;

      var dx = data.clientX - _startX;
      var dy = data.clientY - _startY;
      var dist = Math.abs(dx) > Math.abs(dy) ? Math.abs(dx) : Math.abs(dy);

      if (_dragActive) {
        // Drag is active — any movement means this is a drag, not a long-press
        if (dist > moveThreshold) {
          _movedAfterDragStart = true;
          // Cancel long-press timer since user is dragging
          if (_longPressTimer) {
            clearTimeout(_longPressTimer);
            _longPressTimer = null;
          }
        }
        e.preventDefault();
        if (typeof callbacks.onDragMove === 'function') {
          callbacks.onDragMove(data);
        }
      } else if (_dragTimer || _longPressTimer) {
        // Still in hold period — check if finger moved too far
        if (dist > moveThreshold) {
          // Cancel everything — this is a scroll
          if (_dragTimer) { clearTimeout(_dragTimer); _dragTimer = null; }
          if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
          _cancelled = true;
        }
      }
    }

    function _onTouchEnd(e) {
      if (_dragTimer) { clearTimeout(_dragTimer); _dragTimer = null; }
      if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }

      if (_dragActive && !_longPressFired) {
        _dragActive = false;
        window._touchDragActive = false;
        element.classList.remove('cwoc-touch-dragging');
        var data = _extractTouchData(e);
        if (data && typeof callbacks.onDragEnd === 'function') {
          callbacks.onDragEnd(data);
        }
        // Suppress post-drag click/tap
        if (typeof _markDragJustEnded === 'function') _markDragJustEnded();
      }

      // If long press fired, prevent the subsequent click/tap
      if (_longPressFired) {
        e.preventDefault();
        _longPressFired = false;
      }

      _cancelled = false;
      _dragActive = false;
      window._touchDragActive = false;
      element.classList.remove('cwoc-touch-dragging');
    }

    function _onTouchCancel() {
      if (_dragTimer) { clearTimeout(_dragTimer); _dragTimer = null; }
      if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
      if (_dragActive) {
        _dragActive = false;
        window._touchDragActive = false;
        element.classList.remove('cwoc-touch-dragging');
      }
      _cancelled = false;
      _longPressFired = false;
    }

    element.addEventListener('touchstart', _onTouchStart, { passive: true });
    element.addEventListener('touchmove', _onTouchMove, { passive: false });
    element.addEventListener('touchend', _onTouchEnd);
    element.addEventListener('touchcancel', _onTouchCancel, { passive: true });

    // Store cleanup function for idempotent re-attachment
    element._touchGestureCleanup = function () {
      element.removeEventListener('touchstart', _onTouchStart);
      element.removeEventListener('touchmove', _onTouchMove);
      element.removeEventListener('touchend', _onTouchEnd);
      element.removeEventListener('touchcancel', _onTouchCancel);
      if (_dragTimer) clearTimeout(_dragTimer);
      if (_longPressTimer) clearTimeout(_longPressTimer);
      _dragActive = false;
      _cancelled = false;
      _longPressFired = false;
      element.classList.remove('cwoc-touch-dragging');
      delete element._touchGestureCleanup;
    };
  } catch (e) {
    // No-op fallback if touch events are unsupported
  }
}
