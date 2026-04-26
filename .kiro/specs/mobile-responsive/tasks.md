# Implementation Plan: Mobile Responsive CWOC

## Overview

Convert the CWOC web application to a fully responsive layout using CSS media queries appended to existing stylesheets and a touch event adapter in `shared.js`. All changes are additive — desktop behavior remains the default. Three breakpoints drive layout: mobile (≤480px), tablet (481–768px), desktop (>768px). No new files, frameworks, or build tools.

## Tasks

- [x] 1. Add viewport meta verification and base responsive CSS to `styles.css`
  - [x] 1.1 Append tablet media query block (max-width: 768px) to `styles.css`
    - Add flex-wrap to `.header` and `.tabs` for tab reflow
    - Set `.tab` min-height to 44px for touch targets
    - Set `.sidebar` to full-width overlay mode (`width: 100%; left: -100%` when closed, `left: 0` when `.active`)
    - Remove `margin-left` shift from `.sidebar.active ~ .main-content`
    - Add `flex-wrap: wrap` to `.chit-header-row` so metadata wraps below title
    - _Requirements: 1.1, 1.3, 1.5, 2.1, 2.3, 2.5, 3.2, 3.5, 5.1_

  - [x] 1.2 Append mobile media query block (max-width: 480px) to `styles.css`
    - Stack `.header` vertically (`flex-direction: column; height: auto; padding: 8px 12px`)
    - Reduce `.logo` to 48x48px and `h1` to `font-size: 1.5em`
    - Set `.tabs` to horizontal scroll with `-webkit-overflow-scrolling: touch`
    - Set `.tab` to `padding: 8px 12px; font-size: 0.85em; min-height: 44px; min-width: 44px`
    - Set `.sidebar` to `width: 100%` overlay with `padding-top: 1em`
    - Set `.chit-card` to full width with `padding: 8px 12px`
    - Reduce `.month-day` to `min-height: 60px; font-size: 0.75em`
    - Stack `.ref-columns` vertically (`flex-direction: column`)
    - Set `.hotkey-panel` to full viewport width with 8px margin
    - Set `.reference-content` to `width: calc(100% - 16px)`
    - Reduce general padding/margins by ~40%
    - _Requirements: 1.1, 1.2, 2.2, 2.4, 4.3, 4.7, 5.2, 5.3, 10.1, 10.2, 10.3, 10.5, 12.1, 12.2, 12.3, 12.4_

  - [x] 1.3 Write unit tests for CSS breakpoint coverage
    - Verify viewport meta tag exists in `index.html` and `editor.html`
    - Verify no new CSS files or build tool configs were introduced
    - _Requirements: 1.4, 1.5_

- [x] 2. Implement sidebar overlay behavior in `shared.js` and `main.js`
  - [x] 2.1 Add `initMobileSidebar()` function to `shared.js`
    - Create/manage a `.sidebar-backdrop` div element
    - On viewport ≤768px: show backdrop when sidebar opens, close sidebar on backdrop click
    - Listen for resize events to toggle overlay mode when crossing 768px boundary
    - Ensure sidebar defaults to closed state on page load at ≤768px
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 2.2 Augment existing `toggleSidebar()` in `main.js` for overlay mode
    - Check `window.innerWidth <= 768` and toggle backdrop accordingly
    - Ensure logo click (sidebar toggle) remains functional at all viewport sizes
    - Call `initMobileSidebar()` on DOMContentLoaded
    - _Requirements: 3.3, 3.4_

  - [x] 2.3 Write unit tests for sidebar overlay logic
    - Test backdrop creation/removal on toggle at mobile widths
    - Test sidebar closes on backdrop click
    - Test sidebar defaults to closed at ≤768px
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement responsive calendar view adaptations in `main.js`
  - [x] 4.1 Add `_getResponsiveDayCount()` helper to `main.js`
    - Return 1 day at ≤480px, 3 days at 481–768px, 7 days at >768px
    - Clamp return value to valid range (1–7)
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 4.2 Integrate responsive day count into calendar week view rendering
    - Call `_getResponsiveDayCount()` when rendering week view to set column count
    - Add prev/next day navigation buttons for mobile single-day view
    - Ensure all seven calendar period modes remain available at all viewport sizes
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 4.3 Add responsive notes column count adaptation in `main.js`
    - 1 column at ≤480px, 2 columns at 481–768px, current masonry at >768px
    - Constrain note card images and preformatted blocks to card width (`max-width: 100%; overflow-x: auto`)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 4.4 Add debounced resize listener for breakpoint-crossing re-renders
    - Debounce at 200ms to avoid excessive re-renders
    - Trigger calendar and notes re-render when viewport crosses breakpoint boundaries
    - _Requirements: 4.1, 4.2, 6.1, 6.2_

  - [x] 4.5 Write unit tests for `_getResponsiveDayCount()`
    - Test returns 1 for widths ≤480, 3 for 481–768, 7 for >768
    - Test clamping to valid range
    - _Requirements: 4.1, 4.2_

- [x] 5. Implement touch event adapter in `shared.js`
  - [x] 5.1 Add `enableTouchDrag(element, callbacks)` function to `shared.js`
    - Map touchstart → mousedown, touchmove → mousemove, touchend → mouseup
    - Extract clientX/clientY from first touch point
    - Call `preventDefault()` on touchmove to block browser scroll during drag
    - Wrap in try/catch with no-op fallback if touch events unsupported
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 5.2 Apply touch adapter to calendar drag-to-move and drag-to-resize
    - Wire `enableTouchDrag` into `enableCalendarDrag()` for timed events
    - Ensure timed events have touch targets of at least 44px height on mobile
    - _Requirements: 4.4, 4.5, 9.1, 9.2_

  - [x] 5.3 Apply touch adapter to checklist drag-to-reorder and chit card drag-to-reorder
    - Wire `enableTouchDrag` into `renderInlineChecklist()` drag handlers
    - Wire `enableTouchDrag` into `enableDragToReorder()` for manual sort
    - _Requirements: 9.3, 9.4_

  - [x] 5.4 Write unit tests for `enableTouchDrag()`
    - Test touch coordinate translation to callback arguments
    - Test preventDefault is called on touchmove
    - _Requirements: 9.1, 9.5_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Add editor responsive CSS to `shared-editor.css` and `editor.css`
  - [x] 7.1 Append tablet media query block (max-width: 768px) to `shared-editor.css`
    - Collapse `.main-zones-grid` to single column (`grid-template-columns: 1fr`)
    - Set `.grid-span-2` to `grid-column: span 1`
    - Hide `.hideWhenNarrow` text in zone action buttons (icon-only display)
    - _Requirements: 7.1, 7.4_

  - [x] 7.2 Append mobile media query block (max-width: 480px) to `shared-editor.css` and `editor.css`
    - Stack `.header-row` vertically (`flex-direction: column; padding: 10px`)
    - Stack `.buttons` vertically (`flex-direction: column; width: 100%`)
    - Stack `#titleWeatherContainer` vertically
    - Stack `.verticalBox`, `.two-column-fields`, `.notes-checklist-container`, `.status-location-container` vertically
    - Set Flatpickr date inputs to `width: 100%`
    - _Requirements: 7.2, 7.3, 7.5, 7.6_

  - [x] 7.3 Write unit tests for editor responsive layout
    - Verify `.main-zones-grid` collapses to single column at ≤768px
    - Verify header stacks vertically at ≤480px
    - _Requirements: 7.1, 7.2_

- [x] 8. Add secondary pages responsive CSS to `shared-page.css`
  - [x] 8.1 Append tablet media query block (max-width: 768px) to `shared-page.css`
    - Collapse `.settings-grid` to single column (`grid-template-columns: 1fr`)
    - Reduce `.settings-panel` padding to 12px
    - _Requirements: 8.1, 8.5_

  - [x] 8.2 Append mobile media query block (max-width: 480px) to `shared-page.css`
    - Stack `.header-and-buttons` vertically (`flex-direction: column; align-items: flex-start; gap: 8px`)
    - Set `.header-buttons` to `width: 100%; justify-content: flex-start`
    - Switch `.help-content .index ul` to single column (`columns: 1`)
    - Set `.cwoc-table` to `display: block; overflow-x: auto` for horizontal scrolling
    - Reduce `.settings-panel` padding to 8px and ensure `max-width: 100%`
    - Reduce `h2, h3` font size to 18px
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [x] 8.3 Write unit tests for secondary pages responsive layout
    - Verify settings grid collapses at ≤768px
    - Verify table horizontal scroll at ≤480px
    - _Requirements: 8.1, 8.3_

- [x] 9. Responsive modal and overlay adjustments in `styles.css`
  - Add mobile (≤480px) rules for Quick Edit modal (full width with 8px margin)
  - Add mobile rules for clock modal (full width with padding)
  - Verify `#deleteChitModal` already constrains to `max-width: 90%`
  - Ensure all modal interactive elements have 44px touch targets
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 10. Verify full feature parity across viewports
  - [x] 10.1 Audit all six C CAPTN tabs accessible at every viewport size
    - Verify all tabs visible and tappable at 320px, 480px, 768px, 1024px
    - Verify all seven calendar periods available at all sizes
    - Verify all sidebar controls (filters, sort, period, search, saved searches) accessible
    - _Requirements: 11.1, 11.5_

  - [x] 10.2 Audit editor and secondary pages for feature completeness
    - Verify all editor zones (Dates, Task, Location, Tags, People, Notes, Checklist, Alerts, Health Indicators, Color, Projects, Audit Log) accessible at all sizes
    - Verify QR code generation, save/delete/archive actions work at all sizes
    - Verify all Settings sections, Trash table actions, Help content, People management accessible
    - Verify Quick Edit modal provides all fields at all sizes
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- No property-based tests — the design has no Correctness Properties section (this feature is CSS/UI-focused)
- All CSS changes are appended to existing files — no new stylesheets
- All JS changes go into existing `shared.js` and `main.js` — no new script files
