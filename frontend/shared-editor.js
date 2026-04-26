/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Shared Editor Components  (shared-editor.js)

   Reusable editor patterns extracted from the chit editor, used by both
   the Chit Editor and the Contact Editor.

   1. cwocToggleZone()        — zone expand/collapse
   2. CwocEditorSaveSystem    — wraps CwocSaveSystem with editor defaults
   3. cwocInitEditorHotkeys() — Alt+N zone focus hotkeys
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Toggle a collapsible zone open/closed.
 *
 * Ignores clicks on interactive elements inside the zone header (buttons,
 * inputs, selects, labels) so that only clicks on the header background,
 * title text, or toggle icon trigger the collapse.
 *
 * @param {Event}  event      — the click event
 * @param {string} sectionId  — id of the zone wrapper element
 * @param {string} contentId  — id of the zone body/content element
 */
function cwocToggleZone(event, sectionId, contentId) {
  const target = event.target;
  if (
    target.closest('.zone-button') ||
    target.closest('button') ||
    target.closest('input') ||
    target.closest('select') ||
    target.closest('label')
  ) {
    return;
  }

  const section = document.getElementById(sectionId);
  const content = document.getElementById(contentId);
  if (!section || !content) return;

  const isCollapsing = !content.classList.contains('collapsed');
  content.classList.toggle('collapsed');
  section.classList.toggle('collapsed');

  const zoneButtons = section.querySelectorAll('.zone-button');
  zoneButtons.forEach(function (button) {
    if (isCollapsing) {
      button.style.display = 'none';
    } else {
      button.style.display = '';
    }
  });
}

/**
 * Editor-specific save system that wraps CwocSaveSystem (from shared-page.js)
 * with editor defaults: auto-marks unsaved on any input/textarea/select change,
 * and provides convenience helpers for editor pages.
 *
 * @param {Object} opts
 * @param {string} opts.singleBtnId   — the greyed-out "Saved" button id
 * @param {string} opts.stayBtnId     — "Save & Stay" button id
 * @param {string} opts.exitBtnId     — "Save & Exit" button id
 * @param {string} opts.cancelSelector — CSS selector for cancel/exit button
 * @param {Function} [opts.getReturnUrl] — returns the URL to navigate to on exit
 * @param {boolean}  [opts.autoListenInputs=true] — auto-attach input listeners
 */
class CwocEditorSaveSystem {
  constructor(opts) {
    this._save = new CwocSaveSystem({
      singleBtnId:    opts.singleBtnId,
      stayBtnId:      opts.stayBtnId,
      exitBtnId:      opts.exitBtnId,
      cancelSelector: opts.cancelSelector,
      getReturnUrl:   opts.getReturnUrl || function () { return '/'; },
    });

    // Auto-attach input change listeners unless explicitly disabled
    if (opts.autoListenInputs !== false) {
      this._attachInputListeners();
    }
  }

  /** Attach change listeners to all inputs, textareas, and selects in the page. */
  _attachInputListeners() {
    var self = this;
    document.querySelectorAll('input, textarea, select').forEach(function (el) {
      el.addEventListener('input', function () { self.markUnsaved(); });
    });
  }

  /** Mark the editor as having unsaved changes (show Save & Stay / Save & Exit). */
  markUnsaved() {
    this._save.markUnsaved();
  }

  /** Mark the editor as saved (show greyed-out "Saved" button). */
  markSaved() {
    this._save.markSaved();
  }

  /** Returns true if there are unsaved changes. */
  hasChanges() {
    return this._save.hasChanges();
  }

  /** Handle cancel/exit with unsaved-changes confirmation. */
  cancelOrExit() {
    this._save.cancelOrExit();
  }
}

/**
 * Initialize Alt+N hotkeys for zone focus/expand.
 *
 * @param {Object} zoneMap — maps key characters to [sectionId, contentId] pairs.
 *   Example:
 *     {
 *       '1': ['datesSection',   'datesContent'],
 *       '2': ['taskSection',    'taskContent'],
 *       '3': ['tagsSection',    'tagsContent'],
 *     }
 *
 * When the user presses Alt+<key>, the corresponding zone is expanded (if
 * collapsed) and scrolled into view.
 */
function cwocInitEditorHotkeys(zoneMap) {
  document.addEventListener('keydown', function (e) {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;

    var zone = zoneMap[e.key];
    if (!zone) return;

    e.preventDefault();
    var sectionId = zone[0];
    var contentId = zone[1];
    var section = document.getElementById(sectionId);
    var content = document.getElementById(contentId);
    if (!section || !content) return;

    // Expand the zone if it is currently collapsed
    if (content.classList.contains('collapsed')) {
      cwocToggleZone(new MouseEvent('click'), sectionId, contentId);
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// Export globally (no ES modules)
window.cwocToggleZone = cwocToggleZone;
window.CwocEditorSaveSystem = CwocEditorSaveSystem;
window.cwocInitEditorHotkeys = cwocInitEditorHotkeys;
