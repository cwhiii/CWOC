/* ═══════════════════════════════════════════════════════════════════════════
   CWOC People Page — Rolodex Browse View
   
   Fetches contacts from GET /api/contacts, renders a scrollable list with
   search, star toggle, and share buttons. Favorites appear at top.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    let _allContacts = [];   // Full contact list from API
    let _filteredContacts = []; // After client-side search filter

    const listEl = document.getElementById('people-list');
    const searchEl = document.getElementById('people-search');

    // ── Init ────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        loadContacts();
        searchEl.addEventListener('input', _onSearchInput);
    });

    // ── Load contacts from API ──────────────────────────────────────────
    async function loadContacts(query) {
        try {
            let url = '/api/contacts';
            if (query) url += '?q=' + encodeURIComponent(query);
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('Failed to fetch contacts');
            _allContacts = await resp.json();
            _applyFilter();
        } catch (err) {
            console.error('Error loading contacts:', err);
            listEl.innerHTML = '<div class="people-empty">⚠️ Failed to load contacts.</div>';
        }
    }

    // ── Search input handler ────────────────────────────────────────────
    let _searchTimeout = null;
    function _onSearchInput() {
        const q = searchEl.value.trim();
        // Client-side filter first
        _applyFilter();
        // Fallback: if we have a query and few results, also hit the API
        clearTimeout(_searchTimeout);
        if (q.length >= 2) {
            _searchTimeout = setTimeout(() => {
                loadContacts(q);
            }, 300);
        } else if (q.length === 0) {
            _searchTimeout = setTimeout(() => {
                loadContacts();
            }, 300);
        }
    }

    // ── Client-side filter ─────────────────────────────────────────────
    function _applyFilter() {
        const q = (searchEl.value || '').trim().toLowerCase();
        if (!q) {
            _filteredContacts = _allContacts.slice();
        } else {
            _filteredContacts = _allContacts.filter(c => {
                const fields = [
                    c.display_name || '',
                    c.nickname || '',
                    c.organization || '',
                    c.social_context || '',
                    (c.emails || []).map(e => (e.value || '') + ' ' + (e.label || '')).join(' '),
                    (c.phones || []).map(p => (p.value || '') + ' ' + (p.label || '')).join(' '),
                    (c.addresses || []).map(a => (a.value || '')).join(' '),
                    (c.call_signs || []).map(cs => (cs.value || '')).join(' '),
                    (c.x_handles || []).map(x => (x.value || '')).join(' '),
                    (c.websites || []).map(w => (w.value || '')).join(' '),
                ];
                return fields.some(f => f.toLowerCase().includes(q));
            });
        }
        _renderList();
    }

    // ── Render contact list ─────────────────────────────────────────────
    function _renderList() {
        listEl.innerHTML = '';
        const q = (searchEl.value || '').trim();

        if (_filteredContacts.length === 0) {
            listEl.innerHTML = q
                ? '<div class="people-empty">No contacts match your search.</div>'
                : '<div class="people-empty">No contacts yet. Click "New Contact" to add one.</div>';
            return;
        }

        // Table header
        var header = document.createElement('div');
        header.className = 'people-row people-header';
        header.innerHTML = '<span style="width:28px;"></span><span style="width:32px;"></span><span class="contact-info"><span class="contact-name" style="font-weight:bold;font-size:0.8em;opacity:0.7;">Name</span><span class="contact-detail" style="font-weight:bold;opacity:0.7;">Phone · Email · Org</span></span><span style="width:40px;"></span>';
        listEl.appendChild(header);

        // Split into favorites and non-favorites
        const favorites = _filteredContacts.filter(c => c.favorite);
        const others = _filteredContacts.filter(c => !c.favorite);

        const sortFn = (a, b) => (a.display_name || '').localeCompare(b.display_name || '', undefined, { sensitivity: 'base' });
        favorites.sort(sortFn);
        others.sort(sortFn);

        if (favorites.length > 0) {
            const divider = document.createElement('div');
            divider.className = 'people-divider';
            divider.textContent = '★ Favorites';
            listEl.appendChild(divider);
            favorites.forEach(c => listEl.appendChild(_createRow(c, q)));
        }

        if (others.length > 0) {
            if (favorites.length > 0) {
                const divider = document.createElement('div');
                divider.className = 'people-divider';
                divider.textContent = 'All Contacts';
                listEl.appendChild(divider);
            }
            others.forEach(c => listEl.appendChild(_createRow(c, q)));
        }
    }

    // ── Create a single contact row ─────────────────────────────────────
    function _createRow(contact, query) {
        const row = document.createElement('div');
        row.className = 'people-row';
        row.dataset.contactId = contact.id;

        // Apply contact color as row background
        if (contact.color) {
            row.style.backgroundColor = contact.color;
            row.style.borderLeft = '3px solid ' + contact.color;
        }

        // Star toggle
        const star = document.createElement('span');
        star.className = 'star-toggle';
        star.textContent = contact.favorite ? '★' : '☆';
        star.title = contact.favorite ? 'Remove from favorites' : 'Add to favorites';
        star.addEventListener('click', (e) => {
            e.stopPropagation();
            _toggleFavorite(contact, star);
        });
        row.appendChild(star);

        // Thumbnail
        if (contact.image_url) {
            const thumb = document.createElement('img');
            thumb.className = 'contact-thumb';
            thumb.src = contact.image_url;
            thumb.alt = '';
            row.appendChild(thumb);
        } else {
            const placeholder = document.createElement('span');
            placeholder.className = 'contact-thumb-placeholder';
            placeholder.innerHTML = '<i class="fas fa-user"></i>';
            row.appendChild(placeholder);
        }

        // Name + details column
        const infoCol = document.createElement('div');
        infoCol.className = 'contact-info';

        const name = document.createElement('span');
        name.className = 'contact-name' + (contact.favorite ? ' favorite' : '');
        name.innerHTML = _highlightMatch(contact.display_name || contact.given_name || '(unnamed)', query);
        infoCol.appendChild(name);

        // Detail line: email, phone, org
        const details = [];
        if (contact.emails && contact.emails.length > 0) {
            details.push(contact.emails[0].value);
        }
        if (contact.phones && contact.phones.length > 0) {
            details.push(contact.phones[0].value);
        }
        if (contact.organization) {
            details.push(contact.organization);
        }
        if (details.length > 0) {
            const detailSpan = document.createElement('span');
            detailSpan.className = 'contact-detail';
            detailSpan.innerHTML = _highlightMatch(details.join(' · '), query);
            infoCol.appendChild(detailSpan);
        }

        row.appendChild(infoCol);

        // Share (QR) button
        const shareBtn = document.createElement('button');
        shareBtn.className = 'share-btn';
        shareBtn.innerHTML = '<i class="fas fa-qrcode"></i>';
        shareBtn.title = 'Share contact via QR code';
        shareBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            _shareContact(contact);
        });
        row.appendChild(shareBtn);

        // Click row → navigate to Contact Editor
        row.addEventListener('click', () => {
            window.location.href = '/frontend/contact-editor.html?id=' + encodeURIComponent(contact.id);
        });

        return row;
    }

    // ── Toggle favorite via PATCH ──────────────────────────────────────
    async function _toggleFavorite(contact, starEl) {
        try {
            const resp = await fetch('/api/contacts/' + encodeURIComponent(contact.id) + '/favorite', {
                method: 'PATCH'
            });
            if (!resp.ok) throw new Error('Failed to toggle favorite');
            const updated = await resp.json();
            // Update local data
            contact.favorite = updated.favorite;
            starEl.textContent = updated.favorite ? '★' : '☆';
            starEl.title = updated.favorite ? 'Remove from favorites' : 'Add to favorites';
            // Re-render to move contact between sections
            _applyFilter();
        } catch (err) {
            console.error('Error toggling favorite:', err);
        }
    }

    // ── Share contact (QR) ─────────────────────────────────────────────
    function _shareContact(contact) {
        showContactQrCode(contact);
    }

    // ── Close QR modal ──────────────────────────────────────────────────
    window.closeQrModal = function () {
        document.getElementById('qr-modal').style.display = 'none';
    };

    // Close modal on backdrop click
    document.getElementById('qr-modal').addEventListener('click', (e) => {
        if (e.target.id === 'qr-modal') {
            e.target.style.display = 'none';
        }
    });

    // ═══════════════════════════════════════════════════════════════════
    // ── Import / Export (Task 7.2) ──────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    const importBtn = document.getElementById('import-btn');
    const exportBtn = document.getElementById('export-btn');
    const importFileInput = document.getElementById('import-file-input');
    const importModal = document.getElementById('import-modal');
    const exportDropdown = document.getElementById('export-dropdown');

    // ── Import: open file picker on button click ────────────────────
    importBtn.addEventListener('click', () => {
        importFileInput.value = '';  // reset so same file can be re-selected
        importFileInput.click();
    });

    // ── Import: upload selected file ────────────────────────────────
    importFileInput.addEventListener('change', async () => {
        const file = importFileInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            importBtn.disabled = true;
            importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';

            const resp = await fetch('/api/contacts/import', {
                method: 'POST',
                body: formData
            });

            if (!resp.ok) {
                throw new Error('Import failed: ' + resp.statusText);
            }

            const result = await resp.json();
            _showImportResult(result);

            // Refresh the contact list
            loadContacts();
        } catch (err) {
            console.error('Import error:', err);
            _showImportResult({
                imported: 0,
                skipped: 0,
                errors: [{ entry: 0, reason: err.message || 'Unknown error during import' }]
            });
        } finally {
            importBtn.disabled = false;
            importBtn.innerHTML = '<i class="fas fa-file-import"></i> Import';
        }
    });

    // ── Import: show result modal ───────────────────────────────────
    function _showImportResult(result) {
        const summaryEl = document.getElementById('import-summary');
        const errorsEl = document.getElementById('import-errors');

        const imported = result.imported || 0;
        const skipped = result.skipped || 0;
        const errors = result.errors || [];

        summaryEl.innerHTML =
            '<span class="stat stat-imported">✅ ' + imported + ' imported</span>' +
            '<span class="stat stat-skipped">⚠️ ' + skipped + ' skipped</span>';

        if (errors.length > 0) {
            errorsEl.innerHTML = '<strong>Errors:</strong>' +
                errors.map(function (e) {
                    const entry = e.entry !== undefined ? 'Entry ' + e.entry + ': ' : '';
                    return '<div class="error-item">' + entry + _escapeHtml(e.reason || 'Unknown error') + '</div>';
                }).join('');
        } else {
            errorsEl.innerHTML = '';
        }

        importModal.style.display = 'flex';
    }

    // ── Import: close modal ─────────────────────────────────────────
    window.closeImportModal = function () {
        importModal.style.display = 'none';
    };

    // Close import modal on backdrop click
    importModal.addEventListener('click', (e) => {
        if (e.target === importModal) {
            importModal.style.display = 'none';
        }
    });

    // ── Export: toggle dropdown on button click ─────────────────────
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = exportDropdown.style.display === 'block';
        _hideExportDropdown();
        if (!isVisible) {
            // Position dropdown below the export button
            const rect = exportBtn.getBoundingClientRect();
            exportDropdown.style.top = (rect.bottom + 2) + 'px';
            exportDropdown.style.left = rect.left + 'px';
            exportDropdown.style.display = 'block';
        }
    });

    // ── Export: handle format selection ──────────────────────────────
    exportDropdown.querySelectorAll('.export-option').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const format = this.dataset.format;
            _hideExportDropdown();
            // Navigate to the export endpoint — browser will trigger file download
            window.location.href = '/api/contacts/export?format=' + encodeURIComponent(format);
        });
    });

    function _hideExportDropdown() {
        exportDropdown.style.display = 'none';
    }

    // Close export dropdown when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!exportBtn.contains(e.target) && !exportDropdown.contains(e.target)) {
            _hideExportDropdown();
        }
    });

    // Close import modal on ESC, or exit page
    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        // Close modals first
        if (importModal && importModal.style.display === 'flex') {
            importModal.style.display = 'none';
            e.stopImmediatePropagation();
            return;
        }
        var qrM = document.getElementById('qr-modal');
        if (qrM && qrM.style.display === 'flex') {
            qrM.style.display = 'none';
            e.stopImmediatePropagation();
            return;
        }
        if (exportDropdown && exportDropdown.style.display === 'block') {
            _hideExportDropdown();
            e.stopImmediatePropagation();
            return;
        }
        // Navigate directly
        e.stopImmediatePropagation();
        window.location.href = '/';
    }, true);

    // ── Utility: escape HTML ────────────────────────────────────────
    function _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /** Highlight matching substring in text (returns HTML string) */
    function _highlightMatch(text, query) {
        if (!query || !text) return _escapeHtml(text || '');
        const escaped = _escapeHtml(text);
        const q = query.toLowerCase();
        const idx = text.toLowerCase().indexOf(q);
        if (idx === -1) return escaped;
        var before = _escapeHtml(text.substring(0, idx));
        var match = _escapeHtml(text.substring(idx, idx + query.length));
        var after = _escapeHtml(text.substring(idx + query.length));
        return before + '<mark style="background:#ffe082;padding:0 1px;border-radius:2px;">' + match + '</mark>' + after;
    }

})();
