/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Contact QR Sharing — Reusable vCard + QR Code Generation
   
   Provides:
     - generateContactVCard(contact) → vCard 3.0 string
     - showContactQrCode(contact, modalId, titleId, canvasId) → displays QR
   
   Requires: qrcode-generator CDN loaded before this script.
   Used by: people.js (Task 7.3), contact-editor.js (Task 8.2)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Build a vCard 3.0 string from a contact object (client-side).
 * Mirrors the backend vcard_print() output format.
 * @param {Object} contact — contact object from the API
 * @returns {string} vCard 3.0 string
 */
function generateContactVCard(contact) {
    var lines = [];
    lines.push('BEGIN:VCARD');
    lines.push('VERSION:3.0');

    // N property
    var surname = contact.surname || '';
    var givenName = contact.given_name || '';
    var middleNames = contact.middle_names || '';
    var prefix = contact.prefix || '';
    var suffix = contact.suffix || '';
    lines.push('N:' + surname + ';' + givenName + ';' + middleNames + ';' + prefix + ';' + suffix);

    // FN property
    var displayName = contact.display_name || '';
    if (!displayName) {
        displayName = [prefix, givenName, middleNames, surname, suffix]
            .filter(function (p) { return p; })
            .join(' ');
    }
    if (displayName) {
        lines.push('FN:' + displayName);
    }

    // Multi-value helper
    function addMulti(prop, entries) {
        if (!entries || !entries.length) return;
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            var lbl = entry.label || '';
            var val = entry.value || '';
            if (!val) continue;
            if (lbl) {
                lines.push(prop + ';TYPE=' + lbl + ':' + val);
            } else {
                lines.push(prop + ':' + val);
            }
        }
    }

    addMulti('TEL', contact.phones);
    addMulti('EMAIL', contact.emails);

    // ADR — put full address in street field
    if (contact.addresses && contact.addresses.length) {
        for (var i = 0; i < contact.addresses.length; i++) {
            var entry = contact.addresses[i];
            var lbl = entry.label || '';
            var val = entry.value || '';
            if (!val) continue;
            var adrValue = ';;' + val + ';;;;';
            if (lbl) {
                lines.push('ADR;TYPE=' + lbl + ':' + adrValue);
            } else {
                lines.push('ADR:' + adrValue);
            }
        }
    }

    addMulti('URL', contact.websites);

    // X-SIGNAL
    if (contact.has_signal) {
        lines.push('X-SIGNAL:true');
    }

    // X-PGP-KEY
    if (contact.pgp_key) {
        lines.push('X-PGP-KEY:' + contact.pgp_key);
    }

    addMulti('X-CALLSIGN', contact.call_signs);
    addMulti('X-XHANDLE', contact.x_handles);

    // X-FAVORITE
    if (contact.favorite) {
        lines.push('X-FAVORITE:true');
    }

    // Standard vCard fields for org and nickname
    if (contact.organization) {
        lines.push('ORG:' + contact.organization);
    }
    if (contact.nickname) {
        lines.push('NICKNAME:' + contact.nickname);
    }

    // NOTE — remaining non-standard fields using vCard escaped newline (\n literal)
    var extraNotes = [];
    if (contact.social_context) extraNotes.push('Social Context: ' + contact.social_context);
    if (contact.signal_username) extraNotes.push('Signal: ' + contact.signal_username);
    if (contact.color) extraNotes.push('Color: ' + contact.color);
    if (extraNotes.length > 0) {
        lines.push('NOTE:' + extraNotes.join('\\n'));
    }

    lines.push('END:VCARD');
    return lines.join('\r\n');
}

// Maximum QR code byte capacity at error correction level L (alphanumeric)
var _QR_MAX_BYTES = 2953;

/**
 * Show a QR code for a contact in a modal overlay.
 * @param {Object} contact — contact object from the API
 * @param {string} [modalId='qr-modal'] — modal element ID
/**
 * Show a QR code for a contact using the shared showQRModal.
 * @param {Object} contact — contact object from the API
 */
function showContactQrCode(contact) {
    var name = contact.display_name || contact.given_name || 'Contact';

    // Generate vCard string
    var vcardStr = generateContactVCard(contact);

    // Check byte length (UTF-8)
    var byteLength = new Blob([vcardStr]).size;

    if (byteLength > _QR_MAX_BYTES) {
        // Too large — show error via the shared modal
        if (typeof showQRModal === 'function') {
            var overlay = showQRModal({
                title: 'Share: ' + name,
                data: 'TOO_LARGE', // will fail gracefully
                info: 'Contact data too large for QR (' + byteLength + ' bytes). Use Export instead.',
            });
        } else {
            alert('Contact data too large for QR code. Use Export instead.');
        }
        return;
    }

    // Use the shared QR modal
    if (typeof showQRModal === 'function') {
        showQRModal({
            title: 'Share: ' + name,
            data: vcardStr,
            ecl: 'L',
            info: name + ' — vCard (' + byteLength + ' bytes)',
        });
    }
}
