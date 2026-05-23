# Plan: Reorganize `src/static/` into `images/`, `sounds/`, and `archive/`

## Goal
Move all image and audio files in `src/static/` into organized subdirectories:
- `src/static/images/` — actively used images
- `src/static/sounds/` — audio files
- `src/static/archive/` — images not referenced anywhere in the codebase

Update all references across web, mobile browser, AND Android app.

---

## Current State — File Inventory

### Images → `src/static/images/`

| File | Where it's used |
|------|----------------|
| `cwod_logo-favicon.png` | Every HTML page favicon, SW cache, dashboard |
| `cwod_logo.png` | Login, kiosk, contact-editor, profile, index.html, SW cache |
| `cwod_logo-large.png` | SW precache list |
| `parchment.jpg` | CSS backgrounds everywhere + inline JS styles |
| `default-avatar.svg` | Editor, contact-editor, profile, user-admin.js |
| `nest.svg` | Editor nest button, editor-mobile-zones.js |
| `nest-eggs.svg` | editor-email.js thread icon |
| `calendar.png` | Dashboard tab, favicon map, settings, shared-mobile |
| `checklists.png` | Dashboard tab, favicon map, settings, shared-mobile |
| `tasks.png` | Dashboard tab, favicon map, settings, shared-mobile |
| `projects.png` | Dashboard tab, favicon map, settings, shared-mobile |
| `notes.png` | Dashboard tab, favicon map, settings, shared-mobile |
| `alerts.png` | Dashboard tab, favicon map, settings, shared-mobile |
| `email.png` | Dashboard tab, editor, favicon map, shared-mobile |
| `Indicators.png` | Dashboard tab, favicon map, settings, shared-mobile |
| `settings.png` | Settings favicon, sidebar settings button |
| `create_new.png` | Editor favicon + header, sidebar create button |

### Sounds → `src/static/sounds/`

| File | Where it's used |
|------|----------------|
| `alarm.mp3` | shared-alarms.js, shared.js, editor-alerts.js, main-alerts.js |
| `timer.mp3` | shared-alarms.js, shared.js, editor-alerts.js, main-alerts.js |

### Archive → `src/static/archive/`

| File | Reason |
|------|--------|
| `editor.png` | Not referenced anywhere in code |
| `alarms_large.png` | Not referenced anywhere in code |
| `calendar_large.png` | Not referenced anywhere in code |
| `checklists_large.png` | Not referenced anywhere in code |
| `create_new-large.png` | Not referenced anywhere in code |
| `notes_large.png` | Not referenced anywhere in code |
| `projects_large.png` | Not referenced anywhere in code |
| `settings-large.png` | Not referenced anywhere in code |
| `tasks_large.png` | Not referenced anywhere in code |
| `Lora.zip` | Font source archive, not referenced |

### Stays in place (no move)
- `src/static/fonts/` — already organized
- `src/static/tracking/` — already organized (smart link SVG icons)
- `src/static/vendor/` — third-party libraries
- `src/static/502.html` — error page
- `src/static/upgrading.html` — maintenance page
- `src/static/.gitkeep` — git marker

### PWA icons (special case — NO CHANGE)
`cwoc-icon-192.png` and `cwoc-icon-512.png` live in `src/pwa/`, served via explicit
FastAPI routes at `/static/cwoc-icon-*`. These are virtual paths, not actual files in
`src/static/`. Completely unaffected.

---

## Android App — How It Uses These Assets

The Android app does NOT load images from the server's `/static/` URL at runtime for its
core UI. Instead, it bundles its own copies as Android drawable resources:

| Android drawable | Corresponds to web static file |
|-----------------|-------------------------------|
| `R.drawable.cwoc_logo` (cwoc_logo.png) | `cwod_logo.png` |
| `R.drawable.parchment_bg` (parchment_bg.jpg) | `parchment.jpg` |
| `R.drawable.tab_calendar` (tab_calendar.png) | `calendar.png` |
| `R.drawable.tab_checklists` (tab_checklists.png) | `checklists.png` |
| `R.drawable.tab_tasks` (tab_tasks.png) | `tasks.png` |
| `R.drawable.tab_projects` (tab_projects.png) | `projects.png` |
| `R.drawable.tab_notes` (tab_notes.png) | `notes.png` |
| `R.drawable.tab_alerts` (tab_alerts.png) | `alerts.png` |
| `R.drawable.tab_email` (tab_email.png) | `email.png` |
| `R.drawable.tab_indicators` (tab_indicators.png) | `Indicators.png` |

These are bundled in `android/app/src/main/res/drawable/` and referenced via
`R.drawable.*` — they do NOT use server URLs. **No Kotlin code changes needed for the
image/sound moves.**

The only server `/static/` paths the Android app references are:
- `/static/tracking/order.svg` (in EmailSettingsTab.kt and CustomDetectorDialog.kt)

Since `tracking/` isn't moving, **the Android app needs zero code changes**.

However, if the source images in `src/static/` are the canonical source that the Android
drawables were copied from, the plan should note that future image updates should come
from `src/static/images/` (the new canonical location).

---

## Execution Steps

### Step 1: Create subdirectories
```
mkdir src/static/images/
mkdir src/static/sounds/
mkdir src/static/archive/
```

### Step 2: Move files

**To `images/`:** cwod_logo-favicon.png, cwod_logo.png, cwod_logo-large.png,
parchment.jpg, default-avatar.svg, nest.svg, nest-eggs.svg, calendar.png,
checklists.png, tasks.png, projects.png, notes.png, alerts.png, email.png,
Indicators.png, settings.png, create_new.png

**To `sounds/`:** alarm.mp3, timer.mp3

**To `archive/`:** editor.png, alarms_large.png, calendar_large.png,
checklists_large.png, create_new-large.png, notes_large.png, projects_large.png,
settings-large.png, tasks_large.png, Lora.zip

### Step 3: Update all web references

Path changes:
- `/static/X.png` → `/static/images/X.png` (for all moved images)
- `/static/X.mp3` → `/static/sounds/X.mp3` (for audio files)

#### 3a. HTML files (favicon, apple-touch-icon, img src, background-image)

Every HTML page has at minimum a favicon reference. Full list:
- `src/frontend/html/index.html` — favicon, all tab icon `<img>` tags, header logo
- `src/frontend/html/editor.html` — favicon, header logo, email.png buttons, nest.svg, default-avatar
- `src/frontend/html/settings.html` — settings.png favicon, parchment.jpg background
- `src/frontend/html/login.html` — favicon, parchment.jpg background, cwod_logo.png
- `src/frontend/html/kiosk.html` — favicon, cwod_logo.png
- `src/frontend/html/contact-editor.html` — favicon, cwod_logo.png, default-avatar
- `src/frontend/html/profile.html` — favicon, cwod_logo.png, default-avatar
- All other HTML pages (people, weather, trash, audit-log, help, maps, rules-manager,
  rule-editor, user-admin, custom-objects-editor, contact-trash, attachments,
  notifications, admin-chits, _template) — favicon only
- `src/pwa/offline.html` — favicon

#### 3b. CSS files (background-image with parchment.jpg)
- `src/frontend/css/shared/shared-page.css` — parchment.jpg (5 occurrences)
- `src/frontend/css/dashboard/styles-layout.css` — parchment.jpg (2 occurrences)
- `src/frontend/css/dashboard/styles-cards.css` — parchment.jpg (1)
- `src/frontend/css/dashboard/styles-responsive.css` — parchment.jpg (1)
- `src/frontend/css/dashboard/styles-hotkeys.css` — parchment.jpg (2)
- `src/frontend/css/dashboard/styles-modals.css` — parchment.jpg (1)
- `src/frontend/css/editor/editor.css` — parchment.jpg (8+ occurrences)

Note: font-face URLs (`/static/fonts/...`) are NOT changing — fonts stay in place.

#### 3c. JavaScript files
- `src/frontend/js/dashboard/main-views.js` — _viewFavicons map (all tab icons)
- `src/frontend/js/dashboard/main-calendar.js` — inline parchment.jpg (2)
- `src/frontend/js/dashboard/main-alerts.js` — alarm.mp3, timer.mp3
- `src/frontend/js/pages/settings-views.js` — _viewMeta icon sources
- `src/frontend/js/pages/settings-custom-filters.js` — _customFilterViews icons
- `src/frontend/js/pages/user-admin.js` — default-avatar.svg
- `src/frontend/js/shared/shared.js` — parchment.jpg, alarm.mp3, timer.mp3, favicon
- `src/frontend/js/shared/shared-alarms.js` — alarm.mp3, timer.mp3, parchment.jpg, favicon
- `src/frontend/js/shared/shared-mobile.js` — _mobileViewIconMap (all tab icons)
- `src/frontend/js/shared/shared-sidebar.js` — settings.png, create_new.png
- `src/frontend/js/editor/editor-email.js` — nest-eggs.svg
- `src/frontend/js/editor/editor-mobile-zones.js` — nest.svg
- `src/frontend/js/editor/editor-alerts.js` — alarm.mp3, timer.mp3

#### 3d. PWA Service Worker
- `src/pwa/sw.js` — precache list: update cwod_logo.png, cwod_logo-favicon.png,
  cwod_logo-large.png, parchment.jpg paths

#### 3e. Python backend — NO CHANGES NEEDED
- All backend `/static/cwoc-icon-*` references are virtual routes serving from `src/pwa/`
- The `StaticFiles` mount serves the entire `src/static/` tree (subdirs automatic)
- Middleware path prefix check (`/static/`) still works
- No backend code references the moved image/sound filenames directly

#### 3f. Android app (Kotlin) — NO CODE CHANGES NEEDED
- Uses bundled `R.drawable.*` resources, not server URLs
- Only server `/static/` reference is `/static/tracking/order.svg` (not moving)

### Step 4: Verification

1. Grep entire codebase for any remaining `/static/X.png`, `/static/X.jpg`,
   `/static/X.svg`, `/static/X.mp3` that should now be under `/static/images/` or
   `/static/sounds/` — catch any missed references
2. Confirm no references point to `/static/archive/` (those files shouldn't be loaded)
3. Verify the StaticFiles mount still serves subdirs (it does by default)

### Step 5: Update steering docs

Add to `structure.md` or `tech.md`:
- New images go in `src/static/images/`
- New audio files go in `src/static/sounds/`
- Unused assets go in `src/static/archive/`

### Step 6: Update INDEX.md

Update the static directory structure in the project index to reflect the new layout.

---

## Resulting Directory Structure

```
src/static/
  images/              ← all active images (17 files)
    cwod_logo-favicon.png
    cwod_logo.png
    cwod_logo-large.png
    parchment.jpg
    default-avatar.svg
    nest.svg
    nest-eggs.svg
    calendar.png
    checklists.png
    tasks.png
    projects.png
    notes.png
    alerts.png
    email.png
    Indicators.png
    settings.png
    create_new.png
  sounds/              ← audio files (2 files)
    alarm.mp3
    timer.mp3
  archive/             ← unused images (10 files)
    editor.png
    alarms_large.png
    calendar_large.png
    checklists_large.png
    create_new-large.png
    notes_large.png
    projects_large.png
    settings-large.png
    tasks_large.png
    Lora.zip
  fonts/               ← unchanged
  tracking/            ← unchanged
  vendor/              ← unchanged
  502.html             ← stays
  upgrading.html       ← stays
```

---

## Risk Assessment

**Low risk:**
- FastAPI `StaticFiles` mount serves the entire `src/static/` tree — subdirs work
  automatically, no backend route changes needed
- PWA icons (`/static/cwoc-icon-*`) are virtual routes from `src/pwa/` — unaffected
- Android app uses bundled drawables — unaffected
- `tracking/` stays put — Android's only `/static/` reference is safe

**Medium risk:**
- ~35+ files need path updates. A single missed reference = broken image/sound.
  Mitigation: systematic find-and-replace, then verification grep.
- `parchment.jpg` appears in many inline JS `style.cssText` strings — easy to miss.
  Mitigation: dedicated grep for `parchment.jpg` after all changes.
- Audio references appear in 4 different JS files (some duplicated between shared.js
  and shared-alarms.js). Mitigation: grep for `.mp3` after changes.

---

## Platform Impact

| Platform | Code changes? | Details |
|----------|--------------|---------|
| Web (desktop) | ✅ Yes | HTML, CSS, JS path updates |
| Mobile (browser) | ✅ Yes | Same frontend code as web |
| App (Android) | ❌ No | Uses bundled R.drawable resources, not server URLs |

---

## Deployment

After implementation: **Server push only** — only frontend/static file organization
changes. No Android code changes, no schema changes, no app rebuild needed.

| Instruction | Server Push? | Android Studio Action | Phone Action |
|---|---|---|---|
| Server push only | Yes (`systemctl restart cwoc`) | Nothing | Nothing |
