/**
 * shared.js — Coordinator for shared code between dashboard (main.js) and editor (editor.js).
 *
 * This file is loaded AFTER all shared sub-scripts and BEFORE page-specific scripts.
 * It contains remaining glue code that doesn't fit cleanly into a focused sub-script:
 *
 *   - Quick-edit modal (shift-click on calendar chits)
 *   - Recurrence instance actions (complete, break off, delete sub-menu)
 *   - Notes masonry layout (column-persistent card positioning)
 *   - Mobile sidebar overlay behavior
 *   - Mobile actions modal (editor header buttons)
 *   - Long-press handler (mobile quick edit)
 *   - Mobile views button (replaces tab bar on mobile)
 *   - Mobile reference close button
 *   - Saved locations utilities
 *   - Weather forecast cache (shared across all pages)
 *   - Audio unlock system (iOS/Android)
 *   - Sync client (WebSocket + HTTP polling fallback)
 *   - Global alarm system (runs on every page)
 *   - Delete undo toast
 *   - Quick Alert modal (! hotkey — adds alarm/timer/stopwatch)
 *   - Global hotkey listener (!, `, ~ — works on all pages)
 *
 * Sub-scripts loaded before this file (in order):
 *   shared-utils.js, shared-touch.js, shared-checklist.js, shared-sort.js,
 *   shared-indicators.js, shared-calendar.js, shared-tags.js,
 *   shared-recurrence.js, shared-geocoding.js, shared-qr.js
 */

// ── Recurrence Instance Actions (Phase R2) ───────────────────────────────────

/**
 * Quick Edit Modal — shift+click on any calendar chit.
 * Shows editable dropdowns for task fields, plus recurrence options if recurring.
 */
function showQuickEditModal(chit, onRefresh) {
  // Never open quick-edit if a drag operation just completed or is in progress
  if (window._dragJustEnded || window._touchDragActive) return;

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
  if (chit.status) addDropdown('📋', 'Status', 'status', chit.status, ['', 'ToDo', 'In Progress', 'Blocked', 'Complete'], (v) => { pendingChanges.status = v || null; });

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
        if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh();
      } catch (e) {
        console.error('Quick edit save failed:', e);
        alert('Failed to save changes.');
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

  // --- Pin / Archive / Delete row ---
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

  // Archive toggle
  const archBtn = document.createElement('button');
  archBtn.style.cssText = iconBtnStyle + `background:${chit.archived ? '#d4c5a9' : '#fdf5e6'};color:#666;`;
  archBtn.innerHTML = `📦 ${chit.archived ? 'Unarchive' : 'Archive'}`;
  archBtn.title = chit.archived ? 'Unarchive this chit' : 'Archive this chit';
  archBtn.addEventListener('click', async () => {
    try {
      const resp = await fetch(`/api/chit/${chitId}`);
      if (!resp.ok) return;
      const fullChit = await resp.json();
      fullChit.archived = !fullChit.archived;
      await fetch(`/api/chits/${chitId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fullChit) });
      close();
      if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh();
    } catch (e) { console.error('Archive toggle failed:', e); }
  });
  actionRow.appendChild(archBtn);

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
    alert('Failed to update recurrence instance.');
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
      console.log(`Auto-archived recurring chit ${parentId} — all instances complete`);
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
    alert('Failed to update recurrence instance.');
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
    alert('Failed to complete series.');
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
    alert('Failed to break off instance: ' + e.message);
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
 * New cards go to the column with the fewest cards.
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
      // Assign to shortest column
      col = colCounts.indexOf(Math.min(...colCounts));
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
                noteEl.innerHTML = (typeof resolveChitLinks === 'function') ? resolveChitLinks(marked.parse(chit.note), chits) : marked.parse(chit.note);
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

  // Suppress any click/dblclick that fires after this mouseup
  if (typeof _markDragJustEnded === 'function') _markDragJustEnded();

  const s = _notesDragState;

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
  }

  _notesDragState = null;
}

function _onNotesDragKey(e) {
  if (e.key === 'Escape' && _notesDragState) {
    _notesDragState.cancelled = true;
    _onNotesDragEnd(e);
  }
}



// ── Mobile Sidebar Overlay Behavior ──────────────────────────────────────────

/** @type {HTMLElement|null} Cached reference to the sidebar backdrop element */
let _sidebarBackdropEl = null;

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
    closeBtn.innerHTML = '✕ Close';
    closeBtn.setAttribute('aria-label', 'Close sidebar');
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
    '<button class="mobile-actions-close">✕ Close</button>' +
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
  btn.textContent = '☰ Views';
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
  closeBtn.textContent = '✕ Close';
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
  btn.textContent = '✕ Close';
  btn.style.cssText = 'display:block;width:100%;margin-top:12px;padding:10px;' +
    'font-size:1em;font-weight:bold;font-family:Lora, Georgia, serif;' +
    'background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:4px;' +
    'cursor:pointer;min-height:44px;';
  btn.addEventListener('click', function () {
    if (typeof _closeReference === 'function') _closeReference();
  });
  content.appendChild(btn);
}


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

/**
 * Fetch 16-day forecast for a single address and store in cache.
 * @param {string} address
 * @returns {Promise<object|null>} cached entry or null on failure
 */
async function fetchAndCacheWeather(address) {
  if (!address) return null;
  var key = address.toLowerCase().trim();
  try {
    var geo = await _geocodeAddress(address);
    var url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + geo.lat
      + '&longitude=' + geo.lon
      + '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum'
      + '&timezone=auto&forecast_days=16';
    var resp = await fetch(url);
    if (!resp.ok) return null;
    var data = await resp.json();
    if (!data.daily || !data.daily.time) return null;
    var entry = { daily: data.daily, lat: geo.lat, lon: geo.lon, ts: Date.now() };
    window._weatherForecastCache[key] = entry;
    _saveWeatherCacheToLS();
    return entry;
  } catch (e) {
    console.warn('Weather fetch failed for "' + address + '":', e);
    return null;
  }
}

/**
 * Prefetch weather for all saved locations. Call once on dashboard init.
 * Runs async — does not block page load.
 */
async function prefetchSavedLocationWeather() {
  try {
    var locations = await loadSavedLocations();
    if (!locations || locations.length === 0) return;
    var promises = locations.map(function (loc) {
      var addr = loc.address || loc.label || '';
      if (!addr) return Promise.resolve(null);
      // Skip if already cached and fresh
      if (getWeatherFromCache(addr)) return Promise.resolve(null);
      return fetchAndCacheWeather(addr);
    });
    await Promise.all(promises);
  } catch (e) {
    console.error('Error prefetching weather:', e);
  }
}

// ── Delete Undo Toast ────────────────────────────────────────────────────────

/**
 * Show a delete-undo toast with a countdown timer bar.
 * @param {string} chitId - The deleted chit's ID
 * @param {string} chitTitle - The chit title for display
 * @param {function} onExpire - Called when toast expires (no undo)
 * @param {function} onUndo - Called when user clicks Undo
 */
function _showDeleteUndoToast(chitId, chitTitle, onExpire, onUndo) {
  var DURATION = 10000;
  var toast = document.createElement("div");
  toast.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;background:#fff5e6;border:2px solid #8b5a2b;border-radius:8px;padding:0.75em 1.2em 0.5em;box-shadow:0 4px 16px rgba(0,0,0,0.3);min-width:280px;max-width:420px;font-family:Lora, Georgia, serif;";

  var msgRow = document.createElement("div");
  msgRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:0.8em;margin-bottom:0.5em;";
  var msg = document.createElement("span");
  msg.style.cssText = "font-size:0.9em;color:#1a1208;";
  msg.textContent = "🗑️ Deleted: " + (chitTitle || "(Untitled)");
  var undoBtn = document.createElement("button");
  undoBtn.textContent = "Undo";
  undoBtn.style.cssText = "padding:4px 12px;cursor:pointer;font-weight:bold;border:1px solid #8b5a2b;border-radius:4px;background:#f5e6cc;color:#1a1208;font-family:inherit;";
  msgRow.appendChild(msg);
  msgRow.appendChild(undoBtn);
  toast.appendChild(msgRow);

  // Timer bar (HST-style)
  var barOuter = document.createElement("div");
  barOuter.style.cssText = "width:100%;height:6px;background:#f5e6cc;border:1px solid #8b4513;border-radius:4px;overflow:hidden;";
  var barInner = document.createElement("div");
  barInner.style.cssText = "height:100%;width:100%;background:linear-gradient(90deg,#d4af37 0%,#c8965a 60%,#8b4513 100%);transition:width 0.1s linear;border-radius:3px;";
  barOuter.appendChild(barInner);
  toast.appendChild(barOuter);

  document.body.appendChild(toast);

  var start = Date.now();
  var dismissed = false;
  var interval = setInterval(function () {
    var elapsed = Date.now() - start;
    var pct = Math.max(0, 100 - (elapsed / DURATION) * 100);
    barInner.style.width = pct + "%";
    if (elapsed >= DURATION) {
      clearInterval(interval);
      if (!dismissed) {
        dismissed = true;
        toast.remove();
        if (onExpire) onExpire();
      }
    }
  }, 50);

  undoBtn.onclick = function () {
    if (dismissed) return;
    dismissed = true;
    clearInterval(interval);
    toast.remove();
    if (onUndo) onUndo();
  };
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
        audio.play().catch(function() {});
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

function initSyncWebSocket() {
  if (window._cwocSyncMode === 'poll') return; // already fell back to polling
  if (window._cwocSyncWs && window._cwocSyncWs.readyState <= 1) return;

  var proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  var url = proto + '//' + window.location.host + '/ws/sync';
  console.log('CWOC Sync: trying WebSocket', url);

  try {
    var ws = new WebSocket(url);
    window._cwocSyncWs = ws;

    ws.onopen = function() {
      console.log('CWOC Sync: WebSocket connected');
      window._cwocSyncMode = 'ws';
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
      if (window._cwocSyncMode === 'ws') {
        // Was connected, try to reconnect
        window._cwocSyncMode = 'none';
        setTimeout(initSyncWebSocket, window._cwocSyncReconnectDelay);
        window._cwocSyncReconnectDelay = Math.min(window._cwocSyncReconnectDelay * 2, 30000);
      } else {
        // Never connected — fall back to polling
        console.log('CWOC Sync: WebSocket failed, falling back to HTTP polling');
        _startSyncPolling();
      }
    };

    ws.onerror = function() { /* onclose handles it */ };
  } catch (e) {
    console.log('CWOC Sync: WebSocket not available, using HTTP polling');
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
  console.log('CWOC Sync: HTTP polling started');
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
      if (window._cwocSyncMode === 'none') initSyncWebSocket();
      if (window._cwocSyncMode === 'poll') _pollSync(); // immediate poll on return
    }
  });
}


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
  if (window._sharedAlarmAudio) { window._sharedAlarmAudio.pause(); window._sharedAlarmAudio.currentTime = 0; }
  if (window._sharedAlarmTimeout) { clearTimeout(window._sharedAlarmTimeout); window._sharedAlarmTimeout = null; }
  if (navigator.vibrate) try { navigator.vibrate(0); } catch (e) {}
}
function _sharedPlayTimer() {
  if (!window._sharedTimerAudio) window._sharedTimerAudio = new Audio('/static/timer.mp3');
  window._sharedTimerAudio.loop = true;
  cwocPlayAudio(window._sharedTimerAudio, { loop: true });
}
function _sharedStopTimer() {
  if (window._sharedTimerAudio) { window._sharedTimerAudio.pause(); window._sharedTimerAudio.currentTime = 0; window._sharedTimerAudio.loop = false; }
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
      if (typeof _timerAudio !== 'undefined' && _timerAudio) { _timerAudio.pause(); _timerAudio.currentTime = 0; }
      if (typeof _alarmAudio !== 'undefined' && _alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; }
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
      if (typeof _timerAudio !== 'undefined' && _timerAudio) { _timerAudio.pause(); _timerAudio.currentTime = 0; }
      if (typeof _alarmAudio !== 'undefined' && _alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; }
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
    if (typeof _timerAudio !== 'undefined' && _timerAudio) { _timerAudio.pause(); _timerAudio.currentTime = 0; }
    if (typeof _alarmAudio !== 'undefined' && _alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; }
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
      if (typeof _timerAudio !== 'undefined' && _timerAudio) { _timerAudio.pause(); _timerAudio.currentTime = 0; }
      if (typeof _alarmAudio !== 'undefined' && _alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; }
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
      if (typeof _timerAudio !== 'undefined' && _timerAudio) { _timerAudio.pause(); _timerAudio.currentTime = 0; }
      if (typeof _alarmAudio !== 'undefined' && _alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; }
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
  try {
    var n = new Notification(title, { body: body, icon: '/static/cwod_logo-favicon.png', tag: 'cwoc-' + (chitId || 'alert'), renotify: true, requireInteraction: true, silent: true });
    n.onclick = function() { window.focus(); if (chitId) window.location.href = '/editor?id=' + chitId; };
  } catch (e) {}
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
// Opens a modal with A/T/S type picker, then shows a full inline editor
// for the selected alert type. Works on all pages.

function _openQuickAlertModal() {
  if (document.getElementById('cwoc-quick-alert-overlay')) return;

  var overlay = document.createElement('div');
  overlay.id = 'cwoc-quick-alert-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) _closeQuickAlertModal();
  });

  var box = document.createElement('div');
  box.style.cssText = 'background:#fff8e1;border:2px solid #8b4513;border-radius:10px;padding:24px 32px;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:Lora, Georgia, serif;min-width:260px;max-width:340px;text-align:center;color:#2b1e0f;';
  box.className = 'cwoc-quick-alert-box';

  var _optStyle = 'display:flex;align-items:center;gap:12px;padding:10px 14px;margin:4px 0;border:1px solid #e0d4b5;border-radius:6px;cursor:pointer;transition:background 0.15s;font-size:1.05em;';
  var _keyStyle = 'display:inline-flex;align-items:center;justify-content:center;min-width:2em;height:2em;background:#8b5a2b;color:#fff8e1;font-weight:bold;font-size:0.95em;border-radius:4px;border:1px solid #5a3f2a;flex-shrink:0;';
  var _btnStyle = 'padding:8px 24px;font-family:Lora, Georgia, serif;font-size:1em;background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:4px;cursor:pointer;';

  box.innerHTML =
    '<h3 style="margin:0 0 12px;font-size:1.15em;color:#4a2c2a;">⚡ Quick Alert</h3>' +
    '<p style="margin:0 0 14px;font-size:0.9em;opacity:0.7;">Press a key or click to add:</p>' +
    '<div style="display:flex;flex-direction:column;gap:6px;">' +
      '<div class="cwoc-qa-opt" data-type="alarm" tabindex="0" style="' + _optStyle + '">' +
        '<span style="' + _keyStyle + '">A</span>' +
        '<span>🔔 Alarm</span>' +
      '</div>' +
      '<div class="cwoc-qa-opt" data-type="timer" tabindex="0" style="' + _optStyle + '">' +
        '<span style="' + _keyStyle + '">T</span>' +
        '<span>⏱️ Timer</span>' +
      '</div>' +
      '<div class="cwoc-qa-opt" data-type="stopwatch" tabindex="0" style="' + _optStyle + '">' +
        '<span style="' + _keyStyle + '">S</span>' +
        '<span>⏲️ Stopwatch</span>' +
      '</div>' +
    '</div>' +
    '<div style="margin-top:14px;text-align:center;">' +
      '<button style="' + _btnStyle + '">Cancel</button>' +
    '</div>' +
    '<div style="margin-top:8px;font-size:0.75em;opacity:0.45;text-align:center;">ESC or click outside to close</div>';

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Done button handler
  box.querySelector('button').addEventListener('click', function() {
    _closeQuickAlertModal();
  });

  // Hover effect for options
  var opts = box.querySelectorAll('.cwoc-qa-opt');
  for (var i = 0; i < opts.length; i++) {
    (function(opt) {
      opt.addEventListener('mouseenter', function() { opt.style.background = 'rgba(139,69,19,0.12)'; });
      opt.addEventListener('mouseleave', function() { opt.style.background = ''; });
      opt.addEventListener('click', function() {
        _quickAlertShowEditor(opt.getAttribute('data-type'));
      });
    })(opts[i]);
  }

  // Keyboard handler for the modal (capture phase so it fires before page handlers)
  function _qaKeyHandler(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      _closeQuickAlertModal();
      return;
    }
    var k = e.key.toLowerCase();
    if (k === 'a') { e.preventDefault(); e.stopPropagation(); _quickAlertShowEditor('alarm'); }
    else if (k === 't') { e.preventDefault(); e.stopPropagation(); _quickAlertShowEditor('timer'); }
    else if (k === 's') { e.preventDefault(); e.stopPropagation(); _quickAlertShowEditor('stopwatch'); }
  }
  overlay._keyHandler = _qaKeyHandler;
  document.addEventListener('keydown', _qaKeyHandler, true);
}

function _closeQuickAlertModal() {
  var overlay = document.getElementById('cwoc-quick-alert-overlay');
  if (!overlay) return;
  if (overlay._keyHandler) {
    document.removeEventListener('keydown', overlay._keyHandler, true);
  }
  overlay.remove();
}

/** Show the inline editor for the selected alert type inside the quick alert modal */
function _quickAlertShowEditor(type) {
  var overlay = document.getElementById('cwoc-quick-alert-overlay');
  if (!overlay) return;
  var box = overlay.querySelector('.cwoc-quick-alert-box');
  if (!box) return;
  if (overlay._keyHandler) { document.removeEventListener('keydown', overlay._keyHandler, true); overlay._keyHandler = null; }
  box.innerHTML = '';
  var labels = { alarm: '🔔 Alarm', timer: '⏱️ Timer', stopwatch: '⏲️ Stopwatch' };
  var heading = document.createElement('h3');
  heading.style.cssText = 'margin:0 0 12px;font-size:1.15em;color:#4a2c2a;';
  heading.textContent = labels[type] || 'Alert';
  box.appendChild(heading);
  var formDiv = document.createElement('div');
  formDiv.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
  if (type === 'alarm') {
    var nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.placeholder = 'Alarm name (optional)';
    nameInput.style.cssText = 'width:100%;padding:6px 8px;font-family:inherit;font-size:0.95em;border:1px solid #8b5a2b;border-radius:4px;box-sizing:border-box;background:#f5e6cc;';
    formDiv.appendChild(nameInput);
    var now = new Date(); now.setMinutes(now.getMinutes() + 1);
    var defTime = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    var timeInput = document.createElement('input');
    timeInput.type = 'time'; timeInput.value = defTime;
    timeInput.style.cssText = 'width:100%;padding:6px 8px;font-family:inherit;font-size:1.1em;font-weight:bold;border:1px solid #8b5a2b;border-radius:4px;box-sizing:border-box;background:#f5e6cc;';
    formDiv.appendChild(timeInput);
    var daysDiv = document.createElement('div');
    daysDiv.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;font-size:0.9em;';
    var allDays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var today = allDays[new Date().getDay()];
    allDays.forEach(function(day) {
      var lbl = document.createElement('label');
      lbl.style.cssText = 'display:flex;align-items:center;gap:2px;cursor:pointer;';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = day; cb.checked = (day === today);
      lbl.appendChild(cb); lbl.appendChild(document.createTextNode(day)); daysDiv.appendChild(lbl);
    });
    formDiv.appendChild(daysDiv);
    formDiv._getData = function() {
      var days = []; daysDiv.querySelectorAll('input:checked').forEach(function(cb) { days.push(cb.value); });
      return { _type: 'alarm', name: nameInput.value.trim(), time: timeInput.value, days: days, enabled: true };
    };
    setTimeout(function() { timeInput.focus(); timeInput.select(); }, 50);
  } else if (type === 'timer') {
    var nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.placeholder = 'Timer name (optional)';
    nameInput.style.cssText = 'width:100%;padding:6px 8px;font-family:inherit;font-size:0.95em;border:1px solid #8b5a2b;border-radius:4px;box-sizing:border-box;background:#f5e6cc;';
    formDiv.appendChild(nameInput);
    var durRow = document.createElement('div');
    durRow.style.cssText = 'display:flex;align-items:center;gap:4px;justify-content:center;';
    var hInput = document.createElement('input'); hInput.type = 'number'; hInput.min = '0'; hInput.placeholder = 'HH'; hInput.value = '0';
    hInput.style.cssText = 'width:55px;padding:6px 4px;font-family:inherit;font-size:1.1em;text-align:center;border:1px solid #8b5a2b;border-radius:4px;background:#f5e6cc;';
    var mInput = document.createElement('input'); mInput.type = 'number'; mInput.min = '0'; mInput.max = '59'; mInput.placeholder = 'MM'; mInput.value = '5';
    mInput.style.cssText = hInput.style.cssText;
    var sInput = document.createElement('input'); sInput.type = 'number'; sInput.min = '0'; sInput.max = '59'; sInput.placeholder = 'SS'; sInput.value = '0';
    sInput.style.cssText = hInput.style.cssText;
    durRow.appendChild(hInput); durRow.appendChild(document.createTextNode(':')); durRow.appendChild(mInput);
    durRow.appendChild(document.createTextNode(':')); durRow.appendChild(sInput); formDiv.appendChild(durRow);
    var loopLbl = document.createElement('label');
    loopLbl.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:0.9em;cursor:pointer;';
    var loopCb = document.createElement('input'); loopCb.type = 'checkbox';
    loopLbl.appendChild(loopCb); loopLbl.appendChild(document.createTextNode('🔁 Loop when done')); formDiv.appendChild(loopLbl);
    formDiv._getData = function() {
      var total = (parseInt(hInput.value)||0)*3600 + (parseInt(mInput.value)||0)*60 + (parseInt(sInput.value)||0);
      return { _type: 'timer', name: nameInput.value.trim(), totalSeconds: total, loop: loopCb.checked };
    };
    setTimeout(function() { mInput.focus(); mInput.select(); }, 50);
  } else if (type === 'stopwatch') {
    var nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.placeholder = 'Stopwatch name (optional)';
    nameInput.style.cssText = 'width:100%;padding:6px 8px;font-family:inherit;font-size:0.95em;border:1px solid #8b5a2b;border-radius:4px;box-sizing:border-box;background:#f5e6cc;';
    formDiv.appendChild(nameInput);
    var note = document.createElement('div'); note.style.cssText = 'font-size:0.85em;opacity:0.6;text-align:center;';
    note.textContent = 'Stopwatch will start automatically'; formDiv.appendChild(note);
    formDiv._getData = function() { return { _type: 'stopwatch', name: nameInput.value.trim() }; };
    setTimeout(function() { nameInput.focus(); }, 50);
  }
  box.appendChild(formDiv);
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:14px;';
  var _qaBtnPrimary = 'padding:8px 14px;cursor:pointer;font-size:0.95em;font-weight:bold;font-family:Lora, Georgia, serif;background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:4px;white-space:nowrap;';
  var _qaBtnSecondary = 'padding:8px 14px;cursor:pointer;font-size:0.95em;font-family:Lora, Georgia, serif;background:#fdf5e6;color:#4a2c2a;border:1px solid #8b5a2b;border-radius:4px;white-space:nowrap;';

  var saveBtn = document.createElement('button');
  saveBtn.textContent = '✓ Create'; saveBtn.title = 'Enter'; saveBtn.style.cssText = _qaBtnPrimary;
  saveBtn.onclick = function() { _quickAlertSave(type, formDiv._getData(), false); };
  btnRow.appendChild(saveBtn);

  var saveViewBtn = document.createElement('button');
  saveViewBtn.textContent = '✓ Create & View'; saveViewBtn.title = 'Shift+Enter'; saveViewBtn.style.cssText = _qaBtnSecondary + 'font-weight:bold;';
  saveViewBtn.onclick = function() { _quickAlertSave(type, formDiv._getData(), true); };
  btnRow.appendChild(saveViewBtn);

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel'; cancelBtn.title = 'Escape'; cancelBtn.style.cssText = _qaBtnSecondary;
  cancelBtn.onclick = function() { _closeQuickAlertModal(); };
  btnRow.appendChild(cancelBtn);
  box.appendChild(btnRow);
  function _editorKeyHandler(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); _closeQuickAlertModal(); }
    else if (e.key === 'Enter') {
      var tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag !== 'textarea') {
        e.preventDefault(); e.stopPropagation();
        _quickAlertSave(type, formDiv._getData(), e.shiftKey);
      }
    }
  }
  overlay._keyHandler = _editorKeyHandler;
  document.addEventListener('keydown', _editorKeyHandler, true);
}

function _quickAlertAddToChit() { /* deprecated — now handled by _quickAlertSave */ }
function _quickAlertAddIndependent() { /* deprecated */ }
function _quickAlertAddIndependentDashboard() { /* deprecated */ }

/** Save the alert from the quick alert editor — context-aware */
function _quickAlertSave(type, data, andView) {
  var isEditor = !!document.getElementById('mainEditor');
  if (isEditor) {
    if (!window._alertsData) window._alertsData = { alarms: [], timers: [], stopwatches: [], notifications: [] };
    var alertsSection = document.getElementById('alertsSection');
    var alertsContent = document.getElementById('alertsContent');
    if (alertsSection && alertsSection.classList.contains('collapsed')) {
      alertsSection.classList.remove('collapsed');
      if (alertsContent) alertsContent.style.display = '';
      var zIcon = alertsSection.querySelector('.zone-toggle-icon');
      if (zIcon) zIcon.textContent = '🔼';
      alertsSection.querySelectorAll('.zone-button').forEach(function(b) { b.style.display = ''; });
    }
    if (type === 'alarm') {
      window._alertsData.alarms.push(data);
      if (typeof renderAlarmsContainer === 'function') renderAlarmsContainer();
    } else if (type === 'timer') {
      window._alertsData.timers.push(data);
      var tIdx = window._alertsData.timers.length - 1;
      if (!window._timerRuntime) window._timerRuntime = {};
      window._timerRuntime[tIdx] = { remaining: data.totalSeconds, intervalId: null, running: false };
      if (typeof renderTimersContainer === 'function') renderTimersContainer();
    } else if (type === 'stopwatch') {
      var swIdx = window._alertsData.stopwatches.length;
      window._alertsData.stopwatches.push(data);
      if (!window._swRuntime) window._swRuntime = {};
      window._swRuntime[swIdx] = { running: false, elapsed: 0, intervalId: null, laps: [] };
      var swRt = window._swRuntime[swIdx]; var swStart = Date.now();
      swRt.intervalId = setInterval(function() { swRt.elapsed = Date.now() - swStart; var swD = document.getElementById('sw-display-' + swIdx); if (swD && typeof _swFmt === 'function') swD.textContent = _swFmt(swRt.elapsed); }, 50);
      swRt.running = true;
      if (typeof renderStopwatchesContainer === 'function') renderStopwatchesContainer();
      setTimeout(function() { var swBtn = document.getElementById('sw-startstop-' + swIdx); if (swBtn) swBtn.textContent = '⏸ Pause'; }, 50);
    }
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    _closeQuickAlertModal();
    if (alertsSection) alertsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (typeof _createIndependentAlert === 'function') {
    _createIndependentAlert(data).then(function(created) {
      if (type === 'stopwatch' && created && created.id && typeof _saSwRuntime !== 'undefined') {
        if (!_saSwRuntime[created.id]) _saSwRuntime[created.id] = { running: false, elapsed: 0, intervalId: null, laps: [] };
        var saRt = _saSwRuntime[created.id]; var saMs = Date.now();
        saRt.intervalId = setInterval(function() { saRt.elapsed = Date.now() - saMs; var saD = document.getElementById('sa-sw-display-' + created.id); if (saD) saD.textContent = _saSwFmt(saRt.elapsed); }, 50);
        saRt.running = true;
      }
      if (andView) {
        _quickAlertJumpToIndependent();
      } else {
        _closeQuickAlertModal();
      }
    });
  } else {
    fetch('/api/standalone-alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    .then(function(r) { if (!r.ok) throw new Error('Failed'); return r.json(); })
    .then(function() {
      _closeQuickAlertModal();
      if (andView) {
        // Store desired tab in localStorage so dashboard picks it up on load
        try { localStorage.setItem('cwoc_jump_tab', 'Alarms'); localStorage.setItem('cwoc_jump_alarms_mode', 'independent'); } catch(e) {}
        window.location.href = '/';
      } else {
        _showQuickAlertToast(type);
      }
      if (typeof syncSend === 'function') syncSend('alerts_changed', {});
    })
    .catch(function(e) { console.error('Quick alert creation failed:', e); });
  }
}

function _quickAlertJumpToIndependent() {
  _closeQuickAlertModal();
  if (typeof _alarmsViewMode !== 'undefined') {
    _alarmsViewMode = 'independent';
    var toggle = document.getElementById('alerts-view-toggle');
    if (toggle) toggle.value = 'independent';
  }
  if (typeof filterChits === 'function') filterChits('Alarms');
}

function _showQuickAlertToast(type) {
  var labels = { alarm: '🔔 Alarm', timer: '⏱️ Timer', stopwatch: '⏲️ Stopwatch' };
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;background:#fff8e1;border:2px solid #8b4513;border-radius:8px;padding:10px 18px;box-shadow:0 4px 16px rgba(0,0,0,0.3);font-family:Lora, Georgia, serif;font-size:0.95em;color:#4a2c2a;display:flex;align-items:center;gap:10px;';
  toast.appendChild(document.createTextNode((labels[type] || 'Alert') + ' created '));
  var viewLink = document.createElement('a'); viewLink.textContent = 'View →'; viewLink.href = '/?tab=Alarms&view=independent';
  viewLink.style.cssText = 'color:#6b4226;font-weight:bold;text-decoration:underline;'; toast.appendChild(viewLink);
  document.body.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 3000);
  setTimeout(function() { toast.remove(); }, 3300);
}

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

// Log version on every page load
function _logCwocVersion() {
  fetch('/api/version').then(function(r) { return r.ok ? r.json() : null; }).then(function(d) {
    if (d && d.version) console.info('[CWOC] Version ' + d.version + ' — ' + window.location.pathname);
  }).catch(function() {});
}

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

  console.log('[Rollover] ' + (chit.title || chit.id) + ': snapshotted ' + habitSuccess + '/' + habitGoal + ' into ' + previousPeriod + ', reset to 0');
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
    var resp = await fetch('/api/chits/' + chit.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chit)
    });
    if (!resp.ok) {
      console.error('[_persistHabitRollover] Failed to save rollover for chit ' + chit.id + ':', resp.status);
    }
  } catch (err) {
    console.error('[_persistHabitRollover] Error saving rollover for chit ' + chit.id + ':', err);
  }
}

// Auto-init on page load
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
