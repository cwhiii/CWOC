// ── Settings: Version Info, Upgrade, Release Notes ───────────────────────────
// Version display, upgrade via SSE, release notes modal.
// Extracted from settings.js for modularity.

let _updateEventSource = null;

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

async function showReleaseNotes() {
  var modal = document.getElementById('release-notes-modal');
  var content = document.getElementById('release-notes-content');
  var header = document.getElementById('release-notes-version');
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
  var header = document.getElementById('release-notes-version');
  if (!content) return;

  var note = _releaseNotes[_releaseNotesIndex];
  if (!note) {
    content.innerHTML = '<p style="opacity:0.6;">No release notes available.</p>';
    if (header) header.textContent = '';
    _updateReleaseNotesNav();
    return;
  }

  if (header) header.textContent = 'v' + note.version;

  if (typeof marked !== 'undefined') {
    content.innerHTML = marked.parse(note.content);
  } else {
    content.textContent = note.content;
  }

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
