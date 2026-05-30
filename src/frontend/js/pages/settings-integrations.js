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
      loadBackupConfig();
      loadBackupInfo();
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

/* ═══════════════════════════════════════════════════════════════════════════
   RESTIC BACKUP — Multi-Target Configuration
   ═══════════════════════════════════════════════════════════════════════════ */

// Track whether the currently-open target already exists on the server
var _backupConfigExists = false;

// Currently editing target ID (null = new target)
var _backupEditingTargetId = null;

/**
 * Format a date/time string respecting the user's 24h/12h time format setting.
 * Uses the time-format select on the settings page if available, otherwise getCachedSettings.
 */
function _backupFmtDateTime(isoOrDate) {
  if (!isoOrDate) return '—';
  var d = (isoOrDate instanceof Date) ? isoOrDate : new Date(isoOrDate);
  if (isNaN(d.getTime())) return '—';

  // Get time format from the settings page select (most reliable on this page)
  var tfEl = document.getElementById('time-format');
  var tf = tfEl ? tfEl.value : '24hour';

  var opts = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  if (tf === '12hour' || tf === '12houranalog') {
    opts.hour12 = true;
  } else {
    opts.hour12 = false;
  }
  return d.toLocaleString(undefined, opts);
}

/**
 * Format a 24h time string (HH:MM) for display respecting the user's time format.
 */
function _backupFmtTime(time24) {
  if (!time24) return '—';
  var tfEl = document.getElementById('time-format');
  var tf = tfEl ? tfEl.value : '24hour';
  if (tf === '12hour' || tf === '12houranalog') {
    var parts = time24.split(':');
    var h = parseInt(parts[0], 10);
    var m = parts[1] || '00';
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ampm;
  }
  return time24;
}

/**
 * Called when the time picker writes a new value to the schedule time input.
 * Stores the 24h value in data-time and displays the formatted version.
 */
function _backupFormatScheduleTime() {
  var el = document.getElementById('backup-schedule-time');
  if (!el) return;
  var raw = el.value; // 24h format from the picker
  if (raw && raw.match(/^\d{2}:\d{2}$/)) {
    el.dataset.time = raw;
    el.value = _backupFmtTime(raw);
  }
}

/**
 * Open the time picker for the schedule time input.
 * Temporarily sets the input value to 24h format so the picker reads it correctly.
 */
function _backupOpenTimePicker(el) {
  if (typeof cwocTimePicker === 'undefined') return;
  // Set value to 24h so the picker initializes correctly
  if (el.dataset.time) el.value = el.dataset.time;
  cwocTimePicker.open(el);
}

/**
 * Toggle the backup section body visibility (enable/disable).
 */
function toggleBackupSection() {
  var body = document.getElementById('backup-body');
  if (!body) return;
  var cb = document.getElementById('backup-enabled');
  var isVisible = body.style.display !== 'none';
  if (isVisible) {
    body.style.display = 'none';
    if (cb) cb.checked = false;
  } else {
    body.style.display = '';
    if (cb) cb.checked = true;
    // Load targets when section is opened (updates the icon to correct state)
    _loadBackupTargets();
  }
}

/**
 * Update the backup header icon based on status.
 * ⚪ = inactive (section collapsed / disabled)
 * 🟡 = partially set up but not active (enabled, no successful backup yet)
 * 🟢 = active and working (last backup succeeded or status check passed)
 * 🔴 = error (last backup failed or status check failed)
 */
function _backupUpdateHeaderIcon(status) {
  var icon = document.getElementById('backup-header-icon');
  if (!icon) return;
  var btn = icon.parentElement;
  if (status === 'ok') {
    icon.innerHTML = '🟢';
    icon.title = '';
    if (btn) btn.title = 'Backup active and working';
  } else if (status === 'local_only') {
    // Half-green, half-yellow: working but only local (not a real offsite backup)
    icon.innerHTML = '<span style="display:inline-block;width:0.7em;height:0.7em;border-radius:50%;background:linear-gradient(to right, #22c55e 50%, #e6b800 50%);vertical-align:middle;border:1px solid #000;"></span>';
    var tip = 'Local backup only! On-device backup is not a real backup. Add a remote target for proper protection.';
    icon.title = tip;
    if (btn) btn.title = tip;
  } else if (status === 'incomplete') {
    icon.innerHTML = '🟡';
    icon.title = '';
    if (btn) btn.title = 'Backup configured but no successful backup yet';
  } else if (status === 'error') {
    icon.innerHTML = '🔴';
    icon.title = '';
    if (btn) btn.title = 'Last backup failed';
  } else {
    icon.innerHTML = '⚪';
    icon.title = '';
    if (btn) btn.title = 'Backup not configured';
  }
}

/**
 * Toggle backup repository password visibility.
 */
function toggleBackupPasswordVisibility() {
  var input = document.getElementById('backup-repo-password');
  var btn = document.getElementById('backup-pw-toggle');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.textContent = '🙈';
  } else {
    input.type = 'password';
    if (btn) btn.textContent = '👁️';
  }
}

/**
 * Show/hide backend-specific credential fields based on selected repo type.
 * Works inside the modal.
 */
function onBackupRepoTypeChange() {
  var type = document.getElementById('backup-repo-type').value;
  var sections = document.querySelectorAll('.backup-creds-section');
  for (var i = 0; i < sections.length; i++) {
    sections[i].style.display = 'none';
  }
  var target = document.getElementById('backup-creds-' + type);
  if (target) target.style.display = '';
  var urlRow = document.getElementById('backup-repo-url-row');
  var urlInput = document.getElementById('backup-repo-url');
  var urlLabel = document.getElementById('backup-repo-url-label');
  if (type === 'local') {
    if (urlRow) urlRow.style.display = 'none';
    if (urlInput) urlInput.value = '/app/data/backups/restic';
  } else if (type === 'sftp') {
    if (urlRow) urlRow.style.display = 'none';
  } else {
    if (urlRow) urlRow.style.display = '';
    var labels = { s3: 'S3 Endpoint/Bucket', b2: 'B2 Bucket/Path', azure: 'Container/Path', gcs: 'Bucket/Path', rest: 'Server URL', rclone: 'Remote:Path' };
    var placeholders = { s3: 's3.amazonaws.com/bucket-name', b2: 'bucket-name:/path', azure: 'container-name:/path', gcs: 'bucket-name:/path', rest: 'http://host:8000/', rclone: 'remote:path' };
    if (urlInput) urlInput.placeholder = placeholders[type] || '';
    if (urlLabel) {
      var star = urlLabel.querySelector('.backup-required-star');
      var starHtml = star ? star.outerHTML : '';
      urlLabel.innerHTML = (labels[type] || 'Destination') + ' ' + starHtml;
    }
    if (urlInput && urlInput.value === '/app/data/backups/restic') urlInput.value = '';
  }
}

/**
 * Show/hide the time-of-day picker based on schedule frequency.
 */
function onBackupScheduleChange() {
  var freq = document.getElementById('backup-schedule-frequency').value;
  var timeRow = document.getElementById('backup-time-row');
  if (!timeRow) return;
  timeRow.style.display = (freq === 'daily' || freq === 'weekly') ? '' : 'none';
}

/**
 * Show inline feedback in the backup modal.
 */
function _backupFeedback(message, type) {
  type = type || 'info';
  var el = document.getElementById('backup-feedback');
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
  el.innerHTML = c.icon + '  ' + message;
  el.style.opacity = '0';
  requestAnimationFrame(function () {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '1';
  });
}

/**
 * Gather all backup form field values into a config object.
 * Now includes id and name for multi-target support.
 */
function _gatherBackupConfig() {
  var paths = [];
  var checkboxes = document.querySelectorAll('.backup-path-cb:checked');
  for (var i = 0; i < checkboxes.length; i++) {
    paths.push(checkboxes[i].value);
  }

  var repoType = document.getElementById('backup-repo-type').value;
  var backendCredentials = {};

  if (repoType === 'sftp') {
    backendCredentials.user = (document.getElementById('backup-sftp-user') || {}).value || '';
    backendCredentials.host = (document.getElementById('backup-sftp-host') || {}).value || '';
    backendCredentials.port = (document.getElementById('backup-sftp-port') || {}).value || '22';
    backendCredentials.path = (document.getElementById('backup-sftp-path') || {}).value || '';
    backendCredentials.password = (document.getElementById('backup-sftp-password') || {}).value || '';
    backendCredentials.ssh_key_path = (document.getElementById('backup-sftp-key-path') || {}).value || '';
  } else if (repoType === 's3') {
    backendCredentials.access_key_id = (document.getElementById('backup-s3-access-key') || {}).value || '';
    backendCredentials.secret_access_key = (document.getElementById('backup-s3-secret-key') || {}).value || '';
    backendCredentials.region = (document.getElementById('backup-s3-region') || {}).value || '';
  } else if (repoType === 'b2') {
    backendCredentials.account_id = (document.getElementById('backup-b2-account-id') || {}).value || '';
    backendCredentials.application_key = (document.getElementById('backup-b2-app-key') || {}).value || '';
  } else if (repoType === 'azure') {
    backendCredentials.account_name = (document.getElementById('backup-azure-account-name') || {}).value || '';
    backendCredentials.account_key = (document.getElementById('backup-azure-account-key') || {}).value || '';
  } else if (repoType === 'gcs') {
    backendCredentials.project_id = (document.getElementById('backup-gcs-project-id') || {}).value || '';
    backendCredentials.credentials_path = (document.getElementById('backup-gcs-credentials-path') || {}).value || '';
  } else if (repoType === 'rest') {
    backendCredentials.username = (document.getElementById('backup-rest-username') || {}).value || '';
    backendCredentials.password = (document.getElementById('backup-rest-password') || {}).value || '';
  } else if (repoType === 'rclone') {
    backendCredentials.config_name = (document.getElementById('backup-rclone-config') || {}).value || '';
  }

  // Build repo_url
  var repoUrl = '';
  if (repoType === 'sftp') {
    var sftpUser = backendCredentials.user || '';
    var sftpHost = backendCredentials.host || '';
    var sftpPort = backendCredentials.port || '22';
    var sftpPath = backendCredentials.path || '/';
    if (sftpUser && sftpHost) {
      repoUrl = sftpUser + '@' + sftpHost;
      if (sftpPort && sftpPort !== '22') repoUrl += ':' + sftpPort;
      repoUrl += ':' + sftpPath;
    }
  } else {
    repoUrl = (document.getElementById('backup-repo-url') || {}).value || '';
  }

  var config = {
    name: (document.getElementById('backup-target-name') || {}).value || '',
    enabled: document.getElementById('backup-enabled') ? document.getElementById('backup-enabled').checked : true,
    repo_type: repoType,
    repo_url: repoUrl,
    repo_password: (document.getElementById('backup-repo-password') || {}).value || '',
    backend_credentials: backendCredentials,
    backup_paths: paths,
    schedule_frequency: (document.getElementById('backup-schedule-frequency') || {}).value || 'daily',
    schedule_time: (document.getElementById('backup-schedule-time') || {}).dataset.time || (document.getElementById('backup-schedule-time') || {}).value || '02:00',
    retention_policy: {
      keep_last: parseInt((document.getElementById('backup-keep-last') || {}).value) || 0,
      keep_daily: parseInt((document.getElementById('backup-keep-daily') || {}).value) || 0,
      keep_weekly: parseInt((document.getElementById('backup-keep-weekly') || {}).value) || 0,
      keep_monthly: parseInt((document.getElementById('backup-keep-monthly') || {}).value) || 0,
      keep_yearly: parseInt((document.getElementById('backup-keep-yearly') || {}).value) || 0
    },
    notification_recipients: {
      admins: (document.getElementById('backup-notify-admins') || {}).value || 'all',
      trigger: (document.getElementById('backup-notify-trigger') || {}).value || 'both'
    },
    notification_transfer: document.getElementById('backup-notify-transfer') ? document.getElementById('backup-notify-transfer').checked : true,
    notification_maintenance: document.getElementById('backup-notify-maintenance') ? document.getElementById('backup-notify-maintenance').checked : true
  };

  // Include id if editing an existing target
  var targetId = (document.getElementById('backup-target-id') || {}).value;
  if (targetId) config.id = targetId;

  return config;
}

/**
 * Mark a backup form field as having an error (red background, show asterisk).
 */
function _backupMarkFieldError(inputEl) {
  if (!inputEl) return;
  inputEl.style.background = 'rgba(192, 57, 43, 0.08)';
  inputEl.style.borderColor = '#c0392b';
  // Show the red asterisk on the associated label
  var row = inputEl.closest('.setting-inline');
  if (row) {
    var star = row.querySelector('.backup-required-star');
    if (star) star.style.display = '';
  }
}

/**
 * Clear the error state on a backup form field when the user types.
 */
function _backupClearFieldError(inputEl) {
  if (!inputEl) return;
  if (inputEl.value.trim()) {
    inputEl.style.background = '';
    inputEl.style.borderColor = '';
    var row = inputEl.closest('.setting-inline');
    if (row) {
      var star = row.querySelector('.backup-required-star');
      if (star) star.style.display = 'none';
    }
  }
}

/**
 * Toggle a collapsible section in the backup modal.
 */
function _backupToggleSection(labelEl) {
  var body = labelEl.nextElementSibling;
  var arrow = labelEl.querySelector('.backup-toggle-arrow');
  if (!body) return;
  var isHidden = body.style.display === 'none';
  body.style.display = isHidden ? '' : 'none';
  if (arrow) arrow.textContent = isHidden ? '▾' : '▸';
}

/**
 * Show/hide SFTP auth fields based on radio selection.
 */
function _backupSftpAuthChange() {
  var radios = document.querySelectorAll('input[name="backup-sftp-auth"]');
  var selected = '';
  for (var i = 0; i < radios.length; i++) {
    if (radios[i].checked) { selected = radios[i].value; break; }
  }
  var pwRow = document.getElementById('backup-sftp-auth-password');
  var keyRow = document.getElementById('backup-sftp-auth-key');
  if (pwRow) pwRow.style.display = (selected === 'password') ? '' : 'none';
  if (keyRow) keyRow.style.display = (selected === 'key') ? '' : 'none';
}

/**
 * Disable the "Local" option in the repo type dropdown if a local backup already exists.
 * Called when the modal opens in create mode.
 */
function _backupCheckLocalExists() {
  var typeEl = document.getElementById('backup-repo-type');
  if (!typeEl) return;
  var localOption = typeEl.querySelector('option[value="local"]');
  if (!localOption) return;

  var container = document.getElementById('backup-target-list');
  var hasLocal = container && container.getAttribute('data-backup-has-local') === 'true';
  if (hasLocal) {
    localOption.disabled = true;
    localOption.textContent = 'Local (already exists)';
    if (typeEl.value === 'local') {
      typeEl.value = 'sftp';
      onBackupRepoTypeChange();
    }
  } else {
    localOption.disabled = false;
    localOption.textContent = 'Local';
  }
}

/**
 * Validate required backup fields before saving.
 * Returns true if valid, false if errors found (fields are highlighted).
 */
function _backupValidateRequired() {
  var valid = true;
  var nameEl = document.getElementById('backup-target-name');
  var urlEl = document.getElementById('backup-repo-url');
  var pwEl = document.getElementById('backup-repo-password');
  var repoType = document.getElementById('backup-repo-type').value;

  // Name is always required
  if (nameEl && !nameEl.value.trim()) {
    _backupMarkFieldError(nameEl);
    valid = false;
  }

  // URL/destination validation depends on type
  if (repoType === 'local') {
    // Local uses fixed path — no validation needed
  } else if (repoType === 'sftp') {
    var hostEl = document.getElementById('backup-sftp-host');
    if (!hostEl.value.trim()) {
      _backupMarkFieldError(hostEl);
      valid = false;
    }
  } else {
    if (!urlEl.value.trim()) {
      _backupMarkFieldError(urlEl);
      valid = false;
    }
  }
  // Password is only required on first-time save (no existing config on server)
  if (!_backupConfigExists && !pwEl.value.trim()) {
    _backupMarkFieldError(pwEl);
    valid = false;
  }

  if (!valid) {
    _backupFeedback('Please fill in the required fields (marked with <span style="color:#c0392b;font-weight:bold;">*</span>).', 'error');
  }
  return valid;
}

/**
 * Save backup configuration — POST /api/backup/config
 * Creates (no id) or updates (with id) a target.
 */
async function saveBackupConfig() {
  try {
    if (!_backupValidateRequired()) return;
    var config = _gatherBackupConfig();

    var resp = await fetch('/api/backup/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    var data = await resp.json();

    if (resp.ok && data.success !== false) {
      _backupConfigExists = true;
      // Update the hidden target ID if this was a new target
      if (data.id) {
        var idEl = document.getElementById('backup-target-id');
        if (idEl) idEl.value = data.id;
        _backupEditingTargetId = data.id;
      }
      // Enable Backup Now button now that config is saved
      var runBtn = document.getElementById('backup-run-btn');
      if (runBtn) { runBtn.disabled = false; runBtn.title = 'Run a backup immediately using the current configuration'; runBtn.style.opacity = ''; }
      cwocToast('Backup target saved', 'success');
      // Refresh the target list in the background
      _loadBackupTargets();
    } else {
      var msg = data.message || data.detail || 'Failed to save configuration.';
      if (data.details) msg += '<br><small style="opacity:0.7;">' + _backupEscHtml(data.details) + '</small>';
      console.error('[Backup] Save failed:', data.error, data.message, data.details);
      _backupFeedback(msg, 'error');
    }
  } catch (e) {
    console.error('[Backup] Save config error:', e);
    _backupFeedback('Network error saving configuration.', 'error');
  }
}

/**
 * Trigger immediate backup for the current target — POST /api/backup/run?target_id=X
 */
async function backupNow() {
  var btn = document.getElementById('backup-run-btn');
  var targetId = (document.getElementById('backup-target-id') || {}).value;
  try {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Backing up...'; }
    _backupFeedback('Backup in progress...', 'info');

    var url = '/api/backup/run';
    if (targetId) url += '?target_id=' + encodeURIComponent(targetId);
    var resp = await fetch(url, { method: 'POST' });
    var data = await resp.json();

    if (resp.ok && data.success !== false) {
      var details = '';
      if (data.snapshot_id) details += ' Snapshot: ' + data.snapshot_id + '.';
      if (data.duration) details += ' Duration: ' + data.duration.toFixed(1) + 's.';
      _backupFeedback('Backup completed successfully.' + details, 'success');
      cwocToast('Backup complete', 'success');
      _loadBackupTargets();
    } else {
      var msg = data.message || data.detail || 'Backup failed.';
      if (data.details) msg += '\n' + data.details;
      console.error('[Backup] Backup failed:', data.error, data.message, data.details);
      _backupFeedback('Backup failed: ' + msg, 'error');
    }
  } catch (e) {
    console.error('[Backup] Backup now error:', e);
    _backupFeedback('Network error running backup.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶️ Backup Now'; }
  }
}

/**
 * Backup All Now — POST /api/backup/run (no target_id, runs all enabled)
 */
async function _backupAllNow() {
  var btn = document.getElementById('backup-all-btn');
  try {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Backing up...'; }
    var resp = await fetch('/api/backup/run', { method: 'POST' });
    var data = await resp.json();
    if (resp.ok && data.success !== false) {
      cwocToast('All backups complete', 'success');
      _loadBackupTargets();
    } else {
      cwocToast(data.message || 'Backup failed', 'error');
    }
  } catch (e) {
    console.error('[Backup] Backup all error:', e);
    cwocToast('Network error running backups', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶️ Backup All Now'; }
  }
}

/**
 * List snapshots for the current target — GET /api/backup/snapshots?target_id=X
 */
async function listBackupSnapshots() {
  var btn = document.getElementById('backup-snapshots-btn');
  var resultsEl = document.getElementById('backup-results');
  var targetId = (document.getElementById('backup-target-id') || {}).value;
  try {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading...'; }
    var url = '/api/backup/snapshots';
    if (targetId) url += '?target_id=' + encodeURIComponent(targetId);
    var resp = await fetch(url);
    var data = await resp.json();

    if (resp.ok && data.snapshots) {
      if (data.snapshots.length === 0) {
        if (resultsEl) { resultsEl.style.display = ''; resultsEl.innerHTML = '<em>No snapshots found.</em>'; }
        _backupFeedback('No snapshots found.', 'info');
      } else {
        var html = '<div style="font-weight:bold;margin-bottom:8px;font-size:0.9em;color:#4a2c2a;">' + data.snapshots.length + ' Snapshot(s)</div>';
        for (var i = 0; i < data.snapshots.length; i++) {
          var snap = data.snapshots[i];
          var ts = snap.time ? _backupFmtDateTime(snap.time) : '—';
          var snapId = snap.short_id || snap.id || '—';
          var snapAge = snap.time ? _backupRelativeTime(snap.time) : '';
          var size = (snap.summary && snap.summary.total_size) ? _backupFormatBytes(snap.summary.total_size) : '—';

          html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 6px;border-bottom:1px solid rgba(139,90,43,0.12);">';
          html += '<div style="flex:1;min-width:0;">';
          html += '<div style="font-family:monospace;font-size:0.85em;font-weight:bold;color:#4a2c2a;">' + snapId + ' <span style="font-family:inherit;font-weight:normal;opacity:0.6;font-size:0.9em;">' + snapAge + '</span></div>';
          html += '<div style="font-size:0.8em;color:#6b4e31;">' + ts + ' · ' + size + '</div>';
          html += '</div>';
          html += '<button class="standard-button" onclick="_backupDownloadSnapshot(\'' + _backupEscHtml(snapId) + '\', \'' + _backupEscHtml(targetId) + '\')" style="padding:4px 8px;font-size:0.8em;height:28px;flex-shrink:0;" title="Download">⬇️</button>';
          html += '<button class="standard-button" onclick="_backupDeleteSnapshot(\'' + _backupEscHtml(snapId) + '\', \'' + _backupEscHtml(targetId) + '\', \'listBackupSnapshots\')" style="padding:4px 8px;font-size:0.8em;height:28px;flex-shrink:0;color:#c0392b;" title="Delete">🗑️</button>';
          html += '</div>';
        }
        if (resultsEl) { resultsEl.style.display = ''; resultsEl.innerHTML = html; }
        var feedbackEl = document.getElementById('backup-feedback');
        if (feedbackEl) feedbackEl.style.display = 'none';
      }
    } else {
      _backupFeedback(data.message || data.detail || 'Failed to list snapshots.', 'error');
      if (resultsEl) resultsEl.style.display = 'none';
    }
  } catch (e) {
    console.error('[Backup] List snapshots error:', e);
    _backupFeedback('Network error listing snapshots.', 'error');
    if (resultsEl) resultsEl.style.display = 'none';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📋 Snapshots'; }
  }
}

/**
 * Format bytes into human-readable string for the backup UI.
 */
function _backupFormatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB', 'TB'];
  var i = 0;
  var val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return val.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

/**
 * Check repository status for the current target — GET /api/backup/status?target_id=X
 */
async function checkBackupStatus() {
  var btn = document.getElementById('backup-status-btn');
  var targetId = (document.getElementById('backup-target-id') || {}).value;
  try {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Checking...'; }
    var url = '/api/backup/status';
    if (targetId) url += '?target_id=' + encodeURIComponent(targetId);
    var resp = await fetch(url);
    var data = await resp.json();

    if (resp.ok) {
      if (data.status === 'not_configured') {
        _backupFeedback('Backup not configured yet. Save a configuration first.', 'warning');
      } else if (data.reachable) {
        _backupFeedback('Repository is healthy and reachable. ✓', 'success');
      } else {
        var statusMsg = data.message || data.error || 'Check failed.';
        if (data.details) statusMsg += '\n' + data.details;
        console.error('[Backup] Status check failed:', data.error, data.message, data.details);
        _backupFeedback('Repository issue: ' + statusMsg, 'error');
      }
    } else {
      var failMsg = data.message || data.detail || 'Status check failed.';
      if (data.details) failMsg += '\n' + data.details;
      console.error('[Backup] Status endpoint error:', data);
      _backupFeedback(failMsg, 'error');
    }
  } catch (e) {
    console.error('[Backup] Check status error:', e);
    _backupFeedback('Network error checking status.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🩺 Status'; }
  }
}

/**
 * Restore from a snapshot — shows a list of available snapshots to pick from.
 */
async function backupRestore() {
  var btn = document.getElementById('backup-restore-btn');
  var targetId = (document.getElementById('backup-target-id') || {}).value;
  try {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading...'; }
    _backupFeedback('Loading snapshots...', 'info');

    var url = '/api/backup/snapshots';
    if (targetId) url += '?target_id=' + encodeURIComponent(targetId);
    var resp = await fetch(url);
    var data = await resp.json();

    if (!resp.ok || !data.snapshots || data.snapshots.length === 0) {
      _backupFeedback(data.message || 'No snapshots available to restore from.', 'warning');
      return;
    }

    // Build a snapshot list in the results area
    var resultsEl = document.getElementById('backup-results');
    if (!resultsEl) return;

    var html = '<div style="margin-bottom:8px;font-weight:bold;font-size:0.9em;color:#4a2c2a;">Select a snapshot to restore:</div>';
    html += '<div style="max-height:200px;overflow-y:auto;border:1px solid rgba(139,90,43,0.2);border-radius:6px;background:rgba(255,255,255,0.5);">';

    for (var i = 0; i < data.snapshots.length; i++) {
      var snap = data.snapshots[i];
      var snapId = snap.short_id || snap.id || '';
      var snapTime = snap.time ? _backupFmtDateTime(snap.time) : 'Unknown time';
      var snapAge = snap.time ? _backupRelativeTime(snap.time) : '';
      var pathsStr = (snap.paths && snap.paths.length) ? snap.paths.join(', ') : '';

      html += '<div onclick="_backupDoRestore(\'' + _backupEscHtml(snapId) + '\', \'' + _backupEscHtml(targetId) + '\', \'' + _backupEscHtml(snapTime) + '\')"'
           + ' style="padding:8px 10px;border-bottom:1px solid rgba(139,90,43,0.1);cursor:pointer;transition:background 0.15s;"'
           + ' onmouseenter="this.style.background=\'rgba(139,90,43,0.08)\'" onmouseleave="this.style.background=\'transparent\'">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<span style="font-weight:bold;font-size:0.85em;color:#4a2c2a;font-family:monospace;">' + _backupEscHtml(snapId) + '</span>';
      html += '<span style="font-size:0.75em;color:#6b4e31;opacity:0.7;">' + snapAge + '</span>';
      html += '</div>';
      html += '<div style="font-size:0.8em;color:#6b4e31;">' + _backupEscHtml(snapTime) + '</div>';
      if (pathsStr) html += '<div style="font-size:0.7em;color:#8b5a2b;opacity:0.6;margin-top:2px;">' + _backupEscHtml(pathsStr) + '</div>';
      html += '</div>';
    }

    html += '</div>';
    html += '<div style="margin-top:6px;font-size:0.75em;color:#6b4e31;opacity:0.6;text-align:center;">' + data.snapshots.length + ' snapshot(s) available</div>';

    resultsEl.innerHTML = html;
    resultsEl.style.display = '';
    _backupFeedback('', 'info');
    var feedbackEl = document.getElementById('backup-feedback');
    if (feedbackEl) feedbackEl.style.display = 'none';

  } catch (e) {
    console.error('[Backup] Restore fetch error:', e);
    _backupFeedback('Network error fetching snapshots.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '♻️ Restore'; }
  }
}

/**
 * Execute restore after user picks a snapshot from the list.
 */
async function _backupDoRestore(snapshotId, targetId, snapshotTime) {
  // Get the target name from the modal title
  var titleEl = document.getElementById('backup-modal-title');
  var targetName = (titleEl && titleEl.textContent) ? titleEl.textContent.replace('Edit: ', '') : 'Unknown';
  var currentDate = _backupFmtDateTime(new Date());
  var snapDate = snapshotTime || 'Unknown date';

  var confirmed = await cwocConfirm(
    '⚠️ <strong>THIS WILL PERMANENTLY DESTROY ALL EXISTING DATA</strong><br><br>'
    + '<strong>Backup target:</strong> ' + _backupEscHtml(targetName) + '<br>'
    + '<strong>Restoring from:</strong> Snapshot ' + snapshotId + ' (' + _backupEscHtml(snapDate) + ')<br>'
    + '<strong>Current data as of:</strong> ' + _backupEscHtml(currentDate) + '<br><br>'
    + 'All current data, settings, and configurations for all users will be permanently and irrevocably lost. There is no undo.<br><br>'
    + '💡 Consider clicking <strong>Backup Now</strong> and <strong>Download</strong> first so you have a copy of the current state in case this restore is not what you want.',
    { title: '⚠️ Restore from Backup', confirmLabel: 'Restore — Delete All Current Data', danger: true, html: true }
  );
  if (!confirmed) return;

  var btn = document.getElementById('backup-restore-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Restoring...'; }
  _backupFeedback('Restore in progress...', 'info');

  try {
    var body = { snapshot_id: snapshotId, target: '/' };
    if (targetId) body.target_id = targetId;
    var restoreResp = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var restoreData = await restoreResp.json();
    if (restoreResp.ok && restoreData.success !== false) {
      _backupFeedback('Restore completed. A server restart may be required.', 'success');
      cwocToast('Restore complete', 'success');
      var resultsEl = document.getElementById('backup-results');
      if (resultsEl) resultsEl.style.display = 'none';
    } else {
      var restoreMsg = restoreData.message || restoreData.detail || 'Unknown error';
      if (restoreData.details) restoreMsg += '\n' + restoreData.details;
      console.error('[Backup] Restore failed:', restoreData.error, restoreData.message, restoreData.details);
      _backupFeedback('Restore failed: ' + restoreMsg, 'error');
    }
  } catch (e) {
    console.error('[Backup] Restore error:', e);
    _backupFeedback('Network error during restore.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '♻️ Restore'; }
  }
}

/**
 * Format a timestamp into a relative time string (e.g., "2 hours ago").
 */
function _backupRelativeTime(isoStr) {
  try {
    var then = new Date(isoStr).getTime();
    var now = Date.now();
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return Math.floor(diff / 604800) + 'w ago';
  } catch (e) { return ''; }
}

/**
 * Download the most recent snapshot immediately as a tar.gz file.
 */
async function backupDownloadList() {
  var btn = document.getElementById('backup-download-btn');
  var targetId = (document.getElementById('backup-target-id') || {}).value;
  try {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading...'; }

    var url = '/api/backup/snapshots';
    if (targetId) url += '?target_id=' + encodeURIComponent(targetId);
    var resp = await fetch(url);
    var data = await resp.json();

    if (!resp.ok || !data.snapshots || data.snapshots.length === 0) {
      _backupFeedback(data.message || 'No snapshots available to download.', 'warning');
      return;
    }

    // Grab the most recent snapshot (first in the list — sorted newest first by restic)
    var latest = data.snapshots[0];
    var snapId = latest.short_id || latest.id || '';
    _backupDownloadSnapshot(snapId, targetId);

  } catch (e) {
    console.error('[Backup] Download error:', e);
    _backupFeedback('Network error fetching snapshots.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇️ Download'; }
  }
}

/**
 * Download a specific snapshot as a tar.gz file.
 */
function _backupDownloadSnapshot(snapshotId, targetId) {
  var url = '/api/backup/snapshots/' + encodeURIComponent(snapshotId) + '/download';
  if (targetId) url += '?target_id=' + encodeURIComponent(targetId);
  // Trigger download via hidden link
  var a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  cwocToast('Downloading snapshot ' + snapshotId + '...', 'info');
}

/**
 * Delete a specific snapshot after confirmation.
 * @param {string} snapshotId
 * @param {string} targetId
 * @param {string} [refreshFn] — name of function to call to refresh the list (default: backupDownloadList)
 */
async function _backupDeleteSnapshot(snapshotId, targetId, refreshFn) {
  var confirmed = await cwocConfirm(
    'Permanently delete snapshot <strong>' + snapshotId + '</strong>? This cannot be undone.',
    { title: 'Delete Snapshot', confirmLabel: 'Delete', danger: true, html: true }
  );
  if (!confirmed) return;

  try {
    var url = '/api/backup/snapshots/' + encodeURIComponent(snapshotId);
    if (targetId) url += '?target_id=' + encodeURIComponent(targetId);
    var resp = await fetch(url, { method: 'DELETE' });
    var data = await resp.json();
    if (resp.ok && data.success !== false) {
      cwocToast('Snapshot ' + snapshotId + ' deleted', 'success');
      // Refresh the list
      var fn = refreshFn ? window[refreshFn] : backupDownloadList;
      if (typeof fn === 'function') fn();
    } else {
      var msg = data.message || 'Failed to delete snapshot.';
      console.error('[Backup] Delete snapshot failed:', data);
      _backupFeedback('Delete failed: ' + msg, 'error');
    }
  } catch (e) {
    console.error('[Backup] Delete snapshot error:', e);
    _backupFeedback('Network error deleting snapshot.', 'error');
  }
}

/**
 * Prune old snapshots for the current target — POST /api/backup/prune?target_id=X
 */
async function backupPrune() {
  var btn = document.getElementById('backup-prune-btn');
  var targetId = (document.getElementById('backup-target-id') || {}).value;
  try {
    var confirmed = await cwocConfirm(
      'Pruning will permanently remove old snapshots based on your retention policy. This cannot be undone.',
      { title: 'Confirm Prune', confirmLabel: 'Prune', danger: true }
    );
    if (!confirmed) return;

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Pruning...'; }
    _backupFeedback('Pruning in progress...', 'info');

    var url = '/api/backup/prune';
    if (targetId) url += '?target_id=' + encodeURIComponent(targetId);
    var resp = await fetch(url, { method: 'POST' });
    var data = await resp.json();

    if (resp.ok && data.success !== false) {
      var details = '';
      if (data.snapshots_removed !== undefined) details += ' Removed: ' + data.snapshots_removed + ' snapshot(s).';
      if (data.space_reclaimed) details += ' Reclaimed: ' + data.space_reclaimed + '.';
      _backupFeedback('Prune completed.' + details, 'success');
      cwocToast('Prune complete', 'success');
      _loadBackupTargets();
    } else {
      var pruneMsg = data.message || data.detail || 'Unknown error';
      if (data.details) pruneMsg += '\n' + data.details;
      console.error('[Backup] Prune failed:', data.error, data.message, data.details);
      _backupFeedback('Prune failed: ' + pruneMsg, 'error');
    }
  } catch (e) {
    console.error('[Backup] Prune error:', e);
    _backupFeedback('Network error during prune.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🗑️ Prune'; }
  }
}

/**
 * Load backup config — called on page load for admin users.
 * Now loads the targets list instead of a single config.
 */
async function loadBackupConfig() {
  try {
    var resp = await fetch('/api/backup/targets');
    if (!resp.ok) return;
    var data = await resp.json();
    var targets = data.targets || [];

    var cb = document.getElementById('backup-enabled');
    var body = document.getElementById('backup-body');
    if (targets.length > 0) {
      if (cb) cb.checked = true;
      if (body) body.style.display = '';
      _loadBackupTargets();
    }
  } catch (e) {
    console.error('[Backup] Load config error:', e);
  }
}

/**
 * Load backup info — kept for backward compatibility.
 * Now just refreshes the targets list.
 */
async function loadBackupInfo() {
  _loadBackupTargets();
}

/**
 * Load backup targets list and render the summary.
 * Called on section open and after operations.
 */
async function _loadBackupTargets() {
  try {
    var resp = await fetch('/api/backup/targets');
    if (!resp.ok) return;
    var data = await resp.json();
    var targets = data.targets || [];

    // Update aggregate status panel
    var countEl = document.getElementById('backup-target-count');
    var lastTimeEl = document.getElementById('backup-last-time');
    var nextTimeEl = document.getElementById('backup-next-time');

    if (countEl) countEl.textContent = targets.length;

    var latestBackup = null;
    var earliestNext = null;
    var hasError = false;
    var hasOk = false;
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (t.last_backup_time) {
        var bt = new Date(t.last_backup_time);
        if (!latestBackup || bt > latestBackup) latestBackup = bt;
      }
      if (t.next_backup_time) {
        var nt = new Date(t.next_backup_time);
        if (!earliestNext || nt < earliestNext) earliestNext = nt;
      }
      if (t.last_backup_result && t.last_backup_result.success === false) hasError = true;
      if (t.last_backup_result && t.last_backup_result.success === true) hasOk = true;
    }

    // Check if all targets are local-only (on-device backup isn't a real backup)
    var hasRemote = false;
    for (var j = 0; j < targets.length; j++) {
      if (targets[j].repo_type && targets[j].repo_type !== 'local') { hasRemote = true; break; }
    }

    if (lastTimeEl) lastTimeEl.textContent = latestBackup ? _backupFmtDateTime(latestBackup) : 'Never';
    if (nextTimeEl) nextTimeEl.textContent = earliestNext ? _backupFmtDateTime(earliestNext) : 'Manual only';

    if (targets.length === 0) _backupUpdateHeaderIcon('incomplete');
    else if (hasError) _backupUpdateHeaderIcon('error');
    else if (hasOk && !hasRemote) _backupUpdateHeaderIcon('local_only');
    else if (hasOk) _backupUpdateHeaderIcon('ok');
    else _backupUpdateHeaderIcon('incomplete');

    _renderBackupTargetList(targets, data.orphans || []);
  } catch (e) {
    console.error('[Backup] Load targets error:', e);
  }
}

/**
 * Render the summary list of backup targets and orphaned repos.
 */
function _renderBackupTargetList(targets, orphans) {
  var container = document.getElementById('backup-target-list');
  if (!container) return;

  if ((!targets || targets.length === 0) && (!orphans || orphans.length === 0)) {
    container.innerHTML = '<div style="opacity:0.5;font-size:0.9em;padding:8px 0;text-align:center;">No backup targets configured yet.</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    var statusIcon = '⚪';
    if (t.last_backup_result && t.last_backup_result.success === true) statusIcon = '🟢';
    else if (t.last_backup_result && t.last_backup_result.success === false) statusIcon = '🔴';

    var repoLabel = (t.repo_type || 'local').charAt(0).toUpperCase() + (t.repo_type || 'local').slice(1);
    var lastTime = t.last_backup_time ? _backupFmtDateTime(t.last_backup_time) : 'Never';
    var name = t.name || 'Unnamed Target';
    var tid = t.id || '';
    var sizeStr = t.repo_size ? ' · ' + t.repo_size : '';

    html += '<div onclick="_openBackupTargetModal(\'' + tid + '\')" style="display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:6px;background:rgba(0,0,0,0.03);border:1px solid rgba(139,90,43,0.2);border-radius:6px;cursor:pointer;transition:background 0.15s;"'
         + ' onmouseenter="this.style.background=\'rgba(139,90,43,0.08)\'" onmouseleave="this.style.background=\'rgba(0,0,0,0.03)\'">';
    html += '<span style="font-size:1.1em;flex-shrink:0;">' + statusIcon + '</span>';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-weight:bold;font-size:0.9em;color:#4a2c2a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _backupEscHtml(name) + '</div>';
    html += '<div style="font-size:0.8em;color:#6b4e31;opacity:0.8;">' + repoLabel + ' · ' + lastTime + sizeStr + '</div>';
    html += '</div>';
    html += '<span style="font-size:0.75em;background:#f5e6cc;border:1px solid rgba(139,90,43,0.3);border-radius:3px;padding:1px 6px;flex-shrink:0;">' + repoLabel + '</span>';
    html += '<span style="opacity:0.4;font-size:1.2em;">›</span>';
    html += '</div>';
  }

  // Render orphaned local repos
  if (orphans && orphans.length > 0) {
    for (var j = 0; j < orphans.length; j++) {
      var o = orphans[j];
      var oPath = o.path || '';
      var oSize = o.repo_size || '—';

      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:6px;background:rgba(192,57,43,0.04);border:1px dashed rgba(192,57,43,0.3);border-radius:6px;" title="Create a new local backup to reconnect to this existing data">';
      html += '<span style="font-size:1.1em;flex-shrink:0;">👻</span>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-weight:bold;font-size:0.9em;color:#6b4e31;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Orphaned Local Backup</div>';
      html += '<div style="font-size:0.8em;color:#6b4e31;opacity:0.8;">' + _backupEscHtml(oPath) + ' · ' + oSize + '</div>';
      html += '</div>';
      html += '<button class="standard-button" onclick="_deleteOrphanRepo(\'' + _backupEscHtml(oPath.replace(/'/g, "\\'")) + '\')" style="padding:4px 10px;font-size:0.8em;color:#c0392b;flex-shrink:0;">💀 Delete</button>';
      html += '</div>';
    }
  }

  container.innerHTML = html;

  // Track whether a local target exists (used by _backupCheckLocalExists)
  var hasLocal = false;
  for (var k = 0; k < targets.length; k++) {
    if (targets[k].repo_type === 'local') { hasLocal = true; break; }
  }
  if (hasLocal) {
    container.setAttribute('data-backup-has-local', 'true');
  } else {
    container.removeAttribute('data-backup-has-local');
  }
}

/**
 * Open the backup target modal for editing or creating.
 * @param {string|null} targetId — null for new, string for existing
 */
async function _openBackupTargetModal(targetId) {
  _backupEditingTargetId = targetId;
  _backupConfigExists = !!targetId;

  var modal = document.getElementById('backup-target-modal');
  var titleEl = document.getElementById('backup-modal-title');
  var deleteBtn = document.getElementById('backup-delete-btn');
  var removeConfigBtn = document.getElementById('backup-remove-config-btn');
  var feedbackEl = document.getElementById('backup-feedback');
  var resultsEl = document.getElementById('backup-results');

  if (!modal) return;

  // Reset form
  _backupResetModalForm();
  if (feedbackEl) feedbackEl.style.display = 'none';
  if (resultsEl) resultsEl.style.display = 'none';

  if (targetId) {
    // Edit mode
    if (titleEl) titleEl.textContent = 'Loading...';
    if (deleteBtn) deleteBtn.style.display = '';
    if (removeConfigBtn) removeConfigBtn.style.display = '';
    var runBtn = document.getElementById('backup-run-btn');
    if (runBtn) { runBtn.disabled = false; runBtn.title = 'Run a backup immediately using the current configuration'; runBtn.style.opacity = ''; }
    modal.style.display = 'flex';

    try {
      var resp = await fetch('/api/backup/config?target_id=' + encodeURIComponent(targetId));
      if (resp.ok) {
        var data = await resp.json();
        _backupPopulateModalForm(data);
        if (titleEl) titleEl.textContent = 'Edit: ' + (data.name || 'Unnamed');
      } else {
        if (titleEl) titleEl.textContent = 'Edit Target';
        _backupFeedback('Failed to load target configuration.', 'error');
      }
    } catch (e) {
      console.error('[Backup] Load target config error:', e);
      if (titleEl) titleEl.textContent = 'Edit Target';
      _backupFeedback('Network error loading configuration.', 'error');
    }
  } else {
    // Create mode
    if (titleEl) titleEl.textContent = 'Add Backup Target';
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (removeConfigBtn) removeConfigBtn.style.display = 'none';
    var runBtn = document.getElementById('backup-run-btn');
    if (runBtn) { runBtn.disabled = true; runBtn.title = 'Save this configuration first before running a backup'; runBtn.style.opacity = '0.5'; }
    modal.style.display = 'flex';
    onBackupRepoTypeChange();
    onBackupScheduleChange();
    _backupCheckLocalExists();
  }

  // ESC handler
  document.addEventListener('keydown', _backupModalEscHandler, true);
}

/**
 * Close the backup target modal (internal — used by cancel and done).
 */
function _closeBackupTargetModal() {
  var modal = document.getElementById('backup-target-modal');
  if (modal) modal.style.display = 'none';
  _backupEditingTargetId = null;
  document.removeEventListener('keydown', _backupModalEscHandler, true);
}

/**
 * Cancel — close modal and discard all changes (revert to last saved state).
 */
function _cancelBackupTargetModal() {
  _closeBackupTargetModal();
  _loadBackupTargets();
}

/**
 * Done — save changes to the server and close modal.
 * The config is persisted immediately so it's ready when the settings page saves.
 */
function _doneBackupTargetModal() {
  var nameEl = document.getElementById('backup-target-name');
  if (nameEl && nameEl.value.trim()) {
    saveBackupConfig();
  }
  _closeBackupTargetModal();
}

/**
 * ESC key handler for the backup modal.
 * Skips if a confirm/prompt modal or time picker is open (they handle their own ESC).
 */
function _backupModalEscHandler(e) {
  if (e.key === 'Escape') {
    // If a cwocConfirm/cwocPromptModal/cwocUnsavedModal overlay is open on top, let it handle ESC
    var overlays = document.querySelectorAll('.cwoc-overlay');
    var backupModal = document.getElementById('backup-target-modal');
    for (var i = 0; i < overlays.length; i++) {
      if (overlays[i] !== backupModal && overlays[i].style.display !== 'none') return;
    }
    // If the time picker is open, let it handle ESC instead
    if (document.querySelector('.cwoc-tp-overlay')) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    _cancelBackupTargetModal();
  }
}

/**
 * Reset all form fields in the modal to defaults.
 */
function _backupResetModalForm() {
  var fields = [
    'backup-target-id', 'backup-target-name', 'backup-repo-url',
    'backup-repo-password', 'backup-sftp-user', 'backup-sftp-host',
    'backup-sftp-path', 'backup-sftp-password', 'backup-sftp-key-path',
    'backup-s3-access-key', 'backup-s3-secret-key', 'backup-s3-region',
    'backup-b2-account-id', 'backup-b2-app-key',
    'backup-azure-account-name', 'backup-azure-account-key',
    'backup-gcs-project-id', 'backup-gcs-credentials-path',
    'backup-rest-username', 'backup-rest-password', 'backup-rclone-config'
  ];
  for (var i = 0; i < fields.length; i++) {
    var el = document.getElementById(fields[i]);
    if (el) el.value = '';
  }
  var typeEl = document.getElementById('backup-repo-type');
  if (typeEl) typeEl.value = 'local';
  var portEl = document.getElementById('backup-sftp-port');
  if (portEl) portEl.value = '22';
  var freqEl = document.getElementById('backup-schedule-frequency');
  if (freqEl) freqEl.value = 'daily';
  var timeEl = document.getElementById('backup-schedule-time');
  if (timeEl) { timeEl.dataset.time = '02:00'; timeEl.value = _backupFmtTime('02:00'); }
  // Retention defaults
  var retDefs = { 'backup-keep-last': 5, 'backup-keep-daily': 7, 'backup-keep-weekly': 4, 'backup-keep-monthly': 6, 'backup-keep-yearly': 2 };
  for (var key in retDefs) {
    var el = document.getElementById(key);
    if (el) el.value = retDefs[key];
  }
  // Notifications defaults
  var na = document.getElementById('backup-notify-admins');
  if (na) na.value = 'all';
  var nt = document.getElementById('backup-notify-trigger');
  if (nt) nt.value = 'both';
  var ntf = document.getElementById('backup-notify-transfer');
  if (ntf) ntf.checked = true;
  var nm = document.getElementById('backup-notify-maintenance');
  if (nm) nm.checked = true;
  // Reset backup paths to defaults
  var allCbs = document.querySelectorAll('.backup-path-cb');
  for (var i = 0; i < allCbs.length; i++) {
    allCbs[i].checked = allCbs[i].hasAttribute('checked');
  }
  // Clear error states
  var modal = document.getElementById('backup-target-modal');
  if (modal) {
    var errInputs = modal.querySelectorAll('input[style*="border-color"]');
    for (var i = 0; i < errInputs.length; i++) {
      errInputs[i].style.background = '';
      errInputs[i].style.borderColor = '';
    }
    var stars = modal.querySelectorAll('.backup-required-star');
    for (var i = 0; i < stars.length; i++) {
      stars[i].style.display = 'none';
    }
  }
  // Reset password field type back to hidden
  var pwEl = document.getElementById('backup-repo-password');
  if (pwEl) pwEl.type = 'password';
  var pwBtn = document.getElementById('backup-pw-toggle');
  if (pwBtn) pwBtn.textContent = '👁️';
  // Reset collapsible sections: all collapsed except Schedule and Repository
  var toggles = document.querySelectorAll('.backup-section-toggle');
  for (var i = 0; i < toggles.length; i++) {
    var body = toggles[i].nextElementSibling;
    var arrow = toggles[i].querySelector('.backup-toggle-arrow');
    if (toggles[i].textContent.indexOf('Schedule') !== -1 || toggles[i].textContent.indexOf('Repository') !== -1) {
      if (body) body.style.display = '';
      if (arrow) arrow.textContent = '▾';
    } else {
      if (body) body.style.display = 'none';
      if (arrow) arrow.textContent = '▸';
    }
  }
}

/**
 * Populate the modal form from a loaded config object.
 */
function _backupPopulateModalForm(data) {
  var idEl = document.getElementById('backup-target-id');
  if (idEl) idEl.value = data.id || '';
  var nameEl = document.getElementById('backup-target-name');
  if (nameEl) nameEl.value = data.name || '';

  if (data.repo_type) {
    var typeEl = document.getElementById('backup-repo-type');
    if (typeEl) { typeEl.value = data.repo_type; onBackupRepoTypeChange(); }
  }
  if (data.repo_url) {
    var urlEl = document.getElementById('backup-repo-url');
    if (urlEl) urlEl.value = data.repo_url;
  }
  if (data.repo_password) {
    var pwEl = document.getElementById('backup-repo-password');
    if (pwEl) pwEl.value = data.repo_password;
  }

  var creds = data.backend_credentials || {};
  if (data.repo_type === 'sftp') {
    if (creds.user) document.getElementById('backup-sftp-user').value = creds.user;
    if (creds.host) document.getElementById('backup-sftp-host').value = creds.host;
    if (creds.port) document.getElementById('backup-sftp-port').value = creds.port;
    if (creds.path) document.getElementById('backup-sftp-path').value = creds.path;
    if (creds.password) document.getElementById('backup-sftp-password').value = creds.password;
    if (creds.ssh_key_path) document.getElementById('backup-sftp-key-path').value = creds.ssh_key_path;
    // Pre-select the auth radio based on which credential is present
    var radios = document.querySelectorAll('input[name="backup-sftp-auth"]');
    if (creds.ssh_key_path) {
      for (var r = 0; r < radios.length; r++) { radios[r].checked = (radios[r].value === 'key'); }
    } else if (creds.password) {
      for (var r = 0; r < radios.length; r++) { radios[r].checked = (radios[r].value === 'password'); }
    }
    _backupSftpAuthChange();
  } else if (data.repo_type === 's3') {
    if (creds.access_key_id) document.getElementById('backup-s3-access-key').value = creds.access_key_id;
    if (creds.secret_access_key) document.getElementById('backup-s3-secret-key').value = creds.secret_access_key;
    if (creds.region) document.getElementById('backup-s3-region').value = creds.region;
  } else if (data.repo_type === 'b2') {
    if (creds.account_id) document.getElementById('backup-b2-account-id').value = creds.account_id;
    if (creds.application_key) document.getElementById('backup-b2-app-key').value = creds.application_key;
  } else if (data.repo_type === 'azure') {
    if (creds.account_name) document.getElementById('backup-azure-account-name').value = creds.account_name;
    if (creds.account_key) document.getElementById('backup-azure-account-key').value = creds.account_key;
  } else if (data.repo_type === 'gcs') {
    if (creds.project_id) document.getElementById('backup-gcs-project-id').value = creds.project_id;
    if (creds.credentials_path) document.getElementById('backup-gcs-credentials-path').value = creds.credentials_path;
  } else if (data.repo_type === 'rest') {
    if (creds.username) document.getElementById('backup-rest-username').value = creds.username;
    if (creds.password) document.getElementById('backup-rest-password').value = creds.password;
  } else if (data.repo_type === 'rclone') {
    if (creds.config_name) document.getElementById('backup-rclone-config').value = creds.config_name;
  }

  // Backup paths
  var allCbs = document.querySelectorAll('.backup-path-cb');
  if (data.backup_paths && data.backup_paths.length > 0) {
    for (var i = 0; i < allCbs.length; i++) {
      allCbs[i].checked = data.backup_paths.indexOf(allCbs[i].value) !== -1;
    }
  }

  // Schedule
  if (data.schedule_frequency) {
    var freqEl = document.getElementById('backup-schedule-frequency');
    if (freqEl) { freqEl.value = data.schedule_frequency; onBackupScheduleChange(); }
  }
  if (data.schedule_time) {
    var timeEl = document.getElementById('backup-schedule-time');
    if (timeEl) {
      timeEl.dataset.time = data.schedule_time;
      timeEl.value = _backupFmtTime(data.schedule_time);
    }
  }

  // Retention
  var ret = data.retention_policy || {};
  if (ret.keep_last !== undefined) { var el = document.getElementById('backup-keep-last'); if (el) el.value = ret.keep_last; }
  if (ret.keep_daily !== undefined) { var el = document.getElementById('backup-keep-daily'); if (el) el.value = ret.keep_daily; }
  if (ret.keep_weekly !== undefined) { var el = document.getElementById('backup-keep-weekly'); if (el) el.value = ret.keep_weekly; }
  if (ret.keep_monthly !== undefined) { var el = document.getElementById('backup-keep-monthly'); if (el) el.value = ret.keep_monthly; }
  if (ret.keep_yearly !== undefined) { var el = document.getElementById('backup-keep-yearly'); if (el) el.value = ret.keep_yearly; }

  // Notifications
  var notif = data.notification_recipients || {};
  if (notif.admins) { var el = document.getElementById('backup-notify-admins'); if (el) el.value = notif.admins; }
  if (notif.trigger) { var el = document.getElementById('backup-notify-trigger'); if (el) el.value = notif.trigger; }
  var transferEl = document.getElementById('backup-notify-transfer');
  if (transferEl && data.notification_transfer !== undefined) transferEl.checked = !!data.notification_transfer;
  var maintEl = document.getElementById('backup-notify-maintenance');
  if (maintEl && data.notification_maintenance !== undefined) maintEl.checked = !!data.notification_maintenance;
}

/**
 * Remove config only — DELETE /api/backup/config/{target_id}
 * Removes the configuration from the database but leaves the repository data intact.
 */
async function _removeBackupConfig() {
  var targetId = (document.getElementById('backup-target-id') || {}).value;
  if (!targetId) return;

  var confirmed = await cwocConfirm(
    'This removes the backup configuration from CWOC but leaves all repository data and snapshots on disk. If you create a new local backup, it will reconnect to the existing data automatically.<br><br>⚠️ <strong>You will need the repository password to reconnect.</strong> If you do not know the password, you will permanently lose access to this data.',
    { title: 'Remove Configuration', confirmLabel: 'Remove Config', danger: false, html: true }
  );
  if (!confirmed) return;

  try {
    var resp = await fetch('/api/backup/config/' + encodeURIComponent(targetId), { method: 'DELETE' });
    var data = await resp.json();
    if (resp.ok && data.success !== false) {
      cwocToast('Configuration removed (data preserved on disk)', 'success');
      _closeBackupTargetModal();
      _loadBackupTargets();
    } else {
      _backupFeedback('Remove failed: ' + (data.message || data.detail || 'Unknown error'), 'error');
    }
  } catch (e) {
    console.error('[Backup] Remove config error:', e);
    _backupFeedback('Network error removing configuration.', 'error');
  }
}

/**
 * Delete target AND data — DELETE /api/backup/config/{target_id}/destroy
 * Permanently deletes the configuration AND the repository data (all snapshots lost).
 */
async function _deleteBackupTarget() {
  var targetId = (document.getElementById('backup-target-id') || {}).value;
  if (!targetId) return;

  var confirmed = await cwocConfirm(
    '⚠️ This will PERMANENTLY DELETE the backup configuration AND all repository data including every snapshot. This cannot be undone. All backed-up data will be lost forever.',
    { title: 'Delete Everything', confirmLabel: 'Delete Forever', danger: true, html: true }
  );
  if (!confirmed) return;

  try {
    var resp = await fetch('/api/backup/config/' + encodeURIComponent(targetId) + '/destroy', { method: 'DELETE' });
    var data = await resp.json();
    if (resp.ok && data.success !== false) {
      cwocToast(data.message || 'Backup target and data deleted', 'success');
      _closeBackupTargetModal();
      _loadBackupTargets();
    } else {
      var msg = data.message || data.detail || 'Unknown error';
      if (data.details) msg += '\n' + data.details;
      console.error('[Backup] Delete+data failed:', data.error, data.message, data.details);
      _backupFeedback('Delete failed: ' + msg, 'error');
    }
  } catch (e) {
    console.error('[Backup] Delete target+data error:', e);
    _backupFeedback('Network error deleting target.', 'error');
  }
}

/**
 * Escape HTML helper for backup section.
 */
function _backupEscHtml(str) {
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/**
 * Delete an orphaned local backup repository after confirmation.
 */
async function _deleteOrphanRepo(path) {
  var confirmed = await cwocConfirm(
    '⚠️ This will PERMANENTLY DELETE all backup data at:<br><code style="font-size:0.85em;">' + _backupEscHtml(path) + '</code><br><br>All snapshots in this repository will be destroyed forever. This cannot be undone.<br><br>If you do not know the repository password, this data is already inaccessible — deleting it frees the disk space.',
    { title: 'Delete Orphaned Backup', confirmLabel: 'Delete Forever', danger: true, html: true }
  );
  if (!confirmed) return;

  try {
    var resp = await fetch('/api/backup/orphan?path=' + encodeURIComponent(path), { method: 'DELETE' });
    var data = await resp.json();
    if (resp.ok && data.success !== false) {
      cwocToast('Orphaned repository deleted', 'success');
      _loadBackupTargets();
    } else {
      cwocToast('Delete failed: ' + (data.message || 'Unknown error'), 'error');
    }
  } catch (e) {
    console.error('[Backup] Delete orphan error:', e);
    cwocToast('Network error deleting orphan.', 'error');
  }
}
