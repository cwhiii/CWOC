# Contacts Rolodex — Complete Functional Specification

This document describes **every single piece of functionality** on the CWOC Contacts/Rolodex feature as it exists on the web version. It is intended to be sufficient to reproduce the feature exactly on another platform.

---

## Table of Contents
1. [People Page (Rolodex List)](#people-page-rolodex-list)
2. [Contact Editor Page](#contact-editor-page)
3. [Contact Trash Page](#contact-trash-page)
4. [QR Code Sharing](#qr-code-sharing)
5. [Data Model](#data-model)
6. [API Endpoints](#api-endpoints)
7. [Import/Export](#importexport)
8. [Vault System](#vault-system)
9. [Birthday Calendar Integration](#birthday-calendar-integration)

---

## People Page (Rolodex List)

**URL:** `/frontend/html/people.html`

### Toolbar (top of page)
The toolbar contains these elements in order, left to right, wrapping on narrow screens:

1. **"New Contact" button** — navigates to `/frontend/html/contact-editor.html` (no params = create mode)
2. **"Import" button** — opens a hidden file picker accepting `.vcf` and `.csv` files
3. **"Export" button** — shows a dropdown with two options:
   - "Export as .vcf (vCard)" — triggers download of all contacts as a single `.vcf` file
   - "Export as .csv" — triggers download of all contacts as a `.csv` file
4. **"Group/Ungroup" toggle button** — toggles between grouped view (sections) and flat alphabetical list
   - Persisted in `localStorage` key `cwoc_people_grouped` (`'1'` or `'0'`)
   - When grouped: icon is `fa-layer-group`, label is "Ungroup"
   - When ungrouped: icon is `fa-list`, label is "Group"
5. **"Trash" button** — navigates to `/frontend/html/contact-trash.html`
6. **Search input** — placeholder "🔍 Search contacts...", full-width flex-grow

### Search Behavior
- **Client-side filter** runs immediately on every keystroke
- Searches across: display_name, nickname, organization, social_context, emails (values+labels), phones (values+labels), addresses (values), call_signs (values), x_handles (values), websites (values), dates (labels+values)
- **API fallback**: after 300ms debounce, if query is ≥2 chars, also hits `GET /api/contacts?q=<query>` for server-side search
- When query is cleared, reloads full list from API

### Contact List Display

#### Grouped Mode (default)
The list is divided into collapsible sections:

1. **★ Favorites** — contacts with `favorite=true` + users with localStorage favorite flag
2. **Users** — app users from `/api/auth/switchable-users` (non-favorited)
3. **All Contacts** — non-favorite, non-vault contacts
4. **🏛️ Contact Vault** — contacts shared to vault from other users

Each section has:
- A divider bar showing: section label + count in parentheses + chevron icon
- Click divider to collapse/expand (persisted in localStorage key `cwoc_people_collapsed` as JSON object)
- Collapsed sections show chevron rotated -90deg

#### Ungrouped Mode
All contacts and users merged into a single flat list, sorted alphabetically by display name (case-insensitive).

### Contact Row Layout
Each contact row contains (left to right):

1. **Star toggle** (★/☆) — click toggles favorite via `PATCH /api/contacts/{id}/favorite`
   - Font size 1.3em, 28px wide, centered
   - Hover: scale 1.2
2. **Thumbnail** (32×32px circle):
   - If `image_url` exists: `<img>` with `object-fit: cover`, 1px solid brown border
   - If no image: placeholder circle with `<i class="fas fa-user">` icon, dashed border, parchment background
3. **Info column** (flex: 1, min-width: 0):
   - **Name** — `display_name` or `given_name` or "(unnamed)"; bold if favorite; text-overflow ellipsis
   - **Detail line** — first email value · first phone value · organization (joined with " · "); 0.8em, opacity 0.8
4. **Vault icon** (🏛️) — shown if `shared_to_vault` or `is_vault_contact` is true
5. **Share button** — QR code icon button, triggers QR modal for that contact

### Contact Row Behavior
- **Click** → navigate to `/frontend/html/contact-editor.html?id={contact_id}`
- **Cmd/Ctrl+Click** → open in new tab
- **Contact color**: if contact has a `color` field, the row gets:
  - Background tinted with that color (via `applyChitColors()` which auto-contrasts text)
  - Left border: 3px solid {color}

### User Row Layout (for app users)
Similar to contact row but:
- Thumbnail uses `profile_image_url` or placeholder with `fa-users` icon
- Detail line shows `@username`
- Star toggle uses localStorage (`cwoc_user_fav_{user_id}`)
- Click navigates to `/frontend/html/contact-editor.html?mode=profile&user_id={id}`

### Table Header Row
A non-clickable header row with columns: (empty star space) (empty thumb space) "Name" "Phone · Email · Org" (empty share space)

### Empty States
- No contacts at all: "No contacts yet. Click 'New Contact' to add one."
- No search results: "No contacts match your search."

### Import Flow
1. Click "Import" button → hidden `<input type="file" accept=".vcf,.csv">` opens
2. On file selection: `POST /api/contacts/import` with FormData
3. Button shows spinner + "Importing..." while in progress
4. On completion: **Import Result Modal** appears showing:
   - "📋 Import Results" title
   - Stats: "✅ {n} imported" (green badge) + "⚠️ {n} skipped" (yellow badge)
   - Error list (if any): scrollable, max-height 150px, each error shows entry number + reason
   - "Close" button
5. Contact list refreshes after import

### Export Flow
1. Click "Export" button → dropdown appears positioned below button
2. Click "Export as .vcf" → browser navigates to `/api/contacts/export?format=vcf` (triggers download)
3. Click "Export as .csv" → browser navigates to `/api/contacts/export?format=csv` (triggers download)
4. Dropdown closes on: selecting an option, clicking elsewhere, pressing ESC

### Keyboard
- **ESC** priority: close import modal → close export dropdown → navigate to `/` (dashboard)

---

## Contact Editor Page

**URL:** `/frontend/html/contact-editor.html?id={contact_id}` (edit) or no params (create)

### Page Layout
- **Header row**: Logo (links to dashboard), "Contact Editor" title, action buttons, profile menu
- **Editor body**: 3-column responsive grid (collapses to 2 at ≤900px, 1 at ≤768px)

### Header Buttons (left group)
1. **Favorite toggle** (★/☆) — 1.6em star button, no background
2. **Save & Stay** (hidden until dirty) — saves without navigating
3. **Save & Exit** (hidden until dirty) — saves then navigates to People page
4. **Save** (disabled until dirty) — single save button (alternative to split buttons)
5. **Exit** — cancel/exit with unsaved changes check

### Header Buttons (right group)
1. **📱 QR** — share contact via QR code (hidden for new contacts)
2. **📜 Audit** — link to audit log filtered by this contact
3. **🗑️ Delete** — soft-delete with confirmation (hidden for new contacts)

### Profile Image Area (full-width, spans all columns)
Contains:
- **Profile thumbnail** (80×80px circle):
  - Click → opens file picker for image upload
  - If image exists: shows image with 2px solid brown border
  - If no image: dashed border placeholder with large user icon
  - Hover shows 📷 emoji overlay at bottom-right
- **Action buttons** (stacked vertically):
  - "📷 Camera" — opens camera capture modal
  - "🔍 View" — opens full-size image modal (hidden if no image)
  - "✕ Remove" — removes image (hidden if no image)
- **Display name header** — computed from all name parts, updates live as you type
- **Badge area** (right side):
  - Type badge: "📇 Contact" (blue-tinted)
  - **Vault toggle pill**: "🔒 Private" / "🏛️ Vault" — 2-value pill toggle
  - Vault owner info (shown for vault contacts from other users)

### Image Upload Behavior
- Accepts: JPEG, PNG, GIF, WebP
- Non-GIF images resized to max 512px on longest side (via canvas)
- GIFs preserved as-is (to keep animation)
- Image is **staged locally** (preview only) — actual upload happens on save
- Upload endpoint: `POST /api/contacts/{id}/image`

### Camera Capture Modal
- Full-screen dark overlay with centered modal
- Video preview (4:3 aspect ratio)
- Controls: Switch camera (front/back), Capture (large circle button), Retake, Use, Cancel
- On "Use": converts canvas to JPEG blob, stages as pending image

### Full-Size Image Modal
- Click on profile image → full-screen dark overlay with large image
- Click anywhere to dismiss

### Column 1: Name + Security

#### Name Zone
Fields:
- **Prefix** — dropdown with options: None, Mr., Mrs., Ms., Miss, Dr., Prof., Rev., Hon., Custom...
  - "Custom..." reveals a text input for arbitrary prefix
- **Given Name** (required) — text input, red asterisk on label
- **Middle Names** — text input
- **Surname** — text input
- **Suffix** — dropdown with options: None, Jr., Sr., Esq., Ph.D., M.D., I through X, Custom...
  - "Custom..." reveals a text input for arbitrary suffix
- **Nickname** — text input

#### Security Zone
- **Has Signal** — toggle switch
  - When ON: reveals "Signal username or phone" text input + "Signal" message button
  - Signal button generates `signal.me` link (phone → `#p/+number`, username → `#u/username`)
- **PGP Public Key** — textarea with "Validate Key" button
  - Validation uses openpgp.js: shows ✅ Valid with user ID + algorithm info, or ❌ Invalid with error
  - Auto-validates on blur if content present
- **Private PGP Key** (profile mode only) — password-protected section:
  - Locked state: shows "Enter your password to view or edit your private key" + Unlock button
  - Unlock prompts for password via custom modal, verifies via `POST /api/auth/private-pgp-key`
  - Unlocked state: textarea + Save/Lock/Remove buttons

### Column 2: Phone & Email + Context + Notes + Tags

#### Phone & Email Zone
Multi-value sections, each with dynamic add/remove rows:

- **📞 Phone** — label input (80px) + value input (flex) + remove button
  - Default label: "Mobile", placeholder: "+1-555-0100"
  - "Add Phone" button
- **✉️ Email** — same pattern
  - Default label: "Home", placeholder: "user@example.com"
  - "Add Email" button
- **📍 Address** — same pattern + map button + "view in context" button
  - Default label: "Home", placeholder: "4 Rolling Mill Way, Canton, MA 02021"
  - Map button: opens address in Google Maps or OpenStreetMap (based on user setting `prefer_google_maps`)
  - "View in Context" button: navigates to maps page focused on address
  - Embedded OpenStreetMap iframe shown below addresses (geocoded from first address)
  - "Add Address" button
- **📅 Dates** — label + value (Flatpickr date picker, format YYYY-Mon-DD) + calendar toggle checkbox
  - Default label: "Date"
  - Calendar toggle (📅 icon checkbox): controls `show_on_calendar` — whether this date generates annual calendar events
  - "Add Date" button
  - Flatpickr allows both typing and picker selection
  - Dates stored as ISO (YYYY-MM-DD), displayed as YYYY-Mon-DD

#### Context Zone
- **Organization** — text input, placeholder "Company / org"
- **Social Context** — text input, placeholder "How you know them"

#### Notes Zone (collapsed by default)
- **Notes** — textarea, placeholder "Notes about this contact (supports markdown)...", min-height 6em, resizable

#### Tags Zone (collapsed by default)
- **Tag input** — text input, placeholder "Add tag (e.g. Contact/Family) and press Enter"
  - Auto-prepends "Contact/" if not already prefixed
  - Enter adds tag as chip
- **Tag chips** — inline-flex chips with ✕ remove button each

### Column 3: Social & Web + Color

#### Social & Web Zone
Multi-value sections:

- **𝕏 X Handle** — label + value + remove
  - Default label: "X", placeholder: "@username"
  - "Add X Handle" button
- **🌐 Website / Social** — label + value + clickable URL link icon + remove
  - Default label: "Website", placeholder: "https://example.com"
  - When value field loses focus and has content: external link icon appears (clickable, opens URL)
  - "Add Website" button
- **📡 Call Sign** — label + value + remove
  - Default label: "Ham", placeholder: "KD2ABC"
  - "Add Call Sign" button

#### Color Zone
- **Hex input** — text input (90px wide, max 7 chars) + color preview circle (24px)
- **Color swatches** — 20 preset colors in a flex-wrap grid + "no color" swatch (strikethrough pattern)
  - Palette: #E3B23C, #D4764E, #D45B5B, #C2185B, #7B1FA2, #512DA8, #303F9F, #1976D2, #0097A7, #00897B, #388E3C, #689F38, #AFB42B, #F9A825, #FF8F00, #D84315, #795548, #546E7A, #8D6E63, #E91E63
- Selecting a color: updates hex input, preview circle, tints entire editor background with auto-contrast text
- Selected swatch gets dark border + shadow

### Save System (CwocEditorSaveSystem)
- Tracks dirty state from any input change
- Shows Save & Stay / Save & Exit buttons when dirty
- **beforeunload** warning if dirty
- **Cmd+R / Ctrl+R / F5** intercepted: shows CWOC modal instead of browser dialog
- **Cmd+S / Ctrl+S**: save shortcut

### Hotkeys
Number keys 1-8 toggle zone visibility (when not focused on an input):
1. Name, 2. Phone & Email, 3. Social & Web, 4. Security, 5. Context, 6. Color, 7. Notes, 8. Tags

### Save Behavior
1. Validates: given_name is required
2. Creates (`POST /api/contacts`) or updates (`PUT /api/contacts/{id}`)
3. After successful save of new contact: updates URL to include `?id={new_id}`, shows delete/QR buttons
4. If pending image file: uploads via `POST /api/contacts/{id}/image`
5. If pending image removal: calls `DELETE /api/contacts/{id}/image`
6. Marks save system as clean
7. Sends `contacts_changed` sync message

### Delete Behavior
1. Shows `cwocConfirm` modal: "Are you sure you want to permanently delete this contact?" with danger styling
2. On confirm: `DELETE /api/contacts/{id}` (soft-delete)
3. Navigates to People page

### ESC Key Priority
1. Close camera modal
2. Close full-size image modal
3. Close QR overlay
4. Close unsaved-changes modal
5. Navigate to People page (or dashboard if profile mode)

### Prefill from URL
- `?prefill_email=user@example.com` — adds email to emails multi-value
- `?prefill_name=John Doe` — splits into given name + surname

### Default Vault Setting
For new contacts: checks user setting `default_share_contacts`; if `'1'`, auto-sets vault toggle to "Vault"

---

## Contact Trash Page

**URL:** `/frontend/html/contact-trash.html`

### Layout
- Toolbar: count of deleted contacts + bulk action buttons (shown when items selected)
- Table with columns: Checkbox, Name, Organization, Email, Phone, Deleted (timestamp), Actions

### Features
- **Select All** checkbox in header
- **Individual row checkboxes**
- **Bulk Restore** — restores all selected contacts
- **Bulk Delete** — permanently purges selected contacts (with confirmation)
- **Per-row actions**:
  - "Restore" button — `POST /api/trash/contacts/{id}/restore`
  - "Delete" button — `DELETE /api/trash/contacts/{id}/purge` (with confirmation)
- Vault badge (🏛️) shown next to name for vault contacts
- Empty state: "No deleted contacts."

### Data Display
- Name: `display_name` or "(Unnamed)"
- Organization: from field or "—"
- Email: first email value or "—"
- Phone: first phone value or "—"
- Deleted: formatted as "Mon-DD HH:MM"

---

## QR Code Sharing

### How It Works
1. Generates a vCard 3.0 string client-side (mirrors backend `vcard_print()`)
2. Checks byte length (UTF-8) — max 2953 bytes for QR at error correction level L
3. If too large: shows error message "Contact data too large for QR. Use Export instead."
4. If fits: displays QR code via shared `showQRModal()` function

### vCard Fields Included
- N (structured name), FN (display name)
- TEL (phones with TYPE), EMAIL (with TYPE), ADR (with TYPE), URL (with TYPE)
- X-SIGNAL, X-PGP-KEY, X-CALLSIGN, X-XHANDLE, X-FAVORITE
- ORG (organization), NICKNAME
- NOTE (social_context, signal_username, color — as escaped newline-separated)
- BDAY (from dates array, first "Birthday" entry)

### QR Modal
- Uses shared `showQRModal()` overlay (not a page-specific modal)
- Shows: title "Share: {name}", QR code image, info line "{name} — vCard ({bytes} bytes)"
- Dismissible via close button, backdrop click, or ESC

---

## Data Model

### Contact Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID) | auto | Unique identifier |
| given_name | string | **YES** | First name |
| surname | string | no | Last name |
| middle_names | string | no | Middle name(s) |
| prefix | string | no | Mr., Mrs., Dr., etc. or custom |
| suffix | string | no | Jr., Sr., Ph.D., etc. or custom |
| nickname | string | no | Alias/nickname |
| display_name | string | computed | Auto-computed from name parts |
| phones | array of {label, value} | no | Phone numbers |
| emails | array of {label, value} | no | Email addresses |
| addresses | array of {label, value} | no | Physical addresses |
| call_signs | array of {label, value} | no | Ham radio call signs |
| x_handles | array of {label, value} | no | X/Twitter handles |
| websites | array of {label, value} | no | Website URLs |
| dates | array of {label, value, show_on_calendar} | no | Important dates (birthday, anniversary, etc.) |
| has_signal | boolean | no | Whether contact uses Signal |
| signal_username | string | no | Signal username or phone number |
| pgp_key | string | no | PGP public key (armored) |
| favorite | boolean | no | Starred/favorited |
| color | string | no | Hex color code (e.g. "#E3B23C") |
| organization | string | no | Company/organization |
| social_context | string | no | How you know them |
| image_url | string | no | Path to profile image |
| notes | string | no | Markdown notes |
| tags | array of strings | no | Tags (typically "Contact/..." prefixed) |
| shared_to_vault | boolean | no | Whether shared to all users |
| created_datetime | string (ISO) | auto | Creation timestamp |
| modified_datetime | string (ISO) | auto | Last modification timestamp |
| owner_id | string (UUID) | auto | User who owns this contact |
| deleted | boolean | auto | Soft-delete flag |
| deleted_datetime | string (ISO) | auto | When soft-deleted |
| sync_version | integer | auto | For mobile sync tracking |

### MultiValueEntry
```json
{ "label": "Home", "value": "+1-555-0100" }
```
For dates, also includes:
```json
{ "label": "Birthday", "value": "1990-05-15", "show_on_calendar": true }
```

### Display Name Computation
Computed server-side by `compute_display_name()`:
- Joins non-empty parts: prefix, given_name, middle_names, surname, suffix
- Falls back to given_name alone if others are empty

---

## API Endpoints

### CRUD
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/contacts` | Create contact |
| GET | `/api/contacts?q=` | List contacts (owner's + vault; optional search) |
| GET | `/api/contacts/{id}` | Get single contact |
| PUT | `/api/contacts/{id}` | Update contact |
| DELETE | `/api/contacts/{id}` | Soft-delete contact |

### Image
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/contacts/{id}/image` | Upload profile image (multipart) |
| DELETE | `/api/contacts/{id}/image` | Remove profile image |

### Favorite
| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/api/contacts/{id}/favorite` | Toggle favorite flag |

### Import/Export
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/contacts/import` | Import .vcf or .csv file (multipart) |
| GET | `/api/contacts/export?format=vcf\|csv` | Export all contacts |
| GET | `/api/contacts/{id}/export?format=vcf` | Export single contact as .vcf |

### Trash
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trash/contacts` | List soft-deleted contacts |
| POST | `/api/trash/contacts/{id}/restore` | Restore a deleted contact |
| DELETE | `/api/trash/contacts/{id}/purge` | Permanently delete |

### Calendar Integration
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/contacts/birthdays` | Virtual calendar entries for contact dates |

### Sorting
- List endpoint sorts: favorites first (DESC), then display_name alphabetically (COLLATE NOCASE ASC)
- Search hits all text fields with LIKE pattern

---

## Import/Export

### vCard Import (.vcf)
- Splits file into individual vCard blocks (`BEGIN:VCARD...END:VCARD`)
- Parses each block: N, FN, TEL, EMAIL, ADR, URL, BDAY, X-SIGNAL, X-PGP-KEY, X-CALLSIGN, X-XHANDLE, X-FAVORITE
- Handles line unfolding (RFC 2425 §5.8.1)
- Skips entries without `given_name`
- Creates new contact for each valid entry

### vCard Export (.vcf)
- Generates vCard 3.0 for each contact
- Includes: N, FN, TEL (with TYPE), EMAIL (with TYPE), ADR (with TYPE), URL (with TYPE), X-SIGNAL, X-PGP-KEY, X-CALLSIGN, X-XHANDLE, X-FAVORITE, BDAY
- All contacts concatenated with `\r\n` separator

### CSV Import (.csv)
- Header row defines columns
- Multi-value fields flattened to numbered columns: `phone_1_label`, `phone_1_value`, ..., `phone_5_label`, `phone_5_value` (up to 5 each)
- Scalar fields: given_name, surname, middle_names, prefix, suffix, has_signal, pgp_key, favorite
- Skips rows without `given_name`

### CSV Export (.csv)
- Same column structure as import
- Multi-value fields: phones, emails, addresses, call_signs, x_handles, websites (up to 5 each)

---

## Vault System

- Any contact can be toggled between "Private" (only owner sees it) and "Vault" (all users see it)
- Vault contacts from other users appear in a separate "🏛️ Contact Vault" section
- Vault contacts are fully editable by any user with access
- Default vault setting: configurable in user settings (`default_share_contacts`)
- Vault badge (🏛️) shown in list rows and trash table

---

## Birthday Calendar Integration

`GET /api/contacts/birthdays` returns virtual calendar entries:
- For each contact date with `show_on_calendar` not explicitly false
- Generates entries for previous year, current year, and next year
- Each entry is an all-day event with:
  - Title: "{emoji} {display_name} — {label} ({age} yrs)" (emoji: 🎂 for birthday, 💍 for anniversary)
  - Color: contact's color or default `#f5e6d3`
  - Metadata: `_is_birthday`, `_contact_id`, `_contact_image_url`, `_date_label`
- Handles Feb 29 in non-leap years (falls back to Feb 28)

---

## Profile Mode (Dual-Purpose Editor)

The contact editor page doubles as a user profile editor when accessed with `?mode=profile`:
- Shows Account zone (username read-only, display name, email)
- Shows Password zone (current + new + confirm password fields)
- Hides: favorite button, delete button, QR button, audit button, tags zone, vault toggle
- Type badge changes to "👤 User"
- Can view other users' profiles read-only (`?mode=profile&user_id={id}`)
- Read-only mode: all inputs disabled, add/remove buttons hidden, banner shown

---

## Visual Design Notes

- Parchment theme: `#fffaf0` backgrounds, `#8b5a2b` borders, Lora serif font
- Contact rows: 10px 12px padding, 1px bottom border `#d4c5a9`, hover background `rgba(212, 196, 160, 0.2)`
- Section dividers: uppercase, letter-spacing 1px, `#e0d4b5` background, `#8b5a2b` text
- Buttons: gradient brown (`#d4a373` → `#c8965a`), 1px solid `#8b5a2b` border
- Danger buttons: red background (`#b22222`)
- Search input: `#f5e6cc` background, teal focus ring
- Modals: `#fff8e1` background, 2px solid `#8b5a2b` border, 10px border-radius
- Zone headers: clickable to collapse/expand, toggle icon (🔼/🔽)
- Multi-value rows: flex layout with 6px gap, label input 80px wide, value input flex:1
