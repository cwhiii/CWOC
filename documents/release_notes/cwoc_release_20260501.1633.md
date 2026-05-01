# Release 20260501.1633

Batch fix addressing 12 UI/UX issues:

- **Rolodex users**: Users can now be favorited (★ toggle, persisted locally) and appear in the Favorites section alongside contacts. Clicking a user row opens their profile.
- **Stealth greyout**: When stealth is enabled on a chit, all sharing controls, assignment dropdown, people search, and shared user chips are greyed out and disabled.
- **All-day drag & drop**: Fixed all-day event drag-and-drop to correctly detect target day when using grid-based multi-day event rendering.
- **X-Days hotkey**: Changed period hotkey for X Days from `.→S` to `.→X`. Updated panel, reference overlay, and help page.
- **Profile picture sizing**: Profile images in the top-right corner now match the height of adjacent buttons on both dashboard and secondary pages.
- **Past-due label in Tasks**: Overdue items now display "Past Due: YYYY-MMM-DD" (e.g., "Past Due: 2026-Apr-28") instead of the generic "Due:" label.
- **Indicator chart date labels**: Charts now use smarter, shorter date labels based on the time range (time for ≤2 days, day-of-month for ≤2 weeks, M/D for ≤3 months, M/D/YY for longer).
- **Heart rate icon**: Changed from 💓 to plain red ❤️ across indicator charts, sidebar filter, and editor health zone.
- **Indicator chart drag-reorder**: Charts in the Indicators view can now be dragged to reorder, with order persisted in localStorage.
- **Mobile top bar swipe**: Swiping left/right on the tab bar cycles through views on mobile.
- **Mobile day view overflow**: Timed events on mobile now stay within column bounds when pinch-zooming, with proper max-width and box-sizing.
- **User switcher buttons**: Modal buttons now stay on one line with `flex-wrap: nowrap`.
