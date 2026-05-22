# W240-241: RSVP Status Functions

## What the web functions do
- `_getUserRsvpStatus(chit)` — Gets the current user's RSVP status for a shared chit (accepted/declined/pending). Reads from the chit's `shares` array, finds the entry for the current user, returns their status.
- `_isDeclinedByCurrentUser(chit)` — Returns true if the current user has declined this shared chit. Used to grey out or hide declined items in views.

## What exists on Android
- `RsvpIndicators` composable exists in ChitCardEnhancements (A#573)
- Shares data is synced and stored on ChitEntity
- No function to extract the CURRENT user's RSVP status from the shares array

## What's missing
1. No utility function to get the current user's RSVP status from a chit's shares
2. No filtering of declined chits from views (isDeclinedByCurrentUser check)
3. RsvpIndicators may show indicators but the per-user status extraction logic is missing
4. Declined shared chits may still appear in views where they should be hidden/greyed
