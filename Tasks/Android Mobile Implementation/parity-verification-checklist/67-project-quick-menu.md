# Project Quick Menu

**Category:** Modals & Overlays
**Item #:** 67
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Functions (main-views-projects.js)
- [ ] _showProjectQuickMenu(e, project) — Shows a positioned context menu for a project (triggered by Shift+click or right-click on project header)
- [ ] _projectQuickCreateChild(project) — Creates a new child chit via cwocPromptModal, POSTs it, adds to project's child_chits array

### Trigger Methods
- [ ] Shift+click on project header — Opens the quick menu
- [ ] Right-click (contextmenu) on project header — Opens the quick menu
- [ ] Viewer role guard — Menu does not open if user has viewer role (_isViewerRole check)

### Menu Items

#### Project-Specific Actions (top section)
- [ ] "Create New Child Chit" — Opens cwocPromptModal for title input, creates chit with status "ToDo", adds to project's child_chits
- [ ] "Open in Editor" — Navigates to /editor?id={project.id}
- [ ] "Quick Edit" — Opens showQuickEditModal for the project

#### Standard Chit Actions (middle section)
- [ ] Pin / Unpin — PATCH /api/chits/{id}/fields with {pinned: !current}; updates local chit data
- [ ] Archive / Unarchive — PATCH /api/chits/{id}/fields with {archived: !current}; refreshes display

#### Snooze Row (if not snoozed)
- [ ] 😴 emoji label
- [ ] H button (1 hour) — Snoozes for 60 minutes
- [ ] D button (1 day) — Snoozes for 1440 minutes
- [ ] W button (1 week) — Snoozes for 10080 minutes
- [ ] F button (1 fortnight) — Snoozes for 20160 minutes
- [ ] M button (1 month) — Snoozes for 43200 minutes
- [ ] Each snooze: immediately hides locally, shows undo toast, persists to server via POST /api/chits/{id}/snooze

#### Unsnooze (if currently snoozed)
- [ ] "Unsnooze" — POST /api/chits/{id}/snooze with {until: null}; shows toast "Unsnoozed."

#### Destructive Actions (bottom section)
- [ ] "Delete" — Confirms via cwocConfirm, DELETE /api/chits/{id}, shows undo toast with restore capability

### Menu Styling
- [ ] Parchment background (url("/static/parchment.jpg") + #fffaf0 fallback)
- [ ] Brown border (2px solid #6b4e31), 8px border-radius
- [ ] Box shadow (0 8px 24px rgba(0,0,0,0.3))
- [ ] Lora, Georgia, serif font
- [ ] Min-width 200px
- [ ] Positioned at click coordinates, clamped to viewport (max X: innerWidth - 220, max Y: innerHeight - 350)

### Menu Item Styling
- [ ] Padding 8px 14px, flex with gap 8px
- [ ] Icon span (18px width, centered)
- [ ] Hover highlight (#f0e6d0 background)
- [ ] Font Awesome icons for most items (pen-to-square, sliders, bookmark, trash-alt)
- [ ] Separators between sections (1px solid rgba(139,90,43,0.2))

### Snooze Circle Buttons
- [ ] .cwoc-ctx-snooze-circle class
- [ ] Single letter labels (H, D, W, F, M)
- [ ] Title tooltips (1 hour, 1 day, 1 week, 1 fortnight, 1 month)

### Snooze Undo Toast
- [ ] _showSnoozeUndoToast — Shows countdown undo toast; on undo: POST /api/chits/{id}/snooze with {until: null}, reverts local state

### Controls & Interactions
- [ ] Click overlay (outside menu) — Closes the menu
- [ ] ESC key — Closes the menu (capture phase, stopImmediatePropagation)
- [ ] Click menu item — Closes menu then executes action

### State Cleanup
- [ ] Removes any existing .cwoc-project-quick-menu-overlay before creating new one
- [ ] Removes ESC keydown listener on close
