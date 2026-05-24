## cwoc_app-20260524_0820

Fixed app stuck on splash screen. The NavHost was not being rendered while the splash logo was shown, creating a deadlock where `currentRoute` could never resolve. Now renders the NavGraph behind the splash overlay so navigation resolves immediately. Also added duplicate-connection guard to WebSocketClient and try/catch protection around foreground service starts to prevent crashes on Android 12+.

## cwoc_app-20260524_0714

Rewrote Android OmniView deduplication to use identical logic to the web's `_omniDeduplicateChits()`. Previously the app used independent filter functions per section (no deduplication, no habits, On Deck required status!=null, Chrono missed due-today timed items). Now uses a single-pass priority-ordered algorithm matching the web line-for-line: Reminders → Email → Habits → Chrono/OnDeck/Soon → Pinned. Also fixed the `ondeck` layout config ID mismatch and ensured emails bypass sidebar filters.

## cwoc_app-20260524_0712

Fixed email inbox showing zero emails on Android. The app was checking for a plain "Inbox" tag but the server assigns "CWOC_System/Email/Inbox". Now correctly checks for the system tag with a fallback to the emailFolder field, matching the web frontend's logic. Also fixed the same issue in the email badge count, Omni View email widget, and deduplication engine.

## cwoc_server-20260524_0618 / cwoc_app-20260524_0618

Rules engine: email address fields (From, To, CC, BCC) now show the user's configured email accounts as quick-select options in the contacts dropdown. On web, accounts appear at the top of the autocomplete on focus (before typing). On Android, email address condition values show an editable dropdown with all configured accounts. Works across all platforms.
