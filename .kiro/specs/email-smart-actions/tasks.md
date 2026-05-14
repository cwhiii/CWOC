# Implementation Tasks

## Task 1: Add Order Confirmation Detectors to Registry

- [x] Add Order category detectors to `_smartLinkDetectors` array in `shared-smart-links.js`:
  - Amazon: keywords `[/\b(amazon|amzn)\b/i, /\b(order|confirmation|shipped)\b/i]`, regex for order IDs (`/\b(\d{3}-\d{7}-\d{7})\b/`), URL to Amazon order history
  - Apple: keywords `[/\b(apple)\b/i, /\b(order|receipt)\b/i]`, regex for Apple order format (`/\b(W\d{9,12})\b/i`), URL to Apple order status
  - Best Buy: keywords `[/\b(best\s*buy|bestbuy)\b/i]`, regex for BBY order numbers (`/\b(BBY\d{2}-\d{8,12}|\d{10,16})\b/i`), URL to Best Buy order status
  - Walmart: keywords `[/\b(walmart)\b/i, /\b(order|confirmation)\b/i]`, regex for Walmart order format (`/\b(\d{13,16})\b/`), URL to Walmart order tracking
  - Target: keywords `[/\b(target)\b/i, /\b(order|confirmation)\b/i]`, regex for Target order format (`/\b(\d{9,15})\b/`), URL to Target order page
- [x] Create `/static/tracking/order.svg` icon (shopping bag or receipt icon, matching existing SVG style)
- [x] Verify detection works by checking that an email with "Your Amazon order 123-4567890-1234567 has shipped" produces a Smart_Link

**Requirements validated:** 1.1, 9.1, 9.2, 9.3

## Task 2: Add `initSmartLinkRegistry(config)` to Detection Engine

- [x] Add a module-level `_smartLinkConfig` variable (default: `{ disabled: {}, disabledCategories: [], maxResults: 3, customDetectors: [] }`)
- [x] Implement `initSmartLinkRegistry(config)` function that:
  - Stores the config in `_smartLinkConfig`
  - Compiles custom detector regex strings into RegExp objects
  - Converts custom detector keyword strings into RegExp objects
  - Appends compiled custom detectors to a `_customDetectors` array
- [x] Modify `detectSmartLinks()` to:
  - Read `maxResults` from `_smartLinkConfig` (fallback to options param, then default 3)
  - Skip detectors whose `name` is in `_smartLinkConfig.disabled`
  - Skip detectors whose `category` is in `_smartLinkConfig.disabledCategories`
  - Include `_customDetectors` in the sorted detector list alongside built-ins
- [x] Handle invalid custom detector regex gracefully (try/catch on `new RegExp()`, skip + console.error on failure)

**Requirements validated:** 2.1, 2.2, 2.4, 3.2, 5.1, 5.2, 5.5

## Task 3: Backend — Add `smart_actions_config` Field

- [x] Add `smart_actions_config: Optional[str] = None` to the Settings Pydantic model in `models.py`
- [x] Add migration function `migrate_smart_actions_config()` in `migrations.py` that adds the column to the settings table (with existence check)
- [x] Call the migration function from `main.py` startup sequence
- [x] Verify the existing settings GET/POST routes handle the new field automatically (they should via the Pydantic model + `serialize_json_field`/`deserialize_json_field` pattern)

**Requirements validated:** 8.1, 8.2

## Task 4: Frontend — Load Config on Dashboard Init

- [x] In the email dashboard initialization (where settings are fetched), after loading settings:
  - Read `smart_actions_config` from the settings response
  - Parse it from JSON string if present
  - Call `initSmartLinkRegistry(parsedConfig)` to configure the detection engine
- [x] If `smart_actions_config` is null/undefined/empty, call `initSmartLinkRegistry({})` (all defaults — everything enabled)
- [x] If settings fetch fails, detection engine uses defaults (all built-ins enabled) — existing behavior, just ensure `initSmartLinkRegistry` handles gracefully

**Requirements validated:** 5.5, 8.3, 8.4

## Task 5: Settings UI — Smart Actions Section (HTML)

- [x] Add a new collapsible section to `settings.html` titled "🛡️ Badges" (in the email settings area)
- [x] Add a "Max badges per email" dropdown (values: 1, 2, 3, 5, 10) with id `smart-actions-max`
- [x] Add a container `div#smart-actions-categories` where category groups will be rendered by JS
- [x] Add a "Custom Detectors" subsection with:
  - Container `div#smart-actions-custom-list` for listing custom detectors
  - An "Add Custom Detector" button (`id="smart-actions-add-custom"`)
- [x] Add custom detector modal with form fields (name, category, keywords, regex, URL template, label)

**Requirements validated:** 7.1, 7.2, 7.3

## Task 6: Settings UI — Smart Actions Section (JS Logic)

- [x] Add a new file `settings-badges.js` for smart actions initialization (`_initBadgesSettings()`)
- [x] On settings load, parse `smart_actions_config` and populate the UI:
  - Render each category group from `_smartLinkDetectors` (grouped by category)
  - Set toggle states based on `disabled` and `disabledCategories` from config
  - Render custom detectors list from `config.customDetectors`
  - Set max results dropdown value
- [x] Wire category toggle: toggling a category disables/enables all detectors in it
- [x] Wire individual detector toggle: adds/removes from `disabled` map
- [x] Wire "Add Custom Detector" button to open the custom detector form modal
- [x] In the form modal:
  - Validate regex field (try `new RegExp(value)`, show error if invalid)
  - Validate URL template contains `{code}` substring
  - On save: generate ID (`"custom-" + Date.now()`), add to custom detectors array, re-render list, mark settings dirty
- [x] Wire edit button on custom detectors: populate form modal with existing values, save overwrites
- [x] Wire delete button on custom detectors: `cwocConfirm` then remove from array, re-render, mark dirty
- [x] On settings save, serialize the full `smart_actions_config` object back to JSON and include in the POST body

**Requirements validated:** 4.1, 4.2, 4.3, 4.4, 4.5, 5.3, 5.4, 7.3, 7.4, 7.5, 7.6

## Task 7: Action Button Rendering — Badge Shape

- [x] Rename the feature display name to "Badges" in the UI (settings section title: "🛡️ Badges")
- [x] Restyle the action buttons as rounded shields: flat top edge, rectangular body, rounded bottom corners (border-radius: 0 0 8px 8px)
- [x] Ensure minimum 44x44px tap target on mobile
- [x] Add `onerror` handler on icon `<img>` elements to fall back to text-only label
- [x] Ensure button click uses `e.stopPropagation()` to prevent card selection
- [x] Add/update CSS for the badge shape in the appropriate stylesheet (dashboard styles for email cards)

**Requirements validated:** 6.1, 6.2, 6.3, 6.4, 6.5

## Task 8: Update Help Documentation

- [x] Add a "Badges" section to the help page documenting:
  - What badges are and what they detect (packages, flights, hotels, etc.)
  - How to enable/disable detectors in settings
  - How to create custom detectors
  - The badge shape and what clicking them does

## Task 9: Update INDEX.md, Version, and Release Notes

- [x] Update `src/INDEX.md` with any new functions, files, or sections added
- [x] Run `date "+%Y%m%d.%H%M"` and update `src/VERSION`
- [x] Create/update release notes file with a brief summary of the badges feature

## Task 10 (Optional): Property-Based Tests

- [ ] Write property tests for detection output correctness (Property 1)
- [ ] Write property tests for category uniqueness and result limiting (Property 2)
- [ ] Write property tests for keyword gate filtering (Property 3)
- [ ] Write property tests for disabled detector exclusion (Property 6)
- [ ] Write property tests for regex/URL validation (Properties 7, 8)

**Note:** Tests are optional per project conventions — they are not a blocker for completing this feature.
