# Release 20260512.0949

Fixed contact editor date fields always showing Jan 1 of the current year instead of the saved date. The issue was Flatpickr trying to parse the ISO date string (YYYY-MM-DD) using its display format (YYYY-Mon-DD), which failed silently. Now parses the ISO date into a proper Date object before passing it to Flatpickr's defaultDate option.
