const MAX_INDENT_LEVEL = 4;
const CHECKLIST_UNDO_DURATION = 8000;

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

    if (header) {
      var zoneTitle = header.querySelector('.zone-title');
      if (zoneTitle) zoneTitle.appendChild(this.countDisplay);
      header.appendChild(this.clearCheckedButton);
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
    this.render();
    this._notifyChange();
  }

  getChecklistData() {
    return this.items.map(({ id, text, level, checked, parent }) => ({ id, text, level, checked, parent }));
  }

  createInput() {
    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.placeholder = "Add new item and press Enter";
    this.input.className = "checklist-input";
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && this.input.value.trim() !== "") {
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
    if (this.clearCheckedButton) {
      var hasChecked = this.items.some(i => i.checked);
      this.clearCheckedButton.style.display = hasChecked ? "" : "none";
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
    var removed = this.items.filter(i => i.checked);
    this.items = this.items.filter(i => !i.checked);
    this.render();
    this._notifyChange();
    this._showUndoCountdown(removed, "Cleared " + removed.length + " item" + (removed.length > 1 ? "s" : ""));
  }

  /* ── Inline Undo Countdown ──────────────────────────────────────────────── */

  _showUndoCountdown(removedItems, label) {
    if (this._pendingUndo) {
      clearInterval(this._pendingUndo.interval);
      if (this._pendingUndo.el && this._pendingUndo.el.parentNode) this._pendingUndo.el.remove();
      this._pendingUndo = null;
    }
    var self = this;
    var bar = document.createElement("div");
    bar.style.cssText = "display:flex;align-items:center;gap:0.6em;padding:6px 10px;margin:6px 0;background:#fff5e6;border:2px solid #8b5a2b;border-radius:6px;font-size:0.9em;";
    var msg = document.createElement("span");
    msg.style.cssText = "flex:1;color:#1a1208;";
    msg.textContent = "🗑️ " + label;
    bar.appendChild(msg);
    var undoBtn = document.createElement("button");
    undoBtn.textContent = "Undo";
    undoBtn.className = "zone-button";
    undoBtn.style.cssText = "padding:3px 10px;font-size:0.85em;cursor:pointer;flex-shrink:0;";
    bar.appendChild(undoBtn);
    var timerOuter = document.createElement("div");
    timerOuter.style.cssText = "width:60px;height:6px;background:#f5e6cc;border:1px solid #8b4513;border-radius:3px;overflow:hidden;flex-shrink:0;";
    var timerFill = document.createElement("div");
    timerFill.style.cssText = "height:100%;width:100%;background:linear-gradient(90deg,#d4af37,#8b4513);border-radius:2px;";
    timerOuter.appendChild(timerFill);
    bar.appendChild(timerOuter);
    this.input.insertAdjacentElement("afterend", bar);
    var start = Date.now(), dismissed = false;
    var interval = setInterval(function() {
      var pct = Math.max(0, 100 - ((Date.now() - start) / CHECKLIST_UNDO_DURATION) * 100);
      timerFill.style.width = pct + "%";
      if (pct <= 0) { clearInterval(interval); if (!dismissed) { dismissed = true; bar.remove(); self._pendingUndo = null; } }
    }, 50);
    undoBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      if (dismissed) return;
      dismissed = true; clearInterval(interval); bar.remove(); self._pendingUndo = null;
      self.items = self.items.concat(removedItems);
      self.render(); self._notifyChange();
    });
    this._pendingUndo = { interval: interval, el: bar, items: removedItems };
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
          if (idx > 0 && item.level < MAX_INDENT_LEVEL) {
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
    var subtree = this.getSubtree(item);
    var label = item.text ? (item.text.length > 30 ? item.text.slice(0, 30) + '…' : item.text) : "(Untitled)";
    if (subtree.length > 1) label += " +" + (subtree.length - 1);
    element.classList.add("deleting");
    setTimeout(() => {
      this.items = this.items.filter(i => !subtree.some(s => s.id === i.id));
      this.render();
      this._notifyChange();
      this._showUndoCountdown(subtree, label);
    }, 300);
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

  _notifyChange() {
    this._updateCount();
    if (typeof this.onChangeCallback === "function") this.onChangeCallback(this.getChecklistData());
  }
}

window.Checklist = Checklist;
