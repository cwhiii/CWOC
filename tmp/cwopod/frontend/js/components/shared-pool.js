/**
 * Shared Pool UI Component — renders the shared image pool with distinct background,
 * inline label rename, upload with XHR progress, and thumbnail display.
 * 
 * The Shared Pool persists at the user level across all book projects.
 * Uses POST /api/user/shared-images/upload for uploads (user-level, not project-level).
 * 
 * Exports: SharedPool class
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.6
 */

import { escapeHtml } from '../dom.js';

/**
 * SharedPool manages the rendering and interaction of the shared image pool section.
 */
export class SharedPool {
    /**
     * @param {object} options
     * @param {jQuery} options.$container - The container element for the shared pool section
     * @param {Function} options.getImages - Returns current shared pool images array
     * @param {Function} options.onImageSelect - Callback when an image is selected (uuid)
     * @param {Function} options.onLabelRename - Callback when a label is renamed (uuid, newLabel)
     * @param {Function} options.onImageUploaded - Callback when upload completes (newImageDTO)
     * @param {string|null} options.selectedUuid - Currently selected image UUID
     * @param {string} options.projectId - Current project ID (for thumbnail URLs)
     */
    constructor(options) {
        this.$container = options.$container;
        this.getImages = options.getImages;
        this.onImageSelect = options.onImageSelect;
        this.onLabelRename = options.onLabelRename;
        this.onImageUploaded = options.onImageUploaded;
        this.selectedUuid = options.selectedUuid || null;
        this.projectId = options.projectId;
        this._editingUuid = null; // UUID of image currently being label-edited
        this._uploadInProgress = false;
        this._uploadPercent = 0;

        console.log('[SharedPool] Constructor called, projectId:', this.projectId);
    }

    /**
     * Update the selected UUID and re-render.
     * @param {string|null} uuid
     */
    setSelectedUuid(uuid) {
        console.log('[SharedPool] setSelectedUuid:', uuid);
        this.selectedUuid = uuid;
        this.render();
    }

    /**
     * Render the full shared pool section into the container.
     */
    render() {
        const images = this.getImages();
        console.log('[SharedPool] render() — images count:', images.length, 'selectedUuid:', this.selectedUuid);

        let thumbnailsHtml = '';
        if (images.length === 0) {
            thumbnailsHtml = '<p class="pool-empty">No shared images</p>';
        } else {
            for (const img of images) {
                thumbnailsHtml += this._renderThumbnail(img);
            }
        }

        const uploadProgressHtml = this._uploadInProgress
            ? `<div class="shared-pool-upload-progress">
                   <div class="upload-progress-bar">
                       <div class="upload-progress-fill" style="width: ${this._uploadPercent}%"></div>
                   </div>
                   <span class="upload-progress-text">${this._uploadPercent}%</span>
               </div>`
            : '';

        const html = `
            <div class="pool-section shared-pool-section" id="pool-shared">
                <div class="shared-pool-header">
                    <h3>Shared Pool</h3>
                    <label class="btn btn-sm secondary shared-pool-upload-btn" title="Upload image to shared pool">
                        📤 Upload
                        <input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                               class="shared-pool-file-input" style="display:none" />
                    </label>
                </div>
                <p class="pool-hint">Images shared across all your books</p>
                ${uploadProgressHtml}
                <div class="pool-thumbnails shared-pool-thumbnails" id="shared-thumbnails">
                    ${thumbnailsHtml}
                </div>
            </div>
        `;

        this.$container.html(html);
        this._bindEvents();
        console.log('[SharedPool] render() complete, events bound');
    }

    /**
     * Render a single thumbnail element.
     * @param {object} img - Illustration DTO
     * @returns {string} HTML string
     */
    _renderThumbnail(img) {
        const isSelected = img.image_uuid === this.selectedUuid;
        const isEditing = img.image_uuid === this._editingUuid;

        // For shared pool images, use the shared-images thumb endpoint
        const thumbUrl = `/api/user/shared-images/${img.image_uuid}/thumb`;

        const labelHtml = isEditing
            ? `<input type="text" class="thumb-label-input" data-uuid="${escapeHtml(img.image_uuid)}"
                      value="${escapeHtml(img.label)}" autocomplete="off" />`
            : `<span class="thumb-label thumb-label-editable" data-uuid="${escapeHtml(img.image_uuid)}"
                     title="Click to rename: ${escapeHtml(img.label)}">${escapeHtml(img.label)}</span>`;

        return `
            <div class="pool-thumbnail shared-bg ${isSelected ? 'selected' : ''}"
                 data-uuid="${escapeHtml(img.image_uuid)}" data-pool="shared">
                <div class="thumb-image-wrap">
                    <img src="${thumbUrl}"
                         alt="${escapeHtml(img.label)}"
                         draggable="false"
                         onerror="this.onerror=null; this.style.display='none'; this.parentElement.classList.add('thumb-error');" />
                    <span class="thumb-placeholder" title="Image preview">🖼️</span>
                </div>
                <div class="thumb-meta">
                    ${labelHtml}
                </div>
            </div>
        `;
    }

    /**
     * Bind all event handlers for the shared pool section.
     */
    _bindEvents() {
        const self = this;
        const $section = this.$container;

        // Click on thumbnail to select (but not on the label input)
        $section.find('.pool-thumbnail').on('click', function (e) {
            // Don't select if clicking on the label input or editable label
            if ($(e.target).hasClass('thumb-label-input')) return;

            const uuid = $(this).data('uuid');
            console.log('[SharedPool] Thumbnail clicked, uuid:', uuid);
            self.onImageSelect(uuid);
        });

        // Double-click on label to start editing
        $section.find('.thumb-label-editable').on('click', function (e) {
            e.stopPropagation();
            const uuid = $(this).data('uuid');
            console.log('[SharedPool] Label clicked for inline edit, uuid:', uuid);
            self._startLabelEdit(uuid);
        });

        // Label input: save on blur or Enter
        $section.find('.thumb-label-input').on('blur', function () {
            const uuid = $(this).data('uuid');
            const newLabel = $(this).val().trim();
            console.log('[SharedPool] Label input blur, uuid:', uuid, 'newLabel:', newLabel);
            self._finishLabelEdit(uuid, newLabel);
        }).on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const uuid = $(this).data('uuid');
                const newLabel = $(this).val().trim();
                console.log('[SharedPool] Label input Enter pressed, uuid:', uuid, 'newLabel:', newLabel);
                self._finishLabelEdit(uuid, newLabel);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                console.log('[SharedPool] Label input Escape pressed, cancelling edit');
                self._editingUuid = null;
                self.render();
            }
        }).on('click', function (e) {
            // Prevent thumbnail selection when clicking inside the input
            e.stopPropagation();
        });

        // Auto-focus the label input if one is active
        if (this._editingUuid) {
            const $input = $section.find('.thumb-label-input');
            if ($input.length) {
                $input.focus().select();
                console.log('[SharedPool] Auto-focused label input for uuid:', this._editingUuid);
            }
        }

        // Upload button file input change
        $section.find('.shared-pool-file-input').on('change', function () {
            const file = this.files[0];
            if (file) {
                console.log('[SharedPool] File selected for upload:', file.name, 'type:', file.type, 'size:', file.size);
                self._handleUpload(file);
            }
            // Reset input so same file can be re-selected
            $(this).val('');
        });

        console.log('[SharedPool] _bindEvents() complete');
    }

    /**
     * Start inline label editing for an image.
     * @param {string} uuid
     */
    _startLabelEdit(uuid) {
        console.log('[SharedPool] _startLabelEdit, uuid:', uuid);
        this._editingUuid = uuid;
        this.render();
    }

    /**
     * Finish inline label editing — save the new label.
     * @param {string} uuid
     * @param {string} newLabel
     */
    _finishLabelEdit(uuid, newLabel) {
        console.log('[SharedPool] _finishLabelEdit, uuid:', uuid, 'newLabel:', newLabel);
        this._editingUuid = null;

        if (!newLabel) {
            console.log('[SharedPool] Empty label, reverting to original');
            this.render();
            return;
        }

        // Find the image and check if label actually changed
        const images = this.getImages();
        const img = images.find(i => i.image_uuid === uuid);
        if (!img) {
            console.warn('[SharedPool] _finishLabelEdit — image not found:', uuid);
            this.render();
            return;
        }

        if (img.label === newLabel) {
            console.log('[SharedPool] Label unchanged, no action needed');
            this.render();
            return;
        }

        console.log('[SharedPool] Label changed from:', img.label, 'to:', newLabel, '— calling onLabelRename');
        this.onLabelRename(uuid, newLabel);
        this.render();
    }

    /**
     * Handle file upload to the shared pool via XHR with real progress events.
     * Uses POST /api/user/shared-images/upload
     * @param {File} file
     */
    _handleUpload(file) {
        console.log('[SharedPool] _handleUpload starting, file:', file.name, 'type:', file.type, 'size:', file.size);

        // Validate file type client-side
        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            console.error('[SharedPool] Upload rejected — invalid file type:', file.type);
            alert('Only PNG, JPG, and WEBP files are accepted.');
            return;
        }

        this._uploadInProgress = true;
        this._uploadPercent = 0;
        this.render();

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        const self = this;

        // Real upload progress via XHR progress events
        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                console.log('[SharedPool] Upload progress:', percent, '% (loaded:', e.loaded, '/ total:', e.total, ')');
                self._uploadPercent = percent;
                // Update progress bar in-place without full re-render to avoid losing state
                self.$container.find('.upload-progress-fill').css('width', percent + '%');
                self.$container.find('.upload-progress-text').text(percent + '%');
            }
        };

        xhr.onload = function () {
            console.log('[SharedPool] Upload XHR onload, status:', xhr.status, 'response:', xhr.responseText.substring(0, 300));
            self._uploadInProgress = false;
            self._uploadPercent = 0;

            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    console.log('[SharedPool] Upload successful, new image:', result);
                    self.onImageUploaded(result);
                    self.render();
                } catch (parseErr) {
                    console.error('[SharedPool] Upload response parse error:', parseErr.message, 'raw:', xhr.responseText);
                    alert('Upload succeeded but response was invalid.');
                    self.render();
                }
            } else {
                console.error('[SharedPool] Upload failed, status:', xhr.status, 'response:', xhr.responseText);
                let errorMsg = 'Upload failed';
                try {
                    const errData = JSON.parse(xhr.responseText);
                    errorMsg = errData.detail || errData.message || errorMsg;
                    if (errData.traceback) {
                        console.error('[SharedPool] Server traceback:', errData.traceback);
                    }
                } catch (e) {
                    errorMsg = xhr.responseText || errorMsg;
                }
                alert('Upload failed: ' + errorMsg);
                self.render();
            }
        };

        xhr.onerror = function () {
            console.error('[SharedPool] Upload XHR network error');
            self._uploadInProgress = false;
            self._uploadPercent = 0;
            alert('Upload failed — network error. Please try again.');
            self.render();
        };

        xhr.onabort = function () {
            console.warn('[SharedPool] Upload XHR aborted');
            self._uploadInProgress = false;
            self._uploadPercent = 0;
            self.render();
        };

        const uploadUrl = '/api/user/shared-images/upload';
        console.log('[SharedPool] Opening XHR POST to:', uploadUrl);
        xhr.open('POST', uploadUrl, true);
        xhr.withCredentials = true;
        xhr.send(formData);
        console.log('[SharedPool] XHR send() called, waiting for progress/completion');
    }
}
