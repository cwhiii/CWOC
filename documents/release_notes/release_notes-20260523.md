## cwoc_server-20260523_1539

Cross-tab alarm coordination: only one browser tab rings when an alarm fires (leader tab plays sound, others show modal silently). Dismissing or snoozing an alert in any tab instantly propagates to all other open tabs via BroadcastChannel — no more multiple tabs ringing simultaneously or requiring individual dismissal.

## cwoc_app-20260523_1257

Fixed build error: replaced `this@MainActivity` with `context` (from `LocalContext.current`) in `CwocApp` composable's ProfileMenu logout/switch-user callbacks, since `CwocApp` is a top-level function outside the `MainActivity` class scope.

## cwoc_server-20260523_1309

Complete refactor: bundle tags now use IDs instead of names (`CWOC_System/BundleID/{id}` replaces `CWOC_System/Bundle/{name}`). Bundle names are now purely cosmetic — rename freely without breaking anything. Migration converts all existing name-based tags to ID-based. Frontend filtering updated to match by bundle ID. Dedup + emoji reset included.

## cwoc_server-20260523_1257

Fixed bundle migration losing emails. The tag rename was only matching the current name, missing historical variants. Now sweeps ALL known historical names (Junk, Newsletters, Clutter, and their emoji variants) and normalizes them to the canonical tag. Also fixed the constant back to "🗑️ Junk" (was incorrectly set to "Clutter").

## cwoc_server-20260523_0940

Dedup migration now does a full reset of all predefined bundles: removes duplicates, renames survivors to canonical emoji names, sets colors, and updates all chit tags to match. Colors: Junk=#8b4513, Receipts=#6b8e23, Finance=#2e5090, Calendar=#8b008b, From Contacts=#4a7c59.

## cwoc_server-20260523_0938

Added startup migration to deduplicate auto-bundles caused by the name-matching bug. Keeps the oldest (user-renamed) bundle, deletes the duplicates, and strips their tags from chits. Also added emojis to default bundle names for new users: 🗑️ Junk, 🧾 Receipts, 🏦 Finance, 🗓️ Calendar Invites, 📬 Everything Else, 👤 From Contacts.

## cwoc_server-20260523_0927

Fixed duplicate auto-bundles being created when user renames them. `ensure_auto_bundles_exist` was checking by exact name — so renaming "Receipts" to something else caused it to create a new "Receipts". Now identifies existing auto-bundles by `removable=0` + description keywords (same stable approach used by the classifier).

## cwoc_server-20260523_0916

Removed "trademark" from Wyndham hotel smart-link keyword list (web + Android). The word is too generic — it appears in legal footers of nearly every commercial email, causing false-positive Wyndham badges on unrelated emails (e.g., REI).

## cwoc_server-20260523_0833

Fixed catch-up sync triggering unwanted full page reloads on every tab return. Catch-up now only dispatches messages on the dashboard (soft re-render); on other pages it just advances the poll ID silently. The `missed` flag path shows the auto-refresh banner instead of hard-reloading.

## cwoc_server-20260523_0757

Battery-friendly sync: replaced always-on WebSocket + 2-second HTTP polling with a visibility-aware lifecycle that disconnects when the tab is hidden and reconnects with catch-up sync on tab return. Server now sends ping/keepalive frames and the catch-up endpoint returns a `missed` flag for long absences. Alarms fire correctly on tab return via immediate reconciliation check.
