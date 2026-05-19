# Image View Modal

**Category:** Modals & Overlays
**Item #:** 70
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Implementation (contact-editor.js)
The image view modal is used in the contact editor to view profile images at full size.

### Trigger Methods
- [ ] Click on profile image container — Opens the image modal if image is visible and has a src
- [ ] Click on profile image element directly — Opens the image modal (stopPropagation to prevent container handler)

### Display Elements
- [ ] Modal overlay (#image-modal) — Full-screen flex overlay (display: flex when open)
- [ ] Full-size image (#image-modal-img) — Shows the profile image at full resolution; src set from the profile image element

### Controls & Interactions
- [ ] ESC key — Closes the modal (sets display: none); checked before other ESC handlers in the page's keydown listener
- [ ] Click outside image — Closes the modal (standard modal overlay click behavior)

### Modal Structure (in contact-editor.html)
- [ ] #image-modal — The modal overlay container
- [ ] #image-modal-img — The img element that displays the full-size image

### Guard Conditions
- [ ] Image must be visible (style.display !== 'none')
- [ ] Image must have a src attribute
- [ ] Modal only opens if both conditions are met

### ESC Priority (contact-editor.js)
- [ ] Image modal ESC check comes before other modal checks in the page's keydown handler
- [ ] Sets modal display to 'none' and returns (prevents further ESC handling)
