/**
 * editor-snooze.js — Snooze zone: hide a chit from views until a specified time
 *
 * Provides the snooze modal with preset durations and a custom date/time picker.
 * When snoozed, the chit behaves like archived but auto-unsnoozes at the specified time.
 *
 * Depends on: shared.js (cwocConfirm, cwocToast, setSaveButtonUnsaved, formatDate, formatTime)
 * Loaded before: editor-save.js, editor-init.js
 */

/* ── Snooze state ─────────────────────────────────────────────────────────── */
window._currentSnoozedUntil = null;

/**
 * Initialize snooze state from loaded chit data.
 * Called from editor-init.js after chit is loaded.
 */
function _initSnooze(chit) {
  window._currentSnoozedUntil = chit.snoozed_until || null;
  _updateSnoozeButton();
}

/**
 * Update the snooze button appearance based on current snooze state.
 */
function _updateSnoozeButton() {
  var btn = document.getElementById('snoozeButton');
  if (!btn) return;

  if (window._currentSnoozedUntil) {
    var until = new Date(window._currentSnoozedUntil);
    var now = new Date();
    if (until > now) {
      // Currently snoozed
      var label = _formatSnoozeLabel(until);
      btn.textContent = '😴 Snoozed';
      btn.title = 'Snoozed until ' + label + ' (click to manage)';
      btn.classList.add('archived-active');
    } else {
      // Snooze expired
      window._currentSnoozedUntil = null;
      btn.textContent = '😴 Snooze';
      btn.title = 'Snooze this chit (hide until a specified time)';
      btn.classList.remove('archived-active');
    }
  } else {
    btn.textContent = '😴 Snooze';
    btn.title = 'Snooze this chit (hide until a specified time)';
    btn.classList.remove('archived-active');
  }
}

/**
 * Format a date for display in the snooze button tooltip.
 */
function _formatSnoozeLabel(date) {
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var h = date.getHours();
  var m = date.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  var timeStr = h + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  return months[date.getMonth()] + ' ' + date.getDate() + ', ' + timeStr;
}

/**
 * Open the snooze modal with preset options and custom picker.
 */
function _openSnoozeModal() {
  // Remove existing modal if open
  var existing = document.getElementById('cwoc-snooze-overlay');
  if (existing) { existing.remove(); return; }

  var overlay = document.createElement('div');
  overlay.id = 'cwoc-snooze-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fffaf0;border:2px solid #6b4e31;border-radius:8px;padding:24px;max-width:360px;width:90%;font-family:Lora,Georgia,serif;box-shadow:0 4px 20px rgba(0,0,0,0.3);';

  var isSnoozed = window._currentSnoozedUntil && new Date(window._currentSnoozedUntil) > new Date();

  var html = '<h3 style="margin:0 0 16px;color:#4a2c2a;font-size:1.2em;">😴 Snooze Chit</h3>';

  if (isSnoozed) {
    var until = new Date(window._currentSnoozedUntil);
    html += '<p style="margin:0 0 12px;color:#6b4e31;font-size:0.9em;">Currently snoozed until <strong>' + _formatSnoozeLabel(until) + '</strong></p>';
    html += '<button class="snooze-preset-btn" onclick="_doUnsnooze()">⏰ Wake Up Now</button>';
    html += '<hr style="border:0;border-top:1px dashed #c4a882;margin:12px 0;" />';
    html += '<p style="margin:0 0 8px;color:#6b4e31;font-size:0.85em;">Or change snooze to:</p>';
  } else {
    html += '<p style="margin:0 0 12px;color:#6b4e31;font-size:0.9em;">Hide this chit from all views until:</p>';
  }

  html += '<div class="snooze-presets">';
  html += '  <button class="snooze-preset-btn" onclick="_doSnooze(15)">15 min</button>';
  html += '  <button class="snooze-preset-btn" onclick="_doSnooze(30)">30 min</button>';
  html += '  <button class="snooze-preset-btn" onclick="_doSnooze(60)">1 hour</button>';
  html += '  <button class="snooze-preset-btn" onclick="_doSnooze(240)">4 hours</button>';
  html += '  <button class="snooze-preset-btn" onclick="_doSnooze(480)">8 hours</button>';
  html += '  <button class="snooze-preset-btn" onclick="_doSnooze(1440)">1 day</button>';
  html += '  <button class="snooze-preset-btn" onclick="_doSnooze(4320)">3 days</button>';
  html += '  <button class="snooze-preset-btn" onclick="_doSnooze(10080)">1 week</button>';
  html += '</div>';

  html += '<hr style="border:0;border-top:1px dashed #c4a882;margin:12px 0;" />';
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">';
  html += '  <label style="color:#6b4e31;font-size:0.85em;white-space:nowrap;">Custom:</label>';
  html += '  <input type="date" id="snooze-custom-date" style="flex:1;min-width:120px;padding:4px 6px;border:1px solid #c4a882;border-radius:4px;font-family:Lora,Georgia,serif;font-size:0.85em;" />';
  html += '  <input type="time" id="snooze-custom-time" style="width:90px;padding:4px 6px;border:1px solid #c4a882;border-radius:4px;font-family:Lora,Georgia,serif;font-size:0.85em;" />';
  html += '  <button class="snooze-preset-btn" onclick="_doSnoozeCustom()">Set</button>';
  html += '</div>';

  html += '<div style="margin-top:16px;text-align:right;">';
  html += '  <button class="snooze-preset-btn snooze-cancel-btn" onclick="_closeSnoozeModal()">Cancel</button>';
  html += '</div>';

  modal.innerHTML = html;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Set default custom date/time to tomorrow same time
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var dateInput = document.getElementById('snooze-custom-date');
  var timeInput = document.getElementById('snooze-custom-time');
  if (dateInput) dateInput.value = tomorrow.toISOString().split('T')[0];
  if (timeInput) timeInput.value = '09:00';

  // Close on overlay click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) _closeSnoozeModal();
  });

  // Close on ESC
  overlay.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      _closeSnoozeModal();
    }
  }, true);
}

/**
 * Close the snooze modal.
 */
function _closeSnoozeModal() {
  var overlay = document.getElementById('cwoc-snooze-overlay');
  if (overlay) overlay.remove();
}

/**
 * Snooze for a given number of minutes (preset).
 */
function _doSnooze(minutes) {
  var until = new Date(Date.now() + minutes * 60 * 1000);
  window._currentSnoozedUntil = until.toISOString();
  _updateSnoozeButton();
  _closeSnoozeModal();
  setSaveButtonUnsaved();
  cwocToast('Snoozed until ' + _formatSnoozeLabel(until), 'info');
}

/**
 * Snooze until a custom date/time.
 */
function _doSnoozeCustom() {
  var dateInput = document.getElementById('snooze-custom-date');
  var timeInput = document.getElementById('snooze-custom-time');
  if (!dateInput || !dateInput.value) {
    cwocToast('Please select a date.', 'error');
    return;
  }
  var dateStr = dateInput.value;
  var timeStr = timeInput ? timeInput.value : '09:00';
  if (!timeStr) timeStr = '09:00';

  var until = new Date(dateStr + 'T' + timeStr + ':00');
  if (isNaN(until.getTime())) {
    cwocToast('Invalid date/time.', 'error');
    return;
  }
  if (until <= new Date()) {
    cwocToast('Snooze time must be in the future.', 'error');
    return;
  }

  window._currentSnoozedUntil = until.toISOString();
  _updateSnoozeButton();
  _closeSnoozeModal();
  setSaveButtonUnsaved();
  cwocToast('Snoozed until ' + _formatSnoozeLabel(until), 'info');
}

/**
 * Remove snooze (wake up now).
 */
function _doUnsnooze() {
  window._currentSnoozedUntil = null;
  _updateSnoozeButton();
  _closeSnoozeModal();
  setSaveButtonUnsaved();
  cwocToast('Chit unsnoozed — now visible again.', 'info');
}
