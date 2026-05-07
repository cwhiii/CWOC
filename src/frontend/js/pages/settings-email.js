// ── Settings: Email Account Management ───────────────────────────────────────
// Multi-account email configuration, signature editor, backfill.
// Extracted from settings.js for modularity.

/** In-memory array of email account objects */
var _emailAccounts = [];

/** Index of the account currently being edited in the modal (-1 = none) */
var _emailModalEditIdx = -1;

/** Populate email accounts from loaded settings */
function _loadEmailAccountSettings(settings) {
  try {
    var accounts = settings.email_accounts;
    if (!Array.isArray(accounts) || accounts.length === 0) {
      // Fall back to legacy single account
      var legacy = settings.email_account;
      if (legacy && typeof legacy === 'object' && legacy.email) {
        if (!legacy.id) legacy.id = _generateAccountId();
        accounts = [legacy];
      } else {
        accounts = [];
      }
    }
    _emailAccounts = accounts;
    _renderEmailAccountsSummary();

    // Shared sync settings — read from first account or defaults
    var firstAcct = accounts[0] || {};
    var el;
    el = document.getElementById('emailMaxPull');
    if (el) el.value = firstAcct.max_pull || 50;
    el = document.getElementById('emailCheckInterval');
    if (el) el.value = firstAcct.check_interval || 'manual';
    // Signature
    el = document.getElementById('emailSignature');
    if (el) el.value = firstAcct.signature || '';
  } catch (e) {
    console.error('[Settings] Error loading email account settings:', e);
  }
}

/** Generate a simple unique ID for a new email account */
function _generateAccountId() {
  return 'acct_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

/** Render a brief summary of configured accounts on the settings page */
function _renderEmailAccountsSummary() {
  var el = document.getElementById('emailAccountsSummary');
  if (!el) return;
  if (_emailAccounts.length === 0) {
    el.innerHTML = '<span style="opacity:0.5;">No accounts configured.</span>';
  } else {
    var items = _emailAccounts.map(function(a) {
      return '<span style="display:inline-block;background:#f5e6cc;border:1px solid rgba(139,90,43,0.3);border-radius:4px;padding:2px 8px;margin:2px 4px 2px 0;font-size:0.85em;">' + _escapeHtml(a.email || 'Unnamed') + '</span>';
    });
    el.innerHTML = items.join('');
  }
}

// ── Email Accounts Modal ──────────────────────────────────────────────────

/** Open the email accounts management modal */
function openEmailAccountsModal() {
  _emailModalEditIdx = -1;
  var modal = document.getElementById('email-accounts-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  _emailModalShowList();
}

/** Close the email accounts modal */
function closeEmailAccountsModal() {
  var modal = document.getElementById('email-accounts-modal');
  if (modal) modal.style.display = 'none';
  _renderEmailAccountsSummary();
}

/** Show the account list view in the modal */
function _emailModalShowList() {
  document.getElementById('emailModalListView').style.display = '';
  document.getElementById('emailModalEditView').style.display = 'none';
  _emailModalRenderList();
}

/** Render the list of accounts in the modal */
function _emailModalRenderList() {
  var container = document.getElementById('emailModalAccountList');
  if (!container) return;
  container.innerHTML = '';
  if (_emailAccounts.length === 0) {
    container.innerHTML = '<div style="opacity:0.5;font-size:0.9em;padding:12px;text-align:center;">No email accounts configured yet.</div>';
    return;
  }
  _emailAccounts.forEach(function(acct, idx) {
    var item = document.createElement('div');
    item.className = 'email-modal-item';
    item.onclick = function() { _emailModalEditAccount(idx); };
    var icon = document.createElement('span');
    icon.className = 'email-modal-item-icon';
    icon.textContent = '📧';
    item.appendChild(icon);
    var info = document.createElement('div');
    info.className = 'email-modal-item-info';
    var emailLine = document.createElement('div');
    emailLine.className = 'email-modal-item-email';
    emailLine.textContent = acct.nickname ? acct.nickname + ' — ' + (acct.email || 'New Account') : (acct.email || 'New Account');
    info.appendChild(emailLine);
    var serverLine = document.createElement('div');
    serverLine.className = 'email-modal-item-server';
    serverLine.textContent = (acct.imap_host || 'imap.gmail.com') + ':' + (acct.imap_port || 993);
    info.appendChild(serverLine);
    item.appendChild(info);
    var arrow = document.createElement('span');
    arrow.className = 'email-modal-item-arrow';
    arrow.textContent = '›';
    item.appendChild(arrow);
    container.appendChild(item);
  });
}

/** Add a new account and open its edit form */
function _emailModalAddAccount() {
  var newAcct = { id: _generateAccountId(), email: '', display_name: '', imap_host: 'imap.gmail.com', imap_port: 993, smtp_host: 'smtp.gmail.com', smtp_port: 587, username: '', password: '' };
  _emailAccounts.push(newAcct);
  _emailModalEditAccount(_emailAccounts.length - 1);
  setSaveButtonUnsaved();
}

/** Open the edit view for a specific account */
function _emailModalEditAccount(idx) {
  _emailModalEditIdx = idx;
  var acct = _emailAccounts[idx];
  if (!acct) return;
  document.getElementById('emailModalListView').style.display = 'none';
  document.getElementById('emailModalEditView').style.display = '';
  var title = document.getElementById('emailModalEditTitle');
  if (title) title.textContent = acct.nickname || acct.email || 'New Account';
  var form = document.getElementById('emailModalEditForm');
  if (!form) return;
  var hasPassword = !!(acct.password || acct.password_encrypted);
  var imapSec = acct.imap_security || 'ssl';
  var smtpSec = acct.smtp_security || 'starttls';
  form.innerHTML =
    '<div class="setting-inline"><label>Nickname</label><input type="text" id="eaModalNickname" placeholder="e.g. Work, Personal" value="' + _escapeAttr(acct.nickname || '') + '" style="flex:1;min-width:0;" /></div>' +
    '<div class="setting-inline"><label>Email Address</label><input type="text" id="eaModalEmail" placeholder="user@gmail.com" value="' + _escapeAttr(acct.email || '') + '" style="flex:1;min-width:0;" /></div>' +
    '<div class="setting-inline"><label>Display Name</label><input type="text" id="eaModalDisplayName" placeholder="Your Name" value="' + _escapeAttr(acct.display_name || '') + '" style="flex:1;min-width:0;" /></div>' +
    '<div class="setting-inline"><label>Username</label><input type="text" id="eaModalUsername" placeholder="user@gmail.com" autocomplete="off" value="' + _escapeAttr(acct.username || '') + '" style="flex:1;min-width:0;" /></div>' +
    '<div class="setting-inline"><label>Password</label><div style="flex:1;min-width:0;display:flex;gap:4px;"><input type="password" id="eaModalPassword" placeholder="' + (hasPassword ? '••••••••' : 'App password') + '" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true" style="flex:1;min-width:0;" value="' + _escapeAttr(acct.password || '') + '" /><button type="button" class="standard-button" style="flex-shrink:0;padding:4px 8px;font-size:0.85em;" onclick="_emailModalTogglePw()">👁️</button></div></div>' +
    '<p class="setting-hint">For Gmail, use an App Password. Go to Google Account → Security → App Passwords.</p>' +
    '<div class="setting-inline" style="margin-top:8px;"><label>IMAP Host</label><input type="text" id="eaModalImapHost" value="' + _escapeAttr(acct.imap_host || 'imap.gmail.com') + '" style="flex:1;min-width:0;" /></div>' +
    '<div class="setting-inline"><label>IMAP Port</label><input type="number" id="eaModalImapPort" value="' + (acct.imap_port || 993) + '" style="width:80px;" /></div>' +
    '<div class="setting-inline"><label>IMAP Security</label><select id="eaModalImapSecurity" style="width:auto;"><option value="ssl"' + (imapSec === 'ssl' ? ' selected' : '') + '>SSL/TLS</option><option value="starttls"' + (imapSec === 'starttls' ? ' selected' : '') + '>STARTTLS</option><option value="none"' + (imapSec === 'none' ? ' selected' : '') + '>None</option></select></div>' +
    '<div class="setting-inline"><label>SMTP Host</label><input type="text" id="eaModalSmtpHost" value="' + _escapeAttr(acct.smtp_host || 'smtp.gmail.com') + '" style="flex:1;min-width:0;" /></div>' +
    '<div class="setting-inline"><label>SMTP Port</label><input type="number" id="eaModalSmtpPort" value="' + (acct.smtp_port || 587) + '" style="width:80px;" /></div>' +
    '<div class="setting-inline"><label>SMTP Security</label><select id="eaModalSmtpSecurity" style="width:auto;"><option value="starttls"' + (smtpSec === 'starttls' ? ' selected' : '') + '>STARTTLS</option><option value="ssl"' + (smtpSec === 'ssl' ? ' selected' : '') + '>SSL/TLS</option><option value="none"' + (smtpSec === 'none' ? ' selected' : '') + '>None</option></select></div>' +
    '<p class="setting-hint" style="margin-top:6px;">OAuth2 is not currently supported. Use app passwords for providers that require it.</p>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;"><button type="button" class="standard-button" onclick="_emailModalTestConnection()">🔌 Test Connection</button><span id="eaModalTestResult" style="font-size:0.85em;"></span></div>';
}

/** Go back to the list view from the edit view */
function _emailModalBackToList() { _emailModalApplyFormToAccount(); _emailModalShowList(); }

/** Apply the current form values to the in-memory account object */
function _emailModalApplyFormToAccount() {
  if (_emailModalEditIdx < 0 || _emailModalEditIdx >= _emailAccounts.length) return;
  var acct = _emailAccounts[_emailModalEditIdx];
  var pw = (document.getElementById('eaModalPassword') || {}).value || '';
  acct.nickname = ((document.getElementById('eaModalNickname') || {}).value || '').trim();
  acct.email = ((document.getElementById('eaModalEmail') || {}).value || '').trim();
  acct.display_name = ((document.getElementById('eaModalDisplayName') || {}).value || '').trim();
  acct.username = ((document.getElementById('eaModalUsername') || {}).value || '').trim();
  acct.imap_host = ((document.getElementById('eaModalImapHost') || {}).value || 'imap.gmail.com').trim();
  acct.imap_port = parseInt((document.getElementById('eaModalImapPort') || {}).value, 10) || 993;
  acct.imap_security = ((document.getElementById('eaModalImapSecurity') || {}).value || 'ssl');
  acct.smtp_host = ((document.getElementById('eaModalSmtpHost') || {}).value || 'smtp.gmail.com').trim();
  acct.smtp_port = parseInt((document.getElementById('eaModalSmtpPort') || {}).value, 10) || 587;
  acct.smtp_security = ((document.getElementById('eaModalSmtpSecurity') || {}).value || 'starttls');
  if (pw) acct.password = pw;
  setSaveButtonUnsaved();
}

/** Save the current account and go back to list */
function _emailModalSaveAccount() {
  _emailModalApplyFormToAccount();
  if (_emailModalEditIdx >= 0 && _emailModalEditIdx < _emailAccounts.length) {
    if (!_emailAccounts[_emailModalEditIdx].email) _emailAccounts.splice(_emailModalEditIdx, 1);
  }
  _emailModalShowList();
  _renderEmailAccountsSummary();
  setSaveButtonUnsaved();
}

/** Delete the currently edited account */
function _emailModalDeleteAccount() {
  if (_emailModalEditIdx < 0 || _emailModalEditIdx >= _emailAccounts.length) return;
  var acct = _emailAccounts[_emailModalEditIdx];
  var username = acct.username || acct.email || 'unknown';
  var host = acct.imap_host || 'unknown';
  var modal = document.getElementById('deleteEmailAccountModal');
  var msg = document.getElementById('deleteEmailAccountMessage');
  if (msg) msg.textContent = 'Email ' + username + ' on ' + host;
  modal.style.display = 'flex';

  var confirmBtn = document.getElementById('confirmDeleteEmailAccountBtn');
  var cancelBtn = document.getElementById('cancelDeleteEmailAccountBtn');

  function cleanup() {
    modal.style.display = 'none';
    confirmBtn.removeEventListener('click', onConfirm);
    cancelBtn.removeEventListener('click', onCancel);
  }
  function onConfirm() {
    cleanup();
    _emailAccounts.splice(_emailModalEditIdx, 1);
    _emailModalEditIdx = -1;
    _emailModalShowList();
    _renderEmailAccountsSummary();
    setSaveButtonUnsaved();
  }
  function onCancel() {
    cleanup();
  }
  confirmBtn.addEventListener('click', onConfirm);
  cancelBtn.addEventListener('click', onCancel);
}

/** Toggle password visibility in the modal edit form */
function _emailModalTogglePw() {
  var input = document.getElementById('eaModalPassword');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

/** Test connection for the account being edited in the modal */
async function _emailModalTestConnection() {
  var resultSpan = document.getElementById('eaModalTestResult');
  if (resultSpan) { resultSpan.textContent = '⏳ Testing...'; resultSpan.style.color = '#8b5a2b'; }
  var payload = {
    email: ((document.getElementById('eaModalEmail') || {}).value || '').trim(),
    imap_host: ((document.getElementById('eaModalImapHost') || {}).value || 'imap.gmail.com').trim(),
    imap_port: parseInt((document.getElementById('eaModalImapPort') || {}).value, 10) || 993,
    imap_security: ((document.getElementById('eaModalImapSecurity') || {}).value || 'ssl'),
    smtp_host: ((document.getElementById('eaModalSmtpHost') || {}).value || 'smtp.gmail.com').trim(),
    smtp_port: parseInt((document.getElementById('eaModalSmtpPort') || {}).value, 10) || 587,
    smtp_security: ((document.getElementById('eaModalSmtpSecurity') || {}).value || 'starttls'),
    username: ((document.getElementById('eaModalUsername') || {}).value || '').trim(),
    password: (document.getElementById('eaModalPassword') || {}).value || '',
  };
  try {
    var resp = await fetch('/api/email/test-connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await resp.json();
    if (!resp.ok) {
      if (resultSpan) { resultSpan.textContent = '❌ ' + (data.detail || 'Connection failed'); resultSpan.style.color = '#b22222'; }
    } else if (data.imap && data.smtp) {
      if (data.imap.success && data.smtp.success) {
        if (resultSpan) { resultSpan.textContent = '✅ IMAP & SMTP connected'; resultSpan.style.color = '#1a7a4c'; }
      } else {
        var parts = [];
        parts.push(data.imap.success ? '✅ IMAP OK' : '❌ IMAP: ' + (data.imap.message || 'failed'));
        parts.push(data.smtp.success ? '✅ SMTP OK' : '❌ SMTP: ' + (data.smtp.message || 'failed'));
        if (resultSpan) { resultSpan.innerHTML = parts.join('<br>'); resultSpan.style.color = '#b22222'; }
      }
    }
  } catch (e) {
    if (resultSpan) { resultSpan.textContent = '❌ Network error'; resultSpan.style.color = '#b22222'; }
  }
}

/** Collect all email accounts into a JSON array for the save payload */
function _collectEmailAccountsSettings() {
  var sharedMaxPull = parseInt((document.getElementById('emailMaxPull') || {}).value, 10) || 50;
  var sharedCheckInterval = ((document.getElementById('emailCheckInterval') || {}).value || 'manual');
  var sharedSignature = ((document.getElementById('emailSignature') || {}).value || '');
  var accounts = [];
  _emailAccounts.forEach(function(acct) {
    if (!acct.email || !acct.email.trim()) return;
    var obj = { id: acct.id || _generateAccountId(), nickname: (acct.nickname || '').trim(), email: acct.email.trim(), display_name: (acct.display_name || '').trim(), imap_host: (acct.imap_host || 'imap.gmail.com').trim(), imap_port: acct.imap_port || 993, imap_security: acct.imap_security || 'ssl', smtp_host: (acct.smtp_host || 'smtp.gmail.com').trim(), smtp_port: acct.smtp_port || 587, smtp_security: acct.smtp_security || 'starttls', username: (acct.username || '').trim(), max_pull: sharedMaxPull, check_interval: sharedCheckInterval, signature: sharedSignature };
    if (acct.password) obj.password = acct.password;
    accounts.push(obj);
  });
  return accounts;
}

/** Escape HTML for safe insertion */
function _escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Escape for HTML attribute values */
function _escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Legacy single-account collect — still used for backward compat in save payload */
function _collectEmailAccountSettings() {
  var accounts = _collectEmailAccountsSettings();
  if (accounts.length === 0) return null;
  var first = Object.assign({}, accounts[0]);
  delete first.id;
  return first;
}

/** Legacy function — opens the modal */
function addEmailAccount() { openEmailAccountsModal(); _emailModalAddAccount(); }

/** Open the signature editor modal — textarea on top, live preview on bottom */
function openSignatureModal() {
  var existing = document.getElementById('signatureModal');
  if (existing) existing.remove();

  var hiddenTextarea = document.getElementById('emailSignature');
  var currentVal = hiddenTextarea ? hiddenTextarea.value : '';

  var modal = document.createElement('div');
  modal.id = 'signatureModal';
  modal.className = 'modal';
  modal.style.display = 'flex';

  modal.innerHTML =
    '<div class="modal-content" style="width:90%;max-width:700px;height:80vh;max-height:600px;display:flex;flex-direction:column;padding:0;overflow:hidden;text-align:left;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:2px solid #8b5a2b;flex-shrink:0;">' +
        '<h3 style="margin:0;color:#4a2c2a;">✍️ Email Signature</h3>' +
        '<div style="display:flex;gap:8px;">' +
          '<button type="button" class="standard-button" onclick="closeSignatureModal(true)">✅ Done</button>' +
          '<button type="button" class="standard-button" onclick="closeSignatureModal(false)" style="background:#a0522d;color:#fdf5e6;">✕ Cancel</button>' +
        '</div>' +
      '</div>' +
      '<div style="flex:1;display:flex;flex-direction:column;overflow:hidden;padding:12px 16px;">' +
        '<p style="margin:0 0 6px;font-size:0.8em;opacity:0.6;">Markdown supported. Ctrl+B bold · Ctrl+I italic · Ctrl+K link</p>' +
        '<textarea id="signatureModalTextarea" style="flex:1;width:100%;box-sizing:border-box;font-family:Lora,Georgia,serif;font-size:14px;line-height:1.6;padding:10px;border:1px solid #8b5a2b;border-radius:5px;resize:none;background:#f5e6cc;" placeholder="Your email signature..."></textarea>' +
        '<div style="border-top:1px solid rgba(139,90,43,0.3);margin-top:8px;padding-top:6px;flex-shrink:0;">' +
          '<strong style="font-size:0.85em;color:#5a4a3a;">Preview</strong>' +
        '</div>' +
        '<div id="signatureModalPreview" style="flex:1;overflow-y:auto;padding:10px;background:rgba(139,90,43,0.04);border:1px solid rgba(139,90,43,0.15);border-radius:5px;font-family:Lora,Georgia,serif;font-size:14px;line-height:1.6;min-height:60px;text-align:left;"></div>' +
      '</div>' +
    '</div>';

  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeSignatureModal(false);
  });

  document.body.appendChild(modal);

  var textarea = document.getElementById('signatureModalTextarea');
  if (textarea) textarea.value = currentVal;

  var preview = document.getElementById('signatureModalPreview');
  var debounceTimer = null;

  function updatePreview() {
    var raw = textarea ? textarea.value : '';
    if (!raw.trim()) {
      preview.innerHTML = '<em style="opacity:0.5;">Empty</em>';
    } else if (typeof marked !== 'undefined' && marked.parse) {
      preview.innerHTML = marked.parse(raw, { breaks: true });
    } else {
      preview.textContent = raw;
    }
  }

  if (textarea) {
    textarea.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updatePreview, 500);
    });
    textarea.addEventListener('keydown', function(e) {
      if (!e.ctrlKey && !e.metaKey) return;
      var key = e.key.toLowerCase();
      if (key !== 'b' && key !== 'i' && key !== 'k') return;
      e.preventDefault();
      _applyMarkdownShortcut(textarea, key);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updatePreview, 300);
    });
    textarea.focus();
  }

  updatePreview();

  function _sigModalEsc(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSignatureModal(false);
      document.removeEventListener('keydown', _sigModalEsc, true);
    }
  }
  document.addEventListener('keydown', _sigModalEsc, true);
  modal._escHandler = _sigModalEsc;
}

/** Close the signature modal */
function closeSignatureModal(save) {
  var modal = document.getElementById('signatureModal');
  if (!modal) return;
  if (modal._escHandler) document.removeEventListener('keydown', modal._escHandler, true);
  if (save) {
    var modalTextarea = document.getElementById('signatureModalTextarea');
    var hiddenTextarea = document.getElementById('emailSignature');
    if (modalTextarea && hiddenTextarea) {
      hiddenTextarea.value = modalTextarea.value;
      _updateSignatureInlinePreview();
      setSaveButtonUnsaved();
    }
  }
  modal.remove();
}

/** Update the inline preview snippet on the settings page */
function _updateSignatureInlinePreview() {
  var hiddenTextarea = document.getElementById('emailSignature');
  var inlinePreview = document.getElementById('emailSignatureInlinePreview');
  if (!inlinePreview) return;
  var val = hiddenTextarea ? hiddenTextarea.value.trim() : '';
  if (!val) {
    inlinePreview.innerHTML = '<em style="opacity:0.5;">No signature set</em>';
  } else if (typeof marked !== 'undefined' && marked.parse) {
    inlinePreview.innerHTML = marked.parse(val, { breaks: true });
  } else {
    inlinePreview.textContent = val;
  }
}

/** Escape text for textarea insertion */
function _escapeHtmlForTextarea(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Apply a markdown shortcut (bold/italic/link) to a textarea */
function _applyMarkdownShortcut(textarea, key) {
  var start = textarea.selectionStart;
  var end = textarea.selectionEnd;
  var text = textarea.value;
  var selected = text.substring(start, end);

  if (key === 'b') {
    var replacement = '**' + (selected || 'bold text') + '**';
    textarea.value = text.substring(0, start) + replacement + text.substring(end);
    if (selected) { textarea.selectionStart = start; textarea.selectionEnd = start + replacement.length; }
    else { textarea.selectionStart = start + 2; textarea.selectionEnd = start + 2 + 'bold text'.length; }
  } else if (key === 'i') {
    var replacement = '*' + (selected || 'italic text') + '*';
    textarea.value = text.substring(0, start) + replacement + text.substring(end);
    if (selected) { textarea.selectionStart = start; textarea.selectionEnd = start + replacement.length; }
    else { textarea.selectionStart = start + 1; textarea.selectionEnd = start + 1 + 'italic text'.length; }
  } else if (key === 'k') {
    var isUrl = selected && /^https?:\/\//i.test(selected.trim());
    if (isUrl) {
      var replacement = '[link text](' + selected.trim() + ')';
      textarea.value = text.substring(0, start) + replacement + text.substring(end);
      textarea.selectionStart = start + 1; textarea.selectionEnd = start + 1 + 'link text'.length;
    } else {
      var linkText = selected || 'link text';
      var replacement = '[' + linkText + '](url)';
      textarea.value = text.substring(0, start) + replacement + text.substring(end);
      var urlStart = start + 1 + linkText.length + 2;
      textarea.selectionStart = urlStart; textarea.selectionEnd = urlStart + 3;
    }
  }
  textarea.focus();
}

/** Backfill — first estimate, then confirm, then sync */
async function emailBackfill() {
  var resultSpan = document.getElementById('emailBackfillResult');
  var btn = document.getElementById('emailBackfillBtn');
  if (resultSpan) { resultSpan.textContent = '⏳ Estimating...'; resultSpan.style.color = '#8b5a2b'; }
  if (btn) btn.disabled = true;

  try {
    var estResp = await fetch('/api/email/backfill-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    var estData = await estResp.json();
    if (!estResp.ok) {
      var errMsg = estData.detail || estData.error || 'Estimation failed';
      if (resultSpan) { resultSpan.textContent = '❌ ' + errMsg; resultSpan.style.color = '#b22222'; }
      if (btn) btn.disabled = false;
      return;
    }

    var count = estData.message_count || 0;
    var sizeMb = estData.estimated_mb || 0;
    if (resultSpan) resultSpan.textContent = '';
    if (btn) btn.disabled = false;

    var confirmMsg = 'Backfill will fetch approximately ' + count + ' messages (~' + sizeMb.toFixed(1) + ' MB).\n\nThis may take a while. Continue?';
    var confirmed = await cwocConfirm(confirmMsg, { title: 'Email Backfill', confirmLabel: '📥 Continue' });
    if (!confirmed) {
      if (resultSpan) { resultSpan.textContent = 'Cancelled'; resultSpan.style.color = '#8b5a2b'; }
      return;
    }

    if (resultSpan) { resultSpan.textContent = '⏳ Syncing...'; resultSpan.style.color = '#8b5a2b'; }
    if (btn) btn.disabled = true;

    var syncResp = await fetch('/api/email/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backfill: true }),
    });
    var syncData = await syncResp.json();
    if (syncResp.ok) {
      var newCount = syncData.new_count || 0;
      var delCount = syncData.deleted_count || 0;
      var parts = [];
      if (newCount > 0) parts.push(newCount + ' imported');
      if (delCount > 0) parts.push(delCount + ' removed');
      var msg = parts.length ? parts.join(', ') : 'No new emails';
      if (resultSpan) { resultSpan.textContent = '✅ ' + msg; resultSpan.style.color = '#1a7a4c'; }
    } else {
      var syncErr = syncData.detail || syncData.error || 'Sync failed';
      if (resultSpan) { resultSpan.textContent = '❌ ' + syncErr; resultSpan.style.color = '#b22222'; }
    }
  } catch (e) {
    console.error('Backfill error:', e);
    if (resultSpan) { resultSpan.textContent = '❌ Network error'; resultSpan.style.color = '#b22222'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}
