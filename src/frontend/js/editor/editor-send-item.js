/**
 * editor-send-item.js — Send a single checklist item (+ children) to another chit.
 *
 * Shows a small popup near the item with:
 *   - The 3 most recently edited chits (quick picks)
 *   - A "Search..." button to open the full send-content modal
 * Supports Copy and Move modes.
 *
 * When moving/copying:
 *   - Includes all children/sublist items
 *   - If the item is not top-level, demotes it (and children) so it becomes level 0
 *
 * Search uses the server-side /api/chits/search endpoint which supports
 * full boolean operators: && (AND), || (OR), ! (NOT), () (group), #tag.
 *
 * Depends on: shared-utils.js (cwocToast, generateUniqueId),
 *             editor.js (_onChecklistChange),
 *             editor_checklists.js (Checklist class),
 *             editor-send-content.js (_sendContentExtractTerms, _sendContentHighlightMulti)
 * Loaded before: editor-init.js
 */

/* ── State ────────────────────────────────────────────────────────────────── */

var _sendItemPopup = null;
var _sendItemPopupOpen = false;
var _sendItemTarget = null; // { item, checklist }
var _sendItemRecentChits = []; // cached recent chits

/* ── Open the per-item send popup ─────────────────────────────────────────── */

function _openSendItemPopup(e, item, checklist) {
  if (e) { e.stopPropagation(); e.preventDefault(); }

  // Close any existing popup
  _closeSendItemPopup();

  // Set target after closing (close clears it)
  _sendItemTarget = { item: item, checklist: checklist };

  // Create popup
  var popup = document.createElement('div');
  popup.id = 'sendItemPopup';
  popup.className = 'send-item-popup';

  // Loading state
  popup.innerHTML = '<div class="send-item-loading">Loading...</div>';
  document.body.appendChild(popup);
  _sendItemPopup = popup;
  _sendItemPopupOpen = true;

  // Position near the clicked element
  var rect = e.currentTarget.getBoundingClientRect();
  popup.style.top = (rect.bottom + 4) + 'px';
  // Anchor from the right side to prevent overflow
  popup.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
  popup.style.left = 'auto';

  // Fetch recent chits
  _fetchRecentChitsForItem();

  // Close on outside click (delayed to avoid immediate close)
  setTimeout(function() {
    document.addEventListener('click', _sendItemOutsideClick, true);
    document.addEventListener('keydown', _sendItemEscHandler, true);
  }, 10);
}

function _sendItemOutsideClick(ev) {
  if (_sendItemPopup && !_sendItemPopup.contains(ev.target)) {
    _closeSendItemPopup();
  }
}

function _sendItemEscHandler(ev) {
  if (ev.key === 'Escape' && _sendItemPopupOpen) {
    ev.preventDefault();
    ev.stopPropagation();
    _closeSendItemPopup();
  }
}

function _closeSendItemPopup() {
  if (_sendItemPopup) {
    _sendItemPopup.remove();
    _sendItemPopup = null;
  }
  _sendItemPopupOpen = false;
  _sendItemTarget = null;
  document.removeEventListener('click', _sendItemOutsideClick, true);
  document.removeEventListener('keydown', _sendItemEscHandler, true);
}

/* ── Fetch recent chits ───────────────────────────────────────────────────── */

async function _fetchRecentChitsForItem() {
  try {
    var response = await fetch('/api/chits');
    if (!response.ok) throw new Error('Failed to fetch chits');
    var allChits = await response.json();

    // Exclude current chit, sort by modified_datetime descending
    var available = allChits
      .filter(function(c) { return c.id !== window.currentChitId && !c.deleted; })
      .sort(function(a, b) {
        var aDate = a.modified_datetime || a.created_datetime || '';
        var bDate = b.modified_datetime || b.created_datetime || '';
        return bDate.localeCompare(aDate);
      });

    _sendItemRecentChits = available.slice(0, 3);
    _renderSendItemPopup(available);
  } catch (err) {
    console.error('Error fetching chits for send-item popup:', err);
    if (_sendItemPopup) {
      _sendItemPopup.innerHTML = '<div class="send-item-loading">Failed to load chits</div>';
    }
  }
}

/* ── Render the popup content ─────────────────────────────────────────────── */

function _renderSendItemPopup(allChits) {
  if (!_sendItemPopup) return;

  var html = '<div class="send-item-header">Send item to...</div>';
  html += '<div class="send-item-recent">';

  if (_sendItemRecentChits.length === 0) {
    html += '<div class="send-item-empty">No other chits available</div>';
  } else {
    _sendItemRecentChits.forEach(function(chit) {
      var title = chit.title || '(No Title)';
      if (title.length > 30) title = title.substring(0, 28) + '\u2026';
      html += '<div class="send-item-chit-row" data-chit-id="' + chit.id + '">';
      html += '<span class="send-item-chit-title">' + _escHtml(title) + '</span>';
      html += '<span class="send-item-actions">';
      html += '<button class="send-item-btn send-item-copy" data-chit-id="' + chit.id + '" title="Copy item to this chit">\uD83D\uDCCB</button>';
      html += '<button class="send-item-btn send-item-move" data-chit-id="' + chit.id + '" title="Move item to this chit">\uD83D\uDCE4</button>';
      html += '</span>';
      html += '</div>';
    });
  }

  html += '</div>';
  html += '<div class="send-item-footer">';
  html += '<button class="send-item-search-btn" title="Search all chits"><i class="fas fa-search"></i> Search...</button>';
  html += '</div>';

  _sendItemPopup.innerHTML = html;

  // Attach event listeners
  _sendItemPopup.querySelectorAll('.send-item-copy').forEach(function(btn) {
    btn.addEventListener('click', function(ev) {
      ev.stopPropagation();
      var chitId = btn.dataset.chitId;
      var chit = _sendItemRecentChits.find(function(c) { return c.id === chitId; });
      if (chit) _executeSendItem('copy', chit);
    });
  });

  _sendItemPopup.querySelectorAll('.send-item-move').forEach(function(btn) {
    btn.addEventListener('click', function(ev) {
      ev.stopPropagation();
      var chitId = btn.dataset.chitId;
      var chit = _sendItemRecentChits.find(function(c) { return c.id === chitId; });
      if (chit) _executeSendItem('move', chit);
    });
  });

  var searchBtn = _sendItemPopup.querySelector('.send-item-search-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', function(ev) {
      ev.stopPropagation();
      // Preserve target before closing popup (which clears it)
      var preservedTarget = _sendItemTarget;
      _closeSendItemPopup();
      _sendItemTarget = preservedTarget;
      _openSendItemSearchModal();
    });
  }

  // Reposition after content renders to prevent bottom overflow
  requestAnimationFrame(function() {
    if (!_sendItemPopup) return;
    var popupRect = _sendItemPopup.getBoundingClientRect();
    if (popupRect.bottom > window.innerHeight - 8) {
      _sendItemPopup.style.top = Math.max(8, window.innerHeight - popupRect.height - 8) + 'px';
    }
    // Also check left overflow (if right-anchoring pushes it off left edge)
    if (popupRect.left < 8) {
      _sendItemPopup.style.right = 'auto';
      _sendItemPopup.style.left = '8px';
    }
  });
}

function _escHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Full search modal for single item ────────────────────────────────────── */

var _sendItemSearchModal = null;
var _sendItemSearchModalOpen = false;

function _openSendItemSearchModal() {
  if (!_sendItemSearchModal) {
    _sendItemSearchModal = document.createElement('div');
    _sendItemSearchModal.id = 'sendItemSearchModal';
    _sendItemSearchModal.className = 'modal-overlay-new';
    document.body.appendChild(_sendItemSearchModal);

    _sendItemSearchModal.innerHTML = '<div class="modal-content-new">'
      + '<div class="modal-header-new">'
      + '<h2 id="sendItemSearchTitle">Send Item To...</h2>'
      + '<div class="modal-buttons"></div>'
      + '</div>'
      + '<div class="modal-body-new">'
      + '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">'
      + '<input type="text" id="sendItemSearchInput" class="chit-search-input-new" placeholder="Search chits..." autofocus style="flex:1;">'
      + '<button type="button" id="sendItemGoBtn" class="modal-button-new" style="padding:6px 14px;flex-shrink:0;">Go</button>'
      + '</div>'
      + '<div style="font-size:0.75em;opacity:0.7;margin-bottom:8px;line-height:1.4;">'
      + 'Operators: <strong>&&</strong> (AND) &middot; <strong>||</strong> (OR) &middot; <strong>!</strong> (NOT) &middot; <strong>()</strong> (group) &middot; <strong>#tag</strong> &middot; e.g. <code>#work && !done</code>'
      + '</div>'
      + '<table class="chit-table-new">'
      + '<thead><tr><th style="width:30px;"></th><th>Title</th><th>Due</th><th>Status</th></tr></thead>'
      + '<tbody id="sendItemChitList"></tbody>'
      + '</table>'
      + '</div>'
      + '<div class="modal-footer-new">'
      + '<span id="sendItemSelectedName" style="font-size:0.85em;opacity:0.7;flex:1;"></span>'
      + '<button class="modal-button-new cancel" id="sendItemCancelBtn">Cancel</button>'
      + '<button class="modal-button-new" id="sendItemCopyBtn" disabled>&#x1F4CB; Copy</button>'
      + '<button class="modal-button-new" id="sendItemMoveBtn" disabled>&#x1F4E4; Move</button>'
      + '</div>'
      + '</div>';

    document.getElementById('sendItemSearchInput').addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); _sendItemDoSearch(); }
    });
    document.getElementById('sendItemGoBtn').addEventListener('click', function() {
      _sendItemDoSearch();
    });
    document.getElementById('sendItemCancelBtn').addEventListener('click', function() { _closeSendItemSearchModal(); });
    document.getElementById('sendItemCopyBtn').addEventListener('click', function() {
      var chit = _sendItemSearchModal._selectedChit;
      if (chit) _executeSendItem('copy', chit);
    });
    document.getElementById('sendItemMoveBtn').addEventListener('click', function() {
      var chit = _sendItemSearchModal._selectedChit;
      if (chit) _executeSendItem('move', chit);
    });
    _sendItemSearchModal.addEventListener('click', function(ev) {
      if (ev.target === _sendItemSearchModal) _closeSendItemSearchModal();
    });
    _sendItemSearchModal._escHandler = function(ev) {
      if (ev.key === 'Escape' && _sendItemSearchModalOpen) {
        ev.preventDefault();
        ev.stopPropagation();
        var searchInput = document.getElementById('sendItemSearchInput');
        if (searchInput && searchInput.value.trim()) {
          searchInput.value = '';
          _sendItemSearchRenderChits(_sendItemSearchModal._availableChits || []);
          searchInput.focus();
        } else {
          _closeSendItemSearchModal();
        }
      }
    };
    document.addEventListener('keydown', _sendItemSearchModal._escHandler, true);
  }

  // Show modal and populate
  _sendItemSearchModal.style.display = 'flex';
  _sendItemSearchModalOpen = true;
  _sendItemSearchModal._selectedChit = null;
  _sendItemSearchUpdateButtons();

  // Fetch and render chits
  _fetchChitsForItemSearch();
}

function _closeSendItemSearchModal() {
  if (_sendItemSearchModal) {
    _sendItemSearchModal.style.display = 'none';
  }
  _sendItemSearchModalOpen = false;
}

async function _fetchChitsForItemSearch() {
  try {
    var response = await fetch('/api/chits');
    if (!response.ok) throw new Error('Failed to fetch chits');
    var allChits = await response.json();
    var available = allChits
      .filter(function(c) { return c.id !== window.currentChitId && !c.deleted; })
      .sort(function(a, b) { return (a.title || '').localeCompare(b.title || ''); });
    _sendItemSearchModal._availableChits = available;
    _sendItemSearchRenderChits(available);
    var titleEl = document.getElementById('sendItemSearchTitle');
    if (titleEl) titleEl.textContent = 'Send Item To (' + available.length + ' available)';
  } catch (err) {
    console.error('Error fetching chits for send-item search:', err);
    cwocToast('Failed to load chits.', 'error');
    _closeSendItemSearchModal();
  }
  document.getElementById('sendItemSearchInput').value = '';
  setTimeout(function() { document.getElementById('sendItemSearchInput').focus(); }, 50);
}

/* ── Search (server-side via /api/chits/search) ───────────────────────────── */

async function _sendItemDoSearch() {
  var searchTerm = (document.getElementById('sendItemSearchInput')?.value || '').trim();

  if (!searchTerm) {
    // Empty search: show all available chits
    _sendItemSearchRenderChits(_sendItemSearchModal._availableChits || []);
    var titleEl = document.getElementById('sendItemSearchTitle');
    if (titleEl) titleEl.textContent = 'Send Item To (' + (_sendItemSearchModal._availableChits || []).length + ' available)';
    return;
  }

  try {
    var resp = await fetch('/api/chits/search?q=' + encodeURIComponent(searchTerm));
    if (!resp.ok) throw new Error('Search failed');
    var data = await resp.json();
    var results = Array.isArray(data) ? data : [];

    // Extract chit objects, exclude current chit
    var filtered = results
      .map(function(r) { return r.chit || r; })
      .filter(function(c) { return c.id !== window.currentChitId && !c.deleted; });

    _sendItemSearchRenderChits(filtered);

    var titleEl = document.getElementById('sendItemSearchTitle');
    if (titleEl) titleEl.textContent = 'Send Item To (' + filtered.length + ' found)';
  } catch (err) {
    console.error('Send-item search error:', err);
    var list = document.getElementById('sendItemChitList');
    if (list) list.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1em;color:#b22222;">Search failed</td></tr>';
  }
}

/* ── Render chit list ─────────────────────────────────────────────────────── */

function _sendItemSearchRenderChits(chits) {
  var list = document.getElementById('sendItemChitList');
  if (!list) return;
  list.innerHTML = '';
  var searchTerm = (document.getElementById('sendItemSearchInput')?.value || '').trim();
  // Use shared term extractor from editor-send-content.js
  var highlightTerms = (typeof _sendContentExtractTerms === 'function')
    ? _sendContentExtractTerms(searchTerm)
    : [];

  chits.forEach(function(chit) {
    var row = document.createElement('tr');
    row.dataset.chitId = chit.id;
    row.style.cursor = 'pointer';

    var radioCell = document.createElement('td');
    radioCell.style.textAlign = 'center';
    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'sendItemTarget';
    radio.value = chit.id;
    radio.checked = (_sendItemSearchModal._selectedChit && _sendItemSearchModal._selectedChit.id === chit.id);
    radio.addEventListener('change', function() {
      _sendItemSearchModal._selectedChit = chit;
      _sendItemSearchUpdateButtons();
    });
    radioCell.appendChild(radio);
    row.appendChild(radioCell);

    var titleCell = document.createElement('td');
    var titleText = chit.title || '(No Title)';
    if (highlightTerms.length > 0 && typeof _sendContentHighlightMulti === 'function') {
      titleCell.innerHTML = _sendContentHighlightMulti(titleText, highlightTerms);
    } else {
      titleCell.textContent = titleText;
    }
    row.appendChild(titleCell);

    var dueCell = document.createElement('td');
    dueCell.textContent = chit.due_datetime ? new Date(chit.due_datetime).toISOString().slice(0, 10) : '';
    row.appendChild(dueCell);

    var statusCell = document.createElement('td');
    statusCell.textContent = chit.status || '';
    row.appendChild(statusCell);

    row.addEventListener('click', function(ev) {
      if (ev.target.tagName === 'INPUT') return;
      radio.checked = true;
      _sendItemSearchModal._selectedChit = chit;
      _sendItemSearchUpdateButtons();
    });

    list.appendChild(row);
  });
}

function _sendItemSearchUpdateButtons() {
  var hasSelection = !!(_sendItemSearchModal && _sendItemSearchModal._selectedChit);
  var copyBtn = document.getElementById('sendItemCopyBtn');
  var moveBtn = document.getElementById('sendItemMoveBtn');
  var nameSpan = document.getElementById('sendItemSelectedName');
  if (copyBtn) copyBtn.disabled = !hasSelection;
  if (moveBtn) moveBtn.disabled = !hasSelection;
  if (nameSpan) {
    nameSpan.textContent = hasSelection
      ? '\u2192 ' + (_sendItemSearchModal._selectedChit.title || '(No Title)')
      : '';
  }
}

/* ── Execute copy or move of single item ──────────────────────────────────── */

async function _executeSendItem(mode, targetChit) {
  if (!_sendItemTarget) return;
  var item = _sendItemTarget.item;
  var checklist = _sendItemTarget.checklist;

  _closeSendItemPopup();
  _closeSendItemSearchModal();

  try {
    // Get the subtree (item + all children)
    var subtree = checklist.getSubtree(item);

    // Calculate level demotion: make the item top-level (level 0)
    var levelOffset = item.level;

    // Build new items with demoted levels and new IDs
    var idMap = {};
    var newItems = subtree.map(function(srcItem) {
      var newId = generateUniqueId();
      idMap[srcItem.id] = newId;
      return {
        id: newId,
        text: srcItem.text,
        level: Math.max(0, srcItem.level - levelOffset),
        checked: srcItem.checked,
        parent: srcItem.parent ? (idMap[srcItem.parent] || null) : null
      };
    });

    // Fetch target chit
    var resp = await fetch('/api/chit/' + encodeURIComponent(targetChit.id));
    if (!resp.ok) throw new Error('Failed to fetch target chit');
    var fullTarget = await resp.json();

    // Append items to target checklist
    var targetChecklist = Array.isArray(fullTarget.checklist) ? fullTarget.checklist : [];
    fullTarget.checklist = targetChecklist.concat(newItems);

    // If move, remove items from source
    if (mode === 'move') {
      checklist._pushUndoState();
      var subtreeIds = subtree.map(function(i) { return i.id; });
      checklist.items = checklist.items.filter(function(i) {
        return subtreeIds.indexOf(i.id) === -1;
      });
      checklist.render();
      checklist._notifyChange();
    }

    // Save target chit
    delete fullTarget.effective_role;
    delete fullTarget.assigned_to_display_name;
    if (fullTarget.weather_data && typeof fullTarget.weather_data === 'object') {
      fullTarget.weather_data = JSON.stringify(fullTarget.weather_data);
    }
    if (fullTarget.health_data && typeof fullTarget.health_data === 'object') {
      fullTarget.health_data = JSON.stringify(fullTarget.health_data);
    }
    if (fullTarget.email_to && typeof fullTarget.email_to === 'object') {
      fullTarget.email_to = JSON.stringify(fullTarget.email_to);
    }
    if (fullTarget.email_cc && typeof fullTarget.email_cc === 'object') {
      fullTarget.email_cc = JSON.stringify(fullTarget.email_cc);
    }
    if (fullTarget.email_bcc && typeof fullTarget.email_bcc === 'object') {
      fullTarget.email_bcc = JSON.stringify(fullTarget.email_bcc);
    }

    var saveResp = await fetch('/api/chits/' + encodeURIComponent(targetChit.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullTarget)
    });

    if (!saveResp.ok) throw new Error('Failed to save target chit');

    var actionLabel = mode === 'copy' ? 'Copied' : 'Moved';
    var itemCount = subtree.length;
    var itemLabel = itemCount === 1 ? 'item' : itemCount + ' items';
    cwocToast(actionLabel + ' ' + itemLabel + ' to "' + (targetChit.title || 'Untitled') + '"', 'success');

  } catch (err) {
    console.error('Error sending checklist item:', err);
    cwocToast('Failed to send item: ' + err.message, 'error');
  }
}

/* ── Flash arrow on new item add ──────────────────────────────────────────── */

/**
 * Flash a brief arrow indicator at the end of the checklist input
 * to show the item was successfully added.
 */
function _flashChecklistAddArrow() {
  var input = document.querySelector('.checklist-input');
  if (!input) return;

  // Check if arrow already exists
  var existing = input.parentNode.querySelector('.checklist-add-flash');
  if (existing) existing.remove();

  var arrow = document.createElement('span');
  arrow.className = 'checklist-add-flash';
  arrow.textContent = '\u2193';
  input.parentNode.style.position = 'relative';
  input.insertAdjacentElement('afterend', arrow);

  // Animate and remove
  requestAnimationFrame(function() {
    arrow.classList.add('checklist-add-flash-show');
    setTimeout(function() {
      arrow.classList.add('checklist-add-flash-hide');
      setTimeout(function() { arrow.remove(); }, 300);
    }, 600);
  });
}
