/**
 * editor-milkdown.js — Milkdown Editor Loader, Content Bridge, and Format Toolbar
 *
 * Loads Milkdown WYSIWYG editor via dynamic import from self-hosted ESM bundles.
 * Provides the CwocMilkdown namespace for creating/destroying editor instances,
 * syncing content with the hidden #note textarea, and format toolbar logic.
 *
 * Falls back to plain textarea if Milkdown fails to load within 5 seconds.
 *
 * This is an ES module (type="module" in HTML) because Milkdown requires ESM imports.
 *
 * Depends on: import map in editor.html, editor-milkdown-chitlink.js (non-module)
 */

/* ═══════════════════════════════════════════════════════════════════════════
   EDITOR LOADER
   ═══════════════════════════════════════════════════════════════════════════ */

const _MILKDOWN_TIMEOUT_MS = 5000;

// Module-level state
let _milkdownModules = null;
let _loadError = null;

// Expose namespace immediately so other scripts can check isFallback
window.CwocMilkdown = {
    ready: null, // Will be set to a Promise below
    isLoaded: false,
    isFallback: false,
    createEditor: null,
    destroyEditor: null,
    getMarkdown: null,
    setMarkdown: null,
};

// Content Bridge state
let _mainInstance = null;
let _modalInstance = null;
let _suppressUnsaved = false;
let _textarea = null;
let _chitLinkController = null;
let _modalChitLinkController = null;

/**
 * Load Milkdown modules with a timeout.
 */
async function _loadMilkdownModules() {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Milkdown load timeout (5s)')), _MILKDOWN_TIMEOUT_MS)
    );

    const load = async () => {
        const [core, ctx, prose, commonmark, history, listener, clipboard, transformer, utils] = await Promise.all([
            import('@milkdown/core'),
            import('@milkdown/ctx'),
            import('@milkdown/prose'),
            import('@milkdown/preset-commonmark'),
            import('@milkdown/plugin-history'),
            import('@milkdown/plugin-listener'),
            import('@milkdown/plugin-clipboard'),
            import('@milkdown/transformer'),
            import('@milkdown/utils'),
        ]);
        return { core, ctx, prose, commonmark, history, listener, clipboard, transformer, utils };
    };

    return Promise.race([load(), timeout]);
}

/**
 * Initialize the CwocMilkdown namespace.
 */
window.CwocMilkdown.ready = (async () => {
    try {
        _milkdownModules = await _loadMilkdownModules();
        window.CwocMilkdown.isLoaded = true;
        window.CwocMilkdown.isFallback = false;
        window.CwocMilkdown.createEditor = _createEditor;
        window.CwocMilkdown.destroyEditor = _destroyEditor;
        window.CwocMilkdown.getMarkdown = _getMarkdown;
        window.CwocMilkdown.setMarkdown = _setMarkdown;
        return true;
    } catch (err) {
        _loadError = err;
        window.CwocMilkdown.isLoaded = false;
        window.CwocMilkdown.isFallback = true;
        console.error('[CwocMilkdown] Failed to load Milkdown:', err.message || err);
        _showFallbackToast();
        return false;
    }
})();

function _showFallbackToast() {
    // Non-blocking notification
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#4a2c2a;color:#fdf5e6;padding:10px 16px;border-radius:6px;font-family:Lora,Georgia,serif;font-size:0.85em;z-index:10000;opacity:0.95;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    toast.textContent = 'Rich editor unavailable — editing in plain text mode';
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 4000);
}

/* ═══════════════════════════════════════════════════════════════════════════
   EDITOR INSTANCE MANAGEMENT
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a Milkdown editor instance in a container.
 * @param {HTMLElement} container - DOM element to mount editor into
 * @param {string} initialMarkdown - Starting content
 * @param {object} options - { onUpdate: fn, editorId: string }
 * @returns {Promise<object>} Editor instance object
 */
async function _createEditor(container, initialMarkdown, options) {
    if (!_milkdownModules) throw new Error('Milkdown modules not loaded');

    const { core, commonmark, history, listener, clipboard } = _milkdownModules;
    const { Editor, rootCtx, defaultValueCtx } = core;
    const { commonmark: commonmarkPlugin } = commonmark;
    const { history: historyPlugin } = history;
    const { listener: listenerPlugin, listenerCtx } = listener;
    const { clipboard: clipboardPlugin } = clipboard;

    const opts = options || {};
    const editorId = opts.editorId || 'milkdown-' + Date.now();

    const editor = await Editor.make()
        .config((ctx) => {
            ctx.set(rootCtx, container);
            ctx.set(defaultValueCtx, initialMarkdown || '');
            if (opts.onUpdate) {
                ctx.set(listenerCtx, { markdown: [opts.onUpdate] });
            }
        })
        .use(commonmarkPlugin)
        .use(historyPlugin)
        .use(listenerPlugin)
        .use(clipboardPlugin)
        .create();

    // Add security attributes to links
    _addLinkSecurity(container);

    const instance = {
        id: editorId,
        editor: editor,
        container: container,
        isDestroyed: false,
    };

    return instance;
}

/**
 * Destroy a Milkdown editor instance.
 */
function _destroyEditor(instance) {
    if (!instance || instance.isDestroyed) return;
    instance.isDestroyed = true;
    try {
        instance.editor.destroy();
    } catch (e) {
        console.error('[CwocMilkdown] Error destroying editor:', e);
    }
    instance.editor = null;
}

/**
 * Extract current markdown from an editor instance.
 */
function _getMarkdown(instance) {
    if (!instance || instance.isDestroyed) return '';
    try {
        // Milkdown v7: use the editor action to get markdown
        // The serializer is accessed through the editor's ctx
        const { serializerCtx } = _milkdownModules.core;
        const { getMarkdown } = _milkdownModules.utils;
        if (getMarkdown) {
            return instance.editor.action(getMarkdown());
        }
        // Fallback: try to get from ProseMirror state
        return _extractMarkdownFromDOM(instance.container);
    } catch (e) {
        console.error('[CwocMilkdown] Error extracting markdown:', e);
        return _extractMarkdownFromDOM(instance.container);
    }
}

/**
 * Set markdown content in an editor instance.
 */
function _setMarkdown(instance, markdown) {
    if (!instance || instance.isDestroyed) return;
    try {
        const { replaceAll } = _milkdownModules.utils;
        if (replaceAll) {
            instance.editor.action(replaceAll(markdown || ''));
        }
    } catch (e) {
        console.error('[CwocMilkdown] Error setting markdown:', e);
    }
}

/**
 * Fallback: extract text content from the ProseMirror DOM.
 */
function _extractMarkdownFromDOM(container) {
    var pm = container.querySelector('.ProseMirror');
    return pm ? pm.textContent || '' : '';
}

/**
 * Add rel="noopener noreferrer" and target="_blank" to links.
 * Uses a MutationObserver to catch dynamically added links.
 */
function _addLinkSecurity(container) {
    function _secureLinks(root) {
        var links = root.querySelectorAll('a');
        links.forEach(function(a) {
            a.setAttribute('rel', 'noopener noreferrer');
            a.setAttribute('target', '_blank');
        });
    }
    _secureLinks(container);
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
            m.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) {
                    if (node.tagName === 'A') {
                        node.setAttribute('rel', 'noopener noreferrer');
                        node.setAttribute('target', '_blank');
                    }
                    _secureLinks(node);
                }
            });
        });
    });
    observer.observe(container, { childList: true, subtree: true });
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTENT BRIDGE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Initialize the Content Bridge for the Notes zone.
 * Wires up the Milkdown listener to sync to the hidden textarea.
 */
function _initContentBridge(editorInstance) {
    _textarea = document.getElementById('note');
    _mainInstance = editorInstance;
    // Initial content was loaded with _suppressUnsaved = true, so no dirty flag
}

/**
 * Content update callback from Milkdown listener.
 * Called on every content change in the editor.
 */
function _onContentUpdate(markdown) {
    if (!_textarea) return;
    // Guard against empty extraction when content existed
    if (!markdown && _textarea.value && _textarea.value.trim()) {
        console.warn('[CwocMilkdown] Empty extraction skipped — textarea retains previous value');
        return;
    }
    _textarea.value = markdown || '';
    if (!_suppressUnsaved) {
        if (typeof markEditorUnsaved === 'function') markEditorUnsaved();
    }
}

/**
 * Sync modal editor content back to main editor on modal close.
 */
function _syncModalToMain() {
    if (!_modalInstance || _modalInstance.isDestroyed) return;
    if (!_mainInstance || _mainInstance.isDestroyed) return;

    var modalMarkdown = _getMarkdown(_modalInstance);
    _suppressUnsaved = true;
    _setMarkdown(_mainInstance, modalMarkdown);
    _suppressUnsaved = false;

    // Sync to textarea
    if (_textarea) _textarea.value = modalMarkdown || '';
    if (typeof markEditorUnsaved === 'function') markEditorUnsaved();
}

/**
 * Get markdown from the currently active editor (modal or main).
 */
function _getActiveMarkdown() {
    if (_modalInstance && !_modalInstance.isDestroyed) {
        return _getMarkdown(_modalInstance);
    }
    if (_mainInstance && !_mainInstance.isDestroyed) {
        return _getMarkdown(_mainInstance);
    }
    // Fallback to textarea
    var ta = document.getElementById('note');
    return ta ? ta.value : '';
}

// Expose for other scripts
window._getActiveMarkdown = _getActiveMarkdown;
window._syncModalToMain = _syncModalToMain;

/* ═══════════════════════════════════════════════════════════════════════════
   FORMAT TOOLBAR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Execute a format action on the active Milkdown editor.
 * @param {string} action - Format action name
 */
function _milkdownFormat(action) {
    var instance = _modalInstance && !_modalInstance.isDestroyed ? _modalInstance : _mainInstance;
    if (!instance || instance.isDestroyed || !_milkdownModules) return;

    try {
        const { callCommand } = _milkdownModules.utils;
        const cm = _milkdownModules.commonmark;

        const commandMap = {
            'bold': cm.toggleStrongCommand,
            'italic': cm.toggleEmphasisCommand,
            'strikethrough': null, // commonmark doesn't have strikethrough
            'link': cm.toggleLinkCommand,
            'h1': () => cm.wrapInHeadingCommand.key,
            'h2': () => cm.wrapInHeadingCommand.key,
            'h3': () => cm.wrapInHeadingCommand.key,
            'bulletList': cm.wrapInBulletListCommand,
            'orderedList': cm.wrapInOrderedListCommand,
            'blockquote': cm.wrapInBlockquoteCommand,
            'code': cm.toggleInlineCodeCommand,
            'hr': cm.insertHrCommand,
        };

        // Handle heading levels
        if (action === 'h1' || action === 'h2' || action === 'h3') {
            var level = parseInt(action.charAt(1));
            if (cm.wrapInHeadingCommand && callCommand) {
                instance.editor.action(callCommand(cm.wrapInHeadingCommand.key, level));
            }
            return;
        }

        var cmd = commandMap[action];
        if (cmd && callCommand) {
            instance.editor.action(callCommand(cmd.key));
        }
    } catch (e) {
        console.error('[CwocMilkdown] Format action failed:', action, e);
    }
}

/**
 * Update toolbar button active states based on current selection.
 * Called on selection change within the editor.
 */
function _updateToolbarState() {
    // This would require inspecting ProseMirror marks at cursor position.
    // For now, we skip active state highlighting — it's a nice-to-have.
    // The toolbar buttons still work for toggling formats.
}

// Expose format function globally for toolbar onclick handlers
window._milkdownFormat = _milkdownFormat;

/* ═══════════════════════════════════════════════════════════════════════════
   INITIALIZATION (called from editor-init.js)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Initialize Milkdown in the Notes zone.
 * Called after DOMContentLoaded and chit data is loaded.
 */
async function initMilkdownNotesZone() {
    if (window.CwocMilkdown.isFallback) return;

    try {
        await window.CwocMilkdown.ready;
    } catch (e) {
        return; // Fallback mode
    }

    if (window.CwocMilkdown.isFallback) return;

    var container = document.getElementById('milkdown-editor-container');
    var textarea = document.getElementById('note');
    var toolbar = document.getElementById('milkdownFormatToolbar');
    var oldToolbar = document.getElementById('notesFormatToolbar');

    if (!container || !textarea) return;

    // Hide old textarea and toolbar, show Milkdown container and toolbar
    textarea.classList.add('milkdown-hidden');
    if (oldToolbar) oldToolbar.classList.add('milkdown-hidden');
    container.style.display = '';
    if (toolbar) toolbar.style.display = '';

    // Hide the render toggle button (Milkdown is always WYSIWYG)
    var renderBtn = document.getElementById('notes-render-toggle-btn');
    if (renderBtn) renderBtn.style.display = 'none';

    // Hide rendered output
    var renderedOutput = document.getElementById('notes-rendered-output');
    if (renderedOutput) renderedOutput.style.display = 'none';

    _suppressUnsaved = true;

    try {
        var instance = await window.CwocMilkdown.createEditor(container, textarea.value || '', {
            editorId: 'notes-zone',
            onUpdate: function(markdown) {
                _onContentUpdate(markdown);
            },
        });

        _initContentBridge(instance);

        // Wire up chit link autocomplete
        if (typeof createChitLinkPlugin === 'function') {
            _chitLinkController = createChitLinkPlugin(window.currentChitId || '', container);
        }

        // Suppress unsaved flag for initial load
        setTimeout(function() { _suppressUnsaved = false; }, 100);

    } catch (e) {
        console.error('[CwocMilkdown] Failed to create editor:', e);
        // Revert to textarea
        textarea.classList.remove('milkdown-hidden');
        if (oldToolbar) oldToolbar.classList.remove('milkdown-hidden');
        container.style.display = 'none';
        if (toolbar) toolbar.style.display = 'none';
        if (renderBtn) renderBtn.style.display = '';
        window.CwocMilkdown.isFallback = true;
    }
}

/**
 * Open the Notes modal with a Milkdown instance.
 */
async function openMilkdownModal() {
    if (window.CwocMilkdown.isFallback) return false;

    var modalContainer = document.getElementById('milkdown-modal-container');
    if (!modalContainer) return false;

    var currentMarkdown = _getActiveMarkdown();

    _suppressUnsaved = true;

    try {
        _modalInstance = await window.CwocMilkdown.createEditor(modalContainer, currentMarkdown, {
            editorId: 'notes-modal',
            onUpdate: function(markdown) {
                // Modal updates don't sync to textarea until "Done"
            },
        });

        // Wire chit link in modal
        if (typeof createChitLinkPlugin === 'function') {
            _modalChitLinkController = createChitLinkPlugin(window.currentChitId || '', modalContainer);
        }

        setTimeout(function() { _suppressUnsaved = false; }, 100);
        return true;
    } catch (e) {
        console.error('[CwocMilkdown] Failed to create modal editor:', e);
        return false;
    }
}

/**
 * Close the Milkdown modal and sync content back.
 */
function closeMilkdownModal(save) {
    if (save) {
        _syncModalToMain();
    }

    // Destroy modal instance
    if (_modalChitLinkController) {
        _modalChitLinkController.destroy();
        _modalChitLinkController = null;
    }
    if (_modalInstance) {
        _destroyEditor(_modalInstance);
        _modalInstance = null;
    }

    // Clear modal container
    var modalContainer = document.getElementById('milkdown-modal-container');
    if (modalContainer) modalContainer.innerHTML = '';
}

// Expose initialization functions globally
window.initMilkdownNotesZone = initMilkdownNotesZone;
window.openMilkdownModal = openMilkdownModal;
window.closeMilkdownModal = closeMilkdownModal;

/* ═══════════════════════════════════════════════════════════════════════════
   CLEANUP
   ═══════════════════════════════════════════════════════════════════════════ */

window.addEventListener('beforeunload', function() {
    if (_chitLinkController) _chitLinkController.destroy();
    if (_modalChitLinkController) _modalChitLinkController.destroy();
    if (_modalInstance) _destroyEditor(_modalInstance);
    if (_mainInstance) _destroyEditor(_mainInstance);
});
