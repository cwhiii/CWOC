# 20260430 Highlights

- Added invitation/RSVP system for shared chits
- Introduced per-version release notes with modal viewer

---

## 20260430.2201

Added invitation/RSVP system to chit sharing. Shared users can now accept or decline chit invitations, with declined chits appearing faded (or hidden via a new "Hide declined chits" setting). RSVP status is visible on dashboard cards, the quick-edit modal, and the chit editor.

## 20260430.2048

- Release notes modal text is now left-justified
- Modal has a fixed 700px width and min-height so navigation buttons stay in place

## 20260430.2042

- Release notes now use bullet point format for each item

## 20260430.2038

- Moved release notes to `documents/release_notes/` directory
- Backend now scans `/app/documents/release_notes/` for `cwoc_release_*.md` files

## 20260430.2034

- Release notes now use individual versioned files (`cwoc_release_[version].md`) under `documents/release_notes/`
- Settings modal shows release notes one at a time with Older/Newer navigation buttons and a version header
