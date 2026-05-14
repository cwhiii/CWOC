// ── Settings: Version Info, Upgrade, Release Notes ───────────────────────────
// Version display, upgrade via SSE, release notes modal, disk usage.
// Extracted from settings.js for modularity.

let _updateEventSource = null;

// ── Disk Usage ───────────────────────────────────────────────────────────────

function _formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB', 'TB'];
  var i = Math.floor(Math.log(bytes) / Math.log(1024));
  if (i >= units.length) i = units.length - 1;
  var val = bytes / Math.pow(1024, i);
  return val.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

async function refreshDiskUsage() {
  var el = document.getElementById('disk-usage-display');
  var cwocEl = document.getElementById('cwoc-storage-display');
  var btn = document.getElementById('disk-refresh-btn');
  if (!el) return;
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  try {
    var res = await fetch('/api/disk-usage');
    if (!res.ok) throw new Error('Failed to fetch disk usage');
    var data = await res.json();
    var usedStr = _formatBytes(data.used);
    var totalStr = _formatBytes(data.total);
    var pct = data.total > 0 ? Math.round((data.used / data.total) * 100) : 0;
    el.textContent = usedStr + ' / ' + totalStr + ' (' + pct + '% used)';
    // Color-code if getting full
    if (pct >= 90) {
      el.style.color = '#b22222';
    } else if (pct >= 75) {
      el.style.color = '#a0522d';
    } else {
      el.style.color = '';
    }
    // CWOC storage (db, attachments, etc.)
    if (cwocEl && data.cwoc_storage != null) {
      var cwocPct = data.total > 0 ? Math.round((data.cwoc_storage / data.total) * 100 * 10) / 10 : 0;
      var cwocPctStr = cwocPct < 0.1 && data.cwoc_storage > 0 ? '<0.1' : cwocPct.toString();
      cwocEl.textContent = _formatBytes(data.cwoc_storage) + ' (' + cwocPctStr + '% of disk)';
      cwocEl.style.color = '';
    }
  } catch (e) {
    console.error('Error loading disk usage:', e);
    el.textContent = 'Unable to load';
    el.style.color = '#a0522d';
    if (cwocEl) { cwocEl.textContent = '—'; cwocEl.style.color = ''; }
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

async function loadVersionInfo() {
  const versionEl = document.getElementById('version-display');
  const dateEl = document.getElementById('version-date');
  try {
    const res = await fetch('/api/version');
    if (!res.ok) throw new Error('Failed to fetch version');
    const data = await res.json();
    if (data.version === 'unknown' || !data.installed_datetime) {
      versionEl.textContent = 'No version info available';
      dateEl.textContent = '';
      return;
    }
    versionEl.textContent = data.version;
    const dt = new Date(data.installed_datetime);
    const timeFormat = typeof _globalTimeFormat !== 'undefined' ? _globalTimeFormat : '24hour';
    const opts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    if (timeFormat === '12hour') {
      opts.hour12 = true;
    } else {
      opts.hour12 = false;
    }
    dateEl.textContent = dt.toLocaleString(undefined, opts);
  } catch (e) {
    console.error('Error loading version info:', e);
    versionEl.textContent = 'Unable to load version info';
    dateEl.innerHTML = '<a href="#" onclick="loadVersionInfo(); return false;" style="color:#8b5a2b;">Retry</a>';
  }
}

function _closeUpdateModal() {
  document.getElementById('update-modal').style.display = 'none';
  if (_updateEventSource) {
    document.getElementById('upgrade-btn').style.display = 'none';
    document.getElementById('upgrade-reopen-btn').style.display = '';
  }
}

function startUpgrade() {
  var modal = document.getElementById('update-modal');
  var log = document.getElementById('update-log');
  var closeBtn = document.getElementById('update-close-btn');
  var startBtn = document.getElementById('update-start-btn');
  var title = document.getElementById('update-modal-title');

  if (startBtn) startBtn.style.display = '';
  if (title) title.textContent = '⬆️ Upgrading Omni Chits';

  log.innerHTML = '';
  closeBtn.disabled = true;
  startBtn.disabled = false;
  modal.style.display = 'flex';
}

function runUpgrade() {
  var btn = document.getElementById('upgrade-btn');
  var closeBtn = document.getElementById('update-close-btn');
  var startBtn = document.getElementById('update-start-btn');

  btn.disabled = true;
  startBtn.disabled = true;
  closeBtn.disabled = true;

  _updateEventSource = new EventSource('/api/update/run');

  _updateEventSource.onmessage = function(event) {
    try {
      var data = JSON.parse(event.data);
      if (data.type === 'log') {
        appendLogLine(data.line);
      } else if (data.type === 'done') {
        onUpgradeComplete(data);
        _updateEventSource.close();
        _updateEventSource = null;
      } else if (data.type === 'error') {
        appendLogLine('[ERROR] ' + data.message);
        closeBtn.disabled = false;
        startBtn.disabled = false;
        btn.disabled = false;
        _updateEventSource.close();
        _updateEventSource = null;
      }
    } catch (e) {
      appendLogLine(event.data);
    }
  };

  _updateEventSource.onerror = function() {
    appendLogLine('[ERROR] Connection lost');
    closeBtn.disabled = false;
    startBtn.disabled = false;
    btn.disabled = false;
    if (_updateEventSource) {
      _updateEventSource.close();
      _updateEventSource = null;
    }
  };
}

function appendLogLine(line, bold) {
  const log = document.getElementById('update-log');
  const span = document.createElement('span');
  span.style.display = 'block';

  if (line.indexOf('===') !== -1 || (line.startsWith(' ') && line.trim().length > 0 && !line.trim().startsWith('['))) {
    span.style.textAlign = 'center';
  } else {
    span.style.textAlign = 'left';
  }

  if (line.startsWith('[OK]')) {
    span.className = 'log-ok';
  } else if (line.startsWith('[WARN]')) {
    span.className = 'log-warn';
  } else if (line.startsWith('[ERROR]')) {
    span.className = 'log-error';
  } else if (line.startsWith('[STEP]')) {
    span.className = 'log-step';
  } else if (line.startsWith('[HINT]')) {
    span.className = 'log-hint';
  }

  const isNearBottom = (log.scrollHeight - log.scrollTop - log.clientHeight) < 40;

  span.textContent = line;
  if (bold) span.style.fontWeight = 'bold';
  log.appendChild(span);

  if (isNearBottom) {
    log.scrollTop = log.scrollHeight;
  }
}

function onUpgradeComplete(data) {
  const btn = document.getElementById('upgrade-btn');
  const closeBtn = document.getElementById('update-close-btn');
  const startBtn = document.getElementById('update-start-btn');

  if (data.exit_code === 0) {
    appendLogLine('[OK] Update complete! Version: ' + (data.version || 'unknown'), true);
  } else {
    appendLogLine('[ERROR] Update failed (exit code ' + data.exit_code + ')', true);
  }

  closeBtn.disabled = false;
  startBtn.disabled = false;
  btn.disabled = false;
  document.getElementById('upgrade-reopen-btn').style.display = 'none';
  btn.style.display = '';
  loadVersionInfo();
}

function copyUpdateLog() {
  const log = document.getElementById('update-log');
  const text = log.innerText;
  navigator.clipboard.writeText(text).then(function() {
    const btn = document.getElementById('update-copy-btn');
    btn.textContent = '✅ Copied!';
    setTimeout(function() { btn.textContent = '📋 Copy Log'; }, 2000);
  }).catch(function() {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const btn = document.getElementById('update-copy-btn');
    btn.textContent = '✅ Copied!';
    setTimeout(function() { btn.textContent = '📋 Copy Log'; }, 2000);
  });
}

async function loadLastLog() {
  var log = document.getElementById('update-log');
  var modal = document.getElementById('update-modal');
  var closeBtn = document.getElementById('update-close-btn');
  var startBtn = document.getElementById('update-start-btn');
  var title = document.getElementById('update-modal-title');

  if (startBtn) startBtn.style.display = 'none';
  if (title) title.textContent = '📄 Upgrade Log';

  try {
    var res = await fetch('/api/update/log');
    var data = await res.json();
    if (!data.log) {
      log.innerHTML = '';
      appendLogLine('No previous upgrade log found.');
    } else {
      log.innerHTML = '';
      data.log.split('\n').forEach(function(line) {
        appendLogLine(line);
      });
    }
  } catch (e) {
    log.innerHTML = '';
    appendLogLine('[ERROR] Failed to load log: ' + e.message);
  }
  closeBtn.disabled = false;
  modal.style.display = 'flex';
}


// ── Release Notes Modal ──────────────────────────────────────────────────────

var _releaseNotes = [];
var _releaseNotesIndex = 0;

function _formatReleaseDate(dateStr) {
  // dateStr is YYYYMMDD — format as "May 14, 2026"
  var y = dateStr.substring(0, 4);
  var m = parseInt(dateStr.substring(4, 6), 10) - 1;
  var d = parseInt(dateStr.substring(6, 8), 10);
  var dt = new Date(y, m, d);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function showReleaseNotes() {
  var modal = document.getElementById('release-notes-modal');
  var content = document.getElementById('release-notes-content');
  var header = document.getElementById('release-notes-date');
  content.innerHTML = '<em>Loading...</em>';
  if (header) header.textContent = '';
  modal.style.display = 'flex';

  try {
    var res = await fetch('/api/release-notes');
    var data = await res.json();
    _releaseNotes = data.notes || [];
    if (_releaseNotes.length === 0) {
      content.innerHTML = '<p style="opacity:0.6;">No release notes available.</p>';
      if (header) header.textContent = '';
      _updateReleaseNotesNav();
      return;
    }
    _releaseNotesIndex = 0;
    _renderCurrentReleaseNote();
  } catch (e) {
    content.innerHTML = '<p style="color:#b22222;">Failed to load release notes.</p>';
    if (header) header.textContent = '';
  }
}

function _renderCurrentReleaseNote() {
  var content = document.getElementById('release-notes-content');
  var header = document.getElementById('release-notes-date');
  if (!content) return;

  var note = _releaseNotes[_releaseNotesIndex];
  if (!note) {
    content.innerHTML = '<p style="opacity:0.6;">No release notes available.</p>';
    if (header) header.textContent = '';
    _updateReleaseNotesNav();
    return;
  }

  if (header) header.textContent = _formatReleaseDate(note.date);

  if (typeof marked !== 'undefined') {
    content.innerHTML = marked.parse(note.content, { breaks: true });
  } else {
    content.textContent = note.content;
  }

  // Reset scroll to top so it doesn't look like content was appended
  content.scrollTop = 0;

  _updateReleaseNotesNav();
}

function _updateReleaseNotesNav() {
  var prevBtn = document.getElementById('release-notes-prev');
  var nextBtn = document.getElementById('release-notes-next');
  var counter = document.getElementById('release-notes-counter');

  if (prevBtn) {
    prevBtn.disabled = _releaseNotesIndex >= _releaseNotes.length - 1;
    prevBtn.style.opacity = prevBtn.disabled ? '0.4' : '1';
  }
  if (nextBtn) {
    nextBtn.disabled = _releaseNotesIndex <= 0;
    nextBtn.style.opacity = nextBtn.disabled ? '0.4' : '1';
  }
  if (counter) {
    if (_releaseNotes.length > 0) {
      counter.textContent = (_releaseNotesIndex + 1) + ' / ' + _releaseNotes.length;
    } else {
      counter.textContent = '';
    }
  }
}

function releaseNotesPrev() {
  if (_releaseNotesIndex < _releaseNotes.length - 1) {
    _releaseNotesIndex++;
    _renderCurrentReleaseNote();
  }
}

function releaseNotesNext() {
  if (_releaseNotesIndex > 0) {
    _releaseNotesIndex--;
    _renderCurrentReleaseNote();
  }
}

function closeReleaseNotesModal() {
  document.getElementById('release-notes-modal').style.display = 'none';
}


// ── Restart CWOC (admin only) ────────────────────────────────────────────────

async function restartCwoc() {
  var confirmed = await cwocConfirm(
    'This will restart the CWOC service. The app will be briefly unavailable.',
    { title: 'Restart CWOC', confirmLabel: '🔁 Restart', danger: true }
  );
  if (!confirmed) return;

  var btn = document.getElementById('restart-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '🔁 Restarting...';
  }

  try {
    var res = await fetch('/api/restart', { method: 'POST' });
    if (!res.ok) {
      var err = await res.json().catch(function() { return {}; });
      throw new Error(err.detail || 'Restart failed');
    }
    cwocToast('Restarting CWOC — page will reload shortly...', 'success');
    // Wait a few seconds then try to reload once the server is back
    setTimeout(function() { _waitForServerAndReload(); }, 4000);
  } catch (e) {
    console.error('Restart error:', e);
    cwocToast('Restart failed: ' + e.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔁 Restart CWOC';
    }
  }
}

function _waitForServerAndReload() {
  var attempts = 0;
  var maxAttempts = 20;
  var interval = setInterval(async function() {
    attempts++;
    try {
      var res = await fetch('/health', { cache: 'no-store' });
      if (res.ok) {
        clearInterval(interval);
        window.location.reload();
      }
    } catch (e) {
      // Server still down, keep trying
    }
    if (attempts >= maxAttempts) {
      clearInterval(interval);
      cwocToast('Server may still be restarting. Try refreshing manually.', 'warning');
      var btn = document.getElementById('restart-btn');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔁 Restart CWOC';
      }
    }
  }, 2000);
}

// Show restart button for admins only
if (typeof waitForAuth === 'function') {
  waitForAuth().then(function() {
    if (typeof isAdmin === 'function' && isAdmin()) {
      var restartBtn = document.getElementById('restart-btn');
      if (restartBtn) restartBtn.style.display = '';
    }
  });
}
