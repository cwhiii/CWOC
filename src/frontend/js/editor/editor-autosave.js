/**
 * editor-autosave.js — Auto-save system for the chit editor.
 *
 * Automatically persists edits after a 2-second debounce period when enabled.
 * Controlled by per-platform (mobile/desktop) toggles in user settings.
 * Uses the existing saveChitAndStay() function for persistence.
 * Provides visual feedback via a save status indicator.
 */

// ── CwocAutoSave Class ──────────────────────────────────────────────────────

class CwocAutoSave {
  constructor(settings) {
    this._settings = settings || {};
    this._debounceMs = 2000;
    this._timer = null;
    this._isSaving = false;
    this._pendingAfterSave = false;
    this._state = 'saved'; // 'saved' | 'pending' | 'saving' | 'error'
    this._enabled = this._computeEnabled();
    this._indicatorEl = document.getElementById('autosave-indicator');

    // Listen for viewport resize to re-evaluate platform
    this._resizeHandler = this._onResize.bind(this);
    window.addEventListener('resize', this._resizeHandler);

    // Apply initial UI state
    this._applyUIMode();
    this._updateIndicator();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  isEnabled() {
    return this._enabled;
  }

  getState() {
    return this._state;
  }

  enable() {
    this._enabled = true;
    this._applyUIMode();
    this._updateIndicator();
  }

  disable() {
    this._enabled = false;
    this.cancelPending();
    this._applyUIMode();
    this._updateIndicator();
  }

  /**
   * Called when the editor detects a change. Starts/resets the debounce timer.
   */
  scheduleAutoSave() {
    if (!this._enabled) return;
    this.cancelPending();
    this._state = 'pending';
    this._updateIndicator();
    this._timer = setTimeout(() => this._triggerSave(), this._debounceMs);
  }

  /**
   * Cancel any pending debounce timer.
   */
  cancelPending() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /**
   * Notify auto-save that a save completed successfully (called from setSaveButtonSaved).
   */
  notifySaveComplete() {
    this._isSaving = false;
    if (this._pendingAfterSave) {
      this._pendingAfterSave = false;
      this.scheduleAutoSave();
    } else {
      this._state = 'saved';
      this._updateIndicator();
    }
  }

  /**
   * Notify auto-save that a save failed.
   */
  notifySaveError() {
    this._isSaving = false;
    this._state = 'error';
    this._updateIndicator();
  }

  /**
   * Perform an immediate save (used on exit). Returns a promise.
   */
  async saveImmediately() {
    this.cancelPending();
    if (this._isSaving) {
      // Wait for current save to finish
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (!this._isSaving) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }
    await this._executeSave();
  }

  /**
   * Whether there are unsaved changes (pending or error state).
   */
  hasUnsavedChanges() {
    return this._state === 'pending' || this._state === 'error';
  }

  destroy() {
    this.cancelPending();
    window.removeEventListener('resize', this._resizeHandler);
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  _computeEnabled() {
    var isMobile = window.innerWidth <= 768;
    if (isMobile) {
      return this._settings.autosave_mobile === '1';
    }
    return this._settings.autosave_desktop === '1';
  }

  _onResize() {
    var wasEnabled = this._enabled;
    this._enabled = this._computeEnabled();
    if (wasEnabled !== this._enabled) {
      if (!this._enabled) {
        this.cancelPending();
      }
      this._applyUIMode();
      this._updateIndicator();
    }
  }

  async _triggerSave() {
    if (this._isSaving) {
      // A save is already in progress — schedule retry after it completes
      this._pendingAfterSave = true;
      return;
    }
    await this._executeSave();
  }

  async _executeSave() {
    // Validation gate: check if chit can be built
    try {
      var chit = await buildChitObject();
      if (!chit) {
        // Validation failed — skip save silently, will retry on next change
        this._state = 'pending';
        this._updateIndicator();
        return;
      }
    } catch (e) {
      // buildChitObject threw — skip save
      this._state = 'pending';
      this._updateIndicator();
      return;
    }

    this._isSaving = true;
    this._state = 'saving';
    this._updateIndicator();

    try {
      await saveChitAndStay();
      // notifySaveComplete will be called via setSaveButtonSaved hook
    } catch (e) {
      console.error('[CwocAutoSave] Save failed:', e);
      this.notifySaveError();
    }
  }

  _applyUIMode() {
    var saveStayBtn = document.getElementById('saveStayButton');
    var saveExitBtn = document.getElementById('saveExitButton');
    var saveBtn = document.getElementById('saveButton');
    var cancelBtn = document.querySelector('.header-row .buttons .cancel');

    if (this._enabled) {
      // Hide manual save buttons, show only indicator + exit
      if (saveStayBtn) saveStayBtn.style.display = 'none';
      if (saveExitBtn) saveExitBtn.style.display = 'none';
      if (saveBtn) saveBtn.style.display = 'none';
      if (this._indicatorEl) this._indicatorEl.style.display = 'inline-flex';
    } else {
      // Restore normal button behavior (let CwocSaveSystem manage visibility)
      if (saveBtn) saveBtn.style.display = '';
      if (this._indicatorEl) this._indicatorEl.style.display = 'none';
    }
  }

  _updateIndicator() {
    if (!this._indicatorEl) return;
    if (!this._enabled) {
      this._indicatorEl.style.display = 'none';
      return;
    }

    this._indicatorEl.style.display = 'inline-flex';
    this._indicatorEl.className = 'autosave-indicator autosave-' + this._state;

    switch (this._state) {
      case 'saved':
        this._indicatorEl.textContent = '✅ Saved';
        break;
      case 'pending':
        this._indicatorEl.textContent = '⏳ Saving soon...';
        break;
      case 'saving':
        this._indicatorEl.textContent = '💾 Saving...';
        break;
      case 'error':
        this._indicatorEl.textContent = '⚠️ Save failed';
        break;
    }
  }
}

// Global auto-save instance (initialized in editor-init.js)
var _cwocAutoSave = null;
