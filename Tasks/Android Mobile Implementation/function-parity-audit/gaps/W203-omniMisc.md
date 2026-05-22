# W203-207: Omni View Miscellaneous Functions

## What the web functions do
W203-207 are Omni View helper functions for:
- HST (Horizontal Space-Time) bar interactions — clicking the bar opens the weather modal, hovering shows time/temperature tooltips
- Omni section collapse/expand persistence
- Omni "pinned all" section that shows ALL pinned chits regardless of type
- Omni reminder section with "time until" countdown badges

## What exists on Android
- OmniViewScreen has HST bar (OmniHstBar composable)
- Sections are rendered but collapse/expand state may not persist
- Pinned sections exist (OmniPinnedAllCard)
- Reminder section exists (OmniReminderCard)

## What's missing
1. HST bar tap → weather modal interaction (web opens weather modal on bar click)
2. Section collapse/expand state persistence across app restarts
3. Any specific behaviors from W203-207 that aren't covered by the existing composables (need individual verification if these become priority)
