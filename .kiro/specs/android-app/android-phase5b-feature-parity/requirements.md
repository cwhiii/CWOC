# Requirements Document — Phase 5b: Feature Parity

## Introduction

Phase 5b builds on Phase 5a's core usability to bring the Android app to full feature parity with the web app. This includes the contact editor, additional calendar views, Omni View, proper tags UI, markdown preview, pin/archive/snooze actions, habits, weather integration, help page, and notifications display.

## Glossary

- **Omni_View**: Configurable dashboard combining chrono-anchored events, reminders, on-deck, pinned items, weather, and email
- **HST_Bar**: Horizontal Strip Timeline showing upcoming events as a scrollable timeline
- **Tag_Tree**: Hierarchical tag display with parent/child nesting (e.g., "Work/Projects/Alpha")
- **Habit**: A recurring chit with goal/success tracking, streak counting, and period-based reset
- **Snooze**: Temporarily hiding a chit until a specified time, after which it reappears

## Requirements

### Requirement 1: Contact Editor

**User Story:** As a user, I want to create, edit, and delete contacts on the Android app, so that I have full contact management.

#### Acceptance Criteria

1. THE App SHALL provide a Contact Editor screen accessible by tapping a contact in the list or a "New Contact" button.
2. THE Contact Editor SHALL support editing: name fields (given, family, middle, prefix, suffix), phones, emails, addresses, notes, tags, color, dates.
3. THE Contact Editor SHALL support adding/removing multi-value fields (multiple phones, emails, addresses).
4. THE Contact Editor SHALL support saving changes with dirty tracking and sync push.
5. THE Contact Editor SHALL support deleting a contact (soft-delete with confirmation).
6. THE App SHALL allow creating new contacts from the contacts list screen.

### Requirement 2: Calendar Additional Views

**User Story:** As a user, I want Month, Year, Itinerary, and X-Day calendar views, so that I have the same calendar flexibility as the web app.

#### Acceptance Criteria

1. THE Calendar screen SHALL support a view mode selector with: Day, Week, Month, Year, Itinerary, X-Day.
2. THE Month view SHALL display a grid of days with event indicators (dots or mini-text).
3. THE Year view SHALL display 12 months in a grid with day-level event indicators.
4. THE Itinerary view SHALL display events as a chronological list grouped by day.
5. THE X-Day view SHALL display a configurable number of days (default 7) as columns.
6. THE App SHALL persist the last-used calendar view mode.

### Requirement 3: Omni View

**User Story:** As a user, I want an Omni View that shows a combined dashboard of today's events, reminders, upcoming items, and pinned content, so that I have a quick overview.

#### Acceptance Criteria

1. THE App SHALL provide an Omni View accessible as a tab or from the sidebar.
2. THE Omni View SHALL display sections: Chrono Anchored (today's timed events), Reminders (upcoming alerts), On Deck (next few tasks), Soon (upcoming due dates), Pinned Notes, Pinned Checklists.
3. THE Omni View sections SHALL be configurable (show/hide, reorder) matching the web app's layout settings.
4. THE Omni View SHALL respect the user's locked filter defaults if configured.
5. Tapping any item in the Omni View SHALL navigate to the editor for that chit.

### Requirement 4: Tags UI in Editor

**User Story:** As a user, I want a proper tag picker in the editor with hierarchical display and color-coded chips, so that tagging is easy and visual.

#### Acceptance Criteria

1. THE Editor tags zone SHALL display existing tags as color-coded chips (using tag colors from settings).
2. THE Editor SHALL provide a tag picker showing the full tag tree (hierarchical with expand/collapse).
3. THE Editor SHALL allow creating new tags inline (type a name, confirm to create).
4. THE Editor SHALL allow removing tags by tapping the X on a chip.
5. THE Editor SHALL show tag favorites at the top of the picker for quick access.
6. THE tag picker SHALL support search/filter within the tag list.

### Requirement 5: Markdown Preview in Editor Notes

**User Story:** As a user, I want to preview rendered markdown in the notes field, so that I can see how my notes will look.

#### Acceptance Criteria

1. THE Editor notes zone SHALL provide a toggle between Edit mode (raw text) and Preview mode (rendered markdown).
2. THE Preview mode SHALL render markdown including: headings, bold, italic, links, lists, code blocks, images, blockquotes.
3. THE Preview mode SHALL constrain images to max-width 100%.
4. THE rendered markdown SHALL use styling consistent with the web app's marked.js output.

### Requirement 6: Pin/Archive/Snooze Actions

**User Story:** As a user, I want to pin, archive, and snooze chits from the list view and editor, so that I can organize my workflow.

#### Acceptance Criteria

1. THE App SHALL allow pinning/unpinning chits (via long-press menu or editor button).
2. THE App SHALL allow archiving/unarchiving chits (via swipe action or editor button).
3. THE App SHALL allow snoozing chits with preset durations (15min, 1h, 3h, tomorrow, next week) or custom date/time.
4. Pinned chits SHALL appear at the top of their respective view lists.
5. Archived chits SHALL be hidden from default views (visible only when archive filter is enabled).
6. Snoozed chits SHALL be hidden until their snooze time expires, then reappear.

### Requirement 7: Habits View and Editor Zone

**User Story:** As a user, I want to view and manage habits on the Android app, so that I can track daily/weekly/monthly habits.

#### Acceptance Criteria

1. THE App SHALL display habit chits in the Tasks view with habit-specific indicators (streak, success rate, goal progress).
2. THE Editor SHALL provide a Habits zone with: habit toggle, goal setting, success tracking, period display.
3. THE App SHALL allow incrementing/decrementing habit success count.
4. THE App SHALL display habit streak and success rate.
5. THE App SHALL support habit reset periods (daily, weekly, monthly).

### Requirement 8: Weather Integration

**User Story:** As a user, I want to see weather forecasts for my chit locations, so that I can plan accordingly.

#### Acceptance Criteria

1. THE App SHALL display weather data on chit cards that have locations with weather forecasts.
2. THE App SHALL provide a Weather page showing forecasts for saved locations.
3. THE Weather page SHALL display: temperature high/low, conditions, precipitation chance, wind.
4. THE App SHALL use weather data synced from the server (not fetch independently).

### Requirement 9: Help Page

**User Story:** As a user, I want to access help documentation within the Android app, so that I can learn features without switching to a browser.

#### Acceptance Criteria

1. THE App SHALL provide a Help screen accessible from the sidebar/menu.
2. THE Help screen SHALL display documentation topics fetched from `/api/docs`.
3. THE Help screen SHALL render markdown content with proper formatting.
4. THE Help screen SHALL support navigation between topics.

### Requirement 10: Notifications/Reminders Display

**User Story:** As a user, I want to see and manage my notifications within the app, so that I can respond to invitations and reminders.

#### Acceptance Criteria

1. THE App SHALL display a notification badge in the header when unread notifications exist.
2. THE App SHALL provide a notification inbox (accessible from header badge tap) showing pending notifications.
3. THE App SHALL allow accepting/declining invitation notifications.
4. THE App SHALL allow dismissing reminder notifications.
