const MAX_INDENT_LEVEL = 4;

class Checklist {
  /**
   * @param {HTMLElement} container - The container element to render the checklist into.
   * @param {Array} initialItems - Optional initial checklist items to load.
   * @param {Function} onChangeCallback - Optional callback to notify when checklist data changes.
   */
  constructor(container, initialItems = [], onChangeCallback = null) {
    this.container = container;
    this.items = [];
    this.deletedStack = [];
    this.draggedItem = null;
    this.draggedSubtree = [];
    this.dragOverItem = null;
    this.dragOverPosition = null; // 'above', 'below', 'on'
    this.editingItem = null;
    this.onChangeCallback = onChangeCallback;

    this.init();

    if (initialItems && Array.isArray(initialItems)) {
      this.loadItems(initialItems);
    }
  }

  init() {
    this.createInput();
    this.createUndoButton();
    this.render();
  }

  /**
   * Load checklist items from an array, replacing current items.
   * @param {Array} itemsArray
   */
  loadItems(itemsArray) {
    // Defensive copy and validation
    this.items = itemsArray.map((item) => ({
      id: item.id || this.generateId(),
      text: item.text || "",
      level: Math.min(item.level || 0, MAX_INDENT_LEVEL),
      checked: !!item.checked,
      parent: item.parent || null,
    }));
    this.deletedStack = [];
    this.render();
    this._notifyChange();
  }

  /**
   * Returns a deep copy of current checklist items suitable for JSON serialization.
   */
  getChecklistData() {
    // Return a deep copy to avoid external mutation
    return this.items.map(({ id, text, level, checked, parent }) => ({
      id,
      text,
      level,
      checked,
      parent,
    }));
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
        // ESC on the add-item input: same as clicking Cancel/Exit
        if (typeof cancelOrExit === "function") cancelOrExit();
      }
    });
    this.container.insertBefore(this.input, this.container.firstChild);
  }

  createUndoButton() {
    const header = document
      .getElementById("checklistSection")
      ?.querySelector(".zone-header");
    this.undoButton = document.createElement("button");
    this.undoButton.textContent = "Undo Delete";
    this.undoButton.style.display = "none";
    this.undoButton.className = "undo-delete-button zone-button";
    this.undoButton.addEventListener("click", () => {
      this.undoDelete();
    });
    if (header) {
      header.appendChild(this.undoButton);
    } else {
      this.container.appendChild(this.undoButton);
    }
  }

  addNewItem(text, level = 0, checked = false, id = null) {
    const newItem = {
      id: id || this.generateId(),
      text,
      level: Math.min(level, MAX_INDENT_LEVEL),
      checked,
      parent: null,
    };

    if (this.items.length > 0 && newItem.level > 0) {
      for (let i = this.items.length - 1; i >= 0; i--) {
        if (this.items[i].level === newItem.level - 1) {
          newItem.parent = this.items[i].id;
          break;
        }
      }
    }

    this.items.push(newItem);
    this.render();
    this._notifyChange();
  }

  generateId() {
    return "item-" + Math.random().toString(36).substr(2, 9);
  }

  render() {
    // Remove all checklist items except input and undo button
    const existingItems = this.container.querySelectorAll(
      ".checklist-item, .completed-checklist-item, .ghost-checklist-item",
    );
    existingItems.forEach((el) => el.remove());

    // Separate checked and unchecked items
    const uncheckedItems = this.items.filter((item) => !item.checked);
    const checkedItems = this.items.filter((item) => item.checked);

    // Render unchecked items in correct order (append after input)
    let insertAfter = this.input;
    uncheckedItems.forEach((item) => {
      const el = this.createItemElement(item);
      insertAfter.insertAdjacentElement("afterend", el);
      insertAfter = el; // Next item goes after this one
    });

    // Prepare completed container
    if (!this.completedContainer) {
      this.completedContainer = document.createElement("div");
      this.completedContainer.className = "completed-checklist-container";
      const header = document.createElement("h3");
      header.textContent = "Completed";
      this.completedContainer.appendChild(header);
      this.container.appendChild(this.completedContainer);
    }

    // Clear previous completed items
    const oldCompletedItems = this.completedContainer.querySelectorAll(
      ".completed-checklist-item, .ghost-checklist-item",
    );
    oldCompletedItems.forEach((el) => el.remove());

    // Collect parents of checked items to show as ghosts
    const ghostParentsMap = new Map();
    checkedItems.forEach((item) => {
      let parent = this.getParent(item);
      while (parent) {
        if (!checkedItems.find((ci) => ci.id === parent.id)) {
          ghostParentsMap.set(parent.id, parent);
        }
        parent = this.getParent(parent);
      }
    });

    // Create a combined list maintaining original order
    const completedSectionItems = [];

    this.items.forEach((item) => {
      if (item.checked) {
        completedSectionItems.push({ item, isGhost: false, isCompleted: true });
      } else if (ghostParentsMap.has(item.id)) {
        completedSectionItems.push({ item, isGhost: true, isCompleted: false });
      }
    });

    // Render items in the completed section in original order
    completedSectionItems.forEach(({ item, isGhost, isCompleted }) => {
      const el = this.createItemElement(item, isCompleted, isGhost);
      this.completedContainer.appendChild(el);
    });
  }

  createItemElement(item, isCompleted = false, isGhost = false) {
    const el = document.createElement("div");
    if (isGhost) {
      el.className = "ghost-checklist-item";
    } else if (isCompleted) {
      el.className = "completed-checklist-item";
    } else {
      el.className = "checklist-item";
    }
    el.setAttribute("draggable", "true");
    el.dataset.id = item.id;

    // Left container for checkbox and text
    const leftContainer = document.createElement("div");
    leftContainer.style.paddingLeft = item.level * 20 + "px"; // indentation
    leftContainer.className = "left-container";

    // Checkbox
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.checked;
    checkbox.addEventListener("change", () => {
      this.toggleCheck(item, checkbox.checked);
    });
    leftContainer.appendChild(checkbox);

    // Text wrapper to control width
    const textWrapper = document.createElement("div");
    textWrapper.className = "text-wrapper";

    // Text (editable)
    const textSpan = document.createElement("span");
    textSpan.textContent = item.text;
    textSpan.className = "checklist-text";
    textSpan.addEventListener("click", (e) => {
      e.stopPropagation();
      this.startEditing(item, textSpan);
    });
    textWrapper.appendChild(textSpan);

    leftContainer.appendChild(textWrapper);
    el.appendChild(leftContainer);

    // Trashcan icon (right-aligned)
    const trash = document.createElement("span");
    trash.className = "trash-icon";
    trash.textContent = "🗑️";
    trash.title = "Delete item";
    trash.style.visibility = "hidden";
    trash.addEventListener("click", (e) => {
      e.stopPropagation();
      this.deleteItem(item, el);
    });
    trash.addEventListener("mouseenter", () => {
      el.classList.add("hovered");
    });
    trash.addEventListener("mouseleave", () => {
      el.classList.remove("hovered");
    });
    el.appendChild(trash);

    // Show trash icon on item hover
    el.addEventListener("mouseenter", () => {
      trash.style.visibility = "visible";
    });
    el.addEventListener("mouseleave", () => {
      trash.style.visibility = "hidden";
    });

    // Drag events only for non-ghost items
    if (!isGhost) {
      el.addEventListener("dragstart", (e) => this.onDragStart(e, item));
      el.addEventListener("dragover", (e) => this.onDragOver(e, item));
      el.addEventListener("dragleave", (e) => this.onDragLeave(e, item));
      el.addEventListener("drop", (e) => this.onDrop(e, item));
    }

    return el;
  }

  startEditing(item, textSpan) {
    if (this.editingItem) {
      return;
    }

    this.editingItem = item;
    const originalText = item.text;

    const input = document.createElement("input");
    input.type = "text";
    input.value = originalText;
    input.className = "checklist-text";

    // Replace text span with input inside the same wrapper
    const textWrapper = textSpan.parentNode;
    textSpan.style.display = "none";
    textWrapper.appendChild(input);

    input.focus();
    input.select();

    const finishEditing = (save = false) => {
      if (!this.editingItem) return;

      if (save && input.value.trim() !== "") {
        item.text = input.value.trim();
        this._notifyChange();
      }

      input.remove();
      textSpan.style.display = "";
      textSpan.textContent = item.text;
      this.editingItem = null;
    };

    const addNewItemBelow = () => {
      if (input.value.trim() !== "") {
        item.text = input.value.trim();
        this._notifyChange();
      }

      const currentIndex = this.items.findIndex((i) => i.id === item.id);

      const newItem = {
        id: this.generateId(),
        text: "",
        level: item.level,
        checked: false,
        parent: item.parent,
      };

      let insertIndex = currentIndex + 1;
      while (
        insertIndex < this.items.length &&
        this.items[insertIndex].level > item.level
      ) {
        insertIndex++;
      }

      this.items.splice(insertIndex, 0, newItem);

      input.remove();
      textSpan.style.display = "";
      textSpan.textContent = item.text;
      this.editingItem = null;

      this.render();

      setTimeout(() => {
        const newEl = this.container.querySelector(`[data-id="${newItem.id}"]`);
        if (newEl) {
          const newTextSpan = newEl.querySelector(".checklist-text");
          this.startEditing(newItem, newTextSpan);
        }
      }, 0);
    };

    const navigateToItem = (direction) => {
      const currentIndex = this.items.findIndex((i) => i.id === item.id);
      let targetItem = null;

      if (direction === "previous" && currentIndex > 0) {
        targetItem = this.items[currentIndex - 1];
      } else if (direction === "next" && currentIndex < this.items.length - 1) {
        targetItem = this.items[currentIndex + 1];
      }

      if (targetItem && !targetItem.checked) {
        if (input.value.trim() !== "") {
          item.text = input.value.trim();
          this._notifyChange();
        }

        input.remove();
        textSpan.style.display = "";
        textSpan.textContent = item.text;
        this.editingItem = null;

        this.render();

        setTimeout(() => {
          const targetEl = this.container.querySelector(
            `[data-id="${targetItem.id}"]`,
          );
          if (targetEl) {
            const targetTextSpan = targetEl.querySelector(".checklist-text");

            this.startEditing(targetItem, targetTextSpan);

            setTimeout(() => {
              const newInput = targetEl.querySelector(".checklist-text");
              if (newInput) {
                if (direction === "previous") {
                  newInput.setSelectionRange(
                    newInput.value.length,
                    newInput.value.length,
                  );
                } else {
                  newInput.setSelectionRange(0, 0);
                }
              }
            }, 0);
          }
        }, 0);
      }
    };

    input.addEventListener("keydown", (e) => {
      e.stopPropagation();

      if (e.key === "Enter") {
        addNewItemBelow();
      } else if (e.key === "Escape") {
        finishEditing(false);
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          // Unindent
          if (item.level > 0) {
            item.level = Math.max(0, item.level - 1);
            item.parent = null;
            const idx = this.items.indexOf(item);
            for (let i = idx - 1; i >= 0; i--) {
              if (this.items[i].level === item.level - 1) {
                item.parent = this.items[i].id;
                break;
              }
            }
            finishEditing(true);
            this.render();
            this._notifyChange();
            // Re-focus by clicking the item's text span after render
            setTimeout(() => {
              const el = this.container.querySelector(`[data-id="${item.id}"] .checklist-text`);
              if (el) el.click();
            }, 0);
          }
        } else {
          // Indent
          const idx = this.items.indexOf(item);
          if (idx > 0 && item.level < MAX_INDENT_LEVEL) {
            item.level = Math.min(item.level + 1, MAX_INDENT_LEVEL);
            item.parent = null;
            for (let i = idx - 1; i >= 0; i--) {
              if (this.items[i].level === item.level - 1) {
                item.parent = this.items[i].id;
                break;
              }
            }
            finishEditing(true);
            this.render();
            this._notifyChange();
            setTimeout(() => {
              const el = this.container.querySelector(`[data-id="${item.id}"] .checklist-text`);
              if (el) el.click();
            }, 0);
          }
        }
      } else if (e.key === "ArrowUp") {
        const cursorPos = input.selectionStart;
        if (cursorPos === 0) {
          e.preventDefault();
          navigateToItem("previous");
        } else {
          e.preventDefault();
          input.setSelectionRange(0, 0);
        }
      } else if (e.key === "ArrowDown") {
        const cursorPos = input.selectionStart;
        if (cursorPos === input.value.length) {
          e.preventDefault();
          navigateToItem("next");
        } else {
          e.preventDefault();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }
    });

    input.addEventListener("blur", () => {
      finishEditing(true);
    });
  }

  toggleCheck(item, checked) {
    item.checked = checked;
    this.updateCheckedStateForSubtree(item, checked);
    this.render();
    this._notifyChange();
  }

  updateCheckedStateForSubtree(item, checked) {
    const children = this.getChildren(item);
    children.forEach((child) => {
      child.checked = checked;
      this.updateCheckedStateForSubtree(child, checked);
    });
  }

  getParent(item) {
    return this.items.find((i) => i.id === item.parent);
  }

  getChildren(item) {
    return this.items.filter((i) => i.parent === item.id);
  }

  deleteItem(item, element) {
    const subtree = this.getSubtree(item);
    this.deletedStack.push(subtree);

    element.classList.add("deleting");

    setTimeout(() => {
      this.items = this.items.filter(
        (i) => !subtree.some((s) => s.id === i.id),
      );
      this.undoButton.style.display = "inline-block";
      this.render();
      this._notifyChange();
    }, 500);
  }

  undoDelete() {
    if (this.deletedStack.length === 0) return;
    const subtree = this.deletedStack.pop();

    // Strobe animation: 3 flashes to red over 1.5 seconds
    this.undoButton.style.transition = "none";
    this.undoButton.style.backgroundColor = "red";
    setTimeout(() => {
      this.undoButton.style.transition = "background-color 0.25s ease";
      this.undoButton.style.backgroundColor = "";
      setTimeout(() => {
        this.undoButton.style.transition = "none";
        this.undoButton.style.backgroundColor = "red";
        setTimeout(() => {
          this.undoButton.style.transition = "background-color 0.25s ease";
          this.undoButton.style.backgroundColor = "";
          setTimeout(() => {
            this.undoButton.style.transition = "none";
            this.undoButton.style.backgroundColor = "red";
            setTimeout(() => {
              this.undoButton.style.transition = "background-color 0.25s ease";
              this.undoButton.style.backgroundColor = "";
            }, 250);
          }, 250);
        }, 250);
      }, 250);
    }, 0);

    this.items = this.items.concat(subtree);
    this.undoButton.style.display =
      this.deletedStack.length > 0 ? "inline-block" : "none";
    this.render();
    this._notifyChange();
  }

  getSubtree(item) {
    let subtree = [item];
    const children = this.getChildren(item);
    children.forEach((child) => {
      subtree = subtree.concat(this.getSubtree(child));
    });
    return subtree;
  }

  onDragStart(e, item) {
    this.draggedItem = item;
    this.draggedSubtree = this.getSubtree(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.id);
    e.currentTarget.classList.add("dragging");
  }

  onDragOver(e, item) {
    e.preventDefault();
    if (this.draggedItem && item.id !== this.draggedItem.id) {
      const el = e.currentTarget;
      const bounding = el.getBoundingClientRect();
      const offset = e.clientY - bounding.top;
      const height = bounding.height;

      this.clearDropIndicator();

      if (offset < height / 3) {
        this.dragOverPosition = "above";
        el.classList.add("drag-over-above");
      } else if (offset > (2 * height) / 3) {
        this.dragOverPosition = "below";
        el.classList.add("drag-over-below");
      } else {
        this.dragOverPosition = "on";
        el.classList.add("drag-over-on");
      }
      this.dragOverItem = item;
    }
  }

  onDragLeave(e, item) {
    this.clearDropIndicator();
  }

  onDrop(e, item) {
    e.preventDefault();
    this.clearDropIndicator();

    if (!this.draggedItem) return;

    if (this.draggedSubtree.some((subItem) => subItem.id === item.id)) {
      this.draggedItem = null;
      this.draggedSubtree = [];
      this.dragOverItem = null;
      this.dragOverPosition = null;
      return;
    }

    this.items = this.items.filter(
      (i) => !this.draggedSubtree.some((s) => s.id === i.id),
    );

    const targetIndex = this.items.findIndex((i) => i.id === item.id);

    if (this.dragOverPosition === "on") {
      this.draggedItem.parent = item.id;
      this.draggedItem.level = item.level + 1;
      this.updateSubtreeLevels(this.draggedSubtree, this.draggedItem.level);

      let insertIndex = targetIndex + 1;
      while (
        insertIndex < this.items.length &&
        this.isDescendantOf(this.items[insertIndex], item)
      ) {
        insertIndex++;
      }

      this.items.splice(insertIndex, 0, ...this.draggedSubtree);
    } else if (this.dragOverPosition === "above") {
      this.draggedItem.parent = item.parent;
      this.draggedItem.level = item.level;
      this.updateSubtreeLevels(this.draggedSubtree, this.draggedItem.level);
      this.items.splice(targetIndex, 0, ...this.draggedSubtree);
    } else if (this.dragOverPosition === "below") {
      this.draggedItem.parent = item.parent;
      this.draggedItem.level = item.level;
      this.updateSubtreeLevels(this.draggedSubtree, this.draggedItem.level);
      let insertIndex = targetIndex + 1;
      while (
        insertIndex < this.items.length &&
        this.items[insertIndex].level > item.level
      ) {
        insertIndex++;
      }
      this.items.splice(insertIndex, 0, ...this.draggedSubtree);
    }

    this.draggedItem = null;
    this.draggedSubtree = [];
    this.dragOverItem = null;
    this.dragOverPosition = null;

    this.render();
    this._notifyChange();
  }

  clearDropIndicator() {
    const els = this.container.querySelectorAll(
      ".checklist-item, .completed-checklist-item, .ghost-checklist-item",
    );
    els.forEach((el) => {
      el.classList.remove(
        "drag-over-above",
        "drag-over-below",
        "drag-over-on",
        "dragging",
      );
    });
  }

  updateSubtreeLevels(subtree, rootLevel) {
    const levelDiff = rootLevel - subtree[0].level;
    subtree.forEach((item) => {
      item.level += levelDiff;
    });
  }

  isDescendantOf(item, ancestor) {
    let parent = this.getParent(item);
    while (parent) {
      if (parent.id === ancestor.id) {
        return true;
      }
      parent = this.getParent(parent);
    }
    return false;
  }

  /**
   * Internal method to notify external code that checklist data changed.
   */
  _notifyChange() {
    if (typeof this.onChangeCallback === "function") {
      this.onChangeCallback(this.getChecklistData());
    }
  }
}

window.Checklist = Checklist;

/* Now initialized in the main.
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("checklist-container");
  if (container && window.Checklist) {
    // Initialize without initial items here; will be set externally
    window.checklist = new Checklist(container);
  }
});
 */
