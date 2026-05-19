# Health Indicators Zone

**Category:** Editor Zones
**Item #:** 26
**Code Verified:** ✅
**User Verified:** ⬜

## Source File
`src/frontend/js/editor/editor-health.js`

## Global State

- [ ] `window._healthData` — UUID-keyed readings for current chit
- [ ] `window._indicatorObjects` — Cached zone query result (Custom Objects)
- [ ] `window._perChitIndicators` — UUIDs of per-chit indicators on current chit
- [ ] `window._healthUnitSystem` — 'imperial' or 'metric' (from settings)

## Functions

- [ ] `_evaluateConditionalDisplay(rule, settings)` — Evaluate conditional_display rule against user settings (e.g., show only if sex=Woman)
- [ ] `_getUnitLabel(obj, unitSystem)` — Get appropriate unit label based on imperial/metric setting
- [ ] `_getRangeHighlightClass(value, rangeMin, rangeMax)` — Determine CSS class for range highlighting (indicator-range-high, indicator-range-low)
- [ ] `_fetchIndicatorObjects()` — Fetch indicator objects from `/api/custom-objects/zone/indicators_zone`, caches result
- [ ] `_renderIndicatorField(obj, value)` — Render a single indicator field row (numeric/boolean/string input based on value_type)
- [ ] `_showAddIndicatorPicker()` — Show the "Add Indicator" picker modal (lists all non-default Custom Objects)
- [ ] `_renderAddIndicatorModal(modal, available, closeFn)` — Render the Add Indicator modal content with objects grouped by type/sub_type
- [ ] `_addPerChitIndicator(obj)` — Add a per-chit indicator to the current chit, render field, mark dirty
- [ ] `_getDefaultIndicators(objects)` — Filter objects where zone_config.is_default === true
- [ ] `_getNonDefaultIndicators(objects)` — Filter objects where zone_config.is_default is false/absent
- [ ] `_identifyPerChitIndicators(healthData, defaultObjects, allObjects)` — Identify per-chit indicator UUIDs from health_data not in default set
- [ ] `_loadHealthData(chit)` — Main orchestrator: parse health_data, fetch objects, evaluate conditional display, render all indicators
- [ ] `_gatherHealthData()` — Gather current health data values into UUID-keyed object for saving (includes per-chit indicators)

## Controls & Inputs

- [ ] Numeric input (`type="number"`) — For integer/decimal value_type indicators (step=1 or step=any)
- [ ] Checkbox input (`type="checkbox"`) — For boolean value_type indicators
- [ ] Text input (`type="text"`) — For string value_type indicators
- [ ] Unit label span — Shows units (imperial or metric) next to numeric/text inputs
- [ ] Range highlight — Real-time CSS class update on numeric input (indicator-range-high / indicator-range-low)
- [ ] "+ Custom Object" button — Opens the Add Indicator picker modal
- [ ] Collapsible section headers — Group indicators by category (sub_type or type), click to collapse/expand
- [ ] Section arrow toggle (▼/▶) — Visual indicator of collapsed/expanded state
- [ ] Per-chit divider — Visual separator between default and per-chit indicators

## Add Indicator Picker Modal

- [ ] Modal overlay (fixed, full-screen backdrop)
- [ ] Search input — Filter custom objects by name, type, or sub_type
- [ ] Type group headers — Collapsible, show count, sorted alphabetically
- [ ] Sub-type group headers — Collapsible within type groups
- [ ] Checkbox per object — Multi-select objects to add
- [ ] "Add Selected (N)" button — Adds all selected objects as per-chit indicators
- [ ] "Cancel" button — Closes modal without adding
- [ ] ESC key handler — Closes modal (capture phase, stopImmediatePropagation)
- [ ] Click-outside-to-close — Clicking overlay closes modal
- [ ] Loading state — Shows "Loading…" while fetching objects
- [ ] Error state — Shows error message if fetch fails
- [ ] Empty state — Shows "No additional custom objects available" if none available
- [ ] Hover highlight on items — Visual feedback on mouseover

## Behaviors

- [ ] Conditional display — Fields hidden/shown based on user settings (e.g., sex-specific indicators)
- [ ] Imperial/metric unit switching — Unit labels change based on user's unit_system setting
- [ ] Per-chit indicator persistence — UUIDs stored in health_data even with null values so they reappear on reload
- [ ] Data-driven rendering — All fields come from Custom Objects registry, no hardcoded fields
- [ ] Sort by zone_sort_order — Indicators rendered in configured order
- [ ] Category grouping — Indicators grouped by sub_type (or type as fallback)
- [ ] setSaveButtonUnsaved() — Called on any input change
