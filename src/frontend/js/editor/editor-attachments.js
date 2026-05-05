/**
 * editor-attachments.js — Attachments zone: upload, list, download, delete
 *
 * Handles the Attachments zone in the chit editor: populating from chit data,
 * file upload via drag-drop or file picker, listing attached files with
 * download/delete actions, and upload progress indication.
 *
 * Attachment operations are staged until the chit is saved:
 *   - Uploads go to the server immediately (files need storage) but are tracked
 *     as "pending" and rolled back if the user exits without saving.
 *   - Deletes are local-only until save — the server file remains until commit.
 *
 * Depends on: shared-utils.js (cwocToast, cwocConfirm),
 *             editor-save.js (setSaveButtonUnsaved)
 * Loaded before: editor-save.js, editor-init.js
 */

/** Current attachments list (parsed from chit.attachments JSON) */
var _attachmentsData = [];

/** IDs of attachments uploaded this session (rolled back on exit without save) */
var _pendingUploads = [];

/** IDs of attachments marked for deletion (committed on save) */
var _pendingDeletes = [];

/**
 * Initialize the attachments zone from chit data.
 * @param {Object} chit — the loaded chit object
 */
function initAttachmentsZone(chit) {
  _attachmentsData = [];
  _pendingUploads = [];
  _pendingDeletes = [];

  if (chit.attachments) {
    var parsed = chit.attachments;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (e) { parsed = []; }
    }
    if (Array.isArray(parsed)) {
      _attachmentsData = parsed;
    }
  }

  _renderAttachmentsList();
  _updateAttachmentCount();
  _wireAttachmentUpload();
}

/**
 * Return current attachments data for save.
 * @returns {string|null} JSON string of attachments array, or null if empty
 */
function getAttachmentsData() {
  if (_attachmentsData.length === 0) return null;
  return JSON.stringify(_attachmentsData);
}

/**
 * Commit pending attachment operations on chit save.
 * - Deletes pending-delete files from the server
 * - Clears pending tracking arrays
 * Called by the save flow after successful chit PUT.
 */
async function commitAttachmentChanges() {
  var chitId = window.currentChitId;
  if (!chitId) return;

  // Delete files that were marked for removal
  for (var i = 0; i < _pendingDeletes.length; i++) {
    try {
      await fetch(
        '/api/chits/' + encodeURIComponent(chitId) + '/attachments/' + encodeURIComponent(_pendingDeletes[i]),
        { method: 'DELETE' }
      );
    } catch (err) {
      console.error('[Attachments] Failed to commit delete for', _pendingDeletes[i], err);
    }
  }

  // Clear pending state — uploads are now permanent, deletes are committed
  _pendingUploads = [];
  _pendingDeletes = [];
}

/**
 * Roll back pending uploads on exit without save.
 * Deletes any files that were uploaded this session but not saved.
 * Called by cancelOrExit when the user discards changes.
 */
async function rollbackAttachmentChanges() {
  var chitId = window.currentChitId;
  if (!chitId || _pendingUploads.length === 0) return;

  for (var i = 0; i < _pendingUploads.length; i++) {
    try {
      await fetch(
        '/api/chits/' + encodeURIComponent(chitId) + '/attachments/' + encodeURIComponent(_pendingUploads[i]),
        { method: 'DELETE' }
      );
    } catch (err) {
      console.error('[Attachments] Failed to rollback upload for', _pendingUploads[i], err);
    }
  }

  _pendingUploads = [];
  _pendingDeletes = [];
}

/**
 * Check if a chit has attachment data (used by applyZoneStates).
 * @param {Object} chit — the chit object
 * @returns {boolean}
 */
function hasAttachmentData(chit) {
  if (!chit.attachments) return false;
  var parsed = chit.attachments;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch (e) { return false; }
  }
  return Array.isArray(parsed) && parsed.length > 0;
}

/** Update the attachment count badge in the zone header */
function _updateAttachmentCount() {
  var countEl = document.getElementById('attachmentCount');
  if (countEl) countEl.textContent = _attachmentsData.length;
}

/** Render the list of attached files */
function _renderAttachmentsList() {
  var list = document.getElementById('attachmentsList');
  if (!list) return;
  list.innerHTML = '';

  if (_attachmentsData.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'attachment-empty';
    empty.textContent = 'No attachments yet.';
    list.appendChild(empty);
    return;
  }

  _attachmentsData.forEach(function(att) {
    var item = document.createElement('div');
    item.className = 'attachment-item';
    item.dataset.attachmentId = att.id;

    var icon = document.createElement('span');
    icon.className = 'attachment-icon';
    // Show thumbnail for images, emoji icon for other types
    if (att.mime_type && att.mime_type.startsWith('image/') && window.currentChitId) {
      var thumb = document.createElement('img');
      thumb.className = 'attachment-thumbnail';
      thumb.src = '/api/chits/' + encodeURIComponent(window.currentChitId) + '/attachments/' + encodeURIComponent(att.id);
      thumb.alt = att.filename;
      thumb.loading = 'lazy';
      thumb.onerror = function() { this.style.display = 'none'; icon.textContent = '🖼️'; };
      icon.appendChild(thumb);
    } else {
      icon.textContent = _getFileIcon(att.mime_type);
    }
    item.appendChild(icon);

    var info = document.createElement('div');
    info.className = 'attachment-info';

    var name = document.createElement('span');
    name.className = 'attachment-name';
    name.textContent = att.filename;
    info.appendChild(name);

    var size = document.createElement('span');
    size.className = 'attachment-size';
    size.textContent = _formatFileSize(att.size);
    info.appendChild(size);

    item.appendChild(info);

    var actions = document.createElement('div');
    actions.className = 'attachment-actions';

    var dlBtn = document.createElement('a');
    dlBtn.className = 'attachment-btn attachment-download';
    dlBtn.href = '/api/chits/' + encodeURIComponent(window.currentChitId) + '/attachments/' + encodeURIComponent(att.id);
    dlBtn.target = '_blank';
    dlBtn.title = 'Download';
    dlBtn.innerHTML = '<i class="fas fa-download"></i>';
    actions.appendChild(dlBtn);

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'attachment-btn attachment-delete';
    delBtn.title = 'Delete';
    delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    delBtn.addEventListener('click', function() {
      _deleteAttachment(att.id, att.filename);
    });
    actions.appendChild(delBtn);

    item.appendChild(actions);
    list.appendChild(item);
  });
}

/** Wire up the file upload area (button + drag-drop) */
function _wireAttachmentUpload() {
  var uploadArea = document.getElementById('attachmentUpload');
  var fileInput = document.getElementById('attachmentFileInput');
  var zoneHeader = document.querySelector('#attachmentsSection > .zone-header');
  if (!uploadArea || !fileInput) return;

  // Prevent double-wiring
  if (uploadArea._wired) return;
  uploadArea._wired = true;

  // File input change
  fileInput.addEventListener('change', function() {
    if (fileInput.files && fileInput.files.length > 0) {
      _uploadFiles(fileInput.files);
      fileInput.value = ''; // reset for re-upload of same file
    }
  });

  // Drag-drop events on upload area
  uploadArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('attachment-drag-over');
  });

  uploadArea.addEventListener('dragleave', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('attachment-drag-over');
  });

  uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('attachment-drag-over');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      _uploadFiles(e.dataTransfer.files);
    }
  });

  // Also wire drag-drop on the zone header so dropping on the collapsed header works
  if (zoneHeader) {
    zoneHeader.addEventListener('dragover', function(e) {
      if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      zoneHeader.style.outline = '2px dashed #008080';
      zoneHeader.style.outlineOffset = '-2px';
    });

    zoneHeader.addEventListener('dragleave', function(e) {
      e.preventDefault();
      e.stopPropagation();
      zoneHeader.style.outline = '';
      zoneHeader.style.outlineOffset = '';
    });

    zoneHeader.addEventListener('drop', function(e) {
      if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      zoneHeader.style.outline = '';
      zoneHeader.style.outlineOffset = '';
      // Auto-expand the zone if collapsed
      var content = document.getElementById('attachmentsContent');
      if (content && content.style.display === 'none') {
        content.style.display = '';
        var icon = zoneHeader.querySelector('.zone-toggle-icon');
        if (icon) icon.textContent = '🔼';
      }
      _uploadFiles(e.dataTransfer.files);
    });
  }
}

/**
 * Upload one or more files to the current chit (staged — rolled back on cancel).
 * @param {FileList} files — the files to upload
 */
async function _uploadFiles(files) {
  var chitId = window.currentChitId;
  if (!chitId) {
    if (typeof cwocToast === 'function') cwocToast('Save the chit first before uploading attachments.', 'error');
    return;
  }

  // Check if chit exists on server (new chits need to be saved first)
  if (window.isNewChit) {
    if (typeof cwocToast === 'function') cwocToast('Save the chit first before uploading attachments.', 'error');
    return;
  }

  var progressEl = _showUploadProgress();

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    try {
      if (progressEl) progressEl.textContent = 'Uploading ' + file.name + '...';

      var formData = new FormData();
      formData.append('file', file);

      var resp = await fetch('/api/chits/' + encodeURIComponent(chitId) + '/attachments', {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        var errData;
        try { errData = await resp.json(); } catch (e) { errData = { detail: await resp.text() }; }
        var errMsg = errData.detail || 'Upload failed';
        if (typeof cwocToast === 'function') cwocToast(errMsg, 'error');
        continue;
      }

      var result = await resp.json();
      var newAtt = {
        id: result.id,
        filename: result.filename,
        size: result.size,
        mime_type: result.mime_type,
        uploaded_at: new Date().toISOString(),
      };
      _attachmentsData.push(newAtt);
      _pendingUploads.push(result.id);

    } catch (err) {
      console.error('[Attachments] Upload error:', err);
      if (typeof cwocToast === 'function') cwocToast('Failed to upload ' + file.name, 'error');
    }
  }

  _hideUploadProgress();
  _renderAttachmentsList();
  _updateAttachmentCount();

  // Mark editor as having unsaved changes so save buttons appear
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();

  if (typeof cwocToast === 'function' && files.length > 0) {
    cwocToast(files.length + ' file(s) uploaded', 'success');
  }
}

/**
 * Mark an attachment for deletion (staged — committed on save).
 * Does NOT delete from the server until the chit is saved.
 * @param {string} attachmentId
 * @param {string} filename
 */
async function _deleteAttachment(attachmentId, filename) {
  // Confirm deletion
  var confirmed = false;
  if (typeof cwocConfirm === 'function') {
    confirmed = await cwocConfirm('Delete attachment "' + filename + '"?', {
      title: 'Delete Attachment',
      confirmLabel: '🗑️ Delete',
      danger: true,
    });
  } else {
    confirmed = confirm('Delete attachment "' + filename + '"?');
  }
  if (!confirmed) return;

  // If this was a pending upload (uploaded this session), we can delete it immediately
  // since it was never part of the saved state
  var wasPendingUpload = _pendingUploads.indexOf(attachmentId) !== -1;
  if (wasPendingUpload) {
    // Remove from pending uploads and delete from server immediately
    _pendingUploads = _pendingUploads.filter(function(id) { return id !== attachmentId; });
    var chitId = window.currentChitId;
    if (chitId) {
      try {
        await fetch(
          '/api/chits/' + encodeURIComponent(chitId) + '/attachments/' + encodeURIComponent(attachmentId),
          { method: 'DELETE' }
        );
      } catch (err) {
        console.error('[Attachments] Failed to delete pending upload:', err);
      }
    }
  } else {
    // Mark for deletion on save — file stays on server until then
    _pendingDeletes.push(attachmentId);
  }

  // Remove from local display data
  _attachmentsData = _attachmentsData.filter(function(a) { return a.id !== attachmentId; });
  _renderAttachmentsList();
  _updateAttachmentCount();

  // Mark editor as having unsaved changes
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();

  if (typeof cwocToast === 'function') cwocToast('Attachment removed', 'success');
}

/** Show upload progress indicator */
function _showUploadProgress() {
  var existing = document.getElementById('attachmentProgress');
  if (existing) existing.remove();

  var uploadArea = document.getElementById('attachmentUpload');
  if (!uploadArea) return null;

  var progress = document.createElement('div');
  progress.id = 'attachmentProgress';
  progress.className = 'attachment-progress';
  progress.textContent = 'Uploading...';
  uploadArea.parentNode.insertBefore(progress, uploadArea);
  return progress;
}

/** Hide upload progress indicator */
function _hideUploadProgress() {
  var progress = document.getElementById('attachmentProgress');
  if (progress) progress.remove();
}

/** Get a file icon emoji based on MIME type */
function _getFileIcon(mimeType) {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive')) return '📦';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('text')) return '📝';
  return '📄';
}

/** Format file size in human-readable form */
function _formatFileSize(bytes) {
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
