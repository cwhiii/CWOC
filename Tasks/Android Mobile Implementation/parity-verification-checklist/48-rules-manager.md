# Rules Manager

**Category:** Standalone Pages
**Item #:** 48
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### State Variables
- [ ] _rules — array of all rules from API
- [ ] _confirmations — array of pending confirmations
- [ ] _dragRuleId — ID of rule being dragged for reorder

### Toolbar
- [ ] "➕ New Rule" button — navigates to /frontend/html/rule-editor.html

### Functions — Data Loading
- [ ] loadRules() — async fetches /api/rules, stores in _rules, calls renderRulesTable
- [ ] loadConfirmations() — async fetches /api/rules/confirmations, stores in _confirmations, calls renderConfirmations

### Functions — Rules Table
- [ ] renderRulesTable() — builds HTML table with columns: drag handle, enabled toggle, name (linked), trigger badge, priority, last run, run count, delete button
- [ ] _formatTimestamp(iso) — formats ISO to "YYYY-MM-DD HH:MM"
- [ ] _triggerLabel(type) — maps trigger type to human-readable label

### Functions — Rule Actions
- [ ] toggleRule(ruleId) — async PATCH /api/rules/{id}/toggle, updates local state
- [ ] deleteRule(ruleId, ruleName) — async confirms via cwocConfirm, DELETE /api/rules/{id}, shows toast, reloads

### Functions — Drag-and-Drop Reorder
- [ ] _initDragReorder() — attaches dragstart/dragend/dragover/drop listeners to table tbody
- [ ] dragstart handler — sets _dragRuleId, adds .rule-dragging class
- [ ] dragend handler — removes .rule-dragging class, clears drag-over states
- [ ] dragover handler — prevents default, adds .rule-drag-over to target row
- [ ] drop handler — computes new order from DOM, calls _saveReorder
- [ ] _saveReorder(ruleIds) — async PUT /api/rules/reorder with ordered IDs, reloads

### Functions — Pending Confirmations
- [ ] renderConfirmations() — renders confirmation cards with rule name, description, timestamp, accept/dismiss buttons
- [ ] toggleConfirmations() — toggles collapsed state of confirmations body
- [ ] acceptConfirmation(confirmationId) — async POST /api/rules/confirmations/{id}/accept, shows toast, reloads
- [ ] dismissConfirmation(confirmationId) — async POST /api/rules/confirmations/{id}/dismiss, shows toast, reloads

### Pending Confirmations Section
- [ ] Confirmations section (#confirmations-section) — hidden when empty, shows count badge
- [ ] Confirmations header (onclick → toggleConfirmations) — expandable/collapsible
- [ ] Confirmations toggle arrow (#confirmations-toggle) — ▼ indicator
- [ ] Confirmations body (#confirmations-body) — list of confirmation cards
- [ ] Each confirmation card contains:
  - [ ] Rule name display
  - [ ] Action description
  - [ ] Timestamp
  - [ ] ✅ Accept button (onclick → acceptConfirmation)
  - [ ] ❌ Dismiss button (onclick → dismissConfirmation)

### Rules Table Columns
- [ ] Drag handle (☰) — for reorder
- [ ] Enabled toggle — checkbox with slider (onchange → toggleRule)
- [ ] Name — linked to rule-editor.html?id={id}
- [ ] Bundle badge — shown for "Bundle: " prefixed rules
- [ ] Trigger badge — styled by trigger type
- [ ] Priority — numeric or "—"
- [ ] Last Run — formatted timestamp
- [ ] Runs — run count
- [ ] Delete button (🗑️) — onclick → deleteRule

### Initialization
- [ ] DOMContentLoaded listener — calls loadRules() and loadConfirmations()
