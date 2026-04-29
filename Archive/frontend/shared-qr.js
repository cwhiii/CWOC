/**
 * shared-qr.js — QR code display modal.
 *
 * Provides showQRModal() — the single source of truth for all QR code
 * display across the app. Renders a QR code in a full-screen modal overlay
 * using the qrcode.js library (loaded via CDN).
 *
 * No dependencies on other shared sub-scripts.
 */

// ── Shared QR Code Display ────────────────────────────────────────────────────

/**
 * Show a QR code in a full-screen modal overlay.
 * Single source of truth for ALL QR display across the app.
 *
 * @param {object} opts
 * @param {string} opts.title   — modal title text (e.g. "🔗 Link QR Code")
 * @param {string} opts.data    — the string to encode in the QR
 * @param {string} [opts.info]  — small info text below the QR (e.g. URL or byte count)
 * @param {string} [opts.ecl]   — error correction level: 'L','M','Q','H' (default 'M')
 * @param {Function} [opts.onClose] — callback when modal closes
 * @returns {HTMLElement} the overlay element (for further customization)
 */
function showQRModal(opts) {
  // Remove any existing QR modal
  var existing = document.getElementById('cwoc-qr-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'cwoc-qr-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fff8e1;border:2px solid #8b4513;border-radius:10px;padding:20px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4);width:100%;max-width:360px;box-sizing:border-box;max-height:90vh;overflow-y:auto;';

  // Title
  var titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight:bold;margin-bottom:12px;color:#4a2c2a;font-size:1.05em;word-wrap:break-word;';
  titleEl.textContent = opts.title || 'QR Code';
  modal.appendChild(titleEl);

  // QR render area
  var qrDiv = document.createElement('div');
  qrDiv.style.cssText = 'margin:12px auto;display:flex;justify-content:center;';

  if (typeof qrcode !== 'undefined') {
    try {
      var ecl = opts.ecl || 'M';
      var qr = qrcode(0, ecl);
      qr.addData(opts.data);
      qr.make();
      // Size the QR to fit the modal (max ~280px)
      var moduleCount = qr.getModuleCount();
      var maxSize = Math.min(280, window.innerWidth - 80);
      var cellSize = Math.max(2, Math.floor(maxSize / moduleCount));
      qrDiv.innerHTML = qr.createImgTag(cellSize, 4);
      // Ensure the image is responsive
      var img = qrDiv.querySelector('img');
      if (img) img.style.cssText = 'max-width:100%;height:auto;display:block;';
    } catch (err) {
      qrDiv.innerHTML = '<div style="padding:12px;color:#a33;font-size:0.85em;">Data too large for QR code.</div>';
    }
  } else {
    qrDiv.innerHTML = '<div style="padding:12px;opacity:0.6;">QR library not loaded.</div>';
  }
  modal.appendChild(qrDiv);

  // Info text
  if (opts.info) {
    var infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'font-size:0.75em;opacity:0.5;margin-top:4px;word-break:break-all;max-width:100%;';
    infoDiv.textContent = opts.info;
    modal.appendChild(infoDiv);
  }

  // Close button
  var closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'margin-top:14px;padding:10px 24px;width:100%;min-height:44px;font-size:1em;font-weight:bold;font-family:"Courier New",monospace;background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:4px;cursor:pointer;';
  closeBtn.textContent = '✕ Close';
  closeBtn.addEventListener('click', function () { _closeQR(); });
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);

  // Click backdrop to close
  overlay.addEventListener('click', function (e) { if (e.target === overlay) _closeQR(); });

  // ESC to close (capture phase so it fires before other ESC handlers)
  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      _closeQR();
    }
  }
  document.addEventListener('keydown', onKey, true);

  function _closeQR() {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    if (opts.onClose) opts.onClose();
  }

  document.body.appendChild(overlay);
  return overlay;
}


