/**
 * help.js — Dynamic help page with multi-file navigation and cross-file search.
 * Loads markdown documentation from /api/docs endpoints and renders via marked.js.
 */

(function() {
    'use strict';

    var _helpBody = document.getElementById('help-body');
    var _searchInput = document.getElementById('help-search-input');
    var _searchBtn = document.getElementById('help-search-btn');
    var _searchResults = document.getElementById('help-search-results');
    var _breadcrumb = document.getElementById('help-breadcrumb');
    var _breadcrumbHome = document.getElementById('breadcrumb-home');
    var _breadcrumbCurrent = document.getElementById('breadcrumb-current');
    var _currentFile = null; // null = index, otherwise filename

    // ═══════════════════════════════════════════════════════════════════
    // Table of Contents — categorized listing of all help pages
    // ═══════════════════════════════════════════════════════════════════

    var _tocCategories = [
        {
            label: 'Views',
            items: [
                { file: 'views.md', title: 'Views Overview' },
                { file: 'omni-view.md', title: 'Omni View' },
                { file: 'calendar.md', title: 'Calendar' },
                { file: 'notes.md', title: 'Notes' },
                { file: 'habits.md', title: 'Habits' },
                { file: 'indicators.md', title: 'Indicators' },
                { file: 'maps.md', title: 'Maps' },
                { file: 'email.md', title: 'Email' },
                { file: 'global-search.md', title: 'Global Search' },
                { file: 'trash.md', title: 'Trash' },
                { file: 'kiosk.md', title: 'Kiosk' }
            ]
        },
        {
            label: 'Core Concepts',
            items: [
                { file: 'what-is-cwoc.md', title: 'What is CWOC?' },
                { file: 'chits.md', title: 'Chits' },
                { file: 'editor.md', title: 'Chit Editor' },
                { file: 'quick-edit.md', title: 'Quick Edit Modal' },
                { file: 'recurrence.md', title: 'Recurrence' },
                { file: 'tags.md', title: 'Tags' },
                { file: 'filters.md', title: 'Filtering & Sorting' },
                { file: 'sharing.md', title: 'Sharing' },
                { file: 'attachments.md', title: 'Attachments' }
            ]
        },
        {
            label: 'Interaction',
            items: [
                { file: 'mouse.md', title: 'Mouse Interactions' },
                { file: 'hotkeys.md', title: 'Keyboard Shortcuts' },
                { file: 'calculator.md', title: 'Calculator' }
            ]
        },
        {
            label: 'People & Contacts',
            items: [
                { file: 'contacts.md', title: 'Contact Editor' },
                { file: 'saved-locations.md', title: 'Saved Locations' }
            ]
        },
        {
            label: 'Tools & Widgets',
            items: [
                { file: 'clocks.md', title: 'Clocks' },
                { file: 'weather.md', title: 'Weather' },
                { file: 'visual-indicators.md', title: 'Visual Indicators' },
                { file: 'custom-objects.md', title: 'Custom Objects' }
            ]
        },
        {
            label: 'Automation & Integrations',
            items: [
                { file: 'cron-triggers.md', title: 'Cron Triggers & Habit Rules' },
                { file: 'home-assistant.md', title: 'Home Assistant' },
                { file: 'ntfy-notifications.md', title: 'Ntfy Notifications' },
                { file: 'dependent-apps.md', title: 'Dependent Apps' }
            ]
        },
        {
            label: 'System & Data',
            items: [
                { file: 'settings.md', title: 'Settings' },
                { file: 'data-management.md', title: 'Data Management' },
                { file: 'audit-log.md', title: 'Audit Log' },
                { file: 'version-management.md', title: 'Version & Updates' },
                { file: 'install-app.md', title: 'Install as App' }
            ]
        }
    ];

    function _buildTocHtml() {
        var html = '<h2 style="margin-top:0;">CWOC Help Guide</h2>';
        html += '<p>Welcome to the C.W.\'s Omni Chits documentation. Browse topics below or use the search bar to find what you need across all help files.</p>';
        html += '<div class="index"><strong>Contents</strong><div class="index-columns">';

        // Split categories into two columns
        var half = Math.ceil(_tocCategories.length / 2);
        html += '<div class="index-col">';
        for (var i = 0; i < half; i++) {
            html += _buildCategoryHtml(_tocCategories[i]);
        }
        html += '</div><div class="index-col">';
        for (var j = half; j < _tocCategories.length; j++) {
            html += _buildCategoryHtml(_tocCategories[j]);
        }
        html += '</div></div></div>';
        return html;
    }

    function _buildCategoryHtml(cat) {
        var html = '<em class="index-label">' + cat.label + '</em><ul>';
        cat.items.forEach(function(item) {
            html += '<li><a data-doc="' + item.file + '">' + item.title + '</a></li>';
        });
        html += '</ul>';
        return html;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Markdown Rendering
    // ═══════════════════════════════════════════════════════════════════

    function _renderMarkdown(md) {
        if (typeof marked !== 'undefined' && marked.parse) {
            return marked.parse(md);
        }
        // Fallback: basic conversion
        return md
            .replace(/^### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^## (.+)$/gm, '<h3>$1</h3>')
            .replace(/^# (.+)$/gm, '<h2>$1</h2>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    function _processDocLinks(container) {
        // Wire up links in rendered markdown content:
        // - Links to help.html#slug → load that doc via API (stay on help page)
        // - Links to other app pages → navigate directly
        // - External links → open normally
        var links = container.querySelectorAll('a[href]');
        links.forEach(function(a) {
            var href = a.getAttribute('href');
            if (!href) return;

            // Help page cross-references: /frontend/html/help.html#slug
            if (href.indexOf('/frontend/html/help.html#') === 0) {
                var slug = href.split('#')[1];
                if (slug) {
                    a.style.cursor = 'pointer';
                    a.addEventListener('click', function(e) {
                        e.preventDefault();
                        _loadDoc(slug + '.md');
                    });
                }
                return;
            }

            // Old .md links (shouldn't exist anymore but handle gracefully)
            if (href.endsWith('.md') && !href.startsWith('http')) {
                a.style.cursor = 'pointer';
                a.addEventListener('click', function(e) {
                    e.preventDefault();
                    _loadDoc(href);
                });
                return;
            }

            // All other internal links (settings, editor, maps, etc.) — navigate directly
            // External links (http/https) — leave as-is (open normally)
        });

        // Also wire up any data-doc links (from the TOC)
        var docLinks = container.querySelectorAll('a[data-doc]');
        docLinks.forEach(function(a) {
            if (a._docWired) return;
            a._docWired = true;
            a.style.cursor = 'pointer';
            a.addEventListener('click', function(e) {
                e.preventDefault();
                _loadDoc(a.getAttribute('data-doc'));
            });
        });
    }

    function _addBackToTopLinks(container) {
        container.querySelectorAll('h2[id], h3[id]').forEach(function(heading) {
            var a = document.createElement('a');
            a.href = '#';
            a.className = 'back-to-top';
            a.innerHTML = '⤴';
            a.title = 'Back to top';
            a.addEventListener('click', function(e) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            heading.style.display = 'flex';
            heading.style.alignItems = 'center';
            heading.appendChild(a);
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Navigation
    // ═══════════════════════════════════════════════════════════════════

    function _showIndex() {
        _currentFile = null;
        _breadcrumb.style.display = 'none';
        _searchResults.style.display = 'none';

        // Build the categorized TOC directly (no API call needed for the index)
        _helpBody.innerHTML = _buildTocHtml();
        _processDocLinks(_helpBody);
    }

    function _loadDoc(filename) {
        _currentFile = filename;
        _searchResults.style.display = 'none';
        _breadcrumb.style.display = 'block';
        _helpBody.innerHTML = '<p style="text-align:center; color:#8b7355; padding:2em;">Loading...</p>';

        // Update breadcrumb with the proper title from TOC
        var displayName = _getTitleForFile(filename);
        _breadcrumbCurrent.textContent = displayName;

        var slug = filename.replace('.md', '');
        fetch('/api/docs/' + encodeURIComponent(slug), { credentials: 'include' })
            .then(function(r) {
                if (!r.ok) {
                    return r.text().then(function(t) {
                        throw new Error('HTTP ' + r.status + ': ' + t);
                    });
                }
                return r.json();
            })
            .then(function(data) {
                var html = _renderMarkdown(data.content || '');
                _helpBody.innerHTML = html;
                _processDocLinks(_helpBody);
                _addBackToTopLinks(_helpBody);
                window.scrollTo({ top: 0, behavior: 'smooth' });

                // Update URL hash for bookmarking
                history.pushState({ file: filename }, '', '#' + filename.replace('.md', ''));
            })
            .catch(function(err) {
                console.error('[Help] Failed to load doc:', filename, err);
                _helpBody.innerHTML = '<p style="color:#a00;">Failed to load: ' + filename + '<br><small>' + err.message + '</small></p>';
            });
    }

    function _getTitleForFile(filename) {
        for (var i = 0; i < _tocCategories.length; i++) {
            for (var j = 0; j < _tocCategories[i].items.length; j++) {
                if (_tocCategories[i].items[j].file === filename) {
                    return _tocCategories[i].items[j].title;
                }
            }
        }
        // Fallback: derive from filename
        var name = filename.replace('.md', '').replace(/-/g, ' ');
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Search
    // ═══════════════════════════════════════════════════════════════════

    function _doSearch() {
        var query = _searchInput.value.trim();
        if (!query) {
            _searchResults.style.display = 'none';
            return;
        }

        _searchResults.style.display = 'block';
        _searchResults.innerHTML = '<p style="text-align:center; color:#8b7355;">Searching...</p>';

        fetch('/api/docs-search?q=' + encodeURIComponent(query), { credentials: 'include' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.results || data.results.length === 0) {
                    _searchResults.innerHTML = '<div class="help-no-results">No results found for "' + _escHtml(query) + '"</div>';
                    return;
                }

                var html = '';
                data.results.forEach(function(result) {
                    html += '<div class="search-result" data-file="' + _escHtml(result.filename) + '">';
                    html += '<h4>' + _escHtml(result.title) + '</h4>';
                    result.matches.forEach(function(snippet) {
                        var highlighted = _highlightTerms(snippet, query.split(/\s+/));
                        html += '<div class="snippet">' + highlighted + '</div>';
                    });
                    html += '</div>';
                });
                _searchResults.innerHTML = html;

                // Attach click handlers
                _searchResults.querySelectorAll('.search-result').forEach(function(el) {
                    el.addEventListener('click', function() {
                        var file = el.getAttribute('data-file');
                        _searchResults.style.display = 'none';
                        _searchInput.value = '';
                        _loadDoc(file);
                    });
                });
            })
            .catch(function(err) {
                console.error('[Help] Search error:', err);
                _searchResults.innerHTML = '<div class="help-no-results">Search failed. Please try again.</div>';
            });
    }

    function _highlightTerms(text, terms) {
        var escaped = _escHtml(text);
        terms.forEach(function(term) {
            if (!term) return;
            var re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            escaped = escaped.replace(re, '<mark>$1</mark>');
        });
        return escaped;
    }

    function _escHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Event Listeners
    // ═══════════════════════════════════════════════════════════════════

    _searchBtn.addEventListener('click', _doSearch);
    _searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            _doSearch();
        }
    });

    _breadcrumbHome.addEventListener('click', function(e) {
        e.preventDefault();
        _showIndex();
        history.pushState({ file: null }, '', window.location.pathname);
    });

    // Handle browser back/forward
    window.addEventListener('popstate', function(e) {
        if (e.state && e.state.file) {
            _loadDoc(e.state.file);
        } else {
            _showIndex();
        }
    });

    // ═══════════════════════════════════════════════════════════════════
    // Init
    // ═══════════════════════════════════════════════════════════════════

    function _init() {
        // Check URL hash for direct link to a doc
        var hash = window.location.hash.replace('#', '');
        if (hash) {
            var filename = hash + '.md';
            _loadDoc(filename);
        } else {
            _showIndex();
        }
    }

    // Wait for marked.js to be available (loaded via CDN in shared scripts)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }
})();
