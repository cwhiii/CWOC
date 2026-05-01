# CWOC Sharing System — Current State Analysis

## Overview

The sharing system connects chits between users through three independent paths: **chit-level sharing**, **tag-level sharing**, and **assignment**. Contacts (from the Rolodex) and system users are handled differently — contacts are informational only, users get functional sharing.

---

## The Five Concepts (Your List) vs. Reality

| Your Concept | Status | Notes |
|---|---|---|
| **Adding someone to a chit** (contacts, informational) | ✅ EXISTS | The `people` field on a chit. Contacts appear as chips. No permissions, no visibility to others. Purely informational. |
| **Sharing a chit with a person** (inviting) | ✅ EXISTS | The `shares` field on a chit. Adds user with viewer/manager role + RSVP status. Shows up in sharee's views. |
| **Inviting someone to a chit** | ⚠️ MERGED WITH SHARING | There is no separate "invite" action. Sharing IS inviting. When you add a user to shares, they get `rsvp_status: "invited"` automatically. |
| **Assigning a person to a chit** | ✅ EXISTS | The `assigned_to` field. Single user. Grants minimum viewer access. Does NOT auto-set to manager. |
| **Connecting chit with user via tag** | ✅ EXISTS | Tag-level sharing in Settings. Owner configures tags → users + roles. All chits with that tag are shared. Auto-accepted (no RSVP). |

---

## Concept 1: Adding a Contact to a Chit (People Field)

Informational association only. No permissions, no cross-user visibility.

```
┌─────────────────────────────────────────────────────┐
│                  ADDING A CONTACT                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Owner opens People zone in editor                   │
│       │                                              │
│       ▼                                              │
│  Contacts appear in alphabetical tree (left column)  │
│       │                                              │
│       ▼                                              │
│  Owner clicks contact chip                           │
│       │                                              │
│       ▼                                              │
│  Contact added to _peopleChipData array              │
│  Chip appears in right column                        │
│       │                                              │
│       ▼                                              │
│  On save: stored in chit.people as JSON string array │
│  e.g. ["Alice Smith", "Bob Jones"]                   │
│       │                                              │
│       ▼                                              │
│  EFFECT: None. Purely informational.                 │
│  - No notification to the contact                    │
│  - No cross-user visibility                          │
│  - Filterable in views by people field               │
│  - Contact chip shows color/image from Rolodex       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Data model**: `chit.people` — JSON array of display name strings.

---

## Concept 2: Sharing a Chit with a User (Chit-Level Sharing)

This is the primary sharing mechanism. "Sharing" and "inviting" are the same action.

```
┌──────────────────────────────────────────────────────────────────┐
│                    CHIT-LEVEL SHARING FLOW                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Owner opens People zone in editor                                │
│       │                                                           │
│       ▼                                                           │
│  System users appear in alphabetical tree (left column)           │
│  (Current user and chit owner are excluded from list)             │
│       │                                                           │
│       ▼                                                           │
│  Owner clicks a user chip                                         │
│       │                                                           │
│       ▼                                                           │
│  _addShare(userId, 'viewer', displayName) called                  │
│  User added to _currentShares with:                               │
│    { user_id, role: 'viewer', rsvp_status: 'invited' }           │
│       │                                                           │
│       ▼                                                           │
│  User moves from left column → right column                       │
│  Right column shows:                                              │
│    [chip] [RSVP badge ⏳/✓/✗] [Viewer|Manager pill toggle]       │
│       │                                                           │
│       ▼                                                           │
│  Owner can toggle role via pill: Viewer ↔ Manager                 │
│  Owner can remove user via ✕ button                               │
│       │                                                           │
│       ▼                                                           │
│  On save: stored in chit.shares as JSON array                     │
│  e.g. [{"user_id":"uuid","role":"viewer","rsvp_status":"invited"}]│
│       │                                                           │
│       ▼                                                           │
│  EFFECTS:                                                         │
│  - Chit appears in sharee's dashboard (via GET /api/shared-chits) │
│  - Chit marked with _shared flag and effective_role               │
│  - Sharee sees owner attribution on cards/calendar                │
│  - Viewer: read-only (no inline edits, no drag, no quick-edit)    │
│  - Manager: full edit (same as owner except can't manage sharing) │
│                                                                   │
│  ⚠️ NO NOTIFICATION SYSTEM EXISTS                                 │
│  - No inbox/sidebar notification when shared                      │
│  - Sharee discovers shared chits by seeing them in their views    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### RSVP Sub-Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         RSVP FLOW                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Sharee sees shared chit in their views                           │
│       │                                                           │
│       ▼                                                           │
│  Sharee opens chit in editor                                      │
│       │                                                           │
│       ▼                                                           │
│  People zone shows RSVP controls (Accept ✓ / Decline ✗)          │
│  Only visible to the current user for their own share entry       │
│       │                                                           │
│       ├──── Accept ────▶ PATCH /api/chits/{id}/rsvp               │
│       │                  { "rsvp_status": "accepted" }            │
│       │                  Chit displays normally in all views       │
│       │                                                           │
│       └──── Decline ───▶ PATCH /api/chits/{id}/rsvp               │
│                          { "rsvp_status": "declined" }            │
│                          Chit gets declined-chit CSS class:       │
│                            opacity: 0.35 (ghost mode)             │
│                          OR hidden entirely if hide_declined = "1"│
│                                                                   │
│  RSVP also available in quick-edit modal on dashboard             │
│                                                                   │
│  Owner sees RSVP status badges on each shared user:               │
│    ⏳ invited  |  ✓ accepted  |  ✗ declined                       │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Data model**: `chit.shares` — JSON array of `{user_id, role, rsvp_status}`.

**Permissions**:
- `viewer`: Read-only. Cannot edit, drag, quick-edit, or manage sharing.
- `manager`: Full edit. Can modify all chit fields. Cannot change shares, stealth, or assigned_to (those are owner-only via `can_manage_sharing`).

---

## Concept 3: Assigning a User to a Chit

Single-user assignment. Currently grants minimum viewer access only.

```
┌──────────────────────────────────────────────────────────────────┐
│                      ASSIGNMENT FLOW                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Owner/Manager opens People zone in editor                        │
│       │                                                           │
│       ▼                                                           │
│  "Assigned To" dropdown appears below shared users                │
│  Populated with: [None] + [Owner] + [All shared users]            │
│       │                                                           │
│       ▼                                                           │
│  Owner selects a user from dropdown                               │
│       │                                                           │
│       ▼                                                           │
│  On save: stored in chit.assigned_to as UUID string               │
│       │                                                           │
│       ▼                                                           │
│  EFFECTS:                                                         │
│  - If assignee is NOT already in shares, they get minimum         │
│    "viewer" access via resolve_effective_role()                    │
│  - Assignment does NOT auto-add to shares list                    │
│  - Assignment does NOT auto-set role to manager                   │
│  - Assignment does NOT auto-set rsvp_status                       │
│  - No notification sent                                           │
│                                                                   │
│  ⚠️ DIFFERS FROM YOUR CONCEPT:                                    │
│  You want: assign = share + manager + assignee flag, all in 1     │
│  Current: assign = just set assigned_to field, viewer access only │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Data model**: `chit.assigned_to` — single UUID string (or null).

**Role resolution**: In `resolve_effective_role()`, assignment grants `viewer` as a floor. If the user also has a chit-level or tag-level share with `manager`, the higher role wins.

---

## Concept 4: Tag-Level Sharing

Bulk sharing via tag configuration. Configured in Settings, not per-chit.

```
┌──────────────────────────────────────────────────────────────────┐
│                    TAG-LEVEL SHARING FLOW                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Owner opens Settings → Tags section                              │
│       │                                                           │
│       ▼                                                           │
│  Opens a tag's edit modal                                         │
│       │                                                           │
│       ▼                                                           │
│  Tag Sharing section at bottom of modal:                          │
│    User picker dropdown + Role selector (Viewer/Manager)          │
│    [Add Share] button                                             │
│       │                                                           │
│       ▼                                                           │
│  Shares saved to owner's settings.shared_tags:                    │
│  [{"tag":"Work","shares":[{"user_id":"uuid","role":"manager"}]}]  │
│       │                                                           │
│       ▼                                                           │
│  PUT /api/settings/shared-tags saves config                       │
│       │                                                           │
│       ▼                                                           │
│  EFFECTS:                                                         │
│  - ALL chits with that tag are shared with configured users       │
│  - Current AND future chits with the tag are included             │
│  - Removing the tag from a chit removes that sharing path         │
│  - Removing the tag sharing config removes access for all chits   │
│  - Tag tree shows 🔗 icon for tags with active sharing            │
│  - NO RSVP — tag-shared chits are auto-accepted                  │
│  - Role is per-user per-tag (viewer or manager)                   │
│  - If tag renamed, sharing config updates automatically           │
│  - If tag deleted, sharing config is removed                      │
│                                                                   │
│  RESOLUTION:                                                      │
│  get_shared_chits_for_user() checks owner's settings.shared_tags  │
│  for each owner who has shared_tags mentioning the requesting     │
│  user, then matches chit tags against those shared tags.          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Data model**: `settings.shared_tags` — JSON array of `{tag, shares: [{user_id, role}]}`. Stored on the OWNER's settings row.

---

## Concept 5: Stealth Mode

Hides a chit from ALL non-owner users, overriding all sharing paths.

```
┌──────────────────────────────────────────────────────────────────┐
│                       STEALTH MODE                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Owner/Manager toggles 🥷 Stealth checkbox in People zone         │
│       │                                                           │
│       ▼                                                           │
│  On save: chit.stealth = 1                                        │
│       │                                                           │
│       ▼                                                           │
│  resolve_effective_role() returns None for all non-owners          │
│  get_shared_chits_for_user() excludes stealth chits from results  │
│       │                                                           │
│       ▼                                                           │
│  EFFECT: Chit is invisible to everyone except the owner.          │
│  Overrides chit-level shares, tag-level shares, and assignment.   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Role Resolution (All Paths Combined)

```
┌──────────────────────────────────────────────────────────────────┐
│              resolve_effective_role(chit, user_id)                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Is user the owner?                                            │
│     YES → return "owner"                                          │
│                                                                   │
│  2. Is chit in stealth mode?                                      │
│     YES → return None (no access)                                 │
│                                                                   │
│  3. Check chit-level shares:                                      │
│     If user_id in chit.shares → collect role (viewer/manager)     │
│                                                                   │
│  4. Check tag-level shares:                                       │
│     If owner's shared_tags has a tag matching chit's tags,        │
│     and that tag's shares include user_id → collect role           │
│                                                                   │
│  5. Check assignment:                                             │
│     If chit.assigned_to == user_id → collect "viewer" as floor    │
│                                                                   │
│  6. Return highest role found:                                    │
│     manager > viewer > None                                       │
│                                                                   │
│  NOTE: "manager" from ANY path wins over "viewer" from any path.  │
│  A user can have access via multiple paths simultaneously         │
│  (share_source = "multiple").                                     │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Permission Matrix

| Action | Owner | Manager | Viewer | Assigned-only |
|---|---|---|---|---|
| View chit | ✅ | ✅ | ✅ | ✅ |
| Edit chit fields | ✅ | ✅ | ❌ | ❌ |
| Manage shares (add/remove users) | ✅ | ✅* | ❌ | ❌ |
| Toggle stealth | ✅ | ✅* | ❌ | ❌ |
| Change assigned_to | ✅ | ✅* | ❌ | ❌ |
| Delete chit | ✅ | ❌ | ❌ | ❌ |
| RSVP (accept/decline) | ❌ | ✅ | ✅ | N/A |
| Drag on calendar | ✅ | ✅ | ❌ | ❌ |
| Quick-edit modal | ✅ | ✅ | ❌ | ❌ |

*`can_manage_sharing` returns true for managers, BUT `update_chit` silently preserves existing shares/stealth/assigned_to for non-owner managers. So managers can see the controls in the UI but the backend blocks their changes to sharing fields. **This is a UI/backend inconsistency.**

---

## Dashboard Integration

```
┌──────────────────────────────────────────────────────────────────┐
│                  DASHBOARD SHARED CHIT LOADING                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  main-init.js fires two parallel fetches:                         │
│    GET /api/chits          → owned chits                          │
│    GET /api/shared-chits   → chits shared with current user       │
│       │                                                           │
│       ▼                                                           │
│  Shared chits get _shared = true flag                             │
│  Merged into single chits[] array (deduped by ID)                 │
│       │                                                           │
│       ▼                                                           │
│  Each shared chit carries:                                        │
│    effective_role: "viewer" | "manager"                            │
│    share_source: "chit-level" | "tag-level" | "assignment" |      │
│                  "multiple"                                        │
│    owner_display_name: string                                     │
│       │                                                           │
│       ▼                                                           │
│  Rendering checks:                                                │
│    _isViewerRole(chit) → disable drag, quick-edit, inline edits   │
│    _isDeclinedByCurrentUser(chit) → apply declined-chit CSS       │
│    hide_declined setting → filter out declined chits entirely     │
│                                                                   │
│  Calendar events show owner badge for shared chits                │
│  Chit cards show owner attribution                                │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints Summary

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/chits/{id}/shares` | List shares for a chit | Owner/Manager |
| PUT | `/api/chits/{id}/shares` | Set entire shares list | Owner/Manager |
| DELETE | `/api/chits/{id}/shares/{user_id}` | Remove a user from shares | Owner/Manager |
| PATCH | `/api/chits/{id}/rsvp` | Update own RSVP status | Shared user |
| GET | `/api/shared-chits` | All chits shared with current user | Authenticated |
| GET | `/api/settings/shared-tags` | Get tag sharing config | Authenticated |
| PUT | `/api/settings/shared-tags` | Set tag sharing config | Authenticated |

---

## Gaps: What Your Concept Describes vs. What Exists

### ❌ NOT BUILT: Notification System
Your concept: "Notifies invitee. A message in new box in the sidebar just above settings."
Reality: No notification/inbox system exists. Sharees discover shared chits by seeing them appear in their views. No alert, no sidebar box, no message.

### ❌ NOT BUILT: Separate "Invite" vs "Share" Actions
Your concept: Inviting and sharing are distinct.
Reality: They are the same action. Adding a user to shares IS the invitation. The `rsvp_status: "invited"` is set automatically.

### ⚠️ PARTIAL: Assignment Auto-Escalation
Your concept: "Assigned = shared + manager + assignee flag, all in 1 action."
Reality: Assignment only sets `assigned_to` field. Grants minimum viewer access. Does NOT auto-add to shares, does NOT auto-set manager role. The assignee dropdown only shows users already in shares (plus the owner).

### ❌ NOT BUILT: Rejected Chits Tool
Your concept: "A similar tool like deleted page, for rejected chits, filtered to each user."
Reality: Declined chits are shown faded (opacity 0.35) or hidden via `hide_declined` setting. No dedicated rejected-chits page exists.

### ❌ NOT BUILT: Sharing Filters in Sidebar
Your concept: "2 new filters for 'Chits shared with me' and 'Chits I shared with others'."
Reality: No sharing-specific filters exist in the sidebar. Shared chits are mixed into all views with no way to filter by sharing status.

### ❌ NOT BUILT: People Zone Expand Modal
Your concept: "Expand button on People zone → opens nearly full-screen people modal with alphabetical list."
Reality: People zone is inline only. No expand/modal view. No shrink button pattern like the notes zone.

### ⚠️ INCONSISTENCY: Manager Sharing Permissions
`can_manage_sharing()` returns true for managers, and the UI shows sharing controls to managers. But `update_chit()` silently preserves existing shares/stealth/assigned_to for non-owners. The UI suggests managers can change sharing; the backend prevents it.

### ✅ WORKING: Tag Sharing Visibility
Your concept: "See which tags you've shared with which users, and with which permissions."
Reality: Settings tag modal shows sharing config per tag. Tag tree shows 🔗 icon for shared tags. Can add/remove/edit shares per tag.

### ✅ WORKING: Tag Sharing Auto-Accept
Your concept: "Be auto-accepted by the sharee."
Reality: Tag-shared chits have no RSVP flow. They appear directly in the sharee's views.

### ✅ WORKING: Acceptance/Rejection Visual Treatment
Your concept: "If rejected it either stays in ghost mode, or is entirely hidden."
Reality: Declined chits get `opacity: 0.35` (ghost mode) or are hidden entirely based on `hide_declined` user setting.

### ✅ WORKING: Owner Sees RSVP Status
Your concept: "A sharer should be able to see acceptance/rejection status on the chit."
Reality: Owner sees ⏳/✓/✗ badges next to each shared user in the People zone.

### ⚠️ PARTIAL: Contact vs User Distinction in People Zone
Your concept: "Clearly indicates which are contacts and which are users."
Reality: Contacts and users are in the same alphabetical tree but have different chip styles (`people-chip` vs `people-chip-user`). The visual distinction exists but is subtle. No explicit label saying "Contact" or "User".
