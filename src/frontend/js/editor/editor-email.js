/**
 * editor-email.js — Email zone: populate, collect, reply, forward, send
 *
 * Handles the Email zone in the chit editor: populating fields from chit data,
 * collecting field values for save, toggling read-only state based on email_status,
 * and creating reply/forward drafts via the API.
 *
 * Depends on: shared-utils.js (cwocToast, generateUniqueId),
 *             shared-editor.js (cwocToggleZone),
 *             editor-save.js (setSaveButtonUnsaved)
 * Loaded before: editor-save.js, editor-init.js
 */

/** Stores the currently loaded chit for reply/forward operations */
var _emailCurrentChit = null;

/** Tracks whether the email expand modal is currently open */
var _emailExpandModalOpen = false;

/** Cached contacts for email autocomplete */
var _emailContactsCache = null;

/**
 * Fetch contacts for autocomplete (cached after first call).
 */
async function _emailLoadContacts() {
  if (_emailContactsCache) return _emailContactsCache;
  try {
    var resp = await fetch('/api/contacts');
    if (resp.ok) {
      _emailContactsCache = await resp.json();
    } else {
      _emailContactsCache = [];
    }
  } catch (e) {
    _emailContactsCache = [];
  }
  return _emailContactsCache;
}

/**
 * Search contacts by query string, return top 5 matches.
 * Favorites float to the top.
 */
function _emailSearchContacts(query) {
  if (!_emailContactsCache || !query) return [];
  var q = query.toLowerCase();
  var matches = [];
  _emailContactsCache.forEach(function(c) {
    var name = (c.display_name || c.given_name || '').toLowerCase();
    var emailList = c.emails || [];
    var emailMatch = emailList.some(function(e) { return (e.value || '').toLowerCase().indexOf(q) !== -1; });
    if (name.indexOf(q) !== -1 || emailMatch) {
      // Pick the best email address for this contact
      var primaryEmail = '';
      if (emailList.length > 0) primaryEmail = emailList[0].value || '';
      matches.push({
        display_name: c.display_name || c.given_name || '',
        email: primaryEmail,
        favorite: !!c.favorite,
        contact: c
      });
    }
  });
  // Sort: favorites first, then alphabetical
  matches.sort(function(a, b) {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return a.display_name.localeCompare(b.display_name);
  });
  return matches.slice(0, 5);
}

/**
 * Wire up autocomplete on an email input field.
 * @param {string} inputId — the input element ID
 * @param {string} dropdownId — the dropdown element ID
 */
function _wireEmailAutocomplete(inputId, dropdownId) {
  var input = document.getElementById(inputId);
  var dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) { console.warn('[Email AC] Missing element:', inputId, dropdownId); return; }

  // Prevent double-wiring
  if (input._emailAcWired) return;
  input._emailAcWired = true;

  var debounceTimer = null;

  input.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      var val = input.value;
      // Get the text after the last comma (for multi-recipient fields)
      var parts = val.split(',');
      var current = parts[parts.length - 1].trim();
      if (current.length < 2) { dropdown.style.display = 'none'; return; }

      var results = _emailSearchContacts(current);
      console.log('[Email AC] Query:', current, 'Results:', results.length);
      if (results.length === 0) { dropdown.style.display = 'none'; return; }

      dropdown.innerHTML = '';
      results.forEach(function(r) {
        var item = document.createElement('div');
        item.className = 'email-autocomplete-item';
        var star = r.favorite ? '★ ' : '';
        var emailDisplay = r.email ? ' &lt;' + _escHtml(r.email) + '&gt;' : '';
        item.innerHTML = '<span class="email-ac-name">' + star + _escHtml(r.display_name) + '</span>' +
                         '<span class="email-ac-email">' + emailDisplay + '</span>';
        item.addEventListener('mousedown', function(e) {
          e.preventDefault(); // prevent blur from hiding dropdown
          // Replace the current partial text with the selected contact
          var formatted = r.display_name + (r.email ? ' <' + r.email + '>' : '');
          parts[parts.length - 1] = ' ' + formatted;
          input.value = parts.join(',');
          dropdown.style.display = 'none';
          if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
        });
        dropdown.appendChild(item);
      });
      dropdown.style.display = '';
    }, 150);
  });

  input.addEventListener('blur', function() {
    setTimeout(function() { dropdown.style.display = 'none'; }, 200);
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') dropdown.style.display = 'none';
  });
}

/**
 * Toggle Cc or Bcc field visibility.
 * @param {string} field — 'cc' or 'bcc'
 */
function _toggleEmailCcBcc(field) {
  var rowId = field === 'cc' ? 'emailCcRow' : 'emailBccRow';
  var btnId = field === 'cc' ? 'emailShowCcBtn' : 'emailShowBccBtn';
  var row = document.getElementById(rowId);
  var btn = document.getElementById(btnId);
  if (!row) return;
  var isVisible = row.style.display !== 'none';
  row.style.display = isVisible ? 'none' : '';
  if (btn) btn.style.display = isVisible ? '' : 'none';
  if (!isVisible) {
    // Focus the input when showing
    var inputId = field === 'cc' ? 'emailCc' : 'emailBcc';
    var input = document.getElementById(inputId);
    if (input) setTimeout(function() { input.focus(); }, 50);
  }
}

/**
 * Activate the email zone on a non-email chit — like the Habit toggle button.
 * Moves the zone to top-left, expands it, sets draft status, focuses To field.
 */
function _activateEmailZone() {
  // Set up as a draft email
  _emailCurrentChit = _emailCurrentChit || {};
  _emailCurrentChit.email_status = 'draft';
  _emailCurrentChit.email_folder = 'drafts';

  // Show and move email zone to top of column-one
  var emailSection = document.getElementById('emailSection');
  var colOne = document.querySelector('.column-one');
  if (emailSection) {
    emailSection.style.display = ''; // unhide the zone
  }
  if (emailSection && colOne) {
    colOne.insertBefore(emailSection, colOne.firstChild);
  }

  // Expand the zone
  var emailContent = document.getElementById('emailContent');
  if (emailSection && emailContent) {
    emailContent.style.display = '';
    emailSection.classList.remove('collapsed');
    emailSection.classList.add('expanded');
    var icon = emailSection.querySelector('.zone-toggle-icon');
    if (icon) icon.textContent = '🔼';
  }

  // Update button visibility for draft mode
  _updateEmailButtons('draft');

  // Populate From field from configured account
  var fromEl = document.getElementById('emailFrom');
  if (fromEl && !fromEl.textContent.trim()) {
    if (window._cwocSettings && window._cwocSettings.email_account) {
      var acct = window._cwocSettings.email_account;
      if (typeof acct === 'string') { try { acct = JSON.parse(acct); } catch(e) {} }
      if (acct && acct.email) {
        fromEl.textContent = acct.display_name ? acct.display_name + ' <' + acct.email + '>' : acct.email;
      }
    }
  }

  // Switch to email save buttons
  _showEmailSaveButtons(true);

  // Auto-collapse dates
  var datesSection = document.getElementById('datesSection');
  var datesContent = document.getElementById('datesContent');
  if (datesSection && datesContent) {
    datesSection.classList.add('collapsed');
    datesSection.classList.remove('expanded');
    datesContent.style.display = 'none';
    var dIcon = datesSection.querySelector('.zone-toggle-icon');
    if (dIcon) dIcon.textContent = '🔽';
  }

  // Focus the To field
  setTimeout(function() {
    var toEl = document.getElementById('emailTo');
    if (toEl) toEl.focus();
  }, 100);

  // Wire up autocomplete on To, CC, BCC fields
  _emailLoadContacts().then(function() {
    _wireEmailAutocomplete('emailTo', 'emailToDropdown');
    _wireEmailAutocomplete('emailCc', 'emailCcDropdown');
    _wireEmailAutocomplete('emailBcc', 'emailBccDropdown');
  });

  // Auto-apply signature for new drafts
  _applySignatureIfEmpty();

  // Wire live markdown preview for draft emails
  _wireEmailBodyPreview();

  // Mark as unsaved
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

/**
 * Deactivate email mode — confirm if there's content, then clear email fields.
 */
async function _deactivateEmailZone() {
  // Check if there's email content to lose
  var toEl = document.getElementById('emailTo');
  var bodyEl = document.getElementById('emailBody');
  var hasContent = (toEl && toEl.value.trim()) || (bodyEl && bodyEl.value.trim());

  if (hasContent) {
    var confirmed = false;
    if (typeof cwocConfirm === 'function') {
      confirmed = await cwocConfirm('Clear all email fields? This cannot be undone.', { title: 'Remove Email', confirmLabel: '✕ Remove', danger: true });
    } else {
      confirmed = confirm('Clear all email fields?');
    }
    if (!confirmed) return;
  }

  // Clear all email fields
  if (toEl) toEl.value = '';
  var ccEl = document.getElementById('emailCc');
  var bccEl = document.getElementById('emailBcc');
  if (ccEl) ccEl.value = '';
  if (bccEl) bccEl.value = '';
  if (bodyEl) bodyEl.value = '';
  var fromEl = document.getElementById('emailFrom');
  if (fromEl) fromEl.textContent = '';

  // Hide the markdown preview
  var previewEl = document.getElementById('emailBodyPreview');
  if (previewEl) previewEl.style.display = 'none';

  // Clear email metadata
  if (_emailCurrentChit) {
    _emailCurrentChit.email_status = null;
    _emailCurrentChit.email_folder = null;
    _emailCurrentChit.email_from = null;
    _emailCurrentChit.email_message_id = null;
    _emailCurrentChit.email_date = null;
    _emailCurrentChit.email_in_reply_to = null;
    _emailCurrentChit.email_references = null;
  }

  // Hide and collapse the email zone
  var emailSection = document.getElementById('emailSection');
  var emailContent = document.getElementById('emailContent');
  if (emailSection && emailContent) {
    emailContent.style.display = 'none';
    emailSection.style.display = 'none'; // hide entirely
    emailSection.classList.add('collapsed');
    emailSection.classList.remove('expanded');
    var icon = emailSection.querySelector('.zone-toggle-icon');
    if (icon) icon.textContent = '🔽';
  }

  // Move email zone back to column-two (its original position)
  var colTwo = document.querySelector('.column-two');
  if (emailSection && colTwo) {
    colTwo.appendChild(emailSection);
  }

  // Hide Cc/Bcc rows
  var ccRow = document.getElementById('emailCcRow');
  var bccRow = document.getElementById('emailBccRow');
  var showCcBtn = document.getElementById('emailShowCcBtn');
  var showBccBtn = document.getElementById('emailShowBccBtn');
  if (ccRow) ccRow.style.display = 'none';
  if (bccRow) bccRow.style.display = 'none';
  if (showCcBtn) showCcBtn.style.display = '';
  if (showBccBtn) showBccBtn.style.display = '';

  // Reset buttons to non-email state
  _updateEmailButtons('');
  _showEmailSaveButtons(false);

  // Unpatch the CwocSaveSystem — restore original markUnsaved/markSaved
  if (window._cwocSave && window._cwocSave._emailPatched) {
    if (window._cwocSave._origMarkUnsaved) {
      window._cwocSave.markUnsaved = window._cwocSave._origMarkUnsaved;
    }
    if (window._cwocSave._origMarkSaved) {
      window._cwocSave.markSaved = window._cwocSave._origMarkSaved;
    }
    window._cwocSave._emailPatched = false;
  }

  // Mark as unsaved (now uses the restored original markUnsaved)
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

/**
 * Update email zone button visibility based on status.
 * @param {string} status — 'draft', 'received', 'sent', or ''
 */
function _updateEmailButtons(status) {
  var activateBtn = document.getElementById('emailActivateBtn');
  var quickBtn = document.getElementById('emailQuickActivateBtn');
  var sendBtn = document.getElementById('emailSendBtn');
  var replyBtn = document.getElementById('emailReplyBtn');
  var forwardBtn = document.getElementById('emailForwardBtn');
  var expandBtn = document.getElementById('emailExpandBtn');
  var isEmail = (status === 'draft' || status === 'received' || status === 'sent');

  // Quick-activate button in title row: hide when active (email chit), show when not
  if (quickBtn) {
    if (isEmail) {
      quickBtn.style.display = 'none';
    } else {
      quickBtn.style.display = '';
      quickBtn.className = 'email-quick-btn';
      quickBtn.innerHTML = '<i class="fas fa-envelope"></i><span class="email-quick-label"> Email</span>';
      quickBtn.onclick = function() { _activateEmailZone(); };
    }
  }

  // Zone header activate button mirrors the quick button
  if (activateBtn) {
    if (isEmail) {
      activateBtn.style.background = '#008080';
      activateBtn.style.color = '#fff8e1';
      activateBtn.style.borderColor = '#006060';
      activateBtn.textContent = '✕ Email';
      activateBtn.onclick = function() { _deactivateEmailZone(); };
    } else {
      activateBtn.style.background = '';
      activateBtn.style.color = '';
      activateBtn.style.borderColor = '';
      activateBtn.textContent = '✉️ Email';
      activateBtn.onclick = function() { _activateEmailZone(); };
    }
  }

  if (status === 'draft') {
    if (sendBtn) sendBtn.style.display = '';
    if (replyBtn) replyBtn.style.display = 'none';
    if (forwardBtn) forwardBtn.style.display = 'none';
    if (expandBtn) expandBtn.style.display = '';
  } else if (status === 'received') {
    if (sendBtn) sendBtn.style.display = 'none';
    if (replyBtn) replyBtn.style.display = '';
    if (forwardBtn) forwardBtn.style.display = '';
    if (expandBtn) expandBtn.style.display = '';
  } else if (status === 'sent') {
    if (sendBtn) sendBtn.style.display = 'none';
    if (replyBtn) replyBtn.style.display = 'none';
    if (forwardBtn) forwardBtn.style.display = 'none';
    if (expandBtn) expandBtn.style.display = '';
  } else {
    if (sendBtn) sendBtn.style.display = 'none';
    if (replyBtn) replyBtn.style.display = 'none';
    if (forwardBtn) forwardBtn.style.display = 'none';
    if (expandBtn) expandBtn.style.display = 'none';
  }
}

/**
 * Toggle between normal save buttons and email-specific save buttons.
 * Also patches the CwocSaveSystem so markUnsaved shows email buttons.
 * @param {boolean} isEmail — true to show email buttons, false for normal
 */
function _showEmailSaveButtons(isEmail) {
  var saveStay = document.getElementById('saveStayButton');
  var saveExit = document.getElementById('saveExitButton');
  var saveBtn = document.getElementById('saveButton');
  var saveDraft = document.getElementById('saveDraftButton');
  var saveSend = document.getElementById('saveSendButton');
  var saveSendArchive = document.getElementById('saveSendArchiveButton');

  if (isEmail) {
    // Check if there's actual email content
    var hasContent = _hasEmailContent();

    if (!hasContent) {
      // No email content yet — show normal save buttons
      // (the CwocSaveSystem will manage their visibility)
      if (saveDraft) saveDraft.style.display = 'none';
      if (saveSend) saveSend.style.display = 'none';
      if (saveSendArchive) saveSendArchive.style.display = 'none';
      // Don't patch the save system — let normal buttons show
      return;
    }

    // Has email content — show email save buttons
    if (saveStay) saveStay.style.display = 'none';
    if (saveExit) saveExit.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
    if (saveDraft) saveDraft.style.display = '';

    // Only show Send buttons if To + Subject + Body all have content
    var hasSendable = _hasEmailSendableContent();
    if (saveSend) saveSend.style.display = hasSendable ? '' : 'none';
    if (saveSendArchive) saveSendArchive.style.display = hasSendable ? '' : 'none';

    // Patch the save system so markUnsaved keeps showing email buttons
    if (window._cwocSave && !window._cwocSave._emailPatched) {
      window._cwocSave._origMarkUnsaved = window._cwocSave.markUnsaved.bind(window._cwocSave);
      window._cwocSave._origMarkSaved = window._cwocSave.markSaved.bind(window._cwocSave);
      window._cwocSave.markUnsaved = function() {
        window._cwocSave._origMarkUnsaved();
        _updateEmailSaveButtonVisibility();
      };
      window._cwocSave.markSaved = function() {
        window._cwocSave._origMarkSaved();
        _updateEmailSaveButtonVisibility();
      };
      window._cwocSave._emailPatched = true;
    }
  } else {
    // Hide email save buttons
    if (saveDraft) saveDraft.style.display = 'none';
    if (saveSend) saveSend.style.display = 'none';
    if (saveSendArchive) saveSendArchive.style.display = 'none';
  }
}

/**
 * Apply the email signature (as raw markdown) to the body textarea if empty.
 * The server converts markdown to HTML when sending — we keep it as markdown
 * in the textarea so the user can read and edit it naturally.
 */
function _applySignatureIfEmpty() {
  var bodyEl = document.getElementById('emailBody');
  if (!bodyEl) return;
  if (bodyEl.value.trim()) return;

  function _doApply() {
    if (bodyEl.value.trim()) return;
    if (!window._cwocSettings || !window._cwocSettings.email_account) return;
    var acct = window._cwocSettings.email_account;
    if (typeof acct === 'string') { try { acct = JSON.parse(acct); } catch(e) { return; } }
    var sig = acct && acct.signature;
    if (!sig) return;
    // Insert raw markdown — server handles HTML conversion on send
    bodyEl.value = '\n\n--\n' + sig;
  }

  if (window._cwocSettings && window._cwocSettings.email_account) {
    _doApply();
  } else if (typeof getCachedSettings === 'function') {
    getCachedSettings().then(function() { _doApply(); });
  }
}

/** Check if any email field has content (To, Subject/Title, or Body) */
function _hasEmailContent() {
  var toEl = document.getElementById('emailTo');
  var titleEl = document.getElementById('title');
  var bodyEl = document.getElementById('emailBody');
  return (toEl && toEl.value.trim()) ||
         (titleEl && titleEl.value.trim()) ||
         (bodyEl && bodyEl.value.trim());
}

/** Check if email has enough content to send (To + Subject + Body) */
function _hasEmailSendableContent() {
  var toEl = document.getElementById('emailTo');
  var titleEl = document.getElementById('title');
  var bodyEl = document.getElementById('emailBody');
  return (toEl && toEl.value.trim()) &&
         (titleEl && titleEl.value.trim()) &&
         (bodyEl && bodyEl.value.trim());
}

/** Update email save button visibility based on current content */
function _updateEmailSaveButtonVisibility() {
  var saveStay = document.getElementById('saveStayButton');
  var saveExit = document.getElementById('saveExitButton');
  var saveBtn = document.getElementById('saveButton');
  var saveDraft = document.getElementById('saveDraftButton');
  var saveSend = document.getElementById('saveSendButton');
  var saveSendArchive = document.getElementById('saveSendArchiveButton');

  var hasContent = _hasEmailContent();
  var hasSendable = _hasEmailSendableContent();

  if (!hasContent) {
    // No email content — show normal buttons, hide email buttons
    if (saveDraft) saveDraft.style.display = 'none';
    if (saveSend) saveSend.style.display = 'none';
    if (saveSendArchive) saveSendArchive.style.display = 'none';
    // Let normal buttons be visible (don't hide them)
    return;
  }

  // Has email content — show draft button, hide normal buttons
  if (saveStay) saveStay.style.display = 'none';
  if (saveExit) saveExit.style.display = 'none';
  if (saveBtn) saveBtn.style.display = 'none';
  if (saveDraft) saveDraft.style.display = '';
  if (saveSend) saveSend.style.display = hasSendable ? '' : 'none';
  if (saveSendArchive) saveSendArchive.style.display = hasSendable ? '' : 'none';
}

/**
 * Save the chit as a draft, then send it via the email send endpoint.
 */
async function _emailSaveAndSend() {
  // Validate To field
  var toEl = document.getElementById('emailTo');
  var toVal = toEl ? toEl.value.trim() : '';
  if (!toVal) {
    if (typeof cwocToast === 'function') cwocToast('Cannot send: no recipients specified.', 'error');
    return;
  }
  // Delegate to the existing _emailSend which already saves first
  await _emailSend();
}

/**
 * Save the chit as a draft, send it, then archive the original email
 * that was being replied to (if this is a reply).
 */
async function _emailSaveAndSendArchive() {
  // Validate To field
  var toEl = document.getElementById('emailTo');
  var toVal = toEl ? toEl.value.trim() : '';
  if (!toVal) {
    if (typeof cwocToast === 'function') cwocToast('Cannot send: no recipients specified.', 'error');
    return;
  }
  // Send the email first
  await _emailSend();

  // Archive the original email if this is a reply (has in_reply_to)
  if (_emailCurrentChit && _emailCurrentChit.email_in_reply_to) {
    // Find the original chit by matching email_message_id to our in_reply_to
    try {
      var resp = await fetch('/api/email/archive-original', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: _emailCurrentChit.email_in_reply_to })
      });
      if (resp.ok) {
        cwocToast('Original email archived.', 'success');
      }
    } catch (e) {
      console.error('[Email] Failed to archive original:', e);
    }
  }
}

/**
 * Populate email zone fields from chit data and configure button visibility
 * based on email_status.
 *
 * @param {Object} chit — the loaded chit object
 */
function initEmailZone(chit) {
  _emailCurrentChit = chit;

  console.log('[Email] email_body_html:', chit.email_body_html ? 'present (' + chit.email_body_html.length + ' chars)' : 'missing');

  var fromEl = document.getElementById('emailFrom');
  var toEl = document.getElementById('emailTo');
  var ccEl = document.getElementById('emailCc');
  var bccEl = document.getElementById('emailBcc');
  var bodyEl = document.getElementById('emailBody');
  var sendBtn = document.getElementById('emailSendBtn');
  var replyBtn = document.getElementById('emailReplyBtn');
  var forwardBtn = document.getElementById('emailForwardBtn');

  // Populate From field — use chit's email_from, or fall back to configured account
  if (fromEl) {
    var fromAddr = chit.email_from || '';
    if (!fromAddr && window._cwocSettings && window._cwocSettings.email_account) {
      var acct = window._cwocSettings.email_account;
      if (typeof acct === 'string') { try { acct = JSON.parse(acct); } catch(e) {} }
      if (acct && acct.email) {
        fromAddr = acct.display_name ? acct.display_name + ' <' + acct.email + '>' : acct.email;
      }
    }
    fromEl.textContent = fromAddr;
  }

  // Helper: ensure an email address field is a flat array of strings
  function _parseEmailList(val) {
    if (!val) return [];
    if (Array.isArray(val)) {
      // Unwrap double-encoded: ["[\"addr\"]"] → ["addr"]
      if (val.length === 1 && typeof val[0] === 'string' && val[0].trim().charAt(0) === '[') {
        try { var inner = JSON.parse(val[0]); if (Array.isArray(inner)) return inner; } catch(e) {}
      }
      return val;
    }
    if (typeof val === 'string') {
      var trimmed = val.trim();
      if (trimmed.charAt(0) === '[') {
        try { var parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) return parsed; } catch(e) {}
      }
      // Comma-separated string
      return trimmed ? trimmed.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
    }
    return [];
  }

  // Populate To/Cc/Bcc — arrays joined with ", "
  if (toEl) {
    toEl.value = _parseEmailList(chit.email_to).join(', ');
  }
  if (ccEl) {
    ccEl.value = _parseEmailList(chit.email_cc).join(', ');
  }
  if (bccEl) {
    bccEl.value = _parseEmailList(chit.email_bcc).join(', ');
  }

  // Populate Body
  if (bodyEl) {
    bodyEl.value = chit.email_body_text || '';
  }

  // HTML email rendering: if email_body_html exists and this is a received email,
  // show HTML/Text toggle and render HTML in a sandboxed iframe
  if (chit.email_body_html && (chit.email_status === 'received' || chit.email_status === 'sent')) {
    _setupHtmlEmailView(chit.email_body_html, bodyEl);
  }

  var status = chit.email_status || '';
  var isEmailChit = !!(chit.email_message_id || status);

  // Show the email zone if this is an email chit
  if (isEmailChit) {
    var emailSection = document.getElementById('emailSection');
    if (emailSection) emailSection.style.display = '';
  }

  // Configure buttons and editability based on status
  _updateEmailButtons(status);

  if (status === 'draft') {
    _setEmailZoneReadOnly(false);
    _showEmailSaveButtons(true);
    // Auto-apply signature for new drafts with empty body
    _applySignatureIfEmpty();
    // Wire live markdown preview for draft emails
    _wireEmailBodyPreview();
  } else if (status === 'received') {
    _setEmailZoneReadOnly(true);
    _showEmailSaveButtons(false);
  } else if (status === 'sent') {
    _setEmailZoneReadOnly(true);
    _showEmailSaveButtons(false);
  } else if (isEmailChit) {
    _setEmailZoneReadOnly(false);
    _showEmailSaveButtons(true);
  }

  // Wire up change listeners for dirty tracking
  if (toEl) toEl.addEventListener('input', function () { setSaveButtonUnsaved(); });
  if (ccEl) ccEl.addEventListener('input', function () { setSaveButtonUnsaved(); });
  if (bccEl) bccEl.addEventListener('input', function () { setSaveButtonUnsaved(); });
  if (bodyEl) bodyEl.addEventListener('input', function () { setSaveButtonUnsaved(); });

  // Wire all formatting shortcuts on the small zone body textarea
  if (bodyEl && !bodyEl._formatShortcutsWired) {
    bodyEl._formatShortcutsWired = true;
    bodyEl.addEventListener('keydown', function(e) {
      var action = _getEmailFormatAction(e);
      if (action) {
        e.preventDefault();
        _emailFormatBtn(action, 'emailBody');
      }
    });
  }

  // Wire up autocomplete on To, Cc, Bcc fields
  _emailLoadContacts().then(function() {
    _wireEmailAutocomplete('emailTo', 'emailToDropdown');
    _wireEmailAutocomplete('emailCc', 'emailCcDropdown');
    _wireEmailAutocomplete('emailBcc', 'emailBccDropdown');
  });

  // Show Cc/Bcc rows if they have data, hide the toggle buttons accordingly
  var ccRow = document.getElementById('emailCcRow');
  var bccRow = document.getElementById('emailBccRow');
  var showCcBtn = document.getElementById('emailShowCcBtn');
  var showBccBtn = document.getElementById('emailShowBccBtn');
  if (ccEl && ccEl.value.trim()) {
    if (ccRow) ccRow.style.display = '';
    if (showCcBtn) showCcBtn.style.display = 'none';
  }
  if (bccEl && bccEl.value.trim()) {
    if (bccRow) bccRow.style.display = '';
    if (showBccBtn) showBccBtn.style.display = 'none';
  }

  // Fetch and render email thread
  if (chit.id && chit.email_message_id) {
    _fetchEmailThread(chit.id);
  }

  // Render email attachment icons at the bottom of the email body
  _renderEmailAttachmentBar(chit);
}

/**
 * Collect email field values for save. Returns an object with email fields,
 * or null if the email zone has no content.
 *
 * @returns {Object|null} email data object or null
 */
function getEmailData() {
  var toEl = document.getElementById('emailTo');
  var ccEl = document.getElementById('emailCc');
  var bccEl = document.getElementById('emailBcc');
  var bodyEl = document.getElementById('emailBody');

  var toVal = toEl ? toEl.value.trim() : '';
  var ccVal = ccEl ? ccEl.value.trim() : '';
  var bccVal = bccEl ? bccEl.value.trim() : '';
  var bodyVal = bodyEl ? bodyEl.value.trim() : '';

  // Only return data if there's some email content
  var hasContent = !!(toVal || ccVal || bccVal || bodyVal);

  // Also check if the chit already has email data (status, folder, etc.)
  var hasExistingEmail = _emailCurrentChit && (
    _emailCurrentChit.email_message_id ||
    _emailCurrentChit.email_status ||
    _emailCurrentChit.email_from
  );

  if (!hasContent && !hasExistingEmail) {
    return null;
  }

  // Split comma-separated addresses into arrays, filtering empty strings
  var toArr = toVal ? toVal.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
  var ccArr = ccVal ? ccVal.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
  var bccArr = bccVal ? bccVal.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];

  // Get subject from the title field (email_subject maps to chit title)
  var titleEl = document.getElementById('title');
  var subject = titleEl ? titleEl.value.trim() : '';

  var data = {
    email_to: JSON.stringify(toArr),
    email_cc: JSON.stringify(ccArr),
    email_bcc: JSON.stringify(bccArr),
    email_body_text: bodyVal,
    email_subject: subject
  };

  // Preserve existing email metadata if present
  if (_emailCurrentChit) {
    if (_emailCurrentChit.email_status) data.email_status = _emailCurrentChit.email_status;
    if (_emailCurrentChit.email_folder) data.email_folder = _emailCurrentChit.email_folder;
    if (_emailCurrentChit.email_from) data.email_from = _emailCurrentChit.email_from;
    if (_emailCurrentChit.email_message_id) data.email_message_id = _emailCurrentChit.email_message_id;
    if (_emailCurrentChit.email_date) data.email_date = _emailCurrentChit.email_date;
    if (_emailCurrentChit.email_in_reply_to) data.email_in_reply_to = _emailCurrentChit.email_in_reply_to;
    if (_emailCurrentChit.email_references) data.email_references = _emailCurrentChit.email_references;
    if (_emailCurrentChit.email_read !== undefined && _emailCurrentChit.email_read !== null) {
      data.email_read = _emailCurrentChit.email_read;
    }
    if (_emailCurrentChit.email_body_html) {
      data.email_body_html = _emailCurrentChit.email_body_html;
    }
  }

  return data;
}

/**
 * Check if a chit has email data (used by applyZoneStates for auto-expand).
 *
 * @param {Object} chit — the chit object
 * @returns {boolean} true if the chit has email data
 */
function hasEmailData(chit) {
  return !!(chit.email_message_id || chit.email_status || chit.email_from);
}

/**
 * Create a reply draft chit via API and navigate to the editor with the new chit.
 * Sets email_to to the original sender, email_in_reply_to to the original Message-ID,
 * subject prefixed with "Re: " (no doubling), and body quoted below a separator.
 */
async function _emailReply() {
  if (!_emailCurrentChit) {
    cwocToast('No email loaded to reply to.', 'error');
    return;
  }

  var original = _emailCurrentChit;
  var subject = original.title || original.email_subject || '';

  // Prefix with "Re: " but avoid doubling
  if (!/^Re:\s/i.test(subject)) {
    subject = 'Re: ' + subject;
  }

  // Quote the original body below a separator
  var originalBody = original.email_body_text || '';
  var separator = '\n\n--- Original Message ---\n';
  var quotedBody = separator + originalBody;

  var replyChit = {
    title: subject,
    email_subject: subject,
    email_to: JSON.stringify(original.email_from ? [original.email_from] : []),
    email_cc: JSON.stringify([]),
    email_bcc: JSON.stringify([]),
    email_body_text: quotedBody,
    email_in_reply_to: original.email_message_id || null,
    email_references: original.email_references
      ? (original.email_references + ' ' + (original.email_message_id || ''))
      : (original.email_message_id || null),
    email_status: 'draft',
    email_folder: 'drafts',
    email_from: null,
    tags: []
  };

  try {
    var response = await fetch('/api/chits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replyChit)
    });

    if (!response.ok) {
      var errText = await response.text();
      throw new Error(errText);
    }

    var created = await response.json();
    cwocToast('Reply draft created.', 'success');
    // Preserve expand state — use the flag since the modal was already closed
    var expandParam = _emailExpandModalOpen ? '&expand=email' : '';
    window.location.href = '/frontend/html/editor.html?id=' + encodeURIComponent(created.id) + expandParam;
  } catch (err) {
    console.error('[_emailReply] Error creating reply:', err);
    cwocToast('Failed to create reply draft.', 'error');
  }
}

/**
 * Create a forward draft chit via API and navigate to the editor with the new chit.
 * Empty email_to, subject prefixed with "Fwd: " (no doubling), body quoted below separator.
 */
async function _emailForward() {
  if (!_emailCurrentChit) {
    cwocToast('No email loaded to forward.', 'error');
    return;
  }

  var original = _emailCurrentChit;
  var subject = original.title || original.email_subject || '';

  // Prefix with "Fwd: " but avoid doubling
  if (!/^Fwd:\s/i.test(subject)) {
    subject = 'Fwd: ' + subject;
  }

  // Quote the original body below a separator
  var originalBody = original.email_body_text || '';
  var separator = '\n\n--- Forwarded Message ---\n';
  var quotedBody = separator + originalBody;

  var forwardChit = {
    title: subject,
    email_subject: subject,
    email_to: JSON.stringify([]),
    email_cc: JSON.stringify([]),
    email_bcc: JSON.stringify([]),
    email_body_text: quotedBody,
    email_status: 'draft',
    email_folder: 'drafts',
    email_from: null,
    tags: []
  };

  try {
    var response = await fetch('/api/chits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardChit)
    });

    if (!response.ok) {
      var errText = await response.text();
      throw new Error(errText);
    }

    var created = await response.json();
    cwocToast('Forward draft created.', 'success');
    // Preserve expand state — use the flag since the modal was already closed
    var expandParam = _emailExpandModalOpen ? '&expand=email' : '';
    window.location.href = '/frontend/html/editor.html?id=' + encodeURIComponent(created.id) + expandParam;
  } catch (err) {
    console.error('[_emailForward] Error creating forward:', err);
    cwocToast('Failed to create forward draft.', 'error');
  }
}

/**
 * Send the current draft email via POST /api/email/send/{id}.
 * Shows success/error toast and updates UI to reflect sent status.
 */
async function _emailSend() {
  var chitId = window.currentChitId;
  if (!chitId) {
    cwocToast('Save the chit before sending.', 'error');
    return;
  }

  // Validate that To field has at least one recipient
  var toEl = document.getElementById('emailTo');
  var toVal = toEl ? toEl.value.trim() : '';
  if (!toVal) {
    cwocToast('Cannot send: no recipients specified.', 'error');
    return;
  }

  try {
    // Save the chit first so the backend has the latest body/recipients
    if (typeof saveChitAndStay === 'function') {
      cwocToast('Saving before send...', 'info');
      await saveChitAndStay();
    }

    var response = await fetch('/api/email/send/' + encodeURIComponent(chitId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      var errData;
      try {
        errData = await response.json();
      } catch (e) {
        errData = { detail: await response.text() };
      }
      var errMsg = errData.detail || errData.message || 'Send failed.';
      cwocToast(errMsg, 'error');
      return;
    }

    var result = await response.json();
    cwocToast('Email sent successfully.', 'success');

    // Update local state to reflect sent status
    if (_emailCurrentChit) {
      _emailCurrentChit.email_status = 'sent';
      _emailCurrentChit.email_folder = 'sent';
    }

    // Update UI: hide Send button, make fields read-only
    var sendBtn = document.getElementById('emailSendBtn');
    if (sendBtn) sendBtn.style.display = 'none';
    _setEmailZoneReadOnly(true);

  } catch (err) {
    console.error('[_emailSend] Error sending email:', err);
    cwocToast('Failed to send email.', 'error');
  }
}

/**
 * Toggle field editability for the email zone.
 *
 * @param {boolean} readOnly — true to disable fields, false to enable
 */
function _setEmailZoneReadOnly(readOnly) {
  var toEl = document.getElementById('emailTo');
  var ccEl = document.getElementById('emailCc');
  var bccEl = document.getElementById('emailBcc');
  var bodyEl = document.getElementById('emailBody');

  if (toEl) { toEl.disabled = readOnly; toEl.readOnly = readOnly; }
  if (ccEl) { ccEl.disabled = readOnly; ccEl.readOnly = readOnly; }
  if (bccEl) { bccEl.disabled = readOnly; bccEl.readOnly = readOnly; }
  if (bodyEl) { bodyEl.disabled = readOnly; bodyEl.readOnly = readOnly; }

  // Hide markdown preview when read-only (received/sent emails use the HTML iframe)
  var previewEl = document.getElementById('emailBodyPreview');
  if (previewEl) previewEl.style.display = readOnly ? 'none' : '';
}

/**
 * Open a fullscreen modal for the email body (expand button).
 */
function _openEmailExpandModal() {
  var existing = document.getElementById('emailExpandModal');
  if (existing) existing.remove();

  _emailExpandModalOpen = true;

  var bodyEl = document.getElementById('emailBody');
  var toEl = document.getElementById('emailTo');
  var ccEl = document.getElementById('emailCc');
  var bccEl = document.getElementById('emailBcc');
  var fromEl = document.getElementById('emailFrom');
  var bodyVal = bodyEl ? bodyEl.value : '';
  var isReadOnly = bodyEl ? bodyEl.readOnly : false;
  var status = (_emailCurrentChit && _emailCurrentChit.email_status) || 'draft';
  var hasHtml = !!(_emailCurrentChit && _emailCurrentChit.email_body_html);

  // Signature is appended server-side when sending — not shown in compose textarea

  var overlay = document.createElement('div');
  overlay.id = 'emailExpandModal';
  overlay.className = 'modal-overlay';
  overlay.style.display = 'flex';

  var actionBtns = '';
  if (status === 'draft') {
    actionBtns =
      '<button type="button" onclick="event.stopPropagation(); _closeEmailExpandModal(true); _emailSend()"><i class="fas fa-paper-plane"></i> Send</button>' +
      '<button type="button" onclick="event.stopPropagation(); _closeEmailExpandModal(true); _emailSaveAndSendArchive()"><i class="fas fa-paper-plane"></i> Send &amp; Archive</button>';
  } else if (status === 'received') {
    actionBtns =
      '<button type="button" onclick="event.stopPropagation(); _closeEmailExpandModal(true); _emailReply()"><i class="fas fa-reply"></i> Reply</button>' +
      '<button type="button" onclick="event.stopPropagation(); _closeEmailExpandModal(true); _emailForward()"><i class="fas fa-share"></i> Forward</button>';
  }

  var disabledAttr = isReadOnly ? ' readonly disabled' : '';

  // Build pill toggle if HTML content exists
  var pillToggleHtml = '';
  if (hasHtml) {
    pillToggleHtml =
      '<div class="cwoc-pill-toggle" style="display:inline-flex;margin-right:auto;" id="emailExpandPillToggle">' +
        '<span class="cwoc-pill-option cwoc-pill-active" data-value="html" onclick="_switchExpandView(\'html\')">HTML</span>' +
        '<span class="cwoc-pill-option" data-value="text" onclick="_switchExpandView(\'text\')">Text</span>' +
      '</div>';
  }

  // Get the subject/title from the main editor
  var titleEl = document.getElementById('title');
  var subjectVal = titleEl ? titleEl.value : '';

  // Use the exact same modal structure as the Notes modal — full viewport with 1em margin
  overlay.innerHTML =
    '<div class="modal-contentFull" style="width:calc(100vw - 2em);max-width:calc(100vw - 2em);height:calc(100vh - 2em);display:flex;flex-direction:column;">' +
      '<div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;padding:0.5em 1em;flex-shrink:0;">' +
        '<h2 style="margin:0;">✉️ Email</h2>' +
        '<div style="display:flex;gap:0.5em;flex-wrap:wrap;align-items:center;">' +
          pillToggleHtml +
          actionBtns +
          '<button type="button" class="cancel" onclick="_closeEmailExpandModal(false)"><i class="fas fa-times"></i> Close</button>' +
        '</div>' +
      '</div>' +
      '<div class="modal-body" style="flex:1;overflow:auto;padding:0.5em 1em;">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
          '<div style="display:flex;align-items:center;gap:6px;flex:1;min-width:200px;"><strong style="flex-shrink:0;">From:</strong><span style="font-style:italic;color:#5a4a3a;">' + _escapeHtmlAttr(fromEl ? fromEl.textContent : '') + '</span></div>' +
          '<div style="display:flex;align-items:center;gap:6px;flex:2;min-width:200px;"><strong style="flex-shrink:0;">To:</strong><input id="emailExpandTo" type="text" value="' + _escapeHtmlAttr(toEl ? toEl.value : '') + '" style="flex:1;padding:4px 8px;border:1px inset #c4a882;border-radius:4px;font-family:Lora,Georgia,serif;"' + disabledAttr + '>' +
            (isReadOnly ? '' : ' <button type="button" class="email-cc-toggle-btn" id="emailExpandShowCcBtn" onclick="_toggleExpandCcBcc(\'cc\')" title="Add CC">CC</button><button type="button" class="email-cc-toggle-btn" id="emailExpandShowBccBtn" onclick="_toggleExpandCcBcc(\'bcc\')" title="Add BCC">BCC</button>') +
          '</div>' +
        '</div>' +
        '<div class="email-field" id="emailExpandCcRow" style="display:' + (ccEl && ccEl.value.trim() ? '' : 'none') + ';margin-bottom:8px;">' +
          '<label style="min-width:50px;font-weight:600;color:#5a4a3a;font-family:Lora,Georgia,serif;font-size:14px;flex-shrink:0;text-align:right;">CC:</label>' +
          '<input id="emailExpandCc" type="text" value="' + _escapeHtmlAttr(ccEl ? ccEl.value : '') + '" style="flex:1;padding:4px 8px;border:1px inset #c4a882;border-radius:4px;font-family:Lora,Georgia,serif;"' + disabledAttr + '>' +
          '<button type="button" class="email-cc-remove-btn" onclick="_toggleExpandCcBcc(\'cc\')" title="Remove CC">✕</button>' +
        '</div>' +
        '<div class="email-field" id="emailExpandBccRow" style="display:' + (bccEl && bccEl.value.trim() ? '' : 'none') + ';margin-bottom:8px;">' +
          '<label style="min-width:50px;font-weight:600;color:#5a4a3a;font-family:Lora,Georgia,serif;font-size:14px;flex-shrink:0;text-align:right;">BCC:</label>' +
          '<input id="emailExpandBcc" type="text" value="' + _escapeHtmlAttr(bccEl ? bccEl.value : '') + '" style="flex:1;padding:4px 8px;border:1px inset #c4a882;border-radius:4px;font-family:Lora,Georgia,serif;"' + disabledAttr + '>' +
          '<button type="button" class="email-cc-remove-btn" onclick="_toggleExpandCcBcc(\'bcc\')" title="Remove BCC">✕</button>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">' +
          '<strong style="flex-shrink:0;min-width:50px;text-align:right;">Subject:</strong>' +
          '<input id="emailExpandSubject" type="text" value="' + _escapeHtmlAttr(subjectVal) + '" style="flex:1;padding:4px 8px;border:1px inset #c4a882;border-radius:4px;font-family:Lora,Georgia,serif;font-size:14px;"' + disabledAttr + '>' +
        '</div>' +
        (isReadOnly ? '' :
        '<div id="emailExpandToolbar" class="email-format-toolbar">' +
          '<button type="button" title="Bold (Ctrl+B)" onclick="_emailFormatBtn(\'b\')"><strong>B</strong></button>' +
          '<button type="button" title="Italic (Ctrl+I)" onclick="_emailFormatBtn(\'i\')"><em>I</em></button>' +
          '<button type="button" title="Strikethrough (Ctrl+Shift+X)" onclick="_emailFormatBtn(\'s\')"><s>S</s></button>' +
          '<button type="button" title="Link (Ctrl+K)" onclick="_emailFormatBtn(\'k\')">🔗</button>' +
          '<span class="email-toolbar-sep"></span>' +
          '<div class="email-toolbar-dropdown">' +
            '<button type="button" title="Heading (Ctrl+Shift+1/2/3)">H ▾</button>' +
            '<div class="email-toolbar-dropdown-menu">' +
              '<button type="button" onclick="_emailFormatBtn(\'h1\')" style="font-size:1.2em;font-weight:bold;">H1</button>' +
              '<button type="button" onclick="_emailFormatBtn(\'h2\')" style="font-size:1.05em;font-weight:bold;">H2</button>' +
              '<button type="button" onclick="_emailFormatBtn(\'h3\')" style="font-size:0.95em;font-weight:bold;">H3</button>' +
            '</div>' +
          '</div>' +
          '<button type="button" title="Bullet List (Ctrl+Shift+8)" onclick="_emailFormatBtn(\'ul\')">• List</button>' +
          '<button type="button" title="Numbered List (Ctrl+Shift+7)" onclick="_emailFormatBtn(\'ol\')">1. List</button>' +
          '<button type="button" title="Blockquote (Ctrl+Shift+.)" onclick="_emailFormatBtn(\'q\')">❝ Quote</button>' +
          '<button type="button" title="Code (Ctrl+E)" onclick="_emailFormatBtn(\'code\')">⟨⟩</button>' +
          '<button type="button" title="Horizontal Rule (Ctrl+Shift+-)" onclick="_emailFormatBtn(\'hr\')">―</button>' +
        '</div>') +
        '<div id="emailExpandBodyWrap" style="flex:1;display:flex;flex-direction:column;height:calc(100vh - 2em - 280px);">' +
          '<textarea id="emailExpandBody" style="flex:1;width:100%;box-sizing:border-box;font-family:Lora,Georgia,serif;font-size:14px;line-height:1.6;padding:10px;border:1px inset #c4a882;border-radius:4px;resize:none;' + (hasHtml ? 'display:none;' : '') + '"' +
            disabledAttr + '>' + _escapeHtmlAttr(bodyVal) + '</textarea>' +
        '</div>' +
      '</div>' +
    '</div>';

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) _closeEmailExpandModal(false);
  });

  function _emailExpandEscHandler(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      _closeEmailExpandModal(false);
      document.removeEventListener('keydown', _emailExpandEscHandler, true);
    }
  }
  document.addEventListener('keydown', _emailExpandEscHandler, true);
  overlay._escHandler = _emailExpandEscHandler;

  document.body.appendChild(overlay);

  // Wire all formatting shortcuts on the expand textarea
  var expandTA = document.getElementById('emailExpandBody');
  if (expandTA && !isReadOnly) {
    expandTA.addEventListener('keydown', function(e) {
      var action = _getEmailFormatAction(e);
      if (action) {
        e.preventDefault();
        _emailFormatBtn(action);
      }
    });
  }

  // If HTML content exists, render it in an iframe that allows links to open in new tabs
  if (hasHtml) {
    var wrap = document.getElementById('emailExpandBodyWrap');
    if (wrap) {
      var iframe = document.createElement('iframe');
      iframe.id = 'emailExpandHtmlIframe';
      iframe.style.cssText = 'flex:1;width:100%;min-height:300px;border:1px inset #c4a882;border-radius:4px;background:#fff;';
      // allow-popups lets target="_blank" links work; allow-popups-to-escape-sandbox lets them open normally
      iframe.sandbox = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox';
      iframe.setAttribute('frameborder', '0');

      var sanitized = _emailCurrentChit.email_body_html;
      if (typeof DOMPurify !== 'undefined') {
        sanitized = DOMPurify.sanitize(sanitized, {
          FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea'],
          ADD_ATTR: ['target'],
        });
      }
      // Force all links to open in new tab
      sanitized = sanitized.replace(/<a /gi, '<a target="_blank" rel="noopener noreferrer" ');
      iframe.srcdoc = sanitized;

      iframe.addEventListener('load', function() {
        _resizeEmailIframe(iframe);
        // Also force links inside the iframe to open in new tabs
        try {
          var doc = iframe.contentDocument || iframe.contentWindow.document;
          if (doc) {
            doc.querySelectorAll('a').forEach(function(a) {
              a.setAttribute('target', '_blank');
              a.setAttribute('rel', 'noopener noreferrer');
            });
          }
        } catch(e) { /* cross-origin */ }
      });

      wrap.insertBefore(iframe, wrap.firstChild);
    }
  }

  // Wire live markdown preview for draft expand modal (only when no HTML content)
  if (status === 'draft' && !hasHtml) {
    _wireExpandBodyPreview();
  }

  // Render email attachment icons in the expand modal
  if (_emailCurrentChit) {
    _renderExpandEmailAttachmentBar(_emailCurrentChit);
  }
}

/**
 * Map a keyboard event to a formatting action string, or null if no match.
 * Hotkeys:
 *   Ctrl+B → bold, Ctrl+I → italic, Ctrl+K → link,
 *   Ctrl+Shift+X → strikethrough, Ctrl+Shift+7 → numbered list,
 *   Ctrl+Shift+8 → bullet list, Ctrl+Shift+. → blockquote,
 *   Ctrl+E → inline code, Ctrl+Shift+1 → H1, Ctrl+Shift+2 → H2,
 *   Ctrl+Shift+3 → H3, Ctrl+Shift+- → horizontal rule
 */
function _getEmailFormatAction(e) {
  if (!e.ctrlKey && !e.metaKey) return null;
  var key = e.key.toLowerCase();
  var code = e.code || '';
  if (!e.shiftKey) {
    if (key === 'b') return 'b';
    if (key === 'i') return 'i';
    if (key === 'k') return 'k';
    if (key === 'e') return 'code';      // Ctrl+E → inline code
    return null;
  }
  // Shift combos
  if (key === 'x') return 's';                          // Ctrl+Shift+X → strikethrough
  if (key === '7' || key === '&') return 'ol';           // Ctrl+Shift+7 → numbered list
  if (key === '8' || key === '*') return 'ul';           // Ctrl+Shift+8 → bullet list
  if (key === '.' || key === '>') return 'q';            // Ctrl+Shift+. → blockquote
  if (key === '1' || key === '!') return 'h1';           // Ctrl+Shift+1 → H1
  if (key === '2' || key === '@') return 'h2';           // Ctrl+Shift+2 → H2
  if (key === '3' || key === '#') return 'h3';           // Ctrl+Shift+3 → H3
  if (key === '-' || key === '_') return 'hr';           // Ctrl+Shift+- → horizontal rule
  return null;
}

/**
 * Apply a markdown formatting action to the selected text in a textarea.
 * @param {string} action — 'b' (bold), 'i' (italic), 'k' (link), 's' (strikethrough),
 *                           'h1'/'h2'/'h3' (headings), 'ul' (bullet list), 'ol' (numbered list),
 *                           'q' (blockquote), 'code' (inline code), 'hr' (horizontal rule)
 */
function _emailFormatBtn(action, textareaId) {
  var textarea = document.getElementById(textareaId || 'emailExpandBody');
  if (!textarea) return;

  var start = textarea.selectionStart;
  var end = textarea.selectionEnd;
  var text = textarea.value;
  var selected = text.substring(start, end);
  var replacement = '';
  var cursorStart = start;
  var cursorEnd = end;

  switch (action) {
    case 'b':
      if (!selected) return; // No selection — do nothing
      replacement = '**' + selected + '**';
      cursorEnd = start + replacement.length;
      break;
    case 'i':
      if (!selected) return; // No selection — do nothing
      replacement = '*' + selected + '*';
      cursorEnd = start + replacement.length;
      break;
    case 'k':
      if (!selected) return; // No selection — do nothing
      var isUrl = /^https?:\/\//i.test(selected.trim());
      if (isUrl) {
        replacement = '[link text](' + selected.trim() + ')';
        cursorStart = start + 1; cursorEnd = start + 1 + 'link text'.length;
      } else {
        replacement = '[' + selected + '](url)';
        var urlPos = start + 1 + selected.length + 2;
        cursorStart = urlPos; cursorEnd = urlPos + 3;
      }
      break;
    case 'h1':
    case 'h2':
    case 'h3':
      // Headings apply to the current line even without selection
      var hLevel = parseInt(action.charAt(1));
      var hPrefix = '#'.repeat(hLevel) + ' ';
      var lineStart = text.lastIndexOf('\n', start - 1) + 1;
      var lineEnd = text.indexOf('\n', start);
      if (lineEnd === -1) lineEnd = text.length;
      var lineText = text.substring(lineStart, lineEnd);
      if (!lineText.trim() && !selected) return; // Empty line, no selection — do nothing
      var stripped = lineText.replace(/^#{1,3}\s+/, '');
      replacement = hPrefix + stripped;
      textarea.value = text.substring(0, lineStart) + replacement + text.substring(lineEnd);
      textarea.selectionStart = lineStart; textarea.selectionEnd = lineStart + replacement.length;
      textarea.focus();
      textarea.dispatchEvent(new Event('input'));
      return;
    case 'ul':
      if (selected) {
        // Prefix each selected line with "- "
        replacement = selected.split('\n').map(function(l) { return '- ' + l; }).join('\n');
      } else {
        // Prefix the current line with "- "
        var lineStart = text.lastIndexOf('\n', start - 1) + 1;
        var lineEnd = text.indexOf('\n', start);
        if (lineEnd === -1) lineEnd = text.length;
        var lineText = text.substring(lineStart, lineEnd);
        replacement = '- ' + lineText;
        textarea.value = text.substring(0, lineStart) + replacement + text.substring(lineEnd);
        textarea.selectionStart = lineStart + replacement.length;
        textarea.selectionEnd = lineStart + replacement.length;
        textarea.focus();
        textarea.dispatchEvent(new Event('input'));
        return;
      }
      break;
    case 'ol':
      if (selected) {
        replacement = selected.split('\n').map(function(l, i) { return (i + 1) + '. ' + l; }).join('\n');
      } else {
        // Prefix the current line with "1. "
        var lineStart = text.lastIndexOf('\n', start - 1) + 1;
        var lineEnd = text.indexOf('\n', start);
        if (lineEnd === -1) lineEnd = text.length;
        var lineText = text.substring(lineStart, lineEnd);
        replacement = '1. ' + lineText;
        textarea.value = text.substring(0, lineStart) + replacement + text.substring(lineEnd);
        textarea.selectionStart = lineStart + replacement.length;
        textarea.selectionEnd = lineStart + replacement.length;
        textarea.focus();
        textarea.dispatchEvent(new Event('input'));
        return;
      }
      break;
    case 'q':
      if (!selected) return; // No selection — do nothing
      replacement = selected.split('\n').map(function(l) { return '> ' + l; }).join('\n');
      break;
    case 's':
      if (!selected) return; // No selection — do nothing
      replacement = '~~' + selected + '~~';
      cursorEnd = start + replacement.length;
      break;
    case 'code':
      if (!selected) return; // No selection — do nothing
      replacement = '`' + selected + '`';
      cursorEnd = start + replacement.length;
      break;
    case 'hr':
      replacement = '\n---\n';
      cursorStart = start + replacement.length; cursorEnd = cursorStart;
      break;
    default:
      return;
  }

  textarea.value = text.substring(0, start) + replacement + text.substring(end);
  textarea.selectionStart = cursorStart;
  textarea.selectionEnd = cursorEnd;
  textarea.focus();
  textarea.dispatchEvent(new Event('input'));
}

/**
 * Switch between HTML and Text views in the expand modal.
 * @param {string} mode — 'html' or 'text'
 */
function _switchExpandView(mode) {
  var iframe = document.getElementById('emailExpandHtmlIframe');
  var textarea = document.getElementById('emailExpandBody');
  var toggle = document.getElementById('emailExpandPillToggle');

  if (toggle) {
    toggle.querySelectorAll('.cwoc-pill-option').forEach(function(opt) {
      opt.classList.toggle('cwoc-pill-active', opt.dataset.value === mode);
    });
  }

  if (mode === 'html' && iframe) {
    if (iframe) iframe.style.display = '';
    if (textarea) textarea.style.display = 'none';
  } else {
    if (iframe) iframe.style.display = 'none';
    if (textarea) textarea.style.display = '';
  }
}

/**
 * Close the email expand modal.
 * @param {boolean} save — if true, copy modal text back to the main textarea
 */
function _closeEmailExpandModal(save) {
  var modal = document.getElementById('emailExpandModal');
  if (!modal) return;

  // Only reset the expand flag when user manually dismisses (Cancel/Close/ESC)
  // Reply/Forward/Send set save=true to preserve the flag for navigation
  if (!save) {
    _emailExpandModalOpen = false;
  }

  // Clean up ESC handler
  if (modal._escHandler) {
    document.removeEventListener('keydown', modal._escHandler, true);
  }

  if (save) {
    // Only sync fields back for editable emails (drafts) — not for received/sent
    var isEditable = _emailCurrentChit && _emailCurrentChit.email_status === 'draft';
    if (isEditable) {
      var expandBody = document.getElementById('emailExpandBody');
      var bodyEl = document.getElementById('emailBody');
      if (expandBody && bodyEl) {
        bodyEl.value = expandBody.value;
      }
      // Sync Subject back to the title field
      var expandSubject = document.getElementById('emailExpandSubject');
      var titleEl = document.getElementById('title');
      if (expandSubject && titleEl) {
        titleEl.value = expandSubject.value;
      }
      // Sync To/Cc/Bcc back to the zone fields
      var expandTo = document.getElementById('emailExpandTo');
      var toEl = document.getElementById('emailTo');
      if (expandTo && toEl) toEl.value = expandTo.value;
      var expandCc = document.getElementById('emailExpandCc');
      var ccEl = document.getElementById('emailCc');
      if (expandCc && ccEl) ccEl.value = expandCc.value;
      var expandBcc = document.getElementById('emailExpandBcc');
      var bccEl = document.getElementById('emailBcc');
      if (expandBcc && bccEl) bccEl.value = expandBcc.value;
      setSaveButtonUnsaved();
    }
  }
  modal.remove();
}

/** Escape text for safe insertion into HTML attribute/textarea content */
function _escapeHtmlAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Toggle Cc or Bcc field visibility in the expand modal.
 * @param {string} field — 'cc' or 'bcc'
 */
function _toggleExpandCcBcc(field) {
  var rowId = field === 'cc' ? 'emailExpandCcRow' : 'emailExpandBccRow';
  var btnId = field === 'cc' ? 'emailExpandShowCcBtn' : 'emailExpandShowBccBtn';
  var row = document.getElementById(rowId);
  var btn = document.getElementById(btnId);
  if (!row) return;
  var isVisible = row.style.display !== 'none';
  row.style.display = isVisible ? 'none' : '';
  if (btn) btn.style.display = isVisible ? '' : 'none';
  if (!isVisible) {
    var inputId = field === 'cc' ? 'emailExpandCc' : 'emailExpandBcc';
    var input = document.getElementById(inputId);
    if (input) setTimeout(function() { input.focus(); }, 50);
  }
}

/** Alias for use in autocomplete dropdown rendering */
var _escHtml = _escapeHtmlAttr;


// ═══════════════════════════════════════════════════════════════════════════
// Markdown Live Preview — debounced rendering for draft email body
// ═══════════════════════════════════════════════════════════════════════════

/** Debounce timer for the email body preview */
var _emailBodyPreviewTimer = null;

/**
 * Wire live markdown preview on the email body textarea.
 * The textarea remains the source of truth; the preview div shows rendered HTML.
 * Only wired once per textarea (guarded by _previewWired flag).
 */
function _wireEmailBodyPreview() {
  var bodyEl = document.getElementById('emailBody');
  var preview = document.getElementById('emailBodyPreview');
  if (!bodyEl || !preview || bodyEl._previewWired) return;
  bodyEl._previewWired = true;

  function updatePreview() {
    var raw = bodyEl.value || '';
    if (!raw.trim()) {
      preview.style.display = 'none';
      return;
    }
    if (typeof marked !== 'undefined' && marked.parse) {
      preview.innerHTML = marked.parse(raw, { breaks: true });
    } else {
      preview.textContent = raw;
    }
    preview.style.display = '';
  }

  bodyEl.addEventListener('input', function() {
    clearTimeout(_emailBodyPreviewTimer);
    _emailBodyPreviewTimer = setTimeout(updatePreview, 500);
  });

  // Initial render if there's content
  if (bodyEl.value.trim()) {
    updatePreview();
  }
}

/**
 * Wire live markdown preview on the expand modal's email body textarea.
 * Creates a preview div below the textarea and updates it on input.
 */
function _wireExpandBodyPreview() {
  var expandTextarea = document.getElementById('emailExpandBody');
  var wrap = document.getElementById('emailExpandBodyWrap');
  if (!expandTextarea || !wrap) return;

  // Make textarea take only top half, preview takes bottom half
  expandTextarea.style.flex = '1';
  expandTextarea.style.minHeight = '100px';

  // Add a label above the preview
  var label = document.createElement('div');
  label.className = 'email-body-preview-label';
  label.textContent = '📝 Preview';
  label.style.cssText = 'flex-shrink:0;margin-top:6px;';
  wrap.appendChild(label);

  // Create preview div for the expand modal
  var expandPreview = document.createElement('div');
  expandPreview.id = 'emailExpandBodyPreview';
  expandPreview.className = 'email-body-preview';
  expandPreview.style.cssText = 'flex:1;min-height:80px;overflow-y:auto;margin-top:4px;max-height:none;';
  wrap.appendChild(expandPreview);

  var expandDebounce = null;

  function updateExpandPreview() {
    var raw = expandTextarea.value || '';
    if (!raw.trim()) {
      expandPreview.innerHTML = '<em style="opacity:0.4;">Preview appears here as you type…</em>';
      return;
    }
    if (typeof marked !== 'undefined' && marked.parse) {
      expandPreview.innerHTML = marked.parse(raw, { breaks: true });
    } else {
      expandPreview.textContent = raw;
    }
  }

  expandTextarea.addEventListener('input', function() {
    clearTimeout(expandDebounce);
    expandDebounce = setTimeout(updateExpandPreview, 500);
  });

  // Initial render
  updateExpandPreview();
}


// ═══════════════════════════════════════════════════════════════════════════
// HTML Email Rendering — sandboxed iframe with DOMPurify
// ═══════════════════════════════════════════════════════════════════════════

/** Current view mode: 'html' or 'text' */
var _emailViewMode = 'html';

/**
 * Set up HTML email view with toggle button and sandboxed iframe.
 * @param {string} htmlContent — the raw HTML body
 * @param {HTMLElement} bodyEl — the plain-text textarea element
 */
function _setupHtmlEmailView(htmlContent, bodyEl) {
  if (!bodyEl || !htmlContent) return;

  console.log('[Email HTML] Setting up HTML view, content length:', htmlContent.length);
  console.log('[Email HTML] DOMPurify available:', typeof DOMPurify !== 'undefined');

  var bodyField = bodyEl.closest('.email-body-field') || bodyEl.parentNode;
  if (!bodyField) return;

  // Create toggle row — hidden in the small zone, only shown in expand modal
  var toggleRow = document.createElement('div');
  toggleRow.className = 'email-html-toggle-row';
  toggleRow.id = 'emailHtmlToggleRow';
  toggleRow.style.display = 'none'; // hidden in small zone

  var htmlBtn = document.createElement('button');
  htmlBtn.type = 'button';
  htmlBtn.className = 'email-html-toggle-btn active';
  htmlBtn.id = 'emailHtmlBtn';
  htmlBtn.textContent = 'HTML';
  htmlBtn.addEventListener('click', function() { _switchEmailView('html'); });

  var textBtn = document.createElement('button');
  textBtn.type = 'button';
  textBtn.className = 'email-html-toggle-btn';
  textBtn.id = 'emailTextBtn';
  textBtn.textContent = 'Text';
  textBtn.addEventListener('click', function() { _switchEmailView('text'); });

  toggleRow.appendChild(htmlBtn);
  toggleRow.appendChild(textBtn);

  // Insert toggle row before the body label
  var bodyLabel = bodyField.querySelector('label');
  if (bodyLabel) {
    bodyLabel.parentNode.insertBefore(toggleRow, bodyLabel.nextSibling);
  } else {
    bodyField.insertBefore(toggleRow, bodyField.firstChild);
  }

  // Create iframe for HTML rendering
  var iframe = document.createElement('iframe');
  iframe.id = 'emailHtmlIframe';
  iframe.className = 'email-html-iframe';
  iframe.sandbox = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox';
  iframe.setAttribute('frameborder', '0');

  // Sanitize HTML with DOMPurify before rendering
  var sanitized = htmlContent;
  if (typeof DOMPurify !== 'undefined') {
    sanitized = DOMPurify.sanitize(htmlContent, {
      ALLOW_TAGS: ['html', 'head', 'body', 'div', 'span', 'p', 'br', 'hr',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'table', 'thead',
        'tbody', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'b', 'i', 'u', 'em',
        'strong', 'blockquote', 'pre', 'code', 'style', 'font', 'center',
        'small', 'big', 'sub', 'sup', 'dl', 'dt', 'dd', 'abbr', 'cite',
        'del', 'ins', 'mark', 's', 'strike', 'caption', 'col', 'colgroup',
        'details', 'summary', 'figure', 'figcaption', 'header', 'footer',
        'main', 'nav', 'section', 'article', 'aside', 'address'],
      ALLOW_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'style',
        'width', 'height', 'border', 'cellpadding', 'cellspacing', 'align',
        'valign', 'bgcolor', 'color', 'face', 'size', 'target', 'colspan',
        'rowspan', 'dir', 'lang', 'role', 'aria-label', 'aria-hidden',
        'data-x', 'name'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input',
        'button', 'select', 'textarea'],
      ADD_ATTR: ['target'],
    });
  }

  // Force all links to open in new tab
  sanitized = sanitized.replace(/<a /gi, '<a target="_blank" rel="noopener noreferrer" ');

  iframe.srcdoc = sanitized;

  // Insert iframe after the textarea
  bodyEl.parentNode.insertBefore(iframe, bodyEl.nextSibling);

  // Auto-resize iframe based on content
  iframe.addEventListener('load', function() {
    _resizeEmailIframe(iframe);
    // Also force links inside the iframe to open in new tabs
    try {
      var doc = iframe.contentDocument || iframe.contentWindow.document;
      if (doc) {
        doc.querySelectorAll('a').forEach(function(a) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        });
      }
    } catch(e) { /* cross-origin */ }
  });

  // Default: show HTML, hide textarea
  bodyEl.style.display = 'none';
  _emailViewMode = 'html';
}

/**
 * Switch between HTML and Text views.
 * @param {string} mode — 'html' or 'text'
 */
function _switchEmailView(mode) {
  var bodyEl = document.getElementById('emailBody');
  var iframe = document.getElementById('emailHtmlIframe');
  var htmlBtn = document.getElementById('emailHtmlBtn');
  var textBtn = document.getElementById('emailTextBtn');

  if (mode === 'html' && iframe) {
    if (bodyEl) bodyEl.style.display = 'none';
    iframe.style.display = '';
    if (htmlBtn) htmlBtn.classList.add('active');
    if (textBtn) textBtn.classList.remove('active');
  } else {
    if (bodyEl) bodyEl.style.display = '';
    if (iframe) iframe.style.display = 'none';
    if (htmlBtn) htmlBtn.classList.remove('active');
    if (textBtn) textBtn.classList.add('active');
  }
  _emailViewMode = mode;
}

/**
 * Auto-resize an iframe to fit its content height.
 * @param {HTMLIFrameElement} iframe
 */
function _resizeEmailIframe(iframe) {
  try {
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    if (doc && doc.body) {
      var height = doc.body.scrollHeight + 20;
      iframe.style.height = Math.max(200, Math.min(height, 800)) + 'px';
    }
  } catch (e) {
    // Cross-origin restriction — use default height
    iframe.style.height = '400px';
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// Email Thread — conversation view below the body
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch the email thread for a chit and render it below the body textarea.
 * @param {string} chitId — the current chit's ID
 */
async function _fetchEmailThread(chitId) {
  try {
    var resp = await fetch('/api/email/thread/' + encodeURIComponent(chitId));
    if (!resp.ok) return;
    var thread = await resp.json();

    // Only show thread section if there are related emails (more than just the current one)
    if (!thread || thread.length <= 1) return;

    _renderEmailThread(thread, chitId);
  } catch (err) {
    console.error('[Email Thread] Error fetching thread:', err);
  }
}

/**
 * Render the email thread section below the email body.
 * @param {Array} thread — array of thread entries from the API
 * @param {string} currentId — the current chit's ID (highlighted)
 */
function _renderEmailThread(thread, currentId) {
  // Remove existing thread section if any
  var existing = document.getElementById('emailThreadSection');
  if (existing) existing.remove();

  var emailContent = document.getElementById('emailContent');
  if (!emailContent) return;

  var section = document.createElement('div');
  section.id = 'emailThreadSection';
  section.className = 'email-thread-section';

  var header = document.createElement('div');
  header.className = 'email-thread-header';
  header.innerHTML = '<span class="email-thread-icon">🧵</span> Thread (' + thread.length + ' messages)';
  section.appendChild(header);

  var list = document.createElement('div');
  list.className = 'email-thread-list';

  thread.forEach(function(entry) {
    var item = document.createElement('div');
    item.className = 'email-thread-item' + (entry.id === currentId ? ' email-thread-current' : '');

    var sender = document.createElement('div');
    sender.className = 'email-thread-sender';
    sender.textContent = entry.email_from || '(Unknown)';
    item.appendChild(sender);

    var dateStr = '';
    if (entry.email_date) {
      try {
        var d = new Date(entry.email_date);
        dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
                  ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        dateStr = entry.email_date;
      }
    }
    var dateLine = document.createElement('div');
    dateLine.className = 'email-thread-date';
    dateLine.textContent = dateStr;
    item.appendChild(dateLine);

    var preview = document.createElement('div');
    preview.className = 'email-thread-preview';
    preview.textContent = entry.email_body_text_preview || '';
    item.appendChild(preview);

    // Click to navigate to that email (unless it's the current one)
    if (entry.id !== currentId) {
      item.style.cursor = 'pointer';
      item.addEventListener('click', function() {
        // Preserve expand state when navigating within a thread
        var expandParam = _emailExpandModalOpen ? '&expand=email' : '';
        window.location.href = '/frontend/html/editor.html?id=' + encodeURIComponent(entry.id) + expandParam;
      });
    }

    list.appendChild(item);
  });

  section.appendChild(list);
  emailContent.appendChild(section);
}

// ═══════════════════════════════════════════════════════════════════════════
// Email Attachment Bar — shows attachment icons at bottom of email body
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Render email attachment icons at the bottom-right of the email body field.
 * Shown in both the small zone and the expand modal.
 * @param {Object} chit — the loaded chit object
 */
function _renderEmailAttachmentBar(chit) {
  // Remove any existing bar first
  var existing = document.getElementById('emailAttachmentBar');
  if (existing) existing.remove();

  var attachments = _getEmailAttachmentList(chit);
  if (!attachments || attachments.length === 0) return;

  var bar = _buildEmailAttachmentBar(attachments, chit.id);
  bar.id = 'emailAttachmentBar';

  // Insert after the email body field (textarea or iframe)
  var bodyField = document.querySelector('.email-body-field');
  if (bodyField) {
    bodyField.appendChild(bar);
  }
}

/**
 * Render email attachment icons inside the expand modal body.
 * @param {Object} chit — the loaded chit object
 */
function _renderExpandEmailAttachmentBar(chit) {
  var attachments = _getEmailAttachmentList(chit);
  if (!attachments || attachments.length === 0) return;

  var bar = _buildEmailAttachmentBar(attachments, chit.id);
  bar.id = 'emailExpandAttachmentBar';

  // Insert at the bottom of the expand modal body wrap
  var wrap = document.getElementById('emailExpandBodyWrap');
  if (wrap) {
    wrap.appendChild(bar);
  }
}

/**
 * Parse the attachments list from a chit.
 * @param {Object} chit
 * @returns {Array|null}
 */
function _getEmailAttachmentList(chit) {
  if (!chit || !chit.attachments) return null;
  var parsed = chit.attachments;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch (e) { return null; }
  }
  return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
}

/**
 * Build the attachment bar DOM element.
 * Icons flow right-to-left in the bottom-right corner.
 * @param {Array} attachments — parsed attachment metadata array
 * @param {string} chitId — the chit ID for download URLs
 * @returns {HTMLElement}
 */
function _buildEmailAttachmentBar(attachments, chitId) {
  var bar = document.createElement('div');
  bar.className = 'email-attachment-bar';

  attachments.forEach(function(att) {
    var item = document.createElement('a');
    item.className = 'email-attachment-chip';
    item.href = '/api/chits/' + encodeURIComponent(chitId) + '/attachments/' + encodeURIComponent(att.id);
    item.target = '_blank';
    item.title = att.filename + ' (' + _formatAttSize(att.size) + ')';
    item.setAttribute('download', att.filename);

    var icon = document.createElement('span');
    icon.className = 'email-attachment-chip-icon';
    icon.textContent = typeof _getFileIcon === 'function' ? _getFileIcon(att.mime_type) : '📄';
    item.appendChild(icon);

    var name = document.createElement('span');
    name.className = 'email-attachment-chip-name';
    name.textContent = att.filename;
    item.appendChild(name);

    bar.appendChild(item);
  });

  return bar;
}

/**
 * Format a byte size into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function _formatAttSize(bytes) {
  if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
