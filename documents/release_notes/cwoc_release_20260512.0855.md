# Release 20260512.0855

Fixed "All in series" / "All following" for recurring drag — now computes the time shift (difference between instance's old and new times) and applies that shift to the parent's dates, instead of overwriting the parent with the instance's absolute new time which broke the recurrence anchor. Also fixed compress view missing days (min-width:0).
