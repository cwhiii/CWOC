/**
 * shared-timepicker.js — iOS-style drum roller time picker
 *
 * Mobile-friendly scroll-snap time picker. Supports 12/24 hour modes.
 * No seconds — hours and minutes only.
 *
 * Call: cwocTimePicker.open(element)
 * The element needs a .value property (or dataset.time for buttons).
 */

var cwocTimePicker = {};

(function() {

var _overlay = null;
var _activeEl = null;
var _is12Hour = false;
var _minuteStep = 5;
var _hourInput = null;
var _minInput = null;
var _ampmInput = null;
var _suppressSync = false;

function _getVal(el) {
  if (el.dataset && el.dataset.time !== undefined) return el.dataset.time;
  if (typeof el.value === 'string') return el.value;
  return '';
}

function _setVal(el, v) {
  if (el.tagName === 'BUTTON' || el.tagName === 'SPAN') {
    el.dataset.time = v || '';
    el.textContent = v || 'HH:MM';
  } else {
    el.value = v;
  }
}

function _getTimeFormat() {
  if (typeof window._editorTimeFormat !== 'undefined') return window._editorTimeFormat;
  if (typeof window._globalTimeFormat !== 'undefined') return window._globalTimeFormat;
  return '24hour';
}

cwocTimePicker.open = function(el) {
  if (!el) return;
  _activeEl = el;

  if (typeof _snapMinutes !== 'undefined' && _snapMinutes > 0) {
    _minuteStep = _snapMinutes;
  }

  var fmt = _getTimeFormat();
  _is12Hour = (fmt === '12hour' || fmt === '12houranalog');

  _buildAndShow();
  _setFromElement(el);

  // Focus hour input for immediate keyboard entry
  setTimeout(function() {
    if (_hourInput) { _hourInput.focus(); _hourInput.select(); }
  }, 50);

  document.addEventListener('keydown', _onEsc, true);
};

function _buildAndShow() {
  if (_overlay) _overlay.remove();

  _overlay = document.createElement('div');
  _overlay.className = 'cwoc-tp-overlay';
  _overlay.addEventListener('click', function(e) {
    if (e.target === _overlay) _close();
  });

  var modal = document.createElement('div');
  modal.className = 'cwoc-tp-modal';

  var header = document.createElement('div');
  header.className = 'cwoc-tp-header';
  header.textContent = 'Select Time';
  modal.appendChild(header);

  var drums = document.createElement('div');
  drums.className = 'cwoc-tp-drums';

  var hourDrum = _makeDrum('hour');
  drums.appendChild(hourDrum);

  var sep = document.createElement('div');
  sep.className = 'cwoc-tp-separator';
  sep.textContent = ':';
  drums.appendChild(sep);

  var minDrum = _makeDrum('minute');
  drums.appendChild(minDrum);

  if (_is12Hour) {
    var ampmDrum = _makeDrum('ampm');
    drums.appendChild(ampmDrum);
  }

  // Highlight bar
  var hl = document.createElement('div');
  hl.className = 'cwoc-tp-highlight';
  drums.appendChild(hl);

  // Editable inputs on the highlight
  var inputRow = document.createElement('div');
  inputRow.className = 'cwoc-tp-input-overlay';

  _hourInput = document.createElement('input');
  _hourInput.type = 'text';
  _hourInput.inputMode = 'numeric';
  _hourInput.className = 'cwoc-tp-num-input';
  _hourInput.maxLength = 2;
  inputRow.appendChild(_hourInput);

  var colon = document.createElement('span');
  colon.className = 'cwoc-tp-input-sep';
  colon.textContent = ':';
  inputRow.appendChild(colon);

  _minInput = document.createElement('input');
  _minInput.type = 'text';
  _minInput.inputMode = 'numeric';
  _minInput.className = 'cwoc-tp-num-input';
  _minInput.maxLength = 2;
  inputRow.appendChild(_minInput);

  _ampmInput = null;
  if (_is12Hour) {
    _ampmInput = document.createElement('input');
    _ampmInput.type = 'text';
    _ampmInput.className = 'cwoc-tp-num-input cwoc-tp-ampm-input';
    _ampmInput.maxLength = 2;
    inputRow.appendChild(_ampmInput);
  }

  drums.appendChild(inputRow);
  modal.appendChild(drums);

  // Buttons
  var btnRow = document.createElement('div');
  btnRow.className = 'cwoc-tp-buttons';

  var cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cwoc-tp-btn cwoc-tp-btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = _close;

  var nowBtn = document.createElement('button');
  nowBtn.type = 'button';
  nowBtn.className = 'cwoc-tp-btn cwoc-tp-btn-now';
  nowBtn.textContent = 'Now';
  nowBtn.onclick = _setNow;

  var setBtn = document.createElement('button');
  setBtn.type = 'button';
  setBtn.className = 'cwoc-tp-btn cwoc-tp-btn-confirm';
  setBtn.textContent = 'Set';
  setBtn.onclick = _confirm;

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(nowBtn);
  btnRow.appendChild(setBtn);
  modal.appendChild(btnRow);

  _overlay.appendChild(modal);
  document.body.appendChild(_overlay);

  // Animate in
  requestAnimationFrame(function() {
    _overlay.classList.add('cwoc-tp-visible');
  });

  // Wire drum scroll → sync inputs
  _overlay.querySelectorAll('.cwoc-tp-scroller').forEach(function(scroller) {
    scroller.addEventListener('scroll', function() { _onScroll(scroller); });
    // Blur inputs when user touches a drum so scroll sync can update them
    scroller.addEventListener('touchstart', function() {
      _suppressSync = false;
      if (document.activeElement && document.activeElement.classList.contains('cwoc-tp-num-input')) {
        document.activeElement.blur();
      }
    });
    scroller.addEventListener('mousedown', function() {
      _suppressSync = false;
      if (document.activeElement && document.activeElement.classList.contains('cwoc-tp-num-input')) {
        document.activeElement.blur();
      }
    });
  });

  // Wire input typing → overwrite mode (type replaces char at cursor, then advances)
  _hourInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); _confirm(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
    var digit = e.key;
    if (!/^[0-9]$/.test(digit)) { e.preventDefault(); return; }
    e.preventDefault();
    _suppressSync = false;

    var val = _hourInput.value.padEnd(2, '0');
    var pos = _hourInput.selectionStart || 0;
    // Replace char at pos
    var newVal = val.substring(0, pos) + digit + val.substring(pos + 1);
    newVal = newVal.substring(0, 2);
    var n = parseInt(newVal, 10);
    var max = _is12Hour ? 12 : 23;

    if (pos === 0) {
      // First digit: allow if it COULD form a valid number (0-2 for 24h, 0-1 for 12h)
      var d = parseInt(digit, 10);
      var maxFirst = _is12Hour ? 1 : 2;
      if (d > maxFirst) { return; } // reject
      _hourInput.value = newVal;
      _hourInput.setSelectionRange(1, 1);
      if (n <= max) _scrollDrumTo(0, n);
    } else {
      // Second digit: validate full number
      if (n > max || (_is12Hour && n < 1)) { return; }
      _hourInput.value = newVal;
      _minInput.focus();
      _minInput.setSelectionRange(0, 0);
      _scrollDrumTo(0, n);
    }
  });

  _minInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); _confirm(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
    var digit = e.key;
    if (!/^[0-9]$/.test(digit)) { e.preventDefault(); return; }
    e.preventDefault();
    _suppressSync = false;

    var val = _minInput.value.padEnd(2, '0');
    var pos = _minInput.selectionStart || 0;
    var newVal = val.substring(0, pos) + digit + val.substring(pos + 1);
    newVal = newVal.substring(0, 2);
    var n = parseInt(newVal, 10);
    if (n > 59) { newVal = val; }
    else {
      _minInput.value = newVal;
      var newPos = pos + 1;
      if (newPos >= 2 && _ampmInput) {
        _ampmInput.focus();
        _ampmInput.select();
      } else {
        _minInput.setSelectionRange(Math.min(newPos, 2), Math.min(newPos, 2));
      }
      // Scroll to nearest snap for visual feedback
      var snapped = Math.round(n / _minuteStep) * _minuteStep;
      _scrollDrumTo(1, snapped);
    }
  });

  // Prevent default input behavior (we handle everything in keydown)
  _hourInput.addEventListener('input', function(e) { e.preventDefault && e.preventDefault(); });
  _minInput.addEventListener('input', function(e) { e.preventDefault && e.preventDefault(); });

  if (_ampmInput) {
    _ampmInput.addEventListener('keydown', function(e) {
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); _ampmInput.value = 'AM'; _scrollDrumTo(2, 'AM'); }
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); _ampmInput.value = 'PM'; _scrollDrumTo(2, 'PM'); }
    });
  }

  // Enter on ampm to confirm
  if (_ampmInput) _ampmInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); _confirm(); } });
}

function _makeDrum(type) {
  var drum = document.createElement('div');
  drum.className = 'cwoc-tp-drum';
  drum.dataset.type = type;

  var scroller = document.createElement('div');
  scroller.className = 'cwoc-tp-scroller';

  // Top padding
  _addPad(scroller); _addPad(scroller);

  if (type === 'hour') {
    var start = _is12Hour ? 1 : 0;
    var end = _is12Hour ? 12 : 23;
    for (var i = start; i <= end; i++) {
      var d = document.createElement('div');
      d.className = 'cwoc-tp-item';
      d.dataset.value = i;
      d.textContent = _is12Hour ? String(i) : String(i).padStart(2, '0');
      scroller.appendChild(d);
    }
  } else if (type === 'minute') {
    for (var m = 0; m < 60; m += _minuteStep) {
      var d2 = document.createElement('div');
      d2.className = 'cwoc-tp-item';
      d2.dataset.value = m;
      d2.textContent = String(m).padStart(2, '0');
      scroller.appendChild(d2);
    }
  } else if (type === 'ampm') {
    var a = document.createElement('div'); a.className = 'cwoc-tp-item'; a.dataset.value = 'AM'; a.textContent = 'AM'; scroller.appendChild(a);
    var p = document.createElement('div'); p.className = 'cwoc-tp-item'; p.dataset.value = 'PM'; p.textContent = 'PM'; scroller.appendChild(p);
  }

  // Bottom padding
  _addPad(scroller); _addPad(scroller);

  drum.appendChild(scroller);

  // Tap item to scroll to it
  scroller.addEventListener('click', function(e) {
    var item = e.target.closest('.cwoc-tp-item:not(.cwoc-tp-pad)');
    if (item) {
      var items = scroller.querySelectorAll('.cwoc-tp-item:not(.cwoc-tp-pad)');
      var idx = Array.from(items).indexOf(item);
      var itemH = item.offsetHeight;
      scroller.scrollTo({ top: (2 * itemH) + (idx * itemH) - (scroller.offsetHeight / 2 - itemH / 2), behavior: 'smooth' });
    }
  });

  return drum;
}

function _addPad(scroller) {
  var p = document.createElement('div');
  p.className = 'cwoc-tp-item cwoc-tp-pad';
  scroller.appendChild(p);
}

function _onScroll(scroller) {
  // Update selected class
  var items = scroller.querySelectorAll('.cwoc-tp-item:not(.cwoc-tp-pad)');
  var rect = scroller.getBoundingClientRect();
  var centerY = rect.top + rect.height / 2;
  var closest = null, closestDist = 9999;
  items.forEach(function(item) {
    var r = item.getBoundingClientRect();
    var d = Math.abs((r.top + r.height / 2) - centerY);
    if (d < closestDist) { closestDist = d; closest = item; }
  });
  items.forEach(function(item) { item.classList.toggle('cwoc-tp-selected', item === closest); });

  // Sync to input fields
  _syncInputsFromDrums();

  // Also schedule a delayed sync to catch momentum scroll end
  clearTimeout(scroller._syncTimer);
  scroller._syncTimer = setTimeout(function() {
    _onScroll(scroller);
  }, 150);
}

function _syncInputsFromDrums() {
  if (!_overlay || _suppressSync) return;
  var allDrums = _overlay.querySelectorAll('.cwoc-tp-drum');
  var focused = document.activeElement;
  if (allDrums[0] && _hourInput && focused !== _hourInput) {
    var sel = allDrums[0].querySelector('.cwoc-tp-selected');
    if (sel) _hourInput.value = _is12Hour ? sel.dataset.value : String(parseInt(sel.dataset.value)).padStart(2, '0');
  }
  if (allDrums[1] && _minInput && focused !== _minInput) {
    var sel2 = allDrums[1].querySelector('.cwoc-tp-selected');
    if (sel2) _minInput.value = String(parseInt(sel2.dataset.value)).padStart(2, '0');
  }
  if (allDrums[2] && _ampmInput && focused !== _ampmInput) {
    var sel3 = allDrums[2].querySelector('.cwoc-tp-selected');
    if (sel3) _ampmInput.value = sel3.dataset.value;
  }
}

function _scrollDrumTo(drumIdx, value) {
  if (!_overlay) return;
  var allDrums = _overlay.querySelectorAll('.cwoc-tp-drum');
  var drum = allDrums[drumIdx];
  if (!drum) return;
  var scroller = drum.querySelector('.cwoc-tp-scroller');
  var items = scroller.querySelectorAll('.cwoc-tp-item:not(.cwoc-tp-pad)');
  var target = null;
  items.forEach(function(item) { if (item.dataset.value == value) target = item; });
  if (target) {
    var itemH = target.offsetHeight;
    var idx = Array.from(items).indexOf(target);
    scroller.scrollTop = (2 * itemH) + (idx * itemH) - (scroller.offsetHeight / 2 - itemH / 2);
  }
}

function _setFromElement(el) {
  var val = _getVal(el) || '';
  var h = 12, m = 0;
  var match = val.match(/^(\d{1,2}):(\d{2})$/);
  if (match) { h = parseInt(match[1]); m = parseInt(match[2]); }

  // Suppress sync so drum scroll doesn't overwrite the actual minute value
  _suppressSync = true;

  // Scroll drum to nearest snap value, but show actual value in input
  var mSnapped = Math.round(m / _minuteStep) * _minuteStep;
  if (mSnapped >= 60) mSnapped = 0;

  if (_is12Hour) {
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    _scrollDrumTo(0, h12);
    _scrollDrumTo(1, mSnapped);
    _scrollDrumTo(2, ampm);
    _hourInput.value = String(h12);
    _minInput.value = String(m).padStart(2, '0');
    if (_ampmInput) _ampmInput.value = ampm;
  } else {
    _scrollDrumTo(0, h);
    _scrollDrumTo(1, mSnapped);
    _hourInput.value = String(h).padStart(2, '0');
    _minInput.value = String(m).padStart(2, '0');
  }

  // Keep sync suppressed until user actually interacts with a drum
  // It will be re-enabled by the touchstart handler on the scrollers
}

function _setNow() {
  var now = new Date();
  var h = now.getHours();
  var m = Math.round(now.getMinutes() / _minuteStep) * _minuteStep;
  if (m >= 60) { m = 0; h = (h + 1) % 24; }

  if (_is12Hour) {
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    _scrollDrumTo(0, h12); _scrollDrumTo(1, m); _scrollDrumTo(2, ampm);
    _hourInput.value = String(h12);
    _minInput.value = String(m).padStart(2, '0');
    if (_ampmInput) _ampmInput.value = ampm;
  } else {
    _scrollDrumTo(0, h); _scrollDrumTo(1, m);
    _hourInput.value = String(h).padStart(2, '0');
    _minInput.value = String(m).padStart(2, '0');
  }
  setTimeout(function() {
    if (_overlay) _overlay.querySelectorAll('.cwoc-tp-scroller').forEach(_onScroll);
  }, 50);
}

function _confirm() {
  var hVal = parseInt(_hourInput.value, 10);
  var mVal = parseInt(_minInput.value, 10);
  if (isNaN(hVal)) hVal = 12;
  if (isNaN(mVal)) mVal = 0;

  if (_is12Hour) {
    var ampm = _ampmInput ? _ampmInput.value : 'AM';
    if (hVal < 1) hVal = 1; if (hVal > 12) hVal = 12;
    if (ampm === 'AM' && hVal === 12) hVal = 0;
    else if (ampm === 'PM' && hVal !== 12) hVal += 12;
  } else {
    if (hVal < 0) hVal = 0; if (hVal > 23) hVal = 23;
  }
  if (mVal < 0) mVal = 0; if (mVal > 59) mVal = 59;

  var timeStr = String(hVal).padStart(2, '0') + ':' + String(mVal).padStart(2, '0');

  if (_activeEl) {
    _setVal(_activeEl, timeStr);
    // Fire events in case anything listens
    try { _activeEl.dispatchEvent(new Event('change', { bubbles: true })); } catch(e) {}
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
  }
  _close();
}

function _close() {
  if (_overlay) {
    _overlay.classList.add('cwoc-tp-closing');
    var ov = _overlay;
    setTimeout(function() { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }, 200);
    _overlay = null;
  }
  _activeEl = null;
  _hourInput = null;
  _minInput = null;
  _ampmInput = null;
  document.removeEventListener('keydown', _onEsc, true);
}

function _onEsc(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    _close();
  }
}

})();
