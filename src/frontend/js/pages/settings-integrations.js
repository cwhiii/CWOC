// ── Settings: Network Access, Ntfy, Tailscale, Home Assistant ────────────────
// All integration-related settings: Tailscale VPN, Ntfy push notifications,
// Home Assistant, PWA install, SSL cert download.
// Extracted from settings.js for modularity.

// ── Phone Notification Testing (via Ntfy) ────────────────────────────────────

/**
 * Send a test notification to the user's phone via the Ntfy server.
 */
async function _testNtfyFromInstallSection() {
  var statusEl = document.getElementById('pwa-notif-status');
  if (statusEl) statusEl.textContent = '⏳ Sending test notification...';

  try {
    var res = await fetch('/api/network-access/ntfy/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    var result = await res.json();

    if (result.success) {
      if (statusEl) statusEl.textContent = '✅ Notification sent to topic "' + result.topic + '". Check your Ntfy app!';
    } else {
      if (statusEl) statusEl.textContent = '❌ ' + (result.error || 'Could not send. Check that Ntfy is enabled in Network Access.');
    }
  } catch (e) {
    console.error('[Settings] Ntfy test failed:', e);
    if (statusEl) statusEl.textContent = '❌ Error: ' + e.message;
  }
}

// ── SSL Certificate Download ─────────────────────────────────────────────────

/**
 * Open the current CWOC URL in Chrome via an Android intent URL.
 */
function _openInChromeForInstall() {
  var url = window.location.origin + '/';
  var stripped = url.replace(/^https?:\/\//, '');
  var scheme = window.location.protocol === 'https:' ? 'https' : 'http';
  var intentUrl = 'intent://' + stripped + '#Intent;scheme=' + scheme +
    ';package=com.android.chrome;end';
  window.location.href = intentUrl;
}

/**
 * Show the "Open in Chrome" button on Firefox Android.
 */
function _initPwaInstallSection() {
  var isAndroid = /Android/i.test(navigator.userAgent);
  var isFirefox = /Firefox/i.test(navigator.userAgent);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  if (isStandalone) {
    var section = document.getElementById('pwa-cert-section');
    if (section) {
      var h3 = section.querySelector('h3');
      if (h3) h3.insertAdjacentHTML('afterend',
        '<p class="setting-hint" style="color:#2d6a2e;font-weight:bold;">✅ CWOC is installed as an app.</p>');
    }
    return;
  }

  if (isAndroid && isFirefox) {
    var chromeBtn = document.getElementById('pwa-open-in-chrome');
    if (chromeBtn) chromeBtn.style.display = '';
    var chromeHint = document.getElementById('pwa-chrome-hint');
    if (chromeHint) chromeHint.style.display = '';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  _initPwaInstallSection();
});

async function _downloadSslCert() {
  try {
    const res = await fetch('/api/ssl-cert');
    if (res.status === 404) {
      cwocToast('No SSL certificate found on this server. The server may not be using HTTPS.', 'info');
      return;
    }
    if (!res.ok) {
      cwocToast('Failed to download certificate: ' + res.status, 'error');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cwoc-server.crt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('[Settings] SSL cert download failed:', e);
    cwocToast('Failed to download certificate. Check the console for details.', 'error');
  }
}

// ── Network Access: Tailscale ────────────────────────────────────────────────

var _tsSavedAuthKey = '';
var _tsSavedEnabled = false;

/**
 * Show an inline feedback message inside the Network Access block.
 */
function _tsFeedback(message, type) {
  type = type || 'success';
  var el = document.getElementById('tailscale-feedback');
  if (!el) return;

  var colors = {
    success: { bg: 'rgba(45,90,30,0.12)', border: '#2d5a1e', text: '#1e3f14', icon: '✅' },
    error:   { bg: 'rgba(139,26,26,0.12)', border: '#8b1a1a', text: '#5c1010', icon: '❌' },
    warning: { bg: 'rgba(184,134,11,0.12)', border: '#b8860b', text: '#6b4f00', icon: '⚠️' },
    info:    { bg: 'rgba(74,44,42,0.10)', border: '#4a2c2a', text: '#2b1e0f', icon: 'ℹ️' }
  };
  var c = colors[type] || colors.info;

  el.style.display = '';
  el.style.background = c.bg;
  el.style.border = '1px solid ' + c.border;
  el.style.color = c.text;
  el.textContent = c.icon + '  ' + message;

  el.style.opacity = '0';
  requestAnimationFrame(function () {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '1';
  });
}

function toggleTailscaleEnabled() {
  var body = document.getElementById('tailscale-config-body');
  if (!body) return;

  var isVisible = body.style.display !== 'none';
  body.style.display = isVisible ? 'none' : '';

  var checkbox = document.getElementById('tailscale-enabled');
  if (checkbox) checkbox.checked = !isVisible;

  if (!isVisible) {
    refreshTailscaleStatus();
  }
}

function _tsUpdateHeaderIcon(status) {
  var icon = document.getElementById('tailscale-header-icon');
  if (!icon) return;

  switch (status) {
    case 'active':        icon.textContent = '🟢'; break;
    case 'installed_inactive': icon.textContent = '🟡'; break;
    case 'not_installed': icon.textContent = '⚪'; break;
    case 'error':         icon.textContent = '🔴'; break;
    default:              icon.textContent = '⚪'; break;
  }
}

async function _tsQuickStatusForIcon() {
  try {
    var response = await fetch('/api/network-access/tailscale/status');
    if (!response.ok) return;
    var data = await response.json();
    _tsUpdateHeaderIcon(data.status);
  } catch (e) {
    // Silently ignore
  }
}

function _tsApplyEnabledState() {
  var checkbox = document.getElementById('tailscale-enabled');
  var body = document.getElementById('tailscale-config-body');
  if (!checkbox || !body) return;

  if (checkbox.checked) {
    body.style.display = '';
    refreshTailscaleStatus();
  } else {
    body.style.display = 'none';
  }
}

function _tsUpdateSaveButton() {
  var authKeyInput = document.getElementById('tailscale-auth-key');
  var enabledCheckbox = document.getElementById('tailscale-enabled');
  var saveBtn = document.getElementById('tailscale-save-btn');
  if (!saveBtn) return;

  var currentKey = authKeyInput ? authKeyInput.value : '';
  var currentEnabled = enabledCheckbox ? enabledCheckbox.checked : false;
  var dirty = (currentKey !== _tsSavedAuthKey) || (currentEnabled !== _tsSavedEnabled);

  saveBtn.disabled = !dirty;
  saveBtn.style.opacity = dirty ? '1' : '0.5';
}

function _tsUpdateConnectionButtons(status) {
  var upBtn = document.getElementById('tailscale-up-btn');
  var downBtn = document.getElementById('tailscale-down-btn');

  var canConnect = (status === 'installed_inactive');
  var canDisconnect = (status === 'active');

  if (upBtn) {
    upBtn.disabled = !canConnect;
    upBtn.style.opacity = canConnect ? '1' : '0.5';
  }
  if (downBtn) {
    downBtn.disabled = !canDisconnect;
    downBtn.style.opacity = canDisconnect ? '1' : '0.5';
  }
}

async function refreshTailscaleStatus() {
  var badge = document.getElementById('tailscale-status-badge');
  var infoRow = document.getElementById('tailscale-info-row');
  var errorRow = document.getElementById('tailscale-error-row');
  var errorMsg = document.getElementById('tailscale-error-msg');
  var ipSpan = document.getElementById('tailscale-ip');
  var hostnameSpan = document.getElementById('tailscale-hostname');
  var currentStatus = 'unknown';

  if (badge) badge.textContent = '⏳ Checking...';
  _tsFeedback('Checking Tailscale status...', 'info');
  var _tsCheckStart = Date.now();

  try {
    var response = await fetch('/api/network-access/tailscale/status');
    if (!response.ok) throw new Error('Status check failed');
    var data = await response.json();
    currentStatus = data.status;

    var elapsed = Date.now() - _tsCheckStart;
    if (elapsed < 1000) await new Promise(function (r) { setTimeout(r, 1000 - elapsed); });

    if (infoRow) infoRow.style.display = 'none';
    if (errorRow) errorRow.style.display = 'none';

    switch (data.status) {
      case 'not_installed':
        if (badge) badge.textContent = '⚪ Not Installed';
        _tsFeedback('Tailscale is not installed on this server.', 'info');
        break;
      case 'installed_inactive':
        if (badge) badge.textContent = '🟡 Inactive';
        if (data.message) {
          if (errorRow) errorRow.style.display = '';
          if (errorMsg) errorMsg.textContent = data.message;
        }
        _tsFeedback('Tailscale installed but not connected.', 'info');
        break;
      case 'active':
        if (badge) badge.textContent = '🟢 Connected';
        if (infoRow) infoRow.style.display = '';
        if (ipSpan) ipSpan.textContent = data.ip || '—';
        if (hostnameSpan) hostnameSpan.textContent = data.hostname || '—';
        _tsFeedback('Connected — IP: ' + (data.ip || '—'), 'success');
        break;
      case 'error':
        if (badge) badge.textContent = '🔴 Error';
        if (errorRow) errorRow.style.display = '';
        if (errorMsg) errorMsg.textContent = data.message || 'Unknown error';
        _tsFeedback('Error: ' + (data.message || 'Unknown'), 'error');
        break;
      default:
        if (badge) badge.textContent = '⚪ Unknown';
        break;
    }
  } catch (error) {
    console.error('Failed to refresh Tailscale status:', error);
    if (badge) badge.textContent = '⚠️ Unable to check status';
    if (infoRow) infoRow.style.display = 'none';
    if (errorRow) errorRow.style.display = 'none';
    _tsFeedback('Unable to check status.', 'error');
  }

  _tsUpdateConnectionButtons(currentStatus);
  _tsUpdateHeaderIcon(currentStatus);
}

async function loadTailscaleConfig() {
  try {
    var response = await fetch('/api/network-access/tailscale');
    if (!response.ok) throw new Error('Failed to load Tailscale config');
    var data = await response.json();

    var authKeyInput = document.getElementById('tailscale-auth-key');
    var enabledCheckbox = document.getElementById('tailscale-enabled');

    var key = (data.config && data.config.auth_key) || '';
    var enabled = !!data.enabled;

    if (authKeyInput) authKeyInput.value = key;
    if (enabledCheckbox) enabledCheckbox.checked = enabled;

    _tsSavedAuthKey = key;
    _tsSavedEnabled = enabled;
    _tsUpdateSaveButton();
    _tsApplyEnabledState();

    if (authKeyInput && !authKeyInput._tsListenerAdded) {
      authKeyInput.addEventListener('input', _tsUpdateSaveButton);
      authKeyInput._tsListenerAdded = true;
    }
    if (enabledCheckbox && !enabledCheckbox._tsListenerAdded) {
      enabledCheckbox.addEventListener('change', _tsUpdateSaveButton);
      enabledCheckbox._tsListenerAdded = true;
    }
  } catch (error) {
    console.error('Failed to load Tailscale config:', error);
  }
}

async function saveTailscaleConfig() {
  var authKeyInput = document.getElementById('tailscale-auth-key');
  var enabledCheckbox = document.getElementById('tailscale-enabled');

  var authKey = authKeyInput ? authKeyInput.value.trim() : '';
  var enabled = enabledCheckbox ? enabledCheckbox.checked : false;

  try {
    var response = await fetch('/api/network-access/tailscale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled, config: { auth_key: authKey } })
    });
    if (!response.ok) {
      var err = await response.json();
      throw new Error(err.detail || 'Save failed');
    }
    var saveData = await response.json();
    _tsSavedAuthKey = authKey;
    _tsSavedEnabled = enabled;
    _tsUpdateSaveButton();
    if (saveData.tailscale_disconnected) {
      await refreshTailscaleStatus();
      if (!authKey) {
        _tsFeedback('Config saved. Tailscale disconnected (auth key removed).', 'warning');
      } else {
        _tsFeedback('Config saved. Tailscale disconnected (key changed — click Connect to re-authenticate).', 'warning');
      }
    } else {
      await refreshTailscaleStatus();
      _tsFeedback('Tailscale configuration saved.');
    }
  } catch (error) {
    console.error('Failed to save Tailscale config:', error);
    _tsFeedback('Failed to save config: ' + error.message, 'error');
  }
}

async function tailscaleUp() {
  try {
    var response = await fetch('/api/network-access/tailscale/up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    var data = await response.json();
    if (!response.ok) {
      _tsFeedback('Connect failed: ' + (data.detail || data.output || 'Unknown error'), 'error');
      return;
    }
    await refreshTailscaleStatus();
    _tsFeedback(data.message || 'Tailscale connected.');
  } catch (error) {
    console.error('Tailscale up failed:', error);
    _tsFeedback('Connect failed: ' + error.message, 'error');
  }
}

async function tailscaleDown() {
  try {
    var response = await fetch('/api/network-access/tailscale/down', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    var data = await response.json();
    if (!response.ok) {
      _tsFeedback('Disconnect failed: ' + (data.detail || data.output || 'Unknown error'), 'error');
      return;
    }
    await refreshTailscaleStatus();
    _tsFeedback(data.message || 'Tailscale disconnected.', 'warning');
  } catch (error) {
    console.error('Tailscale down failed:', error);
    _tsFeedback('Disconnect failed: ' + error.message, 'error');
  }
}

function toggleAuthKeyVisibility() {
  var input = document.getElementById('tailscale-auth-key');
  var toggleBtn = document.getElementById('tailscale-key-toggle');
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    if (toggleBtn) toggleBtn.textContent = '🔒';
  } else {
    input.type = 'password';
    if (toggleBtn) toggleBtn.textContent = '👁️';
  }
}

// Load Network Access config and status after auth resolves (admin only)
if (typeof waitForAuth === 'function') {
  waitForAuth().then(function(user) {
    if (user && user.is_admin) {
      loadTailscaleConfig();
      _tsQuickStatusForIcon();
      loadNtfyConfig();
      _ntfyQuickStatusForIcon();
    }
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// Ntfy Push Notifications
// ═══════════════════════════════════════════════════════════════════════════

function _ntfyFeedback(message, type) {
  type = type || 'success';
  var el = document.getElementById('ntfy-feedback');
  if (!el) return;

  var colors = {
    success: { bg: 'rgba(45,90,30,0.12)', border: '#2d5a1e', text: '#1e3f14', icon: '✅' },
    error:   { bg: 'rgba(139,26,26,0.12)', border: '#8b1a1a', text: '#5c1010', icon: '❌' },
    warning: { bg: 'rgba(184,134,11,0.12)', border: '#b8860b', text: '#6b4f00', icon: '⚠️' },
    info:    { bg: 'rgba(74,44,42,0.10)', border: '#4a2c2a', text: '#2b1e0f', icon: 'ℹ️' }
  };
  var c = colors[type] || colors.info;

  el.style.display = '';
  el.style.background = c.bg;
  el.style.border = '1px solid ' + c.border;
  el.style.color = c.text;
  el.textContent = c.icon + '  ' + message;

  el.style.opacity = '0';
  requestAnimationFrame(function () {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '1';
  });
}

function toggleNtfySection() {
  var body = document.getElementById('ntfy-config-body');
  if (!body) return;

  var isVisible = body.style.display !== 'none';
  body.style.display = isVisible ? 'none' : '';

  if (!isVisible) {
    checkNtfyStatus();
    displayNtfyTopic();
    displayNtfyServerUrl();
  }
}

function _ntfyUpdateHeaderIcon(status) {
  var icon = document.getElementById('ntfy-header-icon');
  if (!icon) return;

  switch (status) {
    case 'active':         icon.textContent = '🟢'; break;
    case 'unreachable':    icon.textContent = '🔴'; break;
    case 'disabled':       icon.textContent = '⚫'; break;
    case 'not_configured': icon.textContent = '⚪'; break;
    default:               icon.textContent = '⚪'; break;
  }
}

async function _ntfyQuickStatusForIcon() {
  try {
    var response = await fetch('/api/network-access/ntfy/status');
    if (!response.ok) return;
    var data = await response.json();
    _ntfyUpdateHeaderIcon(data.status);
    _ntfyUpdateDisableButton(data.enabled !== false && data.status !== 'not_configured');
  } catch (e) {
    // Silently ignore
  }
}

function _ntfyUpdateDisableButton(isEnabled) {
  var btn = document.getElementById('ntfy-disable-btn') || document.getElementById('ntfy-enable-service-btn');
  if (!btn) return;
  if (isEnabled) {
    btn.textContent = '⏹️ Disable';
    btn.setAttribute('onclick', 'disableNtfyService()');
    btn.id = 'ntfy-disable-btn';
  } else {
    btn.textContent = '▶️ Enable';
    btn.setAttribute('onclick', 'enableNtfyService()');
    btn.id = 'ntfy-enable-service-btn';
  }
}

async function checkNtfyStatus() {
  var badge = document.getElementById('ntfy-status-badge');
  var currentStatus = 'unknown';

  if (badge) badge.textContent = '⏳ Checking...';
  _ntfyFeedback('Checking Ntfy status...', 'info');
  var checkStart = Date.now();

  try {
    var response = await fetch('/api/network-access/ntfy/status');
    if (!response.ok) throw new Error('Status check failed');
    var data = await response.json();
    currentStatus = data.status;

    var elapsed = Date.now() - checkStart;
    if (elapsed < 1000) await new Promise(function (r) { setTimeout(r, 1000 - elapsed); });

    switch (data.status) {
      case 'active':
        if (badge) badge.textContent = '🟢 Active';
        _ntfyFeedback('Ntfy service is running.', 'success');
        break;
      case 'disabled':
        if (badge) badge.textContent = '⚫ Disabled';
        _ntfyFeedback('Ntfy notifications are disabled.', 'info');
        break;
      case 'unreachable':
        if (badge) badge.textContent = '🔴 Unreachable';
        _ntfyFeedback('Ntfy service unreachable: ' + (data.message || 'Connection failed'), 'error');
        break;
      case 'not_configured':
        if (badge) badge.textContent = '⚪ Not Configured';
        _ntfyFeedback('Ntfy is not configured yet.', 'info');
        break;
      default:
        if (badge) badge.textContent = '⚪ Unknown';
        break;
    }
  } catch (error) {
    console.error('Failed to check Ntfy status:', error);
    if (badge) badge.textContent = '⚠️ Unable to check status';
    _ntfyFeedback('Unable to check status.', 'error');
  }

  _ntfyUpdateHeaderIcon(currentStatus);
  _ntfyUpdateDisableButton(currentStatus === 'active');
}

async function testNtfyNotification() {
  var testBtn = document.getElementById('ntfy-test-btn');
  if (testBtn) {
    testBtn.disabled = true;
    testBtn.style.opacity = '0.5';
  }

  _ntfyFeedback('Sending test notification...', 'info');

  try {
    var response = await fetch('/api/network-access/ntfy/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    var data = await response.json();

    if (data.success) {
      _ntfyFeedback('Test notification sent to topic: ' + data.topic, 'success');
    } else {
      _ntfyFeedback('Test failed: ' + (data.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Ntfy test failed:', error);
    _ntfyFeedback('Test failed: ' + error.message, 'error');
  } finally {
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.style.opacity = '1';
    }
  }
}

async function disableNtfyService() {
  var disableBtn = document.getElementById('ntfy-disable-btn');
  if (disableBtn) { disableBtn.disabled = true; disableBtn.style.opacity = '0.5'; }

  _ntfyFeedback('Disabling Ntfy...', 'info');

  try {
    var response = await fetch('/api/network-access/ntfy/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    var data = await response.json();

    if (data.success) {
      _ntfyFeedback('Ntfy notifications disabled.', 'success');
      _ntfyUpdateHeaderIcon('not_configured');
      var badge = document.getElementById('ntfy-status-badge');
      if (badge) badge.textContent = '⚪ Disabled';
      if (disableBtn) {
        disableBtn.textContent = '▶️ Enable';
        disableBtn.setAttribute('onclick', 'enableNtfyService()');
        disableBtn.id = 'ntfy-enable-service-btn';
        disableBtn.disabled = false;
        disableBtn.style.opacity = '1';
      }
    } else {
      _ntfyFeedback('Failed to disable: ' + (data.detail || 'Unknown error'), 'error');
      if (disableBtn) { disableBtn.disabled = false; disableBtn.style.opacity = '1'; }
    }
  } catch (error) {
    console.error('Failed to disable Ntfy:', error);
    _ntfyFeedback('Failed to disable: ' + error.message, 'error');
    if (disableBtn) { disableBtn.disabled = false; disableBtn.style.opacity = '1'; }
  }
}

async function enableNtfyService() {
  var enableBtn = document.getElementById('ntfy-enable-service-btn');
  if (enableBtn) { enableBtn.disabled = true; enableBtn.style.opacity = '0.5'; }

  _ntfyFeedback('Enabling Ntfy...', 'info');

  try {
    var response = await fetch('/api/network-access/ntfy/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    var data = await response.json();

    if (data.success) {
      _ntfyFeedback('Ntfy notifications enabled.', 'success');
      checkNtfyStatus();
      if (enableBtn) {
        enableBtn.textContent = '⏹️ Disable';
        enableBtn.setAttribute('onclick', 'disableNtfyService()');
        enableBtn.id = 'ntfy-disable-btn';
        enableBtn.disabled = false;
        enableBtn.style.opacity = '1';
      }
    } else {
      _ntfyFeedback('Failed to enable: ' + (data.detail || 'Unknown error'), 'error');
      if (enableBtn) { enableBtn.disabled = false; enableBtn.style.opacity = '1'; }
    }
  } catch (error) {
    console.error('Failed to enable Ntfy:', error);
    _ntfyFeedback('Failed to enable: ' + error.message, 'error');
    if (enableBtn) { enableBtn.disabled = false; enableBtn.style.opacity = '1'; }
  }
}

function openNtfyApp() {
  window.location.href = 'ntfy://';
}

function openTailscaleApp() {
  var ua = navigator.userAgent || '';
  if (/android/i.test(ua)) {
    window.open('intent://open#Intent;package=com.tailscale.ipn;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.tailscale.ipn;end', '_blank');
  } else {
    window.open('tailscale://', '_blank');
  }
}

function displayNtfyTopic() {
  var topicSpan = document.getElementById('ntfy-topic-display');
  if (!topicSpan) return;

  var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (!user || !user.user_id) {
    topicSpan.textContent = '—';
    return;
  }

  var alphanumeric = user.user_id.replace(/[^a-zA-Z0-9]/g, '');
  var topic = 'cwoc-' + alphanumeric.substring(0, 12);
  topicSpan.textContent = topic;
}

async function displayNtfyServerUrl() {
  var localSpan = document.getElementById('ntfy-server-url-local');
  var tsSpan = document.getElementById('ntfy-server-url-ts');
  var tsRow = document.getElementById('ntfy-tailscale-row');
  var hint = document.getElementById('ntfy-both-hint');

  var localHost = window.location.hostname || 'localhost';
  if (localSpan) localSpan.textContent = 'http://' + localHost + ':2586';

  if (tsRow) tsRow.style.display = 'none';
  if (hint) hint.style.display = 'none';

  try {
    var response = await fetch('/api/network-access/tailscale/status');
    if (response.ok) {
      var data = await response.json();
      if (data.status === 'active' && data.ip) {
        if (tsSpan) tsSpan.textContent = 'http://' + data.ip + ':2586';
        if (tsRow) tsRow.style.display = '';
        if (hint) hint.style.display = '';
      }
    }
  } catch (e) {
    // Tailscale not available
  }
}

function copyNtfyField(elementId, btn) {
  var el = document.getElementById(elementId);
  if (!el) return;

  var text = el.textContent;
  if (!text || text === '—') return;

  navigator.clipboard.writeText(text).then(function() {
    if (btn) {
      var orig = btn.textContent;
      btn.textContent = '✅';
      setTimeout(function() { btn.textContent = orig; }, 1200);
    }
  }).catch(function() {
    _ntfyFeedback('Failed to copy to clipboard.', 'error');
  });
}

async function loadNtfyConfig() {
  displayNtfyTopic();
  await displayNtfyServerUrl();
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Home Assistant Integration Settings ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function _haToggleSection() {
  var body = document.getElementById('ha-config-body');
  if (!body) return;

  var isVisible = body.style.display !== 'none';
  body.style.display = isVisible ? 'none' : '';

  if (!isVisible) {
    _haLoadConfig();
  }
}

function _haUpdateHeaderIcon(status) {
  var icon = document.getElementById('ha-header-icon');
  if (!icon) return;

  switch (status) {
    case 'connected':      icon.textContent = '🟢'; break;
    case 'error':          icon.textContent = '🔴'; break;
    case 'not_configured': icon.textContent = '⚪'; break;
    default:               icon.textContent = '⚪'; break;
  }
}

async function _haLoadConfig() {
  try {
    var resp = await fetch('/api/ha/config');
    if (!resp.ok) {
      if (resp.status === 403) return;
      console.warn('[HA] Failed to load config:', resp.status);
      return;
    }
    var data = await resp.json();
    var urlInput = document.getElementById('ha-base-url');
    var tokenInput = document.getElementById('ha-access-token');
    var pollInput = document.getElementById('ha-poll-interval');
    var webhookInput = document.getElementById('ha-webhook-url');

    if (urlInput) urlInput.value = data.ha_base_url || '';
    if (tokenInput) tokenInput.placeholder = data.ha_access_token ? '••••••••••••••••' : 'Long-Lived Access Token';
    if (pollInput) pollInput.value = data.ha_poll_interval || 30;

    var secret = data.ha_webhook_secret || '';
    if (secret && webhookInput) {
      webhookInput.value = window.location.protocol + '//' + window.location.host + '/api/ha/webhook?token=' + secret;
    } else if (webhookInput) {
      webhookInput.value = 'Not configured yet';
    }

    if (data.ha_base_url && data.ha_access_token) {
      _haUpdateHeaderIcon('connected');
    } else {
      _haUpdateHeaderIcon('not_configured');
    }
  } catch (e) {
    console.error('[HA] Error loading config:', e);
    _haUpdateHeaderIcon('error');
  }
}

async function _haSaveConfig() {
  var statusEl = document.getElementById('ha-connection-status');
  if (statusEl) { statusEl.textContent = '⏳ Saving...'; statusEl.style.color = '#8b5a2b'; }

  var payload = {
    ha_base_url: (document.getElementById('ha-base-url') || {}).value || '',
    ha_poll_interval: parseInt((document.getElementById('ha-poll-interval') || {}).value, 10) || 30
  };

  var tokenInput = document.getElementById('ha-access-token');
  if (tokenInput && tokenInput.value) {
    payload.ha_access_token = tokenInput.value;
  }

  try {
    var resp = await fetch('/api/ha/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      var err = await resp.json().catch(function() { return {}; });
      if (statusEl) { statusEl.textContent = '❌ ' + (err.detail || 'Save failed'); statusEl.style.color = '#b22222'; }
      return;
    }
    if (statusEl) { statusEl.textContent = '✅ Saved'; statusEl.style.color = '#1a7a4c'; }
    if (tokenInput) { tokenInput.value = ''; tokenInput.placeholder = '••••••••••••••••'; }
    await _haLoadConfig();
  } catch (e) {
    if (statusEl) { statusEl.textContent = '❌ Network error'; statusEl.style.color = '#b22222'; }
  }
}

async function _haTestConnection() {
  var statusEl = document.getElementById('ha-connection-status');
  if (statusEl) { statusEl.textContent = '⏳ Testing...'; statusEl.style.color = '#8b5a2b'; }

  var payload = {
    ha_base_url: (document.getElementById('ha-base-url') || {}).value || '',
  };
  var tokenInput = document.getElementById('ha-access-token');
  if (tokenInput && tokenInput.value) {
    payload.ha_access_token = tokenInput.value;
  }

  try {
    var resp = await fetch('/api/ha/config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await resp.json();
    if (data.success) {
      var msg = '✅ Connected';
      if (data.ha_version) msg += ' (HA ' + data.ha_version + ')';
      if (statusEl) { statusEl.textContent = msg; statusEl.style.color = '#1a7a4c'; }
    } else {
      if (statusEl) { statusEl.textContent = '❌ ' + (data.message || 'Connection failed'); statusEl.style.color = '#b22222'; }
    }
  } catch (e) {
    if (statusEl) { statusEl.textContent = '❌ Network error'; statusEl.style.color = '#b22222'; }
  }
}

function _haToggleTokenVisibility() {
  var input = document.getElementById('ha-access-token');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

function _haCopyWebhookUrl() {
  var input = document.getElementById('ha-webhook-url');
  if (!input || !input.value || input.value === 'Loading...' || input.value === 'Not configured yet') return;
  navigator.clipboard.writeText(input.value).then(function() {
    var statusEl = document.getElementById('ha-connection-status');
    if (statusEl) { statusEl.textContent = '📋 Copied!'; statusEl.style.color = '#1a7a4c'; }
    setTimeout(function() { if (statusEl && statusEl.textContent === '📋 Copied!') statusEl.textContent = ''; }, 2000);
  }).catch(function() {
    input.select();
    document.execCommand('copy');
  });
}

async function _haRegenerateWebhookSecret() {
  var confirmed = await cwocConfirm('Regenerate webhook secret?\n\nThis will break any existing HA automations using the current webhook URL. They will need to be updated with the new URL.', { title: 'Regenerate Webhook', confirmLabel: '🔄 Regenerate', danger: true });
  if (!confirmed) {
    return;
  }

  var statusEl = document.getElementById('ha-connection-status');
  if (statusEl) { statusEl.textContent = '⏳ Regenerating...'; statusEl.style.color = '#8b5a2b'; }

  try {
    var resp = await fetch('/api/ha/config/regenerate-webhook', { method: 'POST' });
    if (!resp.ok) {
      var err = await resp.json().catch(function() { return {}; });
      if (statusEl) { statusEl.textContent = '❌ ' + (err.detail || 'Failed'); statusEl.style.color = '#b22222'; }
      return;
    }
    if (statusEl) { statusEl.textContent = '✅ Secret regenerated'; statusEl.style.color = '#1a7a4c'; }
    await _haLoadConfig();
  } catch (e) {
    if (statusEl) { statusEl.textContent = '❌ Network error'; statusEl.style.color = '#b22222'; }
  }
}

/**
 * Initialize HA settings section on page load (admin only).
 */
(function() {
  function _initHASettings() {
    var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    if (user && user.is_admin) {
      _haLoadConfig();
    }
  }
  if (typeof waitForAuth === 'function') {
    waitForAuth().then(_initHASettings);
  } else {
    _initHASettings();
  }
})();
