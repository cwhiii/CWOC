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

/**
 * Populate email zone fields from chit data and configure button visibility
 * based on email_status.
 *
 * @param {Object} chit — the loaded chit object
 */
function initEmailZone(chit) {
  _emailCurrentChit = chit;

  var fromEl = document.getElementById('emailFrom');
  var toEl = document.getElementById('emailTo');
  var ccEl = document.getElementById('emailCc');
  var bccEl = document.getElementById('emailBcc');
  var bodyEl = document.getElementById('emailBody');
  var sendBtn = document.getElementById('emailSendBtn');
  var replyBtn = document.getElementById('emailReplyBtn');
  var forwardBtn = document.getElementById('emailForwardBtn');

  // Populate From field
  if (fromEl) {
    fromEl.textContent = chit.email_from || '';
  }

  // Populate To/Cc/Bcc — arrays joined with ", "
  if (toEl) {
    toEl.value = Array.isArray(chit.email_to) ? chit.email_to.join(', ') : (chit.email_to || '');
  }
  if (ccEl) {
    ccEl.value = Array.isArray(chit.email_cc) ? chit.email_cc.join(', ') : (chit.email_cc || '');
  }
  if (bccEl) {
    bccEl.value = Array.isArray(chit.email_bcc) ? chit.email_bcc.join(', ') : (chit.email_bcc || '');
  }

  // Populate Body
  if (bodyEl) {
    bodyEl.value = chit.email_body_text || '';
  }

  var status = chit.email_status || '';

  // Configure buttons and editability based on status
  if (status === 'draft') {
    // Draft: show Send, hide Reply/Forward, fields editable
    if (sendBtn) sendBtn.style.display = '';
    if (replyBtn) replyBtn.style.display = 'none';
    if (forwardBtn) forwardBtn.style.display = 'none';
    _setEmailZoneReadOnly(false);
  } else if (status === 'received') {
    // Received: show Reply/Forward, hide Send, fields read-only
    if (sendBtn) sendBtn.style.display = 'none';
    if (replyBtn) replyBtn.style.display = '';
    if (forwardBtn) forwardBtn.style.display = '';
    _setEmailZoneReadOnly(true);
  } else if (status === 'sent') {
    // Sent: hide all action buttons, fields read-only
    if (sendBtn) sendBtn.style.display = 'none';
    if (replyBtn) replyBtn.style.display = 'none';
    if (forwardBtn) forwardBtn.style.display = 'none';
    _setEmailZoneReadOnly(true);
  } else {
    // No email status (new email or non-email chit) — editable, show Send
    if (sendBtn) sendBtn.style.display = '';
    if (replyBtn) replyBtn.style.display = 'none';
    if (forwardBtn) forwardBtn.style.display = 'none';
    _setEmailZoneReadOnly(false);
  }

  // Wire up change listeners for dirty tracking
  if (toEl) toEl.addEventListener('input', function () { setSaveButtonUnsaved(); });
  if (ccEl) ccEl.addEventListener('input', function () { setSaveButtonUnsaved(); });
  if (bccEl) bccEl.addEventListener('input', function () { setSaveButtonUnsaved(); });
  if (bodyEl) bodyEl.addEventListener('input', function () { setSaveButtonUnsaved(); });
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
  var bodyVal = bodyEl ? bodyEl.value : '';
  var isReadOnly = bodyEl ? bodyEl.readOnly : false;

  var overlay = document.createElement('div');
  overlay.id = 'emailExpandModal';
  overlay.className = 'modal';
  overlay.style.display = 'flex';
  overlay.innerHTML =
    '<div class="modal-content" style="max-width:95vw;width:800px;min-height:70vh;display:flex;flex-direction:column;">' +
      '<h3 style="margin:0 0 10px;">✉️ Email Body</h3>' +
      '<textarea id="emailExpandBody" style="flex:1;min-height:400px;width:100%;box-sizing:border-box;font-family:Lora,Georgia,serif;font-size:14px;line-height:1.6;padding:10px;border:1px inset #c4a882;border-radius:4px;resize:none;"' +
        (isReadOnly ? ' readonly disabled' : '') +
      '>' + _escapeHtmlAttr(bodyVal) + '</textarea>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">' +
        (isReadOnly ? '' : '<button class="zone-button" onclick="_closeEmailExpandModal(true)">Save</button>') +
        '<button class="zone-button" onclick="_closeEmailExpandModal(false)">Close</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
}

/**
 * Close the email expand modal.
 * @param {boolean} save — if true, copy modal text back to the main textarea
 */
function _closeEmailExpandModal(save) {
  var modal = document.getElementById('emailExpandModal');
  if (!modal) return;
  if (save) {
    var expandBody = document.getElementById('emailExpandBody');
    var bodyEl = document.getElementById('emailBody');
    if (expandBody && bodyEl) {
      bodyEl.value = expandBody.value;
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
