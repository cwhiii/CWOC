/**
 * editor-nest.js — Nest button logic for associating chits with email threads
 *
 * Provides the nest button in the editor title row that allows users to attach
 * any non-email chit to an existing email thread. When active, the button turns
 * blue and shows the first 15 characters of the thread subject. Clicking an
 * active button removes the nest; clicking an inactive button opens the thread
 * picker modal.
 *
 * Depends on: shared.js (setSaveButtonUnsaved, cwocToast)
 * Loaded before: editor-init.js
 */

/* ── State ──────────────────────────────────────────────────────────────────── */

var _nestCurrentThreadId = null;
var _nestCurrentSubject = '';
var _nestPickerEscHandler = null;

/* ── Public API ─────────────────────────────────────────────────────────────── */

/**
 * Initialize the nest button state based on the loaded chit data.
 * Called from loadChitData() in editor-init.js after the chit is loaded.
 *
 * @param {Object} chit — the chit object from the API
 */
function initNestButton(chit) {
  var btn = document.getElementById('nestButton');
  if (!btn) return;

  // Hide nest button for email chits — they already belong to threads natively
  if (_nestIsEmailChit(chit)) {
    btn.style.display = 'none';
    return;
  }

  // Show the button for non-email chits
  btn.style.display = '';

  // Set initial state from chit data
  if (chit.nest_thread_id) {
    _nestCurrentThreadId = chit.nest_thread_id;
    _nestCurrentSubject = '';
    _nestSetActive('…');

    // Fetch the thread subject from the referenced email chit
    fetch('/api/chit/' + encodeURIComponent(chit.nest_thread_id))
      .then(function(resp) { return resp.ok ? resp.json() : null; })
      .then(function(refChit) {
        if (refChit) {
          var subject = refChit.email_subject || refChit.title || '';
          _nestCurrentSubject = subject;
          _nestSetActive(subject);
        }
      })
      .catch(function() { /* leave as-is */ });
  } else {
    _nestCurrentThreadId = null;
    _nestCurrentSubject = '';
    _nestSetInactive();
  }

  // Also set the hidden input value
  var input = document.getElementById('nestThreadId');
  if (input) input.value = _nestCurrentThreadId || '';
}

/**
 * Return the current nest_thread_id for inclusion in the save payload.
 *
 * @returns {Object} object with nest_thread_id key
 */
function getNestData() {
  return { nest_thread_id: _nestCurrentThreadId || null };
}

/**
 * Check if a chit is an email chit (has email_message_id or email_status).
 *
 * @param {Object} chit — the chit object
 * @returns {boolean} true if the chit is an email chit
 */
function _nestIsEmailChit(chit) {
  return !!(chit && (chit.email_message_id || chit.email_status));
}

/* ── Button Click Handler ───────────────────────────────────────────────────── */

/**
 * Handle nest button click — toggle behavior:
 * - If active (has nest): remove the nest association
 * - If inactive (no nest): open the thread picker
 */
function _nestButtonClick() {
  if (_nestCurrentThreadId) {
    _nestRemove();
  } else {
    _nestOpenPicker();
  }
}

/* ── Nest Selection & Removal ───────────────────────────────────────────────── */

/**
 * Set the nest association to a selected thread.
 *
 * @param {string} threadId — the ID of the email chit in the target thread
 * @param {string} subject — the thread subject line
 */
function _nestSelectThread(threadId, subject) {
  _nestCurrentThreadId = threadId;
  _nestCurrentSubject = subject || '';

  var input = document.getElementById('nestThreadId');
  if (input) input.value = threadId;

  _nestSetActive(subject);
  _nestClosePicker();
  setSaveButtonUnsaved();
}

/**
 * Remove the nest association (clear nest_thread_id).
 */
function _nestRemove() {
  _nestCurrentThreadId = null;
  _nestCurrentSubject = '';

  var input = document.getElementById('nestThreadId');
  if (input) input.value = '';

  _nestSetInactive();
  setSaveButtonUnsaved();
}

/* ── Thread Picker Modal ────────────────────────────────────────────────────── */

/**
 * Open the thread picker modal — fetches recent threads and renders the list.
 */
async function _nestOpenPicker() {
  try {
    var threads = await _nestFetchThreads('');
    _nestRenderPicker(threads);
  } catch (e) {
    console.error('[_nestOpenPicker] Error:', e);
    cwocToast('Could not load email threads. Check your connection.', 'error');
  }
}

/**
 * Fetch recent email threads from the API.
 *
 * @param {string} query — optional search filter
 * @returns {Promise<Array>} array of thread objects
 */
async function _nestFetchThreads(query) {
  var url = '/api/email/threads/recent';
  if (query) url += '?q=' + encodeURIComponent(query);

  var response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch threads: ' + response.status);
  }
  return await response.json();
}

/**
 * Render the thread picker modal with the given threads list.
 *
 * @param {Array} threads — array of thread summary objects
 */
function _nestRenderPicker(threads) {
  // Remove any existing picker
  _nestClosePicker();

  // Create overlay
  var overlay = document.createElement('div');
  overlay.className = 'cwoc-modal-overlay';
  overlay.id = 'nestThreadPickerOverlay';

  // Create modal
  var modal = document.createElement('div');
  modal.className = 'cwoc-modal nest-thread-picker-modal';

  // Title
  var title = document.createElement('h3');
  title.textContent = 'Select Email Thread';
  title.style.cssText = 'margin:0 0 12px 0;font-family:Lora,Georgia,serif;color:#6b4e31;';
  modal.appendChild(title);

  // Search input
  var search = document.createElement('input');
  search.type = 'text';
  search.id = 'nestPickerSearch';
  search.className = 'nest-picker-search';
  search.placeholder = 'Filter by subject...';
  modal.appendChild(search);

  // Thread list container
  var list = document.createElement('div');
  list.className = 'nest-picker-list';
  list.id = 'nestPickerList';
  _nestRenderList(list, threads);
  modal.appendChild(list);

  // Cancel button
  var cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'zone-button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'margin-top:12px;';
  cancelBtn.onclick = function () { _nestClosePicker(); };
  modal.appendChild(cancelBtn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Focus search input
  search.focus();

  // Wire up search filtering with debounce
  var _searchTimeout = null;
  search.addEventListener('input', function () {
    var q = search.value.trim();
    clearTimeout(_searchTimeout);
    _searchTimeout = setTimeout(async function () {
      try {
        var filtered = await _nestFetchThreads(q);
        _nestRenderList(list, filtered);
      } catch (e) {
        console.error('[_nestOpenPicker] Search error:', e);
      }
    }, 300);
  });

  // ESC handler — capture phase, stop propagation (ESC priority chain)
  _nestPickerEscHandler = function (e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      _nestClosePicker();
    }
  };
  document.addEventListener('keydown', _nestPickerEscHandler, true);

  // Click overlay to dismiss
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
      _nestClosePicker();
    }
  });
}

/**
 * Render the list of threads inside the picker list container.
 *
 * @param {HTMLElement} listEl — the list container element
 * @param {Array} threads — array of thread summary objects
 */
function _nestRenderList(listEl, threads) {
  listEl.innerHTML = '';

  if (!threads || threads.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'nest-picker-empty';
    empty.textContent = 'No email threads found. Send or receive emails first.';
    listEl.appendChild(empty);
    return;
  }

  threads.forEach(function (thread) {
    var item = document.createElement('div');
    item.className = 'nest-picker-item';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');

    var subjectSpan = document.createElement('span');
    subjectSpan.className = 'nest-picker-subject';
    subjectSpan.textContent = thread.subject || '(No subject)';

    var metaSpan = document.createElement('span');
    metaSpan.className = 'nest-picker-meta';
    var dateStr = '';
    if (thread.latest_date) {
      try {
        var d = new Date(thread.latest_date);
        dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } catch (e) { dateStr = thread.latest_date; }
    }
    metaSpan.textContent = dateStr + (thread.message_count ? ' · ' + thread.message_count + ' msgs' : '');

    item.appendChild(subjectSpan);
    item.appendChild(metaSpan);

    item.onclick = function () {
      _nestSelectThread(thread.thread_id, thread.subject);
    };
    item.onkeydown = function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        _nestSelectThread(thread.thread_id, thread.subject);
      }
    };

    listEl.appendChild(item);
  });
}

/**
 * Close and remove the thread picker modal.
 */
function _nestClosePicker() {
  var overlay = document.getElementById('nestThreadPickerOverlay');
  if (overlay) overlay.remove();

  // Remove ESC handler
  if (_nestPickerEscHandler) {
    document.removeEventListener('keydown', _nestPickerEscHandler, true);
    _nestPickerEscHandler = null;
  }
}

/* ── UI State Helpers ───────────────────────────────────────────────────────── */

/**
 * Set the nest button to active state (blue, with subject label).
 *
 * @param {string} subject — the thread subject to display
 */
function _nestSetActive(subject) {
  var btn = document.getElementById('nestButton');
  if (!btn) return;

  btn.classList.add('nest-button-active');
  btn.title = 'Nested into: ' + (subject || '(unknown thread)') + ' — click to remove';

  var label = document.getElementById('nestButtonLabel');
  if (label) {
    label.textContent = _nestTruncateSubject(subject);
    label.style.display = '';
    label.onclick = function() { _nestButtonClick(); };
  }
}

/**
 * Set the nest button to inactive state (muted, no label).
 */
function _nestSetInactive() {
  var btn = document.getElementById('nestButton');
  if (!btn) return;

  btn.classList.remove('nest-button-active');
  btn.title = 'Nest into email thread';

  var label = document.getElementById('nestButtonLabel');
  if (label) {
    label.textContent = '';
    label.style.display = 'none';
  }
}

/**
 * Truncate a subject string to the first 25 characters.
 * Returns the full string if it's 25 characters or shorter.
 *
 * @param {string} subject — the subject string to truncate
 * @returns {string} truncated subject (max 25 chars)
 */
function _nestTruncateSubject(subject) {
  if (!subject) return '';
  if (subject.length <= 35) return subject;
  return subject.substring(0, 35);
}
