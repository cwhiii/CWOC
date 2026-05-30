/**
 * Available Pool UI Component
 * 
 * Renders the Available Pool section for the Illustrations step.
 * - Displays project-level unplaced images with distinct backgrounds for extracted vs uploaded
 * - Inline label rename (click-to-edit, saves on blur/Enter)
 * - Upload button accepting PNG/JPG/WEBP via POST /api/projects/{id}/illustrations/upload
 * - Confirmation dialog before deleting extracted images
 * - Verbose logging on all interactions
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { escapeHtml } from '../dom.js';

/**
 * AvailablePool component class.
 * Manages rendering and interactions for the Available Pool section.
 */
export class AvailablePool {
    /**
     * @param {object} options
     * @param {string} options.projectId - The current project ID
     * @param {jQuery} options.$container - The jQuery container element to render into
     * @param {Function} options.getImages - Returns array of available pool images
     * @param {Function} options.onImageSelect - Callback when an image is selected (uuid)
     * @param {Function} options.onImageDelete - Callback when an image is deleted (uuid)
     * @param {Function} options.onImageUploaded - Callback when a new image is uploaded (imageDTO)
     * @param {Function} options.onLabelRenamed - Callback when a label is renamed (uuid, newLabel)
     * @param {string|null} options.selectedImageUuid - Currently selected image UUID
     */
    constructor(options) {
        this.projectId = options.projectId;
        this.$container = options.$container;
        this.getImages = options.getImages;
        this.onImageSelect = options.onImageSelect || (() => {});
        this.onImageDelete = options.onImageDelete || (() => {});
        this.onImageUploaded = options.onImageUploaded || (() => {});
        this.onLabelRenamed = options.onLabelRenamed || (() => {});
        this.selectedImageUuid = options.selectedImageUuid || null;
        this._editingUuid = null; // UUID of image currently being label-edited

        console.log('[AvailablePool] Constructed — projectId:', this.projectId);
    }

    /**
     * Update the selected image UUID and re-render.
     * @param {string|null} uuid
     */
    setSelectedImage(uuid) {
        console.log('[AvailablePool] setSelectedImage:', uuid);
        this.selectedImageUuid = uuid;
        this.render();
    }

    /**
     * Render the full Available Pool section into the container.
     */
    render() {
        const images = this.getImages();
        console.log('[AvailablePool] render() — images count:', images.length);

        const html = `
            <div class="pool-section available-pool-section">
                <div class="pool-header">
                    <h3>Available Pool</h3>
                    <button class="btn btn-sm secondary available-pool-upload-btn" title="Upload image (PNG, JPG, WEBP)">
                        📤 Upload
                    </button>
                </div>
                <p class="pool-hint">Unplaced images for this book. No limit on count.</p>
                <input type="file" class="available-pool-file-input" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" style="display:none;" />
                <div class="available-pool-upload-progress" style="display:none;">
                    <div class="upload-progress-bar"><div class="upload-progress-fill"></div></div>
                    <span class="upload-progress-text">Uploading...</span>
                </div>
                <div class="pool-thumbnails available-pool-thumbnails">
                    ${this._renderThumbnails(images)}
                </div>
            </div>
        `;

        this.$container.html(html);
        this._bindEvents();
    }

    /**
     * Render thumbnail HTML for all images.
     * Extracted images get a distinct background from uploaded images.
     * @param {Array} images
     * @returns {string} HTML
     */
    _renderThumbnails(images) {
        if (images.length === 0) {
            return '<p class="pool-empty">No images in available pool</p>';
        }

        let html = '';
        for (const img of images) {
            const isSelected = img.image_uuid === this.selectedImageUuid;
            const isExtracted = img.source === 'extracted';
            const bgClass = isExtracted ? 'extracted-bg' : 'uploaded-bg';
            const sourceLabel = isExtracted ? 'extracted' : 'uploaded';

            html += `
                <div class="pool-thumbnail available-thumb ${bgClass} ${isSelected ? 'selected' : ''}"
                     data-uuid="${escapeHtml(img.image_uuid)}" 
                     data-source="${escapeHtml(img.source)}">
                    <div class="thumb-image-wrap">
                        <img src="/api/projects/${this.projectId}/illustrations/${img.image_uuid}/thumb" 
                             alt="${escapeHtml(img.label)}" 
                             onerror="this.style.display='none'" />
                        <span class="thumb-source-badge ${bgClass}-badge">${escapeHtml(sourceLabel)}</span>
                    </div>
                    <div class="thumb-meta">
                        <span class="thumb-label available-thumb-label" 
                              data-uuid="${escapeHtml(img.image_uuid)}" 
                              title="Click to rename">${escapeHtml(img.label)}</span>
                    </div>
                    <button class="thumb-delete-btn" data-uuid="${escapeHtml(img.image_uuid)}" data-source="${escapeHtml(img.source)}" title="Delete image">✕</button>
                </div>
            `;
        }
        return html;
    }

    /**
     * Bind all event handlers for the Available Pool section.
     */
    _bindEvents() {
        const self = this;
        const $section = this.$container.find('.available-pool-section');

        // Upload button click → trigger file input
        $section.find('.available-pool-upload-btn').on('click', function () {
            console.log('[AvailablePool] Upload button clicked — opening file picker');
            $section.find('.available-pool-file-input').trigger('click');
        });

        // File input change → upload the file
        $section.find('.available-pool-file-input').on('change', function (e) {
            const file = e.target.files && e.target.files[0];
            if (file) {
                console.log('[AvailablePool] File selected:', file.name, 'type:', file.type, 'size:', file.size);
                self._uploadFile(file);
            }
            // Reset input so same file can be re-selected
            $(this).val('');
        });

        // Thumbnail click → select image
        $section.find('.pool-thumbnail.available-thumb').on('click', function (e) {
            // Don't select if clicking delete button or label
            if ($(e.target).closest('.thumb-delete-btn').length || $(e.target).closest('.available-thumb-label-input').length) {
                return;
            }
            const uuid = $(this).data('uuid');
            console.log('[AvailablePool] Thumbnail clicked — selecting:', uuid);
            self.selectedImageUuid = uuid;
            self.onImageSelect(uuid);
            self.render();
        });

        // Label click → inline rename
        $section.find('.available-thumb-label').on('click', function (e) {
            e.stopPropagation();
            const uuid = $(this).data('uuid');
            console.log('[AvailablePool] Label clicked — starting inline rename for:', uuid);
            self._startInlineRename(uuid, $(this));
        });

        // Delete button click → delete with confirmation for extracted
        $section.find('.thumb-delete-btn').on('click', function (e) {
            e.stopPropagation();
            const uuid = $(this).data('uuid');
            const source = $(this).data('source');
            console.log('[AvailablePool] Delete button clicked — uuid:', uuid, 'source:', source);
            self._handleDelete(uuid, source);
        });
    }

    /**
     * Start inline label rename: replace label span with an input field.
     * Saves on blur or Enter key.
     * @param {string} uuid
     * @param {jQuery} $labelSpan
     */
    _startInlineRename(uuid, $labelSpan) {
        if (this._editingUuid === uuid) {
            console.log('[AvailablePool] Already editing label for:', uuid);
            return;
        }
        this._editingUuid = uuid;

        const images = this.getImages();
        const img = images.find(i => i.image_uuid === uuid);
        if (!img) {
            console.warn('[AvailablePool] _startInlineRename — image not found:', uuid);
            this._editingUuid = null;
            return;
        }

        const currentLabel = img.label;
        console.log('[AvailablePool] _startInlineRename — current label:', currentLabel);

        const $input = $(`<input type="text" class="available-thumb-label-input" value="${escapeHtml(currentLabel)}" />`);
        $labelSpan.replaceWith($input);
        $input.trigger('focus').trigger('select');

        const self = this;

        const commitRename = () => {
            const newLabel = $input.val().trim();
            console.log('[AvailablePool] commitRename — uuid:', uuid, 'newLabel:', newLabel, 'oldLabel:', currentLabel);
            self._editingUuid = null;

            if (newLabel && newLabel !== currentLabel) {
                console.log('[AvailablePool] Label changed — calling onLabelRenamed callback');
                self.onLabelRenamed(uuid, newLabel);
            } else {
                console.log('[AvailablePool] Label unchanged or empty — reverting');
            }
            // Re-render to show updated label (or revert)
            self.render();
        };

        $input.on('blur', commitRename);
        $input.on('keydown', function (e) {
            if (e.key === 'Enter') {
                console.log('[AvailablePool] Enter key pressed during rename');
                e.preventDefault();
                $(this).trigger('blur');
            } else if (e.key === 'Escape') {
                console.log('[AvailablePool] Escape key pressed — cancelling rename');
                self._editingUuid = null;
                self.render();
            }
        });
    }

    /**
     * Handle image deletion. Shows confirmation dialog for extracted images.
     * @param {string} uuid
     * @param {string} source - 'extracted' or 'uploaded'
     */
    _handleDelete(uuid, source) {
        console.log('[AvailablePool] _handleDelete — uuid:', uuid, 'source:', source);

        if (source === 'extracted') {
            // Show confirmation dialog for extracted images
            console.log('[AvailablePool] Extracted image — showing confirmation dialog');
            const confirmed = window.confirm(
                'This image was extracted from the source. Delete permanently?'
            );
            if (!confirmed) {
                console.log('[AvailablePool] Delete cancelled by user for extracted image:', uuid);
                return;
            }
            console.log('[AvailablePool] User confirmed deletion of extracted image:', uuid);
        } else {
            console.log('[AvailablePool] Uploaded image — deleting without confirmation:', uuid);
        }

        this.onImageDelete(uuid);
        this.render();
    }

    /**
     * Upload a file to the Available Pool via XHR with real progress tracking.
     * Uses POST /api/projects/{id}/illustrations/upload
     * @param {File} file
     */
    _uploadFile(file) {
        const self = this;
        const $section = this.$container.find('.available-pool-section');
        const $progress = $section.find('.available-pool-upload-progress');
        const $fill = $progress.find('.upload-progress-fill');
        const $text = $progress.find('.upload-progress-text');

        // Validate file type client-side
        const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            console.error('[AvailablePool] Invalid file type:', file.type, '— only PNG, JPG, WEBP accepted');
            window.alert('Only PNG, JPG, and WEBP files are accepted.');
            return;
        }

        console.log('[AvailablePool] _uploadFile — starting XHR upload for:', file.name, 'type:', file.type, 'size:', file.size);

        // Show progress bar
        $progress.show();
        $fill.css('width', '0%');
        $text.text('Uploading...');

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        const url = `/api/projects/${this.projectId}/illustrations/upload`;

        xhr.open('POST', url, true);
        xhr.withCredentials = true;

        // Real upload progress via xhr.upload.onprogress
        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                console.log('[AvailablePool] Upload progress:', percent + '%', '(' + e.loaded + '/' + e.total + ')');
                $fill.css('width', percent + '%');
                $text.text(`Uploading... ${percent}%`);
            }
        };

        xhr.onload = function () {
            console.log('[AvailablePool] XHR onload — status:', xhr.status);
            $progress.hide();

            if (xhr.status >= 200 && xhr.status < 300) {
                let responseData;
                try {
                    responseData = JSON.parse(xhr.responseText);
                } catch (parseErr) {
                    console.error('[AvailablePool] Failed to parse upload response:', parseErr.message, 'raw:', xhr.responseText);
                    window.alert('Upload succeeded but response was invalid.');
                    return;
                }
                console.log('[AvailablePool] Upload successful — response:', JSON.stringify(responseData));
                self.onImageUploaded(responseData);
                self.render();
            } else {
                console.error('[AvailablePool] Upload failed — status:', xhr.status, 'response:', xhr.responseText);
                let detail = `Upload failed (HTTP ${xhr.status})`;
                try {
                    const errData = JSON.parse(xhr.responseText);
                    detail = errData.detail || detail;
                    if (errData.traceback) {
                        console.error('[AvailablePool] Server traceback:', errData.traceback);
                    }
                } catch (e) {
                    // ignore parse error
                }
                window.alert(detail);
            }
        };

        xhr.onerror = function () {
            console.error('[AvailablePool] XHR network error during upload');
            $progress.hide();
            window.alert('Upload failed — network error. Please try again.');
        };

        xhr.onabort = function () {
            console.warn('[AvailablePool] XHR upload aborted');
            $progress.hide();
        };

        console.log('[AvailablePool] Sending XHR POST to:', url);
        xhr.send(formData);
    }
}
