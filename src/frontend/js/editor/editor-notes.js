/**
 * editor-notes.js — Notes zone: auto-grow, chit linking, markdown render, modal
 *
 * Handles the notes textarea auto-grow, [[ ]] chit link autocomplete with
 * dropdown, markdown render toggle (inline and modal), copy/download notes,
 * and the fullscreen notes modal.
 *
 * Depends on: shared.js (setSaveButtonUnsaved, markEditorUnsaved),
 *             marked.js (CDN, for markdown rendering)
 * Loaded before: editor-init.js, editor.js
 */

/* ── Notes Undo/Redo ──────────────────────────────────────────────────────── */

function _notesUndo(e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  var noteEl = document.getElementById('note');
  if (noteEl) { noteEl.focus(); document.execCommand('undo'); }
}

function _notesRedo(e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  var noteEl = document.getElementById('note');
  if (noteEl) { noteEl.focus(); document.execCommand('redo'); }
}

/* ── Notes More Menu ──────────────────────────────────────────────────────── */

function _toggleNotesMoreMenu(e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  var menu = document.getElementById('notesMoreMenu');
  if (!menu) return;
  var isOpen = menu.style.display === 'flex';
  menu.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) {
    // Close on next click anywhere
    setTimeout(function() {
      document.addEventListener('click', _closeNotesMoreMenu, { once: true });
    }, 0);
  }
}

function _closeNotesMoreMenu() {
  var menu = document.getElementById('notesMoreMenu');
  if (menu) menu.style.display = 'none';
}

function autoGrowNote(el) {
  el.style.height = "auto";
  const maxH = Math.floor(window.innerHeight * 0.6);
  el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  _checkChitLinkAutocomplete(el);
}

// ── [[ ]] Chit Link Autocomplete ──
var _chitLinkDropdown = null;
var _chitLinkStart = -1;

async function _checkChitLinkAutocomplete(textarea) {
  const pos = textarea.selectionStart;
  const text = textarea.value.substring(0, pos);
  const openIdx = text.lastIndexOf('[[');
  const closeIdx = text.lastIndexOf(']]');

  // If [[ is open and not yet closed
  if (openIdx >= 0 && openIdx > closeIdx) {
    const query = text.substring(openIdx + 2).toLowerCase();
    _chitLinkStart = openIdx;
    if (query.length < 1) { _removeChitLinkDropdown(); return; }

    // Fetch chits if not cached
    if (!window._allChitTitles) {
      try {
        const resp = await fetch('/api/chits');
        if (resp.ok) window._allChitTitles = await resp.json();
      } catch (e) { return; }
    }
    const matches = (window._allChitTitles || [])
      .filter(c => c.title && c.title.toLowerCase().includes(query) && c.id !== chitId)
      .slice(0, 8);

    if (matches.length === 0) { _removeChitLinkDropdown(); return; }
    _showChitLinkDropdown(textarea, matches);
  } else {
    _removeChitLinkDropdown();
  }
}

function _showChitLinkDropdown(textarea, matches) {
  _removeChitLinkDropdown();
  const dd = document.createElement('div');
  dd.id = 'chit-link-dropdown';
  dd.style.cssText = 'position:absolute;z-index:9999;background:#fff8e1;border:2px solid #8b4513;border-radius:6px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:0.9em;min-width:200px;';

  matches.forEach((chit, i) => {
    const opt = document.createElement('div');
    opt.style.cssText = 'padding:6px 10px;cursor:pointer;border-bottom:1px solid #e0d4b5;';
    opt.textContent = chit.title;
    opt.title = chit.id;
    if (i === 0) opt.style.background = '#f0e6d0';
    opt.addEventListener('mouseenter', () => {
      dd.querySelectorAll('div').forEach(d => d.style.background = '');
      opt.style.background = '#f0e6d0';
    });
    opt.addEventListener('mousedown', (e) => {
      e.preventDefault();
      _insertChitLink(textarea, chit.title);
    });
    dd.appendChild(opt);
  });

  // Position below cursor
  const rect = textarea.getBoundingClientRect();
  dd.style.left = (rect.left + 20) + 'px';
  dd.style.top = (rect.bottom + 2) + 'px';
  dd.style.position = 'fixed';
  document.body.appendChild(dd);
  _chitLinkDropdown = dd;
}

function _removeChitLinkDropdown() {
  if (_chitLinkDropdown) { _chitLinkDropdown.remove(); _chitLinkDropdown = null; }
}

function _insertChitLink(textarea, title) {
  const pos = textarea.selectionStart;
  const before = textarea.value.substring(0, _chitLinkStart + 2);
  const after = textarea.value.substring(pos);
  textarea.value = before + title + ']]' + after;
  const newPos = _chitLinkStart + 2 + title.length + 2;
  textarea.selectionStart = textarea.selectionEnd = newPos;
  textarea.focus();
  _removeChitLinkDropdown();
  if (typeof markEditorUnsaved === 'function') markEditorUnsaved();
}

// Close dropdown on blur or Escape
document.addEventListener('keydown', (e) => {
  if (!_chitLinkDropdown) return;
  if (e.key === 'Escape') { _removeChitLinkDropdown(); return; }
  if (e.key === 'Enter') {
    const highlighted = _chitLinkDropdown.querySelector('div[style*="f0e6d0"]');
    if (highlighted) {
      e.preventDefault();
      const textarea = document.getElementById('note');
      _insertChitLink(textarea, highlighted.textContent);
    }
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = Array.from(_chitLinkDropdown.querySelectorAll('div'));
    const curIdx = items.findIndex(d => d.style.background.includes('f0e6d0'));
    items.forEach(d => d.style.background = '');
    const next = e.key === 'ArrowDown' ? Math.min(curIdx + 1, items.length - 1) : Math.max(curIdx - 1, 0);
    items[next].style.background = '#f0e6d0';
    items[next].scrollIntoView({ block: 'nearest' });
  }
});

function shrinkNoteToFourLines(event) {
  if (event) event.stopPropagation();
  const textarea = document.getElementById("note");
  const rendered = document.getElementById("notes-rendered-output");
  const lineH = textarea ? (parseInt(getComputedStyle(textarea).lineHeight) || 22) : 22;
  const targetH = lineH * 4 + 16;
  if (textarea) textarea.style.height = targetH + "px";
  if (rendered) rendered.style.minHeight = targetH + "px";
}

function _setNotesRenderToggleLabel(isRendered, source) {
  const btnId = source === "modal" ? "modal-render-toggle-btn" : "notes-render-toggle-btn";
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (isRendered) {
    btn.innerHTML = '<i class="fas fa-edit"></i>';
    btn.title = 'Switch to edit mode';
  } else {
    btn.innerHTML = '<i class="fas fa-eye"></i>';
    btn.title = 'Toggle rendered markdown view';
  }
  // Hide/show format toolbar based on render state
  var toolbarId = source === "modal" ? "notesModalFormatToolbar" : "notesFormatToolbar";
  var toolbar = document.getElementById(toolbarId);
  if (toolbar) toolbar.style.display = isRendered ? 'none' : '';
}

function toggleNotesViewMode(event) {
  if (event) event.stopPropagation();
  const textarea = document.getElementById("note");
  const rendered = document.getElementById("notes-rendered-output");
  if (!textarea || !rendered) return;

  const isCurrentlyRendered = rendered.style.display !== "none";
  if (isCurrentlyRendered) {
    // Switch to edit — restore textarea at same visual height as rendered div
    const h = rendered.offsetHeight;
    rendered.style.display = "none";
    textarea.style.display = "";
    if (h > 0) textarea.style.height = h + "px";
    textarea.focus();
    _setNotesRenderToggleLabel(false, "main");
  } else {
    // Switch to rendered — capture textarea height first
    const h = textarea.offsetHeight || textarea.scrollHeight;
    if (typeof marked !== "undefined") {
      rendered.innerHTML = marked.parse(textarea.value || "");
    } else {
      rendered.innerHTML = `<pre style="white-space:pre-wrap;">${textarea.value}</pre>`;
    }
    rendered.style.minHeight = h + "px";
    rendered.style.display = "block";
    textarea.style.display = "none";
    _setNotesRenderToggleLabel(true, "main");
  }
}

function copyNotesToClipboard(event, source) {
  if (event) event.stopPropagation();
  let text = "";
  if (source === "modal") {
    const modalInput = document.getElementById("notes-markdown-input-modal");
    text = modalInput ? modalInput.innerText : "";
  } else {
    const textarea = document.getElementById("note");
    text = textarea ? textarea.value : "";
  }
  const btn = event?.target?.closest("button");
  const origHTML = btn ? btn.innerHTML : null;
  navigator.clipboard.writeText(text).then(() => {
    if (btn && origHTML) { btn.innerHTML = "✅"; setTimeout(() => { btn.innerHTML = origHTML; }, 1200); }
  }).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    if (btn && origHTML) { btn.innerHTML = "✅"; setTimeout(() => { btn.innerHTML = origHTML; }, 1200); }
  });
}

function downloadNotes(event, source) {
  if (event) event.stopPropagation();
  let text = "";
  if (source === "modal") {
    const modalInput = document.getElementById("notes-markdown-input-modal");
    text = modalInput ? modalInput.innerText : "";
  } else {
    const textarea = document.getElementById("note");
    text = textarea ? textarea.value : "";
  }
  const title = document.getElementById("title")?.value.trim() || "note";
  const filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".md";
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function openNotesModal(event) {
  if (event) event.stopPropagation();
  const modal = document.getElementById("notesModal");
  if (!modal) return;
  const textarea = document.getElementById("note");
  const modalInput = document.getElementById("notes-markdown-input-modal");
  const modalOutput = document.getElementById("notes-rendered-output-modal");
  if (textarea && modalInput) modalInput.innerText = textarea.value || "";
  if (modalOutput) modalOutput.style.display = "none";
  if (modalInput) modalInput.style.display = "";
  _setNotesRenderToggleLabel(false, "modal");
  modal.style.display = "flex";
  if (modalInput) setTimeout(() => modalInput.focus(), 50);
}

function closeNotesModal(save) {
  const modal = document.getElementById("notesModal");
  if (modal) modal.style.display = "none";
  if (save) {
    const modalInput = document.getElementById("notes-markdown-input-modal");
    const mainNote = document.getElementById("note");
    if (modalInput && mainNote) {
      mainNote.value = modalInput.innerText;
      autoGrowNote(mainNote);
      setSaveButtonUnsaved();
    }
  }
}

function toggleModalNotesRender() {
  const modalInput = document.getElementById("notes-markdown-input-modal");
  const modalOutput = document.getElementById("notes-rendered-output-modal");
  if (!modalInput || !modalOutput) return;
  const isRendered = modalOutput.style.display !== "none";
  if (isRendered) {
    modalOutput.style.display = "none";
    modalInput.style.display = "";
    modalInput.focus();
    _setNotesRenderToggleLabel(false, "modal");
  } else {
    if (typeof marked !== "undefined") {
      modalOutput.innerHTML = marked.parse(modalInput.innerText || "");
    } else {
      modalOutput.innerHTML = `<pre style="white-space:pre-wrap;">${modalInput.innerText}</pre>`;
    }
    modalOutput.style.display = "block";
    modalInput.style.display = "none";
    _setNotesRenderToggleLabel(true, "modal");
  }
}

// ══════════════════════════════════════════════════════════════════════════
// FORMAT TOOLBAR & KEYBOARD SHORTCUTS
// Reuses _emailFormatBtn() and _getEmailFormatAction() from editor-email.js
// ══════════════════════════════════════════════════════════════════════════

/** Wrapper so toolbar buttons and hotkeys call the shared email format function on the notes textarea */
function _notesFormatBtn(action) {
  // If in rendered mode, switch back to edit first
  var rendered = document.getElementById('notes-rendered-output');
  if (rendered && rendered.style.display !== 'none') {
    toggleNotesViewMode();
  }
  _emailFormatBtn(action, 'note');
  autoGrowNote(document.getElementById('note'));
}

/** Alias so the onkeydown handler in the HTML can reference it */
function _getNotesFormatAction(e) {
  return _getEmailFormatAction(e);
}

