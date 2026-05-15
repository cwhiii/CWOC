# Gmail Hotkeys vs CWOC Hotkeys — Gap Analysis

## Gmail Shortcuts (Desktop, categorized)

Sources: [Google Support](https://support.google.com/mail/answer/6594), [Kinsta](https://kinsta.com/blog/gmail-keyboard-shortcuts/)

---

## Comparison Table

| Gmail Function | Gmail Key | CWOC Equivalent | CWOC Key | Gap? |
|---|---|---|---|---|
| **COMPOSE & REPLY** | | | | |
| Compose new | `C` | Create Chit | `K` | ✅ Have (different key) |
| Reply | `R` | — | — | ❌ **Missing** (no hotkey for reply in email view) |
| Reply All | `A` | — | — | ❌ **Missing** (no hotkey for reply-all) |
| Forward | `F` | Filter submenu | `F` (conflicts) | ❌ **Missing** (no hotkey for forward) |
| Send | `Ctrl+Enter` | — | — | ❌ **Missing** (no send hotkey in compose) |
| Save draft | `Ctrl+S` | — | — | ❌ **Missing** (editor auto-saves, but no explicit save hotkey in compose) |
| **ACTIONS** | | | | |
| Archive | `E` | Archive (via editor) | — | ❌ **Missing** (no single-key archive from list) |
| Delete / Trash | `#` | Delete (via editor) | — | ❌ **Missing** (no single-key delete from list) |
| Undo last action | `Z` | — | — | ❌ **Missing** (no global undo hotkey) |
| Mark as read | `Shift+I` | — | — | ❌ **Missing** (could apply to email chits) |
| Mark as unread | `Shift+U` | — | — | ❌ **Missing** (could apply to email chits) |
| Star / unstar | `S` | Sort submenu | `S` (conflicts) | ❌ **Missing** (pin/star from list) |
| Mark important | `+` or `=` | — | — | ❌ **Missing** (no priority hotkey from list) |
| Mark unimportant | `-` | — | — | ❌ **Missing** |
| Mute conversation | `M` | — | `M` = Map | ❌ **Missing** (N/A) |
| Report spam | `!` | Quick Alert | `!` (conflicts) | ✅ Key used for different purpose |
| **NAVIGATION** | | | | |
| Go to Inbox | `G then I` | Dashboard | `V then 1` | ✅ Have (different pattern) |
| Go to Starred | `G then S` | — | — | ❌ **Missing** (no "pinned only" hotkey) |
| Go to Sent | `G then T` | — | — | ❌ **Missing** (could filter Email tab to sent) |
| Go to Drafts | `G then D` | — | — | ❌ **Missing** (could filter Email tab to drafts) |
| Go to All Mail | `G then A` | Omni View | `O` | ✅ Have |
| Go to Contacts | `G then C` | Navigate > Contacts | `V then 3` | ✅ Have |
| Go to Tasks | `G then K` | Tasks tab | `T` | ✅ Have (simpler) |
| Search | `/` | Global Search tab | `G` | ✅ Have (different key) |
| Open help | `?` | Help page | `Shift+R` | ✅ Have (different key) |
| Show shortcuts | `Shift+?` | Reference overlay | `R` | ✅ Have |
| Newer conversation | `K` | — | — | ❌ **Missing** (no prev/next item nav) |
| Older conversation | `J` | — | — | ❌ **Missing** (no prev/next item nav) |
| Open conversation | `O` or `Enter` | Double-click / click | mouse | ✅ Have (mouse-based) |
| Back to list | `U` | ESC / browser back | `ESC` | ✅ Have |
| Next page | `N` | — | — | ❌ **Missing** (no pagination) |
| Previous page | `P` | — | — | ❌ **Missing** (no pagination) |
| **SELECTION** | | | | |
| Select all | `*+A` | — | — | ❌ **Missing** (no multi-select from list) |
| Deselect all | `*+N` | — | — | ❌ **Missing** |
| Select read | `*+R` | — | — | ❌ **Missing** (N/A) |
| Select unread | `*+U` | — | — | ❌ **Missing** (N/A) |
| Select starred | `*+S` | — | — | ❌ **Missing** |
| Select unstarred | `*+T` | — | — | ❌ **Missing** |
| **TEXT FORMATTING** (compose) | | | | |
| Bold | `Ctrl+B` | — | — | ❌ **Missing** (N/A — notes use markdown) |
| Italic | `Ctrl+I` | — | — | ❌ **Missing** (N/A — markdown) |
| Underline | `Ctrl+U` | — | — | ❌ **Missing** (N/A — markdown) |
| Strikethrough | `Alt+Shift+5` | — | — | ❌ **Missing** (N/A — markdown) |
| Numbered list | `Ctrl+Shift+7` | — | — | ❌ **Missing** (N/A — markdown) |
| Bulleted list | `Ctrl+Shift+8` | — | — | ❌ **Missing** (N/A — markdown) |
| Insert link | `Ctrl+K` | — | — | ❌ **Missing** (N/A — markdown) |
| Remove formatting | `Ctrl+\` | — | — | ❌ **Missing** (N/A) |
| **THREAD VIEW** | | | | |
| Expand all | `;` | — | — | ❌ **Missing** (N/A — no thread concept) |
| Collapse all | `:` | — | — | ❌ **Missing** (N/A) |
| Add to Tasks | `Shift+T` | — | — | ❌ **Missing** (interesting idea) |

---

## Summary of Relevant Gaps (excluding N/A items)

These are Gmail functionalities that **could meaningfully apply** to CWOC but are currently missing:

### High Value — List-Level Quick Actions
| # | Gmail Concept | Proposed CWOC Equivalent | Notes |
|---|---|---|---|
| 1 | **J/K — Navigate items** | Move selection up/down in card list | Gmail's most-used nav keys. Would let users browse chits without mouse. |
| 2 | **O/Enter — Open selected** | Open highlighted chit in editor | Pairs with J/K for full keyboard-only workflow. |
| 3 | **E — Archive** | Quick-archive selected chit | Single-key archive from the list view (currently requires opening editor). |
| 4 | **# — Delete/Trash** | Quick-trash selected chit | Single-key soft-delete from list view. |
| 5 | **Z — Undo** | Global undo last action | Undo the last archive/delete/move without needing the toast. |
| 6 | **X — Select/deselect** | Toggle selection on focused chit | Enable multi-select for bulk actions. |
| 7 | **Star/Unstar (S in Gmail)** | Quick-pin/unpin from list | Currently `S` is Sort; could use another key. |
| 8 | **/ — Focus search** | Focus the search input | Gmail uses `/`; CWOC uses `G` for Search tab but no "focus search box" key. |
| 9 | **? — Show shortcuts** | Already have (`R`) | ✅ Covered |

### Medium Value — Workflow Enhancements
| # | Gmail Concept | Proposed CWOC Equivalent | Notes |
|---|---|---|---|
| 10 | **Reply (R in Gmail)** | Reply to email chit from list | In Email tab, reply to focused email without opening editor first. |
| 11 | **Forward (F in Gmail)** | Forward email chit from list | Conflicts with Filter key — would need modifier or Email-tab-only binding. |
| 12 | **Ctrl+Enter — Send** | Send email from compose | Hotkey to send when in email compose mode. |
| 13 | **Shift+I / Shift+U — Read/Unread** | Mark email chit read/unread from list | Quick toggle without opening. |
| 14 | **Shift+T — Add to Tasks** | Convert note/email to task | Quick status change from list view. |
| 15 | **+ / = — Mark important** | Quick-set priority from list | Bump priority without opening editor. |
| 16 | **- — Mark unimportant** | Quick-clear priority from list | Lower priority without opening editor. |
| 17 | **U — Back to list** | Return to dashboard from editor | ESC already does this, but `U` is a nice single-key alternative. |
| 18 | **G+T / G+D — Go to Sent/Drafts** | Filter Email tab to sent/drafts | Quick folder-like navigation within Email view. |

### Low Value / Not Applicable
- Text formatting shortcuts — CWOC uses markdown, not WYSIWYG
- Thread expand/collapse — no thread concept
- Spam reporting — no concept in CWOC
- Mute — could map to "snooze" but already handled differently

---

## CWOC Hotkeys That Gmail Doesn't Have (CWOC advantages)

| CWOC Feature | Key | Notes |
|---|---|---|
| Tab switching (C/H/A/P/T/N/E/I/G/O) | Single letter | Gmail has no equivalent — you navigate folders with G+key |
| Calendar period switching | `.` then letter | No Gmail equivalent |
| Mode switching per tab | `Shift+M` | No Gmail equivalent |
| Filter submenu | `F` then letter | Gmail has no keyboard filter system |
| Sort submenu | `S` then letter | Gmail has no keyboard sort |
| Weather modal | `Shift+W` | Unique to CWOC |
| Clock modal | `L` | Unique to CWOC |
| Calculator | `F4` | Unique to CWOC |
| Quick Alert | `!` | Unique to CWOC |
| Toggle sidebar/topbar | `` ` `` / `~` | Unique to CWOC |
| Map page | `M` | Unique to CWOC |

---

## Recommendation

The biggest gap is **list-level item navigation and quick actions** (J/K/O/E/#/X/Z). Gmail's power comes from being able to select items, act on them, and move to the next — all without touching the mouse. CWOC currently requires clicking to select and opening the editor for most actions. Adding a "focused item" concept with J/K navigation and single-key actions would be the highest-impact improvement.

The second gap is **email-specific hotkeys** — since CWOC has full email, adding Reply/Forward/Send shortcuts (especially in the Email tab) would bring parity with Gmail's core email workflow.
