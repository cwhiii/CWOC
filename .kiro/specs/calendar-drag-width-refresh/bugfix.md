# Bugfix Requirements Document

## Introduction

When a chit is dragged to a new time slot in the calendar Day, Week, Work Hours, or X Days views, the overlap/width calculations are not re-run after the drop. This means a chit that was narrowed (because it overlapped with other chits at its old time) retains its narrow width at the new time slot, even if the new slot has no overlapping chits. Similarly, chits remaining at the old slot do not expand to reclaim the freed space. The widths only update correctly on a full page refresh.

The root cause is in `_onCalDragEnd()` in `frontend/shared.js`: after successfully saving the chit's new time via the PUT API call, the function returns without triggering a view re-render. The overlap layout (which determines each chit's `left` and `width` CSS properties) is only computed during the initial render of each calendar view (in `displayDayView`, `displayWeekView`, and the SevenDay view renderer in `frontend/main.js`). Without a re-render, the stale layout persists.

Note: The recurring-event drag modal handlers already correctly call `fetchChits()` / `displayChits()` after their operations — only the normal (non-recurring) drag path is missing this call.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a chit is dragged to a new time slot in Day/Week/Work/SevenDay view AND the chit previously had a narrow width due to overlapping chits at its old time THEN the system retains the chit's narrow width at the new time slot instead of recalculating it

1.2 WHEN a chit is dragged away from a time slot that had multiple overlapping chits THEN the system does not recalculate the widths of the remaining chits at the old time slot, leaving them unnecessarily narrow

1.3 WHEN a chit is dragged to a time slot that already has other chits THEN the system does not recalculate overlap widths for the destination slot, potentially causing the dropped chit to visually overlap existing chits at full width

1.4 WHEN a chit is resized (drag the bottom edge) in Day/Week/Work/SevenDay view AND the resize changes which time slots it occupies THEN the system does not recalculate overlap widths for the affected time slots

### Expected Behavior (Correct)

2.1 WHEN a chit is dragged to a new time slot in Day/Week/Work/SevenDay view THEN the system SHALL re-render the calendar view so that the chit's width is recalculated based on the actual overlaps at the new time slot

2.2 WHEN a chit is dragged away from a time slot that had multiple overlapping chits THEN the system SHALL re-render the calendar view so that the remaining chits at the old time slot expand to use the available width

2.3 WHEN a chit is dragged to a time slot that already has other chits THEN the system SHALL re-render the calendar view so that all chits at the destination slot are properly narrowed to avoid visual overlap

2.4 WHEN a chit is resized in Day/Week/Work/SevenDay view AND the resize changes which time slots it occupies THEN the system SHALL re-render the calendar view so that overlap widths are recalculated for all affected time slots

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a chit is dragged to a new time slot THEN the system SHALL CONTINUE TO save the updated start/end/due datetime to the backend via the PUT API

3.2 WHEN a chit is dragged but the mouse does not actually move (no-op drag) THEN the system SHALL CONTINUE TO skip saving and not trigger any re-render

3.3 WHEN a recurring chit instance is dragged THEN the system SHALL CONTINUE TO show the recurring-event modal and handle the user's choice before re-rendering

3.4 WHEN chits are initially rendered in Day/Week/Work/SevenDay view THEN the system SHALL CONTINUE TO calculate overlap widths correctly on first render

3.5 WHEN a chit is dragged within the same time slot (vertical position unchanged, only moved to a different day column) THEN the system SHALL CONTINUE TO save the day change and re-render with correct widths

3.6 WHEN a chit drag save fails (network error or API error) THEN the system SHALL CONTINUE TO log the error and not leave the UI in a broken state
