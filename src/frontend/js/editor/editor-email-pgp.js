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
