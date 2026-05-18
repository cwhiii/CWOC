## m20260518.0628

Fixed calendar view crash (IllegalArgumentException: Can't represent a size of 374973 in Constraints). Root cause: multi-day events produced unbounded pixel heights inside scrollable containers, exceeding Compose's layout constraint limit. Fixed DayTimeGrid and WeekTimeGrid layout structure (removed redundant .height(totalHeight) on scroll containers, moved scroll to proper level) and clamped event duration to max 24 hours (1440 minutes) to prevent overflow.
