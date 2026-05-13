# Design Document: Rejected Status

## Overview

Adds "Rejected" as a second terminal status alongside "Complete." The implementation is straightforward — it's a new string value in an unvalidated field, so the backend needs no schema changes. The work is almost entirely frontend: adding the option to dropdowns, updating sort/filter logic, adding an icon, and integrating with the Projects Kanban.

**Key design decisions:**
- **No backend migration needed** — `status` is an `Optional[str]` with no enum validation. "Rejected" is just a new string value.
- **No prerequisite cascade** — unlike Complete, rejecting a chit does NOT unblock its dependents. A rejected prerequisite means the dependent's plan is broken, not resolved.
- **Shares "finished" treatment with Complete** — same opacity fade, same hide filter, same sort-to-bottom behavior. Visually distinguished by icon (× vs ✓) and grey vs green color.
- **Projects Kanban: separate section below Complete** — Rejected gets its own collapsible section, collapsed by default, rendered after Complete. This keeps the Kanban clean while making rejected chits accessible.

## Architecture

```
No new files needed. Changes are distributed across existing files:

Frontend:
  editor.html              — Add "Rejected" option to status <select>
  shared-indicators.js     — Add _STATUS_ICONS entry
  main-views-tasks.js      — Add to sort order, dropdown options, styling
  editor_projects.js       — Add to statuses array and normalization map
  shared-sidebar.js        — Add to status filter checkboxes
  main-init.js             — Update hide-complete filter to also hide Rejected
  main-views.js            — Update overdue logic to exempt Rejected
  help.html                — Document the new status

Backend:
  routes/chits.py          — Update _cascade_prerequisite_unblock to NOT cascade on Rejected
```

## Components and Interfaces

### 1. Status Icon (`shared-indicators.js`)

Add to `_STATUS_ICONS`:
```javascript
'Rejected': '<i class="fas fa-times-circle" style="color:#9E9E9E;font-size:0.85em;"></i>'
```

### 2. Editor Status Dropdown (`editor.html`)

Add after the Complete option:
```html
<option value="Rejected">Rejected</option>
```

### 3. Tasks View Sort Order (`main-views-tasks.js`)

Update the `statusOrder` map:
```javascript
const statusOrder = { 'ToDo': 1, 'In Progress': 2, 'Blocked': 3, '': 4, 'Complete': 5, 'Rejected': 6 };
```

### 4. Tasks View Dropdown & Styling (`main-views-tasks.js`)

Add "Rejected" to the dropdown options array:
```javascript
["ToDo", "In Progress", "Blocked", "Complete", "Rejected"].forEach(...)
```

Update `_styleStatusDropdown()` to handle Rejected:
```javascript
} else if (val === 'Rejected') {
    statusDropdown.style.backgroundColor = '';
    statusDropdown.style.color = '#9E9E9E';
    statusDropdown.style.border = '';
    statusDropdown.style.fontWeight = '';
    statusDropdown.style.opacity = '0.6';
}
```

Apply `completed-task` class for Rejected chits:
```javascript
if (chit.status === "Complete" || chit.status === "Rejected") chitElement.classList.add("completed-task");
```

### 5. Projects Kanban (`editor_projects.js`)

Update statuses array and normalization map:
```javascript
const statuses = ["ToDo", "In Progress", "Blocked", "Complete", "Rejected"];
const statusMapLower = { "todo": "ToDo", "in progress": "In Progress", "blocked": "Blocked", "complete": "Complete", "rejected": "Rejected" };
```

Collapse "Rejected" by default (same as Complete):
```javascript
var isCollapsed = ((status === "Complete" || status === "Rejected") && count > 0);
```

### 6. Sidebar Filters (`shared-sidebar.js`)

Add checkbox:
```javascript
html += '        <label><input type="checkbox" value="Rejected" data-filter="status" /> Rejected</label>';
```

### 7. Hide-Complete Filter (`main-init.js`)

Update to hide both terminal statuses:
```javascript
if (hideComplete) {
    filteredChits = filteredChits.filter(c => c.status !== 'Complete' && c.status !== 'Rejected');
}
```

### 8. Overdue Exemption (`main-views.js`)

Update overdue check to exempt Rejected:
```javascript
const isOverdue = dueDate < new Date() && chit.status !== 'Complete' && chit.status !== 'Rejected';
```

### 9. Backend Cascade Logic (`routes/chits.py`)

The `_cascade_prerequisite_unblock` function currently triggers when a chit is set to "Complete." It should NOT trigger for "Rejected" — no changes needed since the function already only fires on Complete. However, the `_cascade_auto_complete_revert` should treat Rejected the same as non-Complete (already handled since it checks `dep_status == "Complete"`).

No backend code changes are strictly required — the cascade logic already only fires on "Complete" specifically.

## Data Model

No schema changes. The `status` field is `Optional[str]` with no validation. "Rejected" is simply a new valid string value.

## Error Handling

- If a chit with status "Rejected" is dragged in the Projects Kanban, the same error handling as other statuses applies (PUT failure shows toast).
- No new error states introduced.

## Performance

No performance impact. Adding one more string comparison to existing filter/sort logic is negligible.
