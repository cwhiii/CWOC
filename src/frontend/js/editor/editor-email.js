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

  if (isEmail) {
    // Hide normal save buttons
    if (saveStay) saveStay.style.display = 'none';
    if (saveExit) saveExit.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
    // Show email save buttons
    if (saveDraft) saveDraft.style.display = '';
    if (saveSend) saveSend.style.display = '';

    // Patch the save system so markUnsaved keeps showing email buttons
    if (window._cwocSave && !window._cwocSave._emailPatched) {
      window._cwocSave._origMarkUnsaved = window._cwocSave.markUnsaved.bind(window._cwocSave);
      window._cwocSave._origMarkSaved = window._cwocSave.markSaved.bind(window._cwocSave);
      window._cwocSave.markUnsaved = function() {
        window._cwocSave._origMarkUnsaved();
        // Override: hide normal, show email
        if (saveStay) saveStay.style.display = 'none';
        if (saveExit) saveExit.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';
        if (saveDraft) saveDraft.style.display = '';
        if (saveSend) saveSend.style.display = '';
      };
      window._cwocSave.markSaved = function() {
        window._cwocSave._origMarkSaved();
        // Override: hide normal single button, keep email buttons
        if (saveBtn) saveBtn.style.display = 'none';
        if (saveDraft) saveDraft.style.display = '';
        if (saveSend) saveSend.style.display = '';
      };
      window._cwocSave._emailPatched = true;
    }
  } else {
    // Hide email save buttons
    if (saveDraft) saveDraft.style.display = 'none';
    if (saveSend) saveSend.style.display = 'none';
  }
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
    window.location.href = '/frontend/html/editor.html?id=' + encodeURIComponent(created.id);
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
    window.location.href = '/frontend/html/editor.html?id=' + encodeURIComponent(created.id);
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
}

/**
 * Open a fullscreen modal for the email body (expand button).
 */
function _openEmailExpandModal() {
  // Remove existing modal if any
  var existing = document.getElementById('emailExpandModal');
  if (existing) existing.remove();

  var bodyEl = document.getElementById('emailBody');
  var toEl = document.getElementById('emailTo');
  var ccEl = document.getElementById('emailCc');
  var bccEl = document.getElementById('emailBcc');
  var fromEl = document.getElementById('emailFrom');
  var bodyVal = bodyEl ? bodyEl.value : '';
  var isReadOnly = bodyEl ? bodyEl.readOnly : false;
  var status = (_emailCurrentChit && _emailCurrentChit.email_status) || 'draft';

  var overlay = document.createElement('div');
  overlay.id = 'emailExpandModal';
  overlay.className = 'modal-overlay';
  overlay.style.display = 'flex';

  var actionBtns = '';
  if (status === 'draft') {
    actionBtns = '<button class="zone-button" onclick="event.stopPropagation(); _closeEmailExpandModal(true); _emailSend()"><i class="fas fa-paper-plane"></i> Send</button>';
  } else if (status === 'received') {
    actionBtns =
      '<button class="zone-button" onclick="event.stopPropagation(); _closeEmailExpandModal(true); _emailReply()"><i class="fas fa-reply"></i> Reply</button>' +
      '<button class="zone-button" onclick="event.stopPropagation(); _closeEmailExpandModal(true); _emailForward()"><i class="fas fa-share"></i> Forward</button>';
  }

  var disabledAttr = isReadOnly ? ' readonly disabled' : '';
  var labelStyle = 'min-width:50px;font-weight:600;color:#5a4a3a;font-family:Lora,Georgia,serif;font-size:14px;text-align:right;';
  var inputStyle = 'flex:1;padding:6px 10px;border:1px inset #c4a882;border-radius:4px;font-family:Lora,Georgia,serif;font-size:14px;';

  overlay.innerHTML =
    '<div class="modal-contentFull" style="max-width:95vw;width:900px;min-height:80vh;display:flex;flex-direction:column;padding:20px;">' +
      '<div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:10px 15px;margin:-20px -20px 15px -20px;border-radius:8px 8px 0 0;">' +
        '<h2 style="margin:0;font-family:Lora,Georgia,serif;">✉️ Email</h2>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          actionBtns +
          '<button class="zone-button" onclick="_closeEmailExpandModal(true)" title="Close"><i class="fas fa-times"></i> Close</button>' +
        '</div>' +
      '</div>' +
      '<div class="email-field" style="margin-bottom:6px;display:flex;align-items:center;gap:10px;"><label style="' + labelStyle + '">From:</label><span style="flex:1;padding:4px 8px;font-style:italic;color:#5a4a3a;">' + _escapeHtmlAttr(fromEl ? fromEl.textContent : '') + '</span></div>' +
      '<div class="email-field" style="margin-bottom:6px;display:flex;align-items:center;gap:10px;"><label style="' + labelStyle + '">To:</label><input id="emailExpandTo" type="text" value="' + _escapeHtmlAttr(toEl ? toEl.value : '') + '" style="' + inputStyle + '"' + disabledAttr + '></div>' +
      '<div class="email-field" style="margin-bottom:6px;display:flex;align-items:center;gap:10px;"><label style="' + labelStyle + '">CC:</label><input id="emailExpandCc" type="text" value="' + _escapeHtmlAttr(ccEl ? ccEl.value : '') + '" style="' + inputStyle + '"' + disabledAttr + '></div>' +
      '<div class="email-field" style="margin-bottom:10px;display:flex;align-items:center;gap:10px;"><label style="' + labelStyle + '">BCC:</label><input id="emailExpandBcc" type="text" value="' + _escapeHtmlAttr(bccEl ? bccEl.value : '') + '" style="' + inputStyle + '"' + disabledAttr + '></div>' +
      '<textarea id="emailExpandBody" style="flex:1;min-height:400px;width:100%;box-sizing:border-box;font-family:Lora,Georgia,serif;font-size:14px;line-height:1.6;padding:10px;border:1px inset #c4a882;border-radius:4px;resize:none;"' +
        disabledAttr +
      '>' + _escapeHtmlAttr(bodyVal) + '</textarea>' +
    '</div>';

  // Close on overlay click (outside modal content)
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) _closeEmailExpandModal(false);
  });

  // Handle ESC key to close the modal
  function _emailExpandEscHandler(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      _closeEmailExpandModal(false);
      document.removeEventListener('keydown', _emailExpandEscHandler, true);
    }
  }
  document.addEventListener('keydown', _emailExpandEscHandler, true);
  // Store the handler so _closeEmailExpandModal can clean it up
  overlay._escHandler = _emailExpandEscHandler;

  document.body.appendChild(overlay);
}

/**
 * Close the email expand modal.
 * @param {boolean} save — if true, copy modal text back to the main textarea
 */
function _closeEmailExpandModal(save) {
  var modal = document.getElementById('emailExpandModal');
  if (!modal) return;

  // Clean up ESC handler
  if (modal._escHandler) {
    document.removeEventListener('keydown', modal._escHandler, true);
  }

  if (save) {
    var expandBody = document.getElementById('emailExpandBody');
    var bodyEl = document.getElementById('emailBody');
    if (expandBody && bodyEl) {
      bodyEl.value = expandBody.value;
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
  modal.remove();
}

/** Escape text for safe insertion into HTML attribute/textarea content */
function _escapeHtmlAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Alias for use in autocomplete dropdown rendering */
var _escHtml = _escapeHtmlAttr;


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

  // Create toggle row
  var toggleRow = document.createElement('div');
  toggleRow.className = 'email-html-toggle-row';
  toggleRow.id = 'emailHtmlToggleRow';

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
  iframe.sandbox = 'allow-same-origin';
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

  iframe.srcdoc = sanitized;

  // Insert iframe after the textarea
  bodyEl.parentNode.insertBefore(iframe, bodyEl.nextSibling);

  // Auto-resize iframe based on content
  iframe.addEventListener('load', function() {
    _resizeEmailIframe(iframe);
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
        window.location.href = '/frontend/html/editor.html?id=' + encodeURIComponent(entry.id);
      });
    }

    list.appendChild(item);
  });

  section.appendChild(list);
  emailContent.appendChild(section);
}
