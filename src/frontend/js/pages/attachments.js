/**
 * attachments.js — All Attachments grid page
 *
 * Displays every attachment across all chits in a visual grid.
 * Features:
 *   - Click card → preview modal with full details
 *   - Ctrl/Cmd+click → toggle selection
 *   - Shift+click → range selection
 *   - Checkbox click → toggle selection
 *   - Bulk delete when 1+ selected
 *   - Filter by type, size range, filename search
 *   - Sort by uploaded date, name, size
 *
 * Depends on: shared-utils.js (cwocConfirm, cwocToast), shared-page.js
 */

(function() {
  'use strict';

  var _allAttachments = [];   // Raw data from API
  var _filtered = [];         // After filter/sort applied (indices into _allAttachments)
  var _selectedSet = new Set(); // Selected indices (into _filtered)
  var _lastClickedIndex = -1;

  // ═══════════════════════════════════════════════════════════════════════
  // Init
  // ═══════════════════════════════════════════════════════════════════════

  function init() {
    document.getElementById('bulk-delete-btn').addEventListener('click', bulkDelete);

    // Wire filter/sort controls
    document.getElementById('att-filter-type').addEventListener('change', applyFilters);
    document.getElementById('att-filter-size-min').addEventListener('input', applyFilters);
    document.getElementById('att-filter-size-max').addEventListener('input', applyFilters);
    document.getElementById('att-sort').addEventListener('change', applyFilters);
    document.getElementById('att-search').addEventListener('input', applyFilters);

    loadAttachments();
  }

  // Wait for auth then init
  if (typeof waitForAuth === 'function') {
    waitForAuth().then(init);
  } else {
    init();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Data Loading
  // ═══════════════════════════════════════════════════════════════════════

  async function loadAttachments() {
    var wrap = document.getElementById('att-grid-wrap');
    var countEl = document.getElementById('att-count');
    _selectedSet.clear();
    _lastClickedIndex = -1;
    updateSelectionUI();

    try {
      var resp = await fetch('/api/attachments');
      if (!resp.ok) {
        wrap.innerHTML = '<div class="att-empty">Failed to load attachments.</div>';
        return;
      }
      _allAttachments = await resp.json();
      countEl.textContent = _allAttachments.length + ' attachment' + (_allAttachments.length !== 1 ? 's' : '');

      if (_allAttachments.length === 0) {
        wrap.innerHTML = '<div class="att-empty">No attachments found.</div>';
        return;
      }

      applyFilters();
    } catch (e) {
      console.error('[Attachments] Load error:', e);
      wrap.innerHTML = '<div class="att-empty">Error loading attachments.</div>';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Filtering & Sorting
  // ═══════════════════════════════════════════════════════════════════════

  function applyFilters() {
    var typeFilter = document.getElementById('att-filter-type').value;
    var sizeMinMb = parseFloat(document.getElementById('att-filter-size-min').value);
    var sizeMaxMb = parseFloat(document.getElementById('att-filter-size-max').value);
    var sortVal = document.getElementById('att-sort').value;
    var searchVal = (document.getElementById('att-search').value || '').toLowerCase().trim();

    // Convert MB to bytes for comparison
    var sizeMinBytes = isNaN(sizeMinMb) ? -1 : sizeMinMb * 1048576;
    var sizeMaxBytes = isNaN(sizeMaxMb) ? -1 : sizeMaxMb * 1048576;

    // Filter
    _filtered = [];
    for (var i = 0; i < _allAttachments.length; i++) {
      var att = _allAttachments[i];

      // Type filter
      if (typeFilter !== 'all') {
        var cat = getTypeCategory(att.mime_type);
        if (cat !== typeFilter) continue;
      }

      // Size filter (min/max in MB)
      var sz = att.size || 0;
      if (sizeMinBytes >= 0 && sz < sizeMinBytes) continue;
      if (sizeMaxBytes >= 0 && sz > sizeMaxBytes) continue;

      // Search filter
      if (searchVal && att.filename.toLowerCase().indexOf(searchVal) === -1) continue;

      _filtered.push(i);
    }

    // Sort
    _filtered.sort(function(a, b) {
      var attA = _allAttachments[a];
      var attB = _allAttachments[b];

      switch (sortVal) {
        case 'uploaded_desc':
          return (attB.uploaded_at || '').localeCompare(attA.uploaded_at || '');
        case 'uploaded_asc':
          return (attA.uploaded_at || '').localeCompare(attB.uploaded_at || '');
        case 'name_asc':
          return (attA.filename || '').toLowerCase().localeCompare((attB.filename || '').toLowerCase());
        case 'name_desc':
          return (attB.filename || '').toLowerCase().localeCompare((attA.filename || '').toLowerCase());
        case 'size_desc':
          return (attB.size || 0) - (attA.size || 0);
        case 'size_asc':
          return (attA.size || 0) - (attB.size || 0);
        default:
          return 0;
      }
    });

    // Reset selection
    _selectedSet.clear();
    _lastClickedIndex = -1;
    updateSelectionUI();

    // Render
    var wrap = document.getElementById('att-grid-wrap');
    if (_filtered.length === 0) {
      wrap.innerHTML = '<div class="att-empty">No attachments match the current filters.</div>';
    } else {
      renderGrid(wrap);
    }
  }

  function getTypeCategory(mimeType) {
    if (!mimeType) return 'other';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.indexOf('pdf') !== -1 || mimeType.indexOf('document') !== -1 ||
        mimeType.indexOf('word') !== -1 || mimeType.indexOf('text') !== -1 ||
        mimeType.indexOf('spreadsheet') !== -1 || mimeType.indexOf('excel') !== -1 ||
        mimeType.indexOf('csv') !== -1 || mimeType.indexOf('presentation') !== -1 ||
        mimeType.indexOf('powerpoint') !== -1) return 'document';
    if (mimeType.indexOf('zip') !== -1 || mimeType.indexOf('compressed') !== -1 ||
        mimeType.indexOf('archive') !== -1 || mimeType.indexOf('tar') !== -1 ||
        mimeType.indexOf('gzip') !== -1) return 'archive';
    return 'other';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Rendering
  // ═══════════════════════════════════════════════════════════════════════

  function renderGrid(wrap) {
    var grid = document.createElement('div');
    grid.className = 'attachments-grid';

    _filtered.forEach(function(origIdx, filteredIdx) {
      var att = _allAttachments[origIdx];
      var card = document.createElement('div');
      card.className = 'att-card';
      card.dataset.filteredIndex = filteredIdx;
      if (_selectedSet.has(filteredIdx)) card.classList.add('selected');

      // Checkbox
      var check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'att-check';
      check.checked = _selectedSet.has(filteredIdx);
      check.addEventListener('click', function(e) { e.stopPropagation(); });
      check.addEventListener('change', function(e) {
        handleSelect(filteredIdx, e, true);
      });
      card.appendChild(check);

      // Thumbnail / icon
      var thumb = document.createElement('div');
      thumb.className = 'att-thumb';
      if (att.mime_type && att.mime_type.startsWith('image/')) {
        var img = document.createElement('img');
        img.src = '/api/chits/' + encodeURIComponent(att.chit_id) + '/attachments/' + encodeURIComponent(att.id);
        img.alt = att.filename;
        img.loading = 'lazy';
        img.onerror = function() { this.style.display = 'none'; thumb.innerHTML = '<span class="att-icon">🖼️</span>'; };
        thumb.appendChild(img);
      } else {
        var iconSpan = document.createElement('span');
        iconSpan.className = 'att-icon';
        iconSpan.textContent = getFileIcon(att.mime_type);
        thumb.appendChild(iconSpan);
      }
      card.appendChild(thumb);

      // Filename
      var fnDiv = document.createElement('div');
      fnDiv.className = 'att-filename';
      fnDiv.title = att.filename;
      fnDiv.textContent = att.filename;
      card.appendChild(fnDiv);

      // File size
      var sizeDiv = document.createElement('div');
      sizeDiv.className = 'att-size';
      sizeDiv.textContent = formatFileSize(att.size);
      card.appendChild(sizeDiv);

      // Chit name (clickable — opens the chit editor)
      var chitDiv = document.createElement('div');
      chitDiv.className = 'att-chit';
      chitDiv.title = att.chit_title;
      var chitLink = document.createElement('a');
      chitLink.href = '/frontend/html/editor.html?id=' + encodeURIComponent(att.chit_id);
      chitLink.textContent = att.chit_title;
      chitLink.addEventListener('click', function(e) { e.stopPropagation(); });
      chitDiv.appendChild(chitLink);
      card.appendChild(chitDiv);

      // Card click behavior
      card.addEventListener('click', function(e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          // Multi-select
          handleSelect(filteredIdx, e, false);
        } else {
          // Plain click → open preview modal
          openPreviewModal(att);
        }
      });

      grid.appendChild(card);
    });

    wrap.innerHTML = '';
    wrap.appendChild(grid);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Preview Modal
  // ═══════════════════════════════════════════════════════════════════════

  function openPreviewModal(att) {
    // Remove existing modal if any
    var existing = document.getElementById('att-preview-modal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'att-preview-modal';
    overlay.className = 'att-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'att-modal';

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.className = 'att-modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', function() { overlay.remove(); });
    modal.appendChild(closeBtn);

    // Preview area
    var preview = document.createElement('div');
    preview.className = 'att-modal-preview';
    var downloadUrl = '/api/chits/' + encodeURIComponent(att.chit_id) + '/attachments/' + encodeURIComponent(att.id);

    if (att.mime_type && att.mime_type.startsWith('image/')) {
      var img = document.createElement('img');
      img.src = downloadUrl;
      img.alt = att.filename;
      img.onerror = function() { preview.innerHTML = '<span class="att-modal-icon">🖼️</span>'; };
      preview.appendChild(img);
    } else if (att.mime_type && att.mime_type.startsWith('video/')) {
      var video = document.createElement('video');
      video.src = downloadUrl;
      video.controls = true;
      video.style.maxWidth = '100%';
      video.style.maxHeight = '50vh';
      preview.appendChild(video);
    } else if (att.mime_type && att.mime_type.startsWith('audio/')) {
      var audio = document.createElement('audio');
      audio.src = downloadUrl;
      audio.controls = true;
      audio.style.width = '100%';
      preview.appendChild(audio);
    } else {
      var iconEl = document.createElement('span');
      iconEl.className = 'att-modal-icon';
      iconEl.textContent = getFileIcon(att.mime_type);
      preview.appendChild(iconEl);
    }
    modal.appendChild(preview);

    // Details
    var details = document.createElement('dl');
    details.className = 'att-modal-details';

    addDetail(details, 'Filename', att.filename);
    addDetail(details, 'Size', formatFileSize(att.size));
    addDetail(details, 'Type', att.mime_type || 'Unknown');
    addDetail(details, 'Uploaded', formatDate(att.uploaded_at));
    addDetail(details, 'Chit', att.chit_title);

    modal.appendChild(details);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'att-modal-actions';

    var dlBtn = document.createElement('a');
    dlBtn.className = 'standard-button';
    dlBtn.href = downloadUrl;
    dlBtn.target = '_blank';
    dlBtn.textContent = '⬇️ Download';
    dlBtn.style.textDecoration = 'none';
    actions.appendChild(dlBtn);

    var editBtn = document.createElement('a');
    editBtn.className = 'standard-button';
    editBtn.href = '/frontend/html/editor.html?id=' + encodeURIComponent(att.chit_id);
    editBtn.textContent = '✏️ Open Chit';
    editBtn.style.textDecoration = 'none';
    actions.appendChild(editBtn);

    var dismissBtn = document.createElement('button');
    dismissBtn.className = 'standard-button';
    dismissBtn.textContent = 'Close';
    dismissBtn.addEventListener('click', function() { overlay.remove(); });
    actions.appendChild(dismissBtn);

    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Click outside to close
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });

    // ESC to close (capture phase)
    function onEsc(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        overlay.remove();
        document.removeEventListener('keydown', onEsc, true);
      }
    }
    document.addEventListener('keydown', onEsc, true);
  }

  function addDetail(dl, label, value) {
    var dt = document.createElement('dt');
    dt.textContent = label;
    dl.appendChild(dt);
    var dd = document.createElement('dd');
    dd.textContent = value || '—';
    dl.appendChild(dd);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Selection Logic
  // ═══════════════════════════════════════════════════════════════════════

  function handleSelect(filteredIdx, e, fromCheckbox) {
    if (e.shiftKey && _lastClickedIndex >= 0) {
      // Range select
      var start = Math.min(_lastClickedIndex, filteredIdx);
      var end = Math.max(_lastClickedIndex, filteredIdx);
      for (var i = start; i <= end; i++) {
        _selectedSet.add(i);
      }
    } else if (e.ctrlKey || e.metaKey || fromCheckbox) {
      // Toggle single
      if (_selectedSet.has(filteredIdx)) {
        _selectedSet.delete(filteredIdx);
      } else {
        _selectedSet.add(filteredIdx);
      }
    } else {
      // Single select (clear others)
      if (_selectedSet.size === 1 && _selectedSet.has(filteredIdx)) {
        _selectedSet.clear();
      } else {
        _selectedSet.clear();
        _selectedSet.add(filteredIdx);
      }
    }

    _lastClickedIndex = filteredIdx;
    syncSelectionDOM();
    updateSelectionUI();
  }

  function syncSelectionDOM() {
    var cards = document.querySelectorAll('.att-card');
    cards.forEach(function(card) {
      var idx = parseInt(card.dataset.filteredIndex, 10);
      var isSelected = _selectedSet.has(idx);
      card.classList.toggle('selected', isSelected);
      var cb = card.querySelector('.att-check');
      if (cb) cb.checked = isSelected;
    });
  }

  function updateSelectionUI() {
    var count = _selectedSet.size;
    var bulkActions = document.getElementById('bulk-actions');
    var countEl = document.getElementById('selected-count');

    bulkActions.style.display = count > 0 ? 'flex' : 'none';
    countEl.textContent = count > 0 ? count + ' selected' : '';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Bulk Delete
  // ═══════════════════════════════════════════════════════════════════════

  async function bulkDelete() {
    var count = _selectedSet.size;
    if (count === 0) return;

    var confirmed = false;
    if (typeof cwocConfirm === 'function') {
      confirmed = await cwocConfirm(
        'Permanently delete ' + count + ' attachment' + (count !== 1 ? 's' : '') + '? This cannot be undone.',
        { title: 'Delete Attachments', confirmLabel: '🗑️ Delete', danger: true }
      );
    }
    if (!confirmed) return;

    // Build the items array for the bulk delete API
    var items = [];
    _selectedSet.forEach(function(filteredIdx) {
      var origIdx = _filtered[filteredIdx];
      var att = _allAttachments[origIdx];
      if (att) {
        items.push({ chit_id: att.chit_id, attachment_id: att.id });
      }
    });

    try {
      var resp = await fetch('/api/attachments/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });

      if (resp.ok) {
        var result = await resp.json();
        if (typeof cwocToast === 'function') {
          cwocToast(result.deleted + ' attachment' + (result.deleted !== 1 ? 's' : '') + ' deleted', 'success');
        }
      } else {
        if (typeof cwocToast === 'function') cwocToast('Delete failed', 'error');
      }
    } catch (e) {
      console.error('[Attachments] Bulk delete error:', e);
      if (typeof cwocToast === 'function') cwocToast('Delete failed', 'error');
    }

    // Reload
    loadAttachments();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════

  function getFileIcon(mimeType) {
    if (!mimeType) return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.indexOf('pdf') !== -1) return '📕';
    if (mimeType.indexOf('zip') !== -1 || mimeType.indexOf('compressed') !== -1 || mimeType.indexOf('archive') !== -1) return '📦';
    if (mimeType.indexOf('spreadsheet') !== -1 || mimeType.indexOf('excel') !== -1 || mimeType.indexOf('csv') !== -1) return '📊';
    if (mimeType.indexOf('presentation') !== -1 || mimeType.indexOf('powerpoint') !== -1) return '📽️';
    if (mimeType.indexOf('document') !== -1 || mimeType.indexOf('word') !== -1 || mimeType.indexOf('text') !== -1) return '📝';
    return '📄';
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = 0;
    var size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() +
        ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    } catch (e) {
      return '—';
    }
  }

})();
