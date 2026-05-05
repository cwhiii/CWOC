const MAX_INDENT_LEVEL = 4;

class Checklist {
  constructor(container, initialItems = [], onChangeCallback = null) {
    this.container = container;
    this.items = [];
    this.draggedItem = null;
    this.draggedSubtree = [];
    this.dragOverItem = null;
    this.dragOverPosition = null;
    this.editingItem = null;
    this.onChangeCallback = onChangeCallback;
    this._pendingUndo = null;
    this._undoStack = [];
    this._redoStack = [];
    this._maxUndoSize = 50;

    this.init();
    if (initialItems && Array.isArray(initialItems)) this.loadItems(initialItems);
  }

  init() {
    this._createCountDisplay();
    this.createInput();
    this.render();
  }

  _createCountDisplay() {
    var header = document.getElementById("checklistSection")?.querySelector(".zone-header");
    var self = this;
    this.countDisplay = document.createElement("span");
    this.countDisplay.className = "checklist-count-display";
    this.countDisplay.style.cssText = "font-size:0.85em;opacity:0.8;margin-left:0.5em;font-weight:normal;";

    // Clear Checked button — in the zone header
    this.clearCheckedButton = document.createElement("button");
    this.clearCheckedButton.textContent = "Clear Checked";
    this.clearCheckedButton.className = "zone-button";
    this.clearCheckedButton.style.display = "none";
    this.clearCheckedButton.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.clearCheckedItems();
    });

    // Undo button
    this._undoBtn = document.createElement("button");
    this._undoBtn.className = "zone-button notes-undo-redo";
    this._undoBtn.textContent = "↺";
    this._undoBtn.title = "Undo (Cmd+Z)";
    this._undoBtn.disabled = true;
    this._undoBtn.addEventListener("click", function(e) { e.stopPropagation(); e.preventDefault(); self.undo(); });

    // Redo button
    this._redoBtn = document.createElement("button");
    this._redoBtn.className = "zone-button notes-undo-redo";
    this._redoBtn.textContent = "↻";
    this._redoBtn.title = "Redo (Cmd+Shift+Z)";
    this._redoBtn.disabled = true;
    this._redoBtn.addEventListener("click", function(e) { e.stopPropagation(); e.preventDefault(); self.redo(); });

    // Move Checklist → Note button (goes in more menu)
    this._checklistToNoteBtn = document.createElement("button");
    this._checklistToNoteBtn.className = "zone-button";
    this._checklistToNoteBtn.textContent = "☑️→📝";
    this._checklistToNoteBtn.title = "Move checklist items to note";
    this._checklistToNoteBtn.addEventListener("click", function(e) {
      e.stopPropagation(); e.preventDefault();
      _copyChecklistToNote(self);
    });

    // Send Checklist to Another Chit button (goes in more menu)
    this._sendChecklistBtn = document.createElement("button");
    this._sendChecklistBtn.className = "zone-button";
    this._sendChecklistBtn.title = "Send checklist to another chit";
    this._sendChecklistBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    this._sendChecklistBtn.addEventListener("click", function(e) {
      e.stopPropagation(); e.preventDefault();
      if (typeof _openSendContentModal === 'function') _openSendContentModal(e, 'checklist');
    });

    // More menu button
    this._moreBtn = document.createElement("button");
    this._moreBtn.className = "zone-button";
    this._moreBtn.title = "More actions";
    this._moreBtn.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
    this._moreBtn.addEventListener("click", function(e) {
      e.stopPropagation(); e.preventDefault();
      var menu = self._moreMenu;
      var isOpen = menu.style.display === 'flex';
      menu.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) {
        setTimeout(function() {
          document.addEventListener('click', function _close() {
            menu.style.display = 'none';
            document.removeEventListener('click', _close);
          }, { once: true });
        }, 0);
      }
    });

    // More menu dropdown
    this._moreMenu = document.createElement("div");
    this._moreMenu.className = "notes-more-menu";
    this._moreMenu.style.display = "none";

    var menuClear = document.createElement("button");
    menuClear.innerHTML = '<i class="fas fa-broom"></i> Clear checked items';
    menuClear.addEventListener("click", function(e) {
      e.stopPropagation(); e.preventDefault();
      self._moreMenu.style.display = 'none';
      self.clearCheckedItems();
    });
    this._menuClearBtn = menuClear;

    var menuToNote = document.createElement("button");
    menuToNote.innerHTML = '<i class="fas fa-arrow-right"></i> Move to note';
    menuToNote.addEventListener("click", function(e) {
      e.stopPropagation(); e.preventDefault();
      self._moreMenu.style.display = 'none';
      _copyChecklistToNote(self);
    });

    var menuSend = document.createElement("button");
    menuSend.innerHTML = '<i class="fas fa-paper-plane"></i> Send to another chit';
    menuSend.addEventListener("click", function(e) {
      e.stopPropagation(); e.preventDefault();
      self._moreMenu.style.display = 'none';
      if (typeof _openSendContentModal === 'function') _openSendContentModal(e, 'checklist');
    });

    var menuAutosave = document.createElement("button");
    menuAutosave.id = 'checklistAutosaveBtn';
    menuAutosave.innerHTML = '<i class="fas fa-bolt"></i> Auto-save: On';
    menuAutosave.addEventListener("click", function(e) {
      e.stopPropagation(); e.preventDefault();
      self._moreMenu.style.display = 'none';
      if (typeof _toggleChecklistAutosaveChit === 'function') _toggleChecklistAutosaveChit(e);
    });

    this._moreMenu.appendChild(menuClear);
    this._moreMenu.appendChild(menuToNote);
    this._moreMenu.appendChild(menuSend);
    this._moreMenu.appendChild(menuAutosave);
    this._moreBtn.style.position = "relative";
    this._moreBtn.appendChild(this._moreMenu);

    if (header) {
      var zoneTitle = header.querySelector('.zone-title');
      if (zoneTitle) zoneTitle.appendChild(this.countDisplay);
      // Insert buttons into zone-actions: undo, redo pushed right; more button
      var zoneActions = header.querySelector('.zone-actions');
      if (zoneActions) {
        zoneActions.insertBefore(this._moreBtn, zoneActions.firstChild);
        zoneActions.insertBefore(this._redoBtn, zoneActions.firstChild);
        zoneActions.insertBefore(this._undoBtn, zoneActions.firstChild);
      } else {
        header.appendChild(this._undoBtn);
        header.appendChild(this._redoBtn);
        header.appendChild(this._moreBtn);
      }
    }
  }

  loadItems(itemsArray) {
    this.items = itemsArray.map((item) => ({
      id: item.id || this.generateId(),
      text: item.text || "",
      level: Math.min(item.level || 0, MAX_INDENT_LEVEL),
      checked: !!item.checked,
      parent: item.parent || null,
    }));
    // Reset undo/redo on fresh load — this isn't a user action
    this._undoStack = [];
    this._redoStack = [];
    this._updateUndoRedoButtons();
    this.render();
    // Notify without pushing to undo stack
    this._updateCount();
    if (typeof this.onChangeCallback === "function") this.onChangeCallback(this.getChecklistData());
  }

  getChecklistData() {
    return this.items.map(({ id, text, level, checked, parent }) => ({ id, text, level, checked, parent }));
  }

  createInput() {
    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.placeholder = "Add new item and press Enter";
    this.input.className = "checklist-input";
    var self = this;
    this.input.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault(); self.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault(); self.redo();
      } else if (e.key === "Enter" && this.input.value.trim() !== "") {
        this.addNewItem(this.input.value.trim());
        this.input.value = "";
      } else if (e.key === "Escape") {
        if (typeof cancelOrExit === "function") cancelOrExit();
      }
    });
    this.container.insertBefore(this.input, this.container.firstChild);
  }

  addNewItem(text, level = 0, checked = false, id = null) {
    var newItem = { id: id || this.generateId(), text, level: Math.min(level, MAX_INDENT_LEVEL), checked, parent: null };
    if (this.items.length > 0 && newItem.level > 0) {
      for (var i = this.items.length - 1; i >= 0; i--) {
        if (this.items[i].level === newItem.level - 1) { newItem.parent = this.items[i].id; break; }
      }
    }
    this.items.push(newItem);
    this.render();
    this._notifyChange();
  }

  generateId() { return "item-" + Math.random().toString(36).substr(2, 9); }

  /* ── Render ─────────────────────────────────────────────────────────────── */

  render() {
    this.container.querySelectorAll(".checklist-item, .completed-checklist-item, .ghost-checklist-item").forEach(el => el.remove());

    var uncheckedItems = this.items.filter(i => !i.checked);
    var checkedItems = this.items.filter(i => i.checked);

    var insertAfter = this.input;
    uncheckedItems.forEach(item => {
      var el = this.createItemElement(item);
      insertAfter.insertAdjacentElement("afterend", el);
      insertAfter = el;
    });

    // Completed section (collapsible, with Clear Checked button)
    if (!this.completedContainer) {
      this.completedContainer = document.createElement("div");
      this.completedContainer.className = "completed-checklist-container";

      var hdr = document.createElement("div");
      hdr.className = "completed-section-header";
      hdr.style.cssText = "display:flex;align-items:center;gap:0.5em;cursor:pointer;padding:6px 0;user-select:none;border-top:1px solid var(--aged-brown-light,#a0522d);margin-top:6px;";

      var title = document.createElement("h3");
      title.textContent = "Completed";
      title.style.cssText = "margin:0;font-size:0.95em;";
      hdr.appendChild(title);

      this._completedCountSpan = document.createElement("span");
      this._completedCountSpan.style.cssText = "font-size:0.85em;opacity:0.7;font-weight:normal;";
      hdr.appendChild(this._completedCountSpan);

      var spacer = document.createElement("span");
      spacer.style.flex = "1";
      hdr.appendChild(spacer);

      this._completedToggleIcon = document.createElement("span");
      this._completedToggleIcon.textContent = "▶";
      this._completedToggleIcon.style.cssText = "font-size:0.8em;padding:0 4px;";
      hdr.appendChild(this._completedToggleIcon);

      this._completedBody = document.createElement("div");
      this._completedBody.className = "completed-section-body";
      this._completedExpanded = false;
      this._completedBody.style.display = "none";

      hdr.addEventListener("click", (e) => {
        if (e.target.closest('button')) return; // don't toggle when clicking Clear
        this._completedExpanded = !this._completedExpanded;
        this._completedBody.style.display = this._completedExpanded ? "" : "none";
        this._completedToggleIcon.textContent = this._completedExpanded ? "▼" : "▶";
      });

      this.completedContainer.appendChild(hdr);
      this.completedContainer.appendChild(this._completedBody);
      this.container.appendChild(this.completedContainer);
    }

    this._completedBody.querySelectorAll(".completed-checklist-item, .ghost-checklist-item").forEach(el => el.remove());
    this.completedContainer.style.display = checkedItems.length > 0 ? "" : "none";
    if (this._completedCountSpan) this._completedCountSpan.textContent = "(" + checkedItems.length + ")";

    var ghostParentsMap = new Map();
    checkedItems.forEach(item => {
      var p = this.getParent(item);
      while (p) { if (!checkedItems.find(ci => ci.id === p.id)) ghostParentsMap.set(p.id, p); p = this.getParent(p); }
    });

    this.items.forEach(item => {
      if (item.checked) {
        this._completedBody.appendChild(this.createItemElement(item, true, false));
      } else if (ghostParentsMap.has(item.id)) {
        this._completedBody.appendChild(this.createItemElement(item, false, true));
      }
    });

    this._updateCount();
  }

  _updateCount() {
    if (this.countDisplay) {
      var total = this.items.length;
      var checked = this.items.filter(i => i.checked).length;
      this.countDisplay.textContent = total > 0 ? "(" + checked + " / " + total + ")" : "";
    }
    if (this._menuClearBtn) {
      var hasChecked = this.items.some(i => i.checked);
      this._menuClearBtn.style.display = hasChecked ? "" : "none";
    }
  }

  async clearCheckedItems() {
    var checkedCount = this.items.filter(i => i.checked).length;
    if (checkedCount === 0) return;
    var confirmed = false;
    if (typeof cwocConfirm === 'function') {
      confirmed = await cwocConfirm("Delete " + checkedCount + " checked item" + (checkedCount > 1 ? "s" : "") + "?", { title: "Clear Checked", danger: true, confirmLabel: "Delete" });
    } else {
      confirmed = confirm("Delete " + checkedCount + " checked item" + (checkedCount > 1 ? "s" : "") + "?");
    }
    if (!confirmed) return;
    this._pushUndoState();
    var removed = this.items.filter(i => i.checked);
    this.items = this.items.filter(i => !i.checked);
    this.render();
    this._notifyChange();
  }

  /* ── Item Element ───────────────────────────────────────────────────────── */

  createItemElement(item, isCompleted, isGhost) {
    isCompleted = isCompleted || false;
    isGhost = isGhost || false;
    var el = document.createElement("div");
    el.className = isGhost ? "ghost-checklist-item" : isCompleted ? "completed-checklist-item" : "checklist-item";
    el.setAttribute("draggable", "true");
    el.dataset.id = item.id;

    var left = document.createElement("div");
    left.className = "left-container";
    left.style.paddingLeft = item.level * 20 + "px";

    // 6-dot drag indicator
    var dragHandle = document.createElement("span");
    dragHandle.className = "checklist-drag-handle";
    dragHandle.textContent = "⠿";
    dragHandle.title = "Drag to reorder";
    left.appendChild(dragHandle);

    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = item.checked;
    cb.addEventListener("change", () => this.toggleCheck(item, cb.checked));
    left.appendChild(cb);

    var tw = document.createElement("div");
    tw.className = "text-wrapper";

    var span = document.createElement("span");
    span.className = "checklist-text";
    span.style.whiteSpace = "pre-wrap";
    span.textContent = item.text;
    span.addEventListener("click", (e) => { e.stopPropagation(); this.startEditing(item, span, e); });
    tw.appendChild(span);

    // Click anywhere on the text-wrapper (including empty space) to edit
    tw.addEventListener("click", (e) => {
      if (e.target === tw) {
        e.stopPropagation();
        // If already editing this item, focus the textarea and put cursor at end
        var existingTa = tw.querySelector("textarea.checklist-edit-input");
        if (existingTa) {
          existingTa.focus();
          existingTa.setSelectionRange(existingTa.value.length, existingTa.value.length);
        } else {
          this.startEditing(item, span, e);
        }
      }
    });

    left.appendChild(tw);
    el.appendChild(left);

    // Click on empty space in the left-container (between checkbox and text) to edit
    left.addEventListener("click", (e) => {
      if (e.target === left) {
        e.stopPropagation();
        var existingTa = tw.querySelector("textarea.checklist-edit-input");
        if (existingTa) {
          existingTa.focus();
          existingTa.setSelectionRange(existingTa.value.length, existingTa.value.length);
        } else {
          this.startEditing(item, span, e);
        }
      }
    });

    var trash = document.createElement("span");
    trash.className = "trash-icon";
    trash.textContent = "🗑️";
    trash.title = "Delete item";
    trash.style.visibility = "hidden";
    trash.addEventListener("click", (e) => { e.stopPropagation(); this.deleteItem(item, el); });
    el.appendChild(trash);

    el.addEventListener("mouseenter", () => { trash.style.visibility = "visible"; });
    el.addEventListener("mouseleave", () => { trash.style.visibility = "hidden"; });

    if (!isGhost) {
      el.addEventListener("dragstart", (e) => this.onDragStart(e, item));
      el.addEventListener("dragover", (e) => this.onDragOver(e, item));
      el.addEventListener("dragleave", (e) => this.onDragLeave(e, item));
      el.addEventListener("drop", (e) => this.onDrop(e, item));

      // Touch drag support for mobile
      var self = this;
      if (typeof enableTouchDrag === 'function') {
        enableTouchDrag(el, {
          onStart: function() {
            self.draggedItem = item;
            self.draggedSubtree = self.getSubtree(item);
            el.classList.add('dragging');
          },
          onMove: function(data) {
            self.clearDropIndicator();
            var target = document.elementFromPoint(data.clientX, data.clientY);
            if (!target) return;
            var targetEl = target.closest('.checklist-item, .completed-checklist-item');
            if (!targetEl || targetEl === el) return;
            var targetId = targetEl.dataset.id;
            var targetItem = self.items.find(function(i) { return i.id === targetId; });
            if (!targetItem || self.draggedSubtree.some(function(s) { return s.id === targetId; })) return;
            var rect = targetEl.getBoundingClientRect();
            var off = data.clientY - rect.top;
            var h = rect.height;
            if (off < h / 3) { targetEl.classList.add('drag-over-above'); self.dragOverPosition = 'above'; }
            else if (off > 2 * h / 3) { targetEl.classList.add('drag-over-below'); self.dragOverPosition = 'below'; }
            else { targetEl.classList.add('drag-over-on'); self.dragOverPosition = 'on'; }
            self.dragOverItem = targetItem;
          },
          onEnd: function(data) {
            el.classList.remove('dragging');
            if (!self.draggedItem || !self.dragOverItem) {
              self.draggedItem = null; self.draggedSubtree = []; self.dragOverItem = null;
              self.clearDropIndicator();
              return;
            }
            // Reuse the same drop logic as onDrop
            var targetItem = self.dragOverItem;
            self.items = self.items.filter(function(i) { return !self.draggedSubtree.some(function(s) { return s.id === i.id; }); });
            var ti = self.items.findIndex(function(i) { return i.id === targetItem.id; });
            if (self.dragOverPosition === 'on') {
              self.draggedItem.parent = targetItem.id; self.draggedItem.level = targetItem.level + 1;
              self._updateSubLevels(self.draggedSubtree, self.draggedItem.level);
              var ii = ti + 1; while (ii < self.items.length && self._isDesc(self.items[ii], targetItem)) ii++;
              self.items.splice(ii, 0, ...self.draggedSubtree);
            } else if (self.dragOverPosition === 'above') {
              self.draggedItem.parent = targetItem.parent; self.draggedItem.level = targetItem.level;
              self._updateSubLevels(self.draggedSubtree, self.draggedItem.level);
              self.items.splice(ti, 0, ...self.draggedSubtree);
            } else if (self.dragOverPosition === 'below') {
              self.draggedItem.parent = targetItem.parent; self.draggedItem.level = targetItem.level;
              self._updateSubLevels(self.draggedSubtree, self.draggedItem.level);
              var ii = ti + 1; while (ii < self.items.length && self.items[ii].level > targetItem.level) ii++;
              self.items.splice(ii, 0, ...self.draggedSubtree);
            }
            self.draggedItem = null; self.draggedSubtree = []; self.dragOverItem = null; self.dragOverPosition = null;
            self.clearDropIndicator();
            self.render(); self._notifyChange();
          }
        });
      }
    }
    return el;
  }

  /* ── Inline Editing (textarea for multi-line via Shift+Enter) ───────────── */

  startEditing(item, textSpan, clickEvent) {
    if (this.editingItem) return;
    this.editingItem = item;

    // Disable draggable on the parent item so clicks work normally in the textarea
    var itemEl = textSpan.closest('.checklist-item, .completed-checklist-item, .ghost-checklist-item');
    if (itemEl) itemEl.setAttribute("draggable", "false");

    // Use textarea so Shift+Enter can insert newlines
    var ta = document.createElement("textarea");
    ta.value = item.text;
    ta.className = "checklist-text checklist-edit-input";
    ta.rows = 1;

    var textWrapper = textSpan.parentNode;
    textSpan.style.display = "none";
    textWrapper.appendChild(ta);

    // Auto-size textarea to content
    var autoSize = function() {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    };
    ta.addEventListener('input', autoSize);

    ta.focus();
    autoSize();

    // Position cursor at click location
    if (clickEvent) {
      requestAnimationFrame(function() {
        var rect = ta.getBoundingClientRect();
        var clickX = clickEvent.clientX - rect.left - 4;
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var style = window.getComputedStyle(ta);
        ctx.font = style.fontSize + ' ' + style.fontFamily;
        var bestPos = 0;
        // Only measure first line for click positioning
        var firstLine = ta.value.split('\n')[0] || '';
        for (var i = 0; i <= firstLine.length; i++) {
          if (ctx.measureText(firstLine.substring(0, i)).width <= clickX) bestPos = i;
          else break;
        }
        ta.setSelectionRange(bestPos, bestPos);
      });
    } else {
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }

    var self = this;

    var finishEditing = function(save) {
      if (!self.editingItem) return;
      if (save && ta.value.trim() !== "") {
        item.text = ta.value.trim();
        self._notifyChange();
      }
      // Re-enable draggable
      if (itemEl) itemEl.setAttribute("draggable", "true");
      ta.remove();
      textSpan.style.display = "";
      textSpan.textContent = item.text;
      self.editingItem = null;
    };

    var addNewItemBelow = function() {
      if (ta.value.trim() !== "") { item.text = ta.value.trim(); self._notifyChange(); }
      var idx = self.items.findIndex(i => i.id === item.id);
      var newItem = { id: self.generateId(), text: "", level: item.level, checked: false, parent: item.parent };
      var insertIdx = idx + 1;
      while (insertIdx < self.items.length && self.items[insertIdx].level > item.level) insertIdx++;
      self.items.splice(insertIdx, 0, newItem);
      ta.remove(); textSpan.style.display = ""; textSpan.textContent = item.text; self.editingItem = null;
      self.render();
      setTimeout(function() {
        var newEl = self.container.querySelector('[data-id="' + newItem.id + '"]');
        if (newEl) { var ns = newEl.querySelector(".checklist-text"); self.startEditing(newItem, ns); }
      }, 0);
    };

    var navigateToItem = function(direction) {
      var idx = self.items.findIndex(i => i.id === item.id);
      var target = null;
      if (direction === "previous" && idx > 0) target = self.items[idx - 1];
      else if (direction === "next" && idx < self.items.length - 1) target = self.items[idx + 1];
      if (target && !target.checked) {
        if (ta.value.trim() !== "") { item.text = ta.value.trim(); self._notifyChange(); }
        ta.remove(); textSpan.style.display = ""; textSpan.textContent = item.text; self.editingItem = null;
        self.render();
        setTimeout(function() {
          var el = self.container.querySelector('[data-id="' + target.id + '"]');
          if (el) {
            var ts = el.querySelector(".checklist-text");
            self.startEditing(target, ts);
            setTimeout(function() {
              var inp = el.querySelector("textarea.checklist-edit-input");
              if (inp) {
                var pos = direction === "previous" ? inp.value.length : 0;
                inp.setSelectionRange(pos, pos);
              }
            }, 0);
          }
        }, 0);
      }
    };

    ta.addEventListener("keydown", function(e) {
      e.stopPropagation();
      if (e.key === "Enter" && e.shiftKey) {
        // Shift+Enter: insert newline (default textarea behavior — do nothing)
        setTimeout(autoSize, 0);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        addNewItemBelow();
      } else if (e.key === "Escape") {
        finishEditing(false);
      } else if ((e.key === "[" || e.key === "]") && (e.metaKey || e.ctrlKey)) {
        // Cmd+[ = unindent, Cmd+] = indent (prevent browser back/forward)
        e.preventDefault();
        var idx = self.items.indexOf(item);
        if (e.key === "[") {
          if (item.level > 0) {
            item.level = Math.max(0, item.level - 1);
            item.parent = null;
            for (var i = idx - 1; i >= 0; i--) { if (self.items[i].level === item.level - 1) { item.parent = self.items[i].id; break; } }
            finishEditing(true); self.render(); self._notifyChange();
            setTimeout(function() { var el = self.container.querySelector('[data-id="' + item.id + '"] .checklist-text'); if (el) el.click(); }, 0);
          }
        } else {
          var prevLevel = idx > 0 ? self.items[idx - 1].level : -1;
          if (idx > 0 && item.level < MAX_INDENT_LEVEL && item.level <= prevLevel) {
            item.level = Math.min(item.level + 1, MAX_INDENT_LEVEL);
            item.parent = null;
            for (var i = idx - 1; i >= 0; i--) { if (self.items[i].level === item.level - 1) { item.parent = self.items[i].id; break; } }
            finishEditing(true); self.render(); self._notifyChange();
            setTimeout(function() { var el = self.container.querySelector('[data-id="' + item.id + '"] .checklist-text'); if (el) el.click(); }, 0);
          }
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        var idx = self.items.indexOf(item);
        if (e.shiftKey) {
          if (item.level > 0) {
            item.level = Math.max(0, item.level - 1);
            item.parent = null;
            for (var i = idx - 1; i >= 0; i--) { if (self.items[i].level === item.level - 1) { item.parent = self.items[i].id; break; } }
            finishEditing(true); self.render(); self._notifyChange();
            setTimeout(function() { var el = self.container.querySelector('[data-id="' + item.id + '"] .checklist-text'); if (el) el.click(); }, 0);
          }
        } else {
          var prevLevel = idx > 0 ? self.items[idx - 1].level : -1;
          if (idx > 0 && item.level < MAX_INDENT_LEVEL && item.level <= prevLevel) {
            item.level = Math.min(item.level + 1, MAX_INDENT_LEVEL);
            item.parent = null;
            for (var i = idx - 1; i >= 0; i--) { if (self.items[i].level === item.level - 1) { item.parent = self.items[i].id; break; } }
            finishEditing(true); self.render(); self._notifyChange();
            setTimeout(function() { var el = self.container.querySelector('[data-id="' + item.id + '"] .checklist-text'); if (el) el.click(); }, 0);
          }
        }
      } else if (e.key === "ArrowUp") {
        if (ta.selectionStart === 0) { e.preventDefault(); navigateToItem("previous"); }
      } else if (e.key === "ArrowDown") {
        if (ta.selectionStart === ta.value.length) { e.preventDefault(); navigateToItem("next"); }
      }
    });

    ta.addEventListener("blur", function() { finishEditing(true); });
  }

  /* ── Check / Delete ─────────────────────────────────────────────────────── */

  toggleCheck(item, checked) {
    item.checked = checked;
    this.updateCheckedStateForSubtree(item, checked);
    this.render();
    this._notifyChange();
  }

  updateCheckedStateForSubtree(item, checked) {
    this.getChildren(item).forEach(child => { child.checked = checked; this.updateCheckedStateForSubtree(child, checked); });
  }

  getParent(item) { return this.items.find(i => i.id === item.parent); }
  getChildren(item) { return this.items.filter(i => i.parent === item.id); }

  deleteItem(item, element) {
    var self = this;
    var children = this.getChildren(item);
    element.classList.add("deleting");
    setTimeout(function() {
      self._pushUndoState();
      if (children.length > 0) {
        // Promote children: re-parent to deleted item's parent, reduce level by 1 for entire subtree
        children.forEach(function(child) {
          child.parent = item.parent || null;
          child.level = Math.max(0, child.level - 1);
          // Also promote all descendants of this child
          var descendants = self._getDescendants(child);
          descendants.forEach(function(d) {
            d.level = Math.max(0, d.level - 1);
          });
        });
      }
      // Remove only the deleted item (not its children)
      self.items = self.items.filter(function(i) { return i.id !== item.id; });
      self.render();
      self._notifyChange();
    }, 300);
  }

  /** Get all descendants of an item (children, grandchildren, etc.) */
  _getDescendants(item) {
    var result = [];
    var children = this.getChildren(item);
    children.forEach(function(child) {
      result.push(child);
      result = result.concat(this._getDescendants(child));
    }, this);
    return result;
  }

  getSubtree(item) {
    var sub = [item];
    this.getChildren(item).forEach(c => { sub = sub.concat(this.getSubtree(c)); });
    return sub;
  }

  /* ── Drag & Drop ────────────────────────────────────────────────────────── */

  onDragStart(e, item) {
    this.draggedItem = item; this.draggedSubtree = this.getSubtree(item);
    e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id);
    e.currentTarget.classList.add("dragging");
  }
  onDragOver(e, item) {
    e.preventDefault();
    if (!this.draggedItem || item.id === this.draggedItem.id) return;
    var el = e.currentTarget, rect = el.getBoundingClientRect(), off = e.clientY - rect.top, h = rect.height;
    this.clearDropIndicator();
    if (off < h / 3) { this.dragOverPosition = "above"; el.classList.add("drag-over-above"); }
    else if (off > 2 * h / 3) { this.dragOverPosition = "below"; el.classList.add("drag-over-below"); }
    else { this.dragOverPosition = "on"; el.classList.add("drag-over-on"); }
    this.dragOverItem = item;
  }
  onDragLeave() { this.clearDropIndicator(); }
  onDrop(e, item) {
    e.preventDefault(); this.clearDropIndicator();
    if (!this.draggedItem) return;
    if (this.draggedSubtree.some(s => s.id === item.id)) { this.draggedItem = null; this.draggedSubtree = []; return; }
    this.items = this.items.filter(i => !this.draggedSubtree.some(s => s.id === i.id));
    var ti = this.items.findIndex(i => i.id === item.id);
    if (this.dragOverPosition === "on") {
      this.draggedItem.parent = item.id; this.draggedItem.level = item.level + 1;
      this._updateSubLevels(this.draggedSubtree, this.draggedItem.level);
      var ii = ti + 1; while (ii < this.items.length && this._isDesc(this.items[ii], item)) ii++;
      this.items.splice(ii, 0, ...this.draggedSubtree);
    } else if (this.dragOverPosition === "above") {
      this.draggedItem.parent = item.parent; this.draggedItem.level = item.level;
      this._updateSubLevels(this.draggedSubtree, this.draggedItem.level);
      this.items.splice(ti, 0, ...this.draggedSubtree);
    } else if (this.dragOverPosition === "below") {
      this.draggedItem.parent = item.parent; this.draggedItem.level = item.level;
      this._updateSubLevels(this.draggedSubtree, this.draggedItem.level);
      var ii = ti + 1; while (ii < this.items.length && this.items[ii].level > item.level) ii++;
      this.items.splice(ii, 0, ...this.draggedSubtree);
    }
    this.draggedItem = null; this.draggedSubtree = []; this.dragOverItem = null; this.dragOverPosition = null;
    this.render(); this._notifyChange();
  }
  clearDropIndicator() {
    this.container.querySelectorAll(".checklist-item, .completed-checklist-item, .ghost-checklist-item").forEach(el => {
      el.classList.remove("drag-over-above", "drag-over-below", "drag-over-on", "dragging");
    });
  }
  _updateSubLevels(sub, rootLvl) { var d = rootLvl - sub[0].level; sub.forEach(i => { i.level += d; }); }
  _isDesc(item, ancestor) { var p = this.getParent(item); while (p) { if (p.id === ancestor.id) return true; p = this.getParent(p); } return false; }

  _pushUndoState() {
    var snapshot = JSON.stringify(this.items.map(function(i) { return { id: i.id, text: i.text, level: i.level, checked: i.checked, parent: i.parent }; }));
    // Don't push if identical to last state
    if (this._undoStack.length > 0 && this._undoStack[this._undoStack.length - 1] === snapshot) return;
    this._undoStack.push(snapshot);
    if (this._undoStack.length > this._maxUndoSize) this._undoStack.shift();
    this._redoStack = [];
    this._updateUndoRedoButtons();
  }

  undo() {
    if (this._undoStack.length === 0) return;
    // Save current state to redo
    var current = JSON.stringify(this.items.map(function(i) { return { id: i.id, text: i.text, level: i.level, checked: i.checked, parent: i.parent }; }));
    this._redoStack.push(current);
    // Restore previous state
    var prev = JSON.parse(this._undoStack.pop());
    this.items = prev;
    this.render();
    this._updateCount();
    if (typeof this.onChangeCallback === "function") this.onChangeCallback(this.getChecklistData());
    this._updateUndoRedoButtons();
  }

  redo() {
    if (this._redoStack.length === 0) return;
    // Save current state to undo
    var current = JSON.stringify(this.items.map(function(i) { return { id: i.id, text: i.text, level: i.level, checked: i.checked, parent: i.parent }; }));
    this._undoStack.push(current);
    // Restore next state
    var next = JSON.parse(this._redoStack.pop());
    this.items = next;
    this.render();
    this._updateCount();
    if (typeof this.onChangeCallback === "function") this.onChangeCallback(this.getChecklistData());
    this._updateUndoRedoButtons();
  }

  _updateUndoRedoButtons() {
    if (this._undoBtn) this._undoBtn.disabled = this._undoStack.length === 0;
    if (this._redoBtn) this._redoBtn.disabled = this._redoStack.length === 0;
  }

  _notifyChange() {
    this._pushUndoState();
    this._updateCount();
    if (typeof this.onChangeCallback === "function") this.onChangeCallback(this.getChecklistData());
    // Auto-complete: if all items are checked and auto-complete is enabled
    _checkAutoCompleteChecklist(this);
  }
}

window.Checklist = Checklist;

// ── Copy Note ↔ Checklist ────────────────────────────────────────────────────

/**
 * Wrapper called from the Notes zone header button.
 * Delegates to _copyNoteToChecklist with the global checklist instance.
 */
function _noteToChecklistFromHeader(e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  if (window.checklist) _copyNoteToChecklist(window.checklist);
}

/**
 * Move note lines into checklist items. Each non-empty line becomes an item.
 * Lines starting with "- " or "* " have the prefix stripped.
 * Indented lines (2 or 4 spaces, or tab) get corresponding indent levels.
 * Clears the note after moving.
 */
function _copyNoteToChecklist(checklist) {
  var noteEl = document.getElementById('note');
  if (!noteEl || !noteEl.value.trim()) return;
  var lines = noteEl.value.split('\n');
  var newItems = [];
  lines.forEach(function(line) {
    if (!line.trim()) return;
    // Detect indent level
    var indent = 0;
    var stripped = line;
    while (stripped.startsWith('    ') || stripped.startsWith('\t')) {
      indent++;
      stripped = stripped.startsWith('\t') ? stripped.slice(1) : stripped.slice(4);
    }
    if (stripped.startsWith('  ')) { indent++; stripped = stripped.slice(2); }
    // Strip list markers
    stripped = stripped.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').replace(/^\[[ x]\]\s*/i, '');
    if (!stripped.trim()) return;
    newItems.push({
      id: checklist.generateId(),
      text: stripped.trim(),
      level: Math.min(indent, MAX_INDENT_LEVEL),
      checked: false,
      parent: null
    });
  });
  if (newItems.length === 0) return;
  // Assign parents based on levels
  for (var i = 1; i < newItems.length; i++) {
    if (newItems[i].level > 0) {
      for (var j = i - 1; j >= 0; j--) {
        if (newItems[j].level === newItems[i].level - 1) { newItems[i].parent = newItems[j].id; break; }
      }
    }
  }
  checklist.items = checklist.items.concat(newItems);
  checklist.render();
  checklist._notifyChange();
  // Clear the note (move, not copy)
  noteEl.value = '';
  if (typeof autoGrowNote === 'function') autoGrowNote(noteEl);
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
  var rendered = document.getElementById('notes-rendered-output');
  if (rendered && rendered.style.display !== 'none') rendered.innerHTML = '';
}

/**
 * Move checklist items into the note field. Each item becomes a line,
 * indented with spaces to reflect its level. Checked items get [x] prefix.
 * Clears the checklist after moving.
 */
function _copyChecklistToNote(checklist) {
  var noteEl = document.getElementById('note');
  if (!noteEl) return;
  if (!checklist.items || checklist.items.length === 0) return;
  var lines = checklist.items.map(function(item) {
    var prefix = '  '.repeat(item.level);
    var marker = item.checked ? '[x] ' : '- ';
    return prefix + marker + item.text;
  });
  var text = lines.join('\n');
  // Append to existing note with a blank line separator
  if (noteEl.value.trim()) {
    noteEl.value = noteEl.value.trimEnd() + '\n\n' + text;
  } else {
    noteEl.value = text;
  }
  // Clear the checklist (move, not copy)
  checklist.items = [];
  checklist.render();
  checklist._notifyChange();
  // Trigger auto-grow and mark unsaved
  if (typeof autoGrowNote === 'function') autoGrowNote(noteEl);
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
  // Refresh rendered view if currently showing
  var rendered = document.getElementById('notes-rendered-output');
  if (rendered && rendered.style.display !== 'none') {
    if (typeof marked !== 'undefined') {
      rendered.innerHTML = marked.parse(noteEl.value || '');
    } else {
      rendered.innerHTML = '<pre style="white-space:pre-wrap;">' + noteEl.value + '</pre>';
    }
  }
}

// ── Checklist Auto-Complete / Auto-Archive ───────────────────────────────────

var _checklistAutoComplete = false;
var _checklistAutoArchive = false;

/**
 * Toggle the auto-complete setting for the checklist.
 * When enabled, marking the last checklist item as checked will:
 *   1. Set the chit status to "Complete"
 *   2. Optionally archive the chit (if auto-archive is also enabled)
 */
function _toggleChecklistAutoComplete(e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }

  // Cycle through: Off → Auto-Complete → Auto-Complete + Archive → Off
  var btn = document.getElementById('checklistAutoCompleteBtn');
  if (!_checklistAutoComplete) {
    _checklistAutoComplete = true;
    _checklistAutoArchive = false;
    if (btn) { btn.textContent = '🏁 Auto-Complete ✓'; btn.title = 'Click again to also auto-archive'; }
  } else if (!_checklistAutoArchive) {
    _checklistAutoArchive = true;
    if (btn) { btn.textContent = '🏁 Auto-Complete + Archive ✓'; btn.title = 'Click again to disable'; }
  } else {
    _checklistAutoComplete = false;
    _checklistAutoArchive = false;
    if (btn) { btn.textContent = '🏁 Auto-Complete'; btn.title = 'Auto-complete chit when all items checked'; }
  }
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

/**
 * Check if all checklist items are checked and auto-complete is enabled.
 * If so, set status to Complete and optionally archive.
 */
function _checkAutoCompleteChecklist(checklist) {
  if (!_checklistAutoComplete) return;
  if (!checklist || !checklist.items || checklist.items.length === 0) return;

  var allChecked = checklist.items.every(function(item) { return item.checked; });
  if (!allChecked) return;

  // Set status to Complete
  var statusSelect = document.getElementById('status');
  if (statusSelect && statusSelect.value !== 'Complete') {
    statusSelect.value = 'Complete';
    if (typeof onStatusChange === 'function') onStatusChange();
  }

  // Auto-archive if enabled
  if (_checklistAutoArchive) {
    var archivedInput = document.getElementById('archived');
    if (archivedInput && archivedInput.value !== 'true') {
      archivedInput.value = 'true';
      var archiveBtn = document.getElementById('archivedButton');
      if (archiveBtn) {
        archiveBtn.textContent = '📦 Archived';
        archiveBtn.classList.add('archived-active');
        archiveBtn.title = 'Archived (click to unarchive)';
      }
    }
  }

  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}
