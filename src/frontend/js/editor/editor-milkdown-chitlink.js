/**
 * editor-milkdown-chitlink.js — Chit Link Autocomplete Plugin for Milkdown
 *
 * Provides [[ ]] autocomplete for cross-referencing chits within the
 * Milkdown WYSIWYG editor. Monitors text input for the [[ trigger,
 * fetches chit titles, and displays a positioned dropdown for selection.
 *
 * This is a DOM-based approach (not ProseMirror decoration) to match
 * the existing codebase pattern from editor-notes.js.
 *
 * Depends on: editor-milkdown.js (CwocMilkdown namespace)
 * Loaded before: editor-init.js
 */

/* ── Chit Link Plugin State ────────────────────────────────────────────── */

var _milkdownChitLinkDropdown = null;
var _milkdownChitLinkHighlightIdx = 0;
var _milkdownChitLinkMatches = [];

/**
 * Creates the chit link autocomplete plugin for Milkdown.
 * Monitors the editor for [[ sequences and shows autocomplete.
 *
 * @param {string} currentChitId - ID of the chit being edited (excluded from results)
 * @param {HTMLElement} editorContainer - The milkdown editor container element
 * @returns {object} Plugin controller with destroy() method
 */
function createChitLinkPlugin(currentChitId, editorContainer) {
    var controller = { destroyed: false };

    function _getTextBeforeCursor() {
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return '';
        var range = sel.getRangeAt(0);
        // Only work within the editor container
        if (!editorContainer.contains(range.startContainer)) return '';
        var preRange = range.cloneRange();
        preRange.selectNodeContents(editorContainer.querySelector('.ProseMirror') || editorContainer);
        preRange.setEnd(range.startContainer, range.startOffset);
        return preRange.toString();
    }

    function _getCaretRect() {
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        var range = sel.getRangeAt(0).cloneRange();
        range.collapse(true);
        var rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
            // Fallback: use parent element rect
            var node = range.startContainer;
            if (node.nodeType === 3) node = node.parentElement;
            if (node) rect = node.getBoundingClientRect();
        }
        return rect;
    }

    async function _checkForTrigger() {
        if (controller.destroyed) return;
        var text = _getTextBeforeCursor();
        var openIdx = text.lastIndexOf('[[');
        var closeIdx = text.lastIndexOf(']]');

        if (openIdx >= 0 && openIdx > closeIdx) {
            var query = text.substring(openIdx + 2).toLowerCase();
            if (query.length < 1) { _dismissDropdown(); return; }

            // Fetch chits if not cached
            if (!window._allChitTitles) {
                try {
                    var resp = await fetch('/api/chits');
                    if (resp.ok) window._allChitTitles = await resp.json();
                } catch (e) { return; }
            }

            var matches = (window._allChitTitles || [])
                .filter(function(c) {
                    return c.title && c.title.toLowerCase().includes(query) && c.id !== currentChitId;
                })
                .slice(0, 8);

            if (matches.length === 0) { _dismissDropdown(); return; }
            _milkdownChitLinkMatches = matches;
            _milkdownChitLinkHighlightIdx = 0;
            _showDropdown(matches);
        } else {
            _dismissDropdown();
        }
    }

    function _showDropdown(matches) {
        _dismissDropdown();
        var rect = _getCaretRect();
        if (!rect) return;

        var dd = document.createElement('div');
        dd.className = 'milkdown-chitlink-dropdown';
        dd.style.left = rect.left + 'px';
        dd.style.top = (rect.bottom + 4) + 'px';

        matches.forEach(function(chit, i) {
            var item = document.createElement('div');
            item.className = 'chitlink-item' + (i === 0 ? ' highlighted' : '');
            item.textContent = chit.title;
            item.dataset.idx = i;
            item.addEventListener('mouseenter', function() {
                _milkdownChitLinkHighlightIdx = i;
                _updateHighlight();
            });
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                _insertSelection(chit.title);
            });
            dd.appendChild(item);
        });

        document.body.appendChild(dd);
        _milkdownChitLinkDropdown = dd;
    }

    function _updateHighlight() {
        if (!_milkdownChitLinkDropdown) return;
        var items = _milkdownChitLinkDropdown.querySelectorAll('.chitlink-item');
        items.forEach(function(item, i) {
            item.classList.toggle('highlighted', i === _milkdownChitLinkHighlightIdx);
        });
        if (items[_milkdownChitLinkHighlightIdx]) {
            items[_milkdownChitLinkHighlightIdx].scrollIntoView({ block: 'nearest' });
        }
    }

    function _insertSelection(title) {
        _dismissDropdown();
        // Insert the title + ]] at the current cursor position, replacing the query text after [[
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        var range = sel.getRangeAt(0);
        var textNode = range.startContainer;
        if (textNode.nodeType !== 3) {
            // Try to find the text node
            _dismissDropdown();
            return;
        }

        var fullText = textNode.textContent;
        var cursorPos = range.startOffset;
        var beforeCursor = fullText.substring(0, cursorPos);
        var openIdx = beforeCursor.lastIndexOf('[[');

        if (openIdx === -1) return;

        // Replace from [[ to cursor with [[title]]
        var newText = fullText.substring(0, openIdx) + '[[' + title + ']]' + fullText.substring(cursorPos);
        textNode.textContent = newText;

        // Position cursor after the closing ]]
        var newPos = openIdx + 2 + title.length + 2;
        var newRange = document.createRange();
        newRange.setStart(textNode, Math.min(newPos, newText.length));
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        // Trigger input event so Milkdown picks up the change
        var inputEvent = new Event('input', { bubbles: true });
        editorContainer.dispatchEvent(inputEvent);

        if (typeof markEditorUnsaved === 'function') markEditorUnsaved();
    }

    function _dismissDropdown() {
        if (_milkdownChitLinkDropdown) {
            _milkdownChitLinkDropdown.remove();
            _milkdownChitLinkDropdown = null;
        }
        _milkdownChitLinkMatches = [];
        _milkdownChitLinkHighlightIdx = 0;
    }

    function _onKeydown(e) {
        if (!_milkdownChitLinkDropdown) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            _dismissDropdown();
            return;
        }
        if (e.key === 'Enter') {
            if (_milkdownChitLinkMatches.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                _insertSelection(_milkdownChitLinkMatches[_milkdownChitLinkHighlightIdx].title);
            }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            _milkdownChitLinkHighlightIdx = Math.min(_milkdownChitLinkHighlightIdx + 1, _milkdownChitLinkMatches.length - 1);
            _updateHighlight();
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            _milkdownChitLinkHighlightIdx = Math.max(_milkdownChitLinkHighlightIdx - 1, 0);
            _updateHighlight();
            return;
        }
    }

    // Wire up event listeners on the editor container
    var proseMirror = editorContainer.querySelector('.ProseMirror');
    var targetEl = proseMirror || editorContainer;

    targetEl.addEventListener('input', function() {
        setTimeout(_checkForTrigger, 10);
    });
    targetEl.addEventListener('keydown', _onKeydown, true);
    targetEl.addEventListener('blur', function() {
        setTimeout(_dismissDropdown, 200);
    });

    controller.destroy = function() {
        controller.destroyed = true;
        _dismissDropdown();
        targetEl.removeEventListener('keydown', _onKeydown, true);
    };

    return controller;
}
