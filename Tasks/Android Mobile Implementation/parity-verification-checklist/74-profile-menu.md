# Profile Menu (Avatar, Switch User, Logout)

**Category:** Cross-Cutting Behaviors
**Item #:** 74
**Code Verified:** ⬜
**User Verified:** ⬜

## Source Files
- `src/frontend/js/pages/shared-page.js` (Profile Menu IIFE section)
- `src/frontend/css/shared/shared-page.css` (Profile Menu CSS section)

## Functions, Buttons, Controls & Inputs

### Profile Button (Header Element)

- [ ] Profile menu wrapper (`.cwoc-profile-menu`, `#cwoc-profile-menu`) — Positioned rightmost in header nav; `margin-left: auto`
- [ ] Profile button (`.cwoc-profile-btn`, `#cwoc-profile-btn`) — Circular button with border; click toggles dropdown; title shows username
- [ ] Profile image (`.cwoc-profile-img`) — 32×32px circular avatar; defaults to `/static/default-avatar.svg`; loads user's `profile_image_url` when auth resolves
- [ ] Profile notification badge (`#cwoc-profile-notif-badge`) — Red circle badge showing pending notification count; hidden when 0

### Profile Dropdown Menu

- [ ] `_toggleProfileMenu()` / `window._cwocToggleProfileMenu` — Toggles dropdown open/closed; removes existing dropdown if open
- [ ] Dropdown container (`.cwoc-profile-dropdown`, `#cwoc-profile-dropdown`) — Absolute positioned below profile button; min-width 180px; parchment styled
- [ ] Dropdown header (`.cwoc-profile-dropdown-header`) — Shows current user's display name (bold) and @username
- [ ] "🔄 Switch User" menu item (`.cwoc-profile-dropdown-item`) — Opens switch user modal
- [ ] "👤 View Profile" menu item (`.cwoc-profile-dropdown-item`) — Navigates to `/profile`
- [ ] "🚪 Logout" menu item (`.cwoc-profile-dropdown-item`) — Calls `_logout()`
- [ ] "🔔 Notifications" menu item (`.cwoc-profile-dropdown-item`) — Shows count; click navigates to Alarms tab in notifications mode
- [ ] Notification section (`#cwoc-profile-notif-section`) — Inline notification list in dropdown (max-height 200px, scrollable)
- [ ] Click-outside-to-close handler — Document click listener removes dropdown when clicking outside

### Switch User Modal

- [ ] `_showSwitchUserModal()` — Creates and shows the switch user modal overlay
- [ ] Modal overlay (`#cwoc-switch-modal`, `.modal`) — Full-screen overlay with centered modal content
- [ ] Modal title — "🔄 Switch User"
- [ ] User list container (`.cwoc-switch-user-list`, `#cwoc-switch-user-list`) — Max-height 300px, scrollable
- [ ] Loading state — "Loading users…" text while fetching
- [ ] Empty state — "No other users available" when no switchable users
- [ ] Error state — "Unable to load users" on fetch failure
- [ ] User item (`.cwoc-switch-user-item`) — Flex row with avatar, display name, username; click → password prompt
- [ ] User avatar (`.cwoc-switch-user-avatar`) — 28×28px circular image; fallback to `/static/default-avatar.svg`
- [ ] User display name (`.cwoc-switch-user-name`) — Bold text
- [ ] User username (`.cwoc-switch-user-username`) — Parenthesized, smaller, muted
- [ ] "Cancel" button (`#cwoc-switch-modal-cancel`) — Closes modal
- [ ] ESC key handler — Closes modal (capture phase, stopImmediatePropagation)
- [ ] API call: `GET /api/auth/switchable-users` — Fetches list of all active users

### Password Prompt (within Switch Modal)

- [ ] `_showPasswordPromptInModal(overlay, content, targetUser)` — Replaces modal content with password form
- [ ] Title — "🔐 Switch to {display_name}"
- [ ] Instruction text — "Enter the password for **{username}**:"
- [ ] Password input (`.cwoc-switch-password-input`, `#cwoc-switch-password`) — type="password", autocomplete="off"
- [ ] Error display (`#cwoc-switch-error`, `.cwoc-switch-error`) — Shows validation/auth errors
- [ ] "← Back" button (`#cwoc-switch-back`) — Returns to user list
- [ ] "Switch" button (`#cwoc-switch-confirm`) — Submits password; disabled during request; text changes to "Switching…"
- [ ] Enter key handler on password input — Triggers switch
- [ ] API call: `POST /api/auth/switch` — Body: `{ username, password }`; on success: `window.location.reload()`
- [ ] Rate limiting error (HTTP 429) — Shows "Too many attempts. Please wait."
- [ ] Auth error — Shows "Invalid password." or server detail message
- [ ] Network error — Shows "Network error. Please try again."

### Logout

- [ ] `_logout()` / `window._cwocLogout` — POST `/api/auth/logout`, then redirect to `/login`
- [ ] API call: `POST /api/auth/logout` — Clears session; always redirects to `/login` even on error

### Profile Notification Badge System

- [ ] `_updateProfileNotifBadge()` — Creates/updates/hides the red badge on profile button
- [ ] `_fetchProfileNotifications()` — Fetches pending notifications for badge count
- [ ] `_renderProfileNotifSection(container)` — Renders inline notification cards in dropdown
- [ ] Notification card — Shows chit title (linked), owner info, Accept/Decline buttons
- [ ] Reminder notification card — Shows reminder title, Snooze/Dismiss buttons
- [ ] Periodic refresh — Notifications re-fetched on interval and on visibility change

### Profile Image Loading

- [ ] Auth-aware image loading — If `getCurrentUser()` returns user with `profile_image_url`, sets it on the profile img
- [ ] `waitForAuth()` fallback — If auth not ready at injection time, waits for auth promise then updates image
- [ ] Image error handler — Falls back to `/static/default-avatar.svg` on load error

### CSS Classes & Styling

- [ ] `.cwoc-profile-menu` — Relative positioned wrapper, inline-flex
- [ ] `.cwoc-profile-btn` — Transparent background, circular border, hover glow
- [ ] `.cwoc-profile-img` — 32×32px, border-radius 50%, object-fit cover
- [ ] `.cwoc-profile-dropdown` — Absolute top-right, min-width 180px, parchment background, z-index 2000
- [ ] `.cwoc-profile-dropdown-header` — Padded, bold, border-bottom, subtle background
- [ ] `.cwoc-profile-dropdown-item` — Padded, hover highlight, cursor pointer
- [ ] `.cwoc-switch-user-list` — Max-height 300px, overflow-y auto
- [ ] `.cwoc-switch-user-item` — Flex row, hover highlight, rounded
- [ ] `.cwoc-switch-user-avatar` — 28×28px circular with border
- [ ] `.cwoc-switch-user-name` — Bold, dark color
- [ ] `.cwoc-switch-user-username` — Small, muted
- [ ] `.cwoc-switch-password-input` — Full-width, parchment background, focus glow
- [ ] `.cwoc-switch-error` — Error message styling (red text)
- [ ] `.cwoc-user-dropdown-loading` / `.cwoc-user-dropdown-empty` — Centered italic text
