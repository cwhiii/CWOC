/**
 * editor-autosave.js — Auto-save system for the chit editor
 *
 * Provides automatic persistence of chit edits after a debounce period.
 * Controlled by per-platform (mobile/desktop) toggles in user settings.
 * Uses the existing saveChitAndStay() function for persistence and
 * buildChitObject() for validation gating.
 *
 * Depends on: editor-save.js (saveChitAndStay, buildChitObject, _isSaving),
 *             shared-utils.js (getCachedSettings)
 * Loaded after: editor-save.js
 * Loaded before: editor-init.js
 */

/**
 * CwocAutoSave — manages debounced auto-saving with platform-aware settings.
 *
 * @param {Object} settings — the user settings object (from getCachedSettings)
 *   Expected fields: autosave_desktop ("1"|"0"), autosave_mobile ("1"|"0")
 */
function CwocAutoSave(settings) {
  this._settings = settings || {};
  this._debounceMs = 2000;
  this._timerId = null;
  this._enabled = false;
  this._state = 'saved'; // 'saved' | 'pending' | 'saving' | 'error'
  this._retryAfterSave = false;
  this._boundResizeHandler = this._onResize.bind(this);
  this._lastPlatform = this._detectPlatform();

  // Evaluate initial enabled state from settings
  this._enabled = this._readSettingForPlatform();

  // Listen for viewport resize to re-evaluate platform
  window.addEventListener('resize', this._boundResizeHandler);

  // Apply initial UI state
  if (this._enabled) {
    this._showIndicator();
    this._hideSaveButtons();
  }
}

/**
 * Detect current platform based on viewport width.
 * @returns {'mobile'|'desktop'}
 */
CwocAutoSave.prototype._detectPlatform = function () {
  return window.innerWidth <= 768 ? 'mobile' : 'desktop';
};

/**
 * Read the appropriate auto-save setting for the current platform.
 * @returns {boolean}
 */
CwocAutoSave.prototype._readSettingForPlatform = function () {
  var platform = this._detectPlatform();
  if (platform === 'mobile') {
    return this._settings.autosave_mobile === '1';
  }
  return this._settings.autosave_desktop === '1';
};

/**
 * Handle viewport resize — re-evaluate platform setting when crossing 768px.
 */
CwocAutoSave.prototype._onResize = function () {
  var newPlatform = this._detectPlatform();
  if (newPlatform === this._lastPlatform) return;

  this._lastPlatform = newPlatform;
  var wasEnabled = this._enabled;
  this._enabled = this._readSettingForPlatform();

  if (wasEnabled && !this._enabled) {
    // Transitioning from enabled to disabled
    this.cancelPending();
    this._hideIndicator();
    this._showSaveButtons();
  } else if (!wasEnabled && this._enabled) {
    // Transitioning from disabled to enabled
    this._showIndicator();
    this._hideSaveButtons();
  }
};

/**
 * Enable auto-save manually (overrides setting).
 */
CwocAutoSave.prototype.enable = function () {
  this._enabled = true;
  this._showIndicator();
  this._hideSaveButtons();
};

/**
 * Disable auto-save manually (overrides setting).
 */
CwocAutoSave.prototype.disable = function () {
  this._enabled = false;
  this.cancelPending();
  this._hideIndicator();
  this._showSaveButtons();
};

/**
 * Schedule an auto-save after the debounce period.
 * Resets the timer on each call (debounce behavior).
 */
CwocAutoSave.prototype.scheduleAutoSave = function () {
  if (!this._enabled) return;

  // Reset existing timer
  this.cancelPending();

  this._state = 'pending';
  this._updateIndicator();

  var self = this;
  this._timerId = setTimeout(function () {
    self._timerId = null;
    self._performSave();
  }, this._debounceMs);
};

/**
 * Cancel any pending auto-save timer.
 */
CwocAutoSave.prototype.cancelPending = function () {
  if (this._timerId !== null) {
    clearTimeout(this._timerId);
    this._timerId = null;
  }
};

/**
 * Check if auto-save is currently enabled.
 * @returns {boolean}
 */
CwocAutoSave.prototype.isEnabled = function () {
  return this._enabled;
};

/**
 * Get the current auto-save state.
 * @returns {'saved'|'pending'|'saving'|'error'}
 */
CwocAutoSave.prototype.getState = function () {
  return this._state;
};

/**
 * Perform the actual save operation with validation and in-flight guard.
 */
CwocAutoSave.prototype._performSave = async function () {
  // In-flight guard: if a save is already in progress, schedule retry
  if (typeof _isSaving !== 'undefined' && _isSaving) {
    this._retryAfterSave = true;
    return;
  }

  // Validation gate: build the chit object, skip if invalid
  var chit = null;
  try {
    chit = await buildChitObject();
  } catch (e) {
    // Validation error — skip silently
    this._state = 'pending';
    this._updateIndicator();
    return;
  }

  if (!chit) {
    // Validation failed (buildChitObject returned null) — skip silently
    // State stays as 'pending' so next change will retry
    this._state = 'pending';
    this._updateIndicator();
    return;
  }

  // Perform the save
  this._state = 'saving';
  this._updateIndicator();

  try {
    await saveChitAndStay();
    this._state = 'saved';
    this._updateIndicator();

    // If changes occurred during save, schedule another save
    if (this._retryAfterSave) {
      this._retryAfterSave = false;
      this.scheduleAutoSave();
    }
  } catch (e) {
    console.error('[CwocAutoSave] Save failed:', e);
    this._state = 'error';
    this._updateIndicator();
  }
};

/**
 * Notify auto-save that a manual or external save completed.
 * Used to clear retry flag and update state.
 */
CwocAutoSave.prototype.notifySaveComplete = function () {
  if (this._retryAfterSave) {
    this._retryAfterSave = false;
    this.scheduleAutoSave();
  } else if (this._state === 'saving') {
    this._state = 'saved';
    this._updateIndicator();
  }
};

/**
 * Notify auto-save that a save failed externally.
 */
CwocAutoSave.prototype.notifySaveError = function () {
  this._state = 'error';
  this._updateIndicator();
};

// ── UI Management ────────────────────────────────────────────────────────────

/**
 * Update the auto-save indicator element based on current state.
 */
CwocAutoSave.prototype._updateIndicator = function () {
  var el = document.getElementById('autosave-indicator');
  if (!el) return;

  switch (this._state) {
    case 'saved':
      el.textContent = '✅ Saved';
      el.className = 'autosave-indicator autosave-saved';
      break;
    case 'pending':
      el.textContent = '⏳ Saving soon...';
      el.className = 'autosave-indicator autosave-pending';
      break;
    case 'saving':
      el.textContent = '💾 Saving...';
      el.className = 'autosave-indicator autosave-saving';
      break;
    case 'error':
      el.textContent = '⚠️ Save failed';
      el.className = 'autosave-indicator autosave-error';
      break;
  }
};

/**
 * Show the auto-save indicator element.
 */
CwocAutoSave.prototype._showIndicator = function () {
  var el = document.getElementById('autosave-indicator');
  if (el) {
    el.style.display = '';
    this._updateIndicator();
  }
};

/**
 * Hide the auto-save indicator element.
 */
CwocAutoSave.prototype._hideIndicator = function () {
  var el = document.getElementById('autosave-indicator');
  if (el) el.style.display = 'none';
};

/**
 * Hide manual save buttons when auto-save is enabled.
 * Keeps the Exit button visible.
 */
CwocAutoSave.prototype._hideSaveButtons = function () {
  var saveStay = document.getElementById('saveStayButton');
  var saveExit = document.getElementById('saveExitButton');
  var saveBtn = document.getElementById('saveButton');
  if (saveStay) saveStay.style.display = 'none';
  if (saveExit) saveExit.style.display = 'none';
  if (saveBtn) saveBtn.style.display = 'none';
};

/**
 * Show manual save buttons when auto-save is disabled.
 */
CwocAutoSave.prototype._showSaveButtons = function () {
  var saveBtn = document.getElementById('saveButton');
  if (saveBtn) saveBtn.style.display = '';
  // saveStayButton and saveExitButton are managed by CwocSaveSystem
  // so we just restore the default save button
};

/**
 * Perform an immediate save (used for exit-with-pending-changes).
 * Returns a promise that resolves when save completes or rejects on failure.
 */
CwocAutoSave.prototype.saveImmediately = async function () {
  this.cancelPending();

  // Validation gate
  var chit = await buildChitObject();
  if (!chit) {
    throw new Error('Validation failed');
  }

  this._state = 'saving';
  this._updateIndicator();

  try {
    await saveChitAndStay();
    this._state = 'saved';
    this._updateIndicator();
  } catch (e) {
    this._state = 'error';
    this._updateIndicator();
    throw e;
  }
};

/**
 * Clean up event listeners (call when leaving the editor).
 */
CwocAutoSave.prototype.destroy = function () {
  this.cancelPending();
  window.removeEventListener('resize', this._boundResizeHandler);
};

// Expose globally for other scripts
window.CwocAutoSave = CwocAutoSave;
