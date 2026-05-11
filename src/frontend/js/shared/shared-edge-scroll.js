/**
 * shared-edge-scroll.js — Auto-scroll view containers during drag operations.
 *
 * Detects mousedown on chit cards followed by mousemove (custom drag) and
 * scrolls the nearest scrollable container when the mouse reaches its edges.
 *
 * Standalone — no modifications to other files needed.
 */

(function () {
  'use strict';

  var EDGE_ZONE = 60;
  var MAX_SPEED = 14;
  var _active = false;
  var _scrollEl = null;
  var _rafId = null;
  var _scrollDelta = 0;

  function _findScrollContainer(el) {
    var node = el;
    while (node && node !== document.body) {
      if (node.scrollHeight > node.clientHeight + 1) {
        var style = getComputedStyle(node);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          return node;
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  function _tick() {
    if (!_scrollEl || _scrollDelta === 0) {
      _rafId = null;
      return;
    }
    _scrollEl.scrollTop += _scrollDelta;
    _rafId = requestAnimationFrame(_tick);
  }

  // Activate on mousedown on any draggable card element
  document.addEventListener('mousedown', function (e) {
    var card = e.target.closest('.chit-card, .projects-child-item, .kanban-project-box, .timed-event, .month-event, .all-day-event');
    if (!card) return;
    _scrollEl = _findScrollContainer(card);
    if (_scrollEl) _active = true;
  }, true);

  // On mousemove with button held, check edges and scroll
  document.addEventListener('mousemove', function (e) {
    if (!_active || !_scrollEl || e.buttons !== 1) {
      if (_active && e.buttons !== 1) {
        // Button released without mouseup firing (edge case)
        _active = false;
        _scrollDelta = 0;
        _scrollEl = null;
        if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
      }
      return;
    }

    var rect = _scrollEl.getBoundingClientRect();
    var y = e.clientY;

    if (y < rect.top + EDGE_ZONE && _scrollEl.scrollTop > 0) {
      var pct = 1 - Math.max(0, y - rect.top) / EDGE_ZONE;
      _scrollDelta = -Math.max(2, Math.round(MAX_SPEED * pct));
    } else if (y > rect.bottom - EDGE_ZONE &&
               _scrollEl.scrollTop < _scrollEl.scrollHeight - _scrollEl.clientHeight) {
      var pct = 1 - Math.max(0, rect.bottom - y) / EDGE_ZONE;
      _scrollDelta = Math.max(2, Math.round(MAX_SPEED * pct));
    } else {
      _scrollDelta = 0;
    }

    if (_scrollDelta !== 0 && !_rafId) {
      _rafId = requestAnimationFrame(_tick);
    }
  });

  // Clean up on mouseup
  document.addEventListener('mouseup', function () {
    _active = false;
    _scrollDelta = 0;
    _scrollEl = null;
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  }, true);

})();
