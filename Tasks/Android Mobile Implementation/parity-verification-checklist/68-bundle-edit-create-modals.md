# Bundle Edit/Create Modals

**Category:** Modals & Overlays
**Item #:** 68
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Functions (main-email-bundles.js)
- [ ] _openBundleModal(editBundle) — Opens the bundle creation/edit modal; clones template, configures for create vs edit mode
- [ ] _closeBundleModal — Removes overlay, resets state, removes ESC handler
- [ ] _bundleModalSubmit — Validates form and routes to create or update
- [ ] _bundleModalCreate(name, description, color, omniView) — POST /api/bundles, then navigates to Rule Editor
- [ ] _bundleModalUpdate(name, description, color, omniView) — PUT /api/bundles/{id} to update existing bundle
- [ ] _bundleModalEscHandler — ESC key handler (capture phase) to close modal
- [ ] _showBundleModalHint(msg) — Shows validation error hint text in the modal
- [ ] _deleteBundleConfirm(bundle) — Confirms and deletes a bundle

### Modal Template (tmpl-bundle-modal)
- [ ] Uses HTML `<template>` element cloned into DOM on open

### Form Fields & Inputs
- [ ] Bundle name input (#bundleNameInput) — Text input for bundle name; required, validated non-empty and unique
- [ ] Bundle description input (#bundleDescInput) — Text input for optional description
- [ ] Color picker (#bundleColorPicker + #bundleColorInput) — Uses shared cwocRenderColorPicker with showNone option
- [ ] "Show in Omni View" checkbox (#bundleOmniViewCheck) — Toggle for omni_view flag

### Buttons (Create Mode)
- [ ] "Define Rule" button (#bundleDefineRuleBtn) — Validates, creates bundle via POST, navigates to Rule Editor with pre-selected trigger and bundle_id
- [ ] "Cancel" button (#bundleCancelBtn) — Closes modal without action

### Buttons (Edit Mode)
- [ ] "Save" button (#bundleDefineRuleBtn, text changed) — Validates, updates bundle via PUT
- [ ] "Change Rules" button — Navigates to Rule Editor for the bundle's existing rule (or create new rule if none)
- [ ] "Delete" button — Confirms deletion, removes bundle (only shown if bundle.removable !== 0)
- [ ] "Cancel" button (#bundleCancelBtn) — Closes modal without action

### Title
- [ ] .bundle-modal-title — "Create Bundle" (create mode) or "Edit Bundle" (edit mode)

### Validation
- [ ] Name non-empty check — Shows hint "Bundle name cannot be empty."
- [ ] Duplicate name check (case-insensitive) — Shows hint "A bundle with this name already exists." (excludes self when editing)
- [ ] Button disabled during submit — Prevents double-submit; text changes to "Creating..." or "Saving..."

### Hint Display
- [ ] #bundleModalHint — Error/validation message area; hidden by default, shown on validation failure

### Modal Interactions
- [ ] ESC key — Closes modal (capture phase, stopImmediatePropagation)
- [ ] Click overlay — Closes modal (click on overlay element itself)
- [ ] Enter key in name input — Submits the form
- [ ] Focus — Name input auto-focused after 50ms delay

### Navigation After Create
- [ ] Navigates to /frontend/html/rule-editor.html with params:
  - ?new=1 (create new rule)
  - &trigger=email_received
  - &bundle_id={bundleId}
  - &return={encoded return URL to Email tab}
- [ ] Sets localStorage flag 'cwoc_bundle_needs_reclassify' for reclassification on return

### Navigation After Edit Rules
- [ ] If bundle has rule_ids: opens rule editor for first rule ID
- [ ] If bundle has no rules: opens rule editor in create mode with bundle_id

### State Variables
- [ ] _bundleModalOpen — Boolean flag for modal visibility
- [ ] _bundleModalEditBundle — The bundle object being edited (null for create mode)

### Add-to-Bundle Modal (shared.js — separate from bundle create/edit)
- [ ] _showAddToBundleModal(chit) — Opens modal to add an email to an existing bundle by subject or sender matching
- [ ] _loadBundlesForModal(selectEl) — Loads bundles into dropdown (from cached settings or fetch)
- [ ] _populateBundleSelect(selectEl, bundles) — Populates select with bundle options (excludes "Everything Else")
- [ ] _executeAddToBundle(chit, overlay) — Validates selection, POST /api/bundles/{id}/add-rule, moves email to bundle, triggers reclassification

### Add-to-Bundle Modal Fields
- [ ] Email info display — Shows subject and sender of the email
- [ ] Match type radio buttons — "Subject" or "Sender" (sender is default)
- [ ] Bundle selection dropdown — Lists available bundles sorted by display_order
- [ ] "Add to Bundle" button — Executes the add-rule action
- [ ] "Cancel" button — Closes modal
- [ ] ESC key — Closes modal (capture phase)
- [ ] Click overlay — Closes modal
