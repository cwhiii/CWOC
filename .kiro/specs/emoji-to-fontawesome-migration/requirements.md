# Requirements Document

## Introduction

Replace all emoji characters throughout the CWOC web app with Font Awesome 6 Free icons to achieve cross-platform visual consistency. Emojis render differently across operating systems (Android, iOS, Windows, Linux), making the UI unpredictable. Font Awesome icons render identically everywhere via font files. Each replacement icon receives a distinct color from a curated palette so that adjacent icons are visually distinguishable. This migration is a prerequisite for Phase 5 of the Android app, enabling pixel-identical icon rendering between web and mobile.

## Glossary

- **Icon_Mapping**: A documented association between a specific emoji character and its replacement Font Awesome 6 icon class name, assigned color, and usage context
- **Icon_Registry**: A centralized JavaScript data structure containing all Icon_Mappings, consumed by both rendering logic and the Android app
- **FA_Icon**: A Font Awesome 6 Free icon rendered via an `<i>` element with appropriate CSS classes (e.g., `fa-solid fa-bell`)
- **Icon_Color_Palette**: A set of 8–12 distinct colors assigned to FA_Icons, inspired by but not identical to the existing `_cwocDefaultColors` palette
- **Icon_Container**: An optional circular border wrapper around an FA_Icon providing uniform visual size and shape
- **Self_Hosted_Fonts**: Font Awesome 6 font files (WOFF2/TTF) bundled in the `static/` directory and loaded via local CSS, replacing CDN references
- **Audit**: A systematic scan of all HTML, JS, CSS, and Python files to identify every emoji character in use
- **CWOC_App**: The C.W.'s Omni Chits web application (vanilla JS, HTML, CSS frontend with FastAPI backend)

## Requirements

### Requirement 1: Emoji Audit

**User Story:** As a developer, I want a complete inventory of every emoji used across the CWOC web app, so that I can ensure no emoji is missed during migration.

#### Acceptance Criteria

1. THE Audit SHALL identify every distinct Unicode emoji character (codepoints in the Emoji_Presentation property or sequences using U+FE0F variation selector) used across all HTML files in `src/frontend/html/`
2. THE Audit SHALL identify every distinct Unicode emoji character used across all JavaScript files in `src/frontend/js/`
3. THE Audit SHALL identify every distinct Unicode emoji character used across all Python backend files in `src/backend/`, including emoji in string literals, comments, and docstrings
4. THE Audit SHALL identify every distinct Unicode emoji character used in static HTML files (`src/static/upgrading.html`, `src/static/502.html`, `src/pwa/offline.html`)
5. THE Audit SHALL produce a markdown-formatted list documenting each emoji with: the emoji character, every file path where it appears, and a one-phrase description of its semantic purpose in that context (e.g., "🔔 — `src/frontend/js/shared/shared.js` — alarm/notification indicator")
6. THE Audit SHALL identify emojis embedded in CSS `content` properties across all CSS files in `src/frontend/css/`
7. IF the same emoji is used with different semantic purposes in different files, THEN THE Audit SHALL list each purpose as a separate entry tied to the relevant file(s)
8. THE Audit SHALL treat multi-codepoint emoji sequences (ZWJ sequences, skin-tone variants, keycap sequences) as distinct entries separate from their base emoji character

### Requirement 2: Icon Mapping Definition

**User Story:** As a developer, I want each emoji mapped to an appropriate Font Awesome 6 Free icon, so that the replacement icons convey the same meaning as the originals.

#### Acceptance Criteria

1. THE Icon_Mapping SHALL associate each audited emoji with exactly one FA 6 Free icon class (solid, regular, or brands), specifying the full CSS class string (e.g., `fa-solid fa-house`) and a brief semantic rationale for the choice
2. THE Icon_Mapping SHALL be presented to the user for review and approval before implementation begins
3. WHEN multiple FA_Icons are plausible candidates for a single emoji, THE Icon_Mapping SHALL present 2–3 options with a recommended choice for user decision
4. THE Icon_Mapping SHALL use only icons available in the Font Awesome 6 Free tier (no Pro-only icons)
5. THE Icon_Mapping SHALL avoid reusing the same FA_Icon for two or more emojis that serve different functional roles in the UI, unless fewer than two candidate icons exist in the FA 6 Free set for one of the conflicting emojis
6. IF no FA 6 Free icon adequately conveys the meaning of an audited emoji, THEN THE Icon_Mapping SHALL flag that emoji for user decision, presenting the closest available options and noting the semantic gap

### Requirement 3: Icon Color Palette

**User Story:** As a developer, I want a curated color palette for the FA icons, so that adjacent icons in a row are visually distinguishable rather than uniformly brown.

#### Acceptance Criteria

1. THE Icon_Color_Palette SHALL contain between 8 and 12 colors, where no two colors have a CIEDE2000 perceptual difference (ΔE) less than 15
2. THE Icon_Color_Palette SHALL use hue families present in the existing `_cwocDefaultColors` (rose, sienna/orange, gold/amber, green, teal/blue, purple) as starting points, without reusing any hex value already in `_cwocDefaultColors`
3. THE Icon_Color_Palette SHALL maintain a minimum WCAG contrast ratio of 3:1 against both the parchment background (`#fffaf0`) and the surface color (`#f5e6d3`)
4. THE Icon_Color_Palette SHALL be presented to the user as color swatches with sample FA_Icons for approval before implementation
5. WHEN two icons appear adjacent in the UI (within the same navigation list, toolbar row, or section header group), THE Icon_Color_Palette SHALL assign colors that are not identical — no two consecutive icons in a sequence receive the same color
6. THE Icon_Color_Palette SHALL restrict hue values to warm and muted tones (saturation between 25% and 65% in HSL) to remain consistent with the 1940s parchment/magic aesthetic of the CWOC_App
7. WHEN the Icon_Color_Palette is defined, THE Icon_Registry SHALL store the assigned color for each icon entry so that the same icon always renders in the same palette color across all pages

### Requirement 4: Visual Treatment Decision

**User Story:** As a developer, I want a consistent visual treatment for all FA icons (bare vs. circular container), so that icons feel uniform in size and shape across the app.

#### Acceptance Criteria

1. THE CWOC_App SHALL present the user with at least two visual treatment options: bare FA_Icon and FA_Icon inside an Icon_Container (circular border)
2. THE visual treatment options SHALL be demonstrated with at least one sample mockup per usage context (navigation, section headers, inline text, cards), showing both bare and contained variants side by side
3. WHEN the user selects a visual treatment, THE CWOC_App SHALL apply that treatment to every FA_Icon instance across all pages, including icons in navigation, section headers, inline text, cards, and buttons
4. IF the Icon_Container treatment is chosen, THEN THE Icon_Container SHALL use a border-radius of 50%, horizontal and vertical padding equal to 25% of the icon's font-size, and a border color defined by the existing theme CSS variable (e.g., the brown border tone from shared-page.css), applied identically across all icon sizes
5. THE visual treatment SHALL scale across three icon size tiers used in the app (inline text icons at 1em, section header icons at 1.25em, page title icons at 1.5em or larger), maintaining proportional padding and container dimensions relative to each tier's font-size
6. IF the Icon_Container treatment is chosen, THEN icons used inside interactive controls (buttons, toggles) SHALL receive the same container treatment unless the container would exceed the control's height, in which case the bare icon SHALL be used with a documented exception list

### Requirement 5: Self-Hosted Font Files

**User Story:** As a developer, I want Font Awesome 6 font files bundled locally in the project, so that the app works offline and the Android app can reuse the same files for pixel-identical rendering.

#### Acceptance Criteria

1. THE CWOC_App SHALL serve Font Awesome 6 Free version 6.7.2 font files (WOFF2 and TTF formats) from the `static/fonts/fontawesome/` directory
2. THE CWOC_App SHALL load Font Awesome 6 CSS from a local file in `frontend/css/shared/` whose @font-face declarations reference font files at `/static/fonts/fontawesome/` using absolute paths
3. WHEN all CDN references are removed from every HTML file, THE CWOC_App SHALL render all FA icon classes (fa-solid, fa-regular, fa-brands) at the same glyph, size, and position as the CDN-loaded version with no missing or fallback-font icons visible on any page
4. THE Self_Hosted_Fonts SHALL include the complete Font Awesome 6.7.2 Free icon set covering the Solid, Regular, and Brands families
5. THE PWA service worker (`pwa/sw.js`) SHALL include the local Font Awesome CSS file and all WOFF2 and TTF font files in the APP_SHELL_URLS cache list for offline use
6. WHEN the local Font Awesome CSS is adopted, THE CWOC_App SHALL replace the `cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css` link tag in every HTML file with a link to the local CSS file in `frontend/css/shared/`, leaving no remaining CDN references to Font Awesome

### Requirement 6: Emoji Replacement Implementation

**User Story:** As a developer, I want all emoji characters replaced with FA icon markup throughout the codebase, so that the app renders consistently across all platforms.

#### Acceptance Criteria

1. WHEN an emoji appears in HTML as static text content, THE replacement SHALL use an `<i>` element with the mapped FA_Icon class and assigned color from the Icon_Registry
2. WHEN an emoji appears in JavaScript as a string literal used for DOM insertion, THE replacement SHALL use an `<i>` element string with the mapped FA_Icon class and assigned color from the Icon_Registry
3. WHEN an emoji appears in a Python backend response that is rendered in the frontend, THE replacement SHALL use either an FA_Icon class reference or an `<i>` element string appropriate to the rendering context
4. WHEN an emoji appears in a `data-page-icon` attribute on `<body>` elements, THE replacement SHALL use an FA_Icon class name that the `shared-page.js` header injection logic can render as an `<i>` element
5. THE replacement SHALL preserve the semantic meaning of each icon in its context (e.g., a bell icon for alarms, a trash can for delete)
6. IF an emoji is used in a notification title or push notification payload where HTML markup cannot render, THEN THE replacement SHALL use a text-safe representation (Unicode symbol or plain text label) or omit the icon

### Requirement 7: Cross-Page Consistency

**User Story:** As a developer, I want all pages to use the same icon rendering approach, so that the app feels visually cohesive.

#### Acceptance Criteria

1. THE CWOC_App SHALL render FA_Icons on all pages — dashboard (`index.html`), editor (`editor.html`), settings (`settings.html`), people (`people.html`), weather (`weather.html`), trash (`trash.html`), audit log (`audit-log.html`), help (`help.html`), kiosk (`kiosk.html`), maps (`maps.html`), attachments (`attachments.html`), rules manager (`rules-manager.html`), rule editor (`rule-editor.html`), contact editor (`contact-editor.html`), contact trash (`contact-trash.html`), custom objects editor (`custom-objects-editor.html`), notifications (`notifications.html`), user admin (`user-admin.html`), admin chits (`admin-chits.html`) — by resolving each icon's FA class and color exclusively through the Icon_Registry lookup, with no hardcoded FA class strings outside the registry definition itself
2. THE CWOC_App SHALL load the Icon_Registry from a single shared JavaScript file included on every page, so that all icon lookups reference one data structure
3. WHEN a page renders an FA_Icon, THE CWOC_App SHALL apply the same FA class prefix (e.g., `fa-solid`, `fa-regular`), the same color value, and the same font-size as any other page rendering the same icon key
4. IF an icon key is requested that does not exist in the Icon_Registry, THEN THE CWOC_App SHALL render a designated fallback icon (a generic placeholder) rather than displaying no icon or a broken reference
5. WHEN a new icon is needed in the future, THE Icon_Registry SHALL be the sole location where the icon's FA class and color are defined, requiring no changes to individual page files for the icon to appear correctly on any page that references it

### Requirement 8: Icon Mapping Documentation

**User Story:** As a developer, I want the complete emoji-to-FA mapping documented in a reusable format, so that the Android app can consume the same mapping for pixel-identical rendering.

#### Acceptance Criteria

1. THE Icon_Registry SHALL be defined as a JavaScript object in a file within the `shared/` directory, loaded via a `<script>` tag on all pages that render icons
2. THE Icon_Registry SHALL contain for each entry: the original emoji (single Unicode character or sequence), the Font Awesome 6 icon class (e.g., `fas fa-bell`), the assigned hex color as a 6-digit code with leading `#` (e.g., `#8b5a2b`), and a human-readable label of no more than 40 characters
3. THE Icon_Registry SHALL be served as JSON via a GET API endpoint (e.g., `/api/icon-registry`) so that the Android app (Kotlin) can fetch the mapping at runtime or build time
4. THE Icon_Registry SHALL be the single source of truth for emoji-to-icon mappings, meaning all frontend rendering code and the Android app SHALL reference this registry rather than defining inline mappings
5. THE Icon_Registry SHALL include a `version` string in the format `YYYYMMDD.HHMM` so that web and Android can compare versions and detect mismatches
6. IF a requested emoji has no entry in the Icon_Registry, THEN THE system SHALL fall back to rendering the original emoji character unchanged

### Requirement 9: Backward Compatibility

**User Story:** As a developer, I want the migration to preserve all existing functionality, so that no features break during the icon replacement.

#### Acceptance Criteria

1. WHEN an FA_Icon replaces an emoji in a clickable element, THE click target area SHALL remain at least 44×44 CSS pixels and no smaller than the original emoji element's rendered dimensions
2. WHEN an FA_Icon replaces an emoji used in search or filter logic, THE search and filter operations SHALL return identical result sets for the same user input as before the migration
3. IF any emoji is used as a data value stored in the database (e.g., in chit content, tags, or checklist text), THEN THE migration SHALL not alter stored data — only rendering logic changes
4. THE migration SHALL not introduce any new external dependencies beyond the self-hosted Font Awesome 6 Free files
5. WHEN the migration is complete, THE CWOC_App SHALL render all pages without JavaScript errors in the browser console that were not present before the migration
6. WHEN an emoji previously appeared in a `title` or `aria-label` attribute, THE replacement SHALL preserve an equivalent text description so that tooltip and accessibility semantics are maintained
7. WHEN an FA_Icon replaces an emoji used as a label in keyboard shortcut displays or hotkey overlays, THE associated keyboard shortcut functionality SHALL remain bound to the same key and trigger the same action as before the migration
