/**
 * shared.js — Coordinator for shared code between dashboard (main.js) and editor (editor.js).
 *
 * This file is loaded AFTER all shared sub-scripts and BEFORE page-specific scripts.
 * It contains core glue code:
 *
 *   - Quick-edit modal (shift-click on calendar chits)
 *   - Recurrence instance actions (complete, break off, delete sub-menu)
 *   - Notes masonry layout (column-persistent card positioning)
 *   - Delete undo toast
 *   - Audio unlock system (iOS/Android)
 *   - Sync client (WebSocket + HTTP polling fallback)
 *   - Version logging
 *
 * Extracted to focused sub-scripts (loaded before this file):
 *   shared-mobile.js   — Mobile sidebar, actions modal, long-press, views button
 *   shared-weather.js  — Saved locations, weather forecast cache
 *   shared-alarms.js   — Global alarm system, quick alert modal, global hotkeys
 *   shared-habits.js   — Habit calculation helpers (period date, success rate, streak)
 *
 * Other sub-scripts loaded before this file (in order):
 *   shared-utils.js, shared-touch.js, shared-checklist.js, shared-sort.js,
 *   shared-indicators.js, shared-calendar.js, shared-tags.js,
 *   shared-recurrence.js, shared-geocoding.js, shared-qr.js, shared-hotkeys.js
 */

// ── Recurrence Instance Actions (Phase R2) ───────────────────────────────────

/**
 * Quick Edit Modal — shift+click on any calendar chit.
 * Shows editable dropdowns for task fields, plus recurrence options if recurring.
 */
function showQuickEditModal(chit, onRefresh) {
  // Never open quick-edit if a drag operation just completed or is in progress
  if (window._dragJustEnded || window._touchDragActive) return;
  // Birthday entries are read-only virtual events — open contact editor instead
  if (chit._isBirthday && chit._contact_id) {
    window.location.href = '/frontend/html/contact-editor.html?id=' + chit._contact_id;
    return;
  }

  document.querySelectorAll('.recurrence-modal-overlay').forEach(el => el.remove());

  const isRecurring = !!(chit._isVirtual && chit._parentId);
  const parentId = chit._parentId || chit.id;
  const chitId = chit._isVirtual ? chit._parentId : chit.id;
  const dateStr = chit._virtualDate;

  const overlay = document.createElement('div');
  overlay.className = 'recurrence-modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fffaf0;border:2px solid #6b4e31;border-radius:8px;padding:24px;min-width:320px;max-width:420px;font-family:Lora, Georgia, serif;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

  const title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 6px 0;color:#4a2c2a;font-size:1.1em;cursor:text;';
  title.textContent = chit.title || '(Untitled)';
  title.title = 'Double-click to edit title';
  title.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    title.contentEditable = 'true';
    title.style.outline = '2px solid #8b4513';
    title.style.borderRadius = '3px';
    title.style.padding = '2px 4px';
    title.focus();
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(title);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const saveTitle = () => {
      title.contentEditable = 'false';
      title.style.outline = '';
      title.style.padding = '';
      const newTitle = title.textContent.trim();
      if (newTitle && newTitle !== chit.title) {
        fetch(`/api/chit/${chitId}`).then(r => r.ok ? r.json() : null).then(fullChit => {
          if (!fullChit) return;
          fullChit.title = newTitle;
          return fetch(`/api/chits/${chitId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fullChit) });
        }).then(() => {
          chit.title = newTitle;
          if (typeof fetchChits === 'function') fetchChits();
        }).catch(() => {});
      }
    };
    title.addEventListener('blur', saveTitle, { once: true });
    title.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') { ke.preventDefault(); title.blur(); }
      if (ke.key === 'Escape') { ke.preventDefault(); title.textContent = chit.title || '(Untitled)'; title.blur(); }
    });
  });
  modal.appendChild(title);

  if (isRecurring) {
    const dateLine = document.createElement('div');
    dateLine.style.cssText = 'margin-bottom:4px;color:#6b4e31;font-size:0.9em;';
    var _recIcon = chit.habit ? '🎯' : '🔁';
    dateLine.textContent = `${_recIcon} ${formatRecurrenceRule(chit.recurrence_rule, !!chit.habit)} — ${dateStr}`;
    if (chit._instanceNum) dateLine.textContent += ` (#${chit._instanceNum})`;
    modal.appendChild(dateLine);

    // Series stats
    const seriesInfo = getRecurrenceSeriesInfo(chit, dateStr);
    if (seriesInfo && seriesInfo.totalPast > 0) {
      const statsLine = document.createElement('div');
      statsLine.style.cssText = 'margin-bottom:12px;color:#6b4e31;font-size:0.8em;opacity:0.8;';
      statsLine.textContent = `✅ ${seriesInfo.completedPast}/${seriesInfo.totalPast} completed (${seriesInfo.successRate}% success rate)`;
      modal.appendChild(statsLine);
    }
  }

  // --- People chips (read-only, with color + thumbnail like chit editor) ---
  if (Array.isArray(chit.people) && chit.people.length > 0) {
    const peopleRow = document.createElement('div');
    peopleRow.className = 'cwoc-people-chips-row';

    // Try to match people names to contacts for color/image
    var _qeContactMap = {};
    if (window._cachedPeopleContacts) {
      window._cachedPeopleContacts.forEach(function (c) {
        _qeContactMap[(c.display_name || '').toLowerCase()] = c;
      });
    }

    chit.people.forEach(name => {
      var match = _qeContactMap[name.toLowerCase()] || null;
      const chip = document.createElement('span');
      chip.className = 'cwoc-people-chip';

      var bgColor = (match && match.color) ? match.color : '#e8dcc8';
      chip.style.backgroundColor = bgColor;
      chip.style.borderColor = bgColor;
      // Contrast text
      var hex = bgColor.replace('#', '');
      if (hex.length === 6) {
        var lum = (parseInt(hex.substr(0,2),16)*299 + parseInt(hex.substr(2,2),16)*587 + parseInt(hex.substr(4,2),16)*114) / 1000;
        chip.style.color = lum > 140 ? '#2b1e0f' : '#fff';
      }

      // Thumbnail
      if (match && match.image_url) {
        var img = document.createElement('img');
        img.src = match.image_url;
        img.style.cssText = 'width:16px;height:16px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:3px;';
        img.onerror = function() { console.warn('[CWOC] Missing profile image for "' + name + '": ' + match.image_url); this.style.display = 'none'; };
        chip.appendChild(img);
      }

      // Display name without prefix
      var chipName = name;
      if (match && match.prefix && chipName.startsWith(match.prefix)) {
        chipName = chipName.substring(match.prefix.length).trim();
      }
      chip.appendChild(document.createTextNode(chipName));

      // Double-click to open contact editor
      if (match && match.id) {
        chip.style.cursor = 'pointer';
        chip.title = 'Double-click to edit contact';
        chip.addEventListener('dblclick', function (e) {
          e.stopPropagation();
          window.location.href = '/frontend/html/contact-editor.html?id=' + encodeURIComponent(match.id);
        });
      }

      peopleRow.appendChild(chip);
    });

    modal.appendChild(peopleRow);

    // After render, check for overflow and add "+N more" if needed
    requestAnimationFrame(() => {
      const rowHeight = peopleRow.offsetHeight;
      const chips = Array.from(peopleRow.querySelectorAll('.cwoc-people-chip'));
      if (chips.length === 0) return;
      const firstTop = chips[0].offsetTop;
      // Find chips that overflow past the first row
      let visibleCount = 0;
      for (const c of chips) {
        if (c.offsetTop <= firstTop + chips[0].offsetHeight + 4) {
          visibleCount++;
        } else {
          break;
        }
      }
      const hiddenCount = chips.length - visibleCount;
      if (hiddenCount > 0) {
        // Hide overflowing chips
        for (let i = visibleCount; i < chips.length; i++) {
          chips[i].style.display = 'none';
        }
        // Add "+N more" indicator
        const more = document.createElement('span');
        more.className = 'cwoc-people-chip cwoc-people-more';
        more.textContent = `+${hiddenCount} more`;
        more.title = chit.people.join(', ');
        peopleRow.appendChild(more);
      }
    });
  }

  const btnStyle = 'display:block;width:100%;padding:10px 12px;margin-bottom:8px;border:1px solid #6b4e31;border-radius:4px;background:#fdf5e6;color:#4a2c2a;font-family:inherit;font-size:0.95em;cursor:pointer;text-align:left;';
  const selStyle = 'padding:4px 6px;border:1px solid #6b4e31;border-radius:4px;background:#fdf5e6;color:#4a2c2a;font-family:inherit;font-size:0.9em;flex:1;';
  const rowStyle = 'display:flex;align-items:center;gap:8px;padding:6px 12px;margin-bottom:6px;border:1px solid #d4c5a9;border-radius:4px;background:#fdf5e6;font-size:0.9em;';

  function addBtn(label, icon, onClick) {
    const btn = document.createElement('button');
    btn.style.cssText = btnStyle;
    btn.innerHTML = `${icon} ${label}`;
    btn.onmouseover = function() { this.style.background = '#f0e6d3'; };
    btn.onmouseout = function() { this.style.background = '#fdf5e6'; };
    btn.addEventListener('click', () => { close(); onClick(); });
    modal.appendChild(btn);
  }

  function addSep() {
    const hr = document.createElement('hr');
    hr.style.cssText = 'border:none;border-top:1px solid #d4c5a9;margin:12px 0;';
    modal.appendChild(hr);
  }

  function close() { overlay.remove(); }

  // --- Editable Task Fields (only show fields that already have values) ---
  let pendingChanges = {};
  let hasTaskFields = false;

  // Track per-field "all instances" state
  const allInstancesFlags = {};

  function addDropdown(icon, label, fieldKey, currentVal, options, onChange) {
    hasTaskFields = true;
    const row = document.createElement('div');
    row.style.cssText = rowStyle;
    const lbl = document.createElement('span');
    lbl.style.cssText = 'color:#6b4e31;white-space:nowrap;';
    lbl.textContent = `${icon} ${label}:`;
    const sel = document.createElement('select');
    sel.style.cssText = selStyle;
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt || '—';
      if (opt === currentVal) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    row.appendChild(lbl);
    row.appendChild(sel);

    // Inline "All" checkbox for recurring chits
    if (isRecurring) {
      const allCb = document.createElement('input');
      allCb.type = 'checkbox';
      allCb.title = 'Apply to all instances';
      allCb.style.cssText = 'margin:0;cursor:pointer;flex-shrink:0;';
      allCb.addEventListener('change', () => { allInstancesFlags[fieldKey] = allCb.checked; });
      const allLbl = document.createElement('span');
      allLbl.textContent = 'All';
      allLbl.style.cssText = 'font-size:0.8em;color:#6b4e31;white-space:nowrap;cursor:pointer;';
      allLbl.title = 'Apply to all instances';
      allLbl.addEventListener('click', () => { allCb.checked = !allCb.checked; allInstancesFlags[fieldKey] = allCb.checked; });
      row.appendChild(allCb);
      row.appendChild(allLbl);
    }

    modal.appendChild(row);
  }

  if (chit.priority) addDropdown('🔺', 'Priority', 'priority', chit.priority, ['', 'High', 'Medium', 'Low'], (v) => { pendingChanges.priority = v || null; });
  if (chit.severity) addDropdown('⚠️', 'Severity', 'severity', chit.severity, ['', 'Critical', 'Major', 'Normal', 'Minor'], (v) => { pendingChanges.severity = v || null; });
  if (chit.status) addDropdown('📋', 'Status', 'status', chit.status, ['', 'ToDo', 'In Progress', 'Blocked', 'Complete', 'Rejected'], (v) => { pendingChanges.status = v || null; });

  if (hasTaskFields) {
    const saveRow = document.createElement('div');
    saveRow.style.cssText = 'text-align:right;margin-bottom:4px;';
    const saveBtn = document.createElement('button');
    saveBtn.style.cssText = 'padding:6px 16px;border:1px solid #6b4e31;border-radius:4px;background:#d4c5a9;color:#4a2c2a;font-family:inherit;font-size:0.85em;cursor:pointer;';
    saveBtn.textContent = 'Save Changes';
    saveBtn.onmouseover = function() { this.style.background = '#c4b599'; };
    saveBtn.onmouseout = function() { this.style.background = '#d4c5a9'; };
    saveBtn.addEventListener('click', async () => {
      if (Object.keys(pendingChanges).length === 0) { close(); return; }
      try {
        if (isRecurring) {
          // Split changes: fields with "All" checked go to parent, others go to exception
          const parentChanges = {};
          const instanceChanges = {};
          for (const [key, val] of Object.entries(pendingChanges)) {
            if (allInstancesFlags[key]) {
              parentChanges[key] = val;
            } else {
              instanceChanges[key] = val;
            }
          }
          // Save instance-only changes as exception
          if (Object.keys(instanceChanges).length > 0) {
            const exception = { date: dateStr, ...instanceChanges };
            if (instanceChanges.status === 'Complete') exception.completed = true;
            await fetch(`/api/chits/${chitId}/recurrence-exceptions`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ exception })
            });
          }
          // Save all-instances changes to parent
          if (Object.keys(parentChanges).length > 0) {
            const resp = await fetch(`/api/chit/${chitId}`);
            if (!resp.ok) throw new Error('Chit not found');
            const fullChit = await resp.json();
            Object.assign(fullChit, parentChanges);
            if (parentChanges.status === 'Complete' && !fullChit.completed_datetime) {
              fullChit.completed_datetime = new Date().toISOString();
            }
            await fetch(`/api/chits/${chitId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fullChit)
            });
          }
        } else {
          // Non-recurring: save directly to chit
          const resp = await fetch(`/api/chit/${chitId}`);
          if (!resp.ok) throw new Error('Chit not found');
          const fullChit = await resp.json();
          Object.assign(fullChit, pendingChanges);
          if (pendingChanges.status === 'Complete' && !fullChit.completed_datetime) {
            fullChit.completed_datetime = new Date().toISOString();
          }
          await fetch(`/api/chits/${chitId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullChit)
          });
        }
        close();
        if (typeof syncSend === 'function') syncSend('chits_changed', {});
        if (typeof cwocTabSyncInvalidate === 'function') cwocTabSyncInvalidate();
        if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh();
      } catch (e) {
        console.error('Quick edit save failed:', e);
        cwocToast('Failed to save changes.', 'error');
      }
    });
    saveRow.appendChild(saveBtn);
    modal.appendChild(saveRow);
  }

  // --- RSVP controls for shared chits (Requirement 2.5) ---
  var _qeRsvpUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  var _qeRsvpShares = Array.isArray(chit.shares) ? chit.shares : [];
  if (_qeRsvpUser && chit._shared && chit.owner_id !== _qeRsvpUser.user_id) {
    var _qeUserShare = _qeRsvpShares.find(function(s) { return s.user_id === _qeRsvpUser.user_id; });
    if (_qeUserShare) {
      var _qeRsvpStatus = _qeUserShare.rsvp_status || 'invited';
      var rsvpRow = document.createElement('div');
      rsvpRow.style.cssText = rowStyle;

      var rsvpLabel = document.createElement('span');
      rsvpLabel.style.cssText = 'color:#6b4e31;white-space:nowrap;';
      rsvpLabel.textContent = '📨 RSVP:';
      rsvpRow.appendChild(rsvpLabel);

      var rsvpBtnWrap = document.createElement('span');
      rsvpBtnWrap.className = 'cwoc-rsvp-actions';
      rsvpBtnWrap.style.cssText = 'display:inline-flex;align-items:center;gap:4px;';

      var qeAcceptBtn = document.createElement('button');
      qeAcceptBtn.className = 'cwoc-rsvp-btn cwoc-rsvp-accept-btn';
      if (_qeRsvpStatus === 'accepted') qeAcceptBtn.classList.add('cwoc-rsvp-btn-active');
      qeAcceptBtn.textContent = '✓ Accept';
      qeAcceptBtn.title = 'Accept invitation';
      qeAcceptBtn.style.cssText = 'padding:4px 10px;border:1px solid #c4a882;border-radius:4px;background:rgba(255,255,255,0.3);cursor:pointer;font-size:0.85em;font-family:inherit;color:#4a2c2a;';
      if (_qeRsvpStatus === 'accepted') qeAcceptBtn.style.cssText += 'background:rgba(46,125,50,0.2);border-color:#2e7d32;color:#2e7d32;';

      var qeDeclineBtn = document.createElement('button');
      qeDeclineBtn.className = 'cwoc-rsvp-btn cwoc-rsvp-decline-btn';
      if (_qeRsvpStatus === 'declined') qeDeclineBtn.classList.add('cwoc-rsvp-btn-active');
      qeDeclineBtn.textContent = '✗ Decline';
      qeDeclineBtn.title = 'Decline invitation';
      qeDeclineBtn.style.cssText = 'padding:4px 10px;border:1px solid #c4a882;border-radius:4px;background:rgba(255,255,255,0.3);cursor:pointer;font-size:0.85em;font-family:inherit;color:#4a2c2a;';
      if (_qeRsvpStatus === 'declined') qeDeclineBtn.style.cssText += 'background:rgba(178,34,34,0.15);border-color:#b22222;color:#b22222;';

      qeAcceptBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var prevStatus = _qeRsvpStatus;
        qeAcceptBtn.style.background = 'rgba(46,125,50,0.2)';
        qeAcceptBtn.style.borderColor = '#2e7d32';
        qeAcceptBtn.style.color = '#2e7d32';
        qeDeclineBtn.style.background = 'rgba(255,255,255,0.3)';
        qeDeclineBtn.style.borderColor = '#c4a882';
        qeDeclineBtn.style.color = '#4a2c2a';
        fetch('/api/chits/' + chit.id + '/rsvp', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rsvp_status: 'accepted' })
        }).then(function(r) {
          if (r.ok) {
            close();
            if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh();
          } else {
            console.error('RSVP accept failed:', r.status);
            // Revert button styles
            if (prevStatus === 'accepted') { qeAcceptBtn.style.background = 'rgba(46,125,50,0.2)'; qeAcceptBtn.style.borderColor = '#2e7d32'; qeAcceptBtn.style.color = '#2e7d32'; }
            else { qeAcceptBtn.style.background = 'rgba(255,255,255,0.3)'; qeAcceptBtn.style.borderColor = '#c4a882'; qeAcceptBtn.style.color = '#4a2c2a'; }
            if (prevStatus === 'declined') { qeDeclineBtn.style.background = 'rgba(178,34,34,0.15)'; qeDeclineBtn.style.borderColor = '#b22222'; qeDeclineBtn.style.color = '#b22222'; }
          }
        }).catch(function(err) {
          console.error('RSVP accept error:', err);
          if (prevStatus === 'accepted') { qeAcceptBtn.style.background = 'rgba(46,125,50,0.2)'; qeAcceptBtn.style.borderColor = '#2e7d32'; qeAcceptBtn.style.color = '#2e7d32'; }
          else { qeAcceptBtn.style.background = 'rgba(255,255,255,0.3)'; qeAcceptBtn.style.borderColor = '#c4a882'; qeAcceptBtn.style.color = '#4a2c2a'; }
          if (prevStatus === 'declined') { qeDeclineBtn.style.background = 'rgba(178,34,34,0.15)'; qeDeclineBtn.style.borderColor = '#b22222'; qeDeclineBtn.style.color = '#b22222'; }
        });
      });

      qeDeclineBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var prevStatus = _qeRsvpStatus;
        qeDeclineBtn.style.background = 'rgba(178,34,34,0.15)';
        qeDeclineBtn.style.borderColor = '#b22222';
        qeDeclineBtn.style.color = '#b22222';
        qeAcceptBtn.style.background = 'rgba(255,255,255,0.3)';
        qeAcceptBtn.style.borderColor = '#c4a882';
        qeAcceptBtn.style.color = '#4a2c2a';
        fetch('/api/chits/' + chit.id + '/rsvp', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rsvp_status: 'declined' })
        }).then(function(r) {
          if (r.ok) {
            close();
            if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh();
          } else {
            console.error('RSVP decline failed:', r.status);
            if (prevStatus === 'declined') { qeDeclineBtn.style.background = 'rgba(178,34,34,0.15)'; qeDeclineBtn.style.borderColor = '#b22222'; qeDeclineBtn.style.color = '#b22222'; }
            else { qeDeclineBtn.style.background = 'rgba(255,255,255,0.3)'; qeDeclineBtn.style.borderColor = '#c4a882'; qeDeclineBtn.style.color = '#4a2c2a'; }
            if (prevStatus === 'accepted') { qeAcceptBtn.style.background = 'rgba(46,125,50,0.2)'; qeAcceptBtn.style.borderColor = '#2e7d32'; qeAcceptBtn.style.color = '#2e7d32'; }
          }
        }).catch(function(err) {
          console.error('RSVP decline error:', err);
          if (prevStatus === 'declined') { qeDeclineBtn.style.background = 'rgba(178,34,34,0.15)'; qeDeclineBtn.style.borderColor = '#b22222'; qeDeclineBtn.style.color = '#b22222'; }
          else { qeDeclineBtn.style.background = 'rgba(255,255,255,0.3)'; qeDeclineBtn.style.borderColor = '#c4a882'; qeDeclineBtn.style.color = '#4a2c2a'; }
          if (prevStatus === 'accepted') { qeAcceptBtn.style.background = 'rgba(46,125,50,0.2)'; qeAcceptBtn.style.borderColor = '#2e7d32'; qeAcceptBtn.style.color = '#2e7d32'; }
        });
      });

      rsvpBtnWrap.appendChild(qeAcceptBtn);
      rsvpBtnWrap.appendChild(qeDeclineBtn);
      rsvpRow.appendChild(rsvpBtnWrap);

      // Show current status text
      var rsvpStatusText = document.createElement('span');
      rsvpStatusText.style.cssText = 'font-size:0.8em;color:#6b4e31;opacity:0.8;';
      if (_qeRsvpStatus === 'accepted') rsvpStatusText.textContent = '(accepted)';
      else if (_qeRsvpStatus === 'declined') rsvpStatusText.textContent = '(declined)';
      else rsvpStatusText.textContent = '(pending)';
      rsvpRow.appendChild(rsvpStatusText);

      modal.appendChild(rsvpRow);
    }
  }

  // --- Recurrence actions (only for recurring chits) ---
  if (isRecurring) {
    addSep();
    const recRow = document.createElement('div');
    recRow.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';
    const recBtnStyle = 'flex:1;padding:8px;border:1px solid #6b4e31;border-radius:4px;background:#fdf5e6;font-size:1.2em;cursor:pointer;text-align:center;';

    const editSeriesBtn = document.createElement('button');
    editSeriesBtn.style.cssText = recBtnStyle;
    editSeriesBtn.textContent = '✏️🔁';
    editSeriesBtn.title = 'Edit entire series';
    editSeriesBtn.onmouseover = function() { this.style.background = '#f0e6d3'; };
    editSeriesBtn.onmouseout = function() { this.style.background = '#fdf5e6'; };
    editSeriesBtn.addEventListener('click', () => {
      close();
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = `/editor?id=${parentId}`;
    });
    recRow.appendChild(editSeriesBtn);

    const editInstanceBtn = document.createElement('button');
    editInstanceBtn.style.cssText = recBtnStyle;
    editInstanceBtn.textContent = '✏️1️⃣';
    editInstanceBtn.title = 'Edit only this one instance (keeps series)';
    editInstanceBtn.onmouseover = function() { this.style.background = '#f0e6d3'; };
    editInstanceBtn.onmouseout = function() { this.style.background = '#fdf5e6'; };
    editInstanceBtn.addEventListener('click', () => {
      close();
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = `/editor?id=${parentId}&instance=${dateStr}`;
    });
    recRow.appendChild(editInstanceBtn);

    const breakOffBtn = document.createElement('button');
    breakOffBtn.style.cssText = recBtnStyle;
    breakOffBtn.textContent = '✏️✂️';
    breakOffBtn.title = 'Break off from series & edit as standalone';
    breakOffBtn.onmouseover = function() { this.style.background = '#f0e6d3'; };
    breakOffBtn.onmouseout = function() { this.style.background = '#fdf5e6'; };
    breakOffBtn.addEventListener('click', async () => {
      close();
      await _recurrenceBreakOff(parentId, chit, dateStr);
      if (onRefresh) onRefresh();
    });
    recRow.appendChild(breakOffBtn);

    modal.appendChild(recRow);
  }

  // --- Pin / Snooze / Delete row ---
  addSep();
  const actionRow = document.createElement('div');
  actionRow.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';

  const iconBtnStyle = 'flex:1;padding:8px;border:1px solid #6b4e31;border-radius:4px;font-family:inherit;font-size:0.9em;cursor:pointer;text-align:center;';

  // Pin toggle
  const pinBtn = document.createElement('button');
  pinBtn.style.cssText = iconBtnStyle + `background:${chit.pinned ? '#d4c5a9' : '#fdf5e6'};`;
  pinBtn.innerHTML = `<i class="fas fa-bookmark"></i> ${chit.pinned ? 'Unpin' : 'Pin'}`;
  pinBtn.title = chit.pinned ? 'Unpin this chit' : 'Pin this chit';
  pinBtn.addEventListener('click', async () => {
    try {
      const resp = await fetch(`/api/chit/${chitId}`);
      if (!resp.ok) return;
      const fullChit = await resp.json();
      fullChit.pinned = !fullChit.pinned;
      await fetch(`/api/chits/${chitId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fullChit) });
      close();
      if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh();
    } catch (e) { console.error('Pin toggle failed:', e); }
  });
  actionRow.appendChild(pinBtn);

  // Snooze button
  const isSnoozed = chit.snoozed_until && new Date(chit.snoozed_until) > new Date();
  const snzBtn = document.createElement('button');
  snzBtn.style.cssText = iconBtnStyle + `background:${isSnoozed ? '#d4c5a9' : '#fdf5e6'};color:#666;`;
  snzBtn.innerHTML = isSnoozed ? '😴 Unsnooze' : '😴 Snooze';
  snzBtn.title = isSnoozed ? 'Wake up now' : 'Snooze this chit';
  snzBtn.addEventListener('click', async () => {
    if (isSnoozed) {
      // Unsnooze
      try {
        await fetch(`/api/chits/${chitId}/snooze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ until: null }) });
        close();
        if (typeof cwocToast === 'function') cwocToast('Chit unsnoozed.', 'info');
        if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh();
      } catch (e) { console.error('Unsnooze failed:', e); }
    } else {
      // Show inline snooze presets
      _showSnoozeSubMenu(actionRow, snzBtn, chitId, close, onRefresh);
    }
  });
  actionRow.appendChild(snzBtn);

  // Delete — always present, shows sub-options for recurring
  const delBtn = document.createElement('button');
  delBtn.style.cssText = iconBtnStyle + 'background:#fdf5e6;color:#a33;';
  delBtn.innerHTML = '🗑️ Delete';
  delBtn.title = 'Delete this chit';
  delBtn.addEventListener('click', async () => {
    if (isRecurring) {
      // Show delete sub-menu inline
      _showDeleteSubMenu(actionRow, delBtn, parentId, chitId, dateStr, chit, close, onRefresh);
    } else {
      if (!(await cwocConfirm('Delete this chit?', { title: 'Delete Chit', confirmLabel: '🗑️ Delete', danger: true }))) return;
      var delTitle = chit.title || '(Untitled)';
      var delId = chitId;
      fetch('/api/chits/' + delId, { method: 'DELETE' }).then(function () {
        close();
        if (typeof fetchChits === 'function') fetchChits();
        else if (onRefresh) onRefresh();
        _showDeleteUndoToast(delId, delTitle, null, function () {
          fetch('/api/trash/' + delId + '/restore', { method: 'POST' })
            .then(function () { if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh(); })
            .catch(function (err) { console.error('Undo restore failed:', err); });
        });
      }).catch(function (err) { console.error('Delete failed:', err); });
    }
  });
  actionRow.appendChild(delBtn);

  // QR code button
  const qrBtn = document.createElement('button');
  qrBtn.style.cssText = iconBtnStyle + 'background:#fdf5e6;';
  qrBtn.innerHTML = '📱 QR';
  qrBtn.title = '📦 Data QR (Shift+click for 🔗 Link QR)';
  qrBtn.addEventListener('click', (ev) => {
    const url = `${window.location.origin}/frontend/html/editor.html?id=${chitId}`;
    const isLink = ev.shiftKey;

    if (isLink) {
      showQRModal({ title: '🔗 Link QR Code', data: url, info: url });
    } else {
      const chitData = { _cwoc: window._instanceId || 'unknown', id: chitId, title: chit.title || '', status: chit.status || '', priority: chit.priority || '', tags: (chit.tags || []).join(';'), note: (chit.note || '').slice(0, 300) };
      const json = JSON.stringify(chitData);
      showQRModal({ title: '📦 Data QR Code', data: json, ecl: json.length > 500 ? 'L' : 'M', info: json.length + ' chars encoded' });
      if (!window._instanceId) {
        fetch('/api/instance-id').then(r => r.ok ? r.json() : {}).then(d => { window._instanceId = d.instance_id || 'unknown'; }).catch(() => {});
      }
    }
  });
  actionRow.appendChild(qrBtn);

  modal.appendChild(actionRow);

  // Open in editor (only for non-recurring — recurring has edit buttons in the recurrence row)
  if (!isRecurring) {
    addBtn('Open in editor', '📝', () => {
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = `/editor?id=${chitId}`;
    });
  }

  // Cancel
  const cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = btnStyle + 'margin-top:8px;text-align:center;background:#e8dcc8;font-weight:bold;';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onmouseover = function() { this.style.background = '#d4c5a9'; };
  cancelBtn.onmouseout = function() { this.style.background = '#e8dcc8'; };
  cancelBtn.addEventListener('click', close);
  modal.appendChild(cancelBtn);

  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
  function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } }
  document.addEventListener('keydown', onKey);
}

/**
 * Show inline snooze presets in the quick-edit modal.
 */
function _showSnoozeSubMenu(actionRow, snzBtn, chitId, closeModal, onRefresh) {
  // Replace action row content with snooze presets
  var presets = [
    { label: '15 min', minutes: 15 },
    { label: '1 hour', minutes: 60 },
    { label: '4 hours', minutes: 240 },
    { label: '1 day', minutes: 1440 },
    { label: '3 days', minutes: 4320 },
    { label: '1 week', minutes: 10080 },
  ];
  var container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;';
  presets.forEach(function(p) {
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:6px 10px;border:1px solid #c4a882;border-radius:4px;background:#fdf5e6;color:#4a2c2a;font-family:Lora,Georgia,serif;font-size:0.8em;cursor:pointer;';
    btn.textContent = p.label;
    btn.addEventListener('click', async function() {
      try {
        await fetch('/api/chits/' + chitId + '/snooze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: p.minutes }) });
        closeModal();
        if (typeof cwocToast === 'function') cwocToast('Snoozed for ' + p.label, 'info');
        if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh();
      } catch (e) { console.error('Snooze failed:', e); }
    });
    container.appendChild(btn);
  });
  var cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = 'padding:6px 10px;border:1px solid #999;border-radius:4px;background:transparent;color:#666;font-family:Lora,Georgia,serif;font-size:0.8em;cursor:pointer;';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', function() { container.remove(); });
  container.appendChild(cancelBtn);
  actionRow.parentElement.appendChild(container);
}

/**
 * Show the "Add to Bundle" modal for an email chit.
 * Allows user to choose between subject or sender matching, then select a bundle.
 * @param {object} chit — the email chit object
 */
function _showAddToBundleModal(chit) {
  console.log('[AddToBundle] Opening modal for chit:', chit.id, chit.title);
  
  // Remove any existing modal
  var existing = document.getElementById('addToBundleModalOverlay');
  if (existing) existing.remove();

  // Create modal overlay
  var overlay = document.createElement('div');
  overlay.id = 'addToBundleModalOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

  // Create modal content
  var modal = document.createElement('div');
  modal.style.cssText = 'background:url("/static/parchment.jpg") center/cover;background-color:#fffaf0;border:2px solid #6b4e31;border-radius:12px;padding:24px;max-width:500px;width:90%;font-family:Lora,Georgia,serif;box-shadow:0 8px 24px rgba(0,0,0,0.4);';

  // Title
  var title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 20px 0;color:#1a1208;font-size:1.3em;text-align:center;';
  title.textContent = 'Add Email to Bundle';
  modal.appendChild(title);

  // Email info
  var emailInfo = document.createElement('div');
  emailInfo.style.cssText = 'background:rgba(255,255,255,0.3);border:1px solid #d4c4a8;border-radius:6px;padding:12px;margin-bottom:20px;font-size:0.9em;';
  
  var subject = chit.title || chit.email_subject || '(No Subject)';
  var sender = chit.email_from || '(Unknown Sender)';
  
  emailInfo.innerHTML = '<strong>Subject:</strong> ' + _escHtml(subject) + '<br><strong>From:</strong> ' + _escHtml(sender);
  modal.appendChild(emailInfo);

  // Match type selection
  var matchLabel = document.createElement('label');
  matchLabel.style.cssText = 'display:block;margin-bottom:16px;font-weight:bold;color:#1a1208;';
  matchLabel.textContent = 'Match emails by:';
  modal.appendChild(matchLabel);

  var matchOptions = document.createElement('div');
  matchOptions.style.cssText = 'margin-bottom:20px;';

  // Subject radio
  var subjectRadio = document.createElement('input');
  subjectRadio.type = 'radio';
  subjectRadio.name = 'matchType';
  subjectRadio.value = 'subject';
  subjectRadio.id = 'matchSubject';
  
  var subjectLabel = document.createElement('label');
  subjectLabel.htmlFor = 'matchSubject';
  subjectLabel.style.cssText = 'display:block;margin-bottom:8px;cursor:pointer;';
  subjectLabel.innerHTML = '<input type="radio" name="matchType" value="subject" style="margin-right:8px;"> Subject: "' + _escHtml(subject) + '"';
  
  // Sender radio (default)
  var senderLabel = document.createElement('label');
  senderLabel.htmlFor = 'matchSender';
  senderLabel.style.cssText = 'display:block;cursor:pointer;';
  senderLabel.innerHTML = '<input type="radio" name="matchType" value="sender" checked style="margin-right:8px;"> Sender: "' + _escHtml(sender) + '"';

  matchOptions.appendChild(senderLabel);
  matchOptions.appendChild(subjectLabel);
  modal.appendChild(matchOptions);

  // Bundle selection
  var bundleLabel = document.createElement('label');
  bundleLabel.style.cssText = 'display:block;margin-bottom:8px;font-weight:bold;color:#1a1208;';
  bundleLabel.textContent = 'Add to bundle:';
  modal.appendChild(bundleLabel);

  var bundleSelect = document.createElement('select');
  bundleSelect.style.cssText = 'width:100%;padding:8px;border:1px solid #6b4e31;border-radius:4px;background:#fffaf0;font-family:inherit;margin-bottom:20px;';
  bundleSelect.innerHTML = '<option value="">Loading bundles...</option>';
  modal.appendChild(bundleSelect);

  // Load bundles
  _loadBundlesForModal(bundleSelect);

  // Buttons
  var buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;';

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding:8px 16px;border:1px solid #6b4e31;background:#f5f0e8;color:#1a1208;border-radius:4px;cursor:pointer;font-family:inherit;';
  cancelBtn.onclick = function() { overlay.remove(); };

  var addBtn = document.createElement('button');
  addBtn.textContent = 'Add to Bundle';
  addBtn.style.cssText = 'padding:8px 16px;border:1px solid #6b4e31;background:#6b4e31;color:#fdf5e6;border-radius:4px;cursor:pointer;font-family:inherit;';
  addBtn.onclick = function() { _executeAddToBundle(chit, overlay); };

  buttonRow.appendChild(cancelBtn);
  buttonRow.appendChild(addBtn);
  modal.appendChild(buttonRow);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // ESC to close
  var escHandler = function(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      overlay.remove();
      document.removeEventListener('keydown', escHandler, true);
    }
  };
  document.addEventListener('keydown', escHandler, true);

  // Click overlay to close
  overlay.onclick = function(e) {
    if (e.target === overlay) overlay.remove();
  };
}

/**
 * Load bundles into the bundle selection dropdown.
 * @param {HTMLSelectElement} selectEl — the select element to populate
 */
function _loadBundlesForModal(selectEl) {
  // Try to get bundles from cached settings first
  if (window._cwocSettings && window._cwocSettings.bundles) {
    _populateBundleSelect(selectEl, window._cwocSettings.bundles);
    return;
  }

  // Fall back to fetching settings
  if (typeof getCachedSettings === 'function') {
    getCachedSettings().then(function(settings) {
      var bundles = (settings && settings.bundles) || [];
      _populateBundleSelect(selectEl, bundles);
    }).catch(function(err) {
      console.error('[AddToBundle] Failed to load bundles:', err);
      selectEl.innerHTML = '<option value="">Error loading bundles</option>';
    });
  } else {
    selectEl.innerHTML = '<option value="">No bundles available</option>';
  }
}

/**
 * Populate the bundle select dropdown with bundle options.
 * @param {HTMLSelectElement} selectEl — the select element
 * @param {Array} bundles — array of bundle objects
 */
function _populateBundleSelect(selectEl, bundles) {
  selectEl.innerHTML = '';
  
  if (!bundles || bundles.length === 0) {
    selectEl.innerHTML = '<option value="">No bundles available</option>';
    return;
  }

  // Add default option
  var defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a bundle...';
  selectEl.appendChild(defaultOption);

  // Filter out "Everything Else" bundle (catch-all, can't add rules to it)
  var availableBundles = bundles.filter(function(b) {
    return b.name !== 'Everything Else';
  });

  // Sort by display order
  availableBundles.sort(function(a, b) {
    return (a.display_order || 0) - (b.display_order || 0);
  });

  availableBundles.forEach(function(bundle) {
    var option = document.createElement('option');
    option.value = bundle.id;
    option.textContent = bundle.name;
    if (bundle.description) {
      option.title = bundle.description;
    }
    selectEl.appendChild(option);
  });
}

/**
 * Execute the "Add to Bundle" action.
 * @param {object} chit — the email chit
 * @param {HTMLElement} overlay — the modal overlay to close
 */
function _executeAddToBundle(chit, overlay) {
  var matchType = document.querySelector('input[name="matchType"]:checked');
  var bundleSelect = overlay.querySelector('select');
  
  if (!matchType || !bundleSelect.value) {
    cwocToast('Please select a match type and bundle.', 'error');
    return;
  }

  var bundleId = bundleSelect.value;
  var matchBy = matchType.value;
  
  // Get the match value
  var matchValue;
  if (matchBy === 'subject') {
    matchValue = chit.title || chit.email_subject || '';
  } else if (matchBy === 'sender') {
    matchValue = chit.email_from || '';
    // Extract just the email address from "Name <email>" format
    var emailMatch = matchValue.match(/<([^>]+)>/);
    if (emailMatch) {
      matchValue = emailMatch[1];
    }
  }

  if (!matchValue.trim()) {
    cwocToast('No ' + matchBy + ' found to match against.', 'error');
    return;
  }

  console.log('[AddToBundle] Adding rule:', { bundleId, matchBy, matchValue });

  // Call the API to add the rule
  fetch('/api/bundles/' + encodeURIComponent(bundleId) + '/add-rule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      match_type: matchBy,
      match_value: matchValue.trim()
    })
  })
  .then(function(response) {
    if (!response.ok) {
      return response.json().then(function(err) {
        throw new Error(err.detail || 'Failed to add rule');
      });
    }
    return response.json();
  })
  .then(function(result) {
    overlay.remove();
    cwocToast('Added rule to bundle successfully!', 'success');
    
    // Immediately move THIS email to the target bundle (instant feedback)
    // Strip old bundle tags and add the new one
    var bundleName = result.bundle_name;
    if (bundleName && chit.id) {
      fetch('/api/chit/' + encodeURIComponent(chit.id))
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(fullChit) {
          if (!fullChit) return;
          var tags = fullChit.tags || [];
          if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch(e) { tags = []; } }
          // Strip all existing bundle tags
          tags = tags.filter(function(t) {
            return !(typeof t === 'string' && t.indexOf('CWOC_System/Bundle/') === 0);
          });
          // Add the new bundle tag
          tags.push('CWOC_System/Bundle/' + bundleName);
          fullChit.tags = tags;
          // Serialize email array fields back to strings for PUT
          ['email_to', 'email_cc', 'email_bcc'].forEach(function(f) {
            if (Array.isArray(fullChit[f])) fullChit[f] = JSON.stringify(fullChit[f]);
          });
          return fetch('/api/chits/' + encodeURIComponent(chit.id), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullChit)
          });
        })
        .catch(function(e) { console.error('[AddToBundle] Immediate move failed:', e); });
    }

    // Trigger reclassification for all OTHER matching emails
    return fetch('/api/bundles/reclassify', { method: 'POST' });
  })
  .then(function(reclassifyResp) {
    if (reclassifyResp && reclassifyResp.ok) {
      console.log('[AddToBundle] Reclassification triggered');
      // Invalidate settings cache and refresh
      if (typeof _invalidateSettingsCache === 'function') _invalidateSettingsCache();
      if (typeof fetchChits === 'function') fetchChits();
    }
  })
  .catch(function(err) {
    console.error('[AddToBundle] Error:', err);
    cwocToast('Failed to add rule: ' + err.message, 'error');
  });
}

/**
 * Show a positioned context menu for a chit (right-click style).
 * Uses the same visual style as the project quick menu: parchment background,
 * positioned at cursor, menu items with hover highlight and icons.
 *
 * @param {MouseEvent} e — the contextmenu event (for positioning)
 * @param {object} chit — the chit object
 * @param {function} onRefresh — callback after changes (usually displayChits)
 */
function _showChitContextMenu(e, chit, onRefresh) {
  console.log('[ContextMenu] Opening for chit:', chit.id, chit.title);
  // Remove any existing context menu
  document.querySelectorAll('.cwoc-chit-context-menu-overlay').forEach(function(el) { el.remove(); });

  var chitId = chit._isVirtual ? chit._parentId : chit.id;

  var overlay = document.createElement('div');
  overlay.className = 'cwoc-chit-context-menu-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;';

  var menu = document.createElement('div');
  menu.className = 'cwoc-chit-context-menu';
  menu.style.cssText = 'position:fixed;background:url("/static/parchment.jpg") center/cover;background-color:#fffaf0;border:2px solid #6b4e31;border-radius:8px;padding:8px 0;min-width:200px;max-width:200px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Lora,Georgia,serif;';

  // Position near the click, clamped to viewport
  var menuX = Math.min(e.clientX, window.innerWidth - 220);
  var menuY = Math.min(e.clientY, window.innerHeight - 300);
  menu.style.left = menuX + 'px';
  menu.style.top = menuY + 'px';

  function _close() { overlay.remove(); document.removeEventListener('keydown', _escHandler, true); }

  function _menuItem(icon, label, onClick) {
    var item = document.createElement('div');
    item.style.cssText = 'padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:0.95em;color:#1a1208;';
    item.innerHTML = '<span style="width:18px;text-align:center;">' + icon + '</span> ' + label;
    item.addEventListener('mouseenter', function() { this.style.background = '#f0e6d0'; });
    item.addEventListener('mouseleave', function() { this.style.background = ''; });
    item.addEventListener('click', function(ev) {
      ev.stopPropagation();
      console.log('[ContextMenu] Clicked:', label, 'chitId:', chitId);
      _close();
      try { onClick(); } catch (err) { console.error('[ContextMenu] Error in', label, ':', err); }
    });
    menu.appendChild(item);
  }

  // Open in Editor
  _menuItem('<i class="fas fa-pen-to-square" style="color:#6b4e31;"></i>', 'Open in Editor', function() {
    if (typeof storePreviousState === 'function') storePreviousState();
    window.location.href = '/editor?id=' + chitId;
  });

  // Quick Edit (full modal)
  _menuItem('<i class="fas fa-sliders" style="color:#6b4e31;"></i>', 'Quick Edit', function() {
    showQuickEditModal(chit, onRefresh);
  });

  // Add to Bundle (only for emails)
  if (chit.email_message_id || chit.email_status) {
    _menuItem('<i class="fas fa-folder-plus" style="color:#6b4e31;"></i>', 'Add to Bundle', function() {
      _showAddToBundleModal(chit);
    });
  }

  // Separator
  var sep1 = document.createElement('div');
  sep1.style.cssText = 'border-top:1px solid rgba(139,90,43,0.2);margin:4px 0;';
  menu.appendChild(sep1);

  // Pin / Unpin
  var isPinned = !!chit.pinned;
  _menuItem(isPinned ? '<i class="fas fa-bookmark" style="color:#8b5a2b;"></i>' : '<i class="far fa-bookmark" style="color:#6b4e31;"></i>', isPinned ? 'Unpin' : 'Pin', function() {
    fetch('/api/chits/' + chitId + '/fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !isPinned })
    }).then(function(r) {
      if (r.ok) {
        // Update local chit data so re-render reflects the change
        chit.pinned = !isPinned;
        if (typeof chits !== 'undefined') {
          var local = chits.find(function(c) { return c.id === chitId; });
          if (local) local.pinned = !isPinned;
        }
      }
      if (onRefresh) onRefresh();
    }).catch(function(err) { console.error('[ContextMenu] Pin error:', err); });
  });

  // Archive / Unarchive
  var isArchived = !!chit.archived;
  _menuItem(isArchived ? '📦' : '📦', isArchived ? 'Unarchive' : 'Archive', function() {
    var newArchived = !isArchived;
    // Immediately hide locally
    chit.archived = newArchived;
    if (typeof chits !== 'undefined') {
      var local = chits.find(function(c) { return c.id === chitId; });
      if (local) local.archived = newArchived;
    }
    if (onRefresh) onRefresh();
    // Show undo toast
    _showArchiveUndoToast(chit.title, newArchived, function() {
      // Undo: revert the archive state
      chit.archived = !newArchived;
      if (typeof chits !== 'undefined') {
        var local2 = chits.find(function(c) { return c.id === chitId; });
        if (local2) local2.archived = !newArchived;
      }
      if (onRefresh) onRefresh();
      fetch('/api/chits/' + chitId + '/fields', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !newArchived })
      });
    });
    // Persist to server
    fetch('/api/chits/' + chitId + '/fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: newArchived })
    });
  });

  // Snooze
  var isSnoozed = chit.snoozed_until && new Date(chit.snoozed_until) > new Date();
  if (isSnoozed) {
    _menuItem('😴', 'Unsnooze', function() {
      fetch('/api/chits/' + chitId + '/snooze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ until: null }) })
        .then(function() { if (typeof cwocToast === 'function') cwocToast('Unsnoozed.', 'info'); if (onRefresh) onRefresh(); });
    });
  } else {
    // Snooze row: emoji + circular minute buttons
    var snoozeRow = document.createElement('div');
    snoozeRow.style.cssText = 'padding:5px 10px;display:flex;align-items:center;gap:5px;';
    var snoozeEmoji = document.createElement('span');
    snoozeEmoji.style.cssText = 'width:18px;text-align:center;font-size:0.95em;flex-shrink:0;';
    snoozeEmoji.textContent = '😴';
    snoozeRow.appendChild(snoozeEmoji);
    [{mins: 60, label: 'H', title: '1 hour'}, {mins: 1440, label: 'D', title: '1 day'}, {mins: 10080, label: 'W', title: '1 week'}, {mins: 20160, label: 'F', title: '1 fortnight'}, {mins: 43200, label: 'M', title: '1 month'}].forEach(function(opt) {
      var circleBtn = document.createElement('button');
      circleBtn.className = 'cwoc-ctx-snooze-circle';
      circleBtn.textContent = opt.label;
      circleBtn.title = opt.title;
      circleBtn.addEventListener('click', function() {
        _close();
        // Immediately hide the chit locally
        chit.snoozed_until = new Date(Date.now() + opt.mins * 60 * 1000).toISOString();
        if (typeof chits !== 'undefined') {
          var _localChit = chits.find(function(c) { return c.id === chitId; });
          if (_localChit) _localChit.snoozed_until = chit.snoozed_until;
        }
        if (onRefresh) onRefresh();
        _showSnoozeUndoToast(chitId, chit.title, opt.mins, function() {
          fetch('/api/chits/' + chitId + '/snooze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ until: null }) })
            .then(function() {
              chit.snoozed_until = null;
              if (typeof chits !== 'undefined') {
                var _lc = chits.find(function(c) { return c.id === chitId; });
                if (_lc) _lc.snoozed_until = null;
              }
              if (onRefresh) onRefresh();
            });
        });
        // Persist to server
        fetch('/api/chits/' + chitId + '/snooze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: opt.mins }) });
      });
      snoozeRow.appendChild(circleBtn);
    });
    menu.appendChild(snoozeRow);
  }

  // Separator
  var sep2 = document.createElement('div');
  sep2.style.cssText = 'border-top:1px solid rgba(139,90,43,0.2);margin:4px 0;';
  menu.appendChild(sep2);

  // Print Note (only if chit has notes)
  if (chit.note && chit.note.trim()) {
    _menuItem('<i class="fas fa-print" style="color:#6b4e31;"></i>', 'Print Note', function() {
      _printNoteWithChoice(chit.note, chit.title);
    });
  }

  // Delete
  _menuItem('<i class="fas fa-trash-alt" style="color:#a33;"></i>', 'Delete', function() {
    cwocConfirm('Delete this chit?', { title: 'Delete Chit', confirmLabel: '🗑️ Delete', danger: true }).then(function(confirmed) {
      if (!confirmed) return;
      var delTitle = chit.title || '(Untitled)';
      // Immediately hide locally
      chit.deleted = true;
      if (typeof chits !== 'undefined') {
        var _delLocal = chits.find(function(c) { return c.id === chitId; });
        if (_delLocal) _delLocal.deleted = true;
      }
      if (onRefresh) onRefresh();
      if (typeof _showDeleteUndoToast === 'function') {
        _showDeleteUndoToast(chitId, delTitle, null, function() {
          // Undo: restore locally and on server
          chit.deleted = false;
          if (typeof chits !== 'undefined') {
            var _restLocal = chits.find(function(c) { return c.id === chitId; });
            if (_restLocal) _restLocal.deleted = false;
          }
          fetch('/api/trash/' + chitId + '/restore', { method: 'POST' }).then(function() { if (onRefresh) onRefresh(); });
        });
      }
      // Persist to server
      fetch('/api/chits/' + chitId, { method: 'DELETE' });
    });
  });

  // ── Email-specific actions (mark unread, add to bundle) — only in Email view ──
  if ((chit.email_from || chit.email_subject || chit.email_date) && typeof currentTab !== 'undefined' && currentTab === 'Email') {
    var emailSep = document.createElement('div');
    emailSep.style.cssText = 'border-top:1px solid rgba(139,90,43,0.2);margin:4px 0;';
    menu.appendChild(emailSep);

    var isRead = !!chit.email_read;
    _menuItem('<i class="fas fa-envelope' + (isRead ? '' : '-open') + '" style="color:#6b4e31;"></i>', isRead ? 'Mark Unread' : 'Mark Read', function() {
      if (typeof _toggleEmailReadStatus === 'function') {
        var card = document.querySelector('.email-card[data-chit-id="' + chitId + '"]');
        _toggleEmailReadStatus(chit, card);
      }
    });
  }

  overlay.appendChild(menu);
  document.body.appendChild(overlay);

  // Click overlay to close
  overlay.addEventListener('click', function(ev) {
    if (ev.target === overlay) _close();
  });

  // Right-click on overlay: close current menu and open new one on target element
  overlay.addEventListener('contextmenu', function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    _close();
    // Find the element under the cursor (now that overlay is removed)
    var targetEl = document.elementFromPoint(ev.clientX, ev.clientY);
    if (targetEl) {
      // Dispatch a new contextmenu event to the element underneath
      var newEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: ev.clientX,
        clientY: ev.clientY
      });
      targetEl.dispatchEvent(newEvent);
    }
  });

  // ESC to close
  function _escHandler(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      _close();
    }
  }
  document.addEventListener('keydown', _escHandler, true);
}

/**
 * Show a delete sub-menu replacing the delete button with options:
 * This instance / This and following / All / Cancel
 */
function _showDeleteSubMenu(actionRow, delBtn, parentId, chitId, dateStr, chit, closeModal, onRefresh) {
  // Hide all modal content except the delete options
  const modal = actionRow.closest('.recurrence-modal-overlay > div') || actionRow.parentElement;
  const allChildren = Array.from(modal.children);
  const hiddenEls = [];
  allChildren.forEach(el => {
    if (el !== actionRow && el.style.display !== 'none') {
      hiddenEls.push({ el, prev: el.style.display });
      el.style.display = 'none';
    }
  });
  actionRow.style.display = 'none';

  const subMenu = document.createElement('div');
  subMenu.style.cssText = 'display:flex;flex-direction:column;gap:4px;width:100%;';

  const headerEl = document.createElement('h3');
  headerEl.style.cssText = 'margin:0 0 12px 0;color:#a33;font-size:1.05em;';
  headerEl.textContent = '🗑️ Delete — ' + (chit.title || '(Untitled)');
  subMenu.appendChild(headerEl);

  const subBtnStyle = 'padding:8px 10px;border:1px solid #a33;border-radius:4px;background:#fdf5e6;color:#a33;font-family:inherit;font-size:0.9em;cursor:pointer;text-align:left;';

  function addSubBtn(label, onClick) {
    const btn = document.createElement('button');
    btn.style.cssText = subBtnStyle;
    btn.textContent = label;
    btn.onmouseover = function() { this.style.background = '#fce4e4'; };
    btn.onmouseout = function() { this.style.background = '#fdf5e6'; };
    btn.addEventListener('click', async () => {
      await onClick();
      closeModal();
      if (typeof fetchChits === 'function') fetchChits();
      else if (onRefresh) onRefresh();
    });
    subMenu.appendChild(btn);
  }

  addSubBtn('🗑️ Delete this instance', async () => {
    await _recurrenceAddException(parentId, { date: dateStr, broken_off: true });
  });

  addSubBtn('🗑️ Delete this and following', async () => {
    const resp = await fetch(`/api/chit/${parentId}`);
    if (!resp.ok) return;
    const fullChit = await resp.json();
    const rule = fullChit.recurrence_rule || {};
    const endDate = new Date(dateStr);
    endDate.setDate(endDate.getDate() - 1);
    rule.until = endDate.toISOString().slice(0, 10);
    fullChit.recurrence_rule = rule;
    await fetch(`/api/chits/${parentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullChit)
    });
  });

  addSubBtn('🗑️ Delete all (entire series)', async () => {
    if (!(await cwocConfirm('Delete the entire recurring series?', { title: 'Delete Series', confirmLabel: '🗑️ Delete All', danger: true }))) return;
    var seriesTitle = chit.title || '(Untitled)';
    await fetch(`/api/chits/${parentId}`, { method: 'DELETE' });
    close();
    _showDeleteUndoToast(parentId, seriesTitle, null, function () {
      fetch('/api/trash/' + parentId + '/restore', { method: 'POST' })
        .then(function () { if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh(); })
        .catch(function (err) { console.error('Undo restore failed:', err); });
    });
    if (typeof fetchChits === 'function') fetchChits();
    else if (onRefresh) onRefresh();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = 'padding:8px 10px;border:1px solid #6b4e31;border-radius:4px;background:#e8dcc8;color:#4a2c2a;font-family:inherit;font-size:0.9em;cursor:pointer;text-align:center;margin-top:8px;';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    subMenu.remove();
    actionRow.style.display = 'flex';
    hiddenEls.forEach(({ el, prev }) => { el.style.display = prev; });
  });
  subMenu.appendChild(cancelBtn);

  modal.appendChild(subMenu);
}

// Backward compat alias
function showRecurrenceActionModal(chit, onRefresh) { showQuickEditModal(chit, onRefresh); }

/** Add or replace an exception on a recurring chit via PATCH */
async function _recurrenceAddException(parentId, exception) {
  try {
    const resp = await fetch(`/api/chits/${parentId}/recurrence-exceptions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exception })
    });
    if (!resp.ok) throw new Error(await resp.text());
    // Check if series should be auto-archived
    await _checkRecurrenceAutoArchive(parentId);
  } catch (e) {
    console.error('Failed to add recurrence exception:', e);
    cwocToast('Failed to update recurrence instance.', 'error');
  }
}

/**
 * Auto-archive a recurring chit if it has an end date and all instances
 * up to that date are either completed or broken off.
 */
async function _checkRecurrenceAutoArchive(parentId) {
  try {
    const resp = await fetch(`/api/chit/${parentId}`);
    if (!resp.ok) return;
    const chit = await resp.json();
    const rule = chit.recurrence_rule;
    if (!rule || !rule.freq || !rule.until) return; // no end date = infinite series, skip
    if (chit.archived) return; // already archived

    const until = new Date(rule.until);
    const today = new Date();
    if (until > today) return; // series hasn't ended yet

    // Count all instances from start to until
    const info = getCalendarDateInfo(chit);
    if (!info.hasDate) return;

    const exceptions = chit.recurrence_exceptions || [];
    const completedDates = new Set(exceptions.filter(e => e.completed).map(e => e.date));
    const brokenOffDates = new Set(exceptions.filter(e => e.broken_off).map(e => e.date));

    const baseDate = new Date(info.start);
    baseDate.setHours(0, 0, 0, 0);
    const freq = rule.freq;
    const interval = rule.interval || 1;
    const byDay = rule.byDay || [];
    const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const byDayNums = byDay.map(d => dayMap[d]).filter(n => n !== undefined);

    let current = new Date(baseDate);
    let allHandled = true;

    for (let i = 0; i < 730; i++) {
      if (current > until) break;
      const dateStr = current.toISOString().slice(0, 10);
      let dayMatches = true;
      if (freq === 'WEEKLY' && byDayNums.length > 0) {
        dayMatches = byDayNums.includes(current.getDay());
      }
      if (dayMatches && !brokenOffDates.has(dateStr) && !completedDates.has(dateStr)) {
        allHandled = false;
        break;
      }
      // Advance
      if (!_advanceRecurrence(current, freq, interval, byDayNums)) break;
    }

    if (allHandled) {
      chit.archived = true;
      chit.status = 'Complete';
      chit.completed_datetime = new Date().toISOString();
      await fetch(`/api/chits/${parentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chit)
      });
      console.debug(`Auto-archived recurring chit ${parentId} — all instances complete`);
    }
  } catch (e) {
    console.error('Auto-archive check failed:', e);
  }
}

/**
 * Render a series summary showing all instances with their completion status.
 * Shows past instances (up to today + 30 days future), max 50.
 */
function _renderSeriesSummary(container, virtualChit, parentId) {
  container.innerHTML = '<div style="opacity:0.5;font-size:0.8em;padding:4px;">Loading...</div>';

  const rule = virtualChit.recurrence_rule;
  if (!rule || !rule.freq) {
    container.innerHTML = '<div style="opacity:0.5;font-size:0.8em;padding:4px;">No recurrence rule</div>';
    return;
  }

  const exceptions = virtualChit.recurrence_exceptions || [];
  const completedDates = new Set(exceptions.filter(e => e.completed).map(e => e.date));
  const brokenOffDates = new Set(exceptions.filter(e => e.broken_off).map(e => e.date));

  const info = getCalendarDateInfo(virtualChit);
  if (!info.hasDate) { container.innerHTML = ''; return; }

  const baseDate = new Date(info.start);
  baseDate.setHours(0, 0, 0, 0);
  const freq = rule.freq;
  const interval = rule.interval || 1;
  const byDay = rule.byDay || [];
  const until = rule.until ? new Date(rule.until) : null;
  const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const byDayNums = byDay.map(d => dayMap[d]).filter(n => n !== undefined);

  const futureLimit = new Date();
  futureLimit.setDate(futureLimit.getDate() + 30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let current = new Date(baseDate);
  const rows = [];
  const maxRows = 50;

  for (let i = 0; i < 730 && rows.length < maxRows; i++) {
    if (until && current > until) break;
    if (current > futureLimit) break;

    const dateStr = current.toISOString().slice(0, 10);
    let dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      dayMatches = byDayNums.includes(current.getDay());
    }

    if (dayMatches) {
      let status = '⬜';
      let label = 'Upcoming';
      let opacity = '0.5';
      if (brokenOffDates.has(dateStr)) {
        status = '✂️'; label = 'Broken off'; opacity = '0.4';
      } else if (completedDates.has(dateStr)) {
        status = '✅'; label = 'Completed'; opacity = '1';
      } else if (current < today) {
        status = '❌'; label = 'Missed'; opacity = '0.7';
      } else {
        status = '⬜'; label = 'Upcoming'; opacity = '0.5';
      }
      rows.push({ dateStr, status, label, opacity, isFuture: current >= today });
    }

    if (!_advanceRecurrence(current, freq, interval, byDayNums)) break;
  }

  container.innerHTML = '';
  const list = document.createElement('div');
  list.style.cssText = 'max-height:200px;overflow-y:auto;font-size:0.8em;';

  rows.forEach(row => {
    const r = document.createElement('div');
    r.style.cssText = `display:flex;align-items:center;gap:6px;padding:2px 4px;opacity:${row.opacity};${row.isFuture ? '' : ''}`;
    const d = new Date(row.dateStr + 'T12:00:00');
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
    r.innerHTML = `<span>${row.status}</span><span style="min-width:80px;">${row.dateStr}</span><span style="min-width:30px;opacity:0.6;">${dayName}</span><span style="color:#6b4e31;">${row.label}</span>`;
    list.appendChild(r);
  });

  if (rows.length === 0) {
    list.innerHTML = '<div style="opacity:0.5;padding:4px;">No instances found</div>';
  }

  container.appendChild(list);
}

/** Remove an exception for a specific date (e.g. un-complete) */
async function _recurrenceRemoveException(parentId, dateStr) {
  try {
    // Fetch current chit, remove the exception, save back
    const resp = await fetch(`/api/chit/${parentId}`);
    if (!resp.ok) throw new Error('Chit not found');
    const chit = await resp.json();
    const exceptions = (chit.recurrence_exceptions || []).filter(e => e.date !== dateStr);
    await fetch(`/api/chits/${parentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...chit, recurrence_exceptions: exceptions })
    });
  } catch (e) {
    console.error('Failed to remove recurrence exception:', e);
    cwocToast('Failed to update recurrence instance.', 'error');
  }
}

/** Mark the entire series as Complete */
async function _recurrenceCompleteSeries(parentId) {
  try {
    const resp = await fetch(`/api/chit/${parentId}`);
    if (!resp.ok) throw new Error('Chit not found');
    const chit = await resp.json();
    chit.status = 'Complete';
    chit.completed_datetime = new Date().toISOString();
    await fetch(`/api/chits/${parentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chit)
    });
  } catch (e) {
    console.error('Failed to complete series:', e);
    cwocToast('Failed to complete series.', 'error');
  }
}

/** Break off a single instance into a standalone chit */
async function _recurrenceBreakOff(parentId, virtualChit, dateStr) {
  try {
    // 1. Fetch the full parent chit from the API
    const parentResp = await fetch(`/api/chit/${parentId}`);
    if (!parentResp.ok) throw new Error('Failed to fetch parent chit');
    const parentChit = await parentResp.json();

    // 2. Create a new standalone chit as a full copy
    const newChit = { ...parentChit };
    newChit.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    newChit.recurrence_rule = null;
    newChit.recurrence_exceptions = null;
    newChit.recurrence = null;
    newChit.recurrence_id = null;
    newChit.created_datetime = new Date().toISOString();
    newChit.modified_datetime = new Date().toISOString();

    // Use the virtual instance's specific dates
    if (virtualChit.start_datetime) newChit.start_datetime = virtualChit.start_datetime;
    if (virtualChit.end_datetime) newChit.end_datetime = virtualChit.end_datetime;
    if (virtualChit.due_datetime) newChit.due_datetime = virtualChit.due_datetime;

    console.log('Breaking off chit:', newChit.id, 'from parent:', parentId, 'date:', dateStr);

    const createResp = await fetch('/api/chits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newChit)
    });
    if (!createResp.ok) {
      const errText = await createResp.text();
      throw new Error('Failed to create broken-off chit: ' + errText);
    }

    // 3. Add exception to parent so this date is skipped
    await _recurrenceAddException(parentId, { date: dateStr, broken_off: true });

    // 4. Open the new chit in the editor
    if (typeof storePreviousState === 'function') storePreviousState();
    window.location.href = `/editor?id=${newChit.id}`;
  } catch (e) {
    console.error('Failed to break off instance:', e);
    cwocToast('Failed to break off instance: ' + e.message, 'error');
  }
}


// ── Column-Persistent Layout for Notes View ─────────────────────────────────
//
// Each card stores its column as data-col (integer). Layout reads data-col to
// group cards, then stacks each group top-to-bottom. Dragging within the same
// column only re-stacks that column. Dragging to a different column changes
// data-col and re-stacks only the source and target columns.
//
// Saved order: array of {id, col} pairs in localStorage.

const NOTES_CARD_WIDTH = 336;
const NOTES_GAP = 10;

/** Calculate how many columns fit and the actual card width.
 *  Responsive: ≤480px → 1 column, 481–768px → 2 columns, >768px → current masonry. */
function _notesColMetrics(container) {
  // clientWidth includes padding; subtract it to get usable content area
  const style = getComputedStyle(container);
  const padL = parseFloat(style.paddingLeft) || 0;
  const padR = parseFloat(style.paddingRight) || 0;
  const contentWidth = container.clientWidth - padL - padR;

  // Responsive column count based on viewport width
  const vw = window.innerWidth;
  let colCount;
  if (vw <= 480) {
    colCount = 1;
  } else if (vw <= 768) {
    colCount = 2;
  } else {
    // Desktop: fit as many columns as the container allows
    colCount = Math.max(1, Math.floor(contentWidth / (NOTES_CARD_WIDTH + NOTES_GAP)));
  }

  const actualCardWidth = Math.floor((contentWidth - (colCount - 1) * NOTES_GAP) / colCount);
  return { colCount, actualCardWidth, contentWidth };
}

/** Get the left px offset for a given column index */
function _notesColLeft(colIdx, actualCardWidth) {
  return NOTES_GAP + colIdx * (actualCardWidth + NOTES_GAP);
}

/**
 * Assign initial data-col to cards that don't have one yet.
 * New cards go to column 0 (top-left) so the most recently created/updated
 * notes appear at the top-left of the masonry grid.
 */
function _assignMissingCols(cards, colCount) {
  // Count existing assignments
  const colCounts = new Array(colCount).fill(0);
  cards.forEach(card => {
    const col = parseInt(card.dataset.col, 10);
    if (!isNaN(col) && col >= 0 && col < colCount) {
      colCounts[col]++;
    }
  });
  cards.forEach(card => {
    let col = parseInt(card.dataset.col, 10);
    if (isNaN(col) || col < 0 || col >= colCount) {
      // Assign to column 0 (leftmost) so new notes appear top-left
      col = 0;
      card.dataset.col = col;
      colCounts[col]++;
    }
  });
}

/**
 * Build column groups from cards' data-col attributes.
 * Returns array of arrays: columns[colIdx] = [card, card, ...]
 */
function _buildNoteColumns(cards, colCount) {
  const columns = Array.from({ length: colCount }, () => []);
  cards.forEach(card => {
    const col = parseInt(card.dataset.col, 10);
    if (!isNaN(col) && col >= 0 && col < colCount) {
      columns[col].push(card);
    }
  });
  return columns;
}

/**
 * Position cards in a single column top-to-bottom.
 * Optionally skip a card (the one being dragged).
 */
function _stackColumn(colCards, colIdx, actualCardWidth, skipCard) {
  const left = _notesColLeft(colIdx, actualCardWidth);
  let top = NOTES_GAP;
  colCards.forEach(card => {
    if (card === skipCard) return;
    card.style.position = 'absolute';
    card.style.width = actualCardWidth + 'px';
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    top += card.offsetHeight + NOTES_GAP;
  });
  return top; // total height of this column
}

/**
 * Apply column-persistent layout to a notes-view container.
 * Reads data-col from each card. Cards without data-col get assigned
 * to the shortest column. Only repositions — never changes DOM order.
 */
function applyNotesLayout(container) {
  if (!container) return;
  const cards = Array.from(container.querySelectorAll('.chit-card'));
  if (cards.length === 0) return;

  const { colCount, actualCardWidth } = _notesColMetrics(container);

  // Clamp out-of-range columns (e.g. window resized narrower)
  // but leave unassigned cards (NaN) for _assignMissingCols to distribute
  cards.forEach(card => {
    const col = parseInt(card.dataset.col, 10);
    if (!isNaN(col) && (col < 0 || col >= colCount)) {
      // Out of range — reassign to last valid column
      card.dataset.col = String(colCount - 1);
    }
  });
  _assignMissingCols(cards, colCount);

  const columns = _buildNoteColumns(cards, colCount);

  let maxHeight = 0;
  columns.forEach((colCards, colIdx) => {
    const h = _stackColumn(colCards, colIdx, actualCardWidth);
    if (h > maxHeight) maxHeight = h;
  });

  // Use a spacer div to create real scrollable content height
  // (absolute-positioned cards don't contribute to scroll height)
  let spacer = container.querySelector('.notes-height-spacer');
  if (!spacer) {
    spacer = document.createElement('div');
    spacer.className = 'notes-height-spacer';
    spacer.style.cssText = 'pointer-events:none;visibility:hidden;width:100%;';
    container.appendChild(spacer);
  }
  spacer.style.height = maxHeight + 'px';
}


// ── Notes View: Column-Aware Drag-to-Reorder ────────────────────────────────

let _notesDragState = null;

function enableNotesDragReorder(container, tab, onReorder) {
  if (!container) return;

  container.querySelectorAll('.chit-card').forEach(card => {
    card.style.cursor = 'grab';

    card.addEventListener('mousedown', (e) => {
      if (e.target.closest('input, textarea, select, button, a, ul, li, [contenteditable="true"]')) return;
      if (e.target.closest('.note-content')) return;
      if (card.querySelector('[contenteditable="true"]')) return;
      if (e.button !== 0) return;
      e.preventDefault();

      const rect = card.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const { colCount, actualCardWidth } = _notesColMetrics(container);

      // Snapshot every card's {id, col, position-within-col} for cancel restore
      const allCards = Array.from(container.querySelectorAll('.chit-card'));
      const columns = _buildNoteColumns(allCards, colCount);
      const origSnapshot = [];
      columns.forEach((colCards, ci) => {
        colCards.forEach((c, ri) => {
          origSnapshot.push({ id: c.dataset.chitId, col: ci, row: ri });
        });
      });

      _notesDragState = {
        card,
        container,
        tab,
        onReorder,
        origSnapshot,
        origCol: parseInt(card.dataset.col, 10),
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        colCount,
        actualCardWidth,
        cancelled: false,
        targetCol: undefined,
        targetInsertIdx: undefined,
      };

      card.style.zIndex = '100';
      card.style.opacity = '0.85';
      card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
      card.style.cursor = 'grabbing';
      card.style.transition = 'none';

      document.addEventListener('mousemove', _onNotesDragMove);
      document.addEventListener('mouseup', _onNotesDragEnd);
      document.addEventListener('keydown', _onNotesDragKey);
    });

    // Touch gesture: drag to reorder + long-press for inline edit
    // (Only used on desktop multi-column; mobile uses enableDragToReorder instead)
    if (typeof enableTouchGesture === 'function') {
      var _notesTouchDragData = null;

      enableTouchGesture(card, {
        onDragStart: function (data) {
          if (data.target && data.target.closest && data.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
          if (data.target && data.target.closest && data.target.closest('.note-content')) return;
          if (card.querySelector('[contenteditable="true"]')) return;

          var rect = card.getBoundingClientRect();
          var metrics = _notesColMetrics(container);

          var allCards = Array.from(container.querySelectorAll('.chit-card'));
          var columns = _buildNoteColumns(allCards, metrics.colCount);
          var origSnapshot = [];
          columns.forEach(function (colCards, ci) {
            colCards.forEach(function (c, ri) {
              origSnapshot.push({ id: c.dataset.chitId, col: ci, row: ri });
            });
          });

          _notesDragState = {
            card: card,
            container: container,
            tab: tab,
            onReorder: onReorder,
            origSnapshot: origSnapshot,
            origCol: parseInt(card.dataset.col, 10),
            offsetX: data.clientX - rect.left,
            offsetY: data.clientY - rect.top,
            colCount: metrics.colCount,
            actualCardWidth: metrics.actualCardWidth,
            cancelled: false,
            targetCol: undefined,
            targetInsertIdx: undefined,
          };

          card.style.zIndex = '100';
          card.style.opacity = '0.85';
          card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
          card.style.cursor = 'grabbing';
          card.style.transition = 'none';
          _notesTouchDragData = true;
        },
        onDragMove: function (data) {
          if (!_notesDragState || !_notesTouchDragData) return;
          _onNotesDragMoveXY(data.clientX, data.clientY);
        },
        onDragEnd: function (data) {
          if (!_notesDragState || !_notesTouchDragData) return;
          _notesTouchDragData = null;
          _onNotesDragEnd();
        },
        onLongPress: function (el) {
          if (window._dragJustEnded || window._touchDragActive) return;
          var chitId = card.dataset.chitId;
          var noteEl = card.querySelector('.note-content');
          if (!noteEl) return;
          var chit = (typeof chits !== 'undefined' && Array.isArray(chits)) ? chits.find(function (c) { return c.id === chitId; }) : null;
          if (!chit) return;
          if (typeof _isViewerRole === 'function' && _isViewerRole(chit)) return;
          if (noteEl.contentEditable === 'true') return;
          noteEl.contentEditable = 'true';
          noteEl.style.outline = '2px solid #8b4513';
          noteEl.style.borderRadius = '4px';
          noteEl.style.padding = '6px';
          noteEl.style.whiteSpace = 'pre-wrap';
          card.style.cursor = 'auto';
          card.setAttribute('draggable', 'false');
          noteEl.textContent = chit.note || '';
          noteEl.focus();
          var _lpSaveEdit = function () {
            noteEl.contentEditable = 'false';
            noteEl.style.outline = '';
            noteEl.style.padding = '';
            card.style.cursor = 'grab';
            card.removeAttribute('draggable');
            var newNote = noteEl.textContent;
            if (newNote !== chit.note) {
              fetch('/api/chits/' + chit.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({}, chit, { note: newNote }))
              }).then(function (r) { if (r.ok) { chit.note = newNote; if (typeof fetchChits === 'function') fetchChits(); } });
            } else {
              if (typeof marked !== 'undefined' && chit.note) {
                noteEl.innerHTML = (typeof resolveChitLinks === 'function') ? resolveChitLinks(marked.parse(chit.note, { breaks: true }), chits) : marked.parse(chit.note, { breaks: true });
              }
            }
          };
          noteEl.addEventListener('blur', _lpSaveEdit, { once: true });
        },
      });
    }
  });
}

function _onNotesDragMove(e) {
  _onNotesDragMoveXY(e.clientX, e.clientY);
}

/** Shared drag-move logic for notes reorder (used by both mouse and touch). */
function _onNotesDragMoveXY(clientX, clientY) {
  if (!_notesDragState) return;
  const s = _notesDragState;
  const containerRect = s.container.getBoundingClientRect();

  // Float the dragged card under the cursor
  const newLeft = clientX - containerRect.left - s.offsetX + s.container.scrollLeft;
  const newTop = clientY - containerRect.top - s.offsetY + s.container.scrollTop;
  s.card.style.left = newLeft + 'px';
  s.card.style.top = newTop + 'px';

  // Hide dragged card from hit testing so elementFromPoint / getBoundingClientRect
  // targeting is not blocked by the floating card in the masonry layout
  s.card.style.pointerEvents = 'none';

  // Which column is the cursor over?
  const cursorX = clientX - containerRect.left;
  const targetCol = Math.min(
    s.colCount - 1,
    Math.max(0, Math.floor((cursorX - NOTES_GAP) / (s.actualCardWidth + NOTES_GAP)))
  );

  // Build columns excluding the dragged card
  const allCards = Array.from(s.container.querySelectorAll('.chit-card'));
  const columns = _buildNoteColumns(allCards, s.colCount);
  const colCards = columns[targetCol].filter(c => c !== s.card);

  // Find vertical insert position within target column
  let insertIdx = colCards.length;
  for (let i = 0; i < colCards.length; i++) {
    const r = colCards[i].getBoundingClientRect();
    if (clientY < r.top + r.height / 2) {
      insertIdx = i;
      break;
    }
  }

  // Restore pointer-events on the dragged card
  s.card.style.pointerEvents = '';

  // Live preview: re-stack ALL columns so intermediate columns don't keep stale gaps
  // when dragging across more than one column. With 3–4 columns this is trivially cheap.
  for (let ci = 0; ci < s.colCount; ci++) {
    const col = columns[ci].filter(c => c !== s.card);
    const left = _notesColLeft(ci, s.actualCardWidth);
    let top = NOTES_GAP;

    for (let i = 0; i < col.length; i++) {
      // If this is the target column, leave a gap at insertIdx
      if (ci === targetCol && i === insertIdx) {
        top += s.card.offsetHeight + NOTES_GAP;
      }
      const c = col[i];
      c.style.position = 'absolute';
      c.style.width = s.actualCardWidth + 'px';
      c.style.left = left + 'px';
      c.style.top = top + 'px';
      c.style.transition = 'top 0.15s ease';
      top += c.offsetHeight + NOTES_GAP;
    }
    // Gap at end of column
    if (ci === targetCol && insertIdx >= col.length) {
      top += s.card.offsetHeight + NOTES_GAP;
    }
  }

  // Drop indicator line
  s.container.querySelectorAll('.notes-drop-indicator').forEach(el => el.remove());
  const indicator = document.createElement('div');
  indicator.className = 'notes-drop-indicator';
  const colLeft = _notesColLeft(targetCol, s.actualCardWidth);

  let indicatorTop;
  if (colCards.length === 0) {
    indicatorTop = NOTES_GAP;
  } else if (insertIdx >= colCards.length) {
    const lastCard = colCards[colCards.length - 1];
    const r = lastCard.getBoundingClientRect();
    indicatorTop = r.bottom - containerRect.top + s.container.scrollTop + 2;
  } else {
    const r = colCards[insertIdx].getBoundingClientRect();
    indicatorTop = r.top - containerRect.top + s.container.scrollTop - 2;
  }

  indicator.style.cssText = `position:absolute;left:${colLeft}px;top:${indicatorTop}px;width:${s.actualCardWidth}px;height:3px;background:#4a2c2a;border-radius:2px;z-index:90;pointer-events:none;`;
  s.container.appendChild(indicator);

  s.targetCol = targetCol;
  s.targetInsertIdx = insertIdx;
}

function _onNotesDragEnd(e) {
  document.removeEventListener('mousemove', _onNotesDragMove);
  document.removeEventListener('mouseup', _onNotesDragEnd);
  document.removeEventListener('keydown', _onNotesDragKey);

  if (!_notesDragState) return;

  const s = _notesDragState;

  // Only suppress click/dblclick if the mouse actually moved (real drag, not just a click)
  if (s.targetCol !== undefined) {
    if (typeof _markDragJustEnded === 'function') _markDragJustEnded();
  }

  // Clean up indicator and card styles
  s.container.querySelectorAll('.notes-drop-indicator').forEach(el => el.remove());
  s.card.style.zIndex = '';
  s.card.style.opacity = '';
  s.card.style.boxShadow = '';
  s.card.style.cursor = 'grab';
  s.card.style.transition = '';

  // Remove transition from all cards
  s.container.querySelectorAll('.chit-card').forEach(c => { c.style.transition = ''; });

  if (s.cancelled) {
    // Restore original column assignments and order
    s.origSnapshot.forEach(({ id, col }) => {
      const el = s.container.querySelector(`[data-chit-id="${id}"]`);
      if (el) el.dataset.col = col;
    });
    applyNotesLayout(s.container);
    _notesDragState = null;
    return;
  }

  if (s.targetCol !== undefined) {
    const srcCol = parseInt(s.card.dataset.col, 10);
    const targetCol = s.targetCol;

    // Update the dragged card's column assignment
    s.card.dataset.col = targetCol;

    // Build columns from data-col (card is now in targetCol)
    const allCards = Array.from(s.container.querySelectorAll('.chit-card'));
    const columns = _buildNoteColumns(allCards, s.colCount);

    // Remove dragged card from its position in the target column array
    const targetCards = columns[targetCol].filter(c => c !== s.card);
    // Insert at the correct position
    const insertIdx = Math.min(s.targetInsertIdx || 0, targetCards.length);
    targetCards.splice(insertIdx, 0, s.card);
    columns[targetCol] = targetCards;

    // Re-stack only affected columns (source and target)
    const affectedCols = new Set([srcCol, targetCol]);
    affectedCols.forEach(ci => {
      if (ci >= 0 && ci < s.colCount) {
        _stackColumn(columns[ci], ci, s.actualCardWidth);
      }
    });

    // Update container height via spacer
    let maxH = 0;
    columns.forEach(col => {
      const h = col.reduce((acc, c) => acc + c.offsetHeight + NOTES_GAP, NOTES_GAP);
      if (h > maxH) maxH = h;
    });
    let spacer = s.container.querySelector('.notes-height-spacer');
    if (spacer) spacer.style.height = maxH + 'px';

    // Save order as {id, col} pairs, preserving within-column order
    const orderData = [];
    columns.forEach((colCards, ci) => {
      colCards.forEach(c => {
        orderData.push({ id: c.dataset.chitId, col: ci });
      });
    });
    saveManualOrder(s.tab, orderData);
    currentSortField = 'manual';
    const sel = document.getElementById('sort-select');
    if (sel) sel.value = 'manual';
    if (typeof _updateSortUI === 'function') _updateSortUI();
    if (typeof saveSortPreference === 'function') saveSortPreference(s.tab, 'manual', 'asc');
  }

  _notesDragState = null;
}

function _onNotesDragKey(e) {
  if (e.key === 'Escape' && _notesDragState) {
    _notesDragState.cancelled = true;
    _onNotesDragEnd(e);
  }
}





// ── Delete Undo Toast ────────────────────────────────────────────────────────

/**
 * Show a delete-undo toast with a countdown timer bar.
 * Delegates to cwocUndoToast (shared-utils.js).
 * @param {string} chitId - The deleted chit's ID
 * @param {string} chitTitle - The chit title for display
 * @param {function} onExpire - Called when toast expires (no undo)
 * @param {function} onUndo - Called when user clicks Undo
 * @param {string} customMessage - Optional custom message (overrides default)
 */
function _showDeleteUndoToast(chitId, chitTitle, onExpire, onUndo, customMessage) {
  var message = customMessage || ("🗑️ Deleted: " + (chitTitle || "(Untitled)"));
  cwocUndoToast(message, {
    duration: 5000,
    onExpire: onExpire || null,
    onUndo: onUndo || null,
    id: 'cwoc-undo-toast'
  });
}

/**
 * Show an undo toast for archive/unarchive actions.
 * Delegates to _showDeleteUndoToast with a custom message.
 */
function _showArchiveUndoToast(chitTitle, archived, onUndo) {
  var message = (archived ? "📦 Archived: " : "📦 Unarchived: ") + (chitTitle || "(Untitled)");
  _showDeleteUndoToast(null, chitTitle, null, onUndo, message);
}

/**
 * Show an undo toast for snooze actions.
 * Shows the snooze-until time (if <24h) or date (if ≥24h).
 * @param {string} chitId - The chit ID (for unsnooze API call)
 * @param {string} chitTitle - The chit title for display
 * @param {number} mins - Snooze duration in minutes
 * @param {function} onUndo - Called when user clicks Undo
 */
function _showSnoozeUndoToast(chitId, chitTitle, mins, onUndo) {
  var untilDate = new Date(Date.now() + mins * 60 * 1000);
  var untilStr;
  if (mins < 1440) {
    // Less than a day: show time
    untilStr = untilDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else {
    // A day or more: show date
    untilStr = untilDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (mins >= 43200) untilStr = untilDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
  var message = "😴 Snoozed: " + (chitTitle || "(Untitled)") + " until <b>" + untilStr + "</b>";
  _showDeleteUndoToast(null, chitTitle, null, onUndo, message);
}


// ── Shared Audio Unlock System (Mobile) ──────────────────────────────────────
// Mobile browsers block audio playback unless triggered by a user gesture.
// This system pre-unlocks audio on the first interaction and re-unlocks when
// the page returns from background. Works across dashboard and editor pages.

window._cwocAudioUnlocked = false;
window._cwocAudioContext = null;

/**
 * Initialize the audio unlock system. Call once per page load.
 * Resumes the AudioContext on first user gesture so audio can play from timers/intervals.
 */
function initAudioUnlock() {
  // Create AudioContext (needed for iOS Safari)
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !window._cwocAudioContext) {
      window._cwocAudioContext = new AC();
    }
  } catch (e) { /* no AudioContext support */ }

  var events = ['click', 'touchstart', 'keydown'];
  function _doUnlock() {
    if (window._cwocAudioUnlocked) return;
    window._cwocAudioUnlocked = true;

    // Resume AudioContext (iOS requirement)
    if (window._cwocAudioContext && window._cwocAudioContext.state === 'suspended') {
      window._cwocAudioContext.resume().catch(function() {});
    }

    // Play a tiny silent buffer to unlock audio on iOS/Android
    try {
      var ctx = window._cwocAudioContext;
      if (ctx) {
        var buf = ctx.createBuffer(1, 1, 22050);
        var src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      }
    } catch (e) {}

    events.forEach(function(evt) {
      document.removeEventListener(evt, _doUnlock, true);
    });
  }

  events.forEach(function(evt) {
    document.addEventListener(evt, _doUnlock, { capture: true, passive: true });
  });

  // Re-unlock when page returns from background
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      window._cwocAudioUnlocked = false;
      events.forEach(function(evt) {
        document.addEventListener(evt, _doUnlock, { capture: true, passive: true });
      });
      if (window._cwocAudioContext && window._cwocAudioContext.state === 'suspended') {
        window._cwocAudioContext.resume().catch(function() {});
      }
    }
  });
}

/**
 * Play an audio file reliably. If blocked, retries on next user gesture.
 */
function cwocPlayAudio(audio, opts) {
  if (!audio) return;
  opts = opts || {};
  if (opts.loop !== undefined) audio.loop = opts.loop;
  audio.currentTime = 0;
  // Mark audio as intentionally playing (used by retry to avoid replaying after dismiss)
  audio._cwocIntentionalPlay = true;

  // Vibrate as fallback/supplement on mobile
  if (navigator.vibrate) {
    try { navigator.vibrate([200, 100, 200, 100, 300, 200, 500]); } catch (e) {}
  }

  var playPromise = audio.play();
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise.catch(function() {
      // Playback blocked — retry on next user gesture
      var retryEvents = ['click', 'touchstart', 'keydown'];
      function _retry() {
        // Only retry if audio hasn't been intentionally stopped since the play request
        if (audio._cwocIntentionalPlay) {
          audio.play().catch(function() {});
        }
        retryEvents.forEach(function(evt) {
          document.removeEventListener(evt, _retry, true);
        });
      }
      retryEvents.forEach(function(evt) {
        document.addEventListener(evt, _retry, { capture: true, once: true, passive: true });
      });
    });
  }
}

/**
 * Stop audio and clear the intentional-play flag so retry handlers won't restart it.
 */
function cwocStopAudio(audio) {
  if (!audio) return;
  audio._cwocIntentionalPlay = false;
  audio.pause();
  audio.currentTime = 0;
}

// Auto-initialize on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAudioUnlock);
  } else {
    initAudioUnlock();
  }
}


// ── Sync Client (WebSocket primary, HTTP polling fallback) ───────────────────
// Provides cross-device real-time sync for alarms, timers, dismiss/snooze state.

window._cwocSyncWs = null;
window._cwocSyncHandlers = {}; // type -> [callback, ...]
window._cwocSyncReconnectDelay = 1000;
window._cwocSyncMode = 'none'; // 'ws' | 'poll' | 'none'
window._cwocSyncPollId = 0; // last seen poll message ID
window._cwocSyncPollTimer = null;
window._cwocSyncRetries = 0; // track reconnect attempts
window._cwocSyncMaxRetries = 3; // max retries before falling back to polling
window._cwocSyncWasConnected = false; // track if WS ever connected this session

function initSyncWebSocket() {
  if (window._cwocSyncMode === 'poll') return; // already fell back to polling
  if (window._cwocSyncWs && window._cwocSyncWs.readyState <= 1) return;

  var proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  var url = proto + '//' + window.location.host + '/ws/sync';
  console.debug('CWOC Sync: trying WebSocket', url);

  try {
    var ws = new WebSocket(url);
    window._cwocSyncWs = ws;

    ws.onopen = function() {
      console.log('CWOC Sync: WebSocket connected');
      window._cwocSyncMode = 'ws';
      window._cwocSyncWasConnected = true;
      window._cwocSyncRetries = 0;
      window._cwocSyncReconnectDelay = 1000;
      // Stop polling if it was running
      if (window._cwocSyncPollTimer) { clearInterval(window._cwocSyncPollTimer); window._cwocSyncPollTimer = null; }
    };

    ws.onmessage = function(event) {
      try {
        var msg = JSON.parse(event.data);
        _dispatchSyncMessage(msg);
      } catch (e) { console.error('Sync WS parse error:', e); }
    };

    ws.onclose = function() {
      window._cwocSyncWs = null;
      if (window._cwocSyncMode === 'ws' || window._cwocSyncWasConnected) {
        // Was connected (or previously connected) — try to reconnect
        window._cwocSyncMode = 'none';
        window._cwocSyncRetries++;
        if (window._cwocSyncRetries <= window._cwocSyncMaxRetries) {
          console.debug('CWOC Sync: WebSocket disconnected, reconnecting (attempt ' + window._cwocSyncRetries + '/' + window._cwocSyncMaxRetries + ')');
          setTimeout(initSyncWebSocket, window._cwocSyncReconnectDelay);
          window._cwocSyncReconnectDelay = Math.min(window._cwocSyncReconnectDelay * 2, 30000);
        } else {
          console.debug('CWOC Sync: WebSocket reconnect failed after ' + window._cwocSyncMaxRetries + ' attempts, falling back to HTTP polling');
          _startSyncPolling();
        }
      } else {
        // Never connected this session — fall back to polling
        console.debug('CWOC Sync: WebSocket failed, falling back to HTTP polling');
        _startSyncPolling();
      }
    };

    ws.onerror = function() { /* onclose handles it */ };
  } catch (e) {
    console.debug('CWOC Sync: WebSocket not available, using HTTP polling');
    _startSyncPolling();
  }
}

function _startSyncPolling() {
  if (window._cwocSyncPollTimer) return; // already polling
  window._cwocSyncMode = 'poll';
  // Get initial poll ID
  fetch('/api/sync/poll?after=0').then(function(r) { return r.json(); }).then(function(d) {
    window._cwocSyncPollId = d.last_id || 0;
  }).catch(function() {});
  // Poll every 2 seconds
  window._cwocSyncPollTimer = setInterval(_pollSync, 2000);
  console.debug('CWOC Sync: HTTP polling started');
}

function _pollSync() {
  fetch('/api/sync/poll?after=' + window._cwocSyncPollId)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.last_id) window._cwocSyncPollId = d.last_id;
      if (d.messages && d.messages.length > 0) {
        d.messages.forEach(function(msg) { _dispatchSyncMessage(msg); });
      }
    })
    .catch(function() {});
}

function _dispatchSyncMessage(msg) {
  var handlers = window._cwocSyncHandlers[msg.type];
  if (handlers) {
    handlers.forEach(function(fn) { fn(msg); });
  }
}

/**
 * Send a sync message. Uses WebSocket if connected, HTTP POST otherwise.
 */
function syncSend(type, data) {
  var msg = Object.assign({ type: type }, data || {});

  if (window._cwocSyncWs && window._cwocSyncWs.readyState === 1) {
    try {
      window._cwocSyncWs.send(JSON.stringify(msg));
      return;
    } catch (e) { /* fall through to HTTP */ }
  }

  // HTTP fallback
  fetch('/api/sync/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  }).catch(function(e) { console.error('Sync send error:', e); });
}

/**
 * Register a handler for a sync message type.
 */
function syncOn(type, callback) {
  if (!window._cwocSyncHandlers[type]) window._cwocSyncHandlers[type] = [];
  window._cwocSyncHandlers[type].push(callback);
}

// Auto-connect on page load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSyncWebSocket);
  } else {
    initSyncWebSocket();
  }
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      if (window._cwocSyncMode === 'none') {
        window._cwocSyncRetries = 0; // reset retries on tab focus
        initSyncWebSocket();
      }
      if (window._cwocSyncMode === 'poll') {
        // Try upgrading back to WebSocket when tab becomes visible
        window._cwocSyncRetries = 0;
        window._cwocSyncWasConnected = false;
        window._cwocSyncMode = 'none';
        initSyncWebSocket();
      }
    }
  });
}


// ── Cross-Device Auto-Refresh ────────────────────────────────────────────────
// When data is updated on another device, auto-refresh this page's data.
// If the page has unsaved changes, show a warning banner instead of refreshing.

window._cwocAutoRefreshBanner = null;

/**
 * Check if the current page has unsaved changes.
 * Works across all page types (editor, settings, contact-editor, dashboard).
 */
function _pageHasUnsavedChanges() {
  // CwocSaveSystem (editor, settings, contact-editor)
  if (window._cwocSave && window._cwocSave.hasChanges()) return true;
  // CwocEditorSaveSystem wrapper (contact-editor uses _saveSystem)
  if (window._saveSystem && window._saveSystem.hasChanges()) return true;
  return false;
}

/**
 * Show a non-intrusive banner warning that data was updated on another device.
 * Clicking the banner refreshes the page.
 */
function _showAutoRefreshBanner() {
  // Don't stack multiple banners
  if (window._cwocAutoRefreshBanner) return;

  var banner = document.createElement('div');
  banner.id = 'cwoc-sync-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;' +
    'background:#6b4e31;color:#fdf5e6;padding:10px 16px;text-align:center;' +
    'font-family:Lora,serif;font-size:14px;cursor:pointer;display:flex;' +
    'align-items:center;justify-content:center;gap:10px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
  banner.innerHTML = '<span>📡 Data updated on another device.</span>' +
    '<button style="background:#fdf5e6;color:#6b4e31;border:none;padding:4px 12px;' +
    'border-radius:4px;font-family:Lora,serif;font-size:13px;cursor:pointer;">Refresh Now</button>' +
    '<button style="background:transparent;color:#fdf5e6;border:1px solid #fdf5e6;padding:4px 10px;' +
    'border-radius:4px;font-family:Lora,serif;font-size:13px;cursor:pointer;">Dismiss</button>';

  var refreshBtn = banner.querySelectorAll('button')[0];
  var dismissBtn = banner.querySelectorAll('button')[1];

  refreshBtn.onclick = function(e) {
    e.stopPropagation();
    window._cwocAutoRefreshBanner = null;
    banner.remove();
    window.location.reload();
  };
  dismissBtn.onclick = function(e) {
    e.stopPropagation();
    window._cwocAutoRefreshBanner = null;
    banner.remove();
  };

  document.body.appendChild(banner);
  window._cwocAutoRefreshBanner = banner;
}

/**
 * Handle a remote data change. If the page has unsaved changes, show a warning.
 * Otherwise, refresh the page data silently.
 */
function _handleRemoteDataChange(type) {
  var isDashboard = window.location.pathname === '/' ||
    window.location.pathname === '/frontend/html/index.html' ||
    window.location.pathname.endsWith('/index.html');

  // Dashboard handles chits_changed via its own syncOn handler in main-alerts.js
  if (isDashboard && type === 'chits') return;
  // Dashboard doesn't display contacts — no need to reload for contact changes
  if (isDashboard && type === 'contacts') return;

  if (_pageHasUnsavedChanges()) {
    _showAutoRefreshBanner();
  } else {
    // No unsaved changes — safe to reload
    window.location.reload();
  }
}

// Register auto-refresh handlers for data change sync messages
if (typeof syncOn === 'function') {
  syncOn('chits_changed', function() { _handleRemoteDataChange('chits'); });
  syncOn('settings_changed', function() { _handleRemoteDataChange('settings'); });
  syncOn('contacts_changed', function() { _handleRemoteDataChange('contacts'); });
}


// Log version on every page load
function _logCwocVersion() {
  fetch('/api/version').then(function(r) { return r.ok ? r.json() : null; }).then(function(d) {
    if (d && d.version) console.info('[CWOC] Version ' + d.version + ' — ' + window.location.pathname);
  }).catch(function() {});
}

/**
 * shared-weather.js — Weather & saved locations utilities.
 *
 * Provides:
 *   - Saved locations loading and default location lookup
 *   - Weather forecast cache (localStorage-backed, 1-hour TTL)
 *   - Fetch and cache weather from Open-Meteo API
 *   - Prefetch weather for all saved locations
 *
 * Loaded BEFORE shared.js.
 */

// ── Saved Locations Utilities ────────────────────────────────────────────────

/**
 * Fetch saved locations from settings and cache them for the page lifetime.
 * Returns the saved_locations array (or empty array on error / no data).
 * Subsequent calls return the cached value without re-fetching.
 * @returns {Promise<object[]>}
 */
async function loadSavedLocations() {
  if (window._savedLocations) return window._savedLocations;
  try {
    const settings = await getCachedSettings();
    window._savedLocations = Array.isArray(settings.saved_locations) ? settings.saved_locations : [];
    return window._savedLocations;
  } catch (e) {
    console.error('Error loading saved locations:', e);
    window._savedLocations = [];
    return [];
  }
}

/**
 * Return the saved location marked as default (is_default === true), or null.
 * Reads from the cached window._savedLocations — call loadSavedLocations() first.
 * @returns {object|null}
 */
function getDefaultLocation() {
  if (!Array.isArray(window._savedLocations)) return null;
  return window._savedLocations.find(function (loc) { return loc.is_default === true; }) || null;
}


// ═══════════════════════════════════════════════════════════════════════════
// Weather Forecast Cache — shared across all pages
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Global weather forecast cache.
 * Key: lowercase trimmed address string
 * Value: { daily: {...}, ts: timestamp, lat, lon }
 *
 * Populated by prefetchSavedLocationWeather() on dashboard load.
 * Consumed by calendar cards, weather page, editor, weather modal.
 */
window._weatherForecastCache = window._weatherForecastCache || {};

var _WEATHER_CACHE_LS_KEY = 'cwoc_weather_forecast_cache';
var _WEATHER_CACHE_MAX_AGE = 60 * 60 * 1000; // 1 hour

/** Load weather cache from localStorage on init. */
(function _loadWeatherCacheFromLS() {
  try {
    var raw = localStorage.getItem(_WEATHER_CACHE_LS_KEY);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    var now = Date.now();
    // Only restore entries less than 1 hour old
    for (var key in parsed) {
      if (parsed[key] && parsed[key].ts && (now - parsed[key].ts) < _WEATHER_CACHE_MAX_AGE) {
        window._weatherForecastCache[key] = parsed[key];
      }
    }
  } catch (e) { /* ignore corrupt cache */ }
})();

/** Persist weather cache to localStorage. */
function _saveWeatherCacheToLS() {
  try {
    localStorage.setItem(_WEATHER_CACHE_LS_KEY, JSON.stringify(window._weatherForecastCache));
  } catch (e) { /* quota exceeded or private mode */ }
}

/**
 * Get cached 16-day forecast for an address, or null if not cached / stale.
 * @param {string} address
 * @returns {object|null} { daily: {...}, lat, lon, ts } or null
 */
function getWeatherFromCache(address) {
  if (!address) return null;
  var key = address.toLowerCase().trim();
  var entry = window._weatherForecastCache[key];
  if (!entry || !entry.ts) return null;
  if ((Date.now() - entry.ts) > _WEATHER_CACHE_MAX_AGE) return null;
  return entry;
}

// fetchAndCacheWeather and prefetchSavedLocationWeather are defined in shared-weather.js

/**
 * shared-mobile.js — Mobile UI behavior.
 *
 * Handles mobile-specific interactions:
 *   - Sidebar overlay (backdrop, swipe open/close)
 *   - Mobile actions modal (editor header buttons)
 *   - Long-press handler (mobile quick edit)
 *   - Mobile views button (replaces tab bar on mobile)
 *   - Mobile reference close button
 *
 * Loaded BEFORE shared.js.
 */

// ── Mobile Sidebar Overlay Behavior ──────────────────────────────────────────

/** @type {HTMLElement|null} Cached reference to the sidebar backdrop element */
var _sidebarBackdropEl = null;

/**
 * Ensure the .sidebar-backdrop element exists in the DOM.
 * Reuses an existing one if present; otherwise creates and appends it to <body>.
 * @returns {HTMLElement} The backdrop element
 */
function _ensureSidebarBackdrop() {
  if (_sidebarBackdropEl && document.body.contains(_sidebarBackdropEl)) {
    return _sidebarBackdropEl;
  }
  _sidebarBackdropEl = document.querySelector('.sidebar-backdrop');
  if (!_sidebarBackdropEl) {
    _sidebarBackdropEl = document.createElement('div');
    _sidebarBackdropEl.className = 'sidebar-backdrop';
    document.body.appendChild(_sidebarBackdropEl);
  }
  // Attach click handler (idempotent — remove first to avoid duplicates)
  _sidebarBackdropEl.removeEventListener('click', _onSidebarBackdropClick);
  _sidebarBackdropEl.addEventListener('click', _onSidebarBackdropClick);
  return _sidebarBackdropEl;
}

/**
 * Handle click on the sidebar backdrop — close sidebar and hide backdrop.
 */
function _onSidebarBackdropClick() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.remove('active');
    localStorage.setItem('sidebarState', 'closed');
  }
  if (_sidebarBackdropEl) {
    _sidebarBackdropEl.classList.remove('active');
  }
}

/**
 * Show the sidebar backdrop (only meaningful at ≤768px where CSS makes it visible).
 */
function _showSidebarBackdrop() {
  const backdrop = _ensureSidebarBackdrop();
  backdrop.classList.add('active');
}

/**
 * Hide the sidebar backdrop.
 */
function _hideSidebarBackdrop() {
  if (_sidebarBackdropEl) {
    _sidebarBackdropEl.classList.remove('active');
  }
}

/**
 * Check if the current viewport is in mobile/tablet overlay mode (≤768px).
 * @returns {boolean}
 */
function _isMobileOverlay() {
  return window.innerWidth <= 768;
}

/**
 * Initialize mobile sidebar overlay behavior.
 * - On ≤768px: sidebar defaults to closed on page load
 * - Creates/manages the .sidebar-backdrop element
 * - Adds a visible close button inside the sidebar for mobile
 * - Listens for resize events to handle crossing the 768px boundary
 *
 * Call this once from DOMContentLoaded (e.g., in main.js).
 * Does NOT call toggleSidebar — it only sets up the overlay infrastructure.
 */
function initMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Ensure backdrop element exists
  _ensureSidebarBackdrop();

  // Add a close button inside the sidebar for mobile (only once)
  if (!sidebar.querySelector('.sidebar-close-btn')) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sidebar-close-btn';
    closeBtn.innerHTML = '<span style="font-size:2.2em;font-weight:900;line-height:0;vertical-align:middle;position:relative;top:-0.25em;">⇤</span> Hide Sidebar';
    closeBtn.setAttribute('aria-label', 'Hide sidebar');
    closeBtn.addEventListener('click', function () {
      _onSidebarBackdropClick();
    });
    sidebar.insertBefore(closeBtn, sidebar.firstChild);
  }

  // On page load at ≤768px: force sidebar closed
  if (_isMobileOverlay()) {
    sidebar.classList.remove('active');
    localStorage.setItem('sidebarState', 'closed');
    _hideSidebarBackdrop();
  }

  // ── Touch swipe to open/close sidebar ──────────────────────────────
  var _swipeStartX = 0;
  var _swipeStartY = 0;
  var _swipeTracking = false;
  var SWIPE_THRESHOLD = 50;
  var EDGE_ZONE = 30; // px from left edge to start swipe-open

  document.addEventListener('touchstart', function (e) {
    if (!_isMobileOverlay()) return;
    var touch = e.touches[0];
    _swipeStartX = touch.clientX;
    _swipeStartY = touch.clientY;
    // Only track swipe-open if starting from left edge, or swipe-close if sidebar is open
    _swipeTracking = (touch.clientX < EDGE_ZONE) || sidebar.classList.contains('active');
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!_swipeTracking || !_isMobileOverlay()) { _swipeTracking = false; return; }
    if (window._emailSwipeActive) { _swipeTracking = false; return; }
    var touch = e.changedTouches[0];
    var dx = touch.clientX - _swipeStartX;
    var dy = Math.abs(touch.clientY - _swipeStartY);
    _swipeTracking = false;

    // Only count horizontal swipes (dx > dy)
    if (Math.abs(dx) < SWIPE_THRESHOLD || dy > Math.abs(dx)) return;

    if (dx > 0 && !sidebar.classList.contains('active') && _swipeStartX < EDGE_ZONE) {
      // Swipe right from left edge → open sidebar (only if views panel is NOT open)
      var viewsPanel = document.querySelector('.mobile-views-panel');
      if (viewsPanel && viewsPanel.classList.contains('active')) return;
      sidebar.classList.add('active');
      localStorage.setItem('sidebarState', 'open');
      _showSidebarBackdrop();
    } else if (dx < 0 && sidebar.classList.contains('active')) {
      // Swipe left → close sidebar
      sidebar.classList.remove('active');
      localStorage.setItem('sidebarState', 'closed');
      _hideSidebarBackdrop();
    }
  }, { passive: true });

  // Listen for resize to handle crossing the 768px boundary
  let _prevWasMobile = _isMobileOverlay();
  window.addEventListener('resize', function _onMobileSidebarResize() {
    const isMobile = _isMobileOverlay();

    // Crossing from desktop → mobile: close sidebar, hide backdrop
    if (isMobile && !_prevWasMobile) {
      sidebar.classList.remove('active');
      localStorage.setItem('sidebarState', 'closed');
      _hideSidebarBackdrop();
    }

    // Crossing from mobile → desktop: hide backdrop (sidebar state stays as-is)
    if (!isMobile && _prevWasMobile) {
      _hideSidebarBackdrop();
    }

    // If still mobile and sidebar is open, ensure backdrop is shown
    if (isMobile && sidebar.classList.contains('active')) {
      _showSidebarBackdrop();
    }

    _prevWasMobile = isMobile;
  });
}


// ── Mobile Actions Modal (editor header buttons) ─────────────────────────────

/**
 * On mobile (≤768px), hide the .buttons container in .header-row and show
 * a single "☰ Actions" trigger button. Tapping it opens a full-screen modal
 * with all the original buttons cloned and stacked vertically.
 *
 * Call once from DOMContentLoaded on editor pages.
 */
function initMobileActionsModal() {
  var headerRow = document.querySelector('.header-row');
  var buttonsDiv = headerRow && headerRow.querySelector('.buttons');
  if (!headerRow || !buttonsDiv) return;

  // Create the trigger button (hidden at desktop via CSS)
  var trigger = document.createElement('button');
  trigger.className = 'mobile-actions-trigger';
  trigger.innerHTML = '☰ Actions';
  trigger.addEventListener('click', function () { _openMobileActionsModal(); });
  headerRow.appendChild(trigger);

  // Create the modal container (hidden by default)
  var modal = document.createElement('div');
  modal.id = 'mobile-actions-modal';
  modal.className = 'mobile-actions-modal';
  modal.innerHTML = '<div class="mobile-actions-modal-content">' +
    '<h3>Actions</h3>' +
    '<div class="mobile-actions-list"></div>' +
    '<button class="mobile-actions-close"><span style="font-size:2.2em;font-weight:900;line-height:0;vertical-align:middle;position:relative;top:-0.25em;">⇤</span> Hide Sidebar</button>' +
    '</div>';
  document.body.appendChild(modal);

  modal.querySelector('.mobile-actions-close').addEventListener('click', function () {
    modal.classList.remove('active');
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.classList.remove('active');
  });
}

function _openMobileActionsModal() {
  var modal = document.getElementById('mobile-actions-modal');
  if (!modal) return;
  var list = modal.querySelector('.mobile-actions-list');
  list.innerHTML = '';

  // Grab all buttons from the header .buttons container (works even when hidden by CSS)
  var buttonsDiv = document.querySelector('.header-row .buttons');
  if (!buttonsDiv) return;

  var buttons = buttonsDiv.querySelectorAll('button');
  buttons.forEach(function (btn) {
    // Skip disabled "Saved" indicator buttons (any page)
    if (btn.disabled && btn.style.pointerEvents === 'none') return;
    // Skip buttons hidden by save-state logic (display:none means not relevant right now)
    if (btn.style.display === 'none') return;
    var clone = document.createElement('button');
    clone.className = 'mobile-action-btn ' + (btn.className || '');
    clone.innerHTML = btn.innerHTML;
    clone.disabled = btn.disabled;

    // Extract the onclick handler — call it directly instead of btn.click()
    // (btn.click() can fail on elements inside display:none containers)
    var onclickAttr = btn.getAttribute('onclick');
    clone.addEventListener('click', function () {
      modal.classList.remove('active');
      if (onclickAttr) {
        // Execute the onclick attribute string
        new Function(onclickAttr).call(btn);
      } else {
        // Fallback: dispatch click on the original
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    list.appendChild(clone);
  });

  modal.classList.add('active');
}


// ── Long-press to simulate shift-click (mobile quick edit) ───────────────────

/**
 * Attach a long-press handler to an element. On mobile, a long press
 * triggers the callback (used to open quick edit modal, same as shift-click).
 * Cancels if the finger moves (drag) or lifts early (tap).
 *
 * DEPRECATED: Prefer enableTouchGesture() from shared-touch.js for new code.
 * This function remains for elements that only need long-press without drag
 * (e.g. calendar events which have their own drag system).
 *
 * Uses centralized timing from shared-touch.js (TOUCH_LONGPRESS_HOLD_MS).
 *
 * @param {HTMLElement} el - The element to attach to
 * @param {Function} callback - Called on successful long press, receives the element
 */
function enableLongPress(el, callback) {
  if (!el || !callback) return;
  var _lpTimer = null;
  var _lpFired = false;
  var _startX = 0;
  var _startY = 0;
  var HOLD_MS = (typeof TOUCH_LONGPRESS_HOLD_MS !== 'undefined') ? TOUCH_LONGPRESS_HOLD_MS : 800;
  var MOVE_THRESHOLD = (typeof TOUCH_DRAG_MOVE_THRESHOLD !== 'undefined') ? TOUCH_DRAG_MOVE_THRESHOLD : 10;

  el.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    // Don't start long-press if a drag operation is in progress
    if (window._touchDragActive) return;
    _lpFired = false;
    _startX = e.touches[0].clientX;
    _startY = e.touches[0].clientY;
    _lpTimer = setTimeout(function () {
      // Re-check drag state — a drag may have started during the hold period
      if (window._touchDragActive || window._dragJustEnded) { _lpTimer = null; return; }
      _lpFired = true;
      // Haptic feedback — use _cwocVibrate for Android compat
      if (typeof _cwocVibrate === 'function') {
        _cwocVibrate(200);
      } else if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      callback(el);
    }, HOLD_MS);
  }, { passive: true });

  el.addEventListener('touchmove', function (e) {
    if (!_lpTimer) return;
    var dx = e.touches[0].clientX - _startX;
    var dy = e.touches[0].clientY - _startY;
    if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
      clearTimeout(_lpTimer);
      _lpTimer = null;
    }
  }, { passive: true });

  el.addEventListener('touchend', function (e) {
    clearTimeout(_lpTimer);
    _lpTimer = null;
    // If long press fired, prevent the subsequent click/tap
    if (_lpFired) {
      e.preventDefault();
      _lpFired = false;
    }
  });

  el.addEventListener('touchcancel', function () {
    clearTimeout(_lpTimer);
    _lpTimer = null;
    _lpFired = false;
  });
}


// ── Mobile Views Button (replaces tab bar on mobile) ─────────────────────────

/**
 * On mobile (≤480px), add a "Views" button next to the header title.
 * Tapping it opens a full-screen dropdown with the 6 C CAPTN tabs.
 * The original .tabs row is hidden via CSS.
 *
 * Call once from DOMContentLoaded on the dashboard page.
 */
function initMobileViewsButton() {
  var header = document.querySelector('.header');
  if (!header) return;

  // Tab button in header, pushed to right edge via margin-left:auto
  var btn = document.createElement('button');
  btn.className = 'mobile-views-btn';
  btn.id = 'mobile-views-btn';
  // Show current view name instead of generic "Views"
  btn.textContent = '☰ ' + (typeof currentTab !== 'undefined' && currentTab ? currentTab : 'Views');
  header.appendChild(btn);

  // Backdrop
  var backdrop = document.createElement('div');
  backdrop.className = 'mobile-views-backdrop';
  document.body.appendChild(backdrop);

  // Slide-in panel
  var panel = document.createElement('div');
  panel.className = 'mobile-views-panel';
  panel.innerHTML = '<h3>Views</h3>';

  // Build options from the existing tabs
  var tabs = document.querySelectorAll('.tabs .tab');
  tabs.forEach(function (tab) {
    var opt = document.createElement('div');
    opt.className = 'mobile-view-option';
    if (tab.classList.contains('active')) opt.classList.add('active');
    opt.innerHTML = tab.innerHTML;
    opt.addEventListener('click', function () {
      _closeViewsPanel();
      tab.click();
      panel.querySelectorAll('.mobile-view-option').forEach(function (o) { o.classList.remove('active'); });
      opt.classList.add('active');
    });
    panel.appendChild(opt);
  });

  var closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-views-close';
  closeBtn.innerHTML = '<span style="font-size:2.2em;font-weight:900;line-height:0;vertical-align:middle;position:relative;top:-0.25em;">⇤</span> Hide Sidebar';
  closeBtn.addEventListener('click', function () { _closeViewsPanel(); });
  panel.appendChild(closeBtn);

  document.body.appendChild(panel);

  function _openViewsPanel() {
    // Refresh active state
    var currentTabs = document.querySelectorAll('.tabs .tab');
    var opts = panel.querySelectorAll('.mobile-view-option');
    currentTabs.forEach(function (t, i) {
      if (opts[i]) {
        opts[i].classList.toggle('active', t.classList.contains('active'));
      }
    });
    backdrop.classList.add('active');
    panel.classList.add('active');
  }

  function _closeViewsPanel() {
    panel.classList.remove('active');
    backdrop.classList.remove('active');
  }

  btn.addEventListener('click', _openViewsPanel);
  backdrop.addEventListener('click', _closeViewsPanel);

  // ── Swipe from right edge to open, swipe right to close ────────────
  var _vsStartX = 0, _vsStartY = 0, _vsTracking = false;
  var EDGE_ZONE = 25; // px from right edge
  var SWIPE_THRESHOLD = 40;

  document.addEventListener('touchstart', function (e) {
    if (!_isMobileOverlay()) return;
    var touch = e.touches[0];
    _vsStartX = touch.clientX;
    _vsStartY = touch.clientY;
    var fromRightEdge = window.innerWidth - touch.clientX < EDGE_ZONE;
    _vsTracking = fromRightEdge || panel.classList.contains('active');
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!_vsTracking || !_isMobileOverlay()) { _vsTracking = false; return; }
    if (window._emailSwipeActive) { _vsTracking = false; return; }
    var touch = e.changedTouches[0];
    var dx = touch.clientX - _vsStartX;
    var dy = Math.abs(touch.clientY - _vsStartY);
    _vsTracking = false;
    if (Math.abs(dx) < SWIPE_THRESHOLD || dy > Math.abs(dx)) return;

    if (dx < 0 && !panel.classList.contains('active') && (window.innerWidth - _vsStartX) < EDGE_ZONE) {
      // Swipe left from right edge → open (only if sidebar is NOT open)
      var sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('active')) return;
      _openViewsPanel();
    } else if (dx > 0 && panel.classList.contains('active')) {
      // Swipe right → close
      _closeViewsPanel();
    }
  }, { passive: true });
}

/**
 * Update the mobile Views button label to show the current tab name.
 * Called from filterChits() and on initial load after state restore.
 */
function _updateMobileViewsLabel() {
  var btn = document.getElementById('mobile-views-btn');
  if (!btn) return;
  var label = (typeof currentTab !== 'undefined' && currentTab) ? currentTab : 'Views';
  btn.textContent = '☰ ' + label;
}


// ── Mobile Reference Close Button ────────────────────────────────────────────

/**
 * Add a close button inside the reference overlay content for mobile.
 * On desktop, clicking outside the content closes it. On mobile the content
 * fills the screen so there's no outside area to tap.
 */
function initMobileReferenceClose() {
  var content = document.querySelector('.reference-content');
  if (!content) return;
  if (content.querySelector('.ref-close-btn')) return; // already added

  var btn = document.createElement('button');
  btn.className = 'ref-close-btn';
  btn.innerHTML = '<span style="font-size:2.2em;font-weight:900;line-height:0;vertical-align:middle;position:relative;top:-0.25em;">⇤</span> Hide Sidebar';
  btn.style.cssText = 'display:block;width:100%;margin-top:12px;padding:10px;' +
    'font-size:1em;font-weight:bold;font-family:Lora, Georgia, serif;' +
    'background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:4px;' +
    'cursor:pointer;min-height:44px;';
  btn.addEventListener('click', function () {
    if (typeof _closeReference === 'function') _closeReference();
  });
  content.appendChild(btn);
}
/**
 * shared-habits.js — Habits calculation helpers.
 *
 * Pure calculation functions used by both the dashboard habits view and the
 * chit editor. Includes period date calculation, success rate, streak counting,
 * period rollover evaluation, and the shared habit counter widget.
 *
 * Loaded BEFORE shared.js (which references these functions).
 */

// ── Habits Helpers ────────────────────────────────────────────────────────────

/**
 * Return the current period's date for a recurring chit as a YYYY-MM-DD string.
 *
 * The "current period" depends on the chit's recurrence frequency:
 *   DAILY  (interval=1) → today
 *   DAILY  (interval>1) → walk from start by interval days, find period containing today
 *   WEEKLY (no byDay)   → start of current week per week_start_day setting
 *   WEEKLY (with byDay) → most recent scheduled day ≤ today
 *   MONTHLY             → 1st of current month
 *   YEARLY              → Jan 1 of current year
 *   Custom intervals    → walk from start by interval steps, find most recent ≤ today
 *
 * Fallback: if chit has no start_datetime, returns today's date.
 *
 * @param {object} chit - A chit object with recurrence_rule and start_datetime
 * @returns {string} YYYY-MM-DD
 */
function getCurrentPeriodDate(chit) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  function _pad(n) { return n < 10 ? '0' + n : '' + n; }
  function _fmt(d) { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }

  var rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return _fmt(today);

  var freq = rule.freq;
  var interval = rule.interval || 1;
  var byDay = rule.byDay || [];

  // Parse start date — fallback to today if missing
  var startDate;
  if (chit.start_datetime) {
    startDate = new Date(chit.start_datetime);
    startDate.setHours(0, 0, 0, 0);
  } else {
    return _fmt(today);
  }

  // If start date is in the future, return start date
  if (startDate > today) return _fmt(startDate);

  var dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  // ── DAILY ──
  if (freq === 'DAILY') {
    if (interval === 1) {
      return _fmt(today);
    }
    // Walk from start by interval days, find the period containing today
    var cur = new Date(startDate);
    while (true) {
      var next = new Date(cur);
      next.setDate(next.getDate() + interval);
      if (next > today) return _fmt(cur);
      cur = next;
    }
  }

  // ── WEEKLY ──
  if (freq === 'WEEKLY') {
    var byDayNums = byDay.map(function(d) { return dayMap[d]; }).filter(function(n) { return n !== undefined; });

    if (byDayNums.length > 0) {
      // WEEKLY with byDay: find the most recent scheduled day ≤ today
      if (interval === 1) {
        // Simple case: check each day going backward from today
        var check = new Date(today);
        for (var i = 0; i < 7; i++) {
          if (byDayNums.indexOf(check.getDay()) !== -1 && check >= startDate) {
            return _fmt(check);
          }
          check.setDate(check.getDate() - 1);
        }
        // Fallback — shouldn't happen with valid byDay
        return _fmt(today);
      } else {
        // Multi-week interval with byDay: walk from start using _advanceRecurrence pattern
        var cur = new Date(startDate);
        var best = new Date(startDate);
        var maxIter = 5000;
        for (var i = 0; i < maxIter; i++) {
          if (cur > today) break;
          // Check if this day matches byDay
          if (byDayNums.indexOf(cur.getDay()) !== -1) {
            best = new Date(cur);
          }
          // Advance: step one day at a time, but when we wrap to the first byDay of a new week, skip (interval-1) weeks
          var prevDay = cur.getDay();
          cur.setDate(cur.getDate() + 1);
          if (cur.getDay() === byDayNums[0] && prevDay !== byDayNums[0]) {
            // We've wrapped to the start of a new cycle
            if (interval > 1) {
              cur.setDate(cur.getDate() + (interval - 1) * 7);
            }
          }
        }
        return _fmt(best);
      }
    } else {
      // WEEKLY without byDay: return start of current week
      var weekStartDay = 0; // default Sunday
      if (window._cwocSettings && window._cwocSettings.week_start_day !== undefined) {
        weekStartDay = parseInt(window._cwocSettings.week_start_day) || 0;
      }
      if (interval === 1) {
        var d = new Date(today);
        var diff = (d.getDay() - weekStartDay + 7) % 7;
        d.setDate(d.getDate() - diff);
        // Ensure we don't go before start date
        if (d < startDate) return _fmt(startDate);
        return _fmt(d);
      } else {
        // Multi-week interval: walk from start by interval weeks
        var cur = new Date(startDate);
        // Align start to week start day
        var startDiff = (cur.getDay() - weekStartDay + 7) % 7;
        cur.setDate(cur.getDate() - startDiff);
        while (true) {
          var next = new Date(cur);
          next.setDate(next.getDate() + interval * 7);
          if (next > today) return _fmt(cur);
          cur = next;
        }
      }
    }
  }

  // ── MONTHLY ──
  if (freq === 'MONTHLY') {
    if (interval === 1) {
      return today.getFullYear() + '-' + _pad(today.getMonth() + 1) + '-01';
    }
    // Multi-month interval: walk from start month by interval
    var cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (true) {
      var next = new Date(cur);
      next.setMonth(next.getMonth() + interval);
      if (next > today) return _fmt(cur);
      cur = next;
    }
  }

  // ── YEARLY ──
  if (freq === 'YEARLY') {
    if (interval === 1) {
      return today.getFullYear() + '-01-01';
    }
    // Multi-year interval: walk from start year by interval
    var curYear = startDate.getFullYear();
    while (true) {
      var nextYear = curYear + interval;
      var nextDate = new Date(nextYear, 0, 1);
      if (nextDate > today) return curYear + '-01-01';
      curYear = nextYear;
    }
  }

  // ── Fallback for unknown freq: walk from start using generic interval ──
  return _fmt(today);
}

/**
 * Calculate the success rate for a habit chit over a given window.
 *
 * Uses habit_success/habit_goal from recurrence exceptions to determine
 * whether each period was met (habit_success >= habit_goal). Falls back
 * to the legacy completed field for old entries that lack these fields.
 *
 * Formula: round((periods where met) / (total non-broken-off periods in window) * 100)
 * Broken-off periods are excluded from both numerator and denominator.
 * Returns 0 when no periods exist.
 *
 * Respects the habits_success_window setting via the windowDays parameter.
 *
 * @param {object} chit - A chit object with recurrence_rule, recurrence_exceptions, start_datetime
 * @param {number|string} windowDays - Number of days to look back, or "all" for all time
 * @returns {number} Integer 0–100
 */
function getHabitSuccessRate(chit, windowDays) {
  var rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return 0;

  function _pad(n) { return n < 10 ? '0' + n : '' + n; }
  function _fmt(d) { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse start date — return 0 if missing
  var startDate;
  if (chit.start_datetime) {
    startDate = new Date(chit.start_datetime);
    startDate.setHours(0, 0, 0, 0);
  } else {
    return 0;
  }

  // Determine the date range
  var rangeStart;
  if (windowDays === 'all') {
    rangeStart = new Date(startDate);
  } else {
    var days = parseInt(windowDays, 10) || 30;
    rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - days);
  }
  // Clamp rangeStart to not be before the chit start
  if (rangeStart < startDate) {
    rangeStart = new Date(startDate);
  }

  var freq = rule.freq;
  var interval = rule.interval || 1;
  var byDay = rule.byDay || [];
  var until = rule.until ? new Date(rule.until) : null;

  var dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  var byDayNums = byDay.map(function(d) { return dayMap[d]; }).filter(function(n) { return n !== undefined; });

  // Build lookup maps from recurrence_exceptions
  var exceptions = chit.recurrence_exceptions || [];
  var exceptionMap = {};
  for (var i = 0; i < exceptions.length; i++) {
    exceptionMap[exceptions[i].date] = exceptions[i];
  }

  // Walk recurrence from start date, collecting occurrences within range
  var total = 0;
  var met = 0;
  var current = new Date(startDate);
  var maxIter = 10000; // safety limit

  for (var iter = 0; iter < maxIter; iter++) {
    // Stop if past today or past until date
    if (current > today) break;
    if (until && current > until) break;

    var dateStr = _fmt(current);

    // For WEEKLY with byDay, only count days that match
    var dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      dayMatches = byDayNums.indexOf(current.getDay()) !== -1;
    }

    if (dayMatches && current >= rangeStart) {
      var ex = exceptionMap[dateStr];

      // Skip broken-off periods from both numerator and denominator
      if (ex && ex.broken_off) {
        // excluded — do nothing
      } else {
        total++;
        if (ex) {
          // New-style entry: use habit_success/habit_goal fields
          if (ex.habit_success !== undefined && ex.habit_goal !== undefined) {
            if (ex.habit_success >= ex.habit_goal) {
              met++;
            }
          } else {
            // Legacy entry: fall back to completed field
            if (ex.completed) {
              met++;
            }
          }
        }
        // No exception for this date means it was missed (not met)
      }
    }

    // Advance to next occurrence
    if (freq === 'DAILY') {
      current.setDate(current.getDate() + interval);
    } else if (freq === 'WEEKLY') {
      if (byDayNums.length > 0) {
        current.setDate(current.getDate() + 1);
        if (current.getDay() === byDayNums[0] && interval > 1) {
          current.setDate(current.getDate() + (interval - 1) * 7);
        }
      } else {
        current.setDate(current.getDate() + interval * 7);
      }
    } else if (freq === 'MONTHLY') {
      current.setMonth(current.getMonth() + interval);
    } else if (freq === 'YEARLY') {
      current.setFullYear(current.getFullYear() + interval);
    } else {
      break; // unknown frequency
    }
  }

  if (total === 0) return 0;
  return Math.round((met / total) * 100);
}

/**
 * Calculate the current streak for a habit chit.
 *
 * Returns the count of consecutive periods where habit_success >= habit_goal,
 * walking backward from the most recent past non-broken-off occurrence.
 * Uses habit_success/habit_goal from recurrence exceptions; falls back to
 * the legacy completed field for old entries without those fields.
 *
 * Broken-off (skipped) dates are treated as neutral — they are skipped
 * entirely and neither contribute to nor break the streak. The streak
 * stops at the first genuinely missed occurrence (not met, not broken off).
 *
 * Only counts periods from when habit tracking started (start_datetime).
 *
 * @param {object} chit - A chit object with recurrence_rule, recurrence_exceptions, start_datetime
 * @returns {number} Integer ≥ 0
 */
function getHabitStreak(chit) {
  var rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return 0;

  function _pad(n) { return n < 10 ? '0' + n : '' + n; }
  function _fmt(d) { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse start date — return 0 if missing
  var startDate;
  if (chit.start_datetime) {
    startDate = new Date(chit.start_datetime);
    startDate.setHours(0, 0, 0, 0);
  } else {
    return 0;
  }

  var freq = rule.freq;
  var interval = rule.interval || 1;
  var byDay = rule.byDay || [];
  var until = rule.until ? new Date(rule.until) : null;

  var dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  var byDayNums = byDay.map(function(d) { return dayMap[d]; }).filter(function(n) { return n !== undefined; });

  // Build lookup map from recurrence_exceptions (keyed by date)
  var exceptions = chit.recurrence_exceptions || [];
  var exceptionMap = {};
  for (var i = 0; i < exceptions.length; i++) {
    exceptionMap[exceptions[i].date] = exceptions[i];
  }

  // Walk recurrence from start date forward, collecting all occurrence dates
  // up to today (we need them in order to walk backward)
  var occurrences = [];
  var current = new Date(startDate);
  var maxIter = 10000; // safety limit

  for (var iter = 0; iter < maxIter; iter++) {
    // Stop if past today or past until date
    if (current > today) break;
    if (until && current > until) break;

    var dateStr = _fmt(current);

    // For WEEKLY with byDay, only count days that match
    var dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      dayMatches = byDayNums.indexOf(current.getDay()) !== -1;
    }

    if (dayMatches) {
      occurrences.push(dateStr);
    }

    // Advance to next occurrence
    if (freq === 'DAILY') {
      current.setDate(current.getDate() + interval);
    } else if (freq === 'WEEKLY') {
      if (byDayNums.length > 0) {
        current.setDate(current.getDate() + 1);
        if (current.getDay() === byDayNums[0] && interval > 1) {
          current.setDate(current.getDate() + (interval - 1) * 7);
        }
      } else {
        current.setDate(current.getDate() + interval * 7);
      }
    } else if (freq === 'MONTHLY') {
      current.setMonth(current.getMonth() + interval);
    } else if (freq === 'YEARLY') {
      current.setFullYear(current.getFullYear() + interval);
    } else {
      break; // unknown frequency
    }
  }

  // Walk backward from the most recent occurrence, counting consecutive
  // periods where the goal was met. Broken-off periods are skipped (neutral).
  var streak = 0;
  for (var j = occurrences.length - 1; j >= 0; j--) {
    var dateKey = occurrences[j];
    var ex = exceptionMap[dateKey];

    // Skip broken-off periods — neutral, neither break nor count
    if (ex && ex.broken_off) {
      continue;
    }

    // Determine if this period was met
    var wasMet = false;
    if (ex) {
      if (ex.habit_success !== undefined && ex.habit_goal !== undefined) {
        // New-style entry: use habit_success/habit_goal
        wasMet = ex.habit_success >= ex.habit_goal;
      } else {
        // Legacy entry: fall back to completed field
        wasMet = !!ex.completed;
      }
    }
    // No exception means missed (wasMet stays false)

    if (wasMet) {
      streak++;
    } else {
      // Genuinely missed — stop counting
      break;
    }
  }

  return streak;
}

// ── Period Rollover (Habits Overhaul) ────────────────────────────────────────

/**
 * Evaluate whether a habit chit needs period rollover.
 *
 * Lazy rollover: called on view load or editor load, not via background process.
 * If the current period has advanced past the last recorded period, this function:
 *   1. Snapshots the current habit_success/habit_goal into a recurrence exception
 *   2. Resets habit_success to 0
 *   3. Clears "Complete" status if set
 *
 * The chit object is modified in-place. Returns true if rollover occurred
 * (caller is responsible for persisting via PUT).
 *
 * @param {object} chit - A chit object with habit, recurrence_rule, recurrence_exceptions, etc.
 * @returns {boolean} Whether rollover occurred
 */
function _evaluateHabitRollover(chit) {
  if (!chit.habit) return false;
  var rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return false;

  var currentPeriod = getCurrentPeriodDate(chit);
  if (!currentPeriod) return false;

  if (!Array.isArray(chit.recurrence_exceptions)) {
    chit.recurrence_exceptions = [];
  }

  var exceptions = chit.recurrence_exceptions;
  var previousPeriod = _getPreviousPeriodDate(chit, currentPeriod);

  // Find the most recent habit snapshot date
  var lastSnapshotDate = null;
  for (var i = 0; i < exceptions.length; i++) {
    if (exceptions[i].habit_success !== undefined) {
      if (!lastSnapshotDate || exceptions[i].date > lastSnapshotDate) {
        lastSnapshotDate = exceptions[i].date;
      }
    }
  }

  // RULE 1: If no previous snapshots exist, never roll over.
  // The current habit_success belongs to the current period.
  // Rollover only makes sense when we have history.
  if (!lastSnapshotDate) return false;

  // RULE 2: If the last snapshot is the previous period or later, no rollover needed.
  // The current habit_success belongs to the current period.
  if (lastSnapshotDate >= previousPeriod) return false;

  // RULE 3: The last snapshot is OLDER than the previous period.
  // This means the period has genuinely changed — snapshot current progress.
  var habitSuccess = chit.habit_success || 0;
  var habitGoal = chit.habit_goal || 1;
  var isComplete = chit.status === 'Complete';

  var snapshot = {
    date: previousPeriod,
    completed: habitSuccess >= habitGoal,
    habit_success: habitSuccess,
    habit_goal: habitGoal
  };

  // Check if previous period already has an exception
  var existingIdx = -1;
  for (var j = 0; j < exceptions.length; j++) {
    if (exceptions[j].date === previousPeriod) {
      existingIdx = j;
      break;
    }
  }

  if (existingIdx >= 0) {
    if (exceptions[existingIdx].habit_success !== undefined) return false;
    exceptions[existingIdx].habit_success = habitSuccess;
    exceptions[existingIdx].habit_goal = habitGoal;
    exceptions[existingIdx].completed = habitSuccess >= habitGoal;
  } else {
    exceptions.push(snapshot);
  }

  chit.habit_success = 0;
  if (isComplete) chit.status = '';

  console.debug('[Rollover] ' + (chit.title || chit.id) + ': snapshotted ' + habitSuccess + '/' + habitGoal + ' into ' + previousPeriod + ', reset to 0');
  return true;
}

/**
 * Get the previous period date before a given period date for a chit.
 * Used by _evaluateHabitRollover to determine which period just ended.
 *
 * @param {object} chit - A chit with recurrence_rule and start_datetime
 * @param {string} currentPeriod - YYYY-MM-DD of the current period
 * @returns {string|null} YYYY-MM-DD of the previous period, or null
 */
function _getPreviousPeriodDate(chit, currentPeriod) {
  var rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return null;

  function _pad(n) { return n < 10 ? '0' + n : '' + n; }
  function _fmt(d) { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }

  var freq = rule.freq;
  var interval = rule.interval || 1;
  var currentDate = new Date(currentPeriod + 'T00:00:00');

  if (freq === 'DAILY') {
    var prev = new Date(currentDate);
    prev.setDate(prev.getDate() - interval);
    return _fmt(prev);
  }

  if (freq === 'WEEKLY') {
    var prev = new Date(currentDate);
    prev.setDate(prev.getDate() - (interval * 7));
    return _fmt(prev);
  }

  if (freq === 'MONTHLY') {
    var prev = new Date(currentDate);
    prev.setMonth(prev.getMonth() - interval);
    return _fmt(prev);
  }

  if (freq === 'YEARLY') {
    var prev = new Date(currentDate);
    prev.setFullYear(prev.getFullYear() - interval);
    return _fmt(prev);
  }

  return null;
}

/**
 * Persist a habit chit after rollover via PUT /api/chits/{id}.
 * Called in the background — does not block rendering.
 *
 * @param {object} chit - The chit object that was modified by _evaluateHabitRollover
 */
async function _persistHabitRollover(chit) {
  if (!chit || !chit.id) return;
  try {
    // Strip fields not in the Chit model to avoid 422
    var payload = Object.assign({}, chit);
    delete payload.owner_id; delete payload.effective_role; delete payload.assigned_to_display_name;
    delete payload.deleted_datetime; delete payload.owner_display_name; delete payload.owner_username;
    delete payload.habit_periods; delete payload.email_account_id;
    var resp = await fetch('/api/chits/' + chit.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      console.error('[_persistHabitRollover] Failed to save rollover for chit ' + chit.id + ':', resp.status);
    }
  } catch (err) {
    console.error('[_persistHabitRollover] Error saving rollover for chit ' + chit.id + ':', err);
  }
}

/**
 * Build a habit counter widget: [−] progress [+]
 * Shared between the Habits View and the Chit Editor.
 *
 * @param {object} opts
 *   - success: current habit_success value
 *   - goal: habit_goal value
 *   - freqLabel: optional frequency label (e.g., " each Week")
 *   - disabled: whether buttons should be disabled (reset active)
 *   - onIncrement: function(newSuccess) called when + is clicked
 *   - onDecrement: function(newSuccess) called when − is clicked
 * @returns {HTMLElement} container with − button, progress text, + button
 */
function _buildHabitCounter(opts) {
  var success = opts.success || 0;
  var goal = opts.goal || 1;
  var freqLabel = opts.freqLabel || '';
  var disabled = opts.disabled || false;

  var wrap = document.createElement('span');
  wrap.className = 'habit-counter-widget';

  // − button (left)
  var minusBtn = document.createElement('button');
  minusBtn.type = 'button';
  minusBtn.className = 'habit-counter-btn';
  minusBtn.textContent = '−';
  minusBtn.title = 'Decrement';
  minusBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    var cur = parseInt(wrap.dataset.success) || 0;
    if (cur <= 0) return;
    var newVal = cur - 1;
    wrap.dataset.success = newVal;
    _updateCounterDisplay(wrap, newVal, parseInt(wrap.dataset.goal) || 1, freqLabel);
    if (opts.onDecrement) opts.onDecrement(newVal);
  });
  wrap.appendChild(minusBtn);

  // Progress text
  var progressSpan = document.createElement('span');
  progressSpan.className = 'habit-progress';
  progressSpan.textContent = success + ' / ' + goal + freqLabel;
  progressSpan.title = 'Progress: ' + success + ' of ' + goal + ' this period';
  wrap.appendChild(progressSpan);

  // + button (right)
  var plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.className = 'habit-counter-btn';
  plusBtn.textContent = '+';
  plusBtn.title = disabled ? 'Reset period active — wait for cooldown' : 'Increment';
  if (disabled) {
    plusBtn.disabled = true;
    plusBtn.style.opacity = '0.4';
    plusBtn.style.cursor = 'not-allowed';
  }
  plusBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    var cur = parseInt(wrap.dataset.success) || 0;
    var g = parseInt(wrap.dataset.goal) || 1;
    if (cur >= g) return;
    var newVal = cur + 1;
    wrap.dataset.success = newVal;
    _updateCounterDisplay(wrap, newVal, g, freqLabel);
    if (opts.onIncrement) opts.onIncrement(newVal);
  });
  wrap.appendChild(plusBtn);

  // Store state on the element for updates
  wrap.dataset.success = success;
  wrap.dataset.goal = goal;

  return wrap;
}

/** Update the progress text inside a habit counter widget */
function _updateCounterDisplay(wrap, success, goal, freqLabel) {
  var span = wrap.querySelector('.habit-progress');
  if (span) {
    span.textContent = success + ' / ' + goal + (freqLabel || '');
    span.title = 'Progress: ' + success + ' of ' + goal + ' this period';
  }
}
/**
 * shared-alarms.js — Global alarm system + quick alert modal + global hotkeys.
 *
 * Runs on EVERY page (dashboard, editor, settings, etc.):
 *   - Fetches chits + independent alerts
 *   - Checks alarms every second, shows modal notifications
 *   - Handles snooze/dismiss with cross-device sync
 *   - Quick Alert modal (! hotkey — adds alarm/timer/stopwatch)
 *   - Global hotkey listener (!, `, ~ — works on all pages)
 *
 * Depends on: shared-utils.js (getCachedSettings), shared.js (syncSend, syncOn,
 *   cwocPlayAudio, initAudioUnlock — but those are defined before this runs
 *   at DOMContentLoaded time since all scripts are loaded synchronously).
 *
 * Loaded BEFORE shared.js.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Global Alarm System — runs on EVERY page (dashboard, editor, settings, etc.)
// Fetches chits + independent alerts, checks alarms every second, shows modals.
// ══════════════════════════════════════════════════════════════════════════════

window._sharedAlarmTriggered = window._sharedAlarmTriggered || new Set();
window._sharedSnoozeRegistry = window._sharedSnoozeRegistry || {};
window._sharedAlarmInterval = null;
window._sharedAlarmAudio = null;
window._sharedTimerAudio = null;
window._sharedAlarmTimeout = null;
window._sharedTimeFormat = '24hour';
window._sharedChits = [];
window._sharedIndependentAlerts = [];

// ── Time format ──
function _sharedFmtTime(time24) {
  if (!time24) return '';
  if (window._sharedTimeFormat === '12hour' || window._sharedTimeFormat === '12houranalog') {
    var parts = time24.split(':').map(Number);
    var h = parts[0], m = parts[1];
    var ampm = h >= 12 ? 'PM' : 'AM';
    return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }
  return time24;
}

// ── Sound ──
function _sharedPlayAlarm() {
  if (!window._sharedAlarmAudio) window._sharedAlarmAudio = new Audio('/static/alarm.mp3');
  window._sharedAlarmAudio.loop = true;
  cwocPlayAudio(window._sharedAlarmAudio, { loop: true });
  if (window._sharedAlarmTimeout) clearTimeout(window._sharedAlarmTimeout);
  window._sharedAlarmTimeout = setTimeout(_sharedStopAlarm, 5 * 60 * 1000);
}
function _sharedStopAlarm() {
  if (window._sharedAlarmAudio) cwocStopAudio(window._sharedAlarmAudio);
  if (window._sharedAlarmTimeout) { clearTimeout(window._sharedAlarmTimeout); window._sharedAlarmTimeout = null; }
  if (navigator.vibrate) try { navigator.vibrate(0); } catch (e) {}
}
function _sharedPlayTimer() {
  if (!window._sharedTimerAudio) window._sharedTimerAudio = new Audio('/static/timer.mp3');
  window._sharedTimerAudio.loop = true;
  cwocPlayAudio(window._sharedTimerAudio, { loop: true });
}
function _sharedStopTimer() {
  if (window._sharedTimerAudio) { cwocStopAudio(window._sharedTimerAudio); window._sharedTimerAudio.loop = false; }
}

// ── Snooze helpers ──
function _sharedGetSnoozeMs() {
  var len = window._snoozeLength || window._sharedSnoozeLength || '5 minutes';
  var match = String(len).match(/(\d+)\s*(minute|hour|second)/i);
  if (!match) return 5 * 60 * 1000;
  var val = parseInt(match[1]);
  var unit = match[2].toLowerCase();
  if (unit.startsWith('hour')) return val * 3600000;
  if (unit.startsWith('second')) return val * 1000;
  return val * 60000;
}

function _sharedPersistDismiss(key) {
  window._sharedAlarmTriggered.add(key);
  fetch('/api/alert-state', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert_key: key, state: 'dismissed' }) }).catch(function() {});
}
function _sharedPersistSnooze(key, untilTs) {
  window._sharedSnoozeRegistry[key] = untilTs;
  fetch('/api/alert-state', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert_key: key, state: 'snoozed', until_ts: new Date(untilTs).toISOString() }) }).catch(function() {});
}

// ── Load persisted state ──
function _sharedLoadAlertStates() {
  fetch('/api/alert-state').then(function(r) { return r.json(); }).then(function(states) {
    states.forEach(function(s) {
      if (s.state === 'dismissed') window._sharedAlarmTriggered.add(s.alert_key);
      else if (s.state === 'snoozed' && s.until_ts) window._sharedSnoozeRegistry[s.alert_key] = new Date(s.until_ts).getTime();
    });
  }).catch(function() {});
}

// ── Fetch data ──
function _sharedFetchData() {
  // Sync from dashboard's chits array if available and populated
  if (typeof chits !== 'undefined' && Array.isArray(chits)) {
    window._sharedChits = chits;
  }
  // Always fetch fresh from API too (covers non-dashboard pages and stale data)
  fetch('/api/chits').then(function(r) { return r.json(); }).then(function(data) {
    if (Array.isArray(data) && data.length > 0) window._sharedChits = data;
  }).catch(function() {});

  if (typeof _independentAlerts !== 'undefined' && Array.isArray(_independentAlerts)) {
    window._sharedIndependentAlerts = _independentAlerts;
  }
  fetch('/api/standalone-alerts').then(function(r) { return r.json(); }).then(function(data) {
    if (Array.isArray(data)) window._sharedIndependentAlerts = data;
  }).catch(function() {});
}

// ── Bold alert modal (works on any page) ──
function _sharedShowAlertModal(opts) {
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:100000;display:flex;justify-content:center;align-items:center;opacity:0;transition:opacity 0.3s ease;touch-action:none;user-select:none;';
  overlay.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
  overlay.addEventListener('wheel', function(e) { e.preventDefault(); }, { passive: false });

  var modal = document.createElement('div');
  modal.style.cssText = "background:url('/static/parchment.jpg') center/cover;background-color:#fff8e1;border:3px solid #8b4513;border-radius:12px;padding:0;width:90%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,0.5),0 0 60px rgba(212,175,55,0.3);font-family:Lora, Georgia, serif;color:#3c2f2f;text-align:center;overflow:hidden;";
  var bar = document.createElement('div'); bar.style.cssText = 'width:100%;height:6px;background:#e8dcc8;overflow:hidden;';
  var barFill = document.createElement('div'); barFill.style.cssText = 'height:100%;width:100%;background:linear-gradient(90deg,#d4af37 0%,#c8965a 60%,#8b4513 100%);';
  bar.appendChild(barFill); modal.appendChild(bar);
  var iconEl = document.createElement('div'); iconEl.style.cssText = 'font-size:3em;margin:20px 0 8px;line-height:1;'; iconEl.textContent = opts.icon || '🔔'; modal.appendChild(iconEl);
  var titleEl = document.createElement('div'); titleEl.style.cssText = 'font-size:1.5em;font-weight:bold;color:#4a2c2a;margin:0 16px 6px;word-break:break-word;'; titleEl.textContent = opts.title || 'Alert'; modal.appendChild(titleEl);
  if (opts.subtitle) { var subEl = document.createElement('div'); subEl.style.cssText = 'font-size:1.1em;color:#6b4226;margin:0 16px 16px;opacity:0.85;'; subEl.textContent = opts.subtitle; modal.appendChild(subEl); }

  var btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:8px;padding:12px 16px 16px;flex-wrap:wrap;justify-content:center;';
  var btnStyle = "flex:1;min-width:100px;padding:10px 16px;font-size:1em;font-weight:bold;font-family:Lora, Georgia, serif;border:2px solid #8b5a2b;border-radius:6px;background:#fdf5e6;color:#4a2c2a;cursor:pointer;min-height:44px;";
  var btnPrimaryStyle = btnStyle + "background:#8b5a2b;color:#fff8e1;border-color:#5a3f2a;";

  // Navigation button — "Go to Chit" or "Go to Alerts"
  function _safeNavigate(url) {
    (async function() {
      // Check for unsaved changes on editor page
      if (typeof markEditorSaved === 'function' && typeof window._editorUnsaved !== 'undefined' && window._editorUnsaved) {
        if (!(await cwocConfirm('You have unsaved changes. Leave this page?', { title: 'Unsaved Changes', confirmLabel: 'Leave', danger: true }))) return;
      }
      // Check shared-page save system
      if (typeof CwocSaveSystem !== 'undefined' && CwocSaveSystem._instance && CwocSaveSystem._instance._dirty) {
        if (!(await cwocConfirm('You have unsaved changes. Leave this page?', { title: 'Unsaved Changes', confirmLabel: 'Leave', danger: true }))) return;
      }
      window.location.href = url;
    })();
  }

  if (opts.chitId) {
    var openBtn = document.createElement('button'); openBtn.style.cssText = btnStyle; openBtn.textContent = '📝 Go to Chit';
    openBtn.onclick = function() {
      _sharedStopAlarm(); _sharedStopTimer();
      if (typeof _timerAudio !== 'undefined' && _timerAudio) cwocStopAudio(_timerAudio);
      if (typeof _alarmAudio !== 'undefined' && _alarmAudio) cwocStopAudio(_alarmAudio);
      _sharedDismissModal(overlay, opts);
      if (opts.triggerKey) _sharedPersistDismiss(opts.triggerKey);
      if (opts.snoozeKey) _sharedPersistDismiss(opts.snoozeKey);
      syncSend('alert_dismissed', { snoozeKey: opts.snoozeKey, triggerKey: opts.triggerKey });
      _safeNavigate('/editor?id=' + opts.chitId);
    };
    btnRow.appendChild(openBtn);
  } else {
    // Independent alert — navigate to the independent alerts view
    var goBtn = document.createElement('button'); goBtn.style.cssText = btnStyle; goBtn.textContent = '🛎️ Go to Alerts';
    goBtn.onclick = function() {
      _sharedStopAlarm(); _sharedStopTimer();
      if (typeof _timerAudio !== 'undefined' && _timerAudio) cwocStopAudio(_timerAudio);
      if (typeof _alarmAudio !== 'undefined' && _alarmAudio) cwocStopAudio(_alarmAudio);
      _sharedDismissModal(overlay, opts);
      if (opts.triggerKey) _sharedPersistDismiss(opts.triggerKey);
      if (opts.snoozeKey) _sharedPersistDismiss(opts.snoozeKey);
      syncSend('alert_dismissed', { snoozeKey: opts.snoozeKey, triggerKey: opts.triggerKey });
      // Set the alarms view mode to independent and navigate to dashboard
      try { localStorage.setItem('cwoc_alarmsViewMode', 'independent'); } catch(e) {}
      _safeNavigate('/?tab=Alarms');
    };
    btnRow.appendChild(goBtn);
  }
  var dismissBtn = document.createElement('button'); dismissBtn.style.cssText = btnPrimaryStyle; dismissBtn.textContent = '✕ Dismiss';
  dismissBtn.onclick = function() {
    _sharedStopAlarm(); _sharedStopTimer();
    // Also stop editor-specific audio
    if (typeof _timerAudio !== 'undefined' && _timerAudio) cwocStopAudio(_timerAudio);
    if (typeof _alarmAudio !== 'undefined' && _alarmAudio) cwocStopAudio(_alarmAudio);
    _sharedDismissModal(overlay, opts);
    if (opts.triggerKey) _sharedPersistDismiss(opts.triggerKey);
    if (opts.snoozeKey) _sharedPersistDismiss(opts.snoozeKey);
    syncSend('alert_dismissed', { snoozeKey: opts.snoozeKey, triggerKey: opts.triggerKey });
  };
  btnRow.appendChild(dismissBtn);
  if (opts.showSnooze) {
    var snoozeBtn = document.createElement('button'); snoozeBtn.style.cssText = btnStyle; snoozeBtn.textContent = '💤 Snooze';
    snoozeBtn.onclick = function() {
      _sharedStopAlarm(); _sharedStopTimer();
      if (typeof _timerAudio !== 'undefined' && _timerAudio) cwocStopAudio(_timerAudio);
      if (typeof _alarmAudio !== 'undefined' && _alarmAudio) cwocStopAudio(_alarmAudio);
      _sharedDismissModal(overlay, opts);
      if (opts.snoozeKey) {
        var untilTs = Date.now() + _sharedGetSnoozeMs();
        _sharedPersistSnooze(opts.snoozeKey, untilTs);
        if (opts.triggerKey) window._sharedAlarmTriggered.delete(opts.triggerKey);
        syncSend('alert_snoozed', { snoozeKey: opts.snoozeKey, triggerKey: opts.triggerKey, snoozeUntil: untilTs });
      }
      // Re-render alarm containers to show snooze countdown bar
      setTimeout(function() {
        if (typeof renderAlarmsContainer === 'function') renderAlarmsContainer();
        if (typeof displayChits === 'function' && typeof currentTab !== 'undefined' && currentTab === 'Alarms') displayChits();
      }, 400);
    };
    btnRow.appendChild(snoozeBtn);
  }
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  overlay._snoozeKey = opts.snoozeKey; overlay._triggerKey = opts.triggerKey;
  overlay.setAttribute('data-cwoc-alert', 'true');
  document.body.appendChild(overlay);
  void overlay.offsetWidth;
  overlay.style.opacity = '1';

  // Block keyboard but allow ESC to dismiss and Tab for accessibility
  function _block(e) {
    if (e.key === 'Tab') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      _sharedStopAlarm(); _sharedStopTimer();
      if (typeof _timerAudio !== 'undefined' && _timerAudio) cwocStopAudio(_timerAudio);
      if (typeof _alarmAudio !== 'undefined' && _alarmAudio) cwocStopAudio(_alarmAudio);
      _sharedDismissModal(overlay, opts);
      if (opts.triggerKey) _sharedPersistDismiss(opts.triggerKey);
      if (opts.snoozeKey) _sharedPersistDismiss(opts.snoozeKey);
      syncSend('alert_dismissed', { snoozeKey: opts.snoozeKey, triggerKey: opts.triggerKey });
      return;
    }
    e.preventDefault(); e.stopImmediatePropagation();
  }
  document.addEventListener('keydown', _block, true);
  overlay._blockKeys = _block;

  // Try to unlock audio on click
  modal.addEventListener('click', function() {
    if (window._sharedAlarmAudio && window._sharedAlarmAudio.paused && window._sharedAlarmAudio.loop) window._sharedAlarmAudio.play().catch(function(){});
    if (window._sharedTimerAudio && window._sharedTimerAudio.paused && window._sharedTimerAudio.loop) window._sharedTimerAudio.play().catch(function(){});
  }, { once: true });

  return overlay;
}

function _sharedDismissModal(overlay, opts) {
  overlay.style.opacity = '0';
  if (overlay._blockKeys) document.removeEventListener('keydown', overlay._blockKeys, true);
  setTimeout(function() {
    if (overlay.parentNode) overlay.remove();
    if (!document.querySelector('[data-cwoc-alert]')) { document.body.style.overflow = ''; document.body.style.touchAction = ''; }
  }, 300);
}


// ── Browser notification ──
function _sharedBrowserNotif(title, body, chitId) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  var targetUrl = chitId
    ? '/frontend/html/editor.html?id=' + chitId
    : '/?tab=Alarms&view=independent';
  var opts = { body: body, icon: '/static/cwod_logo-favicon.png', tag: 'cwoc-' + (chitId || 'alert'), renotify: true, requireInteraction: true, silent: true, data: { url: targetUrl } };
  try {
    var n = new Notification(title, opts);
    n.onclick = function() { window.focus(); window.location.href = targetUrl; };
  } catch (e) {
    // Fallback: use service worker to show notification
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function(reg) {
        reg.showNotification(title, opts).catch(function() {});
      });
    }
  }
}

// ── The alarm checker — runs every second on every page ──
function _sharedCheckAlarms() {
  var now = new Date();
  var hh = String(now.getHours()).padStart(2, '0');
  var mm = String(now.getMinutes()).padStart(2, '0');
  var currentTime = hh + ':' + mm;
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var currentDay = days[now.getDay()];
  var dateStr = now.toDateString();

  // Check chit alarms
  window._sharedChits.forEach(function(chit) {
    if (!Array.isArray(chit.alerts)) return;
    chit.alerts.forEach(function(alert, idx) {
      if (alert._type !== 'alarm' || !alert.enabled || !alert.time) return;
      var alertDays = alert.days && alert.days.length > 0 ? alert.days : [currentDay];
      if (alertDays.indexOf(currentDay) === -1) return;
      if (alert.time !== currentTime) return;
      var key = chit.id + '-' + idx + '-' + alert.time + '-' + dateStr;
      if (window._sharedAlarmTriggered.has(key)) return;
      var snoozeKey = chit.id + '-' + idx;
      if (window._sharedSnoozeRegistry[snoozeKey] && Date.now() < window._sharedSnoozeRegistry[snoozeKey]) return;
      window._sharedAlarmTriggered.add(key);
      _sharedPlayAlarm();
      _sharedShowAlertModal({ icon: '🔔', title: chit.title || 'Alarm', subtitle: _sharedFmtTime(alert.time) + (alert.name ? ' — ' + alert.name : ''), chitId: chit.id, onDismiss: _sharedStopAlarm, showSnooze: true, snoozeKey: snoozeKey, triggerKey: key });
      _sharedBrowserNotif('🔔 Alarm: ' + (chit.title || 'Alarm'), _sharedFmtTime(alert.time), chit.id);
      syncSend('alarm_fired', { title: chit.title, subtitle: _sharedFmtTime(alert.time), chitId: chit.id, snoozeKey: snoozeKey, triggerKey: key });
    });
  });

  // Check independent alarms
  window._sharedIndependentAlerts.forEach(function(ia) {
    var ad = ia.data || ia;
    if (ad._type !== 'alarm' || !ad.enabled || !ad.time) return;
    var alertDays = ad.days && ad.days.length > 0 ? ad.days : [currentDay];
    if (alertDays.indexOf(currentDay) === -1) return;
    if (ad.time !== currentTime) return;
    var key = 'ia-' + ia.id + '-' + ad.time + '-' + dateStr;
    if (window._sharedAlarmTriggered.has(key)) return;
    var snoozeKey = 'ia-' + ia.id;
    if (window._sharedSnoozeRegistry[snoozeKey] && Date.now() < window._sharedSnoozeRegistry[snoozeKey]) return;
    window._sharedAlarmTriggered.add(key);
    var name = ad.name || 'Independent Alarm';
    _sharedPlayAlarm();
    _sharedShowAlertModal({ icon: '🔔', title: name, subtitle: _sharedFmtTime(ad.time), onDismiss: _sharedStopAlarm, showSnooze: true, snoozeKey: snoozeKey, triggerKey: key });
    _sharedBrowserNotif('🔔 ' + name, _sharedFmtTime(ad.time));
    syncSend('alarm_fired', { title: name, subtitle: _sharedFmtTime(ad.time), snoozeKey: snoozeKey, triggerKey: key });
  });

  // Check expired snoozes
  Object.keys(window._sharedSnoozeRegistry).forEach(function(snoozeKey) {
    var until = window._sharedSnoozeRegistry[snoozeKey];
    if (!until || Date.now() < until) return;
    var refireKey = 'snooze-refire-' + snoozeKey + '-' + dateStr;
    if (window._sharedAlarmTriggered.has(refireKey)) return;
    window._sharedAlarmTriggered.add(refireKey);
    delete window._sharedSnoozeRegistry[snoozeKey];
    var name = 'Alarm', time = '', chitId = null;
    if (snoozeKey.indexOf('ia-') === 0) {
      var iaId = snoozeKey.slice(3);
      var ia = window._sharedIndependentAlerts.find(function(a) { return a.id === iaId; });
      if (ia) { var ad = ia.data || ia; name = ad.name || 'Independent Alarm'; time = ad.time || ''; }
    } else {
      var parts = snoozeKey.split('-'); var cId = parts.slice(0,-1).join('-'); var aIdx = parseInt(parts[parts.length-1]);
      var chit = window._sharedChits.find(function(c) { return c.id === cId; });
      if (chit && Array.isArray(chit.alerts) && chit.alerts[aIdx]) { name = chit.title || 'Alarm'; time = chit.alerts[aIdx].time || ''; chitId = chit.id; }
    }
    _sharedPlayAlarm();
    _sharedShowAlertModal({ icon: '🔔', title: name, subtitle: _sharedFmtTime(time) + ' (snoozed)', chitId: chitId, onDismiss: _sharedStopAlarm, showSnooze: true, snoozeKey: snoozeKey, triggerKey: refireKey });
    _sharedBrowserNotif('🔔 ' + name, _sharedFmtTime(time));
    syncSend('alarm_fired', { title: name, subtitle: _sharedFmtTime(time) + ' (snoozed)', chitId: chitId, snoozeKey: snoozeKey, triggerKey: refireKey });
  });

  // Cleanup old keys
  window._sharedAlarmTriggered.forEach(function(key) {
    if (key.indexOf(dateStr) === -1 && key.indexOf('snooze-refire') === -1) window._sharedAlarmTriggered.delete(key);
  });
}

// ── Sync handlers for the shared alarm system ──
function _initSharedAlarmSync() {
  if (typeof syncOn !== 'function') return;

  syncOn('alarm_fired', function(msg) {
    if (msg.triggerKey && window._sharedAlarmTriggered.has(msg.triggerKey)) return;
    if (msg.triggerKey) window._sharedAlarmTriggered.add(msg.triggerKey);
    _sharedPlayAlarm();
    _sharedShowAlertModal({ icon: '🔔', title: msg.title || 'Alarm', subtitle: msg.subtitle || '', chitId: msg.chitId, onDismiss: _sharedStopAlarm, showSnooze: true, snoozeKey: msg.snoozeKey, triggerKey: msg.triggerKey });
  });

  syncOn('alert_dismissed', function(msg) {
    if (msg.triggerKey) window._sharedAlarmTriggered.add(msg.triggerKey);
    if (msg.snoozeKey) {
      window._sharedAlarmTriggered.add(msg.snoozeKey);
      // Clear snooze from registry so the bar disappears
      delete window._sharedSnoozeRegistry[msg.snoozeKey];
      if (typeof _snoozeRegistry !== 'undefined') delete _snoozeRegistry[msg.snoozeKey];
    }
    _sharedStopAlarm(); _sharedStopTimer();
    document.querySelectorAll('[data-cwoc-alert]').forEach(function(ov) {
      if (ov._snoozeKey === msg.snoozeKey || ov._triggerKey === msg.triggerKey) {
        if (ov._blockKeys) document.removeEventListener('keydown', ov._blockKeys, true);
        ov.remove();
      }
    });
    document.body.style.overflow = ''; document.body.style.touchAction = '';
    // Re-render to remove snooze bars
    setTimeout(function() {
      if (typeof renderAlarmsContainer === 'function') renderAlarmsContainer();
      if (typeof displayChits === 'function' && typeof currentTab !== 'undefined' && currentTab === 'Alarms') displayChits();
    }, 300);
  });

  syncOn('alert_snoozed', function(msg) {
    if (msg.snoozeKey && msg.snoozeUntil) window._sharedSnoozeRegistry[msg.snoozeKey] = msg.snoozeUntil;
    if (msg.triggerKey) window._sharedAlarmTriggered.delete(msg.triggerKey);
    _sharedStopAlarm(); _sharedStopTimer();
    document.querySelectorAll('[data-cwoc-alert]').forEach(function(ov) {
      if (ov._snoozeKey === msg.snoozeKey || ov._triggerKey === msg.triggerKey) {
        if (ov._blockKeys) document.removeEventListener('keydown', ov._blockKeys, true);
        ov.remove();
      }
    });
    document.body.style.overflow = ''; document.body.style.touchAction = '';
    // Re-render to show snooze countdown bar
    setTimeout(function() {
      if (typeof renderAlarmsContainer === 'function') renderAlarmsContainer();
      if (typeof displayChits === 'function' && typeof currentTab !== 'undefined' && currentTab === 'Alarms') displayChits();
    }, 400);
  });

  syncOn('timer_fired', function(msg) {
    _sharedPlayTimer();
    _sharedShowAlertModal({ icon: '⏱️', title: msg.timerName || 'Timer', subtitle: "Time's up!", chitId: msg.chitId || null, onDismiss: _sharedStopTimer, showSnooze: false });
  });

  syncOn('timer_dismissed', function(msg) {
    _sharedStopAlarm(); _sharedStopTimer();
    document.querySelectorAll('[data-cwoc-alert]').forEach(function(ov) {
      if (ov._blockKeys) document.removeEventListener('keydown', ov._blockKeys, true);
      ov.remove();
    });
    document.body.style.overflow = ''; document.body.style.touchAction = '';
  });

  // Data sync
  syncOn('alerts_changed', function() { _sharedFetchData(); });
  syncOn('chits_changed', function() { _sharedFetchData(); });
}

// ── Init the shared alarm system ──
function _initSharedAlarmSystem() {
  // Load settings
  getCachedSettings().then(function(s) {
    window._sharedTimeFormat = s.time_format || '24hour';
    window._sharedSnoozeLength = s.snooze_length || '5 minutes';
  }).catch(function() {});

  // Load persisted state
  _sharedLoadAlertStates();

  // Fetch data
  _sharedFetchData();

  // Request notification permission
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Start alarm checker (every second)
  if (!window._sharedAlarmInterval) {
    window._sharedAlarmInterval = setInterval(_sharedCheckAlarms, 1000);
  }

  // Periodic data refresh (every 30s)
  setInterval(function() { _sharedFetchData(); _sharedLoadAlertStates(); }, 30000);

  // Init sync handlers
  _initSharedAlarmSync();
}


// ── Quick Alert Modal (! hotkey) ─────────────────────────────────────────────
// Implementation moved to shared-alarms.js (single source of truth).
// Functions: _openQuickAlertModal, _closeQuickAlertModal, _quickAlertShowEditor,
//            _quickAlertSave, _quickReminderSave, _quickAlertJumpToIndependent,
//            _showQuickAlertToast

// ── Global Hotkey Listener (shared across ALL pages) ─────────────────────────
// This runs on every page that loads shared.js — dashboard, editor, settings, etc.
// Handles: ! (quick alert), ` (sidebar toggle, dashboard only), ~ (topbar toggle, dashboard only)

function _initSharedHotkeys() {
  document.addEventListener('keydown', function(e) {
    // Skip if inside a text input
    var el = document.activeElement;
    var tag = el ? (el.tagName || '').toLowerCase() : '';
    var inputType = el ? (el.type || '').toLowerCase() : '';
    var isTextInput = (tag === 'input' && inputType !== 'checkbox' && inputType !== 'radio')
      || tag === 'textarea' || tag === 'select'
      || (el && el.isContentEditable);
    if (isTextInput) return;

    // Skip if modifier keys (except Shift, which is needed for ! and ~)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Skip if the quick alert modal is already open (it has its own capture handler)
    if (document.getElementById('cwoc-quick-alert-overlay')) return;

    var key = e.key;

    // ── ! = Quick Alert modal (works on ALL pages) ──
    if (key === '!') {
      e.preventDefault();
      _openQuickAlertModal();
      return;
    }

    // ── Dashboard-only hotkeys (check for sidebar element) ──
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return; // Not on dashboard — skip ` and ~

    // Skip if dashboard has its own hotkey mode active
    if (typeof _hotkeyMode !== 'undefined' && _hotkeyMode) return;

    // ── ` = Toggle sidebar ──
    if (key === '`' && !e.shiftKey) {
      e.preventDefault();
      if (typeof toggleSidebar === 'function') toggleSidebar();
      return;
    }

    // ── ~ = Toggle topbar ──
    if (key === '~') {
      e.preventDefault();
      if (typeof _toggleTopbar === 'function') _toggleTopbar();
      return;
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// PRINT NOTE — shared print logic (used by editor and dashboard context menu)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Show a modal with Raw / Rendered choice, then open print tab.
 * @param {string} text - The note markdown content
 * @param {string} title - The chit title
 */
function _printNoteWithChoice(text, title) {
  // Remove any existing print modal
  var existing = document.getElementById('cwoc-print-choice-modal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'cwoc-print-choice-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

  var box = document.createElement('div');
  box.style.cssText = 'background:#fffaf0;border:2px solid #8b5a2b;border-radius:8px;padding:20px 28px;max-width:340px;width:90%;font-family:Lora,Georgia,serif;color:#2b1e0f;box-shadow:0 4px 16px rgba(0,0,0,0.3);text-align:center;';

  var h3 = document.createElement('h3');
  h3.style.cssText = 'margin:0 0 12px;font-size:1.2em;color:#4a2c2a;';
  h3.textContent = 'Print Note';
  box.appendChild(h3);

  var p = document.createElement('p');
  p.style.cssText = 'margin:0 0 18px;font-size:1em;line-height:1.4;';
  p.textContent = 'How would you like to print?';
  box.appendChild(p);

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;';

  var rawBtn = document.createElement('button');
  rawBtn.className = 'standard-button';
  rawBtn.innerHTML = '<i class="fas fa-file-lines"></i> Raw';
  rawBtn.style.cssText = 'padding:8px 16px;font-family:inherit;cursor:pointer;';
  rawBtn.onclick = function() { overlay.remove(); _openPrintTab(text, title, 'raw'); };

  var renderedBtn = document.createElement('button');
  renderedBtn.className = 'standard-button';
  renderedBtn.innerHTML = '<i class="fas fa-eye"></i> Rendered';
  renderedBtn.style.cssText = 'padding:8px 16px;font-family:inherit;cursor:pointer;';
  renderedBtn.onclick = function() { overlay.remove(); _openPrintTab(text, title, 'rendered'); };

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'standard-button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding:8px 16px;font-family:inherit;cursor:pointer;opacity:0.7;';
  cancelBtn.onclick = function() { overlay.remove(); };

  btnRow.appendChild(rawBtn);
  btnRow.appendChild(renderedBtn);
  btnRow.appendChild(cancelBtn);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // ESC to close
  function _escHandler(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      overlay.remove();
      document.removeEventListener('keydown', _escHandler, true);
    }
  }
  document.addEventListener('keydown', _escHandler, true);

  // Click overlay to close
  overlay.addEventListener('click', function(ev) {
    if (ev.target === overlay) overlay.remove();
  });
}

/**
 * Print note content using a hidden iframe — no new tab, no page change.
 * @param {string} text - Raw markdown text
 * @param {string} title - Chit title
 * @param {string} mode - 'raw' or 'rendered'
 */
function _openPrintTab(text, title, mode) {
  var printTitle = title || 'Note';
  var bodyContent = '';

  if (mode === 'rendered') {
    if (typeof marked !== 'undefined') {
      var rendered = marked.parse(text);
      if (typeof DOMPurify !== 'undefined') {
        rendered = DOMPurify.sanitize(rendered);
      }
      bodyContent = '<div class="rendered-content">' + rendered + '</div>';
    } else {
      bodyContent = '<div class="rendered-content">' + text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>') + '</div>';
    }
  } else {
    bodyContent = '<pre class="raw-content">' + text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</pre>';
  }

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<title>Print: ' + printTitle.replace(/</g,'&lt;') + '</title>'
    + '<style>'
    + 'body { font-family: Lora, Georgia, serif; max-width: 800px; margin: 0 auto; padding: 20px 40px; color: #1a1208; }'
    + 'h1 { font-size: 1.4em; border-bottom: 1px solid #8b5a2b; padding-bottom: 8px; margin-bottom: 16px; }'
    + '.raw-content { font-family: "Courier New", Courier, monospace; font-size: 0.9em; white-space: pre-wrap; word-wrap: break-word; line-height: 1.6; }'
    + '.rendered-content { line-height: 1.6; }'
    + '.rendered-content h1, .rendered-content h2, .rendered-content h3 { margin: 0.8em 0 0.4em; }'
    + '.rendered-content ul, .rendered-content ol { padding-left: 1.5em; }'
    + '.rendered-content code { background: #f0e6d0; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }'
    + '.rendered-content pre { background: #f5f0e8; padding: 12px; border-radius: 4px; overflow-x: auto; }'
    + '.rendered-content pre code { background: none; padding: 0; }'
    + '.rendered-content blockquote { border-left: 3px solid #8b5a2b; margin: 0.5em 0; padding: 0.3em 1em; color: #4a2c2a; }'
    + '.rendered-content table { border-collapse: collapse; width: 100%; }'
    + '.rendered-content th, .rendered-content td { border: 1px solid #8b5a2b; padding: 6px 10px; text-align: left; }'
    + '.print-meta { font-size: 0.85em; color: #6b4e31; margin-bottom: 16px; }'
    + '@media print { body { padding: 0; } @page { size: landscape; } }'
    + '</style></head><body>'
    + '<h1>' + printTitle.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</h1>'
    + '<div class="print-meta">Printed from C.W.\'s Omni Chits \u2014 ' + new Date().toLocaleDateString() + '</div>'
    + bodyContent
    + '</body></html>';

  // Use a hidden iframe to print without leaving the page
  var iframe = document.getElementById('cwoc-print-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'cwoc-print-iframe';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;border:none;visibility:hidden;';
    document.body.appendChild(iframe);
  }

  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // Wait for content to render, then print
  setTimeout(function() {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 200);
}

// ══════════════════════════════════════════════════════════════════════════════
// Print Checklist
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Print checklist — shows a modal with "Include completed items" checkbox,
 * then prints via hidden iframe.
 * @param {object} checklist - The Checklist instance (has .items array)
 */
function _printChecklist(checklist) {
  if (!checklist || !checklist.items || checklist.items.length === 0) {
    if (typeof cwocToast === 'function') cwocToast('No checklist items to print.', 'info');
    return;
  }

  // Remove any existing print modal
  var existing = document.getElementById('cwoc-print-checklist-modal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'cwoc-print-checklist-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

  var box = document.createElement('div');
  box.style.cssText = 'background:#fffaf0;border:2px solid #8b5a2b;border-radius:8px;padding:20px 28px;max-width:340px;width:90%;font-family:Lora,Georgia,serif;color:#2b1e0f;box-shadow:0 4px 16px rgba(0,0,0,0.3);text-align:center;';

  var h3 = document.createElement('h3');
  h3.style.cssText = 'margin:0 0 12px;font-size:1.2em;color:#4a2c2a;';
  h3.textContent = 'Print Checklist';
  box.appendChild(h3);

  // Checkbox option row
  var optRow = document.createElement('label');
  optRow.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:center;margin:0 0 18px;font-size:1em;cursor:pointer;';
  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = false;
  cb.style.cssText = 'width:18px;height:18px;cursor:pointer;';
  var cbLabel = document.createElement('span');
  cbLabel.textContent = 'Include completed items';
  optRow.appendChild(cb);
  optRow.appendChild(cbLabel);
  box.appendChild(optRow);

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;';

  var printBtn = document.createElement('button');
  printBtn.className = 'standard-button';
  printBtn.innerHTML = '<i class="fas fa-print"></i> Print';
  printBtn.style.cssText = 'padding:8px 16px;font-family:inherit;cursor:pointer;';
  printBtn.onclick = function() {
    overlay.remove();
    _executePrintChecklist(checklist, cb.checked);
  };

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'standard-button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding:8px 16px;font-family:inherit;cursor:pointer;opacity:0.7;';
  cancelBtn.onclick = function() { overlay.remove(); };

  btnRow.appendChild(printBtn);
  btnRow.appendChild(cancelBtn);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // ESC to close
  function _escHandler(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      overlay.remove();
      document.removeEventListener('keydown', _escHandler, true);
    }
  }
  document.addEventListener('keydown', _escHandler, true);

  // Click overlay to close
  overlay.addEventListener('click', function(ev) {
    if (ev.target === overlay) overlay.remove();
  });
}

/**
 * Actually render and print the checklist via hidden iframe.
 * @param {object} checklist - The Checklist instance
 * @param {boolean} includeCompleted - Whether to include checked items
 */
function _executePrintChecklist(checklist, includeCompleted) {
  var titleEl = document.getElementById('title');
  var printTitle = (titleEl ? titleEl.value.trim() : '') || 'Checklist';

  var unchecked = checklist.items.filter(function(i) { return !i.checked; });
  var checked = checklist.items.filter(function(i) { return i.checked; });

  var buildItemsHtml = function(items) {
    var html = '';
    items.forEach(function(item) {
      var indent = item.level * 24;
      var checkbox = item.checked
        ? '<span class="cb checked">☑</span>'
        : '<span class="cb">☐</span>';
      var textClass = item.checked ? 'item-text checked-text' : 'item-text';
      var escapedText = item.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += '<div class="checklist-row" style="padding-left:' + indent + 'px;">'
        + checkbox + '<span class="' + textClass + '">' + escapedText + '</span></div>';
    });
    return html;
  };

  var bodyContent = '';
  if (unchecked.length > 0) {
    bodyContent += buildItemsHtml(unchecked);
  }
  if (includeCompleted && checked.length > 0) {
    bodyContent += '<div class="completed-divider">Completed (' + checked.length + ')</div>';
    bodyContent += buildItemsHtml(checked);
  }

  if (!bodyContent) {
    if (typeof cwocToast === 'function') cwocToast('No items to print.', 'info');
    return;
  }

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<title>Print: ' + printTitle.replace(/</g, '&lt;') + '</title>'
    + '<style>'
    + 'body { font-family: Lora, Georgia, serif; max-width: 800px; margin: 0 auto; padding: 20px 40px; color: #1a1208; }'
    + 'h1 { font-size: 1.4em; border-bottom: 1px solid #8b5a2b; padding-bottom: 8px; margin-bottom: 16px; }'
    + '.print-meta { font-size: 0.85em; color: #6b4e31; margin-bottom: 16px; }'
    + '.checklist-row { display: flex; align-items: baseline; gap: 8px; padding: 4px 0; line-height: 1.5; }'
    + '.cb { font-size: 1.2em; flex-shrink: 0; }'
    + '.cb.checked { color: #6b4e31; }'
    + '.item-text { font-size: 1em; }'
    + '.checked-text { text-decoration: line-through; opacity: 0.6; }'
    + '.completed-divider { margin: 16px 0 8px; padding-top: 8px; border-top: 1px solid #8b5a2b; font-size: 0.9em; color: #6b4e31; font-style: italic; }'
    + '@media print { body { padding: 0; } }'
    + '</style></head><body>'
    + '<h1>' + printTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</h1>'
    + '<div class="print-meta">Printed from C.W.\'s Omni Chits \u2014 ' + new Date().toLocaleDateString() + '</div>'
    + bodyContent
    + '</body></html>';

  // Use the same hidden iframe approach as _openPrintTab
  var iframe = document.getElementById('cwoc-print-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'cwoc-print-iframe';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;border:none;visibility:hidden;';
    document.body.appendChild(iframe);
  }

  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(function() {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 200);
}

// ══════════════════════════════════════════════════════════════════════════════
// Print Chit — full chit with all zones
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Print the entire chit with all populated zones, nicely formatted.
 * Gathers data from the editor form and prints via hidden iframe.
 */
function _printChit() {
  var titleEl = document.getElementById('title');
  var printTitle = (titleEl ? titleEl.value.trim() : '') || 'Untitled Chit';

  var sections = [];

  // ── Status / Priority / Severity ──
  var statusEl = document.getElementById('status');
  var priorityEl = document.getElementById('priority');
  var severityEl = document.getElementById('severity');
  var statusParts = [];
  if (statusEl && statusEl.value) statusParts.push('<strong>Status:</strong> ' + _escHtml(statusEl.value));
  if (priorityEl && priorityEl.value) statusParts.push('<strong>Priority:</strong> ' + _escHtml(priorityEl.value));
  if (severityEl && severityEl.value) statusParts.push('<strong>Severity:</strong> ' + _escHtml(severityEl.value));
  if (statusParts.length > 0) {
    sections.push({ title: 'Task', content: '<p>' + statusParts.join(' &nbsp;|&nbsp; ') + '</p>' });
  }

  // ── Dates ──
  var dateMode = '';
  var dateModeRadio = document.querySelector('input[name="dateMode"]:checked');
  if (dateModeRadio) dateMode = dateModeRadio.value;
  var dateContent = '';
  if (dateMode === 'startend') {
    var sd = document.getElementById('start_datetime');
    var st = document.getElementById('start_time');
    var ed = document.getElementById('end_datetime');
    var et = document.getElementById('end_time');
    var allDay = document.getElementById('allDay');
    var isAllDay = allDay && allDay.checked;
    var startStr = (sd ? sd.value : '') + (isAllDay ? ' (All Day)' : (st && st.value ? ' ' + st.value : ''));
    var endStr = (ed ? ed.value : '') + (isAllDay ? ' (All Day)' : (et && et.value ? ' ' + et.value : ''));
    if (startStr.trim()) dateContent += '<p><strong>Start:</strong> ' + _escHtml(startStr.trim()) + '</p>';
    if (endStr.trim()) dateContent += '<p><strong>End:</strong> ' + _escHtml(endStr.trim()) + '</p>';
  } else if (dateMode === 'due') {
    var dd = document.getElementById('due_datetime');
    var dt = document.getElementById('due_time');
    var allDay2 = document.getElementById('allDay');
    var isAllDay2 = allDay2 && allDay2.checked;
    var dueStr = (dd ? dd.value : '') + (isAllDay2 ? ' (All Day)' : (dt && dt.value ? ' ' + dt.value : ''));
    if (dueStr.trim()) dateContent += '<p><strong>Due:</strong> ' + _escHtml(dueStr.trim()) + '</p>';
  } else if (dateMode === 'perpetual') {
    dateContent += '<p><strong>Mode:</strong> Perpetual</p>';
  } else if (dateMode === 'pointintime') {
    var pitDate = document.getElementById('point_in_time_date');
    var pitTime = document.getElementById('point_in_time_time');
    var pitStr = (pitDate ? pitDate.value : '') + (pitTime && pitTime.dataset.time ? ' ' + pitTime.dataset.time : '');
    if (pitStr.trim()) dateContent += '<p><strong>Point in Time:</strong> ' + _escHtml(pitStr.trim()) + '</p>';
  }
  // Recurrence
  var repeatCb = document.getElementById('repeatEnabled');
  if (repeatCb && repeatCb.checked) {
    var recEl = document.getElementById('recurrence');
    if (recEl && recEl.value) dateContent += '<p><strong>Recurrence:</strong> ' + _escHtml(recEl.value) + '</p>';
  }
  if (dateContent) sections.push({ title: 'Dates & Times', content: dateContent });

  // ── Location ──
  var locEl = document.getElementById('location');
  var locVal = locEl ? locEl.value.trim() : '';
  if (locVal) {
    sections.push({ title: 'Location', content: '<p>' + _escHtml(locVal) + '</p>' });
  }

  // ── Weather Forecast ──
  if (window._currentChitWeatherData && window._currentChitWeatherData.weather_code !== undefined) {
    var wd = window._currentChitWeatherData;
    var wIcon = (typeof weatherIcons !== 'undefined' && weatherIcons[wd.weather_code]) ? weatherIcons[wd.weather_code] : '';
    var wDesc = (typeof weatherDescriptions !== 'undefined' && weatherDescriptions[wd.weather_code]) ? weatherDescriptions[wd.weather_code] : '';
    var wParts = [];
    if (wIcon || wDesc) wParts.push(wIcon + ' ' + wDesc);
    if (wd.high !== null && wd.high !== undefined) wParts.push('High: ' + wd.high + '°C');
    if (wd.low !== null && wd.low !== undefined) wParts.push('Low: ' + wd.low + '°C');
    if (wd.precipitation) wParts.push('Precip: ' + wd.precipitation + ' mm');
    if (wd.wind_gusts) wParts.push('Wind gusts: ' + wd.wind_gusts + ' km/h');
    if (wd.focus_date) wParts.push('Date: ' + wd.focus_date);
    if (wParts.length > 0) {
      sections.push({ title: 'Weather Forecast', content: '<p>' + wParts.map(_escHtml).join(' &nbsp;|&nbsp; ') + '</p>' });
    }
  }

  // ── Tags ──
  var tags = Array.isArray(window._currentTagSelection) ? window._currentTagSelection : [];
  if (tags.length > 0) {
    var tagChips = tags.map(function(t) {
      return '<span class="print-tag">' + _escHtml(t) + '</span>';
    }).join(' ');
    sections.push({ title: 'Tags', content: '<p>' + tagChips + '</p>' });
  }

  // ── People ──
  var people = (typeof _peopleChipData !== 'undefined' && _peopleChipData.length > 0)
    ? _peopleChipData.map(function(c) { return c.display_name; })
    : [];
  if (people.length > 0) {
    sections.push({ title: 'People', content: '<p>' + people.map(_escHtml).join(', ') + '</p>' });
  }

  // ── Color ──
  var colorEl = document.getElementById('color');
  var colorVal = colorEl ? colorEl.value : '';
  if (colorVal && colorVal !== 'transparent') {
    var svgCircle = '<svg width="18" height="18" style="vertical-align:middle;margin-right:6px;"><circle cx="9" cy="9" r="8" fill="' + _escHtml(colorVal) + '" stroke="#8b5a2b" stroke-width="1"/></svg>';
    sections.push({ title: 'Color', content: '<p>' + svgCircle + ' ' + _escHtml(colorVal) + '</p>' });
  }

  // ── Notes ──
  var noteEl = document.getElementById('note');
  var noteVal = noteEl ? noteEl.value.trim() : '';
  if (noteVal) {
    var noteHtml = '';
    if (typeof marked !== 'undefined') {
      noteHtml = marked.parse(noteVal);
      if (typeof DOMPurify !== 'undefined') noteHtml = DOMPurify.sanitize(noteHtml);
    } else {
      noteHtml = '<pre>' + _escHtml(noteVal) + '</pre>';
    }
    sections.push({ title: 'Notes', content: '<div class="rendered-content">' + noteHtml + '</div>' });
  }

  // ── Checklist ──
  var excludeCompleted = false;
  var excludeCb = document.getElementById('printExcludeCompleted');
  if (excludeCb) excludeCompleted = excludeCb.checked;

  if (window.checklist && window.checklist.items && window.checklist.items.length > 0) {
    var clItems = window.checklist.items;
    if (excludeCompleted) clItems = clItems.filter(function(i) { return !i.checked; });
    if (clItems.length > 0) {
      var clHtml = '';
      clItems.forEach(function(item) {
        var indent = item.level * 24;
        var checkbox = item.checked ? '☑' : '☐';
        var textClass = item.checked ? 'cl-checked' : '';
        clHtml += '<div class="cl-row" style="padding-left:' + indent + 'px;">'
          + '<span class="cl-cb">' + checkbox + '</span>'
          + '<span class="' + textClass + '">' + _escHtml(item.text) + '</span></div>';
      });
      sections.push({ title: 'Checklist', content: clHtml });
    }
  }

  // ── Alerts ──
  if (typeof window._alertsData !== 'undefined') {
    var alertParts = [];
    if (window._alertsData.alarms && window._alertsData.alarms.length > 0) {
      var alarmLines = window._alertsData.alarms.map(function(a) {
        return '⏰ ' + _escHtml(a.time || '') + (a.days && a.days.length ? ' (' + a.days.join(', ') + ')' : '') + (a.label ? ' — ' + _escHtml(a.label) : '');
      });
      alertParts.push('<p><strong>Alarms:</strong></p><p>' + alarmLines.join('<br>') + '</p>');
    }
    if (window._alertsData.notifications && window._alertsData.notifications.length > 0) {
      var notifLines = window._alertsData.notifications.map(function(n) {
        return '🔔 ' + _escHtml(n.type || '') + ': ' + _escHtml(String(n.value || '')) + ' ' + _escHtml(n.unit || '');
      });
      alertParts.push('<p><strong>Notifications:</strong></p><p>' + notifLines.join('<br>') + '</p>');
    }
    if (alertParts.length > 0) {
      sections.push({ title: 'Alerts', content: alertParts.join('') });
    }
  }

  // ── Pinned / Archived flags ──
  var flags = [];
  var pinnedEl = document.getElementById('pinned');
  if (pinnedEl && pinnedEl.value === 'true') flags.push('📌 Pinned');
  var archivedEl = document.getElementById('archived');
  if (archivedEl && archivedEl.value === 'true') flags.push('📦 Archived');
  if (flags.length > 0) {
    sections.push({ title: 'Flags', content: '<p>' + flags.join(' &nbsp;|&nbsp; ') + '</p>' });
  }

  // ── Build final HTML ──
  if (sections.length === 0) {
    if (typeof cwocToast === 'function') cwocToast('Nothing to print — chit is empty.', 'info');
    return;
  }

  var bodyContent = '';
  sections.forEach(function(sec) {
    bodyContent += '<div class="print-section">'
      + '<h2 class="section-title">' + _escHtml(sec.title) + '</h2>'
      + sec.content
      + '</div>';
  });

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<title>Print: ' + _escHtml(printTitle) + '</title>'
    + '<style>'
    + 'body { font-family: Lora, Georgia, serif; max-width: 800px; margin: 0 auto; padding: 20px 40px; color: #1a1208; }'
    + 'h1 { font-size: 1.5em; border-bottom: 2px solid #8b5a2b; padding-bottom: 8px; margin-bottom: 6px; }'
    + '.print-meta { font-size: 0.85em; color: #6b4e31; margin-bottom: 20px; }'
    + '.print-section { margin-bottom: 16px; }'
    + '.section-title { font-size: 1.1em; color: #4a2c2a; margin: 0 0 6px; padding-bottom: 4px; border-bottom: 1px solid #c9b896; }'
    + '.print-section p { margin: 4px 0; line-height: 1.5; }'
    + '.print-tag { display: inline-block; background: #f0e6d0; border: 1px solid #c9b896; border-radius: 4px; padding: 2px 8px; margin: 2px 4px 2px 0; font-size: 0.9em; }'
    + '.rendered-content { line-height: 1.6; }'
    + '.rendered-content h1, .rendered-content h2, .rendered-content h3 { margin: 0.8em 0 0.4em; }'
    + '.rendered-content ul, .rendered-content ol { padding-left: 1.5em; }'
    + '.rendered-content code { background: #f0e6d0; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }'
    + '.rendered-content pre { background: #f5f0e8; padding: 12px; border-radius: 4px; overflow-x: auto; }'
    + '.rendered-content pre code { background: none; padding: 0; }'
    + '.rendered-content blockquote { border-left: 3px solid #8b5a2b; margin: 0.5em 0; padding: 0.3em 1em; color: #4a2c2a; }'
    + '.rendered-content table { border-collapse: collapse; width: 100%; }'
    + '.rendered-content th, .rendered-content td { border: 1px solid #8b5a2b; padding: 6px 10px; text-align: left; }'
    + '.cl-row { display: flex; align-items: baseline; gap: 8px; padding: 3px 0; line-height: 1.5; }'
    + '.cl-cb { font-size: 1.2em; flex-shrink: 0; }'
    + '.cl-checked { text-decoration: line-through; opacity: 0.6; }'
    + '@media print { body { padding: 0; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'
    + '</style></head><body>'
    + '<h1>' + _escHtml(printTitle) + '</h1>'
    + '<div class="print-meta">Printed from C.W.\'s Omni Chits \u2014 ' + new Date().toLocaleDateString() + '</div>'
    + bodyContent
    + '</body></html>';

  // Use the same hidden iframe approach
  var iframe = document.getElementById('cwoc-print-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'cwoc-print-iframe';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;border:none;visibility:hidden;';
    document.body.appendChild(iframe);
  }

  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(function() {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 200);
}

// _escHtml — now in shared-utils.js (single source of truth)

// ══════════════════════════════════════════════════════════════════════════════
// Auto-init on page load (must be at the very end after all functions defined)
// ══════════════════════════════════════════════════════════════════════════════
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      _logCwocVersion();
      _initSharedAlarmSystem();
      _initSharedHotkeys();
    });
  } else {
    _logCwocVersion();
    _initSharedAlarmSystem();
    _initSharedHotkeys();
  }
}
