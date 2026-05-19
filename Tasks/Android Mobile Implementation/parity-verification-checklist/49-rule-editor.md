# Rule Editor

**Category:** Standalone Pages
**Item #:** 49
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### State Variables
- [ ] _ruleId — null for new rule, string for editing existing
- [ ] _conditionTree — root condition group node
- [ ] _actions — array of action objects
- [ ] _saveSystem — CwocSaveSystem instance
- [ ] _nodeIdCounter — auto-incrementing node ID counter
- [ ] _cachedTagList — cached tag list for pickers
- [ ] _cachedPeopleList — cached people/contacts list
- [ ] _cachedLocationsList — cached saved locations list
- [ ] _cachedSavedLocations — cached saved locations for weather inputs
- [ ] _haConfigured — null/true/false HA configuration status
- [ ] _haEntitiesCache — cached HA entities
- [ ] _haServicesCache — cached HA services
- [ ] _habitSourcesLoaded — flag for habit source loading

### Rule Info Section
- [ ] Rule Name input (#rule-name) — required text field
- [ ] Rule Description textarea (#rule-description) — optional

### Trigger Section
- [ ] Trigger dropdown (#rule-trigger) — required, grouped options:
  - [ ] Chits: Chit Created, Chit Updated
  - [ ] Email: Email Received
  - [ ] Contacts: Contact Created, Contact Updated
  - [ ] Scheduling: Scheduled (Cron / Interval)
  - [ ] Habits: Habit Achieved, Habit Missed, Habit Due
  - [ ] Home Assistant: HA State Change, HA Webhook

### Schedule Config (shown when trigger = "scheduled")
- [ ] Schedule Mode pill toggle (#schedule-mode-pill) — Simple / Cron
- [ ] Simple Mode:
  - [ ] Frequency dropdown (#schedule-frequency) — Daily / Every N Hours
  - [ ] Interval input (#schedule-interval) — number (shown for hourly)
  - [ ] Time of Day input (#schedule-time) — opens drum roller time picker
- [ ] Cron Mode:
  - [ ] Minute input (#cron-minute)
  - [ ] Hour input (#cron-hour)
  - [ ] Day of Month input (#cron-dom)
  - [ ] Month input (#cron-month)
  - [ ] Day of Week input (#cron-dow)
  - [ ] Cron preview display (#cron-preview-text)
  - [ ] Preset buttons: Every morning, Every hour, Weekdays 9am, 1st of month
- [ ] Track as Habit toggle (#rule-habit-mode) — checkbox with slider

### HA State Change Config
- [ ] Entity ID input (#ha-entity-id-input)
- [ ] Fetch Entities button (#ha-trigger-fetch-entities)

### HA Webhook Config
- [ ] Info text about webhook configuration

### Habit Trigger Config
- [ ] Habit Source dropdown (#habit-source-type) — Rule-based / Chit-based / Any
- [ ] Which Habit Rule dropdown (#habit-source-rule)
- [ ] Which Habit Chit dropdown (#habit-source-chit)
- [ ] Time Offset input (#habit-offset-minutes) — for habit_due trigger

### Conditions Section
- [ ] Condition tree container (#condition-tree) — dynamic tree builder
- [ ] AND/OR group toggle per group
- [ ] Add Condition button per group
- [ ] Add Group button per group
- [ ] Remove condition (×) button per leaf
- [ ] Remove group (×) button per non-root group

### Actions Section
- [ ] Action rows container (#action-rows)
- [ ] "+ Add Action" button (onclick → addActionRow)
- [ ] Each action row has:
  - [ ] Action type dropdown (grouped: Tags & People, Status & Priority, Appearance & Location, Lifecycle, Create & Notify, Email, Home Assistant)
  - [ ] Parameter inputs (varies by action type)
  - [ ] Remove action button (×)

### Settings Section
- [ ] Confirm before applying toggle (#rule-confirm) — checkbox with slider

### Save System Buttons (injected into header)
- [ ] Save & Stay button (#save-stay-btn)
- [ ] Save & Exit button (#save-exit-btn)
- [ ] Save button (#save-single-btn)
- [ ] Exit button (.cancel-rule)

### Functions — Helpers
- [ ] _nextNodeId() — generates unique node IDs
- [ ] _escHtml — uses shared-utils.js version

### Functions — Data Loading
- [ ] _loadTagList() — async loads tags from settings for tag picker
- [ ] _loadPeopleList() — async loads contacts for people picker
- [ ] _loadLocationsList() — async loads saved locations from settings
- [ ] _loadSavedLocations() — loads saved locations for weather inputs
- [ ] _loadHabitSources() — async loads habit rules and chits for source dropdowns

### Functions — Smart Input Rendering
- [ ] _renderSearchableInput(currentValue, options, placeholder, onChange) — text input with dropdown suggestions
- [ ] _renderSmartInput(leaf, onChange) — dispatches to appropriate input type based on field/operator
- [ ] _renderPlainTextInput(currentValue, onChange) — basic text input
- [ ] _renderDropdownInput(currentValue, options, placeholder, onChange) — select dropdown
- [ ] _renderEmailAccountDropdown(currentValue, onChange) — email account picker
- [ ] _renderLocationCombobox(currentValue, onChange) — location text + saved locations dropdown
- [ ] _renderWeatherInput(leaf, onChange) — weather threshold + location picker
- [ ] _renderColorSwatches(currentValue, onChange) — color swatch grid + hex input
- [ ] _renderContactAutocomplete(options) — contact name/email autocomplete

### Functions — Condition Tree
- [ ] _createDefaultTree() — creates root AND group with one empty leaf
- [ ] _createLeaf() — creates new condition leaf with default field
- [ ] _createGroup() — creates new AND group
- [ ] renderConditionTree() — renders full tree into container
- [ ] _renderNode(node, isRoot) — dispatches to group or leaf renderer
- [ ] _renderGroup(group, isRoot) — renders group with AND/OR toggle, children, add buttons
- [ ] _renderLeaf(leaf) — renders condition row with field/operator/value dropdowns
- [ ] _removeNode(nodeId) — removes node from tree, marks dirty
- [ ] _removeNodeFromTree(parent, nodeId) — recursive removal
- [ ] _getFieldsForTrigger() — returns field definitions based on current trigger type
- [ ] _getFieldGroups() — groups fields by category for dropdown optgroups
- [ ] _getAllowedOperators(field) — returns allowed operators for a field
- [ ] _countLeaves(node) — counts leaf conditions in tree

### Functions — Weather Conditions
- [ ] _parseWeatherValue(leaf) — parses "threshold|days|location" format
- [ ] _buildWeatherValue(threshold, days, location) — builds weather value string
- [ ] _parseWeatherOperator(operator) — maps operator to metric + comparison
- [ ] _buildWeatherOperator(metric, comparison, forecast) — builds operator string
- [ ] _renderWeatherConditionInputs(div, leaf) — renders weather-specific UI (metric, comparison, threshold, days, location)
- [ ] _getWeatherUnit(metric) — returns unit string for weather metric
- [ ] _isKnownLocation(loc) — checks if location is in saved locations
- [ ] _wrapWithLabel(labelText, element) — wraps element with label

### Functions — Serialization
- [ ] _serializeTree(node) — strips internal _id fields for API storage
- [ ] _deserializeTree(node) — adds internal _id fields from API data

### Functions — Actions
- [ ] addActionRow(actionData) — adds action to _actions array, re-renders
- [ ] removeAction(index) — removes action at index, marks dirty, re-renders
- [ ] renderActions() — renders all action rows with type dropdowns and parameter inputs

### Functions — HA Actions
- [ ] _checkHaConfigured() — async checks if HA is configured
- [ ] _fetchHaEntities() — async fetches HA entities list
- [ ] _fetchHaServices() — async fetches HA services list
- [ ] _renderHaKeyValueEditor(pairs, onChange) — key-value pair editor for service_data/event_data
- [ ] _buildHaJsonPreview(action) — creates JSON preview element
- [ ] _updateHaJsonPreview(pre, action) — updates JSON preview content
- [ ] _renderHaServiceAction(action, container) — renders Call HA Service action panel (domain, service, entity_id, service_data, JSON preview)
- [ ] _renderHaEventAction(action, container) — renders Fire HA Event action panel (event_type, event_data, JSON preview)
- [ ] _showHaEntityPicker(entities, targetInput, action, jsonPreview) — modal entity picker with search
- [ ] _showHaServicePicker(services, domainInput, serviceInput, action, jsonPreview) — modal service picker
- [ ] _showHaTriggerEntityPicker(entities) — modal entity picker for trigger config
- [ ] _deserializeHaAction(action) — converts stored HA action format to editor format

### Functions — Create Chit/Reminder Actions
- [ ] _renderCreateChitAction(action, container) — renders create chit panel (title, note, status, priority, tags, dates, location, color, people)
- [ ] _renderCreateReminderAction(action, container) — renders create reminder panel (title, date, time, note)
- [ ] _updateReminderTime(action) — builds reminder_time from date + time params

### Functions — Trigger Handlers
- [ ] _onTriggerChange() — shows/hides schedule/HA/habit config sections, resets condition tree fields
- [ ] _onScheduleFrequencyChange() — shows/hides interval input for hourly
- [ ] _onHabitSourceTypeChange() — shows/hides rule/chit source selectors

### Functions — Cron Builder
- [ ] _describeCron(expr) — human-readable cron description
- [ ] _updateCronPreview() — updates cron preview text
- [ ] _assembleCronExpression() — builds cron string from 5 field inputs
- [ ] _validateCronExpression(expr) — basic cron validation
- [ ] _setCronFields(expr) — sets 5 cron field inputs from expression string
- [ ] _getScheduleMode() — reads current schedule mode (simple/cron)
- [ ] _setScheduleMode(mode) — sets mode, toggles visibility of simple/cron sections
- [ ] _initCronBuilder() — wires mode toggle, field inputs, preset buttons, habit checkbox

### Functions — Save/Load
- [ ] _markDirty() — marks save system as unsaved
- [ ] _validate() — validates name, trigger, conditions, actions; returns error array
- [ ] saveRule(andExit) — async validates, builds payload, POST/PUT to /api/rules, handles bundle association
- [ ] cancelOrExit() — delegates to save system or navigates to rules manager
- [ ] _loadRule(ruleId) — async fetches rule, populates all fields, deserializes conditions/actions

### Templates (in HTML)
- [ ] #tmpl-smart-autocomplete — contact autocomplete input
- [ ] #tmpl-smart-color-swatches — color swatch grid with hex input
- [ ] #tmpl-smart-location-combobox — location input with dropdown
- [ ] #tmpl-smart-weather-input — weather threshold + location
- [ ] #tmpl-smart-create-chit — create chit action panel fields

### Initialization
- [ ] DOMContentLoaded listener — injects save buttons, initializes save system, wires all event listeners, loads tag/people/locations, checks URL params for rule ID/bundle/trigger
- [ ] Bundle mode handling — auto-sets name, locks trigger, hides actions section, defaults confirm off
