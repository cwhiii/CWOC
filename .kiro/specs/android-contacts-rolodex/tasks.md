# Implementation Plan: Android Contacts Rolodex

## Overview

This plan implements the complete Contacts Rolodex feature for the Android app, achieving full parity with the web version. It covers data layer enhancements (DAO queries, API endpoints, repository methods), reusable UI components (multi-value fields, collapsible zones, color utilities), the People Page (toolbar, grouped/ungrouped modes, search, import/export, contact rows), the Contact Editor (all field zones, image management, save system, QR sharing), and the Contact Trash page.

## Tasks

- [x] 1. Enhance ContactDao with missing queries (getDeletedContacts, getFavorites, getNonFavoriteOwned, getVaultContacts, searchAll across ALL fields, restoreFromTrash, purge, toggleFavorite)
- [x] 2. Add contact-specific API endpoints to CwocApiService (toggleFavorite PATCH, uploadImage multipart POST, deleteImage DELETE, importContacts multipart POST, exportContacts streaming GET, exportSingleContact streaming GET, getTrashContacts GET, restoreContact POST, purgeContact DELETE, getSwitchableUsers GET, getContactBirthdays GET) plus ImportResultDto, ImportErrorDto, and SwitchableUserDto data classes
- [x] 3. Enhance ContactRepository with new operations (toggleFavorite, uploadImage, deleteImage, importFile, exportAll, exportSingle, getTrashContacts, restoreFromTrash, purgeFromTrash, getSwitchableUsers)
- [x] 4. Build VCardBuilder utility that generates valid vCard 3.0 strings with N, FN, TEL, EMAIL, ADR, URL, X-SIGNAL, X-PGP-KEY, X-CALLSIGN, X-XHANDLE, X-FAVORITE, ORG, NICKNAME, NOTE, BDAY properties plus byteSize check against MAX_QR_BYTES=2953
- [x] 5. Build Auto-Contrast utility (computeAutoContrast using luminance formula, parseHexColor, applyContactRowColors returning background+text color pair)
- [x] 6. Build ContactImageManager (resizeImage to max 512px, isGif check, createTempCameraFile with FileProvider URI, GIF passthrough without resize)
- [x] 7. Build MultiValueSection reusable composable (title, icon, dynamic entry rows with label+value+remove, Add button, optional extra actions slot for map/link/calendar, plus parseMultiValueJson and serializeMultiValue helpers)
- [x] 8. Build CollapsibleZone reusable composable (tappable header with title+chevron, AnimatedVisibility content, parchment theme styling)
- [x] 9. Build DropdownWithCustom reusable composable for prefix/suffix fields (dropdown with predefined options + "Custom..." revealing TextField)
- [x] 10. Rebuild PeopleScreen toolbar (New Contact button, Import button with file picker, Export button with dropdown menu, Group/Ungroup toggle persisted to SharedPreferences, Trash button, Search TextField with debounce)
- [x] 11. Rebuild PeopleScreen grouped mode (collapsible section headers with label+count+chevron, Favorites section, Users section, All Contacts section, Contact Vault section, collapse state persisted in SharedPreferences)
- [x] 12. Rebuild PeopleScreen ungrouped mode (merge all contacts+users into flat alphabetical list sorted by display name case-insensitive)
- [x] 13. Rebuild ContactRow composable (star toggle calling toggleFavorite API, circular thumbnail via Coil AsyncImage, display name bold if favorite, detail line with first email·phone·org parsed from JSON, vault icon, QR share button, color theming with auto-contrast, tap navigates to editor, long-press context menu)
- [x] 14. Rebuild UserRow composable (circular thumbnail from profileImageUrl, display name + @username detail, star toggle persisted in SharedPreferences, tap navigates to profile mode editor)
- [x] 15. Rebuild PeopleScreen search (client-side filter using searchAll DAO on every keystroke, 300ms debounced API fallback, filter users by name/username, empty state messages)
- [x] 16. Rebuild PeopleScreen import flow (file picker for .vcf/.csv, loading state, multipart upload to API, ImportResultDialog showing imported/skipped/errors, sync trigger on dismiss)
- [x] 17. Rebuild PeopleScreen export flow (dropdown menu with vcf/csv options, download ResponseBody to Downloads folder, success toast, error handling)
- [x] 18. Rebuild PeopleScreen empty states ("No contacts yet" when empty, "No contacts match your search" when search has no results)
- [x] 19. Rebuild ContactEditorScreen profile image area (80dp circular image/placeholder, tap for gallery, Camera button, View button for full-screen dialog, Remove button, image resize on selection, stage locally until save, live display name header)
- [x] 20. Rebuild ContactEditorScreen vault toggle (two-value pill "Private"/"Vault", tap switches and marks dirty, new contacts check default_share_contacts setting)
- [x] 21. Rebuild ContactEditorScreen name zone (PrefixDropdownWithCustom, GivenName required with red asterisk, MiddleNames, Surname, SuffixDropdownWithCustom, Nickname, all update display name header on change)
- [x] 22. Rebuild ContactEditorScreen phone & email zone (Phone MultiValueSection default "Mobile", Email MultiValueSection default "Home", Address MultiValueSection with map button opening geo: intent and context button, Dates MultiValueSection with Material3 DatePicker and calendar toggle checkbox)
- [x] 23. Rebuild ContactEditorScreen social & web zone (X Handle MultiValueSection, Website MultiValueSection with clickable link icon opening browser, Call Sign MultiValueSection)
- [x] 24. Rebuild ContactEditorScreen security zone (Signal toggle revealing username field + message button generating signal.me deep link, PGP key textarea + Validate button checking BEGIN/END markers)
- [x] 25. Rebuild ContactEditorScreen context zone (Organization field, Social Context field)
- [x] 26. Rebuild ContactEditorScreen color zone (hex input + preview circle, 20-color swatch grid + no-color swatch, selected swatch border+shadow, tint editor background with auto-contrast)
- [x] 27. Rebuild ContactEditorScreen notes zone (multi-line TextField min 6 lines, collapsed by default)
- [x] 28. Rebuild ContactEditorScreen tags zone (input with auto-prepend "Contact/", FlowRow of chips with remove buttons, collapsed by default)
- [x] 29. Rebuild ContactEditorScreen save system (dirty tracking via field comparison, Save & Stay / Save & Exit buttons when dirty, back press unsaved changes dialog with Save/Discard/Cancel, validate given_name, POST for new / PUT for existing)
- [x] 30. Rebuild ContactEditorScreen header actions (favorite toggle, QR button hidden for new, audit button hidden for new, delete button with confirm dialog then soft-delete and navigate back)
- [x] 31. Implement image upload on save (after contact persisted: if pendingImageUri resize+upload via repository, if pendingImageRemove call deleteImage, update local entity imageUrl)
- [x] 32. Build QR Code dialog (add ZXing core dependency, generate QR bitmap from vCard, check byte size, show dialog with title+QR+info or error message, dismissible via close/backdrop/back)
- [x] 33. Rebuild ContactTrashScreen (deleted contacts list from DAO, rows with checkbox+name+org+email+phone+timestamp+actions, Select All, Bulk Restore/Delete with confirm, per-row Restore/Delete, empty state, vault badge)
- [x] 34. Rebuild PeopleViewModel (PeopleUiState, grouped/ungrouped mode, load switchable users, client-side search + API fallback, section collapse persistence, import/export handling, favorite toggle with optimistic UI)
- [x] 35. Rebuild ContactEditorViewModel (mode detection, load contact/profile, form state management, dirty tracking, save with validation+image handling, delete, favorite toggle, default vault, prefill from nav args)
- [x] 36. Rebuild ContactTrashViewModel (observe deleted contacts Flow, selection state, select all/deselect, bulk restore/purge via DAO+API, individual restore/purge, error handling)
- [x] 37. Wire navigation in CwocNavGraph (verify all three screen destinations, add prefillEmail and prefillName as optional nav arguments, ensure back navigation returns to People page)
- [x] 38. Integration testing and polish (verify proper data display not raw JSON, verify images load via Coil, verify color theming, verify search across all fields, verify import/export end-to-end, verify QR generation, verify save system dirty tracking, verify unsaved changes dialog, verify trash operations, verify vault toggle, verify favorite toggle, verify profile mode)

## Task Dependency Graph

```json
{
  "waves": [
    [1, 2, 4, 5, 6],
    [3, 7, 8, 9],
    [34, 35, 36],
    [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
    [37],
    [38]
  ]
}
```

## Notes

- Tasks 1-3 are data layer foundation — must be completed first
- Tasks 4-9 are reusable utilities/components — can be parallelized
- Tasks 10-18 are People Page UI — depend on ViewModel (task 34)
- Tasks 19-31 are Contact Editor UI — depend on ViewModel (task 35)
- Task 33 is Trash UI — depends on ViewModel (task 36)
- Task 37 wires everything together in navigation
- Task 38 is final integration verification
- The existing ContactEntity already has all required fields — no Room migration needed
- The existing sync infrastructure (SyncEngine + SyncPushEngine) handles contact sync automatically
- Image loading uses Coil's AsyncImage with the server base URL prepended to image_url paths
