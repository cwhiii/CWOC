/**
 * editor-nest.js — Nest button logic for associating chits with email threads
 *
 * Provides the nest button in the editor title row that allows users to attach
 * any non-email chit to an existing email thread. When active, the button shows
 * the thread subject in a cream pill next to it. Clicking an active button
 * removes the nest; clicking an inactive button opens the thread picker modal.
 *
 * The picker reuses the same modal pattern as the "Add Chit" modal in Projects,
 * filtered to only show email chits.
 *
 * Depends on: shared.js (setSaveButtonUnsaved, cwocToast)
 * Loaded before: editor-init.js
 */

/* ── State ──────────────────────────────────────────────────────────────────── */

var _nestCurrentThreadId = null;
var _nestCurrentSubject = '';

/* ── Public API ─────────────────────────────────────────────────────────────── */

/**
 * Initialize the nest button state based on the loaded chit data.
 * Called from loadChitData() in editor-init.js after the chit is loaded.
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
 */
function getNestData() {
  return { nest_thread_id: _nestCurrentThreadId || null };
}

/**
 * Check if a chit is an email chit (has email_message_id or email_status).
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


/* ── Thread Picker Modal (same pattern as Add Chit modal in Projects) ───────── */

/**
 * Open the nest picker modal — fetches all chits, filters to email only,
 * displays in the same table modal as the project "Add Chit" modal.
 * Single-click a row to select that email chit as the nest target.
 */
async function _nestOpenPicker() {
  var modal = document.getElementById("nestChitModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "nestChitModal";
    modal.className = "modal-overlay-new";
    document.body.appendChild(modal);

    modal.innerHTML =
      '<div class="modal-content-new">' +
        '<div class="modal-header-new">' +
          '<h2>Select Email Thread</h2>' +
          '<div class="modal-buttons"></div>' +
        '</div>' +
        '<div class="modal-body-new">' +
          '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">' +
            '<input type="text" id="nestChitSearch" class="chit-search-input-new" placeholder="Search email chits..." autofocus style="flex:1;">' +
          '</div>' +
          '<table class="chit-table-new">' +
            '<thead><tr><th>Subject</th><th>From</th><th>Date</th></tr></thead>' +
            '<tbody id="nestChitList"></tbody>' +
          '</table>' +
        '</div>' +
        '<div class="modal-footer-new">' +
          '<button class="modal-button-new cancel" id="nestChitCancelBtn">Cancel</button>' +
        '</div>' +
      '</div>';

    // Cancel button
    document.getElementById("nestChitCancelBtn").addEventListener("click", function() {
      modal.style.display = "none";
    });

    // Click overlay to close
    modal.addEventListener("click", function(e) {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });

    // ESC to close (capture phase, layered: clear search first, then close)
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && modal.style.display === "flex") {
        e.preventDefault();
        e.stopImmediatePropagation();
        var searchInput = document.getElementById("nestChitSearch");
        if (searchInput && searchInput.value.trim()) {
          searchInput.value = "";
          searchInput.dispatchEvent(new Event("input"));
        } else {
          modal.style.display = "none";
        }
      }
    }, true);
  }

  modal.style.display = "flex";

  try {
    var response = await fetch("/api/chits");
    if (!response.ok) throw new Error("Failed to fetch chits");
    var allChits = await response.json();

    // Filter to only email chits (have email_message_id or email_status), not deleted
    var emailChits = allChits
      .filter(function(c) {
        return (c.email_message_id || c.email_status) && !c.deleted;
      })
      .sort(function(a, b) {
        var da = a.email_date || a.modified_datetime || '';
        var db = b.email_date || b.modified_datetime || '';
        return db.localeCompare(da);
      });

    modal._emailChits = emailChits;

    var listEl = document.getElementById("nestChitList");
    var searchInput = document.getElementById("nestChitSearch");

    function renderNestChits(chitsToRender) {
      listEl.innerHTML = "";
      if (chitsToRender.length === 0) {
        listEl.innerHTML = '<tr><td colspan="3" style="text-align:center;opacity:0.6;padding:12px;">No email chits found.</td></tr>';
        return;
      }
      chitsToRender.forEach(function(chit) {
        var row = document.createElement("tr");
        row.style.cursor = "pointer";
        row.addEventListener("click", function() {
          var subject = chit.email_subject || chit.title || '';
          _nestSelectThread(chit.id, subject);
          modal.style.display = "none";
        });
        row.addEventListener("mouseenter", function() { row.style.background = "rgba(74,144,217,0.1)"; });
        row.addEventListener("mouseleave", function() { row.style.background = ""; });

        var subjectCell = document.createElement("td");
        subjectCell.textContent = chit.email_subject || chit.title || '(No Subject)';
        row.appendChild(subjectCell);

        var fromCell = document.createElement("td");
        fromCell.textContent = chit.email_from || '';
        fromCell.style.fontSize = "0.85em";
        row.appendChild(fromCell);

        var dateCell = document.createElement("td");
        dateCell.style.fontSize = "0.85em";
        dateCell.style.whiteSpace = "nowrap";
        if (chit.email_date) {
          try {
            var d = new Date(chit.email_date);
            dateCell.textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          } catch(e) { dateCell.textContent = chit.email_date; }
        }
        row.appendChild(dateCell);

        listEl.appendChild(row);
      });
    }

    function _filterNestChits() {
      var term = (searchInput.value || "").toLowerCase().trim();
      var filtered = modal._emailChits;
      if (term) {
        filtered = filtered.filter(function(c) {
          var subject = (c.email_subject || c.title || '').toLowerCase();
          var from = (c.email_from || '').toLowerCase();
          return subject.indexOf(term) !== -1 || from.indexOf(term) !== -1;
        });
      }
      renderNestChits(filtered);
      var headerH2 = modal.querySelector('.modal-header-new h2');
      if (headerH2) headerH2.textContent = 'Select Email Thread (' + filtered.length + ' shown)';
    }

    searchInput.removeEventListener("input", _filterNestChits);
    searchInput.addEventListener("input", _filterNestChits);

    // Initial render
    searchInput.value = "";
    renderNestChits(emailChits);
    var headerH2 = modal.querySelector('.modal-header-new h2');
    if (headerH2) headerH2.textContent = 'Select Email Thread (' + emailChits.length + ' available)';
    setTimeout(function() { searchInput.focus(); }, 50);

  } catch (error) {
    console.error("[_nestOpenPicker] Error:", error);
    cwocToast("Could not load email chits. Check your connection.", "error");
    modal.style.display = "none";
  }
}

/**
 * Close the nest picker modal.
 */
function _nestClosePicker() {
  var modal = document.getElementById("nestChitModal");
  if (modal) modal.style.display = "none";
}

/* ── UI State Helpers ───────────────────────────────────────────────────────── */

/**
 * Set the nest button to active state (with subject label pill).
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
 * Set the nest button to inactive state (no label).
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
 * Truncate a subject string to the first 35 characters.
 * Returns the full string if it's 35 characters or shorter.
 */
function _nestTruncateSubject(subject) {
  if (!subject) return '';
  if (subject.length <= 35) return subject;
  return subject.substring(0, 35);
}
