/**
 * shared-touch.js — Touch event adapter for drag interactions.
 *
 * Provides enableTouchDrag() which maps touch events to mouse-like
 * drag callbacks (onStart, onMove, onEnd). Used by checklist reorder,
 * card reorder, calendar drag, and other touch-based interactions.
 *
 * Must load after: shared-utils.js
 * Must load before: shared-checklist.js, shared-sort.js, shared-calendar.js
 *
 * No dependencies on other shared sub-scripts.
 */

// ── Touch Event Adapter ──────────────────────────────────────────────────────

/**
 * Enable touch-based drag on an element by mapping touch events to mouse-like callbacks.
 * Maps touchstart → onStart, touchmove → onMove (with preventDefault), touchend → onEnd.
 * Each callback receives { clientX, clientY, target, event }.
 *
 * Idempotent — safe to call multiple times on the same element (previous listeners
 * are removed via the _touchDragCleanup property before attaching new ones).
 *
 * @param {HTMLElement} element - The DOM element to attach touch listeners to
 * @param {object} callbacks - { onStart, onMove, onEnd } functions
 */
function enableTouchDrag(element, callbacks) {
  try {
    if (!element || !callbacks) return;

    // Clean up previous listeners if called again on the same element (idempotent)
    if (element._touchDragCleanup) {
      element._touchDragCleanup();
    }

    function _extractTouchData(touchEvent) {
      const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
      if (!touch) return null;
      return {
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: touchEvent.target,
        event: touchEvent,
      };
    }

    function _onTouchStart(e) {
      const data = _extractTouchData(e);
      if (!data) return;
      window._touchDragActive = true;
      if (typeof callbacks.onStart === 'function') {
        callbacks.onStart(data);
      }
    }

    function _onTouchMove(e) {
      e.preventDefault(); // Block browser scroll during drag
      const data = _extractTouchData(e);
      if (!data) return;
      if (typeof callbacks.onMove === 'function') {
        callbacks.onMove(data);
      }
    }

    function _onTouchEnd(e) {
      window._touchDragActive = false;
      const data = _extractTouchData(e);
      if (!data) return;
      if (typeof callbacks.onEnd === 'function') {
        callbacks.onEnd(data);
      }
    }

    element.addEventListener('touchstart', _onTouchStart, { passive: true });
    element.addEventListener('touchmove', _onTouchMove, { passive: false });
    element.addEventListener('touchend', _onTouchEnd, { passive: true });

    // Store cleanup function for idempotent re-attachment
    element._touchDragCleanup = function () {
      element.removeEventListener('touchstart', _onTouchStart);
      element.removeEventListener('touchmove', _onTouchMove);
      element.removeEventListener('touchend', _onTouchEnd);
      delete element._touchDragCleanup;
    };
  } catch (e) {
    // No-op fallback if touch events are unsupported
  }
}
