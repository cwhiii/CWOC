/**
 * editor-email-pgp.js — PGP encryption for outgoing emails
 *
 * Provides client-side PGP encryption using OpenPGP.js. When a recipient
 * has a PGP public key stored in their contact record, the user can toggle
 * PGP encryption on. The message body is encrypted in the browser before
 * being sent, so plaintext never leaves the client unencrypted.
 *
 * Depends on: openpgp.min.js (CDN), editor-email.js (_emailContactsCache,
 *             _emailGetFieldValue, _emailCurrentChit),
 *             shared-utils.js (cwocToast)
 */

/* ── PGP State ────────────────────────────────────────────────────────────── */

/** Whether PGP encryption is currently enabled for this draft */
var _pgpEnabled = false;

/** Map of recipient email → PGP public key (populated from contacts) */
var _pgpRecipientKeys = {};

/* ── PGP Toggle ───────────────────────────────────────────────────────────── */

/**
 * Toggle PGP encryption on/off for the current draft.
 * Only allows enabling if all recipients have PGP keys on file.
 */
function _emailTogglePgp() {
  if (_pgpEnabled) {
    // Turning off
    _pgpEnabled = false;
    _updatePgpButtonState();
    cwocToast('PGP encryption disabled.', 'info');
    return;
  }

  // Turning on — check that all recipients have PGP keys
  var toEl = document.getElementById('emailTo');
  var toVal = _emailGetFieldValue(toEl);
  if (!toVal) {
    cwocToast('Add recipients first before enabling PGP.', 'error');
    return;
  }

  var recipients = _pgpExtractEmails(toVal);
  if (recipients.length === 0) {
    cwocToast('No valid recipients to encrypt for.', 'error');
    return;
  }

  // Check each recipient for a PGP key
  var missing = [];
  _pgpRecipientKeys = {};

  recipients.forEach(function(addr) {
    var key = _pgpFindKeyForEmail(addr);
    if (key) {
      _pgpRecipientKeys[addr] = key;
    } else {
      missing.push(addr);
    }
  });

  if (missing.length > 0) {
    cwocToast('Cannot enable PGP: no key on file for ' + missing.join(', '), 'error');
    _pgpRecipientKeys = {};
    return;
  }

  // Check that openpgp is loaded
  if (typeof openpgp === 'undefined') {
    cwocToast('PGP library not loaded. Check your connection.', 'error');
    return;
  }

  _pgpEnabled = true;
  _updatePgpButtonState();
  cwocToast('PGP encryption enabled. Message will be encrypted before sending.', 'success');
}

/**
 * Update the PGP button visual state (active/inactive).
 */
function _updatePgpButtonState() {
  var btn = document.getElementById('emailPgpBtn');
  if (!btn) return;

  if (_pgpEnabled) {
    btn.classList.add('zone-button-active');
    btn.title = 'PGP encryption ON — click to disable';
    btn.innerHTML = '<i class="fas fa-lock"></i><span class="hideWhenNarrow"> PGP ✓</span>';
  } else {
    btn.classList.remove('zone-button-active');
    btn.title = 'Encrypt with PGP';
    btn.innerHTML = '<i class="fas fa-lock-open"></i><span class="hideWhenNarrow"> PGP</span>';
  }
}

/**
 * Check if PGP encryption is available for the current recipients.
 * Shows/hides the PGP button accordingly. Called when recipients change.
 */
function _pgpCheckAvailability() {
  var btn = document.getElementById('emailPgpBtn');
  if (!btn) return;

  // Only show for drafts
  if (!_emailCurrentChit || _emailCurrentChit.email_status !== 'draft') {
    btn.style.display = 'none';
    return;
  }

  var toEl = document.getElementById('emailTo');
  var toVal = _emailGetFieldValue(toEl);
  if (!toVal) {
    btn.style.display = 'none';
    _pgpEnabled = false;
    _updatePgpButtonState();
    return;
  }

  var recipients = _pgpExtractEmails(toVal);
  if (recipients.length === 0) {
    btn.style.display = 'none';
    _pgpEnabled = false;
    _updatePgpButtonState();
    return;
  }

  // Check if ANY recipient has a PGP key — show button if so
  var anyHasKey = recipients.some(function(addr) {
    return !!_pgpFindKeyForEmail(addr);
  });

  btn.style.display = anyHasKey ? '' : 'none';

  // If PGP was enabled but recipients changed, re-validate
  if (_pgpEnabled) {
    var allHaveKeys = recipients.every(function(addr) {
      return !!_pgpFindKeyForEmail(addr);
    });
    if (!allHaveKeys) {
      _pgpEnabled = false;
      _updatePgpButtonState();
      cwocToast('PGP disabled: not all recipients have keys.', 'info');
    }
  }
}

/* ── PGP Encryption ───────────────────────────────────────────────────────── */

/**
 * Encrypt the email body text with recipients' PGP public keys.
 * Returns the ASCII-armored encrypted message.
 *
 * @param {string} plaintext — the message body to encrypt
 * @returns {Promise<string>} — the PGP-encrypted ASCII armor text
 */
async function _pgpEncryptBody(plaintext) {
  if (typeof openpgp === 'undefined') {
    throw new Error('OpenPGP.js library not loaded.');
  }

  // Collect all recipient public keys
  var publicKeys = [];
  var keyErrors = [];

  for (var addr in _pgpRecipientKeys) {
    try {
      var keyArmor = _pgpRecipientKeys[addr];
      var key = await openpgp.readKey({ armoredKey: keyArmor });
      publicKeys.push(key);
    } catch (e) {
      keyErrors.push(addr + ': ' + e.message);
    }
  }

  if (keyErrors.length > 0) {
    throw new Error('Invalid PGP key(s): ' + keyErrors.join('; '));
  }

  if (publicKeys.length === 0) {
    throw new Error('No valid PGP keys found for recipients.');
  }

  // Encrypt the message
  var encrypted = await openpgp.encrypt({
    message: await openpgp.createMessage({ text: plaintext }),
    encryptionKeys: publicKeys
  });

  return encrypted;
}

/**
 * Intercept the email send flow to encrypt the body if PGP is enabled.
 * This wraps the normal _emailSend function.
 *
 * Called from the patched _emailSend. If PGP is enabled, encrypts the body
 * in the textarea before saving, then proceeds with the normal send flow.
 *
 * @returns {Promise<boolean>} — true if encryption succeeded (or not needed), false on failure
 */
async function _pgpPreSendEncrypt() {
  if (!_pgpEnabled) return true;

  var bodyEl = document.getElementById('emailBody');
  if (!bodyEl) return true;

  var plaintext = bodyEl.value.trim();
  if (!plaintext) {
    cwocToast('Cannot encrypt an empty message.', 'error');
    return false;
  }

  // Re-validate recipient keys (in case recipients changed)
  var toEl = document.getElementById('emailTo');
  var toVal = _emailGetFieldValue(toEl);
  var recipients = _pgpExtractEmails(toVal);

  _pgpRecipientKeys = {};
  var missing = [];
  recipients.forEach(function(addr) {
    var key = _pgpFindKeyForEmail(addr);
    if (key) {
      _pgpRecipientKeys[addr] = key;
    } else {
      missing.push(addr);
    }
  });

  if (missing.length > 0) {
    cwocToast('PGP send failed: no key for ' + missing.join(', '), 'error');
    return false;
  }

  try {
    cwocToast('Encrypting message with PGP...', 'info');
    var encrypted = await _pgpEncryptBody(plaintext);

    // Replace the body with the encrypted text
    bodyEl.value = encrypted;

    // Mark that this email was PGP encrypted (for display purposes)
    if (_emailCurrentChit) {
      _emailCurrentChit._pgpEncrypted = true;
    }

    return true;
  } catch (e) {
    console.error('[PGP] Encryption failed:', e);
    cwocToast('PGP encryption failed: ' + e.message, 'error');
    // Restore original body (it wasn't changed on error)
    return false;
  }
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/**
 * Extract plain email addresses from a comma-separated "Name <email>" string.
 * @param {string} fieldValue — e.g. "Alice <alice@x.com>, bob@y.com"
 * @returns {string[]} — e.g. ["alice@x.com", "bob@y.com"]
 */
function _pgpExtractEmails(fieldValue) {
  if (!fieldValue) return [];
  var parts = fieldValue.split(',');
  var emails = [];
  parts.forEach(function(part) {
    var trimmed = part.trim();
    if (!trimmed) return;
    // Extract email from "Name <email>" format
    var match = trimmed.match(/<([^>]+)>/);
    if (match) {
      emails.push(match[1].toLowerCase().trim());
    } else if (trimmed.indexOf('@') !== -1) {
      emails.push(trimmed.toLowerCase().trim());
    }
  });
  return emails;
}

/**
 * Look up a PGP public key for a given email address from the contacts cache.
 * @param {string} emailAddr — the email address to look up
 * @returns {string|null} — the PGP key text, or null if not found
 */
function _pgpFindKeyForEmail(emailAddr) {
  if (!_emailContactsCache || !emailAddr) return null;
  var addr = emailAddr.toLowerCase().trim();

  for (var i = 0; i < _emailContactsCache.length; i++) {
    var contact = _emailContactsCache[i];
    if (!contact.pgp_key) continue;

    // Check if this contact has the given email address
    var emails = contact.emails || [];
    for (var j = 0; j < emails.length; j++) {
      var contactEmail = (emails[j].value || '').toLowerCase().trim();
      if (contactEmail === addr) {
        return contact.pgp_key;
      }
    }
  }
  return null;
}

/**
 * Initialize PGP UI hooks — wire up recipient change detection.
 * Called from initEmailZone when the email zone is populated.
 */
function _pgpInitForDraft() {
  _pgpEnabled = false;
  _pgpRecipientKeys = {};
  _updatePgpButtonState();

  // Check availability based on current recipients
  // Delay slightly to let chips render
  setTimeout(_pgpCheckAvailability, 300);

  // Watch for recipient changes (chip add/remove, input changes)
  var toEl = document.getElementById('emailTo');
  if (toEl && !toEl._pgpWired) {
    toEl._pgpWired = true;

    // Use MutationObserver on the chip container to detect chip add/remove
    var container = toEl.closest('.email-autocomplete-wrap');
    if (container) {
      var observer = new MutationObserver(function() {
        setTimeout(_pgpCheckAvailability, 100);
      });
      observer.observe(container, { childList: true, subtree: true });
    }

    // Also listen for input changes (manual typing)
    toEl.addEventListener('change', function() {
      setTimeout(_pgpCheckAvailability, 100);
    });
  }
}


/* ── PGP Decryption (incoming messages) ───────────────────────────────────── */

/**
 * Prompt for password, fetch private PGP key, decrypt the email body in-place.
 * Does NOT save the decrypted content — display only.
 */
function _pgpDecryptInPlace() {
  if (typeof openpgp === 'undefined') {
    cwocToast('PGP library not loaded. Check your connection.', 'error');
    return;
  }

  // Show password modal
  _pgpShowPasswordModal(function(password) {
    _pgpPerformDecrypt(password);
  });
}

/**
 * Show a parchment-themed password modal for PGP decryption.
 * @param {function} onConfirm — called with the entered password string
 */
function _pgpShowPasswordModal(onConfirm) {
  // Remove any existing modal
  var existing = document.getElementById('pgp-decrypt-modal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'pgp-decrypt-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

  var box = document.createElement('div');
  box.style.cssText = 'background:#fffaf0;border:2px solid #6b4e31;border-radius:8px;padding:20px 28px;max-width:380px;width:90%;font-family:Lora,Georgia,serif;color:#2b1e0f;box-shadow:0 4px 16px rgba(0,0,0,0.3);';

  var h3 = document.createElement('h3');
  h3.style.cssText = 'margin:0 0 12px;font-size:1.1em;color:#4a2c2a;text-align:center;';
  h3.innerHTML = '<i class="fas fa-key"></i> Decrypt PGP Message';
  box.appendChild(h3);

  var p = document.createElement('p');
  p.style.cssText = 'margin:0 0 14px;font-size:0.9em;line-height:1.4;text-align:center;';
  p.textContent = 'Enter your account password to unlock your private PGP key.';
  box.appendChild(p);

  var input = document.createElement('input');
  input.type = 'password';
  input.placeholder = 'Password';
  input.autocomplete = 'current-password';
  input.style.cssText = 'width:100%;padding:8px 10px;font-family:inherit;font-size:1em;border:1px solid #8b5a2b;border-radius:4px;box-sizing:border-box;margin-bottom:16px;';
  box.appendChild(input);

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'standard-button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding:8px 18px;font-family:inherit;cursor:pointer;';
  cancelBtn.onclick = function() { overlay.remove(); };

  var confirmBtn = document.createElement('button');
  confirmBtn.className = 'standard-button';
  confirmBtn.textContent = 'Decrypt';
  confirmBtn.style.cssText = 'padding:8px 18px;font-family:inherit;cursor:pointer;background:#2e7d32;color:#fff;border-color:#1b5e20;';
  confirmBtn.onclick = function() {
    var pw = input.value;
    if (!pw) {
      input.style.borderColor = '#b22222';
      input.focus();
      return;
    }
    overlay.remove();
    onConfirm(pw);
  };

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Focus the input
  setTimeout(function() { input.focus(); }, 50);

  // ESC to close
  var onKey = function(e) {
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
    }
  };
  document.addEventListener('keydown', onKey, true);

  // Enter to confirm
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmBtn.click();
    }
  });
}

/**
 * Perform the actual PGP decryption after password is provided.
 * Fetches the private key from the server, decrypts the message body,
 * and replaces the displayed content in-place (no save).
 *
 * @param {string} password — the user's account password
 */
async function _pgpPerformDecrypt(password) {
  var bodyEl = document.getElementById('emailBody');
  var renderedEl = document.getElementById('emailBodyRendered');
  if (!bodyEl) return;

  var ciphertext = bodyEl.value.trim();
  if (!ciphertext.startsWith('-----BEGIN PGP MESSAGE-----')) {
    cwocToast('No PGP-encrypted content found.', 'error');
    return;
  }

  cwocToast('Fetching private key...', 'info');

  // Step 1: Fetch the private PGP key (requires password verification)
  var keyResponse;
  try {
    keyResponse = await fetch('/api/auth/private-pgp-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    });
  } catch (e) {
    console.error('[PGP Decrypt] Network error fetching key:', e);
    cwocToast('Network error. Could not reach server.', 'error');
    return;
  }

  if (keyResponse.status === 403) {
    cwocToast('Incorrect password.', 'error');
    return;
  }
  if (!keyResponse.ok) {
    var errData = {};
    try { errData = await keyResponse.json(); } catch(e) {}
    cwocToast('Failed to retrieve key: ' + (errData.detail || 'Unknown error'), 'error');
    return;
  }

  var keyData = await keyResponse.json();
  var privateKeyArmor = keyData.private_pgp_key;
  if (!privateKeyArmor) {
    cwocToast('No private PGP key configured. Add one in Settings → Security.', 'error');
    return;
  }

  // Step 2: Decrypt the message using openpgp.js
  cwocToast('Decrypting message...', 'info');

  try {
    // Read the private key (may require a passphrase on the key itself)
    var privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmor });

    // If the key is encrypted with a passphrase, try decrypting with the account password
    if (!privateKey.isDecrypted()) {
      try {
        privateKey = await openpgp.decryptKey({
          privateKey: privateKey,
          passphrase: password
        });
      } catch (e) {
        console.error('[PGP Decrypt] Key passphrase error:', e);
        cwocToast('Could not unlock PGP key. Key passphrase may differ from account password.', 'error');
        return;
      }
    }

    // Read the encrypted message
    var message = await openpgp.readMessage({ armoredMessage: ciphertext });

    // Decrypt
    var decrypted = await openpgp.decrypt({
      message: message,
      decryptionKeys: privateKey
    });

    var plaintext = decrypted.data;

    // Step 3: Display decrypted content in-place (no save)
    bodyEl.value = plaintext;

    // If the rendered view is visible, update it too
    if (renderedEl && renderedEl.style.display !== 'none') {
      if (typeof marked !== 'undefined') {
        renderedEl.innerHTML = DOMPurify.sanitize(marked.parse(plaintext));
      } else {
        renderedEl.textContent = plaintext;
      }
    }

    // Update the banner to show decrypted state
    var banner = document.querySelector('.email-pgp-banner');
    if (banner) {
      banner.innerHTML = '<i class="fas fa-unlock" style="color:#2e7d32;"></i> Message decrypted (view only — not saved).';
      banner.style.background = 'rgba(46, 125, 50, 0.08)';
      banner.style.borderColor = 'rgba(46, 125, 50, 0.25)';
    }

    // Prevent the decrypted text from being saved — mark the email body
    // as read-only and set a flag so getEmailData() returns the original
    // encrypted text instead of the decrypted plaintext.
    bodyEl.readOnly = true;
    bodyEl.dataset.pgpDecrypted = 'true';
    bodyEl.dataset.pgpOriginal = ciphertext;

    // Also disable the input event listener from triggering dirty state
    // (setting .value programmatically doesn't fire input events anyway,
    // but this guards against accidental edits in the read-only field)

    cwocToast('Message decrypted successfully.', 'success');

  } catch (e) {
    console.error('[PGP Decrypt] Decryption failed:', e);
    cwocToast('Decryption failed: ' + e.message, 'error');
  }
}
